/**
 * WebP 변환 시스템 구축
 * 기존 JPG/PNG → WebP (50% 용량 절약)
 * 새 업로드 자동 WebP 변환
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { eq } from 'drizzle-orm';

interface ConversionResult {
  originalPath: string;
  webpPath: string;
  originalSize: number;
  webpSize: number;
  savings: number;
}

/**
 * 이미지를 WebP로 변환
 */
async function convertToWebP(inputPath: string, outputPath: string): Promise<ConversionResult | null> {
  try {
    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;

    // WebP 변환 (품질 85, 최적화된 설정)
    await sharp(inputPath)
      .webp({ 
        quality: 85,
        effort: 6,
        lossless: false
      })
      .toFile(outputPath);

    const webpStats = fs.statSync(outputPath);
    const webpSize = webpStats.size;
    const savings = ((originalSize - webpSize) / originalSize) * 100;

    return {
      originalPath: inputPath,
      webpPath: outputPath,
      originalSize,
      webpSize,
      savings
    };

  } catch (error) {
    console.error(`WebP 변환 실패: ${inputPath}`, error);
    return null;
  }
}

/**
 * uploads 폴더의 모든 이미지 변환
 */
async function convertAllToWebP(): Promise<void> {
  const uploadsDir = 'uploads';
  const imageFiles: string[] = [];
  let totalOriginalSize = 0;
  let totalWebpSize = 0;
  let convertedCount = 0;

  // 모든 이미지 파일 수집
  function collectImages(dir: string) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        collectImages(fullPath);
      } else if (/\.(jpg|jpeg|png)$/i.test(item) && !item.includes('webp')) {
        imageFiles.push(fullPath);
      }
    }
  }

  console.log('📁 이미지 파일 수집 중...');
  collectImages(uploadsDir);
  console.log(`📊 총 ${imageFiles.length}개 이미지 파일 발견`);

  // WebP 변환 디렉토리 생성
  const webpDir = path.join(uploadsDir, 'webp');
  if (!fs.existsSync(webpDir)) {
    fs.mkdirSync(webpDir, { recursive: true });
  }

  console.log('🔄 WebP 변환 시작...');

  // 배치 단위로 변환 (동시에 5개씩)
  for (let i = 0; i < imageFiles.length; i += 5) {
    const batch = imageFiles.slice(i, i + 5);
    const batchPromises = batch.map(async (imagePath) => {
      const relativePath = path.relative(uploadsDir, imagePath);
      const webpPath = path.join(webpDir, relativePath.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
      
      // 출력 디렉토리 생성
      const webpDirPath = path.dirname(webpPath);
      if (!fs.existsSync(webpDirPath)) {
        fs.mkdirSync(webpDirPath, { recursive: true });
      }

      // 이미 변환된 파일이 있으면 스킵
      if (fs.existsSync(webpPath)) {
        return null;
      }

      return await convertToWebP(imagePath, webpPath);
    });

    const results = await Promise.all(batchPromises);
    
    for (const result of results) {
      if (result) {
        totalOriginalSize += result.originalSize;
        totalWebpSize += result.webpSize;
        convertedCount++;
        
        console.log(`✅ 변환: ${path.basename(result.originalPath)} → ${(result.savings).toFixed(1)}% 절약`);
      }
    }

    // 진행률 표시
    const progress = Math.min(i + 5, imageFiles.length);
    console.log(`📈 진행률: ${progress}/${imageFiles.length} (${((progress / imageFiles.length) * 100).toFixed(1)}%)`);
  }

  const totalSavings = totalOriginalSize - totalWebpSize;
  const savingsPercent = ((totalSavings / totalOriginalSize) * 100);

  console.log('\n📋 WebP 변환 완료:');
  console.log(`🔄 변환된 파일: ${convertedCount}개`);
  console.log(`📦 원본 크기: ${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`📦 WebP 크기: ${(totalWebpSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`💾 절약 용량: ${(totalSavings / 1024 / 1024).toFixed(2)}MB (${savingsPercent.toFixed(1)}%)`);
}

/**
 * 새 이미지 업로드 시 자동 WebP 변환 함수
 */
export async function autoConvertToWebP(originalPath: string): Promise<string> {
  const webpDir = path.join('uploads', 'webp');
  if (!fs.existsSync(webpDir)) {
    fs.mkdirSync(webpDir, { recursive: true });
  }

  const relativePath = path.relative('uploads', originalPath);
  const webpPath = path.join(webpDir, relativePath.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
  
  // 출력 디렉토리 생성
  const webpDirPath = path.dirname(webpPath);
  if (!fs.existsSync(webpDirPath)) {
    fs.mkdirSync(webpDirPath, { recursive: true });
  }

  const result = await convertToWebP(originalPath, webpPath);
  
  if (result) {
    console.log(`🆕 신규 이미지 WebP 변환: ${path.basename(originalPath)} → ${result.savings.toFixed(1)}% 절약`);
    return webpPath;
  } else {
    throw new Error(`WebP 변환 실패: ${originalPath}`);
  }
}

/**
 * DB의 이미지 URL을 WebP 경로로 업데이트
 */
async function updateImageUrlsToWebP(): Promise<void> {
  console.log('🔄 DB 이미지 URL을 WebP로 업데이트 중...');
  
  try {
    const allImages = await db.query.images.findMany({
      where: (images, { or, like }) => or(
        like(images.originalUrl, '%.jpg'),
        like(images.originalUrl, '%.jpeg'),
        like(images.originalUrl, '%.png')
      )
    });

    console.log(`📊 업데이트할 이미지: ${allImages.length}개`);

    let updatedCount = 0;
    
    for (const image of allImages) {
      if (!image.originalUrl) continue;

      // WebP 경로 생성
      const webpUrl = image.originalUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const webpPath = webpUrl.replace('/uploads/', 'uploads/webp/');

      // WebP 파일이 실제로 존재하는지 확인
      if (fs.existsSync(webpPath)) {
        await db.update(images)
          .set({ 
            originalUrl: `/uploads/webp/${path.relative('uploads/webp', webpPath)}`
          })
          .where(eq(images.id, image.id));

        updatedCount++;
      }
    }

    console.log(`✅ DB 업데이트 완료: ${updatedCount}개 이미지 URL이 WebP로 변경됨`);

  } catch (error) {
    console.error('❌ DB 업데이트 실패:', error);
  }
}

// 실행
convertAllToWebP()
  .then(() => updateImageUrlsToWebP())
  .then(() => console.log('🎉 WebP 변환 시스템 구축 완료'))
  .catch(console.error);