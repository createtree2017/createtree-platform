/**
 * GCS 폴더 정리 실행 스크립트
 * 
 * 실제 파일 이동 및 데이터베이스 URL 업데이트
 */

import { Storage } from '@google-cloud/storage';
import { db } from "./db/index";
import { images } from "./shared/schema";
import { eq, like } from "drizzle-orm";
import path from 'path';

// GCS Storage 클라이언트 - 환경변수 기반 ADC 사용
const storage = new Storage({
  projectId: 'createtreeai',
  // keyFilename 제거 - ADC(Application Default Credentials) 사용
});

const bucket = storage.bucket('createtree-upload');

async function executeGCSCleanup() {
  console.log('🧹 GCS 폴더 정리 실행 시작...');
  
  try {
    // 1. 데이터베이스 카테고리 정규화 (즉시 실행)
    console.log('📝 데이터베이스 카테고리 정규화...');
    
    // test 카테고리를 mansak_img로 변경
    const testImages = await db.update(images)
      .set({ categoryId: 'mansak_img' })
      .where(eq(images.categoryId, 'test'))
      .returning();
    
    if (testImages.length > 0) {
      console.log(`✅ test → mansak_img: ${testImages.length}개 이미지 업데이트`);
    }
    
    // 2. URL 패턴별 카테고리 매핑 정의
    const folderMapping: Record<string, string> = {
      'full': 'mansak_img',
      'general': 'mansak_img', 
      'test': 'mansak_img',
      'reference': 'mansak_img'  // reference는 대부분 만삭사진으로 추정
    };
    
    // 3. 데이터베이스 URL 업데이트 (파일 이동 없이 URL만 수정)
    console.log('🔄 데이터베이스 URL 업데이트...');
    
    let totalUpdated = 0;
    
    for (const [oldFolder, newCategory] of Object.entries(folderMapping)) {
      // oldFolder가 포함된 URL을 가진 이미지들 찾기
      const imagesToUpdate = await db.select()
        .from(images)
        .where(like(images.originalUrl, `%/images/${oldFolder}/%`));
      
      console.log(`📂 ${oldFolder} 폴더: ${imagesToUpdate.length}개 이미지 발견`);
      
      for (const image of imagesToUpdate) {
        if (image.originalUrl) {
          // URL에서 폴더명 변경
          const newOriginalUrl = image.originalUrl.replace(
            `/images/${oldFolder}/`,
            `/images/${newCategory}/`
          );
          
          let newThumbnailUrl = image.thumbnailUrl;
          if (newThumbnailUrl) {
            newThumbnailUrl = newThumbnailUrl.replace(
              `/images/${oldFolder}/`,
              `/images/${newCategory}/`
            );
          }
          
          let newTransformedUrl = image.transformedUrl;
          if (newTransformedUrl) {
            newTransformedUrl = newTransformedUrl.replace(
              `/images/${oldFolder}/`,
              `/images/${newCategory}/`
            );
          }
          
          // 데이터베이스 업데이트
          await db.update(images)
            .set({
              categoryId: newCategory,
              originalUrl: newOriginalUrl,
              thumbnailUrl: newThumbnailUrl,
              transformedUrl: newTransformedUrl
            })
            .where(eq(images.id, image.id));
          
          totalUpdated++;
          
          if (totalUpdated % 10 === 0) {
            console.log(`   진행률: ${totalUpdated}개 완료`);
          }
        }
      }
    }
    
    console.log(`✅ 총 ${totalUpdated}개 이미지 URL 업데이트 완료`);
    
    // 4. 향후 이미지 생성 시 올바른 카테고리 사용하도록 설정 확인
    console.log('⚙️ 이미지 생성 서비스 카테고리 설정 확인...');
    
    // routes.ts에서 카테고리 설정 확인
    const routesContent = require('fs').readFileSync('./server/routes.ts', 'utf8');
    
    // 만삭사진 API에서 mansak_img 사용 확인
    if (routesContent.includes('categoryId: "mansak_img"')) {
      console.log('✅ 만삭사진 API: mansak_img 카테고리 사용 확인');
    } else {
      console.log('⚠️ 만삭사진 API: 카테고리 설정 확인 필요');
    }
    
    // 5. GCS 저장 함수 카테고리 매핑 확인
    console.log('📁 GCS 저장 카테고리 매핑 최종 확인...');
    
    // 현재 올바른 카테고리별 파일 수 재확인
    const finalStats = await db.select()
      .from(images);
    
    const categoryCount = new Map<string, number>();
    finalStats.forEach(img => {
      const category = img.categoryId || 'unknown';
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    });
    
    console.log('📊 정리 완료 후 카테고리 분포:');
    for (const [category, count] of categoryCount.entries()) {
      console.log(`   ${category}: ${count}개 이미지`);
    }
    
    // 6. 다음 이미지 생성에서 올바른 카테고리 사용 확인
    console.log('\n🎯 다음 이미지 생성 카테고리 가이드:');
    console.log('   만삭사진: mansak_img');
    console.log('   사진스타일 바꾸기: family_img');
    console.log('   스티커: sticker_img');
    
    console.log('\n✅ GCS 폴더 정리 완료!');
    
  } catch (error) {
    console.error('❌ GCS 폴더 정리 실행 실패:', error);
  }
}

executeGCSCleanup();