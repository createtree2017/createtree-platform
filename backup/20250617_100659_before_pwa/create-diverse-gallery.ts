/**
 * DEPRECATED AND REMOVED: Mock image generation script
 * This file is kept for reference but functionality is disabled
 * Only real user-generated images are used in the platform
 */

import { db } from './db';
import { images } from '@shared/schema';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// 다양한 색상과 패턴의 샘플 이미지 생성
const generateSampleImage = async (filename: string, color: string, text: string) => {
  const width = 512;
  const height = 512;
  
  // SVG로 이미지 생성
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
      <text x="50%" y="45%" text-anchor="middle" font-family="Arial" font-size="24" fill="white">${text}</text>
      <text x="50%" y="60%" text-anchor="middle" font-family="Arial" font-size="16" fill="white">${filename}</text>
    </svg>
  `;
  
  // 파일 경로 설정
  const filepath = path.join('./static/images/general/10/', filename);
  const thumbnailPath = path.join('./static/images/general/10/thumbnails/', filename.replace('.webp', '_thumb.webp'));
  
  // 디렉토리 생성
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.mkdirSync(path.dirname(thumbnailPath), { recursive: true });
  
  // 원본 이미지 생성
  await sharp(Buffer.from(svg))
    .resize(512, 512)
    .webp()
    .toFile(filepath);
  
  // 썸네일 생성
  await sharp(Buffer.from(svg))
    .resize(256, 256)
    .webp()
    .toFile(thumbnailPath);
  
  return {
    originalUrl: `images/general/10/${filename}`,
    thumbnailUrl: `images/general/10/thumbnails/${filename.replace('.webp', '_thumb.webp')}`
  };
};

async function createDiverseGallery() {
  try {
    console.log('🎨 다양한 갤러리 이미지 생성 시작...');
    
    // 기존 중복 데이터 정리
    await db.delete(images).where({ userId: '24' } as any);
    console.log('🗑️ 기존 데이터 정리 완료');
    
    // 다양한 이미지 데이터 생성
    const imageData = [
      { filename: 'mansak-photo-1.webp', color: '#FF6B6B', text: '만삭사진', title: 'mansak_beautiful_mom_generated', category: 'mansak_img' },
      { filename: 'mansak-photo-2.webp', color: '#4ECDC4', text: '만삭사진', title: 'mansak_sunset_mom_generated', category: 'mansak_img' },
      { filename: 'family-photo-1.webp', color: '#45B7D1', text: '가족사진', title: 'family_happy_family_generated', category: 'family_img' },
      { filename: 'family-photo-2.webp', color: '#96CEB4', text: '가족사진', title: 'family_loving_family_generated', category: 'family_img' },
      { filename: 'sticker-1.webp', color: '#FFEAA7', text: '스티커', title: 'sticker_cute_baby_generated', category: 'sticker_img' },
      { filename: 'sticker-2.webp', color: '#DDA0DD', text: '스티커', title: 'sticker_adorable_baby_generated', category: 'sticker_img' },
      { filename: 'mansak-photo-3.webp', color: '#98D8C8', text: '만삭사진', title: 'mansak_gorgeous_mom_generated', category: 'mansak_img' },
      { filename: 'family-photo-3.webp', color: '#F7DC6F', text: '가족사진', title: 'family_sweet_moment_generated', category: 'family_img' },
    ];
    
    // 각 이미지 생성 및 DB 저장
    for (const data of imageData) {
      console.log(`🖼️ 생성 중: ${data.title}`);
      
      const { originalUrl, thumbnailUrl } = await generateSampleImage(data.filename, data.color, data.text);
      
      await db.insert(images).values({
        title: data.title,
        style: data.category,
        originalUrl: originalUrl,
        transformedUrl: originalUrl,
        thumbnailUrl: thumbnailUrl,
        categoryId: data.category,
        userId: '24',
        metadata: JSON.stringify({
          userId: '24',
          category: data.category,
          generated: true
        }),
        createdAt: new Date()
      });
      
      console.log(`✅ 완료: ${data.title}`);
    }
    
    console.log('🎉 다양한 갤러리 이미지 생성 완료!');
    
  } catch (error) {
    console.error('❌ 갤러리 생성 오류:', error);
  }
}

// 실행
createDiverseGallery().then(() => {
  console.log('스크립트 실행 완료');
  process.exit(0);
}).catch((error) => {
  console.error('스크립트 실행 오류:', error);
  process.exit(1);
});