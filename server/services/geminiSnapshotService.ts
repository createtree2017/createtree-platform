import sharp from 'sharp';
import { saveImageToGCS } from '../utils/gcs-image-storage';
import { transformWithGemini } from './gemini';
import fs from 'fs';
import path from 'path';

/**
 * Parameters for snapshot generation
 */
export interface GenerateSnapshotParams {
  referenceImages: Express.Multer.File[]; // User uploaded photos (1-4)
  prompts: string[]; // Array of AI generation prompts (one per image)
  numberOfImages?: number; // Number of images to generate (default: 5)
  userId: string | number; // User ID for GCS path organization
}

/**
 * Result of snapshot generation
 */
export interface SnapshotGenerationResult {
  imageUrls: string[]; // Array of generated image URLs (GCS)
  thumbnailUrls: string[]; // Array of thumbnail URLs (GCS)
  referenceImageUrls: string[]; // Array of reference image URLs
}

/**
 * Generate snapshot images using Gemini 2.5 Flash Image Preview
 * 
 * This service integrates with the existing Gemini image generation system
 * using the transformWithGemini function from server/services/gemini.ts
 * 
 * Flow:
 * 1. Takes 1-4 reference images from user
 * 2. Generates 5 images using 5 different prompts (weighted random selection)
 * 3. Each generation uses a reference image (cycling through if multiple)
 * 4. Uploads results to GCS (or local fallback)
 * 5. Returns public URLs
 * 
 * @param params - Generation parameters
 * @returns Promise<SnapshotGenerationResult>
 */
