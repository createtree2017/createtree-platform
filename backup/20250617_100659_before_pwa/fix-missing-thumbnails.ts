/**
 * 누락된 썸네일 파일 생성 스크립트
 */
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { db } from './db';
import { images } from './shared/schema';
import { eq } from 'drizzle-orm';

async function generateThumbnail(originalPath: string, thumbnailPath: string): Promise<void> {
  try {
    // 디렉토리 생성
    await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
    
    // 썸네일 생성 (300x300 크기로 리사이즈)
    await sharp(originalPath)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);
      
    console.log(`✅ 썸네일 생성 완료: ${thumbnailPath}`);
  } catch (error) {
    console.error(`❌ 썸네일 생성 실패 (${originalPath}):`, error);
  }
}

async function fixMissingThumbnails() {
  console.log('🔧 누락된 썸네일 파일 검사 및 생성 시작...');
  
  // 최근 생성된 이미지들 조회
  const recentImages = await db.query.images.findMany({
    where: eq(images.thumbnailUrl, null), // 썸네일이 없는 이미지들
    orderBy: (images, { desc }) => [desc(images.createdAt)],
    limit: 50
  });
  
  console.log(`📊 썸네일이 없는 이미지: ${recentImages.length}개`);
  
  for (const image of recentImages) {
    if (!image.transformedUrl) continue;
    
    // 원본 파일 경로 (full 이미지)
    const originalPath = path.join('/home/runner/workspace', image.transformedUrl);
    
    // 썸네일 경로 생성
    const fileName = path.basename(image.transformedUrl, path.extname(image.transformedUrl));
    const thumbnailPath = `/home/runner/workspace/uploads/thumbnails/2025/05/30/${fileName}_thumb.webp`;
    const thumbnailUrl = `/uploads/thumbnails/2025/05/30/${fileName}_thumb.webp`;
    
    try {
      // 원본 파일 존재 확인
      await fs.access(originalPath);
      
      // 썸네일 파일 존재 확인
      try {
        await fs.access(thumbnailPath);
        console.log(`⏭️  썸네일 이미 존재: ${thumbnailPath}`);
      } catch {
        // 썸네일 생성
        await generateThumbnail(originalPath, thumbnailPath);
        
        // 데이터베이스 업데이트
        await db.update(images)
          .set({ thumbnailUrl: thumbnailUrl })
          .where(eq(images.id, image.id));
          
        console.log(`✅ DB 업데이트 완료: ID ${image.id}`);
      }
    } catch (error) {
      console.error(`❌ 원본 파일 없음: ${originalPath}`);
    }
  }
  
  // 특정 누락된 썸네일들도 직접 생성
  const missingThumbnails = [
    {
      fullPath: '/home/runner/workspace/uploads/full/2025/05/30/5b8e4ec7-f102-4582-93f5-1c72ba9042a9.webp',
      thumbPath: '/home/runner/workspace/uploads/thumbnails/2025/05/30/5b8e4ec7-f102-4582-93f5-1c72ba9042a9_thumb.webp'
    },
    {
      fullPath: '/home/runner/workspace/uploads/full/2025/05/30/da1fdc12-28fb-4873-8465-79c9e533ffa9.webp',
      thumbPath: '/home/runner/workspace/uploads/thumbnails/2025/05/30/da1fdc12-28fb-4873-8465-79c9e533ffa9_thumb.webp'
    },
    {
      fullPath: '/home/runner/workspace/uploads/full/2025/05/30/88298637-a6b7-488d-aa82-326cd50d3537.webp',
      thumbPath: '/home/runner/workspace/uploads/thumbnails/2025/05/30/88298637-a6b7-488d-aa82-326cd50d3537_thumb.webp'
    },
    {
      fullPath: '/home/runner/workspace/uploads/full/2025/05/30/5f6e41e0-b6cf-4665-826e-762c12ac6e92.webp',
      thumbPath: '/home/runner/workspace/uploads/thumbnails/2025/05/30/5f6e41e0-b6cf-4665-826e-762c12ac6e92_thumb.webp'
    }
  ];
  
  console.log('🎯 특정 누락된 썸네일 생성 시작...');
  
  for (const { fullPath, thumbPath } of missingThumbnails) {
    try {
      await fs.access(fullPath);
      
      try {
        await fs.access(thumbPath);
        console.log(`⏭️  썸네일 이미 존재: ${thumbPath}`);
      } catch {
        await generateThumbnail(fullPath, thumbPath);
      }
    } catch {
      console.error(`❌ 원본 파일 없음: ${fullPath}`);
    }
  }
  
  console.log('🎉 썸네일 생성 작업 완료!');
}

// 스크립트 실행
fixMissingThumbnails().catch(console.error);