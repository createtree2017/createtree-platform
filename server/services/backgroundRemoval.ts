import { saveFileToGCS } from '../utils/gcs-image-storage';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getSystemSettings } from '../utils/settings';

const PERSISTENT_LOG_PATH = '/tmp/image-generation.log';

function persistentLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] ${message}\n`;
  if (data !== undefined) {
    if (typeof data === 'object') {
      logLine += JSON.stringify(data, null, 2) + '\n';
    } else {
      logLine += data + '\n';
    }
  }
  try {
    fs.appendFileSync(PERSISTENT_LOG_PATH, logLine);
    console.log(message, data !== undefined ? data : '');
  } catch (e) {
    console.error('영구 로그 쓰기 실패:', e);
  }
}

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
  persistentLog('🔄 [processWithBiRefNet] 시작', `입력 버퍼: ${imageBuffer.length} bytes`);
  
  try {
    persistentLog('📥 [processWithBiRefNet] 모델 초기화 시도...');
    await initializeBiRefNetModel();
    persistentLog('✅ [processWithBiRefNet] 모델 초기화 완료');
    
    if (!modelInstance || !processorInstance) {
      persistentLog('❌ [processWithBiRefNet] 모델이 로드되지 않음');
      throw new Error('BiRefNet model not loaded');
    }

    const { RawImage } = await getTransformers();
    
    persistentLog('🖼️ [processWithBiRefNet] Sharp로 raw 픽셀 데이터 추출 중...');
    let rawImageData: { data: Buffer; info: sharp.OutputInfo };
    let pngBuffer: Buffer;
    try {
      const sharpInstance = sharp(imageBuffer).ensureAlpha();
      rawImageData = await sharpInstance.raw().toBuffer({ resolveWithObject: true });
      pngBuffer = await sharp(imageBuffer).png().toBuffer();
      persistentLog('✅ [processWithBiRefNet] Raw 픽셀 추출 완료', 
        `${rawImageData.info.width}x${rawImageData.info.height}, ${rawImageData.info.channels}ch, ${rawImageData.data.length} bytes`);
    } catch (sharpError) {
      persistentLog('❌ [processWithBiRefNet] Sharp 픽셀 추출 실패', sharpError instanceof Error ? sharpError.message : String(sharpError));
      throw sharpError;
    }
    
    const originalWidth = rawImageData.info.width;
    const originalHeight = rawImageData.info.height;
    const channels = rawImageData.info.channels;
    
    persistentLog('🖼️ [processWithBiRefNet] RawImage 생성 중...');
    let image: any;
    try {
      const uint8Data = new Uint8ClampedArray(rawImageData.data);
      image = new RawImage(uint8Data, originalWidth, originalHeight, channels);
      persistentLog('✅ [processWithBiRefNet] RawImage 생성 완료');
    } catch (rawImageError) {
      persistentLog('❌ [processWithBiRefNet] RawImage 생성 실패', rawImageError instanceof Error ? rawImageError.message : String(rawImageError));
      throw rawImageError;
    }
    
    persistentLog(`📐 [processWithBiRefNet] 이미지 크기`, `${originalWidth}x${originalHeight}`);
    
    persistentLog('🔄 [processWithBiRefNet] Preprocessor 실행 중...');
    let preprocessorOutput: any;
    try {
      preprocessorOutput = await processorInstance(image);
      const outputKeys = Object.keys(preprocessorOutput);
      persistentLog('✅ [processWithBiRefNet] Preprocessor 완료', `출력 키: ${outputKeys.join(', ')}`);
    } catch (preprocessError) {
      persistentLog('❌ [processWithBiRefNet] Preprocessor 실패', preprocessError instanceof Error ? preprocessError.message : String(preprocessError));
      throw preprocessError;
    }
    
    persistentLog('🧠 [processWithBiRefNet] Inference 실행 중...');
    let outputs: any;
    try {
      const startTime = Date.now();
      const inputTensor = preprocessorOutput.pixel_values || preprocessorOutput;
      const modelInputs = { input_image: inputTensor };
      persistentLog('📤 [processWithBiRefNet] 모델 입력 키', Object.keys(modelInputs).join(', '));
      outputs = await modelInstance(modelInputs);
      const inferenceTime = Date.now() - startTime;
      persistentLog(`✅ [processWithBiRefNet] Inference 완료`, `${inferenceTime}ms`);
    } catch (inferenceError) {
      persistentLog('❌ [processWithBiRefNet] Inference 실패', inferenceError instanceof Error ? inferenceError.message : String(inferenceError));
      throw inferenceError;
    }
    
    const output = outputs.output || outputs.logits || Object.values(outputs)[0];
    if (!output) {
      persistentLog('❌ [processWithBiRefNet] 출력 텐서가 없음', `keys: ${Object.keys(outputs).join(', ')}`);
      throw new Error('No output tensor found');
    }
    
    persistentLog('🎨 [processWithBiRefNet] 마스크 처리 중...');
    const maskData = output.data;
    const maskWidth = output.dims[3];
    const maskHeight = output.dims[2];
    persistentLog(`📊 [processWithBiRefNet] 마스크 크기`, `${maskWidth}x${maskHeight}, data length: ${maskData.length}`);
    
    const sigmoidMask = new Float32Array(maskData.length);
    for (let i = 0; i < maskData.length; i++) {
      sigmoidMask[i] = 1.0 / (1.0 + Math.exp(-maskData[i]));
    }
    
    const uint8Mask = new Uint8Array(sigmoidMask.length);
    for (let i = 0; i < sigmoidMask.length; i++) {
      uint8Mask[i] = Math.round(sigmoidMask[i] * 255);
    }
    persistentLog('✅ [processWithBiRefNet] Sigmoid 마스크 변환 완료');
    
    const maskImage = sharp(Buffer.from(uint8Mask), {
      raw: { width: maskWidth, height: maskHeight, channels: 1 }
    });
    
    const resizedMask = await maskImage
      .resize(originalWidth, originalHeight)
      .raw()
      .toBuffer();
    persistentLog('✅ [processWithBiRefNet] 마스크 리사이즈 완료', `${resizedMask.length} bytes`);
    
    const originalImage = await sharp(pngBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { data: rgbaData, info } = originalImage;
    const resultBuffer = Buffer.alloc(info.width * info.height * 4);
    
    for (let i = 0; i < info.width * info.height; i++) {
      resultBuffer[i * 4] = rgbaData[i * 4];
      resultBuffer[i * 4 + 1] = rgbaData[i * 4 + 1];
      resultBuffer[i * 4 + 2] = rgbaData[i * 4 + 2];
      resultBuffer[i * 4 + 3] = resizedMask[i];
    }
    persistentLog('✅ [processWithBiRefNet] 알파 채널 합성 완료');
    
    const finalImage = await sharp(resultBuffer, {
      raw: { width: info.width, height: info.height, channels: 4 }
    })
      .png()
      .toBuffer();
    
    persistentLog(`✅ [processWithBiRefNet] 최종 이미지 생성 완료`, `${finalImage.length} bytes`);
    return finalImage;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    persistentLog('❌ [processWithBiRefNet] 전체 실패', { message: errorMsg, stack: errorStack?.slice(0, 500) });
    throw error;
  }
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
  persistentLog(`🔧 [BiRefNet Buffer] Starting for user ${userId}`, `버퍼 크기: ${imageBuffer.length} bytes`);
  
  try {
    const outputType = options?.type || 'foreground';
    persistentLog(`⚙️ [BiRefNet Buffer] Settings`, `type=${outputType}`);
    
    persistentLog('🧠 [BiRefNet Buffer] processWithBiRefNet 호출 시작...');
    let resultBuffer = await processWithBiRefNet(imageBuffer);
    persistentLog('✅ [BiRefNet Buffer] processWithBiRefNet 완료', `결과: ${resultBuffer.length} bytes`);
    
    if (outputType === 'background') {
      persistentLog(`🔄 [BiRefNet Buffer] Inverting to get background only`);
      resultBuffer = await invertAlphaComposite(imageBuffer, resultBuffer);
      persistentLog(`✅ [BiRefNet Buffer] Background extracted`, `${resultBuffer.length} bytes`);
    }
    
    persistentLog(`✅ [BiRefNet Buffer] Processed (${outputType})`, `${resultBuffer.length} bytes`);
    
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
    
    persistentLog(`📤 [BiRefNet Buffer] Uploaded to GCS`, gcsResult.originalUrl);
    
    return {
      url: gcsResult.originalUrl,
      gsPath: gcsResult.gsPath,
      fileName: gcsResult.fileName,
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    persistentLog('❌ [BiRefNet Buffer] 에러 발생', { message: errorMsg, stack: errorStack });
    throw new Error(`BiRefNet background removal failed: ${errorMsg}`);
  }
}
