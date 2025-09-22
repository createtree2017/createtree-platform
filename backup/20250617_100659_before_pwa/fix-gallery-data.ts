/**
 * 갤러리 데이터 수정 스크립트
 * GCS의 실제 이미지 파일들을 DB에 올바르게 매핑
 */

import { Storage } from '@google-cloud/storage';
import { db } from './db';
import { images } from '@shared/schema';
import { eq } from 'drizzle-orm';

const storage = new Storage({
  projectId: 'createtreeai',
});
const bucket = storage.bucket('createtree-upload');

async function fixGalleryData() {
  try {
    console.log('🔍 GCS 파일 목록 조회 중...');
    
    // GCS에서 실제 파일 목록 확인
    const [files] = await bucket.getFiles({
      prefix: 'images/general/10/',
    });
    
    console.log(`📁 발견된 파일 수: ${files.length}`);
    
    // 이미지 파일만 필터링 (썸네일 제외)
    const imageFiles = files.filter(file => {
      const name = file.name;
      return name.endsWith('.webp') && 
             !name.includes('thumbnails/') && 
             !name.includes('_thumb');
    });
    
    console.log(`🖼️ 실제 이미지 파일 수: ${imageFiles.length}`);
    
    if (imageFiles.length === 0) {
      console.log('❌ GCS에 이미지 파일이 없습니다.');
      return;
    }
    
    // 현재 DB의 이미지 레코드 조회
    const dbImages = await db.select().from(images).where(eq(images.userId, '24'));
    console.log(`💾 DB 이미지 레코드 수: ${dbImages.length}`);
    
    // 각 DB 레코드에 서로 다른 실제 이미지 파일 할당
    for (let i = 0; i < Math.min(dbImages.length, imageFiles.length); i++) {
      const dbImage = dbImages[i];
      const gcsFile = imageFiles[i];
      
      const newOriginalUrl = gcsFile.name;
      const newThumbnailUrl = gcsFile.name.replace('.webp', '_thumb.webp');
      
      await db.update(images)
        .set({
          originalUrl: newOriginalUrl,
          thumbnailUrl: newThumbnailUrl,
          transformedUrl: newOriginalUrl
        })
        .where(eq(images.id, dbImage.id));
      
      console.log(`✅ 이미지 ${dbImage.id} 업데이트: ${dbImage.title} -> ${newOriginalUrl}`);
    }
    
    console.log('🎉 갤러리 데이터 수정 완료!');
    
  } catch (error) {
    console.error('❌ 갤러리 데이터 수정 오류:', error);
  }
}

// 실행
fixGalleryData().then(() => {
  console.log('스크립트 실행 완료');
  process.exit(0);
}).catch((error) => {
  console.error('스크립트 실행 오류:', error);
  process.exit(1);
});