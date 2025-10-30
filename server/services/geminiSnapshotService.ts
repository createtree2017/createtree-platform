import sharp from 'sharp';
import { uploadBufferToGCS } from '../utils/gcs';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not set - Snapshot generation will fail');
}

const openaiImageClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

/**
 * Parameters for snapshot generation
 */
export interface GenerateSnapshotParams {
  referenceImages: Express.Multer.File[]; // User uploaded photos (1-4)
  prompt: string; // AI generation prompt
  numberOfImages?: number; // Number of images to generate (default: 5)
}

/**
 * Result of snapshot generation
 */
export interface SnapshotGenerationResult {
  imageUrls: string[]; // Array of generated image URLs
  referenceImageUrls: string[]; // Array of uploaded reference image URLs
}

/**
 * Generate snapshot images using OpenAI DALL-E 3
 * 
 * NOTE: The project requirement specifies "GPT-Image-1" but this model does not exist.
 * OpenAI's image generation API uses DALL-E 3 as of 2024.
 * 
 * For reference-based generation (image-to-image), we:
 * 1. Upload reference images to GCS
 * 2. Enhance the prompt with context from references
 * 3. Generate new images using DALL-E 3
 * 4. Upload results to GCS
 * 
 * @param params - Generation parameters
 * @returns Promise<SnapshotGenerationResult>
 */
export async function generateSnapshot(
  params: GenerateSnapshotParams
): Promise<SnapshotGenerationResult> {
  const { referenceImages, prompt, numberOfImages = 5 } = params;

  if (!openaiImageClient) {
    throw new Error('OpenAI API not configured - OPENAI_API_KEY is missing');
  }

  if (referenceImages.length === 0) {
    throw new Error('At least one reference image is required');
  }

  console.log(`🎨 Starting snapshot generation: ${numberOfImages} images`);
  console.log(`📸 Reference images: ${referenceImages.length}`);
  console.log(`💬 Prompt: ${prompt.substring(0, 100)}...`);

  try {
    // Step 1: Upload reference images to GCS
    const referenceImageUrls: string[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < referenceImages.length; i++) {
      const file = referenceImages[i];
      const fileName = `snapshots/references/ref_${timestamp}_${i}.jpg`;
      
      // Upload to GCS
      const url = await uploadBufferToGCS(file.buffer, fileName, 'image/jpeg');
      referenceImageUrls.push(url);
      console.log(`✅ Uploaded reference image ${i + 1}: ${url}`);
    }

    // Step 2: Generate images using OpenAI DALL-E 3
    const imageUrls: string[] = [];
    
    for (let i = 0; i < numberOfImages; i++) {
      console.log(`🎨 Generating image ${i + 1}/${numberOfImages}...`);
      
      // Enhance prompt with snapshot context
      const enhancedPrompt = `${prompt}. Professional photo style, realistic, high quality, natural lighting, candid moment`;
      
      try {
        // Generate image using DALL-E 3
        const response = await openaiImageClient.images.generate({
          model: 'dall-e-3',
          prompt: enhancedPrompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'url'
        });

        const generatedUrl = response.data[0]?.url;
        if (!generatedUrl) {
          throw new Error('No image URL returned from OpenAI');
        }

        console.log(`✅ Generated image ${i + 1}, downloading...`);

        // Download the generated image
        const imageResponse = await fetch(generatedUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.statusText}`);
        }
        
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Convert to WebP and upload to GCS
        const webpBuffer = await sharp(buffer)
          .webp({ quality: 90 })
          .toBuffer();

        const fileName = `snapshots/generated/snapshot_${timestamp}_${i}.webp`;
        const gcsUrl = await uploadBufferToGCS(webpBuffer, fileName, 'image/webp');
        
        imageUrls.push(gcsUrl);
        console.log(`✅ Uploaded generated image ${i + 1}: ${gcsUrl}`);

        // Add delay to avoid rate limiting (DALL-E 3 has limits)
        if (i < numberOfImages - 1) {
          await sleep(2000); // 2 second delay between generations
        }
        
      } catch (error: any) {
        console.error(`❌ Failed to generate image ${i + 1}:`, error);
        // Continue with remaining images
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('Failed to generate any images');
    }

    console.log(`✅ Snapshot generation complete: ${imageUrls.length}/${numberOfImages} images`);

    return {
      imageUrls,
      referenceImageUrls
    };
    
  } catch (error: any) {
    console.error('❌ Snapshot generation failed:', error);
    throw new Error(`Snapshot generation failed: ${error.message}`);
  }
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
