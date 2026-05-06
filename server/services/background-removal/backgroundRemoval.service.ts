import fs from 'fs';
import path from 'path';
import { saveFileToGCS } from '../../utils/gcs-image-storage';
import { getSystemSettings } from '../../utils/settings';
import {
  convertToPng,
  invertAlphaComposite,
} from './image-preprocess';
import { RembgHttpProvider } from './rembg.provider';
import type {
  BackgroundRemovalHealth,
  BackgroundRemovalModelSize,
  BackgroundRemovalOptions,
  BackgroundRemovalOutputType,
  BackgroundRemovalResult,
  BackgroundRemovalProvider,
} from './backgroundRemoval.types';

const provider: BackgroundRemovalProvider = new RembgHttpProvider();

async function loadImage(imageUrl: string): Promise<Buffer> {
  if (imageUrl.startsWith('/uploads/')) {
    const localPath = path.join(process.cwd(), 'public', imageUrl);
    console.log(`[Background Removal] Loading local file: ${localPath}`);
    return fs.promises.readFile(localPath);
  }

  console.log(`[Background Removal] Fetching remote: ${imageUrl}`);
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function normalizeQuality(value?: number | string | null): number {
  const quality = typeof value === 'number' ? value : Number(value);
  if ([0.5, 0.8, 1.0].includes(quality)) {
    return quality;
  }
  return 1.0;
}

function normalizeModel(value?: string | null): BackgroundRemovalModelSize {
  return value === 'small' ? 'small' : 'medium';
}

function normalizeOutputType(value?: string | null): BackgroundRemovalOutputType {
  return value === 'background' ? 'background' : 'foreground';
}

async function resolveOptions(options?: BackgroundRemovalOptions): Promise<{
  quality: number;
  model: BackgroundRemovalModelSize;
  outputType: BackgroundRemovalOutputType;
}> {
  const systemSettings = await getSystemSettings();

  return {
    quality: normalizeQuality(options?.quality ?? systemSettings.bgRemovalQuality),
    model: normalizeModel(options?.model ?? systemSettings.bgRemovalModel),
    outputType: normalizeOutputType(options?.type),
  };
}

async function processBackgroundRemoval(
  imageBuffer: Buffer,
  options?: BackgroundRemovalOptions
): Promise<Buffer> {
  const resolvedOptions = await resolveOptions(options);

  console.log(
    `[Background Removal] Settings: quality=${resolvedOptions.quality}, model=${resolvedOptions.model}, type=${resolvedOptions.outputType}`
  );

  const pngBuffer = await convertToPng(imageBuffer);
  console.log(`[Background Removal] Prepared for processing: ${pngBuffer.length} bytes`);

  let resultBuffer = await provider.removeBackground(pngBuffer, {
    quality: resolvedOptions.quality,
    model: resolvedOptions.model,
  });

  console.log(`[Background Removal] Foreground extracted: ${resultBuffer.length} bytes`);

  if (resolvedOptions.outputType === 'background') {
    resultBuffer = await invertAlphaComposite(imageBuffer, resultBuffer);
    console.log(`[Background Removal] Background extracted: ${resultBuffer.length} bytes`);
  }

  return resultBuffer;
}

async function saveBackgroundRemovalResult(
  resultBuffer: Buffer,
  userId: number | string,
  outputType: BackgroundRemovalOutputType
): Promise<BackgroundRemovalResult> {
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

  console.log(`[Background Removal] Uploaded to GCS: ${gcsResult.originalUrl}`);

  return {
    url: gcsResult.originalUrl,
    gsPath: gcsResult.gsPath,
    fileName: gcsResult.fileName,
  };
}

export async function removeImageBackground(
  imageUrl: string,
  userId: number | string,
  options?: BackgroundRemovalOptions
): Promise<BackgroundRemovalResult> {
  console.log(`[Background Removal] Starting for user ${userId}: ${imageUrl}`);

  try {
    const resolvedOptions = await resolveOptions(options);
    const imageBuffer = await loadImage(imageUrl);
    const resultBuffer = await processBackgroundRemoval(imageBuffer, {
      ...options,
      quality: resolvedOptions.quality,
      model: resolvedOptions.model,
      type: resolvedOptions.outputType,
    });

    return await saveBackgroundRemovalResult(
      resultBuffer,
      userId,
      resolvedOptions.outputType
    );
  } catch (error) {
    console.error('[Background Removal] Error:', error);
    throw new Error(
      `Background removal failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function removeBackgroundFromBuffer(
  imageBuffer: Buffer,
  userId: number | string,
  options?: BackgroundRemovalOptions
): Promise<BackgroundRemovalResult> {
  console.log(`[Background Removal Buffer] Starting for user ${userId}`);

  try {
    const resolvedOptions = await resolveOptions(options);
    const resultBuffer = await processBackgroundRemoval(imageBuffer, {
      ...options,
      quality: resolvedOptions.quality,
      model: resolvedOptions.model,
      type: resolvedOptions.outputType,
    });

    return await saveBackgroundRemovalResult(
      resultBuffer,
      userId,
      resolvedOptions.outputType
    );
  } catch (error) {
    console.error('[Background Removal Buffer] Error:', error);
    throw new Error(
      `Background removal failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function removeBackgroundBufferOnly(
  imageBuffer: Buffer,
  options?: BackgroundRemovalOptions
): Promise<Buffer> {
  try {
    return await processBackgroundRemoval(imageBuffer, {
      ...options,
      type: options?.type ?? 'foreground',
    });
  } catch (error) {
    console.error('[Background Removal Buffer Only] Error:', error);
    throw new Error(
      `Background removal failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function checkBackgroundRemovalHealth(): Promise<BackgroundRemovalHealth> {
  return provider.checkHealth();
}
