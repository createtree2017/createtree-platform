import { eq, and } from 'drizzle-orm';
import { images } from '@shared/schema';

// 작업지시서 방식: 단순한 사용자별 이미지 필터링
export function buildUserImageFilter({ userId, category }: { userId: string | number; category?: string }) {
  const conditions = [eq(images.userId, String(userId))];
  
  if (category) {
    conditions.push(eq(images.categoryId, category));
  }
  
  return and(...conditions);
}