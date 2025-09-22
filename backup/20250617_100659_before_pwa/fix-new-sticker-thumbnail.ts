/**
 * 새로 생성된 스티커 이미지 썸네일 즉시 생성
 */
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// GCS 설정
const storage = new Storage({
  projectId: 'createtree',
  keyFilename: './config/gcs-key.json'
});
const bucket = storage.bucket('createtree-upload');

async function generateThumbnailForLatestSticker() {
  try {
    // 방금 생성된 스티커 이미지 조회 (ID 533)
    const imageRecord = await db.query.images.findFirst({
      where: eq(images.id, 533)
    });

    if (!imageRecord) {
      console.log('❌ 이미지를 찾을 수 없습니다');
      return;
    }

    console.log('🎯 대상 이미지:', {
      id: imageRecord.id,
      title: imageRecord.title,
      originalUrl: imageRecord.originalUrl
    });

    // GCS에서 원본 이미지 다운로드
    const originalPath = imageRecord.originalUrl.replace('/', '');
    const originalFile = bucket.file(originalPath);
    
    console.log('📥 원본 이미지 다운로드 중...', originalPath);
    const [originalBuffer] = await originalFile.download();

    // 썸네일 생성
    console.log('🖼️ 썸네일 생성 중...');
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize(300, 300, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .webp({ quality: 80 })
      .toBuffer();

    // 썸네일 파일명 생성
    const thumbnailPath = originalPath.replace('/full/', '/thumbnails/').replace('.webp', '_thumb.webp');
    
    console.log('📤 썸네일 업로드 중...', thumbnailPath);
    const thumbnailFile = bucket.file(thumbnailPath);
    await thumbnailFile.save(thumbnailBuffer, {
      metadata: {
        contentType: 'image/webp'
      },
      public: true
    });

    // DB에 썸네일 URL 업데이트
    const thumbnailUrl = `/${thumbnailPath}`;
    await db.update(images)
      .set({ thumbnailUrl })
      .where(eq(images.id, imageRecord.id));

    console.log('✅ 썸네일 생성 완료!');
    console.log('원본:', imageRecord.originalUrl);
    console.log('썸네일:', thumbnailUrl);

  } catch (error) {
    console.error('❌ 썸네일 생성 실패:', error);
  }
}

generateThumbnailForLatestSticker();