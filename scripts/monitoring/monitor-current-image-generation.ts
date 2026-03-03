/**
 * 현재 이미지 생성 진행 상황 모니터링
 */

import { db } from "../../db/index";
import { images } from "../../shared/schema";
import { desc } from "drizzle-orm";

async function monitorCurrentImageGeneration() {
  console.log('🔍 최근 이미지 생성 상황 확인...');
  
  try {
    // 최근 10개 이미지 확인
    const recentImages = await db.select({
      id: images.id,
      title: images.title,
      categoryId: images.categoryId,
      originalUrl: images.originalUrl,
      thumbnailUrl: images.thumbnailUrl,
      createdAt: images.createdAt,
      userId: images.userId
    })
    .from(images)
    .orderBy(desc(images.createdAt))
    .limit(10);
    
    console.log('📊 최근 생성된 이미지:');
    recentImages.forEach((img, index) => {
      const timeAgo = Math.floor((Date.now() - img.createdAt.getTime()) / 1000);
      const category = img.categoryId || 'unknown';
      const hasUrl = img.originalUrl ? '✅' : '❌';
      const hasThumbnail = img.thumbnailUrl ? '🖼️' : '⬜';
      
      console.log(`${index + 1}. ID ${img.id} | ${category} | ${timeAgo}초 전 | ${hasUrl} ${hasThumbnail}`);
      console.log(`   제목: ${img.title}`);
      console.log(`   사용자: ${img.userId}`);
      
      if (img.originalUrl) {
        const urlPath = img.originalUrl.split('/').slice(-2).join('/');
        console.log(`   파일: ${urlPath}`);
      }
      console.log('');
    });
    
    // 현재 생성 중인 만삭사진 확인
    const recentMansak = recentImages.filter(img => 
      img.categoryId === 'mansak_img' && 
      (Date.now() - img.createdAt.getTime()) < 300000 // 5분 이내
    );
    
    if (recentMansak.length > 0) {
      console.log('🎯 최근 5분 내 만삭사진 생성:');
      recentMansak.forEach(img => {
        console.log(`   ID ${img.id}: ${img.title}`);
      });
    } else {
      console.log('⏳ 현재 만삭사진 생성 진행 중... (아직 DB 저장 전)');
    }
    
  } catch (error) {
    console.error('❌ 모니터링 실패:', error);
  }
}

monitorCurrentImageGeneration();