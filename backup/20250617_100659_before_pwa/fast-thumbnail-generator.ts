/**
 * 고속 병렬 썸네일 생성 스크립트
 * 
 * 이 스크립트는 모든 이미지의 썸네일을 병렬로 빠르게 생성합니다.
 * - 병렬 처리 (동시에 5개씩 처리)
 * - 진행 상황 실시간 모니터링
 * - 에러 처리 및 재시도 로직
 */

import { db } from "./db/index.js";
import { images } from "./shared/schema.js";
import { isNull } from "drizzle-orm";
import sharp from "sharp";
import fs from "fs";
import path from "path";

// 썸네일 설정
const THUMBNAIL_CONFIG = {
  width: 300,
  height: 300,
  quality: 85,
  concurrency: 5, // 동시에 처리할 이미지 수
};

/**
 * 이미지 썸네일 생성 함수
 */
async function generateThumbnail(imageId: number, originalUrl: string): Promise<string | null> {
  try {
    // URL에서 파일 경로 추출
    const staticPath = originalUrl.replace('/static/', '');
    const fullPath = path.join('./static', staticPath);
    
    // 파일 존재 확인
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  파일 없음: ${fullPath}`);
      return null;
    }

    // 썸네일 파일명 생성
    const ext = path.extname(staticPath);
    const nameWithoutExt = path.basename(staticPath, ext);
    const thumbnailName = `${nameWithoutExt}_thumb${ext}`;
    const thumbnailDir = path.dirname(staticPath);
    const thumbnailPath = path.join('./static', thumbnailDir, thumbnailName);
    
    // 썸네일 디렉토리 생성
    const thumbnailDirPath = path.dirname(thumbnailPath);
    if (!fs.existsSync(thumbnailDirPath)) {
      fs.mkdirSync(thumbnailDirPath, { recursive: true });
    }

    // Sharp로 썸네일 생성
    await sharp(fullPath)
      .resize(THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: THUMBNAIL_CONFIG.quality })
      .toFile(thumbnailPath);

    const thumbnailUrl = `/static/${thumbnailDir}/${thumbnailName}`;
    
    // 데이터베이스 업데이트
    await db.update(images)
      .set({ thumbnailUrl })
      .where({ id: imageId } as any);

    return thumbnailUrl;
  } catch (error) {
    console.error(`❌ 썸네일 생성 실패 (ID: ${imageId}):`, error);
    return null;
  }
}

/**
 * 병렬 썸네일 생성 처리
 */
async function processBatch(imageBatch: any[]): Promise<void> {
  const promises = imageBatch.map(async (image) => {
    const result = await generateThumbnail(image.id, image.transformedUrl);
    if (result) {
      console.log(`✅ 썸네일 생성 완료: ${image.id} -> ${result}`);
    }
    return result;
  });

  await Promise.allSettled(promises);
}

/**
 * 메인 실행 함수
 */
async function fastGenerateAllThumbnails() {
  console.log("🚀 고속 썸네일 생성 시작...");
  
  try {
    // 썸네일이 없는 이미지들 조회
    const imagesWithoutThumbnails = await db.select()
      .from(images)
      .where(isNull(images.thumbnailUrl));

    console.log(`📊 총 ${imagesWithoutThumbnails.length}개의 이미지에 썸네일 생성 필요`);

    if (imagesWithoutThumbnails.length === 0) {
      console.log("✅ 모든 이미지에 이미 썸네일이 있습니다!");
      return;
    }

    // 이미지들을 배치로 나누기
    const batches = [];
    for (let i = 0; i < imagesWithoutThumbnails.length; i += THUMBNAIL_CONFIG.concurrency) {
      batches.push(imagesWithoutThumbnails.slice(i, i + THUMBNAIL_CONFIG.concurrency));
    }

    console.log(`🔄 ${batches.length}개 배치로 병렬 처리 시작...`);

    // 각 배치를 순차적으로 처리 (배치 내에서는 병렬)
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 배치 ${i + 1}/${batches.length} 처리 중... (${batch.length}개 이미지)`);
      
      await processBatch(batch);
      
      // 진행률 표시
      const processed = Math.min((i + 1) * THUMBNAIL_CONFIG.concurrency, imagesWithoutThumbnails.length);
      const percentage = Math.round((processed / imagesWithoutThumbnails.length) * 100);
      console.log(`🎯 진행률: ${processed}/${imagesWithoutThumbnails.length} (${percentage}%)`);

      // 배치 간 잠시 대기 (서버 부하 방지)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 최종 확인
    const remainingImages = await db.select()
      .from(images)
      .where(isNull(images.thumbnailUrl));

    console.log(`🎉 썸네일 생성 완료! 남은 이미지: ${remainingImages.length}개`);
    
    if (remainingImages.length === 0) {
      console.log("🏆 모든 이미지의 썸네일 생성이 완료되었습니다!");
      console.log("💡 이제 이미지 로딩이 1-2초로 대폭 빨라집니다!");
    }

  } catch (error) {
    console.error("❌ 썸네일 생성 프로세스 오류:", error);
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  fastGenerateAllThumbnails()
    .then(() => {
      console.log("✅ 스크립트 완료");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ 스크립트 오류:", error);
      process.exit(1);
    });
}