import { db } from '@db';
import { images } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { buildUserImageFilter } from './utils/imageFilter';
import { generateThumbnail, getThumbnailUrl } from './utils/thumbnail';

// 작업지시서 방식: 단순한 사용자별 이미지 조회 (성능 최적화)
export async function getUserImages(userId: string | number, category?: string) {
  try {
    console.log(`[Storage] 이미지 조회 시작 - 사용자: ${userId}, 카테고리: ${category}`);
    
    const where = buildUserImageFilter({ userId, category });

    const dbImages = await db
      .select({
        id: images.id,
        title: images.title,
        transformedUrl: images.transformedUrl,
        thumbnailUrl: images.thumbnailUrl,
        originalUrl: images.originalUrl,
        categoryId: images.categoryId,
        conceptId: images.conceptId,
        createdAt: images.createdAt,
        userId: images.userId
      })
      .from(images)
      .where(where)
      .orderBy(desc(images.createdAt))
      .limit(100); // 한 번에 최대 100개만 로드

    console.log(`[Storage] ${dbImages.length}개 이미지 조회 완료`);

    // 갤러리에서 기대하는 형식으로 변환 (썸네일 우선 사용)
    return dbImages.map(img => ({
      id: img.id,
      title: img.title,
      url: img.transformedUrl, // 원본 이미지 URL
      thumbnailUrl: img.thumbnailUrl || img.transformedUrl, // 썸네일 URL 또는 원본 URL
      transformedUrl: img.transformedUrl, // 원본 URL 유지
      originalUrl: img.originalUrl,
      categoryId: img.categoryId,
      conceptId: img.conceptId,
      createdAt: img.createdAt.toISOString(),
      userId: img.userId
    }));
  } catch (error) {
    console.error('[Storage] 이미지 조회 중 오류:', error);
    return [];
  }
}

// 기존 storage 클래스는 유지하되 사용자별 이미지 조회만 단순화
export class DatabaseStorage {
  // 사용자별 이미지 조회 메서드 추가
  async getUserImagesByCategory(userId: number, categoryId: string) {
    const where = buildUserImageFilter({ userId, category: categoryId });
    
    return await db
      .select()
      .from(images)
      .where(where)
      .orderBy(desc(images.createdAt));
  }

  // 이미지 변환 메서드 복구
  async transformImage(filePath: string, style: string, customPromptTemplate?: string | null, systemPrompt?: string | null, aspectRatio?: string | null) {
    try {
      console.log(`[Storage] Starting image transformation with style: "${style}"`);
      
      // 이미지 파일 읽기
      const fs = await import('fs');
      const imageBuffer = fs.readFileSync(filePath);
      
      // OpenAI 서비스 사용
      const { transformImage } = await import('./services/openai-dalle3'); 
      const transformedImageUrl = await transformImage(
        imageBuffer, 
        style, 
        customPromptTemplate,
        systemPrompt 
      );
      
      console.log(`[Storage] 이미지 변환 완료`);
      return transformedImageUrl;
    } catch (error) {
      console.error(`[Storage] Error in transformImage:`, error);
      return "https://placehold.co/1024x1024/A7C1E2/FFF?text=이미지+변환+서비스가+응답하지+않습니다.+다시+시도해+주세요";
    }
  }

  // 이미지 저장 메서드 복구
  async saveImageTransformation(
    originalFilename: string,
    style: string,
    originalPath: string,
    transformedUrl: string,
    userId?: number | null,
    username?: string | null,
    categoryId?: string | null,
    variantId?: string | null
  ) {
    const path = await import('path');
    const nameWithoutExt = path.basename(originalFilename, path.extname(originalFilename));
    
    // 카테고리별 컨셉명 매핑
    const conceptTitleMapping: Record<string, string> = {
      'sticker_img': 'sticker',
      'mansak_img': 'maternity', 
      'family_img': 'family',
      'taemdong_img': 'dreambook'
    };
    
    // 새로운 제목 형식: "컨셉명_컨셉ID_유저이름"
    const conceptTitle = conceptTitleMapping[categoryId || 'sticker_img'] || 'sticker';
    let title;
    if (username) {
      title = `${conceptTitle}_${style}_${username}`;
    } else {
      title = `${conceptTitle}_${style}_게스트`;
    }
    
    const metadata: Record<string, any> = {};
    if (variantId) metadata.variantId = variantId;
    if (username) metadata.username = username;
    
    try {
      console.log(`[Storage] 새 이미지 저장 시작: "${title}"`);
      
      // 1단계: 썸네일 생성
      let thumbnailUrl = '';
      try {
        const filename = transformedUrl.split('/').pop() || `${title}.jpg`;
        thumbnailUrl = await generateThumbnail(transformedUrl, filename);
        console.log(`[Storage] 썸네일 생성 완료: ${thumbnailUrl}`);
      } catch (thumbnailError) {
        console.error('[Storage] 썸네일 생성 실패:', thumbnailError);
        // 썸네일 생성 실패 시 원본 URL 사용
        thumbnailUrl = transformedUrl;
      }
      
      // 2단계: DB에 이미지와 썸네일 URL 저장
      const [savedImage] = await db
        .insert(images)
        .values({
          title,
          style,
          originalUrl: originalPath,
          transformedUrl,
          thumbnailUrl, // 썸네일 URL 추가
          metadata: JSON.stringify(metadata),
          userId: userId ? String(userId) : null,
          categoryId: categoryId || null,
        })
        .returning();
      
      console.log(`[Storage] 이미지 저장 완료: ID ${savedImage.id}, 썸네일: ${thumbnailUrl}`);
      return savedImage;
    } catch (error) {
      console.error(`[Storage] 이미지 저장 중 오류 발생:`, error);
      throw error;
    }
  }

  // 임시 이미지 저장 메서드 추가
  async saveTemporaryImage(
    title: string,
    transformedUrl: string,
    metadata: any = {}
  ) {
    try {
      console.log(`[Storage] 임시 이미지 저장: "${title}"`);
      
      const [savedImage] = await db
        .insert(images)
        .values({
          title,
          style: 'temporary',
          originalUrl: '/temp/placeholder',
          transformedUrl,
          metadata: JSON.stringify(metadata),
          userId: null,
          categoryId: 'temp',
        })
        .returning();
      
      console.log(`[Storage] 임시 이미지 저장 완료: ID ${savedImage.id}`);
      return savedImage;
    } catch (error) {
      console.error(`[Storage] 임시 이미지 저장 중 오류:`, error);
      throw error;
    }
  }

  // 미디어 아이템 조회 메소드 추가
  async getMediaItem(id: number, type: "music" | "image") {
    if (type === "music") {
      const { music } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      return db.query.music.findFirst({
        where: eq(music.id, id),
      });
    } else {
      const { eq } = await import('drizzle-orm');
      return db.query.images.findFirst({
        where: eq(images.id, id),
      });
    }
  }

  // 이미지 ID로 조회 메소드 추가
  async getImageById(id: number) {
    const { eq } = await import('drizzle-orm');
    return db.query.images.findFirst({
      where: eq(images.id, id),
    });
  }

  // 이미지 삭제 메소드 추가
  async deleteImage(id: number) {
    const { eq } = await import('drizzle-orm');
    const result = await db.delete(images).where(eq(images.id, id));
    console.log(`🗑️ DB 이미지 삭제 실행: ID ${id}, 결과:`, result);
    return result;
  }
}

export const storage = new DatabaseStorage();