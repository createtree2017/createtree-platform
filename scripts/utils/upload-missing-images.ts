/**
 * 갤러리 이미지를 GCS에 업로드하는 스크립트
 * DB에 기록된 이미지를 실제 GCS 버킷에 업로드
 */

import { db } from "../../db/index.js";
import { images } from "../../shared/schema.js";
import { bucket } from "../../server/firebase.js";
import sharp from "sharp";
import fs from "fs";
import path from "path";

async function uploadMissingImages() {
  try {
    console.log('🔍 DB에서 이미지 목록 가져오는 중...');
    
    // 최근 10개 이미지 가져오기
    const imageList = await db.select().from(images)
      .orderBy(images.createdAt)
      .limit(10);
    
    console.log(`📦 총 ${imageList.length}개 이미지 발견`);
    
    for (const image of imageList) {
      console.log(`\n처리 중: ${image.title} (ID: ${image.id})`);
      
      // 원본 이미지 경로
      const originalLocalPath = image.originalUrl;
      const transformedLocalPath = image.transformedUrl;
      
      console.log(`원본 경로: ${originalLocalPath}`);
      console.log(`변환 경로: ${transformedLocalPath}`);
      
      // 로컬 파일 존재 확인
      const originalExists = fs.existsSync(originalLocalPath);
      const transformedExists = fs.existsSync(transformedLocalPath);
      
      console.log(`원본 파일 존재: ${originalExists ? '✅' : '❌'}`);
      console.log(`변환 파일 존재: ${transformedExists ? '✅' : '❌'}`);
      
      // 업로드할 파일 선택 (변환된 파일을 우선으로, 없으면 원본)
      const sourceFile = transformedExists ? transformedLocalPath : 
                        originalExists ? originalLocalPath : null;
      
      if (!sourceFile) {
        console.log('❌ 업로드할 파일이 없습니다.');
        continue;
      }
      
      console.log(`📤 선택된 파일: ${sourceFile}`);
      
      // 파일 버퍼 읽기
      const imageBuffer = fs.readFileSync(sourceFile);
      
      // GCS 경로 생성
      const fileName = path.basename(sourceFile);
      const fileNameWithoutExt = path.parse(fileName).name;
      const userId = image.userId || '24'; // 기본값으로 24 사용
      
      const gcsOriginalPath = `images/general/${userId}/${fileNameWithoutExt}.webp`;
      const gcsThumbnailPath = `images/general/${userId}/thumbnails/${fileNameWithoutExt}_thumb.webp`;
      
      console.log(`GCS 원본 경로: ${gcsOriginalPath}`);
      console.log(`GCS 썸네일 경로: ${gcsThumbnailPath}`);
      
      // 원본 이미지 최적화 및 업로드
      const optimizedOriginal = await sharp(imageBuffer)
        .webp({ quality: 90 })
        .resize(2048, 2048, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .toBuffer();
      
      const originalFile = bucket.file(gcsOriginalPath);
      await originalFile.save(optimizedOriginal, {
        metadata: {
          contentType: 'image/webp'
        }
      });
      
      console.log('✅ 원본 이미지 업로드 완료');
      
      // 썸네일 생성 및 업로드
      const thumbnailBuffer = await sharp(imageBuffer)
        .webp({ quality: 80 })
        .resize(300, 300, { 
          fit: 'cover' 
        })
        .toBuffer();
      
      const thumbnailFile = bucket.file(gcsThumbnailPath);
      await thumbnailFile.save(thumbnailBuffer, {
        metadata: {
          contentType: 'image/webp'
        }
      });
      
      console.log('✅ 썸네일 업로드 완료');
      
      // DB 업데이트 (경로 정보 수정)
      await db.update(images)
        .set({
          originalUrl: gcsOriginalPath,
          transformedUrl: gcsOriginalPath,
          thumbnailUrl: gcsThumbnailPath
        })
        .where(images.id === image.id);
      
      console.log('✅ DB 경로 정보 업데이트 완료');
      
      // 잠시 대기 (API 제한 방지)
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n🎉 모든 이미지 업로드 완료!');
    
  } catch (error) {
    console.error('❌ 이미지 업로드 실패:', error);
  }
}

// 스크립트 실행
uploadMissingImages().then(() => {
  console.log('✅ 스크립트 완료');
  process.exit(0);
}).catch(error => {
  console.error('❌ 스크립트 오류:', error);
  process.exit(1);
});