import { getFirebaseMessaging } from '../firebase-admin';
import { db } from '@db';
import { userDevices, users } from '../../../shared/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';

/**
 * 디바이스 토큰 등록/갱신 (Upsert)
 * 이미 존재하는 토큰이면 lastUsedAt 갱신, 없으면 새로 INSERT
 */
export async function upsertDeviceToken(
  userId: number,
  token: string,
  deviceType: string
): Promise<void> {
  try {
    // 기존 토큰 조회
    const existing = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.deviceToken, token))
      .limit(1);

    if (existing.length > 0) {
      // 이미 존재 → userId와 lastUsedAt 갱신 (계정 스위칭 대응)
      await db
        .update(userDevices)
        .set({
          userId,
          deviceType,
          isActive: true,
          lastUsedAt: new Date(),
        })
        .where(eq(userDevices.deviceToken, token));

      console.log(`[Token] 토큰 갱신: userId=${userId}, token=${token.substring(0, 10)}...`);
    } else {
      // 신규 등록
      await db.insert(userDevices).values({
        userId,
        deviceToken: token,
        deviceType,
        isActive: true,
        lastUsedAt: new Date(),
      });

      console.log(`[Token] 토큰 신규 등록: userId=${userId}, platform=${deviceType}`);
    }

    // 토픽 구독 (비동기, 실패해도 무시)
    subscribeToTopics(token, userId).catch(err => {
      console.error('[Token] 토픽 구독 실패 (무시됨):', err);
    });
  } catch (error) {
    console.error('[Token] upsertDeviceToken 실패:', error);
    throw error;
  }
}

/**
 * FCM 토픽 구독 (all_users + hospital_{ID})
 */
export async function subscribeToTopics(token: string, userId: number): Promise<void> {
  try {
    const messaging = getFirebaseMessaging();

    // 1. 전체 유저 토픽 구독
    await messaging.subscribeToTopic([token], 'all_users');

    // 2. 병원 토픽 구독 (유저의 hospitalId 조회)
    const user = await db
      .select({ hospitalId: users.hospitalId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length > 0 && user[0].hospitalId) {
      await messaging.subscribeToTopic([token], `hospital_${user[0].hospitalId}`);
      console.log(`[Token] 토픽 구독: all_users + hospital_${user[0].hospitalId}`);
    } else {
      console.log(`[Token] 토픽 구독: all_users (병원 없음)`);
    }
  } catch (error) {
    console.error('[Token] subscribeToTopics 실패:', error);
  }
}

/**
 * 토픽 구독 해제
 */
export async function unsubscribeFromTopics(token: string): Promise<void> {
  try {
    const messaging = getFirebaseMessaging();
    await messaging.unsubscribeFromTopic([token], 'all_users');
    // 병원 토픽은 정확한 이름을 모르므로 토큰 비활성화만으로 충분
    // FCM이 다음 발송 시 UNREGISTERED로 자동 처리
  } catch (error) {
    console.error('[Token] unsubscribeFromTopics 실패:', error);
  }
}

/**
 * 특정 토큰 비활성화 (로그아웃 시 사용)
 */
export async function deactivateToken(token: string): Promise<void> {
  try {
    await db
      .update(userDevices)
      .set({ isActive: false })
      .where(eq(userDevices.deviceToken, token));

    // 토픽 구독 해제 (비동기, 실패 무시)
    unsubscribeFromTopics(token).catch(() => {});

    console.log(`[Token] 토큰 비활성화: ${token.substring(0, 10)}...`);
  } catch (error) {
    console.error('[Token] deactivateToken 실패:', error);
  }
}

/**
 * 특정 유저의 모든 토큰 비활성화 (회원 탈퇴 시 사용)
 */
export async function deactivateAllUserTokens(userId: number): Promise<void> {
  try {
    const devices = await db
      .select({ deviceToken: userDevices.deviceToken })
      .from(userDevices)
      .where(and(eq(userDevices.userId, userId), eq(userDevices.isActive, true)));

    if (devices.length === 0) return;

    // DB 비활성화
    await db
      .update(userDevices)
      .set({ isActive: false })
      .where(and(eq(userDevices.userId, userId), eq(userDevices.isActive, true)));

    // 토픽 구독 해제 (각 토큰)
    for (const device of devices) {
      unsubscribeFromTopics(device.deviceToken).catch(() => {});
    }

    console.log(`[Token] userId=${userId} 의 ${devices.length}개 토큰 전체 비활성화`);
  } catch (error) {
    console.error('[Token] deactivateAllUserTokens 실패:', error);
  }
}

/**
 * 유저의 활성 토큰 배열 조회
 */
export async function getActiveTokensByUserId(userId: number): Promise<string[]> {
  const devices = await db
    .select({ deviceToken: userDevices.deviceToken })
    .from(userDevices)
    .where(and(eq(userDevices.userId, userId), eq(userDevices.isActive, true)));

  return devices.map(d => d.deviceToken);
}

/**
 * 90일 미사용 토큰 정리 (Cron용)
 */
export async function cleanupStaleTokens(): Promise<number> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const staleDevices = await db
      .select({ deviceToken: userDevices.deviceToken })
      .from(userDevices)
      .where(and(
        eq(userDevices.isActive, true),
        lt(userDevices.lastUsedAt, cutoff)
      ));

    if (staleDevices.length === 0) {
      console.log('[Token Cleanup] 정리할 좀비 토큰 없음');
      return 0;
    }

    const tokens = staleDevices.map(d => d.deviceToken);
    await db
      .update(userDevices)
      .set({ isActive: false })
      .where(inArray(userDevices.deviceToken, tokens));

    // 토픽 구독 해제
    for (const token of tokens) {
      unsubscribeFromTopics(token).catch(() => {});
    }

    console.log(`[Token Cleanup] ${tokens.length}개 좀비 토큰 비활성화 완료`);
    return tokens.length;
  } catch (error) {
    console.error('[Token Cleanup] 실패:', error);
    return 0;
  }
}
