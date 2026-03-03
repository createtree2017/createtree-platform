/**
 * GCS 폴더 구조 정리 스크립트
 * 
 * 올바른 카테고리 구조:
 * - mansak_img: 만삭사진
 * - family_img: 사진스타일 바꾸기 
 * - sticker_img: 스티커
 */

import { Storage } from '@google-cloud/storage';
import { db } from "../../db/index";
import { images } from "../../shared/schema";
import { eq, inArray } from "drizzle-orm";
import path from 'path';

// GCS Storage 클라이언트 - 환경변수 기반 ADC 사용
const storage = new Storage({
  projectId: 'createtreeai',
  // keyFilename 제거 - ADC(Application Default Credentials) 사용
});

const bucket = storage.bucket('createtree-upload');

async function reorganizeGCSFolders() {
  console.log('🗂️ GCS 폴더 구조 정리 시작...');
  
  try {
    // 1. 현재 GCS의 모든 파일 목록 확인
    console.log('📋 현재 GCS 파일 구조 분석...');
    const [files] = await bucket.getFiles({ prefix: 'images/' });
    
    const folderStructure = new Map<string, number>();
    
    files.forEach(file => {
      const filePath = file.name;
      const pathParts = filePath.split('/');
      
      if (pathParts.length >= 3) {
        const category = pathParts[1]; // images/[category]/...
        folderStructure.set(category, (folderStructure.get(category) || 0) + 1);
      }
    });
    
    console.log('📊 현재 폴더 구조:');
    for (const [folder, count] of folderStructure.entries()) {
      console.log(`   ${folder}: ${count}개 파일`);
    }
    
    // 2. 데이터베이스에서 이미지 카테고리 정보 확인
    console.log('\n🔍 데이터베이스 카테고리 분석...');
    const allImages = await db.select({
      id: images.id,
      categoryId: images.categoryId,
      originalUrl: images.originalUrl,
      thumbnailUrl: images.thumbnailUrl,
      title: images.title,
      style: images.style
    }).from(images);
    
    const categoryStats = new Map<string, number>();
    const urlMismatches: any[] = [];
    
    allImages.forEach(image => {
      const category = image.categoryId || 'unknown';
      categoryStats.set(category, (categoryStats.get(category) || 0) + 1);
      
      // URL과 카테고리 불일치 확인
      if (image.originalUrl) {
        const urlCategory = extractCategoryFromUrl(image.originalUrl);
        if (urlCategory && urlCategory !== category) {
          urlMismatches.push({
            id: image.id,
            title: image.title,
            dbCategory: category,
            urlCategory: urlCategory,
            url: image.originalUrl
          });
        }
      }
    });
    
    console.log('📊 데이터베이스 카테고리:');
    for (const [category, count] of categoryStats.entries()) {
      console.log(`   ${category}: ${count}개 이미지`);
    }
    
    if (urlMismatches.length > 0) {
      console.log('\n⚠️ URL과 카테고리 불일치 발견:');
      urlMismatches.slice(0, 10).forEach(mismatch => {
        console.log(`   ID ${mismatch.id}: DB(${mismatch.dbCategory}) vs URL(${mismatch.urlCategory})`);
      });
      if (urlMismatches.length > 10) {
        console.log(`   ... 외 ${urlMismatches.length - 10}개 더`);
      }
    }
    
    // 3. 올바른 카테고리 구조 정의
    const correctCategories = ['mansak_img', 'family_img', 'sticker_img'];
    const incorrectFolders = Array.from(folderStructure.keys()).filter(
      folder => !correctCategories.includes(folder) && folder !== 'full' && folder !== 'thumbnails'
    );
    
    console.log('\n🎯 정리 대상 폴더:');
    incorrectFolders.forEach(folder => {
      console.log(`   ${folder} (${folderStructure.get(folder)}개 파일)`);
    });
    
    // 4. 데이터베이스 카테고리 정규화
    console.log('\n🔧 데이터베이스 카테고리 정규화...');
    
    // 잘못된 카테고리를 올바른 카테고리로 매핑
    const categoryMapping: Record<string, string> = {
      'full': 'mansak_img',
      'general': 'mansak_img',
      'test': 'mansak_img',
      'test_verification': 'mansak_img',
      'family': 'family_img',
      'sticker': 'sticker_img'
    };
    
    for (const [wrongCategory, correctCategory] of Object.entries(categoryMapping)) {
      const imagesToUpdate = allImages.filter(img => img.categoryId === wrongCategory);
      
      if (imagesToUpdate.length > 0) {
        console.log(`📝 ${wrongCategory} → ${correctCategory}: ${imagesToUpdate.length}개 이미지`);
        
        await db.update(images)
          .set({ categoryId: correctCategory })
          .where(inArray(images.id, imagesToUpdate.map(img => img.id)));
      }
    }
    
    // 5. GCS 파일 이동 계획 (실제 이동은 안전상 로깅만)
    console.log('\n📋 GCS 파일 이동 계획:');
    
    const moveOperations: Array<{
      source: string;
      target: string;
      category: string;
    }> = [];
    
    files.forEach(file => {
      const filePath = file.name;
      const pathParts = filePath.split('/');
      
      if (pathParts.length >= 4) { // images/category/userId/file
        const currentCategory = pathParts[1];
        const userId = pathParts[2];
        const fileName = pathParts[3];
        
        // 폴더명 정규화 필요 여부 확인
        const targetCategory = categoryMapping[currentCategory] || currentCategory;
        
        if (targetCategory !== currentCategory && correctCategories.includes(targetCategory)) {
          const targetPath = `images/${targetCategory}/${userId}/${fileName}`;
          moveOperations.push({
            source: filePath,
            target: targetPath,
            category: targetCategory
          });
        }
      }
    });
    
    console.log(`📦 이동 대상: ${moveOperations.length}개 파일`);
    
    if (moveOperations.length > 0) {
      console.log('샘플 이동 작업:');
      moveOperations.slice(0, 5).forEach(op => {
        console.log(`   ${op.source} → ${op.target}`);
      });
    }
    
    // 6. 요약 리포트
    console.log('\n📊 정리 완료 요약:');
    console.log(`✅ 올바른 카테고리: ${correctCategories.join(', ')}`);
    console.log(`🔧 정규화된 DB 레코드: ${Object.values(categoryMapping).length}개 카테고리`);
    console.log(`📁 정리된 폴더: ${incorrectFolders.length}개`);
    console.log(`📦 이동 예정 파일: ${moveOperations.length}개`);
    
    // 7. 정리 후 폴더 구조 예측
    console.log('\n🎯 정리 후 예상 폴더 구조:');
    const finalStructure = new Map<string, number>();
    
    files.forEach(file => {
      const pathParts = file.name.split('/');
      if (pathParts.length >= 3) {
        const currentCategory = pathParts[1];
        const targetCategory = categoryMapping[currentCategory] || currentCategory;
        
        if (correctCategories.includes(targetCategory)) {
          finalStructure.set(targetCategory, (finalStructure.get(targetCategory) || 0) + 1);
        }
      }
    });
    
    for (const [category, count] of finalStructure.entries()) {
      console.log(`   ${category}: ${count}개 파일`);
    }
    
  } catch (error) {
    console.error('❌ GCS 폴더 정리 실패:', error);
  }
}

function extractCategoryFromUrl(url: string): string | null {
  try {
    // GCS URL에서 카테고리 추출: ...createtree-upload/images/[category]/...
    const match = url.match(/\/images\/([^\/]+)\//);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

reorganizeGCSFolders();