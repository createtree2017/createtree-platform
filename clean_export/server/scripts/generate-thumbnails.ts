import sharp from 'sharp';
import { db } from '../../db';
import { images } from '@shared/schema';
import { eq, isNull, or } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 기존 이미지들의 썸네일 일괄 생성 스크립트
 * 
 * 이 스크립트는 DB에 저장된 모든 이미지의 썸네일을 생성하고
 * thumbnailUrl 필드를 업데이트합니다.
 */

async function ensureThumbnailDirectory() {
  const thumbnailDir = path.resolve(__dirname, '../../static/thumbnails');
  try {
    await fs.access(thumbnailDir);
  } catch {
    await fs.mkdir(thumbnailDir, { recursive: true });
    console.log('📁 썸네일 디렉토리 생성:', thumbnailDir);
  }
}

async function generateThumbnailForImage(imageRecord: any) {
  try {
    const originalPath = imageRecord.originalUrl || imageRecord.transformedUrl;
    if (!originalPath) {
      console.warn(`⚠️  이미지 경로가 없습니다: ID ${imageRecord.id}`);
      return null;
    }

    // 파일 경로 정리
    const cleanPath = originalPath.replace(/^\/home\/runner\/workspace/, '');
    const fullPath = path.resolve(__dirname, '../..', cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath);
    
    // 원본 파일 존재 확인
    try {
      await fs.access(fullPath);
    } catch {
      console.warn(`⚠️  원본 파일이 존재하지 않습니다: ${fullPath}`);
      return null;
    }

    // 썸네일 파일명 생성
    const thumbnailFileName = `thumb_${imageRecord.id}.jpg`;
    const thumbnailPath = path.resolve(__dirname, '../../static/thumbnails', thumbnailFileName);
    const thumbnailUrl = `/static/thumbnails/${thumbnailFileName}`;

    // Sharp로 썸네일 생성
    await sharp(fullPath)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    // DB 업데이트
    await db
      .update(images)
      .set({ thumbnailUrl })
      .where(eq(images.id, imageRecord.id));

    console.log(`✅ 썸네일 생성 완료: ID ${imageRecord.id} -> ${thumbnailUrl}`);
    return thumbnailUrl;

  } catch (error: any) {
    console.error(`❌ 썸네일 생성 실패: ID ${imageRecord.id}`, error.message);
    return null;
  }
}

async function generateAllThumbnails() {
  console.log('🖼️  기존 이미지 썸네일 일괄 생성 시작...');
  
  try {
    // 썸네일 디렉토리 확인/생성
    await ensureThumbnailDirectory();

    // 썸네일이 없는 이미지들 조회
    const allImages = await db
      .select({
        id: images.id,
        title: images.title,
        originalUrl: images.originalUrl,
        transformedUrl: images.transformedUrl,
        thumbnailUrl: images.thumbnailUrl,
        categoryId: images.categoryId
      })
      .from(images)
      .where(or(
        isNull(images.thumbnailUrl),
        eq(images.thumbnailUrl, '')
      ));
    
    console.log(`📊 썸네일이 없는 이미지: ${allImages.length}개`);
    
    if (allImages.length === 0) {
      console.log('✅ 모든 이미지에 썸네일이 이미 존재합니다.');
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    // 각 이미지에 대해 썸네일 생성
    for (let i = 0; i < allImages.length; i++) {
      const image = allImages[i];
      console.log(`[${i + 1}/${allImages.length}] 처리 중: ${image.title} (ID: ${image.id})`);
      
      const result = await generateThumbnailForImage(image);
      if (result) {
        successCount++;
      } else {
        failCount++;
      }
      
      // 잠시 대기 (시스템 부하 방지)
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('\n🎯 썸네일 생성 완료!');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    console.log(`📈 성공률: ${Math.round((successCount / allImages.length) * 100)}%`);
    
  } catch (error: any) {
    console.error('❌ 썸네일 생성 중 오류:', error);
    throw error;
  }
}

// 스크립트 실행
generateAllThumbnails()
  .then(() => {
    console.log('🏁 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('🚨 스크립트 실행 실패:', error);
    process.exit(1);
  });

export { generateAllThumbnails };