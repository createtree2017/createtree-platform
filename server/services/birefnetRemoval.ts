import { saveFileToGCS } from '../utils/gcs-image-storage';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getSystemSettings } from '../utils/settings';

export interface BackgroundRemovalResult {
  url: string;
  gsPath: string;
  fileName: string;
}

export interface BackgroundRemovalOptions {
  type?: 'foreground' | 'background';
  quality?: number;
  model?: 'small' | 'medium';
}

let modelInstance: any = null;
let processorInstance: any = null;
let isModelLoading = false;
let modelLoadPromise: Promise<void> | null = null;

const MODEL_ID = 'onnx-community/BiRefNet-portrait-ONNX';

async function getTransformers() {
  const { AutoModel, AutoProcessor, RawImage } = await import('@huggingface/transformers');
  return { AutoModel, AutoProcessor, RawImage };
}

export async function initializeBiRefNetModel(): Promise<void> {
  if (modelInstance && processorInstance) {
    console.log('✅ [BiRefNet] Model already loaded');
    return;
  }

  if (isModelLoading && modelLoadPromise) {
    console.log('⏳ [BiRefNet] Model is loading, waiting...');
    await modelLoadPromise;
    return;
  }

  isModelLoading = true;
  console.log(`🚀 [BiRefNet] Loading model: ${MODEL_ID}`);
  
  modelLoadPromise = (async () => {
    try {
      const { AutoModel, AutoProcessor } = await getTransformers();
      
      console.log('📥 [BiRefNet] Downloading/loading model from HuggingFace...');
      
      modelInstance = await AutoModel.from_pretrained(MODEL_ID, {
        dtype: 'fp32',
      });
      
      processorInstance = await AutoProcessor.from_pretrained(MODEL_ID);
      
      console.log('✅ [BiRefNet] Model loaded successfully');
    } catch (error) {
      console.error('❌ [BiRefNet] Failed to load model:', error);
      modelInstance = null;
      processorInstance = null;
      throw error;
    } finally {
      isModelLoading = false;
    }
  })();

  await modelLoadPromise;
}

