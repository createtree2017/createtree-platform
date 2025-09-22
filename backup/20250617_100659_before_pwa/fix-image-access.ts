/**
 * 기존 GCS 이미지들의 공개 접근 권한 설정
 * 이미지가 표시되지 않는 문제 해결
 */

import { bucket } from './server/firebase.js';
import { db } from './db/index.js';
import { images } from './shared/schema.js';

async function fixImageAccess() {
  try {
    console.log('🔧 GCS 이미지 공개 접근 권한 설정 시작...');
    
    // DB에서 모든 이미지 조회
    const allImages = await db.query.images.findMany({
      limit: 100,
      orderBy: (images, { desc }) => [desc(images.createdAt)]
    });
    
    console.log(`📋 처리할 이미지 수: ${allImages.length}`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const image of allImages) {
      try {
        // GCS URL에서 파일 경로 추출 및 공개 설정
        if (image.originalUrl && image.originalUrl.includes('storage.googleapis.com')) {
          // URL 디코딩 및 쿼리 파라미터 제거
          const cleanUrl = image.originalUrl.split('?')[0];
          const urlParts = cleanUrl.split('/');
          const bucketIndex = urlParts.findIndex(part => part === 'createtree-upload');
          
          if (bucketIndex > -1) {
            const filePath = decodeURIComponent(urlParts.slice(bucketIndex + 1).join('/'));
            console.log(`🔍 원본 처리 중: ${filePath}`);
            
            const file = bucket.file(filePath);
            
            try {
              const [exists] = await file.exists();
              if (exists) {
                await file.makePublic();
                console.log(`✅ 원본 공개 설정 완료: ${filePath}`);
                successCount++;
              } else {
                console.log(`⚠️ 원본 파일 없음: ${filePath}`);
              }
            } catch (fileError) {
              console.log(`❌ 원본 파일 접근 오류: ${filePath} - ${fileError.message}`);
              errorCount++;
            }
          }
        }
        
        // 썸네일도 처리
        if (image.thumbnailUrl && image.thumbnailUrl.includes('storage.googleapis.com')) {
          const cleanUrl = image.thumbnailUrl.split('?')[0];
          const urlParts = cleanUrl.split('/');
          const bucketIndex = urlParts.findIndex(part => part === 'createtree-upload');
          
          if (bucketIndex > -1) {
            const filePath = decodeURIComponent(urlParts.slice(bucketIndex + 1).join('/'));
            console.log(`🔍 썸네일 처리 중: ${filePath}`);
            
            const file = bucket.file(filePath);
            
            try {
              const [exists] = await file.exists();
              if (exists) {
                await file.makePublic();
                console.log(`✅ 썸네일 공개 설정 완료: ${filePath}`);
              } else {
                console.log(`⚠️ 썸네일 파일 없음: ${filePath}`);
              }
            } catch (fileError) {
              console.log(`❌ 썸네일 파일 접근 오류: ${filePath} - ${fileError.message}`);
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ 이미지 처리 실패 (ID: ${image.id}):`, error.message);
        errorCount++;
      }
    }
    
    console.log(`🎉 작업 완료!`);
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    
  } catch (error) {
    console.error('❌ 전체 작업 실패:', error);
  }
  
  process.exit(0);
}

// 실행
fixImageAccess().catch(console.error);