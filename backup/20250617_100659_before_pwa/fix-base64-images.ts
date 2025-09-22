/**
 * Base64 이미지를 로컬 파일로 저장하고 썸네일 생성
 */
import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function fixBase64Images() {
  try {
    console.log('🔧 Base64 이미지 수정 시작...');
    
    // Base64 이미지 조회
    const base64Images = await db.select()
      .from(images)
      .where(eq(images.transformedUrl, 'data:image'))
      .limit(5);
    
    console.log(`📊 ${base64Images.length}개 Base64 이미지 발견`);
    
    for (const image of base64Images) {
      try {
        if (image.transformedUrl && image.transformedUrl.startsWith('data:image')) {
          // Base64 데이터 추출
          const base64Data = image.transformedUrl.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          
          // 로컬 파일로 저장
          const filename = `image_${image.id}.jpg`;
          const filepath = `./static/${filename}`;
          
          // Sharp로 이미지 변환 및 저장
          await sharp(buffer)
            .jpeg({ quality: 85 })
            .toFile(filepath);
          
          // 썸네일 생성
          const thumbnailFilename = `thumb_${image.id}.webp`;
          const thumbnailPath = `./static/thumbnails/${thumbnailFilename}`;
          
          await sharp(buffer)
            .resize(300, 300, { fit: 'cover' })
            .webp({ quality: 70 })
            .toFile(thumbnailPath);
          
          // DB 업데이트
          await db.update(images)
            .set({
              transformedUrl: `/static/${filename}`,
              thumbnailUrl: `/static/thumbnails/${thumbnailFilename}`
            })
            .where(eq(images.id, image.id));
          
          console.log(`✅ ID ${image.id}: 로컬 파일 + 썸네일 생성 완료`);
        }
      } catch (error) {
        console.log(`⚠️ ID ${image.id} 처리 실패:`, error.message);
      }
    }
    
    console.log('🎉 Base64 이미지 수정 완료!');
    
  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    process.exit(0);
  }
}

fixBase64Images();