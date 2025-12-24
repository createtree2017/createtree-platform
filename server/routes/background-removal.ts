import { Router, Request, Response } from 'express';
import { removeImageBackground } from '../services/backgroundRemoval';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const ALLOWED_DOMAINS = [
  'storage.googleapis.com',
  'storage.cloud.google.com',
];

const GCS_BUCKET_PATTERN = /^https:\/\/storage\.googleapis\.com\/createtree-upload\//;

function isAllowedUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }
    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
      return false;
    }
    if (!GCS_BUCKET_PATTERN.test(url)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const removeBackgroundSchema = z.object({
  imageUrl: z.string().url('Valid image URL is required'),
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validation = removeBackgroundSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0].message 
      });
    }

    const { imageUrl } = validation.data;
    
    if (!isAllowedUrl(imageUrl)) {
      console.warn(`⚠️ [API] Rejected background removal request with invalid URL: ${imageUrl}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid image URL. Only images from trusted storage are allowed.' 
      });
    }
    
    console.log(`🖼️ [API] Background removal request from user ${userId}: ${imageUrl}`);
    
    const result = await removeImageBackground(imageUrl, userId);
    
    return res.json({
      success: true,
      data: result,
    });
    
  } catch (error) {
    console.error('❌ [API] Background removal failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Background removal failed',
    });
  }
});

export default router;
