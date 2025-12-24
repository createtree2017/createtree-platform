import { removeBackground } from '@imgly/background-removal-node';
import { saveFileToGCS } from '../utils/gcs-image-storage';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface BackgroundRemovalResult {
  url: string;
  gsPath: string;
  fileName: string;
}

function resolveImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith('/uploads/')) {
    const localPath = path.join(process.cwd(), 'public', imageUrl);
    return localPath;
  }
  return imageUrl;
}

async function loadImage(imageUrl: string): Promise<Buffer> {
  if (imageUrl.startsWith('/uploads/')) {
    const localPath = path.join(process.cwd(), 'public', imageUrl);
    console.log(`📂 [Background Removal] Loading local file: ${localPath}`);
    return fs.promises.readFile(localPath);
  }
  
  console.log(`🌐 [Background Removal] Fetching remote: ${imageUrl}`);
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function convertToPng(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  console.log(`🔍 [Background Removal] Image format: ${metadata.format}, ${metadata.width}x${metadata.height}`);
  
  if (metadata.format === 'webp' || metadata.format === 'gif') {
    console.log(`🔄 [Background Removal] Converting ${metadata.format} to PNG`);
    return await sharp(imageBuffer).png().toBuffer();
  }
  
  return imageBuffer;
}

export async function removeImageBackground(
  imageUrl: string,
  userId: number | string
): Promise<BackgroundRemovalResult> {
  console.log(`🔧 [Background Removal] Starting for user ${userId}: ${imageUrl}`);
  
  try {
    let imageBuffer = await loadImage(imageUrl);
    console.log(`📥 [Background Removal] Loaded image: ${imageBuffer.length} bytes`);
    
    imageBuffer = await convertToPng(imageBuffer);
    console.log(`📐 [Background Removal] Prepared for processing: ${imageBuffer.length} bytes`);
    
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
