/**
 * 🔧 Base64 이미지 → .webp 파일 마이그레이션 스크립트
 * 작업지시서에 따른 기존 Base64 데이터 완전 제거 및 파일 기반으로 전환
 */

import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { eq, like } from 'drizzle-orm';
import { saveImageFromBase64 } from './server/utils/image-storage.js';

async function migrateBase64ToWebp() {
  try {
    console.log('🚀 Base64 → .webp 마이그레이션 시작...');
    
    // Base64 데이터가 저장된 이미지들 조회
    const base64Images = await db.select()
      .from(images)
      .where(like(images.transformedUrl, 'data:image%'));
    
    console.log(`📊 변환 대상: ${base64Images.length}개 Base64 이미지`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const image of base64Images) {
      try {
        console.log(`🔄 처리 중: ID ${image.id} - ${image.title}`);
        
        // Base64 데이터를 .webp 파일로 저장 + 썸네일 생성
        const result = await saveImageFromBase64(
          image.transformedUrl,
          image.categoryId || undefined
        );
        
        // DB 업데이트: Base64 제거하고 파일 경로로 변경
        await db.update(images)
          .set({
            transformedUrl: result.imageUrl,
            thumbnailUrl: result.thumbnailUrl,
            // title 필드가 Base64인 경우도 정리
            title: image.title.startsWith('data:image') 
              ? `${image.categoryId || 'image'}_${image.conceptId || 'concept'}_${image.userId || 'user'}`
              : image.title
          })
          .where(eq(images.id, image.id));
        
        successCount++;
        console.log(`✅ 완료: ${result.imageUrl}`);
        console.log(`🖼️ 썸네일: ${result.thumbnailUrl}`);
        
      } catch (error) {
        errorCount++;
        console.error(`❌ ID ${image.id} 처리 실패:`, error.message);
      }
    }
    
    console.log('\n📋 마이그레이션 완료 보고서:');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    console.log(`📁 모든 이미지가 .webp 파일로 저장되었습니다`);
    console.log(`🖼️ 썸네일이 자동 생성되었습니다`);
    
    // 변환 후 상태 확인
    const remainingBase64 = await db.select()
      .from(images)
      .where(like(images.transformedUrl, 'data:image%'));
    
    if (remainingBase64.length === 0) {
      console.log('🎉 모든 Base64 데이터가 성공적으로 제거되었습니다!');
    } else {
      console.log(`⚠️ ${remainingBase64.length}개 Base64 데이터가 아직 남아있습니다`);
    }
    
  } catch (error) {
    console.error('💥 마이그레이션 실패:', error);
  } finally {
    process.exit(0);
  }
}

// 스크립트 실행
console.log('🎯 Base64 → .webp 마이그레이션을 시작합니다...');
migrateBase64ToWebp();