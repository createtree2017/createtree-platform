/**
 * 스티커 이미지 썸네일 생성 스크립트
 * 스티커 카테고리의 이미지들만 대상으로 썸네일 생성
 */

import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { bucket } from './server/firebase.js';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

/**
 * 스티커 이미지 썸네일 생성
 */
async function generateStickerThumbnails() {
  try {
    console.log('🎯 스티커 이미지 썸네일 생성 시작...');
    
    // 스티커 카테고리 이미지만 조회
    const stickerImages = await db.query.images.findMany({
      where: eq(images.categoryId, 'sticker_img'),
      orderBy: (images, { desc }) => desc(images.createdAt)
    });
    
    console.log(`📊 총 ${stickerImages.length}개의 스티커 이미지 발견`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const image of stickerImages) {
      try {
        console.log(`\n🔄 이미지 ${image.id} 처리 중... (${processedCount + 1}/${stickerImages.length})`);
        
        // 이미 썸네일이 있는지 확인
        if (image.thumbnailUrl && image.thumbnailUrl.trim()) {
          console.log(`✅ 이미지 ${image.id}: 썸네일이 이미 존재함`);
          processedCount++;
          continue;
        }
        
        const originalUrl = image.transformedUrl || image.originalUrl;
        if (!originalUrl) {
          console.log(`❌ 이미지 ${image.id}: 원본 URL이 없음`);
          errorCount++;
          continue;
        }
        
        // 이미지 다운로드
        console.log(`📥 원본 이미지 다운로드: ${originalUrl}`);
        let imageBuffer: Buffer;
        
        if (originalUrl.startsWith('http')) {
          // GCS URL에서 다운로드
          const response = await fetch(originalUrl);
          if (!response.ok) {
            throw new Error(`이미지 다운로드 실패: ${response.status}`);
          }
          imageBuffer = Buffer.from(await response.arrayBuffer());
        } else {
          // 로컬 파일에서 읽기
          const localPath = path.join(process.cwd(), 'static', originalUrl.replace('/static/', ''));
          if (!fs.existsSync(localPath)) {
            throw new Error(`로컬 파일이 존재하지 않음: ${localPath}`);
          }
          imageBuffer = fs.readFileSync(localPath);
        }
        
        // 썸네일 생성 (300x300)
        console.log(`🖼️ 썸네일 생성 중...`);
        const thumbnailBuffer = await sharp(imageBuffer)
          .webp({ quality: 80 })
          .resize(300, 300, { 
            fit: 'cover',
            position: 'center'
          })
          .toBuffer();
        
        // GCS에 썸네일 업로드
        const timestamp = Date.now();
        const fileName = `sticker_thumb_${image.id}_${timestamp}.webp`;
        const thumbnailPath = `images/sticker_img/${image.userId}/thumbnails/${fileName}`;
        
        console.log(`☁️ GCS에 썸네일 업로드: ${thumbnailPath}`);
        const thumbnailFile = bucket.file(thumbnailPath);
        await thumbnailFile.save(thumbnailBuffer, {
          metadata: {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000',
            metadata: {
              category: 'sticker_img',
              userId: image.userId,
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
        console.log(`💾 DB 업데이트: 썸네일 URL 저장`);
        await db.update(images)
          .set({ 
            thumbnailUrl: thumbnailUrl,
            updatedAt: new Date()
          })
          .where(eq(images.id, image.id));
        
        console.log(`✅ 이미지 ${image.id}: 썸네일 생성 완료`);
        processedCount++;
        
        // 딜레이 추가 (API 제한 방지)
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ 이미지 ${image.id} 처리 실패:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n🎉 스티커 썸네일 생성 완료!');
    console.log(`📈 통계:`);
    console.log(`  - 총 이미지: ${stickerImages.length}개`);
    console.log(`  - 성공: ${processedCount}개`);
    console.log(`  - 실패: ${errorCount}개`);
    
  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  }
}

// 스크립트 실행
generateStickerThumbnails()
  .then(() => {
    console.log('✅ 작업 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 실행 오류:', error);
    process.exit(1);
  });