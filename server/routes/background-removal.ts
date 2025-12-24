import { Router, Request, Response } from 'express';
import { removeImageBackground } from '../services/backgroundRemoval';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

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
