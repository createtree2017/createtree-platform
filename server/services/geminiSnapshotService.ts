import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY not set - Snapshot generation will fail');
}

const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

/**
 * Custom error classes for Gemini snapshot service
 */
export class GeminiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}

export class GeminiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiValidationError';
  }
}

export class GeminiQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiQuotaError';
  }
}

/**
 * Retry delays in milliseconds (exponential backoff)
 */
const RETRY_DELAYS = [1000, 2000, 4000];
const MAX_ATTEMPTS = 3;

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Determine if error should be retried
 */
function shouldRetry(error: any, attemptNumber: number): boolean {
  if (attemptNumber >= MAX_ATTEMPTS) {
    return false;
  }

  // Don't retry validation errors or quota exceeded
  if (error instanceof GeminiValidationError || error instanceof GeminiQuotaError) {
    return false;
  }

  // Retry on timeout, rate limit, or temporary failures
  if (
    error instanceof GeminiTimeoutError ||
    error instanceof GeminiRateLimitError ||
    error.message?.includes('DEADLINE_EXCEEDED') ||
    error.message?.includes('UNAVAILABLE') ||
    error.message?.includes('INTERNAL')
  ) {
    return true;
  }

  return false;
}

/**
 * Map error response to appropriate error class
 */
function mapErrorToClass(error: any): Error {
  const errorMessage = error.message || String(error);

  if (errorMessage.includes('DEADLINE_EXCEEDED') || errorMessage.includes('timeout')) {
    return new GeminiTimeoutError(errorMessage);
  }

  if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('rate limit')) {
    return new GeminiRateLimitError(errorMessage);
  }

  if (errorMessage.includes('INVALID_ARGUMENT') || errorMessage.includes('validation')) {
    return new GeminiValidationError(errorMessage);
  }

  if (errorMessage.includes('quota') || errorMessage.includes('QUOTA_EXCEEDED')) {
    return new GeminiQuotaError(errorMessage);
  }

  return error;
}

export interface GenerateSnapshotImagesInput {
  prompt: string;
  userImages: Buffer[] | string[];
  count?: number;
}

export interface GenerateSnapshotImagesOutput {
  images: string[];
  generationTimeMs: number;
}

/**
 * Generate snapshot images using Gemini 2.5 Flash image generation
 * 
 * @param input.prompt - Text prompt for image generation
 * @param input.userImages - Array of 1-4 user images (Buffer or base64 string)
 * @param input.count - Number of images to generate (default: 5)
 * @returns Array of generated image URLs or base64 data
 */
export async function generateSnapshotImages(
  input: GenerateSnapshotImagesInput
): Promise<GenerateSnapshotImagesOutput> {
  const { prompt, userImages, count = 5 } = input;

  if (!genAI) {
    throw new Error('Gemini API not initialized - GEMINI_API_KEY is missing');
  }

  if (!prompt || prompt.trim().length === 0) {
    throw new GeminiValidationError('Prompt cannot be empty');
  }

  if (!userImages || userImages.length === 0) {
    throw new GeminiValidationError('At least 1 user image is required');
  }

  if (userImages.length > 4) {
    throw new GeminiValidationError('Maximum 4 user images allowed');
  }

  if (count < 1 || count > 10) {
    throw new GeminiValidationError('Count must be between 1 and 10');
  }

  console.log(`🎨 [Gemini Snapshot] Starting generation:`, {
    promptLength: prompt.length,
    imageCount: userImages.length,
    requestedCount: count
  });

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`🔄 [Gemini Snapshot] Attempt ${attempt}/${MAX_ATTEMPTS}`);

      // Convert user images to inline data format
      const imageParts = userImages.map((img, index) => {
        let base64Data: string;
        let mimeType = 'image/jpeg';

        if (Buffer.isBuffer(img)) {
          base64Data = img.toString('base64');
        } else if (typeof img === 'string') {
          if (img.startsWith('data:')) {
            const matches = img.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              mimeType = matches[1];
              base64Data = matches[2];
            } else {
              base64Data = img.replace(/^data:[^;]+;base64,/, '');
            }
          } else {
            base64Data = img;
          }
        } else {
          throw new GeminiValidationError(`Invalid image format at index ${index}`);
        }

        return {
          inlineData: {
            mimeType,
            data: base64Data
          }
        };
      });

      // Generate images with Gemini 2.5 Flash
      const generatedImages: string[] = [];

      for (let i = 0; i < count; i++) {
        console.log(`📸 [Gemini Snapshot] Generating image ${i + 1}/${count}`);

        const response = await genAI.models.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              ...imageParts
            ]
          }],
          config: {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 1,
            topP: 0.95,
            maxOutputTokens: 8192
          }
        });

        // Extract generated image from response
        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || 'image/png';
              const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
              generatedImages.push(imageUrl);
              console.log(`✅ [Gemini Snapshot] Image ${i + 1} generated successfully`);
              break;
            }
          }
        }

        if (generatedImages.length !== i + 1) {
          throw new Error(`Failed to extract image ${i + 1} from Gemini response`);
        }
      }

      const generationTimeMs = Date.now() - startTime;
      console.log(`🎉 [Gemini Snapshot] Generation complete:`, {
        generatedCount: generatedImages.length,
        timeMs: generationTimeMs,
        attempts: attempt
      });

      return {
        images: generatedImages,
        generationTimeMs
      };

    } catch (error: any) {
      lastError = mapErrorToClass(error);
      console.error(`❌ [Gemini Snapshot] Attempt ${attempt} failed:`, lastError.message);

      if (shouldRetry(lastError, attempt)) {
        const delay = RETRY_DELAYS[attempt - 1];
        console.log(`⏳ [Gemini Snapshot] Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      } else {
        console.error(`🛑 [Gemini Snapshot] Non-retryable error or max attempts reached`);
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Generation failed after all retry attempts');
}
