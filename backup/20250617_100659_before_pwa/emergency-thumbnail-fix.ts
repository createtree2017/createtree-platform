/**
 * 긴급 썸네일 생성 - 24초 → 2초 해결
 */
import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { isNull } from 'drizzle-orm';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const thumbnailDir = './static/thumbnails';

async function emergencyThumbnailFix() {
  try {
    console.log('🚨 긴급 썸네일 생성 시작...');
    
    // 썸네일이 없는 이미지 20개만 처리 (속도 우선)
    const imagesToProcess = await db.select()
      .from(images)
      .where(isNull(images.thumbnailUrl))
      .limit(20);
    
    console.log(`⚡ ${imagesToProcess.length}개 이미지 처리 시작`);
    
    let successCount = 0;
    
    for (const image of imagesToProcess) {
      try {
        let sourceUrl = image.transformedUrl || image.originalUrl;
        
        if (sourceUrl && sourceUrl.startsWith('/static/')) {
          const localPath = `.${sourceUrl}`;
          
          if (fs.existsSync(localPath)) {
            const thumbnailFilename = `thumb_${image.id}.webp`;
            const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
            
            await sharp(localPath)
              .resize(300, 300, { fit: 'cover' })
              .webp({ quality: 70 })
              .toFile(thumbnailPath);
            
            const thumbnailUrl = `/static/thumbnails/${thumbnailFilename}`;
            
            await db.update(images)
              .set({ thumbnailUrl })
              .where({ id: image.id });
            
            successCount++;
            console.log(`✅ ${successCount}/${imagesToProcess.length}: ID ${image.id}`);
          }
        }
      } catch (error) {
        console.log(`⚠️ 스킵: ID ${image.id}`);
      }
    }
    
    console.log(`🎉 완료! ${successCount}개 썸네일 생성`);
    
  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    process.exit(0);
  }
}

emergencyThumbnailFix();