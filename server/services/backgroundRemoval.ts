import { removeBackground } from '@imgly/background-removal-node';
import { saveFileToGCS } from '../utils/gcs-image-storage';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { Blob } from 'buffer';
import { getSystemSettings } from '../utils/settings';

export interface BackgroundRemovalResult {
  url: string;
  gsPath: string;
  fileName: string;
}

export interface BackgroundRemovalOptions {
  type?: 'foreground' | 'background'; // foreground = person only, background = bg only
  quality?: number;
  model?: 'small' | 'medium';
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
  
  console.log(`🔄 [Background Removal] Converting to PNG for compatibility`);
  return await sharp(imageBuffer)
    .png()
    .toBuffer();
}

/**
 * Invert alpha composite: Keep original pixels where foreground mask is transparent
 * This effectively gives us the background only (person removed)
 */
async function invertAlphaComposite(originalBuffer: Buffer, foregroundBuffer: Buffer): Promise<Buffer> {
  const original = sharp(originalBuffer);
  const foreground = sharp(foregroundBuffer);
  
  const originalMeta = await original.metadata();
  
  // Get raw pixels from foreground (has alpha channel)
  const { data: fgData, info: fgInfo } = await foreground
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  // Create inverted alpha mask: where person is, alpha=0; where background is, alpha=255
  const invertedAlpha = Buffer.alloc(fgInfo.width * fgInfo.height);
  for (let i = 0; i < invertedAlpha.length; i++) {
    const alphaValue = fgData[i * 4 + 3]; // Alpha channel
    invertedAlpha[i] = 255 - alphaValue; // Invert
  }
  
  // Create alpha mask image
  const alphaMask = await sharp(invertedAlpha, {
    raw: { width: fgInfo.width, height: fgInfo.height, channels: 1 }
  })
    .png()
    .toBuffer();
  
  // Composite original with inverted alpha
  return await sharp(originalBuffer)
    .resize(fgInfo.width, fgInfo.height)
    .ensureAlpha()
    .joinChannel(alphaMask)
    .png()
    .toBuffer();
}

export async function removeImageBackground(
  imageUrl: string,
  userId: number | string,
  options?: BackgroundRemovalOptions
): Promise<BackgroundRemovalResult> {
  console.log(`🔧 [Background Removal] Starting for user ${userId}: ${imageUrl}`);
  
  try {
    // Get system settings for quality and model
    const systemSettings = await getSystemSettings();
    const quality = options?.quality ?? parseFloat(systemSettings.bgRemovalQuality || '1.0');
    const model = options?.model ?? (systemSettings.bgRemovalModel as 'small' | 'medium' || 'medium');
    const outputType = options?.type || 'foreground';
    
    console.log(`⚙️ [Background Removal] Settings: quality=${quality}, model=${model}, type=${outputType}`);
    
    let imageBuffer = await loadImage(imageUrl);
    console.log(`📥 [Background Removal] Loaded image: ${imageBuffer.length} bytes`);
    
    imageBuffer = await convertToPng(imageBuffer);
    console.log(`📐 [Background Removal] Prepared for processing: ${imageBuffer.length} bytes`);
    
    const inputBlob = new Blob([imageBuffer], { type: 'image/png' });
    
    const blob = await removeBackground(inputBlob, {
      model: model,
      output: {
        format: 'image/png',
        quality: quality,
      },
    });
    
    let resultBuffer = Buffer.from(await blob.arrayBuffer());
    console.log(`✅ [Background Removal] Foreground extracted: ${resultBuffer.length} bytes`);
    
    // For background output, we need to invert: keep original pixels where foreground was transparent
    if (outputType === 'background') {
      console.log(`🔄 [Background Removal] Inverting to get background only`);
      const originalBuffer = await loadImage(imageUrl);
      resultBuffer = await invertAlphaComposite(originalBuffer, resultBuffer);
      console.log(`✅ [Background Removal] Background extracted: ${resultBuffer.length} bytes`);
    }
    
    console.log(`✅ [Background Removal] Processed (${outputType}): ${resultBuffer.length} bytes`);
    
    const timestamp = Date.now();
    const suffix = outputType === 'background' ? '_bgonly' : '_nobg';
    const fileName = `${timestamp}${suffix}.png`;
    
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

/**
 * Process background removal from buffer directly (for use in image generation pipeline)
 */
export async function removeBackgroundFromBuffer(
  imageBuffer: Buffer,
  userId: number | string,
  options?: BackgroundRemovalOptions
): Promise<BackgroundRemovalResult> {
  console.log(`🔧 [Background Removal Buffer] Starting for user ${userId}`);
  
  try {
    // Get system settings for quality and model
    const systemSettings = await getSystemSettings();
    const quality = options?.quality ?? parseFloat(systemSettings.bgRemovalQuality || '1.0');
    const model = options?.model ?? (systemSettings.bgRemovalModel as 'small' | 'medium' || 'medium');
    const outputType = options?.type || 'foreground';
    
    console.log(`⚙️ [Background Removal Buffer] Settings: quality=${quality}, model=${model}, type=${outputType}`);
    
    const pngBuffer = await convertToPng(imageBuffer);
    console.log(`📐 [Background Removal Buffer] Prepared for processing: ${pngBuffer.length} bytes`);
    
    const inputBlob = new Blob([pngBuffer], { type: 'image/png' });
    
    const blob = await removeBackground(inputBlob, {
      model: model,
      output: {
        format: 'image/png',
        quality: quality,
      },
    });
    
    let resultBuffer = Buffer.from(await blob.arrayBuffer());
    console.log(`✅ [Background Removal Buffer] Foreground extracted: ${resultBuffer.length} bytes`);
    
    // For background output, we need to invert: keep original pixels where foreground was transparent
    if (outputType === 'background') {
      console.log(`🔄 [Background Removal Buffer] Inverting to get background only`);
      resultBuffer = await invertAlphaComposite(imageBuffer, resultBuffer);
      console.log(`✅ [Background Removal Buffer] Background extracted: ${resultBuffer.length} bytes`);
    }
    
    console.log(`✅ [Background Removal Buffer] Processed (${outputType}): ${resultBuffer.length} bytes`);
    
    const timestamp = Date.now();
    const suffix = outputType === 'background' ? '_bgonly' : '_nobg';
    const fileName = `${timestamp}${suffix}.png`;
    
    const gcsResult = await saveFileToGCS(
      resultBuffer,
      userId,
      'background-removed',
      fileName,
      'image/png'
    );
    
    console.log(`📤 [Background Removal Buffer] Uploaded to GCS: ${gcsResult.originalUrl}`);
    
    return {
      url: gcsResult.originalUrl,
      gsPath: gcsResult.gsPath,
      fileName: gcsResult.fileName,
    };
    
  } catch (error) {
    console.error('❌ [Background Removal Buffer] Error:', error);
    throw new Error(`Background removal failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
