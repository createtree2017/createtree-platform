import { GoogleAuth } from 'google-auth-library';
import { uploadBufferToGCS } from '../utils/gcs';
import { db } from '../../db';
import { productCategories } from '@shared/schema';
import { eq } from 'drizzle-orm';

const UPSCALE_FACTORS = ['x2', 'x3', 'x4'] as const;
type UpscaleFactor = typeof UPSCALE_FACTORS[number];

interface UpscaleConfig {
  enabled: boolean;
  maxFactor: UpscaleFactor;
  targetDpi: number;
  mode: 'auto' | 'fixed';
}

interface UpscaleRequest {
  imageUrl: string;
  targetDpi?: number;
  physicalSizeCm?: { width: number; height: number };
  maxFactor?: UpscaleFactor;
  categorySlug?: string;
}

interface UpscaleResult {
  success: boolean;
  upscaledUrl?: string;
  appliedFactor?: UpscaleFactor;
  originalResolution?: { width: number; height: number };
  upscaledResolution?: { width: number; height: number };
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

let authClient: GoogleAuth | null = null;

function getServiceAccountCredentials(): any | null {
  const jsonKey = process.env.GOOGLE_UPSCALE_JSON_KEY;
  if (!jsonKey) {
    console.warn('⚠️ [Upscale] GOOGLE_UPSCALE_JSON_KEY 환경변수가 설정되지 않았습니다.');
    return null;
  }
  
  try {
    return JSON.parse(jsonKey);
  } catch (error) {
    console.error('❌ [Upscale] 서비스 계정 키 파싱 실패:', error);
    return null;
  }
}

function getAuthClient(): GoogleAuth | null {
  if (authClient) return authClient;
  
  const credentials = getServiceAccountCredentials();
  if (!credentials) return null;
  
  authClient = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  
  console.log('✅ [Upscale] Google Auth 클라이언트 초기화 완료');
  return authClient;
}

export async function getCategoryUpscaleConfig(categorySlug: string): Promise<UpscaleConfig | null> {
  try {
    const category = await db.query.productCategories.findFirst({
      where: eq(productCategories.slug, categorySlug)
    });
    
    if (!category) {
      console.warn(`⚠️ [Upscale] 카테고리를 찾을 수 없음: ${categorySlug}`);
      return null;
    }
    
    return {
      enabled: category.upscaleEnabled,
      maxFactor: category.upscaleMaxFactor as UpscaleFactor,
      targetDpi: category.upscaleTargetDpi,
      mode: category.upscaleMode as 'auto' | 'fixed'
    };
  } catch (error) {
    console.error(`❌ [Upscale] 카테고리 설정 로드 실패:`, error);
    return null;
  }
}

function calculateRequiredFactor(
  originalResolution: ImageDimensions,
  physicalSizeCm: { width: number; height: number },
  targetDpi: number
): UpscaleFactor | null {
  const requiredWidthPx = Math.ceil((physicalSizeCm.width / 2.54) * targetDpi);
  const requiredHeightPx = Math.ceil((physicalSizeCm.height / 2.54) * targetDpi);
  const requiredMaxPx = Math.max(requiredWidthPx, requiredHeightPx);
  const originalMaxPx = Math.max(originalResolution.width, originalResolution.height);
  
  console.log(`📐 [Upscale] 해상도 분석: 원본=${originalMaxPx}px, 필요=${requiredMaxPx}px (${targetDpi}DPI)`);
  
  if (originalMaxPx >= requiredMaxPx) {
    console.log(`✅ [Upscale] 업스케일 불필요 - 원본 해상도 충분`);
    return null;
  }
  
  const requiredScale = requiredMaxPx / originalMaxPx;
  
  if (requiredScale <= 2) return 'x2';
  if (requiredScale <= 3) return 'x3';
  return 'x4';
}

async function getImageDimensions(imageUrl: string): Promise<ImageDimensions> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패: ${response.status}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(buffer).metadata();
    
    return {
      width: metadata.width || 1024,
      height: metadata.height || 1024
    };
  } catch (error) {
    console.warn(`⚠️ [Upscale] 이미지 크기 확인 실패, 기본값 사용:`, error);
    return { width: 1024, height: 1024 };
  }
}

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`이미지 다운로드 실패: ${response.status}`);
  }
  
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

async function callVertexAIUpscale(base64Image: string, factor: UpscaleFactor): Promise<string> {
  const auth = getAuthClient();
  if (!auth) {
    throw new Error('Google Auth 클라이언트를 초기화할 수 없습니다.');
  }
  
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    throw new Error('서비스 계정 정보를 로드할 수 없습니다.');
  }
  
  const projectId = credentials.project_id;
  const location = 'us-central1';
  const model = 'imagen-4.0-upscale-preview';
  
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;
  
  console.log(`🚀 [Upscale] Vertex AI 호출: ${factor} 배율, 프로젝트=${projectId}`);
  
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  
  if (!accessToken.token) {
    throw new Error('액세스 토큰을 얻을 수 없습니다.');
  }
  
  const requestBody = {
    instances: [{
      image: { bytesBase64Encoded: base64Image }
    }],
    parameters: {
      mode: 'upscale',
      upscaleFactor: factor
    }
  };
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [Upscale] API 오류:`, errorText);
    throw new Error(`Vertex AI API 오류: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  
  if (!result.predictions || !result.predictions[0]?.bytesBase64Encoded) {
    throw new Error('업스케일 결과를 받지 못했습니다.');
  }
  
  console.log(`✅ [Upscale] Vertex AI 응답 성공`);
  return result.predictions[0].bytesBase64Encoded;
}

