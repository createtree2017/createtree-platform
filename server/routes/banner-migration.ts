import express from 'express';
import { db } from '../../db/index.js';
import { banners, smallBanners } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { requireAdminOrSuperAdmin } from '../middleware/auth';
import { saveBannerToGCS } from '../utils/gcs-image-storage.js';

const router = express.Router();

interface MigrationResult {
  id: number;
  table: 'banners' | 'small_banners';
  originalPath: string;
  gcsUrl?: string;
  status: 'success' | 'file_not_found' | 'already_public' | 'error';
  error?: string;
}

/**
 * Download PRIVATE GCS image and re-upload as PUBLIC using saveBannerToGCS()
 */
async function migratePrivateToPublic(
  privateUrl: string,
  bannerType: 'slide' | 'small'
): Promise<string> {
  console.log(`🔄 PRIVATE → PUBLIC 마이그레이션: ${privateUrl}`);

  // Download the private image
  const response = await fetch(privateUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Create mock file object for saveBannerToGCS
  const mockFile = {
    buffer,
    originalname: `migrated_${Date.now()}.webp`,
    mimetype: 'image/webp'
  };

  // Use existing saveBannerToGCS function
  const result = await saveBannerToGCS(mockFile as any, bannerType);

  console.log(`✅ 마이그레이션 완료: ${result.publicUrl}`);
  return result.publicUrl;
}

/**
 * 슬라이드 배너 PRIVATE→PUBLIC 마이그레이션
 */
async function migrateSlideBanners(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  console.log('\n🎭 슬라이드 배너 PRIVATE→PUBLIC 마이그레이션 시작...');

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
      // Skip already PUBLIC URLs (no signed query params)
      if (banner.imageSrc.startsWith('https://storage.googleapis.com') &&
        !banner.imageSrc.includes('X-Goog-Signature')) {
        result.status = 'already_public';
        result.gcsUrl = banner.imageSrc;
        console.log(`⏭️ 이미 PUBLIC (ID: ${banner.id}): ${banner.imageSrc}`);
        results.push(result);
        continue;
      }

      // Migrate PRIVATE GCS URLs (with X-Goog-Signature) to PUBLIC
      if (banner.imageSrc.includes('X-Goog-Signature')) {
        console.log(`🔄 PRIVATE GCS → PUBLIC 마이그레이션 (ID: ${banner.id})`);

        const publicUrl = await migratePrivateToPublic(banner.imageSrc, 'slide');

        // 데이터베이스 업데이트
        await db.update(banners)
          .set({
            imageSrc: publicUrl,
            updatedAt: new Date()
          })
          .where(eq(banners.id, banner.id));

        result.status = 'success';
        result.gcsUrl = publicUrl;
        console.log(`✅ PRIVATE→PUBLIC 성공 (ID: ${banner.id}): ${publicUrl}`);
      }
      else {
        result.status = 'error';
        result.error = '지원되지 않는 경로 형식';
        console.log(`⚠️ 지원되지 않는 경로 (ID: ${banner.id}): ${banner.imageSrc}`);
      }

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
 * 작은 배너 PRIVATE→PUBLIC 마이그레이션
 */
async function migrateSmallBanners(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  console.log('\n📱 작은 배너 PRIVATE→PUBLIC 마이그레이션 시작...');

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
      // Skip already PUBLIC URLs (no signed query params)
      if (banner.imageUrl.startsWith('https://storage.googleapis.com') &&
        !banner.imageUrl.includes('X-Goog-Signature')) {
        result.status = 'already_public';
        result.gcsUrl = banner.imageUrl;
        console.log(`⏭️ 이미 PUBLIC (ID: ${banner.id}): ${banner.imageUrl}`);
        results.push(result);
        continue;
      }

      // Migrate PRIVATE GCS URLs (with X-Goog-Signature) to PUBLIC
      if (banner.imageUrl.includes('X-Goog-Signature')) {
        console.log(`🔄 PRIVATE GCS → PUBLIC 마이그레이션 (ID: ${banner.id})`);

        const publicUrl = await migratePrivateToPublic(banner.imageUrl, 'small');

        // 데이터베이스 업데이트
        await db.update(smallBanners)
          .set({
            imageUrl: publicUrl,
            updatedAt: new Date()
          })
          .where(eq(smallBanners.id, banner.id));

        result.status = 'success';
        result.gcsUrl = publicUrl;
        console.log(`✅ PRIVATE→PUBLIC 성공 (ID: ${banner.id}): ${publicUrl}`);
      }
      else {
        result.status = 'error';
        result.error = '지원되지 않는 경로 형식';
        console.log(`⚠️ 지원되지 않는 경로 (ID: ${banner.id}): ${banner.imageUrl}`);
      }

      results.push(result);

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`❌ 작은 배너 마이그레이션 실패 (ID: ${banner.id}):`, error);
      results.push(result);
    }
  }

  return results;
}

