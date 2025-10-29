/**
 * AI Snapshot Generation Routes
 * 
 * PRIVACY & SECURITY MODEL:
 * =========================
 * 
 * This module implements a two-tier privacy approach for snapshot image generation:
 * 
 * 1. USER REFERENCE PHOTOS (PRIVATE):
 *    - User-uploaded reference photos are stored as PRIVATE GCS objects
 *    - No public URLs are generated - files remain world-unreadable
 *    - GCS paths stored in database for audit trail and cleanup only
 *    - Gemini API receives image buffers directly (in-memory), not file URLs
 *    - Files are automatically deleted after generation completes
 *    - SECURITY: No makePublic() calls to prevent privacy violations
 * 
 * 2. GENERATED SNAPSHOT IMAGES (PUBLIC):
 *    - AI-generated images ARE made public for user access and sharing
 *    - These are artistic results, not the original user photos
 *    - Public access enables viewing, downloading, and sharing
 *    - Suitable for display in galleries and social sharing
 * 
 * DATABASE FIELDS:
 * - snapshotGenerations.uploadedImageUrls: Stores GCS paths (not URLs) for reference photos
 *   Note: Field name says "Urls" but contains private GCS paths for historical reasons
 * - snapshotGenerationImages.originalUrl: Stores public URLs for generated images
 * 
 * GEMINI INTEGRATION:
 * - Gemini API receives image buffers directly via in-memory transfer
 * - No signed URLs needed since Gemini never accesses GCS directly
 * - Reference photos never need public URLs or signed URLs
 * 
 * CLEANUP:
 * - Temp reference photos deleted automatically after generation (see cleanupTempFiles)
 * - Generated images persist permanently for user access
 */

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { 
  generateSnapshotImages,
  GeminiTimeoutError,
  GeminiRateLimitError,
  GeminiValidationError,
  GeminiQuotaError
} from '../services/geminiSnapshotService';
import { 
  getRandomSnapshotPrompt,
  SnapshotPromptNotFoundError 
} from '../services/snapshotPromptService';
import { bucket } from '../firebase';
import { db } from '@db';
import { snapshotGenerations, snapshotGenerationImages } from '@shared/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import sharp from 'sharp';

/**
 * Multer configuration for snapshot image uploads
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 4
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

/**
 * Request validation schema
 */
const snapshotGenerateSchema = z.object({
  mode: z.enum(['individual', 'couple', 'family'], {
    errorMap: () => ({ message: 'Mode must be individual, couple, or family' })
  }),
  style: z.enum(['mix', 'daily', 'travel', 'film'], {
    errorMap: () => ({ message: 'Style must be mix, daily, travel, or film' })
  }),
  gender: z.enum(['female', 'male', 'unisex']).optional()
});

/**
 * Upload temp user images to GCS
 * 
 * PRIVACY MODEL - USER REFERENCE PHOTOS:
 * ========================================
 * - User-uploaded reference photos are stored as PRIVATE files (not world-readable)
 * - Files are kept private to protect user privacy - no public URLs are generated
 * - GCS paths are stored in DB for audit trail and cleanup purposes only
 * - Gemini API receives image buffers directly (not URLs), so no public access needed
 * - Files are automatically deleted after generation completes (see cleanupTempFiles)
 * 
 * SECURITY: This function does NOT call makePublic() to prevent privacy violations
 */
async function uploadTempUserImages(
  files: Express.Multer.File[],
  userId: number,
  generationId: number
): Promise<string[]> {
  console.log(`📤 [Snapshot Upload] Uploading ${files.length} temp user images (PRIVATE)`);

  const uploadPromises = files.map(async (file, index) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const fileName = `user_${index}${ext}`;
    const gcsPath = `snapshots/${userId}/temp/${generationId}/${fileName}`;

    const gcsFile = bucket.file(gcsPath);
    
    // SECURITY FIX: Store files as PRIVATE (not publicly accessible)
    // ACL is set to private by default - do NOT call makePublic()
    await gcsFile.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        cacheControl: 'private, max-age=3600'
      }
    });

    // SECURITY: Return GCS path (not public URL) for database record-keeping
    // Note: Gemini API receives image buffers directly, not these paths
    console.log(`✅ [Snapshot Upload] Uploaded PRIVATE temp image ${index + 1}: ${gcsPath}`);

    return gcsPath;
  });

  return Promise.all(uploadPromises);
}

