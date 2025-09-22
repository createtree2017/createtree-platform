/**
 * Pollo AI Service
 * 이미지 생성을 위한 Pollo AI API 통합 서비스
 */

interface PolloGenerationRequest {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  negativePrompt?: string;
  numOutputs?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  seed?: number;
}

interface PolloImageResponse {
  id: string;
  status: string;
  result?: {
    url: string;
  }[];
  error?: string;
}

// Pollo API 기본 설정
const POLLO_API_KEY = process.env.POLLO_API_KEY;
const POLLO_BASE_URL = 'https://pollo.ai/api/platform';

// 기본 모델 설정 (환경변수 또는 기본값)
const DEFAULT_MODEL = process.env.POLLO_DEFAULT_MODEL || 'flux-1.1-pro-ultra';

/**
 * Pollo API로 이미지 생성
 */
export async function generateImageWithPollo(
  prompt: string,
  options: Partial<PolloGenerationRequest> = {}
): Promise<string> {
  if (!POLLO_API_KEY) {
    throw new Error('Pollo API key is not configured');
  }

  const requestData: PolloGenerationRequest = {
    prompt,
    model: options.model || DEFAULT_MODEL,
    width: options.width || 1024,
    height: options.height || 1024,
    numOutputs: 1,
    ...options
  };

  try {
    console.log('[Pollo] 이미지 생성 시작:', prompt);
    
    const response = await fetch(`${POLLO_BASE_URL}/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': POLLO_API_KEY
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Pollo API error: ${response.status} - ${errorData}`);
    }

    const data: PolloImageResponse = await response.json();
    
    if (data.error) {
      throw new Error(`Pollo generation error: ${data.error}`);
    }

    if (!data.result || data.result.length === 0) {
      throw new Error('No image generated from Pollo API');
    }

    console.log('[Pollo] 이미지 생성 완료');
    return data.result[0].url;
    
  } catch (error) {
    console.error('[Pollo] 이미지 생성 실패:', error);
    throw error;
  }
}

/**
 * 이미지 to 이미지 변환 (만삭사진용)
 */
export async function transformImageWithPollo(
  imageUrl: string,
  prompt: string,
  options: Partial<PolloGenerationRequest> = {}
): Promise<string> {
  if (!POLLO_API_KEY) {
    throw new Error('Pollo API key is not configured');
  }

  const requestData = {
    image: imageUrl,
    prompt,
    model: options.model || 'flux-1.1-pro-ultra',
    strength: 0.7, // 원본 이미지 유지 정도 (0-1)
    ...options
  };

  try {
    console.log('[Pollo] 이미지 변환 시작:', prompt);
    
    const response = await fetch(`${POLLO_BASE_URL}/image-to-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': POLLO_API_KEY
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Pollo API error: ${response.status} - ${errorData}`);
    }

    const data: PolloImageResponse = await response.json();
    
    if (data.error) {
      throw new Error(`Pollo transformation error: ${data.error}`);
    }

    if (!data.result || data.result.length === 0) {
      throw new Error('No image transformed from Pollo API');
    }

    console.log('[Pollo] 이미지 변환 완료');
    return data.result[0].url;
    
  } catch (error) {
    console.error('[Pollo] 이미지 변환 실패:', error);
    throw error;
  }
}

/**
 * 서비스 상태 확인
 */
export async function checkPolloServiceStatus(): Promise<boolean> {
  if (!POLLO_API_KEY) {
    console.log('[Pollo] API key not configured');
    return false;
  }

  try {
    const response = await fetch(`${POLLO_BASE_URL}/status`, {
      method: 'GET',
      headers: {
        'x-api-key': POLLO_API_KEY
      }
    });

    return response.ok;
  } catch (error) {
    console.error('[Pollo] 서비스 상태 확인 실패:', error);
    return false;
  }
}

/**
 * 사용 가능한 모델 목록 조회
 */
export async function getAvailableModels(): Promise<string[]> {
  if (!POLLO_API_KEY) {
    console.log('[Pollo] API key not configured');
    return [];
  }

  try {
    const response = await fetch(`${POLLO_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'x-api-key': POLLO_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('[Pollo] 모델 목록 조회 실패:', error);
    return [];
  }
}