// 🔍 PRIVATE 배너 상태 확인 API
router.get('/check-private-banners', async (req, res) => {
  try {
    console.log('🔍 PRIVATE 배너 검사 시작...');

    // 슬라이드 배너 검사
    const slideBannersData = await db.select().from(banners);
    const slidePrivate = slideBannersData.filter(b => b.imageSrc.includes('X-Goog-Signature'));
    const slidePublic = slideBannersData.filter(b =>
      b.imageSrc.startsWith('https://storage.googleapis.com') &&
      !b.imageSrc.includes('X-Goog-Signature')
    );

    // 작은 배너 검사
    const smallBannersData = await db.select().from(smallBanners);
    const smallPrivate = smallBannersData.filter(b => b.imageUrl.includes('X-Goog-Signature'));
    const smallPublic = smallBannersData.filter(b =>
      b.imageUrl.startsWith('https://storage.googleapis.com') &&
      !b.imageUrl.includes('X-Goog-Signature')
    );

    const result = {
      slideBanners: {
        total: slideBannersData.length,
        privateCount: slidePrivate.length,
        publicCount: slidePublic.length,
        privateBanners: slidePrivate.map(b => ({
          id: b.id,
          title: b.title,
          imageSrc: b.imageSrc.substring(0, 100) + '...'
        }))
      },
      smallBanners: {
        total: smallBannersData.length,
        privateCount: smallPrivate.length,
        publicCount: smallPublic.length,
        privateBanners: smallPrivate.map(b => ({
          id: b.id,
          title: b.title,
          imageUrl: b.imageUrl.substring(0, 100) + '...'
        }))
      },
      needsPrivateToPublicMigration: slidePrivate.length > 0 || smallPrivate.length > 0,
      summary: {
        totalPrivate: slidePrivate.length + smallPrivate.length,
        totalPublic: slidePublic.length + smallPublic.length
      }
    };

    console.log('📊 검사 완료:', result.summary);
    res.json(result);

  } catch (error) {
    console.error('❌ PRIVATE 배너 검사 실패:', error);
    res.status(500).json({
      error: 'PRIVATE 배너 검사 실패',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// 🌐 PRIVATE → PUBLIC 마이그레이션 실행 API
router.post('/migrate-private-to-public', async (req, res) => {
  try {
    console.log('🌐 PRIVATE → PUBLIC 배너 마이그레이션 시작');

    // 슬라이드 배너 마이그레이션
    const slideResults = await migrateSlideBanners();

    // 작은 배너 마이그레이션
    const smallResults = await migrateSmallBanners();

    const allResults = [...slideResults, ...smallResults];
    const successCount = allResults.filter(r => r.status === 'success').length;
    const errorCount = allResults.filter(r => r.status === 'error').length;

    console.log(`✅ 마이그레이션 완료: 성공 ${successCount}개, 실패 ${errorCount}개`);

    res.json({
      success: true,
      message: `PRIVATE → PUBLIC 마이그레이션 완료`,
      results: allResults,
      summary: {
        total: allResults.length,
        success: successCount,
        errors: errorCount,
        alreadyPublic: allResults.filter(r => r.status === 'already_public').length
      }
    });

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    res.status(500).json({
      error: 'GCS 연결 실패',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;