import { getFirebaseMessaging } from '../firebase-admin';
import { db } from '@db';
import { pushDeliveryLogs, userDevices } from '../../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

// FCM 발송 결과 타입
interface SendResult {
  successCount: number;
  failureCount: number;
}

// 발송 로그 옵션 타입
interface DeliveryLogOptions {
  triggerType: string;
  targetType: string;
  title: string;
  body: string;
  adminId?: number;
  targetQuery?: Record<string, any>;
}

/**
 * 특정 유저의 모든 활성 기기에 푸시 발송
 * 토큰이 0개인 경우 no-op (에러 안 던짐)
 */
export async function sendToUser(
  userId: number,
  payload: { notification: { title: string; body: string }; data?: Record<string, string> },
  logOptions?: Partial<DeliveryLogOptions>
): Promise<SendResult> {
  try {
    // 유저의 활성 토큰 조회
    const devices = await db
      .select()
      .from(userDevices)
      .where(and(eq(userDevices.userId, userId), eq(userDevices.isActive, true)));

    const tokens = devices.map(d => d.deviceToken);

    // 토큰 0개 → no-op (앱 미설치, 푸시 거부, 웹 전용 사용자)
    if (tokens.length === 0) {
      console.log(`[Push] userId=${userId} 활성 토큰 없음 (no-op)`);
      return { successCount: 0, failureCount: 0 };
    }

    const result = await sendBatch(tokens, payload);

    // 발송 로그 기록
    if (logOptions) {
      await insertDeliveryLog({
        triggerType: logOptions.triggerType || 'system',
        targetType: logOptions.targetType || 'specific_user',
        title: logOptions.title || payload.notification.title,
        body: logOptions.body || payload.notification.body,
        adminId: logOptions.adminId,
        targetQuery: logOptions.targetQuery || { user_ids: [userId] },
        ...result,
      });
    }

    return result;
  } catch (error) {
    console.error(`[Push] sendToUser 실패 userId=${userId}:`, error);
    return { successCount: 0, failureCount: 0 };
  }
}

/**
 * 여러 유저에게 배치 발송 (관리자 수동 발송 등)
 */
export async function sendToUsers(
  userIds: number[],
  payload: { notification: { title: string; body: string }; data?: Record<string, string> },
  logOptions?: Partial<DeliveryLogOptions>
): Promise<SendResult> {
  try {
    // 모든 유저의 활성 토큰 조회
    const devices = await db
      .select()
      .from(userDevices)
      .where(and(
        inArray(userDevices.userId, userIds),
        eq(userDevices.isActive, true)
      ));

    const tokens = devices.map(d => d.deviceToken);

    if (tokens.length === 0) {
      console.log(`[Push] ${userIds.length}명의 유저 중 활성 토큰 없음 (no-op)`);
      return { successCount: 0, failureCount: 0 };
    }

    const result = await sendBatch(tokens, payload);

    // 발송 로그 기록
    if (logOptions) {
      await insertDeliveryLog({
        triggerType: logOptions.triggerType || 'manual',
        targetType: logOptions.targetType || 'specific_user',
        title: logOptions.title || payload.notification.title,
        body: logOptions.body || payload.notification.body,
        adminId: logOptions.adminId,
        targetQuery: logOptions.targetQuery || { user_ids: userIds },
        ...result,
      });
    }

    return result;
  } catch (error) {
    console.error(`[Push] sendToUsers 실패:`, error);
    return { successCount: 0, failureCount: 0 };
  }
}

/**
 * FCM 토픽을 통한 브로드캐스트 발송
 */
export async function sendToTopic(
  topic: string,
  payload: { notification: { title: string; body: string }; data?: Record<string, string> },
  logOptions?: Partial<DeliveryLogOptions>
): Promise<boolean> {
  try {
    const messaging = getFirebaseMessaging();
    const message = {
      topic,
      notification: payload.notification,
      data: payload.data,
    };

    const response = await messaging.send(message);
    console.log(`[Push] 토픽 발송 성공: ${topic}, messageId=${response}`);

    // 발송 로그 기록
    if (logOptions) {
      await insertDeliveryLog({
        triggerType: logOptions.triggerType || 'manual',
        targetType: logOptions.targetType || 'all',
        title: logOptions.title || payload.notification.title,
        body: logOptions.body || payload.notification.body,
        adminId: logOptions.adminId,
        targetQuery: { topic },
        successCount: 1,
        failureCount: 0,
      });
    }

    return true;
  } catch (error) {
    console.error(`[Push] 토픽 발송 실패 topic=${topic}:`, error);
    return false;
  }
}

/**
 * 토큰 배열을 500개씩 청크로 나누어 FCM 발송
 * Promise.allSettled로 한 청크 실패해도 나머지 계속 진행
 */
async function sendBatch(
  tokens: string[],
  payload: { notification: { title: string; body: string }; data?: Record<string, string> }
): Promise<SendResult> {
  const CHUNK_SIZE = 500;
  let totalSuccess = 0;
  let totalFailure = 0;

  const messaging = getFirebaseMessaging();
  const chunks: string[][] = [];

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    chunks.push(tokens.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const message = {
        tokens: chunk,
        notification: payload.notification,
        data: payload.data,
      };

      const response = await messaging.sendEachForMulticast(message);

      // 실패한 토큰 처리
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code;
          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token'
          ) {
            failedTokens.push(chunk[idx]);
          }
        }
      });

      // 좀비 토큰 비활성화
      if (failedTokens.length > 0) {
        await handleFailedTokens(failedTokens);
      }

      return {
        success: response.successCount,
        failure: response.failureCount,
      };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalSuccess += result.value.success;
      totalFailure += result.value.failure;
    } else {
      // 청크 레벨 에러 (네트워크 등)
      console.error('[Push] 청크 발송 에러:', result.reason);
    }
  }

  console.log(`[Push] 발송 완료: 성공 ${totalSuccess}, 실패 ${totalFailure} (총 ${tokens.length}개 토큰)`);
  return { successCount: totalSuccess, failureCount: totalFailure };
}

/**
 * UNREGISTERED 에러 발생한 토큰을 DB에서 비활성화
 */
async function handleFailedTokens(failedTokens: string[]): Promise<void> {
  try {
    await db
      .update(userDevices)
      .set({ isActive: false })
      .where(inArray(userDevices.deviceToken, failedTokens));

    console.log(`[Push] ${failedTokens.length}개 좀비 토큰 비활성화 완료`);
  } catch (error) {
    console.error('[Push] 좀비 토큰 비활성화 실패:', error);
  }
}

/**
 * push_delivery_logs에 발송 이력 INSERT
 */
async function insertDeliveryLog(data: {
  triggerType: string;
  targetType: string;
  title: string;
  body: string;
  adminId?: number;
  targetQuery?: Record<string, any>;
  successCount: number;
  failureCount: number;
}): Promise<void> {
  try {
    await db.insert(pushDeliveryLogs).values({
      adminId: data.adminId || null,
      triggerType: data.triggerType,
      targetType: data.targetType,
      targetQuery: data.targetQuery || null,
      title: data.title,
      body: data.body,
      status: 'completed',
      successCount: data.successCount,
      failureCount: data.failureCount,
      completedAt: new Date(),
    });
  } catch (error) {
    console.error('[Push] 발송 로그 저장 실패:', error);
  }
}