async function loadImage(imageUrl: string): Promise<Buffer> {
  if (imageUrl.startsWith('/uploads/')) {
    const localPath = path.join(process.cwd(), 'public', imageUrl);
    console.log(`📂 [BiRefNet] Loading local file: ${localPath}`);
    return fs.promises.readFile(localPath);
  }
  
  console.log(`🌐 [BiRefNet] Fetching remote: ${imageUrl}`);
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function convertToPng(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  console.log(`🔍 [BiRefNet] Image format: ${metadata.format}, ${metadata.width}x${metadata.height}`);
  
  return await sharp(imageBuffer)
    .png()
    .toBuffer();
}

async function processWithBiRefNet(imageBuffer: Buffer): Promise<Buffer> {
  await initializeBiRefNetModel();
  
  if (!modelInstance || !processorInstance) {
    throw new Error('BiRefNet model not loaded');
  }

  const { RawImage } = await getTransformers();
  
  const pngBuffer = await convertToPng(imageBuffer);
  const base64 = pngBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;
  
  console.log('🖼️ [BiRefNet] Loading image into RawImage...');
  const image = await RawImage.fromURL(dataUrl);
  
  const originalWidth = image.width;
  const originalHeight = image.height;
  console.log(`📐 [BiRefNet] Original size: ${originalWidth}x${originalHeight}`);
  
  console.log('🔄 [BiRefNet] Preprocessing image...');
  const { pixel_values } = await processorInstance(image);
  
  console.log('🧠 [BiRefNet] Running inference...');
  const startTime = Date.now();
  const { output } = await modelInstance({ input: pixel_values });
  const inferenceTime = Date.now() - startTime;
  console.log(`✅ [BiRefNet] Inference completed in ${inferenceTime}ms`);
  
  console.log('🎨 [BiRefNet] Processing mask...');
  const maskData = output.data;
  const maskWidth = output.dims[3];
  const maskHeight = output.dims[2];
  
  const sigmoidMask = new Float32Array(maskData.length);
  for (let i = 0; i < maskData.length; i++) {
    sigmoidMask[i] = 1.0 / (1.0 + Math.exp(-maskData[i]));
  }
  
  const uint8Mask = new Uint8Array(sigmoidMask.length);
  for (let i = 0; i < sigmoidMask.length; i++) {
    uint8Mask[i] = Math.round(sigmoidMask[i] * 255);
  }
  
  const maskImage = sharp(Buffer.from(uint8Mask), {
    raw: { width: maskWidth, height: maskHeight, channels: 1 }
  });
  
  const resizedMask = await maskImage
    .resize(originalWidth, originalHeight)
    .raw()
    .toBuffer();
  
  const originalImage = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const { data: rgbaData, info } = originalImage;
  const resultBuffer = Buffer.alloc(info.width * info.height * 4);
  
  for (let i = 0; i < info.width * info.height; i++) {
    resultBuffer[i * 4] = rgbaData[i * 4];         // R
    resultBuffer[i * 4 + 1] = rgbaData[i * 4 + 1]; // G
    resultBuffer[i * 4 + 2] = rgbaData[i * 4 + 2]; // B
    resultBuffer[i * 4 + 3] = resizedMask[i];      // A from mask
  }
  
  const finalImage = await sharp(resultBuffer, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toBuffer();
  
  console.log(`✅ [BiRefNet] Output image: ${finalImage.length} bytes`);
  return finalImage;
}

async function invertAlphaComposite(originalBuffer: Buffer, foregroundBuffer: Buffer): Promise<Buffer> {
  const foreground = sharp(foregroundBuffer);
  
  const { data: fgData, info: fgInfo } = await foreground
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const invertedAlpha = Buffer.alloc(fgInfo.width * fgInfo.height);
  for (let i = 0; i < invertedAlpha.length; i++) {
    const alphaValue = fgData[i * 4 + 3];
    invertedAlpha[i] = 255 - alphaValue;
  }
  
  const alphaMask = await sharp(invertedAlpha, {
    raw: { width: fgInfo.width, height: fgInfo.height, channels: 1 }
  })
    .png()
    .toBuffer();
  
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
  console.log(`🔧 [BiRefNet] Starting for user ${userId}: ${imageUrl}`);
  
  try {
    const outputType = options?.type || 'foreground';
    console.log(`⚙️ [BiRefNet] Settings: type=${outputType}`);
    
    const imageBuffer = await loadImage(imageUrl);
    console.log(`📥 [BiRefNet] Loaded image: ${imageBuffer.length} bytes`);
    
    let resultBuffer = await processWithBiRefNet(imageBuffer);
    
    if (outputType === 'background') {
      console.log(`🔄 [BiRefNet] Inverting to get background only`);
      resultBuffer = await invertAlphaComposite(imageBuffer, resultBuffer);
      console.log(`✅ [BiRefNet] Background extracted: ${resultBuffer.length} bytes`);
    }
    
    console.log(`✅ [BiRefNet] Processed (${outputType}): ${resultBuffer.length} bytes`);
    
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
    
    console.log(`📤 [BiRefNet] Uploaded to GCS: ${gcsResult.originalUrl}`);
    
    return {
      url: gcsResult.originalUrl,
      gsPath: gcsResult.gsPath,
      fileName: gcsResult.fileName,
    };
    
  } catch (error) {
    console.error('❌ [BiRefNet] Error:', error);
    throw new Error(`BiRefNet background removal failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function removeBackgroundFromBuffer(
  imageBuffer: Buffer,
  userId: number | string,
  options?: BackgroundRemovalOptions
): Promise<BackgroundRemovalResult> {
  console.log(`🔧 [BiRefNet Buffer] Starting for user ${userId}`);
  
  try {
    const outputType = options?.type || 'foreground';
    console.log(`⚙️ [BiRefNet Buffer] Settings: type=${outputType}`);
    
    let resultBuffer = await processWithBiRefNet(imageBuffer);
    
    if (outputType === 'background') {
      console.log(`🔄 [BiRefNet Buffer] Inverting to get background only`);
      resultBuffer = await invertAlphaComposite(imageBuffer, resultBuffer);
      console.log(`✅ [BiRefNet Buffer] Background extracted: ${resultBuffer.length} bytes`);
    }
    
    console.log(`✅ [BiRefNet Buffer] Processed (${outputType}): ${resultBuffer.length} bytes`);
    
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
    
    console.log(`📤 [BiRefNet Buffer] Uploaded to GCS: ${gcsResult.originalUrl}`);
    
    return {
      url: gcsResult.originalUrl,
      gsPath: gcsResult.gsPath,
      fileName: gcsResult.fileName,
    };
    
  } catch (error) {
    console.error('❌ [BiRefNet Buffer] Error:', error);
    throw new Error(`BiRefNet background removal failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
