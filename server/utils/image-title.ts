import { db } from "@db";
import { images } from "@shared/schema";
import { eq, and, gte, lt, count } from "drizzle-orm";

/**
 * 카테고리 ID → 한글명 매핑
 */
const CATEGORY_LABELS: Record<string, string> = {
  'mansak_img': '만삭',
  'family_img': '가족',
  'sticker_img': '스티커',
  'snapshot': '스냅',
  'baby_face_img': '아기얼굴',
  'collage': '콜라주',
  'default': '이미지'
};

/**
 * 현재 날짜를 YYYYMMDD 형식으로 반환 (한국 시간 기준)
 * @returns 현재 날짜를 YYYYMMDD 형식의 문자열로 반환
 */
export function formatDateKST(): string {
  try {
    const now = new Date();
    // 한국 시간(KST, UTC+9)으로 변환
    const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[formatDateKST] 오류:', errorMessage);
    throw new Error(`날짜 포맷팅 실패: ${errorMessage}`);
  }
}

/**
 * 카테고리 ID를 한글명으로 변환
 * @param categoryId 카테고리 ID (예: 'mansak_img', 'family_img')
 * @returns 카테고리의 한글명 (존재하지 않으면 '이미지' 반환)
 */
export function getCategoryLabel(categoryId: string): string {
  if (!categoryId) {
    console.warn('[getCategoryLabel] categoryId가 비어있습니다. 기본값 사용');
    return CATEGORY_LABELS['default'];
  }
  
  const label = CATEGORY_LABELS[categoryId];
  if (!label) {
    console.warn(`[getCategoryLabel] 알 수 없는 카테고리: ${categoryId}. 기본값 사용`);
    return CATEGORY_LABELS['default'];
  }
  
  return label;
}

/**
 * 이미지 제목 생성
 * 형식: [카테고리]_[스타일]_[날짜YYYYMMDD]_[순번3자리]
 * 예: 만삭_elegant_20260118_001
 * 
 * @param categoryId 카테고리 ID
 * @param style 스타일명
 * @param userId 사용자 ID (선택사항, 없으면 'anonymous' 사용)
 * @param imageId 이미지 ID (선택사항, 제공되면 제목 끝에 추가)
 * @returns 생성된 이미지 제목
 * @throws 입력값 검증 실패 또는 DB 쿼리 오류
 */
export async function generateImageTitle(
  categoryId: string,
  style: string,
  userId?: string,
  imageId?: number
): Promise<string> {
  try {
    // 입력값 검증
    if (!categoryId || !style) {
      throw new Error('categoryId와 style은 필수 입력값입니다.');
    }
    
    // 카테고리 라벨 변환
    const categoryLabel = getCategoryLabel(categoryId);
    
    // 날짜 포맷팅 (한국 시간)
    const dateStr = formatDateKST();
    
    // 사용자 ID 정규화 (없으면 anonymous)
    const normalizedUserId = userId || 'anonymous';
    
    // 한국 시간 기준 당일의 시작과 끝 계산
    const now = new Date();
    const kstToday = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    
    const dayStart = new Date(kstToday);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(kstToday);
    dayEnd.setHours(23, 59, 59, 999);
    
    console.log('[generateImageTitle] 제목 생성 시작', {
      categoryId,
      categoryLabel,
      style,
      userId: normalizedUserId,
      dateStr,
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString()
    });
    
    // DB에서 같은 조건(userId + categoryId + 당일)의 이미지 수 카운트
    const countResult = await db
      .select({ count: count() })
      .from(images)
      .where(
        and(
          eq(images.userId, normalizedUserId),
          eq(images.categoryId, categoryId),
          gte(images.createdAt, dayStart),
          lt(images.createdAt, dayEnd)
        )
      );
    
    // 현재 이미지 수 + 1 = 순번
    const imageCount = countResult[0]?.count || 0;
    const sequenceNumber = imageCount + 1;
    const paddedSequence = String(sequenceNumber).padStart(3, '0');
    
    console.log('[generateImageTitle] 카운트 결과', {
      imageCount,
      sequenceNumber,
      paddedSequence
    });
    
    // 최종 제목 조합: [카테고리]_[스타일]_[날짜]_[순번]
    let title = `${categoryLabel}_${style}_${dateStr}_${paddedSequence}`;
    
    // imageId가 제공되면 제목 끝에 추가
    if (imageId !== undefined) {
      title = `${title}_${imageId}`;
    }
    
    console.log('[generateImageTitle] 제목 생성 완료:', title);
    
    return title;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[generateImageTitle] 오류:', errorMessage);
    throw new Error(`이미지 제목 생성 실패: ${errorMessage}`);
  }
}

/**
 * 이미지 ID로 제목에 ID를 추가하는 헬퍼 함수
 * INSERT 후 ID를 알게 된 경우 사용
 * @param title 기존 이미지 제목
 * @param imageId 추가할 이미지 ID
 * @returns imageId가 추가된 제목
 */
export function appendImageIdToTitle(title: string, imageId: number): string {
  return `${title}_${imageId}`;
}

/**
 * 주어진 날짜를 KST YYYYMMDD 형식으로 변환
 * @param date 변환할 날짜
 * @returns KST YYYYMMDD 형식의 날짜 문자열
 */
export function formatDateToKST(date: Date): string {
  const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}
