import { Router, Request, Response } from 'express';
import { 
  upscaleImage, 
  upscaleMultipleImages, 
  getCategoryUpscaleConfig,
  isUpscaleServiceAvailable,
  UPSCALE_FACTORS,
  type UpscaleRequest 
} from '../services/upscaleService';
import { db } from '../../db';
import { productCategories } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const available = isUpscaleServiceAvailable();
    
    res.json({
      success: true,
      data: {
        available,
        supportedFactors: available ? UPSCALE_FACTORS : [],
        projectId: available ? 'createtree' : null,
        region: 'us-central1',
        notes: available 
          ? '업스케일 서비스가 정상 작동 중입니다.' 
          : 'GOOGLE_UPSCALE_JSON_KEY 시크릿이 설정되지 않았습니다.'
      }
    });
  } catch (error: any) {
    console.error('❌ [Upscale API] 상태 확인 오류:', error);
    res.status(500).json({
      success: false,
      error: '상태 확인 중 오류가 발생했습니다.'
    });
  }
});

router.get('/config/:categorySlug', async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    
    const config = await getCategoryUpscaleConfig(categorySlug);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `카테고리를 찾을 수 없습니다: ${categorySlug}`
      });
    }
    
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    console.error('❌ [Upscale API] 설정 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '설정 조회 중 오류가 발생했습니다.'
    });
  }
});

router.post('/single', async (req: Request, res: Response) => {
  try {
    const { 
      imageUrl, 
      targetDpi, 
      physicalSizeCm, 
      maxFactor, 
      categorySlug 
    }: UpscaleRequest = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'imageUrl은 필수입니다.'
      });
    }
    
    if (!isUpscaleServiceAvailable()) {
      return res.status(503).json({
        success: false,
        error: '업스케일 서비스가 설정되지 않았습니다.'
      });
    }
    
    console.log(`📤 [Upscale API] 단일 업스케일 요청:`, { 
      categorySlug, 
      targetDpi, 
      physicalSizeCm 
    });
    
    const result = await upscaleImage({
      imageUrl,
      targetDpi,
      physicalSizeCm,
      maxFactor,
      categorySlug
    });
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || '업스케일 실패'
      });
    }
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error: any) {
    console.error('❌ [Upscale API] 단일 업스케일 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '업스케일 중 오류가 발생했습니다.'
    });
  }
});

router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { 
      images, 
      categorySlug 
    }: { 
      images: UpscaleRequest[]; 
      categorySlug?: string;
    } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'images 배열은 필수입니다.'
      });
    }
    
    if (!isUpscaleServiceAvailable()) {
      return res.status(503).json({
        success: false,
        error: '업스케일 서비스가 설정되지 않았습니다.'
      });
    }
    
    console.log(`📤 [Upscale API] 배치 업스케일 요청: ${images.length}개`);
    
    const requests = images.map(img => ({
      ...img,
      categorySlug: img.categorySlug || categorySlug
    }));
    
    const results = await upscaleMultipleImages(requests);
    
    const successCount = results.filter(r => r.success && !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failedCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: images.length,
          upscaled: successCount,
          skipped: skippedCount,
          failed: failedCount
        }
      }
    });
    
  } catch (error: any) {
    console.error('❌ [Upscale API] 배치 업스케일 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '배치 업스케일 중 오류가 발생했습니다.'
    });
  }
});

