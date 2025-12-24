import { removeBackground } from '@imgly/background-removal-node';
import { saveFileToGCS } from '../utils/gcs-image-storage';

export interface BackgroundRemovalResult {
  url: string;
  gsPath: string;
  fileName: string;
}

export async function removeImageBackground(
  imageUrl: string,
  userId: number | string
): Promise<BackgroundRemovalResult> {
  console.log(`🔧 [Background Removal] Starting for user ${userId}: ${imageUrl}`);
  
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`📥 [Background Removal] Downloaded image: ${imageBuffer.length} bytes`);
    
    const blob = await removeBackground(imageBuffer, {
      output: {
        format: 'image/png',
        quality: 1.0,
      },
    });
    
    const resultBuffer = Buffer.from(await blob.arrayBuffer());
    console.log(`✅ [Background Removal] Processed: ${resultBuffer.length} bytes`);
    
    const timestamp = Date.now();
    const fileName = `${timestamp}_nobg.png`;
    
    const gcsResult = await saveFileToGCS(
      resultBuffer,
      userId,
      'background-removed',
      fileName,
      'image/png'
    );
    
    console.log(`📤 [Background Removal] Uploaded to GCS: ${gcsResult.originalUrl}`);
    
    return {
      url: gcsResult.originalUrl,
      gsPath: gcsResult.gsPath,
      fileName: gcsResult.fileName,
    };
    
  } catch (error) {
    console.error('❌ [Background Removal] Error:', error);
    throw new Error(`Background removal failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
