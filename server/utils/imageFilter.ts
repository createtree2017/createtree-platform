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

type UserGalleryVisibilityImage = {
  style?: string | null;
  categoryId?: string | null;
  metadata?: unknown;
};

function parseImageMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata) return {};

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  return typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
}

export function isHiddenFromUserGallery(image: UserGalleryVisibilityImage): boolean {
  const metadata = parseImageMetadata(image.metadata);

  if (metadata.hiddenFromGallery === true || metadata.purpose === 'mission_submission') {
    return true;
  }

  if (image.categoryId === 'collage') {
    return true;
  }

  // 2026-05 이전 일부 내부 콜라주가 categoryId 없이 style만 collage로 저장된 경우 보호.
  return image.style === 'collage' && !image.categoryId;
}
