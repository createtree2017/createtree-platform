/**
 * OpenAI GPT 이미지 모델을 활용한 이미지 변환 서비스
 * 간소화된 단일 호출 구조 (기존 3단계 프로세스 제거)
 * Gemini와 동일한 프롬프트 구조 사용
 */
import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { generateWithOpenAI } from './image-generation/openai-adapter';

// 공유 프롬프트 빌더 import
import { buildFinalPrompt } from '../utils/prompt';

// OpenAI API 키 및 프로젝트 설정 - 환경 변수에서 가져옴
const API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;

// API 키 유효성 검증 - 프로젝트 API 키 지원 추가 (sk-proj- 시작)
function isValidApiKey(apiKey: string | undefined): boolean {
  return !!apiKey && (apiKey.startsWith('sk-') || apiKey.startsWith('sk-proj-'));
}

function createOpenAIImageError(message: string, status?: number): Error {
  const error = new Error(message);
  if (status) {
    (error as any).status = status;
  }
  return error;
}

// OpenAI API 엔드포인트
const OPENAI_IMAGE_EDITING_URL = "https://api.openai.com/v1/images/edits";

// API 응답 타입 정의
interface OpenAIImageGenerationResponse {
  created?: number;
  data?: Array<{
    url?: string;
    revised_prompt?: string;
    b64_json?: string;
  }>;
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

function getOpenAIImageSize(aspectRatio?: string): string {
  if (!aspectRatio) return "1024x1024";
  const [width, height] = aspectRatio.split(":").map(Number);
  if (!width || !height) return "1024x1024";
  if (width === height) return "1024x1024";
  return width > height ? "1536x1024" : "1024x1536";
}

/**
 * GPT 이미지 모델로 이미지 편집 요청
 * 원본 이미지와 프롬프트를 함께 전송하여 원본 특성을 유지하는 변환 지원
 */
async function callOpenAIImageApi(prompt: string, imageBuffer: Buffer | null, modelName: string = 'gpt-image-2', aspectRatio?: string): Promise<string> {
  if (!isValidApiKey(API_KEY)) {
    console.log("유효한 API 키가 없습니다");
    throw createOpenAIImageError("OpenAI image API key is not configured");
  }

  try {
    // 프롬프트 검증
    if (!prompt || prompt.trim() === '') {
      console.error("API 호출 오류: 프롬프트가 비어 있습니다!");
      throw createOpenAIImageError("OpenAI image prompt is empty");
    }
    
    console.log(`=== ${modelName} API에 전송되는 최종 프롬프트 ===`);
    console.log(prompt);
    console.log(`=== ${modelName} API 프롬프트 종료 ===`);
    console.log("프롬프트 길이:", prompt.length);
    
    // 기본 이미지 크기 설정
    const imageSize = getOpenAIImageSize(aspectRatio);

    // imageBuffer 필수 확인 (현재 변환 플로우는 image-to-image 기준)
    if (!imageBuffer) {
      console.error("❌ [OpenAI] 이미지 버퍼가 없습니다. OpenAI 이미지 변환에는 레퍼런스 이미지가 필요합니다.");
      throw new Error("이미지 버퍼가 필요합니다. 텍스트 전용 모드는 레퍼런스 이미지를 사용해야 합니다.");
    }
    
    let imageUrl: string | undefined;
    
    // GPT-Image-1 image-to-image 변환
    console.log(`📷 [OpenAI] 이미지 변환 모드 - GPT-Image-1 Edit API 호출`);
    
    // UUID를 사용한 고유 임시 파일 경로 설정 (동시성 문제 해결)
    const tempFileName = `temp_image_${uuidv4()}.jpg`;
    const tempFilePath = path.join(process.cwd(), tempFileName);
    
    console.log(`🔧 [OpenAI] 동시성 안전 - 고유 파일명: ${tempFileName}`);
    
    // 이미지 Buffer를 임시 파일로 비동기 저장 (성능 향상)
    await fs.promises.writeFile(tempFilePath, imageBuffer);
    
    try {
      // FormData 객체 생성
      const formData = new FormData();
      formData.append('model', modelName);
      formData.append('prompt', prompt);
      formData.append('image', fs.createReadStream(tempFilePath));
      formData.append('size', imageSize);
      formData.append('quality', 'high');
      formData.append('n', '1');
      
      // Content-Length 계산 (청크 업로드로 인한 스로틀링 5분 무한대기 현상 방지)
      const contentLength = await new Promise<number>((resolve, reject) => {
        formData.getLength((err, length) => {
          if (err) reject(err);
          else resolve(length);
        });
      });

      const authHeader = {
        'Authorization': `Bearer ${API_KEY}`,
        ...formData.getHeaders(),
        'Content-Length': contentLength.toString()
      };
      
      console.log("multipart/form-data 형식으로 GPT-Image-1 Edit API 호출");
      
      // API 호출
      const apiResponse = await fetch(OPENAI_IMAGE_EDITING_URL, {
        method: 'POST',
        headers: authHeader,
        body: formData
      });
      
      // 응답 텍스트로 가져오기
      const responseText = await apiResponse.text();
      
      console.log("GPT-Image-1 API 응답 완료");
      
      // JSON 파싱 시도
      let responseData: OpenAIImageGenerationResponse;
      try {
        responseData = JSON.parse(responseText);
        
        // 응답 데이터 구조 상세 로깅
        console.log("GPT-Image-1 응답 구조:", JSON.stringify({
          created: responseData.created,
          dataLength: responseData.data?.length || 0,
          firstDataItem: responseData.data?.[0] ? "데이터 있음" : "데이터 없음",
          errorInfo: responseData.error || null
        }, null, 2));
        
      } catch (parseError) {
        console.error("GPT-Image-1 API 응답 파싱 오류:", parseError);
        throw createOpenAIImageError("OpenAI image API returned an invalid JSON response", apiResponse.status);
      }
      
      // 오류 체크
      if (!apiResponse.ok || responseData.error) {
        console.error("GPT-Image-1 API 오류:", responseData.error?.message || `HTTP 오류: ${apiResponse.status}`);
        throw createOpenAIImageError(
          responseData.error?.message || `OpenAI image API request failed with status ${apiResponse.status}`,
          apiResponse.status
        );
      }
      
      // 이미지 URL 또는 base64 데이터 가져오기
      imageUrl = responseData.data?.[0]?.url;
      const base64Data = responseData.data?.[0]?.b64_json;
      
      // base64 데이터가 있고 URL이 없는 경우, base64 데이터를 URL로 변환
      if (!imageUrl && base64Data) {
        console.log("이미지 URL이 없고 base64 데이터가 있습니다. base64 데이터를 사용합니다.");
        imageUrl = `data:image/png;base64,${base64Data}`;
        console.log("base64 데이터 URL 생성 완료");
      }
      
      if (!imageUrl) {
        console.error("이미지 URL과 base64 데이터가 모두 없습니다");
        throw new Error("GPT-Image-1 응답에 이미지 데이터 없음");
      }
      
      return imageUrl;
      
    } finally {
      // 임시 파일 정리 보장 (동시성 안전)
      try {
        await fs.promises.unlink(tempFilePath);
        console.log(`🗑️ [OpenAI] 임시 파일 정리 완료: ${tempFileName}`);
      } catch (cleanupError) {
        console.warn(`⚠️ [OpenAI] 임시 파일 정리 실패: ${tempFileName}`, cleanupError);
      }
    }
    
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log("GPT-Image-1 API 오류:", errorMessage);
    console.error("GPT-Image-1 API 호출 실패");
    throw error;
  }
}

/**
 * 통일된 간소화된 OpenAI 이미지 변환 함수 
 * Gemini와 동일한 프롬프트 구조 사용 (3단계 프로세스 제거)
 * @param template 관리자 설정 기본 프롬프트 템플릿 (필수)
 * @param imageBuffer 원본 이미지 버퍼 (text_only일 때는 null 가능)
 * @param systemPrompt 관리자 설정 시스템 프롬프트 (선택)
 * @param variables 변수 치환용 (선택)
 * @returns 변환된 이미지 URL
 */
export async function transformWithOpenAI(
  template: string,
  imageBuffer: Buffer | null,
  systemPrompt?: string,
  variables?: Record<string, string>,
  modelName: string = 'gpt-image-2',
  aspectRatio?: string
): Promise<string> {
  if (!isValidApiKey(API_KEY)) {
    console.log("유효한 API 키가 없습니다");
    throw createOpenAIImageError("OpenAI image API key is not configured");
  }

  try {
    const result = await generateWithOpenAI({
      modelKey: modelName === 'gpt-image-1.5' ? 'openai_gpt1_5' : 'openai_gpt2',
      prompt: template,
      imageBuffer,
      systemPrompt,
      variables,
      aspectRatio,
      isTextOnly: !imageBuffer,
    });
    return result.imageUrl;
  } catch (error: any) {
    console.error('❌ [OpenAI 변환] 실패:', error);
    throw error;
  }
}

/**
 * OpenAI GPT-Image-1 다중 이미지 변환 함수
 * 여러 이미지를 Sharp로 그리드 합성 후 GPT-Image-1에 전달
 * @param template 프롬프트 템플릿
 * @param imageBuffers 이미지 버퍼 배열
 * @param systemPrompt 시스템 프롬프트 (선택)
 * @param variables 변수 (선택)
 * @returns 변환된 이미지 URL
 */
export async function transformWithOpenAIMulti(
  template: string,
  imageBuffers: Buffer[],
  systemPrompt?: string,
  variables?: Record<string, string>,
  modelName: string = 'gpt-image-2',
  aspectRatio?: string
): Promise<string> {
  if (!isValidApiKey(API_KEY)) {
    console.log("유효한 API 키가 없습니다");
    throw createOpenAIImageError("OpenAI image API key is not configured");
  }

  try {
    const result = await generateWithOpenAI({
      modelKey: modelName === 'gpt-image-1.5' ? 'openai_gpt1_5' : 'openai_gpt2',
      prompt: template,
      imageBuffers,
      systemPrompt,
      variables,
      aspectRatio,
      isTextOnly: imageBuffers.length === 0,
    });
    return result.imageUrl;
  } catch (error: any) {
    console.error('❌ [OpenAI Multi] 실패:', error);
    throw error;
  }
}
