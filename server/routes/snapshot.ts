import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { selectWeightedPrompts, type SnapshotPromptWithStyle } from '../services/snapshotPromptService';
import { generateSnapshot } from '../services/geminiSnapshotService';
import { db } from '@db';
import { images } from '@shared/schema';
import { desc } from 'drizzle-orm';

const router = Router();

// Multer configuration for photo uploads (1-4 images)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 4 // Maximum 4 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * POST /api/snapshot/generate
 * Generate 5 snapshot images using AI
 * 
 * Body:
 * - mode: 'individual' | 'couple' | 'family'
 * - style: 'mix' | 'daily' | 'travel' | 'film'
 * - gender: 'male' | 'female' (optional)
 * - photos: File[] (1-4 images)
 */
router.post(
  '/generate',
  requireAuth,
  upload.array('photos', 4),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { mode, style, gender } = req.body;
      const photos = req.files as Express.Multer.File[];

      // Validation
      if (!mode || !['individual', 'couple', 'family'].includes(mode)) {
        return res.status(400).json({ 
          error: 'Invalid mode. Must be: individual, couple, or family' 
        });
      }

      if (!style || !['mix', 'daily', 'travel', 'film'].includes(style)) {
        return res.status(400).json({ 
          error: 'Invalid style. Must be: mix, daily, travel, or film' 
        });
      }

      if (!photos || photos.length === 0) {
        return res.status(400).json({ 
          error: 'At least one photo is required' 
        });
      }

      if (photos.length > 4) {
        return res.status(400).json({ 
          error: 'Maximum 4 photos allowed' 
        });
      }

      console.log(`🎨 Snapshot generation request:`, {
        userId,
        mode,
        style,
        gender,
        photoCount: photos.length
      });

      // Step 1: Select 5 weighted random prompts
      const selectedPrompts = await selectWeightedPrompts({
        category: mode as 'individual' | 'couple' | 'family',
        type: style as 'mix' | 'daily' | 'travel' | 'film',
        gender: gender || null,
        count: 5
      });

      console.log(`✅ Selected ${selectedPrompts.length} prompts`);

      // Step 2: Generate snapshot images using Gemini 2.5 Flash Image Preview
      // Each image uses a different prompt from weighted random selection
      const result = await generateSnapshot({
        referenceImages: photos,
        prompts: selectedPrompts.map(p => p.prompt), // Array of 5 different prompts
        numberOfImages: 5,
        userId: userId // Pass userId for GCS path organization
      });

      // Step 3: Save generated images to database
      // Use actualStyle instead of literal 'mix' for proper categorization
      const savedImages = [];
      for (let i = 0; i < result.imageUrls.length; i++) {
        const prompt = selectedPrompts[i];
        const actualStyle = prompt.actualStyle; // The real style used (e.g., 'daily' not 'mix')
        
        const [savedImage] = await db.insert(images).values({
          title: `Snapshot ${mode} - ${actualStyle}`,
          style: `snapshot-${actualStyle}`,
          originalUrl: result.referenceImageUrls[0] || '', // First reference image
          transformedUrl: result.imageUrls[i],
          thumbnailUrl: result.imageUrls[i],
          userId: String(userId),
          categoryId: 'snapshot',
          conceptId: mode,
          styleId: actualStyle, // Store actual style, not 'mix'
          metadata: JSON.stringify({
            mode,
            style: actualStyle, // For backward compatibility with history
            userSelectedStyle: style, // What user selected ('mix' or specific)
            actualStyle, // What was actually used ('daily', 'travel', or 'film')
            gender,
            promptId: prompt.id,
            promptText: prompt.prompt.substring(0, 100)
          })
        }).returning();

        savedImages.push(savedImage);
      }

      console.log(`✅ Saved ${savedImages.length} images to database`);

      // Response
      return res.status(200).json({
        success: true,
        images: savedImages.map((img, idx) => ({
          id: img.id,
          url: img.transformedUrl,
          thumbnailUrl: img.thumbnailUrl,
          promptId: selectedPrompts[idx].id,
          createdAt: img.createdAt
        })),
        referenceImageUrls: result.referenceImageUrls
      });

    } catch (error: any) {
      console.error('❌ Snapshot generation error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Snapshot generation failed',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

/**
 * GET /api/snapshot/history
 * Get user's snapshot generation history
 * 
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - status: 'completed' | 'failed' (optional filter)
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Query snapshot images from database
    const snapshotImages = await db.query.images.findMany({
      where: (images, { eq, and }) => and(
        eq(images.userId, String(userId)),
        eq(images.categoryId, 'snapshot')
      ),
      orderBy: desc(images.createdAt),
      limit,
      offset
    });

    // Group images by generation session (using createdAt timestamp)
    // Images created within 1 minute are considered same generation
    const generations: any[] = [];
    let currentGeneration: any = null;

    for (const img of snapshotImages) {
      const metadata = JSON.parse(img.metadata || '{}');
      const timestamp = new Date(img.createdAt).getTime();

      if (!currentGeneration || timestamp - currentGeneration.timestamp > 60000) {
        // New generation
        currentGeneration = {
          timestamp,
          mode: metadata.mode || 'unknown',
          style: metadata.style || 'unknown',
          createdAt: img.createdAt,
          images: []
        };
        generations.push(currentGeneration);
      }

      currentGeneration.images.push({
        id: img.id,
        url: img.transformedUrl,
        thumbnailUrl: img.thumbnailUrl,
        promptId: metadata.promptId,
        createdAt: img.createdAt
      });
    }

    return res.status(200).json({
      success: true,
      generations,
      pagination: {
        page,
        limit,
        total: generations.length,
        hasMore: snapshotImages.length === limit
      }
    });

  } catch (error: any) {
    console.error('❌ Snapshot history error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch snapshot history',
      message: error.message
    });
  }
});

export default router;
