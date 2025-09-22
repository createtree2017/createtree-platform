import { Storage } from '@google-cloud/storage';
import { db } from '../../db/index.js';
import { banners, smallBanners } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

// GCS 초기화 - 기존 gcs-image-storage.ts와 동일한 방식 사용
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'createtreeai'
});

const bucket = storage.bucket('createtree-upload');

interface MigrationResult {
  id: number;
  table: 'banners' | 'small_banners';
  originalPath: string;
  gcsUrl?: string;
  status: 'success' | 'file_not_found' | 'already_migrated' | 'error';
  error?: string;
}

/**
 * 로컬 배너 파일을 GCS에 업로드하고 공개 URL 반환
 */
async function uploadBannerToGCS(
  localFilePath: string, 
  bannerType: 'slide' | 'small',
  filename: string
): Promise<string> {
  try {
    const gcsPath = `banners/${bannerType}/${filename}`;
    const file = bucket.file(gcsPath);
    
    console.log(`📤 GCS 업로드 시작: ${localFilePath} → ${gcsPath}`);
    
    // 파일 업로드
    await bucket.upload(localFilePath, {
      destination: gcsPath,
      metadata: {
        cacheControl: 'public, max-age=31536000', // 1년 캐시
      },
    });
    
    // 파일을 공개로 설정
    await file.makePublic();
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${gcsPath}`;
    console.log(`✅ 업로드 완료: ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    console.error(`❌ GCS 업로드 실패 (${localFilePath}):`, error);
    throw error;
  }
}

/**
 * 슬라이드 배너 마이그레이션
 */
async function migrateSlideBanners(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  
  console.log('\n🎭 슬라이드 배너 마이그레이션 시작...');
  
  const slideBanners = await db.select().from(banners);
  console.log(`📊 총 ${slideBanners.length}개의 슬라이드 배너 발견`);
  
  for (const banner of slideBanners) {
    const result: MigrationResult = {
      id: banner.id,
      table: 'banners',
      originalPath: banner.imageSrc,
      status: 'error'
    };
    
    try {
      // 이미 GCS URL인지 확인
      if (banner.imageSrc.startsWith('https://storage.googleapis.com')) {
        result.status = 'already_migrated';
        result.gcsUrl = banner.imageSrc;
        console.log(`⏭️  이미 마이그레이션됨 (ID: ${banner.id}): ${banner.imageSrc}`);
        results.push(result);
        continue;
      }
      
      // 로컬 파일 경로 생성
      const localPath = banner.imageSrc.replace('/static/', 'static/');
      const filename = path.basename(localPath);
      
      // 파일 존재 확인
      if (!fs.existsSync(localPath)) {
        result.status = 'file_not_found';
        result.error = `로컬 파일 없음: ${localPath}`;
        console.log(`⚠️  파일 없음 (ID: ${banner.id}): ${localPath}`);
        results.push(result);
        continue;
      }
      
      // GCS에 업로드
      const gcsUrl = await uploadBannerToGCS(localPath, 'slide', filename);
      
      // DB 업데이트
      await db
        .update(banners)
        .set({ 
          imageSrc: gcsUrl,
          updatedAt: new Date()
        })
        .where(eq(banners.id, banner.id));
      
      result.status = 'success';
      result.gcsUrl = gcsUrl;
      
      console.log(`✅ 슬라이드 배너 마이그레이션 완료 (ID: ${banner.id})`);
      results.push(result);
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`❌ 슬라이드 배너 마이그레이션 실패 (ID: ${banner.id}):`, error);
      results.push(result);
    }
  }
  
  return results;
}

/**
 * 작은 배너 마이그레이션
 */
