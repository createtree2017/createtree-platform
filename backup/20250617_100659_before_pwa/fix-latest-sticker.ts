/**
 * 방금 생성된 스티커 이미지의 썸네일 생성
 */
import { bucket } from './server/firebase.js';
import sharp from 'sharp';
import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function fixLatestStickerThumbnail() {
  try {
    // 방금 생성된 스티커 이미지 조회 (ID 533)
    const imageRecord = await db.query.images.findFirst({
      where: eq(images.id, 533)
    });

    if (!imageRecord) {
      console.log('이미지를 찾을 수 없습니다');
      return;
    }

    console.log('대상 이미지:', {
      id: imageRecord.id,
      title: imageRecord.title,
      originalUrl: imageRecord.originalUrl
    });

    // 원본 파일 경로에서 GCS 경로 추출
    const originalPath = imageRecord.originalUrl.replace('/', '');
    console.log('원본 경로:', originalPath);

    // GCS에서 원본 이미지 다운로드
    const originalFile = bucket.file(originalPath);
    const [originalBuffer] = await originalFile.download();

    console.log('원본 이미지 다운로드 완료, 썸네일 생성 중...');

    // 썸네일 생성 (300x300)
    const thumbnailBuffer = await sharp(originalBuffer)
      .webp({ quality: 80 })
      .resize(300, 300, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .toBuffer();

    // 썸네일 파일 경로 생성
    const thumbnailPath = originalPath.replace('/full/', '/thumbnails/').replace('.webp', '_thumb.webp');
    console.log('썸네일 경로:', thumbnailPath);

    // GCS에 썸네일 업로드
    const thumbnailFile = bucket.file(thumbnailPath);
    await thumbnailFile.save(thumbnailBuffer, {
      metadata: {
        contentType: 'image/webp'
      },
      public: true
    });

    console.log('썸네일 업로드 완료');

    // DB에 썸네일 URL 업데이트
    const thumbnailUrl = `/${thumbnailPath}`;
    await db.update(images)
      .set({ thumbnailUrl })
      .where(eq(images.id, imageRecord.id));

    console.log('DB 업데이트 완료');
    console.log('썸네일 생성 성공!');
    console.log('원본:', imageRecord.originalUrl);
    console.log('썸네일:', thumbnailUrl);

  } catch (error) {
    console.error('썸네일 생성 실패:', error);
  }
}

fixLatestStickerThumbnail();