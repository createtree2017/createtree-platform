/**
 * 삭제된 썸네일 파일 복구 스크립트
 * 원본 파일에서 썸네일을 다시 생성합니다
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { images } from './shared/schema';
import { eq, isNotNull } from 'drizzle-orm';

async function generateThumbnailFromOriginal(originalPath: string, thumbnailPath: string): Promise<boolean> {
  try {
    // 썸네일 디렉토리 생성
    await fs.promises.mkdir(path.dirname(thumbnailPath), { recursive: true });
    
    // 썸네일 생성 (300x300 크기로 리사이즈)
    await sharp(originalPath)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);
      
    console.log(`✅ 썸네일 복구 완료: ${thumbnailPath}`);
    return true;
  } catch (error) {
    console.error(`❌ 썸네일 생성 실패 (${originalPath}):`, error);
    return false;
  }
}

async function restoreThumbnails() {
  console.log('🔧 삭제된 썸네일 파일 복구 시작...');
  
  // 썸네일 URL이 있는 모든 이미지 조회
  const allImages = await db.query.images.findMany({
    where: isNotNull(images.thumbnailUrl),
    orderBy: (images, { desc }) => [desc(images.createdAt)]
  });
  
  console.log(`📊 총 ${allImages.length}개 이미지 검사 중...`);
  
  let restoredCount = 0;
  let failedCount = 0;
  
  for (const image of allImages) {
    if (!image.thumbnailUrl) continue;
    
    const thumbnailPath = path.join('/home/runner/workspace', image.thumbnailUrl);
    
    // 썸네일 파일이 이미 존재하는지 확인
    try {
      await fs.promises.access(thumbnailPath);
      console.log(`⏭️  썸네일 이미 존재: ${image.id}`);
      continue;
    } catch {
      // 썸네일이 없음, 복구 시도
    }
    
    // 원본 파일 경로들 시도
    const possibleOriginalPaths = [
      path.join('/home/runner/workspace', image.originalUrl),
      path.join('/home/runner/workspace', image.transformedUrl || ''),
      // uploads 디렉토리에서 직접 찾기
      path.join('/home/runner/workspace/uploads', path.basename(image.originalUrl))
    ];
    
    let restored = false;
    
    for (const originalPath of possibleOriginalPaths) {
      if (!originalPath || originalPath.includes('undefined')) continue;
      
      try {
        await fs.promises.access(originalPath);
        
        // 원본 파일이 존재하면 썸네일 생성
        const success = await generateThumbnailFromOriginal(originalPath, thumbnailPath);
        if (success) {
          restoredCount++;
          restored = true;
          console.log(`✅ 복구 성공: ID ${image.id} (${originalPath} → ${thumbnailPath})`);
          break;
        }
      } catch {
        // 파일이 없으면 다음 경로 시도
        continue;
      }
    }
    
    if (!restored) {
      failedCount++;
      console.log(`❌ 복구 실패: ID ${image.id} - 원본 파일 없음`);
    }
  }
  
  console.log(`🎉 썸네일 복구 완료!`);
  console.log(`📊 결과: 복구됨 ${restoredCount}개, 실패 ${failedCount}개`);
}

// 스크립트 실행
restoreThumbnails().catch(console.error);