export async function upscaleImage(request: UpscaleRequest): Promise<UpscaleResult> {
  console.log(`🔄 [Upscale] 업스케일 요청:`, {
    imageUrl: request.imageUrl.substring(0, 50) + '...',
    categorySlug: request.categorySlug,
    physicalSizeCm: request.physicalSizeCm
  });
  
  try {
    let config: UpscaleConfig = {
      enabled: true,
      maxFactor: request.maxFactor || 'x4',
      targetDpi: request.targetDpi || 300,
      mode: 'auto'
    };
    
    if (request.categorySlug) {
      const categoryConfig = await getCategoryUpscaleConfig(request.categorySlug);
      if (categoryConfig) {
        config = categoryConfig;
      }
    }
    
    if (!config.enabled) {
      return {
        success: true,
        skipped: true,
        skipReason: '카테고리에서 업스케일이 비활성화됨'
      };
    }
    
    const originalResolution = await getImageDimensions(request.imageUrl);
    console.log(`📏 [Upscale] 원본 해상도: ${originalResolution.width}x${originalResolution.height}`);
    
    let factor: UpscaleFactor;
    
    if (config.mode === 'fixed') {
      factor = config.maxFactor;
    } else {
      if (!request.physicalSizeCm) {
        factor = config.maxFactor;
        console.log(`📐 [Upscale] 물리적 크기 정보 없음, 최대 배율 사용: ${factor}`);
      } else {
        const calculatedFactor = calculateRequiredFactor(
          originalResolution,
          request.physicalSizeCm,
          config.targetDpi
        );
        
        if (!calculatedFactor) {
          return {
            success: true,
            skipped: true,
            skipReason: '원본 해상도가 충분함',
            originalResolution
          };
        }
        
        const factorIndex = UPSCALE_FACTORS.indexOf(calculatedFactor);
        const maxFactorIndex = UPSCALE_FACTORS.indexOf(config.maxFactor);
        factor = factorIndex <= maxFactorIndex ? calculatedFactor : config.maxFactor;
      }
    }
    
    console.log(`🎯 [Upscale] 적용 배율: ${factor}`);
    
    const base64Image = await fetchImageAsBase64(request.imageUrl);
    const upscaledBase64 = await callVertexAIUpscale(base64Image, factor);
    
    const upscaledBuffer = Buffer.from(upscaledBase64, 'base64');
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const targetPath = `upscaled/${timestamp}_${randomId}.png`;
    
    const upscaledUrl = await uploadBufferToGCS(upscaledBuffer, targetPath, 'image/png');
    
    const factorMultiplier = factor === 'x2' ? 2 : factor === 'x3' ? 3 : 4;
    const upscaledResolution = {
      width: originalResolution.width * factorMultiplier,
      height: originalResolution.height * factorMultiplier
    };
    
    console.log(`✅ [Upscale] 완료: ${originalResolution.width}x${originalResolution.height} → ${upscaledResolution.width}x${upscaledResolution.height}`);
    
    return {
      success: true,
      upscaledUrl,
      appliedFactor: factor,
      originalResolution,
      upscaledResolution
    };
    
  } catch (error: any) {
    console.error(`❌ [Upscale] 오류:`, error);
    return {
      success: false,
      error: error.message || '알 수 없는 오류'
    };
  }
}

export async function upscaleMultipleImages(
  requests: UpscaleRequest[],
  onProgress?: (completed: number, total: number) => void
): Promise<UpscaleResult[]> {
  const results: UpscaleResult[] = [];
  const total = requests.length;
  
  console.log(`📦 [Upscale] 다중 업스케일 시작: ${total}개 이미지`);
  
  for (let i = 0; i < requests.length; i++) {
    const result = await upscaleImage(requests[i]);
    results.push(result);
    
    if (onProgress) {
      onProgress(i + 1, total);
    }
    
    console.log(`📊 [Upscale] 진행률: ${i + 1}/${total}`);
  }
  
  const successCount = results.filter(r => r.success && !r.skipped).length;
  const skippedCount = results.filter(r => r.skipped).length;
  const failedCount = results.filter(r => !r.success).length;
  
  console.log(`✅ [Upscale] 다중 업스케일 완료: 성공=${successCount}, 스킵=${skippedCount}, 실패=${failedCount}`);
  
  return results;
}

export function isUpscaleServiceAvailable(): boolean {
  return getServiceAccountCredentials() !== null;
}

export { UpscaleConfig, UpscaleRequest, UpscaleResult, UpscaleFactor, UPSCALE_FACTORS };
