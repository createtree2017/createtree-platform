/**
 * 프로덕션 서버에서 이미지 동기화 스크립트
 * https://createtree-ai.kirk.replit.dev 서버에서 이미지를 다운로드하여 개발 서버에 복사
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { eq } from 'drizzle-orm';

const PRODUCTION_BASE_URL = 'https://createtree-ai.kirk.replit.dev';

// 디렉토리 생성 함수
function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 디렉토리 생성: ${dirPath}`);
  }
}

// 프로덕션 서버에서 이미지 다운로드
async function downloadImageFromProduction(imagePath: string): Promise<boolean> {
  try {
    const productionUrl = `${PRODUCTION_BASE_URL}${imagePath}`;
    console.log(`⬇️ 다운로드 시도: ${productionUrl}`);
    
    const response = await fetch(productionUrl);
    
    if (!response.ok) {
      console.log(`❌ 다운로드 실패 (${response.status}): ${productionUrl}`);
      return false;
    }
    
    // 로컬 경로 생성
    const localPath = path.join(process.cwd(), imagePath.replace(/^\//, ''));
    const localDir = path.dirname(localPath);
    
    // 디렉토리 생성
    ensureDirectoryExists(localDir);
    
    // 파일 저장
    const buffer = await response.buffer();
    fs.writeFileSync(localPath, buffer);
    
    console.log(`✅ 저장 완료: ${localPath}`);
    return true;
  } catch (error) {
    console.error(`❌ 다운로드 오류 ${imagePath}:`, error.message);
    return false;
  }
}

// 메인 동기화 함수
async function syncProductionImages() {
  try {
    console.log('🔄 프로덕션 서버 이미지 동기화 시작...');
    console.log(`📡 프로덕션 서버: ${PRODUCTION_BASE_URL}`);
    
    // 사용자 24의 최근 이미지 조회
    const userImages = await db
      .select()
      .from(images)
      .where(eq(images.userId, '24'))
      .orderBy(images.createdAt)
      .limit(50);
    
    console.log(`📊 동기화 대상 이미지: ${userImages.length}개`);
    
    let downloadedCount = 0;
    let skippedCount = 0;
    
    for (const image of userImages) {
      console.log(`\n🖼️ 처리 중: ${image.title} (ID: ${image.id})`);
      
      // 썸네일 다운로드
      if (image.thumbnailUrl) {
        const localThumbnailPath = path.join(process.cwd(), image.thumbnailUrl.replace(/^\//, ''));
        
        if (!fs.existsSync(localThumbnailPath)) {
          const success = await downloadImageFromProduction(image.thumbnailUrl);
          if (success) {
            downloadedCount++;
          }
        } else {
          console.log(`⏭️ 썸네일 이미 존재: ${image.thumbnailUrl}`);
          skippedCount++;
        }
      }
      
      // 변환된 이미지 다운로드
      if (image.transformedUrl) {
        const localTransformedPath = path.join(process.cwd(), image.transformedUrl.replace(/^\//, ''));
        
        if (!fs.existsSync(localTransformedPath)) {
          const success = await downloadImageFromProduction(image.transformedUrl);
          if (success) {
            downloadedCount++;
          }
        } else {
          console.log(`⏭️ 변환 이미지 이미 존재: ${image.transformedUrl}`);
          skippedCount++;
        }
      }
      
      // 원본 이미지 다운로드
      if (image.originalUrl) {
        const localOriginalPath = path.join(process.cwd(), image.originalUrl.replace(/^\//, ''));
        
        if (!fs.existsSync(localOriginalPath)) {
          const success = await downloadImageFromProduction(image.originalUrl);
          if (success) {
            downloadedCount++;
          }
        } else {
          console.log(`⏭️ 원본 이미지 이미 존재: ${image.originalUrl}`);
          skippedCount++;
        }
      }
      
      // 요청 간격 (서버 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎉 프로덕션 이미지 동기화 완료!');
    console.log(`📈 다운로드: ${downloadedCount}개`);
    console.log(`⏭️ 건너뜀: ${skippedCount}개`);
    
  } catch (error) {
    console.error('❌ 동기화 중 오류 발생:', error);
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  syncProductionImages()
    .then(() => {
      console.log('✅ 동기화 스크립트 종료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 오류:', error);
      process.exit(1);
    });
}

export { syncProductionImages };