router.post('/calculate-factor', async (req: Request, res: Response) => {
  try {
    const { 
      originalWidth, 
      originalHeight, 
      physicalWidthCm, 
      physicalHeightCm, 
      targetDpi = 300 
    } = req.body;
    
    if (!originalWidth || !originalHeight || !physicalWidthCm || !physicalHeightCm) {
      return res.status(400).json({
        success: false,
        error: 'originalWidth, originalHeight, physicalWidthCm, physicalHeightCm는 필수입니다.'
      });
    }
    
    const requiredWidthPx = Math.ceil((physicalWidthCm / 2.54) * targetDpi);
    const requiredHeightPx = Math.ceil((physicalHeightCm / 2.54) * targetDpi);
    
    const requiredMaxPx = Math.max(requiredWidthPx, requiredHeightPx);
    const originalMaxPx = Math.max(originalWidth, originalHeight);
    
    let recommendedFactor: string | null = null;
    let needsUpscale = false;
    
    if (originalMaxPx < requiredMaxPx) {
      needsUpscale = true;
      const requiredScale = requiredMaxPx / originalMaxPx;
      
      if (requiredScale <= 2) recommendedFactor = 'x2';
      else if (requiredScale <= 3) recommendedFactor = 'x3';
      else recommendedFactor = 'x4';
    }
    
    const currentDpi = Math.round((originalMaxPx / (Math.max(physicalWidthCm, physicalHeightCm) / 2.54)));
    
    res.json({
      success: true,
      data: {
        originalResolution: { width: originalWidth, height: originalHeight },
        requiredResolution: { width: requiredWidthPx, height: requiredHeightPx },
        currentDpi,
        targetDpi,
        needsUpscale,
        recommendedFactor,
        message: needsUpscale 
          ? `현재 해상도(${currentDpi} DPI)가 목표(${targetDpi} DPI)보다 낮습니다. ${recommendedFactor} 업스케일을 권장합니다.`
          : `현재 해상도(${currentDpi} DPI)가 충분합니다.`
      }
    });
    
  } catch (error: any) {
    console.error('❌ [Upscale API] 배율 계산 오류:', error);
    res.status(500).json({
      success: false,
      error: '배율 계산 중 오류가 발생했습니다.'
    });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await db.query.productCategories.findMany({
      where: eq(productCategories.isActive, true),
      columns: {
        id: true,
        slug: true,
        name: true,
        upscaleEnabled: true,
        upscaleMaxFactor: true,
        upscaleTargetDpi: true,
        upscaleMode: true
      }
    });
    
    res.json({
      success: true,
      data: categories
    });
    
  } catch (error: any) {
    console.error('❌ [Upscale API] 카테고리 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '카테고리 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

const updateUpscaleSettingsSchema = z.object({
  upscaleEnabled: z.boolean().optional(),
  upscaleMaxFactor: z.enum(['x2', 'x3', 'x4']).optional(),
  upscaleTargetDpi: z.number().min(72).max(600).optional(),
  upscaleMode: z.enum(['auto', 'fixed']).optional()
});

router.get('/admin/categories', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const categories = await db.query.productCategories.findMany({
      columns: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        upscaleEnabled: true,
        upscaleMaxFactor: true,
        upscaleTargetDpi: true,
        upscaleMode: true
      },
      orderBy: (cat, { asc }) => [asc(cat.sortOrder)]
    });
    
    res.json({
      success: true,
      data: categories
    });
    
  } catch (error: any) {
    console.error('❌ [Upscale Admin API] 카테고리 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '카테고리 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

router.patch('/admin/categories/:categoryId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.categoryId, 10);
    
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 카테고리 ID입니다.'
      });
    }
    
    const validation = updateUpscaleSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: '유효성 검사 실패',
        details: validation.error.errors
      });
    }
    
    const existingCategory = await db.query.productCategories.findFirst({
      where: eq(productCategories.id, categoryId)
    });
    
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        error: '카테고리를 찾을 수 없습니다.'
      });
    }
    
    const { upscaleEnabled, upscaleMaxFactor, upscaleTargetDpi, upscaleMode } = validation.data;
    
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (upscaleEnabled !== undefined) updateData.upscaleEnabled = upscaleEnabled;
    if (upscaleMaxFactor !== undefined) updateData.upscaleMaxFactor = upscaleMaxFactor;
    if (upscaleTargetDpi !== undefined) updateData.upscaleTargetDpi = upscaleTargetDpi;
    if (upscaleMode !== undefined) updateData.upscaleMode = upscaleMode;
    
    const [updated] = await db.update(productCategories)
      .set(updateData)
      .where(eq(productCategories.id, categoryId))
      .returning();
    
    console.log(`✅ [Upscale Admin] 카테고리 ${categoryId} 업스케일 설정 업데이트:`, validation.data);
    
    res.json({
      success: true,
      data: {
        id: updated.id,
        slug: updated.slug,
        name: updated.name,
        upscaleEnabled: updated.upscaleEnabled,
        upscaleMaxFactor: updated.upscaleMaxFactor,
        upscaleTargetDpi: updated.upscaleTargetDpi,
        upscaleMode: updated.upscaleMode
      }
    });
    
  } catch (error: any) {
    console.error('❌ [Upscale Admin API] 설정 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      error: '설정 업데이트 중 오류가 발생했습니다.'
    });
  }
});

router.post('/admin/categories/bulk-update', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { updates }: { updates: Array<{ categoryId: number; settings: z.infer<typeof updateUpscaleSettingsSchema> }> } = req.body;
    
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'updates 배열은 필수입니다.'
      });
    }
    
    const results = [];
    
    for (const update of updates) {
      const validation = updateUpscaleSettingsSchema.safeParse(update.settings);
      if (!validation.success) {
        results.push({
          categoryId: update.categoryId,
          success: false,
          error: '유효성 검사 실패'
        });
        continue;
      }
      
      try {
        const updateData: any = {
          updatedAt: new Date()
        };
        
        const { upscaleEnabled, upscaleMaxFactor, upscaleTargetDpi, upscaleMode } = validation.data;
        
        if (upscaleEnabled !== undefined) updateData.upscaleEnabled = upscaleEnabled;
        if (upscaleMaxFactor !== undefined) updateData.upscaleMaxFactor = upscaleMaxFactor;
        if (upscaleTargetDpi !== undefined) updateData.upscaleTargetDpi = upscaleTargetDpi;
        if (upscaleMode !== undefined) updateData.upscaleMode = upscaleMode;
        
        await db.update(productCategories)
          .set(updateData)
          .where(eq(productCategories.id, update.categoryId));
        
        results.push({
          categoryId: update.categoryId,
          success: true
        });
      } catch (err) {
        results.push({
          categoryId: update.categoryId,
          success: false,
          error: '업데이트 실패'
        });
      }
    }
    
    console.log(`✅ [Upscale Admin] 일괄 업데이트 완료: ${results.filter(r => r.success).length}/${updates.length} 성공`);
    
    res.json({
      success: true,
      data: results
    });
    
  } catch (error: any) {
    console.error('❌ [Upscale Admin API] 일괄 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      error: '일괄 업데이트 중 오류가 발생했습니다.'
    });
  }
});

export default router;
