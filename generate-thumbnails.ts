/**
 * 기존 이미지들의 썸네일 일괄 생성 스크립트
 * 
 * 이 스크립트는 DB에 저장된 모든 이미지의 썸네일을 생성하고
 * thumbnailUrl 필드를 업데이트합니다.
 */

import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { generateThumbnail, ensureThumbnailDirectory } from './server/utils/thumbnail.js';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

async function generateAllThumbnails() {
  console.log('🖼️  기존 이미지 썸네일 일괄 생성 시작...');
  
  // 썸네일 디렉토리 생성
  ensureThumbnailDirectory();
  
  try {
    // 썸네일이 없는 이미지들 조회
    const allImages = await db
      .select({
        id: images.id,
        transformedUrl: images.transformedUrl,
        thumbnailUrl: images.thumbnailUrl
      })
      .from(images)
      .where(eq(images.thumbnailUrl, null));
    
    console.log(`📊 썸네일이 없는 이미지: ${allImages.length}개`);
    
    if (allImages.length === 0) {
      console.log('✅ 모든 이미지에 썸네일이 이미 존재합니다.');
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const image of allImages) {
      try {
        if (!image.transformedUrl) {
          console.log(`⚠️  이미지 ${image.id}: transformedUrl이 없음`);
          failCount++;
          continue;
        }
        
        // 파일명 추출
        const filename = path.basename(image.transformedUrl);
        const originalPath = image.transformedUrl;
        
        // 원본 파일이 존재하는지 확인
        const fullPath = originalPath.startsWith('/') 
          ? path.join(process.cwd(), originalPath.slice(1))
          : path.join(process.cwd(), originalPath);
        
        if (!fs.existsSync(fullPath)) {
          console.log(`⚠️  이미지 ${image.id}: 원본 파일 없음 (${fullPath})`);
          failCount++;
          continue;
        }
        
        // 썸네일 생성
        const thumbnailUrl = await generateThumbnail(originalPath, filename);
        
        // DB 업데이트
        await db
          .update(images)
          .set({ thumbnailUrl })
          .where(eq(images.id, image.id));
        
        console.log(`✅ 이미지 ${image.id}: 썸네일 생성 완료 (${thumbnailUrl})`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ 이미지 ${image.id} 썸네일 생성 실패:`, error);
        failCount++;
      }
    }
    
    console.log('\n🎉 썸네일 생성 완료!');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    console.log(`📊 전체: ${allImages.length}개`);
    
  } catch (error) {
    console.error('❌ 썸네일 생성 중 오류:', error);
  }
}

// 스크립트 실행
generateAllThumbnails()
  .then(() => {
    console.log('🎯 썸네일 생성 스크립트 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 스크립트 실행 실패:', error);
    process.exit(1);
  });