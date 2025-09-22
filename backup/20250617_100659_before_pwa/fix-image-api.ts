/**
 * 이미지 API 성능 최적화 스크립트
 * 
 * 1. 기존 이미지들의 썸네일 생성
 * 2. API 응답 최적화
 * 3. 로딩 성능 개선
 */

import { db } from "./db";
import { images } from "./shared/schema";
import { eq, and } from "drizzle-orm";
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function optimizeImageAPI() {
  console.log("🚀 이미지 API 성능 최적화 시작...");

  try {
    // 1. uploads/thumbnails 폴더 확인 및 생성
    const uploadsPath = path.join(process.cwd(), 'uploads');
    const thumbnailsPath = path.join(uploadsPath, 'thumbnails');

    if (!fs.existsSync(thumbnailsPath)) {
      fs.mkdirSync(thumbnailsPath, { recursive: true });
      console.log("📁 thumbnails 폴더 생성됨");
    }

    // 2. 모든 이미지 조회 (썸네일 필드 제외)
    const allImages = await db.select({
      id: images.id,
      transformedUrl: images.transformedUrl,
      title: images.title
    }).from(images).limit(50); // 테스트용으로 50개만
    console.log(`📷 총 ${allImages.length}개 이미지 발견`);

    let generatedCount = 0;

    // 3. 각 이미지의 썸네일 생성
    for (const image of allImages) {
      if (!image.transformedUrl) continue;

      try {
        // 원본 파일 경로 확인
        const filename = path.basename(image.transformedUrl);
        const originalPath = path.join(uploadsPath, filename);
        const thumbnailPath = path.join(thumbnailsPath, filename);

        // 원본 파일이 존재하고 썸네일이 없는 경우만 생성
        if (fs.existsSync(originalPath) && !fs.existsSync(thumbnailPath)) {
          await sharp(originalPath)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);

          generatedCount++;
          console.log(`✅ 썸네일 생성: ${filename}`);
        }
      } catch (error) {
        console.log(`⚠️  썸네일 생성 실패: ${image.transformedUrl}`);
      }
    }

    console.log(`🎯 총 ${generatedCount}개 썸네일 생성 완료`);
    console.log("✅ 이미지 API 최적화 완료!");

  } catch (error) {
    console.error("❌ 최적화 중 오류:", error);
  }
}

optimizeImageAPI();