async function migrateSmallBanners(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  
  console.log('\n📱 작은 배너 마이그레이션 시작...');
  
  const smallBannerList = await db.select().from(smallBanners);
  console.log(`📊 총 ${smallBannerList.length}개의 작은 배너 발견`);
  
  for (const banner of smallBannerList) {
    const result: MigrationResult = {
      id: banner.id,
      table: 'small_banners',
      originalPath: banner.imageUrl,
      status: 'error'
    };
    
    try {
      // 이미 GCS URL인지 확인
      if (banner.imageUrl.startsWith('https://storage.googleapis.com')) {
        result.status = 'already_migrated';
        result.gcsUrl = banner.imageUrl;
        console.log(`⏭️  이미 마이그레이션됨 (ID: ${banner.id}): ${banner.imageUrl}`);
        results.push(result);
        continue;
      }
      
      // 로컬 파일 경로 생성
      const localPath = banner.imageUrl.replace('/static/', 'static/');
      const filename = path.basename(localPath);
      
      // 파일 존재 확인
      if (!fs.existsSync(localPath)) {
        result.status = 'file_not_found';
        result.error = `로컬 파일 없음: ${localPath}`;
        console.log(`⚠️  파일 없음 (ID: ${banner.id}): ${localPath}`);
        results.push(result);
        continue;
      }
      
      // GCS에 업로드
      const gcsUrl = await uploadBannerToGCS(localPath, 'small', filename);
      
      // DB 업데이트
      await db
        .update(smallBanners)
        .set({ 
          imageUrl: gcsUrl,
          updatedAt: new Date()
        })
        .where(eq(smallBanners.id, banner.id));
      
      result.status = 'success';
      result.gcsUrl = gcsUrl;
      
      console.log(`✅ 작은 배너 마이그레이션 완료 (ID: ${banner.id})`);
      results.push(result);
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`❌ 작은 배너 마이그레이션 실패 (ID: ${banner.id}):`, error);
      results.push(result);
    }
  }
  
  return results;
}

/**
 * 마이그레이션 결과 요약 출력
 */
function printMigrationSummary(results: MigrationResult[]) {
  console.log('\n📊 마이그레이션 결과 요약');
  console.log('='.repeat(50));
  
  const summary = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`✅ 성공: ${summary.success || 0}개`);
  console.log(`⏭️  이미 마이그레이션됨: ${summary.already_migrated || 0}개`);
  console.log(`⚠️  파일 없음: ${summary.file_not_found || 0}개`);
  console.log(`❌ 오류: ${summary.error || 0}개`);
  console.log(`📊 총 처리: ${results.length}개`);
  
  // 오류 상세 정보
  const errors = results.filter(r => r.status === 'error' || r.status === 'file_not_found');
  if (errors.length > 0) {
    console.log('\n⚠️  주의가 필요한 항목:');
    errors.forEach(error => {
      console.log(`  - ${error.table} ID ${error.id}: ${error.error}`);
    });
  }
}

/**
 * 메인 마이그레이션 함수
 */
async function main() {
  console.log('🚀 배너 GCS 마이그레이션 시작');
  console.log('='.repeat(50));
  
  try {
    // GCS 연결 테스트
    await bucket.getMetadata();
    console.log('✅ GCS 연결 확인됨');
    
    // 슬라이드 배너 마이그레이션
    const slideResults = await migrateSlideBanners();
    
    // 작은 배너 마이그레이션  
    const smallResults = await migrateSmallBanners();
    
    // 결과 요약
    const allResults = [...slideResults, ...smallResults];
    printMigrationSummary(allResults);
    
    console.log('\n🎉 배너 마이그레이션 완료!');
    
    // 성공한 마이그레이션이 있으면 검증 실행
    const successCount = allResults.filter(r => r.status === 'success').length;
    if (successCount > 0) {
      console.log('\n🔍 마이그레이션 검증 시작...');
      await verifyMigration();
    }
    
  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    process.exit(1);
  }
}

/**
 * 마이그레이션 결과 검증
 */
async function verifyMigration() {
  try {
    // 슬라이드 배너 검증
    const slideCount = await db.select().from(banners);
    const gcsSlideCount = slideCount.filter(b => b.imageSrc.startsWith('https://storage.googleapis.com')).length;
    
    // 작은 배너 검증
    const smallCount = await db.select().from(smallBanners);  
    const gcsSmallCount = smallCount.filter(b => b.imageUrl.startsWith('https://storage.googleapis.com')).length;
    
    console.log(`\n✅ 검증 결과:`);
    console.log(`  - 슬라이드 배너: ${gcsSlideCount}/${slideCount.length} GCS 저장`);
    console.log(`  - 작은 배너: ${gcsSmallCount}/${smallCount.length} GCS 저장`);
    
    if (gcsSlideCount === slideCount.length && gcsSmallCount === smallCount.length) {
      console.log(`🎊 모든 배너가 성공적으로 GCS로 마이그레이션되었습니다!`);
    } else {
      console.log(`⚠️  일부 배너가 여전히 로컬 경로를 참조하고 있습니다.`);
    }
    
  } catch (error) {
    console.error('❌ 검증 중 오류:', error);
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}