/**
 * Upload generated images to permanent GCS location
 * 
 * PRIVACY MODEL - GENERATED SNAPSHOT IMAGES:
 * ==========================================
 * - Generated snapshot images ARE made public for user accessibility and sharing
 * - These are AI-generated artistic results, not the original user reference photos
 * - Public access allows users to view, download, and share their generated images
 * - Long cache duration (1 year) optimizes performance for repeated access
 * - Original user reference photos remain PRIVATE (see uploadTempUserImages)
 * 
 * RATIONALE: Generated images are the final product meant to be displayed in galleries,
 * shared with family/friends, and downloaded by users. Making them public simplifies
 * distribution and improves user experience.
 */
async function uploadGeneratedImages(
  imageDataUrls: string[],
  userId: number,
  generationId: number
): Promise<string[]> {
  console.log(`📤 [Snapshot Upload] Uploading ${imageDataUrls.length} generated images (PUBLIC)`);

  const uploadPromises = imageDataUrls.map(async (dataUrl, index) => {
    const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const optimizedBuffer = await sharp(imageBuffer)
      .webp({ quality: 90 })
      .toBuffer();

    const timestamp = Date.now();
    const fileName = `${timestamp}_${index}.webp`;
    const gcsPath = `snapshots/${userId}/${generationId}/${fileName}`;

    const gcsFile = bucket.file(gcsPath);
    await gcsFile.save(optimizedBuffer, {
      metadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000',
        metadata: {
          generationId: String(generationId),
          imageIndex: String(index),
          createdAt: new Date().toISOString()
        }
      }
    });

    // Generated images are made PUBLIC for user access and sharing
    await gcsFile.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${gcsPath}`;
    console.log(`✅ [Snapshot Upload] Uploaded PUBLIC generated image ${index + 1}: ${gcsPath}`);

    return publicUrl;
  });

  return Promise.all(uploadPromises);
}

/**
 * Cleanup temp files in GCS
 */
async function cleanupTempFiles(userId: number, generationId: number): Promise<void> {
  try {
    const prefix = `snapshots/${userId}/temp/${generationId}/`;
    const [files] = await bucket.getFiles({ prefix });

    if (files.length === 0) {
      console.log(`📁 [Snapshot Cleanup] No temp files to delete`);
      return;
    }

    await Promise.all(files.map(file => file.delete()));
    console.log(`🗑️ [Snapshot Cleanup] Deleted ${files.length} temp files`);
  } catch (error) {
    console.error(`⚠️ [Snapshot Cleanup] Failed to cleanup temp files:`, error);
  }
}

/**
 * Get error message helper
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Register snapshot routes
 */
export function registerSnapshotRoutes(app: Express): void {
  
  /**
   * POST /api/snapshot/generate
   * Generate AI snapshot images
   */
  app.post(
    '/api/snapshot/generate',
    requireAuth,
    upload.array('images', 4),
    async (req: Request, res: Response) => {
      const userId = req.user?.id;
      let generationId: number | null = null;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required'
        });
      }

      try {
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'At least 1 image is required'
          });
        }

        if (files.length > 4) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Maximum 4 images allowed'
          });
        }

        const validatedBody = snapshotGenerateSchema.parse(req.body);
        const { mode, style, gender } = validatedBody;

        console.log(`🚀 [Snapshot API] Starting generation:`, {
          userId,
          mode,
          style,
          gender,
          imageCount: files.length
        });

        let tempUrls: string[] = [];
        let selectedPrompt;

        try {
          selectedPrompt = await getRandomSnapshotPrompt({
            mode,
            style,
            gender
          });

          console.log(`📝 [Snapshot API] Selected prompt:`, {
            promptId: selectedPrompt.id,
            text: selectedPrompt.text.substring(0, 100) + '...'
          });

          const [generation] = await db.insert(snapshotGenerations).values({
            userId,
            mode,
            style,
            promptId: selectedPrompt.id,
            promptText: selectedPrompt.text,
            uploadedImageCount: files.length,
            uploadedImageUrls: [],
            status: 'pending'
          }).returning();

          generationId = generation.id;
          console.log(`💾 [Snapshot API] Created generation record: ${generationId}`);

          tempUrls = await uploadTempUserImages(files, userId, generationId);

          await db.update(snapshotGenerations)
            .set({ 
              uploadedImageUrls: tempUrls,
              status: 'processing',
              updatedAt: new Date()
            })
            .where(eq(snapshotGenerations.id, generationId));

          console.log(`📤 [Snapshot API] Uploaded temp images, calling Gemini...`);

          const fileBuffers = files.map(f => f.buffer);
          const startTime = Date.now();

          const { images, generationTimeMs } = await generateSnapshotImages({
            prompt: selectedPrompt.text,
            userImages: fileBuffers,
            count: 5
          });

          console.log(`🎨 [Snapshot API] Gemini generation complete: ${images.length} images`);

          const permanentUrls = await uploadGeneratedImages(images, userId, generationId);

          await db.transaction(async (tx) => {
            await tx.update(snapshotGenerations)
              .set({
                status: 'completed',
                completedAt: new Date(),
                generatedImageCount: permanentUrls.length,
                processingTimeMs: generationTimeMs,
                updatedAt: new Date()
              })
              .where(eq(snapshotGenerations.id, generationId));

            await tx.insert(snapshotGenerationImages).values(
              permanentUrls.map((url, i) => ({
                generationId: generationId!,
                imageIndex: i,
                originalUrl: url,
                gcsPath: url.replace(`https://storage.googleapis.com/${bucket.name}/`, '')
              }))
            );
          });

          console.log(`✅ [Snapshot API] Generation complete: ${generationId}`);

          return res.status(201).json({
            generationId,
            status: 'completed',
            previewUrls: permanentUrls,
            mode,
            style
          });

        } catch (error) {
          console.error(`❌ [Snapshot API] Generation failed:`, error);

          if (generationId) {
            await db.update(snapshotGenerations)
              .set({
                status: 'failed',
                errorMessage: getErrorMessage(error),
                updatedAt: new Date()
              })
              .where(eq(snapshotGenerations.id, generationId))
              .catch(dbError => {
                console.error(`⚠️ [Snapshot API] Failed to update error status:`, dbError);
              });
          }

          if (error instanceof SnapshotPromptNotFoundError) {
            return res.status(404).json({
              error: 'Prompt Not Found',
              message: error.message
            });
          }

          if (error instanceof GeminiValidationError) {
            return res.status(400).json({
              error: 'Validation Error',
              message: error.message
            });
          }

          if (error instanceof GeminiTimeoutError || error instanceof GeminiRateLimitError) {
            return res.status(503).json({
              error: 'Service Unavailable',
              message: 'Image generation service is temporarily unavailable. Please try again later.'
            });
          }

          if (error instanceof GeminiQuotaError) {
            return res.status(429).json({
              error: 'Quota Exceeded',
              message: 'Generation quota exceeded. Please try again later.'
            });
          }

          if (error instanceof z.ZodError) {
            return res.status(400).json({
              error: 'Validation Error',
              message: 'Invalid request parameters',
              details: error.errors
            });
          }

          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to generate snapshot images'
          });
        } finally {
          if (generationId) {
            await cleanupTempFiles(userId, generationId);
          }
        }

      } catch (error) {
        console.error(`❌ [Snapshot API] Request failed:`, error);

        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid request parameters',
            details: error.errors
          });
        }

        if (error instanceof multer.MulterError) {
          if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              error: 'File Too Large',
              message: 'Each image must be less than 10MB'
            });
          }
          if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              error: 'Too Many Files',
              message: 'Maximum 4 images allowed'
            });
          }
        }

        return res.status(500).json({
          error: 'Internal Server Error',
          message: getErrorMessage(error)
        });
      }
    }
  );
}