export async function generateSnapshot(
  params: GenerateSnapshotParams
): Promise<SnapshotGenerationResult> {
  const { referenceImages, prompts, numberOfImages = 5, userId } = params;

  if (referenceImages.length === 0) {
    throw new Error('At least one reference image is required');
  }

  if (prompts.length !== numberOfImages) {
    throw new Error(`Number of prompts (${prompts.length}) must match numberOfImages (${numberOfImages})`);
  }

  console.log(`🎨 [Snapshot] Starting generation: ${numberOfImages} images`);
  console.log(`📸 [Snapshot] Reference images: ${referenceImages.length}`);
  console.log(`💬 [Snapshot] Prompts: ${prompts.length}`);
  console.log(`👤 [Snapshot] User ID: ${userId}`);

  const imageUrls: string[] = [];
  const thumbnailUrls: string[] = [];
  const referenceImageUrls: string[] = [];
  const timestamp = Date.now();

  try {
    // Upload reference images to GCS using standard path structure
    // Path: images/snapshot/0/0/0/{userId}/reference_{timestamp}_{i}.webp
    for (let i = 0; i < referenceImages.length; i++) {
      const refFileName = `reference_${timestamp}_${i}.jpg`;
      const refResult = await saveImageToGCS(
        referenceImages[i].buffer,
        userId,
        'snapshot', // category
        refFileName
      );
      referenceImageUrls.push(refResult.originalUrl);
      console.log(`✅ [Snapshot] Uploaded reference image ${i + 1}: ${refResult.originalUrl}`);
    }

    // Generate images sequentially (to avoid rate limits)
    for (let i = 0; i < numberOfImages; i++) {
      console.log(`🎨 [Snapshot] Generating image ${i + 1}/${numberOfImages}...`);
      console.log(`💬 [Snapshot] Using prompt: ${prompts[i].substring(0, 100)}...`);
      
      // Select reference image (cycle through if multiple)
      const refImageIndex = i % referenceImages.length;
      const referenceImage = referenceImages[refImageIndex];
      
      console.log(`📷 [Snapshot] Using reference image ${refImageIndex + 1}/${referenceImages.length}`);

      // Retry logic for robustness
      let retries = 0;
      const maxRetries = 3;
      let generatedImageUrl: string | null = null;

      while (retries < maxRetries) {
        try {
          // Call Gemini 2.5 Flash Image Preview via transformWithGemini
          // This function handles:
          // - Image-to-image transformation
          // - Gemini API calls
          // - Local file storage
          const localImageUrl = await transformWithGemini(
            prompts[i], // template (각 이미지마다 다른 프롬프트)
            undefined, // systemPrompt (없음)
            referenceImage.buffer, // imageBuffer (참조 이미지)
            {} // variables (없음)
          );

          console.log(`✅ [Snapshot] Gemini generated image ${i + 1}: ${localImageUrl}`);

          // transformWithGemini returns local path like "/uploads/full/2025/10/30/uuid.webp"
          // Read the local file and upload to GCS using standard path structure
          // Remove leading slash for correct path joining
          const relativePath = localImageUrl.startsWith('/') ? localImageUrl.slice(1) : localImageUrl;
          const localFilePath = path.join(process.cwd(), 'public', relativePath);
          
          console.log(`📁 [Snapshot] Looking for file at: ${localFilePath}`);
          
          if (fs.existsSync(localFilePath)) {
            const imageBuffer = fs.readFileSync(localFilePath);
            
            // Upload to GCS using saveImageToGCS (auto-generates thumbnails)
            // Path: images/snapshot/0/0/0/{userId}/snapshot_{timestamp}_{i}.webp
            const fileName = `snapshot_${timestamp}_${i}.webp`;
            const gcsResult = await saveImageToGCS(
              imageBuffer,
              userId,
              'snapshot', // category
              fileName
            );
            
            generatedImageUrl = gcsResult.originalUrl;
            const thumbnailUrl = gcsResult.thumbnailUrl;
            
            console.log(`✅ [Snapshot] Uploaded to GCS: ${gcsResult.originalUrl}`);
            console.log(`✅ [Snapshot] Thumbnail created: ${gcsResult.thumbnailUrl}`);
            
            // Store thumbnail URL for database
            thumbnailUrls.push(thumbnailUrl);
            
            // Clean up local file
            try {
              fs.unlinkSync(localFilePath);
              console.log(`🗑️ [Snapshot] Cleaned up local file: ${localFilePath}`);
            } catch (cleanupError) {
              console.warn(`⚠️ [Snapshot] Failed to cleanup local file: ${cleanupError}`);
            }
          } else {
            // If local file doesn't exist, this is an error
            const errorMsg = `Local file not found at path: ${localFilePath}`;
            console.error(`❌ [Snapshot] ${errorMsg}`);
            throw new Error(errorMsg);
          }

          break; // Success, exit retry loop

        } catch (error: any) {
          retries++;
          console.error(`❌ [Snapshot] Generation attempt ${retries} failed:`, error.message);
          
          if (retries >= maxRetries) {
            console.error(`❌ [Snapshot] Failed to generate image ${i + 1} after ${maxRetries} retries`);
            throw error;
          }
          
          // Exponential backoff
          const backoffMs = 2000 * Math.pow(2, retries - 1);
          console.log(`⏳ [Snapshot] Retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
        }
      }

      if (generatedImageUrl) {
        imageUrls.push(generatedImageUrl);
        console.log(`✅ [Snapshot] Image ${i + 1}/${numberOfImages} complete: ${generatedImageUrl}`);
      }

      // Add delay between generations to avoid rate limiting
      if (i < numberOfImages - 1) {
        console.log(`⏳ [Snapshot] Waiting 1s before next generation...`);
        await sleep(1000);
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('Failed to generate any images');
    }

    console.log(`✅ [Snapshot] Generation complete: ${imageUrls.length}/${numberOfImages} images`);

    return {
      imageUrls,
      thumbnailUrls,
      referenceImageUrls
    };
    
  } catch (error: any) {
    console.error('❌ [Snapshot] Generation failed:', error);
    throw new Error(`Snapshot generation failed: ${error.message}`);
  }
}

/**
 * Sleep helper for rate limiting and retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
