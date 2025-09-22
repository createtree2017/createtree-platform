import express from 'express';
import { db } from '../../db/index.js';
import { banners, smallBanners } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { requireAdminOrSuperAdmin } from '../middleware/admin-auth.js';
import { saveBannerToGCS } from '../utils/gcs-image-storage.js';

const router = express.Router();

// GCS 클라이언트 초기화 함수 - 환경변수 기반 인증 방식 복구
function initializeGCS() {
  try {
    console.log('🔧 GCS 클라이언트 초기화 시작 (환경변수 기반)...');
    
    // GOOGLE_CLOUD_* 환경변수 방식으로 복구
    const storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
      }
    });
    
    console.log('✅ GOOGLE_CLOUD_* 환경변수로 GCS 클라이언트 생성 완료');
    return { storage, bucket: storage.bucket('createtree-upload') };
    
  } catch (error) {
    console.error('❌ GCS 초기화 실패:', error);
    throw new Error(`GCS 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

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
  filename: string,
  bucket: any
): Promise<string> {
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
}

/**
 * 슬라이드 배너 마이그레이션
 */
async function migrateSlideBanners(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  
  console.log('\n🎭 슬라이드 배너 마이그레이션 시작...');
  
  // GCS 초기화
  const { bucket } = initializeGCS();
  
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
      const gcsUrl = await uploadBannerToGCS(localPath, 'slide', filename, bucket);
      
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
  
  // GCS 초기화
  const { bucket } = initializeGCS();
  
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
      const gcsUrl = await uploadBannerToGCS(localPath, 'small', filename, bucket);
      
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
 * 배너 마이그레이션 API 엔드포인트 (임시 인증 없음)
 */
router.post('/migrate-now', async (req, res) => {
  try {
    console.log('🚀 배너 GCS 마이그레이션 시작');
    
    // GCS 클라이언트 초기화 및 연결 테스트
    let storage: Storage;
    let bucket: any;
    
    try {
      const gcsClient = initializeGCS();
      storage = gcsClient.storage;
      bucket = gcsClient.bucket;
      
      await bucket.getMetadata();
      console.log('✅ GCS 연결 확인됨');
    } catch (error) {
      console.error('❌ GCS 연결 실패:', error);
      return res.status(500).json({ 
        error: 'GCS 연결 실패', 
        message: error instanceof Error ? error.message : String(error)
      });
    }
    
    // 슬라이드 배너 마이그레이션
    const slideResults = await migrateSlideBanners();
    
    // 작은 배너 마이그레이션  
    const smallResults = await migrateSmallBanners();
    
    // 결과 요약
    const allResults = [...slideResults, ...smallResults];
    const summary = allResults.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('✅ 배너 마이그레이션 완료');
    
    // 검증 실행
    const slideCount = await db.select().from(banners);
    const gcsSlideCount = slideCount.filter(b => b.imageSrc.startsWith('https://storage.googleapis.com')).length;
    
    const smallCount = await db.select().from(smallBanners);  
    const gcsSmallCount = smallCount.filter(b => b.imageUrl.startsWith('https://storage.googleapis.com')).length;
    
    const response = {
      success: true,
      summary: {
        total: allResults.length,
        success: summary.success || 0,
        already_migrated: summary.already_migrated || 0,
        file_not_found: summary.file_not_found || 0,
        error: summary.error || 0
      },
      details: allResults,
      verification: {
        slideBanners: `${gcsSlideCount}/${slideCount.length} GCS 저장`,
        smallBanners: `${gcsSmallCount}/${smallCount.length} GCS 저장`,
        allMigrated: gcsSlideCount === slideCount.length && gcsSmallCount === smallCount.length
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    res.status(500).json({
      error: '마이그레이션 실패',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 🚨 긴급 마이그레이션 실행 API (임시 인증 없음) - 시스템 복구용
 */
router.post('/emergency-migrate', async (req, res) => {
  try {
    console.log('🚨 긴급 배너 GCS 마이그레이션 시작 (인증 없음)');
    
    // GCS 클라이언트 초기화 및 연결 테스트
    let storage: Storage;
    let bucket: any;
    
    try {
      const gcsClient = initializeGCS();
      storage = gcsClient.storage;
      bucket = gcsClient.bucket;
      
      await bucket.getMetadata();
      console.log('✅ GCS 연결 확인됨');
    } catch (error) {
      console.error('❌ GCS 연결 실패:', error);
      return res.status(500).json({ 
        error: 'GCS 연결 실패', 
        message: error instanceof Error ? error.message : String(error)
      });
    }
    
    // 슬라이드 배너 마이그레이션
    const slideResults = await migrateSlideBanners();
    
    // 작은 배너 마이그레이션  
    const smallResults = await migrateSmallBanners();
    
    // 결과 요약
    const allResults = [...slideResults, ...smallResults];
    const summary = allResults.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('✅ 긴급 배너 마이그레이션 완료');
    
    // 검증 실행
    const slideCount = await db.select().from(banners);
    const gcsSlideCount = slideCount.filter(b => b.imageSrc.startsWith('https://storage.googleapis.com')).length;
    
    const smallCount = await db.select().from(smallBanners);  
    const gcsSmallCount = smallCount.filter(b => b.imageUrl.startsWith('https://storage.googleapis.com')).length;
    
    const response = {
      success: true,
      emergency: true,
      summary: {
        total: allResults.length,
        success: summary.success || 0,
        already_migrated: summary.already_migrated || 0,
        file_not_found: summary.file_not_found || 0,
        error: summary.error || 0
      },
      details: allResults,
      verification: {
        slideBanners: `${gcsSlideCount}/${slideCount.length} GCS 저장`,
        smallBanners: `${gcsSmallCount}/${smallCount.length} GCS 저장`,
        allMigrated: gcsSlideCount === slideCount.length && gcsSmallCount === smallCount.length
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ 긴급 마이그레이션 중 오류 발생:', error);
    res.status(500).json({
      error: '긴급 마이그레이션 실패',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 마이그레이션 상태 확인 API (임시 인증 없음)
 */
router.get('/status-now', async (req, res) => {
  try {
    // 현재 배너 상태 조회
    const slideCount = await db.select().from(banners);
    const smallCount = await db.select().from(smallBanners);
    
    const slideLocal = slideCount.filter(b => !b.imageSrc.startsWith('https://storage.googleapis.com'));
    const smallLocal = smallCount.filter(b => !b.imageUrl.startsWith('https://storage.googleapis.com'));
    
    res.json({
      slideBanners: {
        total: slideCount.length,
        gcsCount: slideCount.length - slideLocal.length,
        localCount: slideLocal.length,
        localBanners: slideLocal.map(b => ({ id: b.id, title: b.title, imageSrc: b.imageSrc }))
      },
      smallBanners: {
        total: smallCount.length,
        gcsCount: smallCount.length - smallLocal.length,
        localCount: smallLocal.length,
        localBanners: smallLocal.map(b => ({ id: b.id, title: b.title, imageUrl: b.imageUrl }))
      },
      needsMigration: slideLocal.length > 0 || smallLocal.length > 0
    });
    
  } catch (error) {
    console.error('상태 확인 오류:', error);
    res.status(500).json({
      error: '상태 확인 실패',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 🌐 PRIVATE → PUBLIC GCS 배너 마이그레이션 (HIPAA 문제 해결)
 */
async function migratePrivateToPublicBanners(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  
  console.log('\n🔄 PRIVATE → PUBLIC 배너 마이그레이션 시작...');
  
  // GCS 초기화
  const { storage, bucket } = initializeGCS();
  
  // 슬라이드 배너 처리
  const slideBanners = await db.select().from(banners);
  console.log(`📊 총 ${slideBanners.length}개의 슬라이드 배너 처리`);
  
  for (const banner of slideBanners) {
    const result: MigrationResult = {
      id: banner.id,
      table: 'banners',
      originalPath: banner.imageSrc,
      status: 'error'
    };
    
    try {
      // PRIVATE GCS URL (signed URL) 패턴 확인
      if (banner.imageSrc.includes('X-Goog-Algorithm') || 
          banner.imageSrc.includes('Signature') ||
          banner.imageSrc.includes('Expires')) {
        
        console.log(`🔄 PRIVATE → PUBLIC 변환 시작 (ID: ${banner.id}): ${banner.imageSrc.substring(0, 100)}...`);
        
        // 이미지 다운로드
        const response = await fetch(banner.imageSrc);
        if (!response.ok) {
          throw new Error(`이미지 다운로드 실패: ${response.status}`);
        }
        
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        
        // 새로운 파일명 생성
        const filename = `migrated-slide-${banner.id}-${Date.now()}.webp`;
        
        // PUBLIC GCS로 저장
        const publicGcsResult = await saveBannerToGCS(
          imageBuffer,
          'slide',
          filename
        );
        
        // DB 업데이트
        await db
          .update(banners)
          .set({ 
            imageSrc: publicGcsResult.publicUrl,
            updatedAt: new Date()
          })
          .where(eq(banners.id, banner.id));
        
        result.status = 'success';
        result.gcsUrl = publicGcsResult.publicUrl;
        
        console.log(`✅ 슬라이드 배너 PRIVATE→PUBLIC 완료 (ID: ${banner.id})`);
        
      } else if (banner.imageSrc.startsWith('https://storage.googleapis.com/createtree-upload/banners/')) {
        result.status = 'already_migrated';
        result.gcsUrl = banner.imageSrc;
        console.log(`⏭️  이미 PUBLIC 배너 (ID: ${banner.id}): ${banner.imageSrc}`);
        
      } else {
        result.status = 'already_migrated';
        result.gcsUrl = banner.imageSrc;
        console.log(`⏭️  로컬 또는 기타 형식 (ID: ${banner.id}): ${banner.imageSrc}`);
      }
      
      results.push(result);
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`❌ 슬라이드 배너 PRIVATE→PUBLIC 실패 (ID: ${banner.id}):`, error);
      results.push(result);
    }
  }
  
  // 작은 배너 처리
  const smallBannerList = await db.select().from(smallBanners);
  console.log(`📊 총 ${smallBannerList.length}개의 작은 배너 처리`);
  
  for (const banner of smallBannerList) {
    const result: MigrationResult = {
      id: banner.id,
      table: 'small_banners',
      originalPath: banner.imageUrl,
      status: 'error'
    };
    
    try {
      // PRIVATE GCS URL (signed URL) 패턴 확인
      if (banner.imageUrl.includes('X-Goog-Algorithm') || 
          banner.imageUrl.includes('Signature') ||
          banner.imageUrl.includes('Expires')) {
        
        console.log(`🔄 PRIVATE → PUBLIC 변환 시작 (ID: ${banner.id}): ${banner.imageUrl.substring(0, 100)}...`);
        
        // 이미지 다운로드
        const response = await fetch(banner.imageUrl);
        if (!response.ok) {
          throw new Error(`이미지 다운로드 실패: ${response.status}`);
        }
        
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        
        // 새로운 파일명 생성
        const filename = `migrated-small-${banner.id}-${Date.now()}.webp`;
        
        // PUBLIC GCS로 저장
        const publicGcsResult = await saveBannerToGCS(
          imageBuffer,
          'small',
          filename
        );
        
        // DB 업데이트
        await db
          .update(smallBanners)
          .set({ 
            imageUrl: publicGcsResult.publicUrl,
            updatedAt: new Date()
          })
          .where(eq(smallBanners.id, banner.id));
        
        result.status = 'success';
        result.gcsUrl = publicGcsResult.publicUrl;
        
        console.log(`✅ 작은 배너 PRIVATE→PUBLIC 완료 (ID: ${banner.id})`);
        
      } else if (banner.imageUrl.startsWith('https://storage.googleapis.com/createtree-upload/banners/')) {
        result.status = 'already_migrated';
        result.gcsUrl = banner.imageUrl;
        console.log(`⏭️  이미 PUBLIC 배너 (ID: ${banner.id}): ${banner.imageUrl}`);
        
      } else {
        result.status = 'already_migrated';
        result.gcsUrl = banner.imageUrl;
        console.log(`⏭️  로컬 또는 기타 형식 (ID: ${banner.id}): ${banner.imageUrl}`);
      }
      
      results.push(result);
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`❌ 작은 배너 PRIVATE→PUBLIC 실패 (ID: ${banner.id}):`, error);
      results.push(result);
    }
  }
  
  return results;
}

/**
 * 🌐 PRIVATE → PUBLIC 배너 마이그레이션 API (HIPAA 문제 해결)
 */
router.post('/migrate-private-to-public', async (req, res) => {
  try {
    console.log('🌐 PRIVATE → PUBLIC 배너 마이그레이션 시작 (HIPAA 문제 해결)');
    
    // GCS 연결 테스트
    try {
      const gcsClient = initializeGCS();
      await gcsClient.bucket.getMetadata();
      console.log('✅ GCS 연결 확인됨');
    } catch (error) {
      console.error('❌ GCS 연결 실패:', error);
      return res.status(500).json({ 
        error: 'GCS 연결 실패', 
        message: error instanceof Error ? error.message : String(error)
      });
    }
    
    // PRIVATE → PUBLIC 마이그레이션 실행
    const results = await migratePrivateToPublicBanners();
    
    // 결과 요약
    const summary = results.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('✅ PRIVATE → PUBLIC 배너 마이그레이션 완료');
    
    // 검증 실행
    const slideCount = await db.select().from(banners);
    const publicSlideCount = slideCount.filter(b => 
      b.imageSrc.startsWith('https://storage.googleapis.com/createtree-upload/banners/')
    ).length;
    
    const smallCount = await db.select().from(smallBanners);  
    const publicSmallCount = smallCount.filter(b => 
      b.imageUrl.startsWith('https://storage.googleapis.com/createtree-upload/banners/')
    ).length;
    
    const response = {
      success: true,
      migration_type: 'private_to_public',
      summary: {
        total: results.length,
        success: summary.success || 0,
        already_migrated: summary.already_migrated || 0,
        file_not_found: summary.file_not_found || 0,
        error: summary.error || 0
      },
      details: results,
      verification: {
        slideBanners: `${publicSlideCount}/${slideCount.length} PUBLIC 저장`,
        smallBanners: `${publicSmallCount}/${smallCount.length} PUBLIC 저장`,
        allPublic: publicSlideCount === slideCount.length && publicSmallCount === smallCount.length
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ PRIVATE → PUBLIC 마이그레이션 중 오류 발생:', error);
    res.status(500).json({
      error: 'PRIVATE → PUBLIC 마이그레이션 실패',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 🔍 PRIVATE 배너 상태 확인 API (임시 - 인증 없음)
 */
router.get('/check-private-banners', async (req, res) => {
  try {
    // 현재 배너 상태 조회
    const slideCount = await db.select().from(banners);
    const smallCount = await db.select().from(smallBanners);
    
    const privateSlides = slideCount.filter(b => 
      b.imageSrc.includes('X-Goog-Algorithm') || 
      b.imageSrc.includes('Signature') ||
      b.imageSrc.includes('Expires')
    );
    
    const privateSmalls = smallCount.filter(b => 
      b.imageUrl.includes('X-Goog-Algorithm') || 
      b.imageUrl.includes('Signature') ||
      b.imageUrl.includes('Expires')
    );
    
    const publicSlides = slideCount.filter(b => 
      b.imageSrc.startsWith('https://storage.googleapis.com/createtree-upload/banners/')
    );
    
    const publicSmalls = smallCount.filter(b => 
      b.imageUrl.startsWith('https://storage.googleapis.com/createtree-upload/banners/')
    );
    
    res.json({
      slideBanners: {
        total: slideCount.length,
        privateCount: privateSlides.length,
        publicCount: publicSlides.length,
        privateBanners: privateSlides.map(b => ({ 
          id: b.id, 
          title: b.title, 
          imageSrc: b.imageSrc.substring(0, 100) + '...' 
        }))
      },
      smallBanners: {
        total: smallCount.length,
        privateCount: privateSmalls.length,
        publicCount: publicSmalls.length,
        privateBanners: privateSmalls.map(b => ({ 
          id: b.id, 
          title: b.title, 
          imageUrl: b.imageUrl.substring(0, 100) + '...' 
        }))
      },
      needsPrivateToPublicMigration: privateSlides.length > 0 || privateSmalls.length > 0,
      summary: {
        totalPrivate: privateSlides.length + privateSmalls.length,
        totalPublic: publicSlides.length + publicSmalls.length
      }
    });
    
  } catch (error) {
    console.error('PRIVATE 배너 상태 확인 오류:', error);
    res.status(500).json({
      error: 'PRIVATE 배너 상태 확인 실패',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;