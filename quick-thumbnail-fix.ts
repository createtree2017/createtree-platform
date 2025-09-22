/**
 * 즉시 썸네일 생성 스크립트 - 빠른 수정용
 */
import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { eq, isNull } from 'drizzle-orm';
import sharp from 'sharp';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// 썸네일 디렉토리 확인/생성
const thumbnailDir = './static/thumbnails';
if (!fs.existsSync(thumbnailDir)) {
  fs.mkdirSync(thumbnailDir, { recursive: true });
}

/**
 * 간단한 썸네일 생성 함수
 */
async function generateQuickThumbnail(imageId: number, originalUrl: string): Promise<string | null> {
  try {
    console.log(`🔄 썸네일 생성 중: ID ${imageId}`);
    
    // 로컬 파일인지 확인
    if (originalUrl.startsWith('/static/')) {
      const localPath = `.${originalUrl}`;
      if (fs.existsSync(localPath)) {
        const thumbnailFilename = `thumb_${imageId}.webp`;
        const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
        
        await sharp(localPath)
          .resize(300, 300, { fit: 'cover' })
          .webp({ quality: 80 })
          .toFile(thumbnailPath);
        
        const thumbnailUrl = `/static/thumbnails/${thumbnailFilename}`;
        
        // DB 업데이트
        await db.update(images)
          .set({ thumbnailUrl })
          .where(eq(images.id, imageId));
        
        console.log(`✅ 썸네일 생성 완료: ${thumbnailUrl}`);
        return thumbnailUrl;
      }
    }
    
    console.log(`⚠️ 로컬 파일 없음: ${originalUrl}`);
    return null;
  } catch (error) {
    console.error(`❌ 썸네일 생성 실패 (ID ${imageId}):`, error);
    return null;
  }
}

/**
 * 메인 실행 함수
 */
async function quickThumbnailFix() {
  try {
    console.log('🚀 빠른 썸네일 생성 시작...');
    
    // 썸네일이 없는 이미지들만 조회 (최대 20개씩)
    const imagesToProcess = await db.select()
      .from(images)
      .where(isNull(images.thumbnailUrl))
      .limit(20);
    
    console.log(`📊 처리할 이미지: ${imagesToProcess.length}개`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const image of imagesToProcess) {
      const result = await generateQuickThumbnail(image.id, image.transformedUrl || image.originalUrl);
      if (result) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // 진행 상황 출력
      console.log(`📈 진행률: ${successCount + errorCount}/${imagesToProcess.length} (성공: ${successCount}, 실패: ${errorCount})`);
    }
    
    console.log('🎉 빠른 썸네일 생성 완료!');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    
    // 최종 상태 확인
    const finalStats = await db.select({
      total: db.count(),
      withThumbnails: db.count().where(isNull(images.thumbnailUrl)).as('without')
    }).from(images);
    
    console.log('📊 최종 통계:', finalStats);
    
  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error);
  } finally {
    process.exit(0);
  }
}

// 실행
quickThumbnailFix();