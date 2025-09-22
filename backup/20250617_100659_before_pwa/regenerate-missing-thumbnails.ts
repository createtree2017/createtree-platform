/**
 * 썸네일이 없는 스티커 이미지들의 썸네일 생성
 * GCS URL에서 이미지를 다운로드하여 새로운 썸네일 생성
 */

import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import sharp from 'sharp';
import { bucket } from './server/firebase.js';
import fetch from 'node-fetch';
import path from 'path';

async function regenerateMissingThumbnails() {
  try {
    console.log('썸네일이 없는 스티커 이미지 검색...');
    
    // 썸네일이 없는 스티커 이미지들 조회
    const missingThumbnailImages = await db.query.images.findMany({
      where: and(
        eq(images.categoryId, 'sticker_img'),
        isNull(images.thumbnailUrl)
      ),
      orderBy: (images, { desc }) => desc(images.createdAt)
    });
    
    console.log(`썸네일이 없는 이미지 ${missingThumbnailImages.length}개 발견`);
    
    for (const image of missingThumbnailImages) {
      try {
        console.log(`\n이미지 ${image.id} 처리 시작...`);
        
        if (!image.transformedUrl) {
          console.log(`이미지 ${image.id}: 원본 URL이 없어 건너뜀`);
          continue;
        }
        
        // GCS URL에서 이미지 다운로드
        console.log(`원본 이미지 다운로드: ${image.transformedUrl}`);
        const response = await fetch(image.transformedUrl);
        
        if (!response.ok) {
          console.log(`이미지 ${image.id}: 다운로드 실패 (${response.status})`);
          continue;
        }
        
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        
        // 썸네일 생성 (300x300, WebP)
        console.log(`썸네일 생성 중...`);
        const thumbnailBuffer = await sharp(imageBuffer)
          .webp({ quality: 80 })
          .resize(300, 300, { 
            fit: 'cover',
            position: 'center'
          })
          .toBuffer();
        
        // 새로운 썸네일 파일명 생성
        const timestamp = Date.now();
        const thumbnailFileName = `sticker_${image.id}_${timestamp}_thumb.webp`;
        
        // GCS에 썸네일 업로드 (올바른 경로 구조)
        const thumbnailPath = `images/sticker_img/${image.userId || 'unknown'}/thumbnails/${thumbnailFileName}`;
        
        console.log(`GCS에 썸네일 업로드: ${thumbnailPath}`);
        const thumbnailFile = bucket.file(thumbnailPath);
        
        await thumbnailFile.save(thumbnailBuffer, {
          metadata: {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000',
            metadata: {
              category: 'sticker_img',
              userId: image.userId || 'unknown',
              imageType: 'thumbnail',
              originalImageId: image.id.toString(),
              createdAt: new Date().toISOString(),
            },
          },
        });
        
        // 서명된 URL 생성
        const [thumbnailUrl] = await thumbnailFile.getSignedUrl({
          action: 'read',
          expires: '01-01-2030',
        });
        
        // DB 업데이트
        console.log(`DB 업데이트: 썸네일 URL 저장`);
        await db.update(images)
          .set({ 
            thumbnailUrl: thumbnailUrl,
            updatedAt: new Date()
          })
          .where(eq(images.id, image.id));
        
        console.log(`이미지 ${image.id}: 썸네일 생성 완료`);
        
        // API 제한 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`이미지 ${image.id} 처리 실패:`, error.message);
      }
    }
    
    console.log('\n썸네일 생성 작업 완료');
    
  } catch (error) {
    console.error('스크립트 실행 오류:', error);
    process.exit(1);
  }
}

regenerateMissingThumbnails()
  .then(() => {
    console.log('작업 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('실행 오류:', error);
    process.exit(1);
  });