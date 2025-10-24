/**
 * OpenAI GPT-Image-1 모델을 활용한 이미지 변환 서비스
 * 간소화된 단일 호출 구조 (기존 3단계 프로세스 제거)
 * Gemini와 동일한 프롬프트 구조 사용
 */
import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

// 공유 프롬프트 빌더 import
import { buildFinalPrompt } from '../utils/prompt';

// OpenAI API 키 및 프로젝트 설정 - 환경 변수에서 가져옴
const API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;

// 서비스 불가능 상태 메시지
const SERVICE_UNAVAILABLE = "https://placehold.co/1024x1024/A7C1E2/FFF?text=현재+이미지생성+서비스가+금일+종료+되었습니다";

// API 키 유효성 검증 - 프로젝트 API 키 지원 추가 (sk-proj- 시작)
function isValidApiKey(apiKey: string | undefined): boolean {
  return !!apiKey && (apiKey.startsWith('sk-') || apiKey.startsWith('sk-proj-'));
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

/**
 * GPT-Image-1 모델로 이미지 편집 요청
 * 원본 이미지와 프롬프트를 함께 전송하여 원본 특성을 유지하는 변환 지원
 */
async function callGptImage1Api(prompt: string, imageBuffer: Buffer | null): Promise<string> {
  if (!isValidApiKey(API_KEY)) {
    console.log("유효한 API 키가 없습니다");
    return SERVICE_UNAVAILABLE;
  }

  try {
    // 프롬프트 검증
    if (!prompt || prompt.trim() === '') {
      console.error("API 호출 오류: 프롬프트가 비어 있습니다!");
      return SERVICE_UNAVAILABLE;
    }
    
    console.log("=== GPT-Image-1 API에 전송되는 최종 프롬프트 ===");
    console.log(prompt);
    console.log("=== GPT-Image-1 API 프롬프트 종료 ===");
    console.log("프롬프트 길이:", prompt.length);
    
    // 기본 이미지 크기 설정
    const imageSize = "1024x1024";

    // imageBuffer 필수 확인 (GPT-Image-1은 image-to-image 변환 전용)
    if (!imageBuffer) {
      console.error("❌ [OpenAI] 이미지 버퍼가 없습니다. GPT-Image-1은 image-to-image 변환만 지원합니다.");
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
      formData.append('model', 'gpt-image-1');
      formData.append('prompt', prompt);
      formData.append('image', fs.createReadStream(tempFilePath));
      formData.append('size', imageSize);
      formData.append('quality', 'high');
      formData.append('n', '1');
      
      // multipart/form-data를 사용하므로 Content-Type 헤더는 자동 설정됨
      const authHeader = {
        'Authorization': `Bearer ${API_KEY}`
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
        return SERVICE_UNAVAILABLE;
      }
      
      // 오류 체크
      if (!apiResponse.ok || responseData.error) {
        console.error("GPT-Image-1 API 오류:", responseData.error?.message || `HTTP 오류: ${apiResponse.status}`);
        return SERVICE_UNAVAILABLE;
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
    return SERVICE_UNAVAILABLE;
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
  variables?: Record<string, string>
): Promise<string> {
  if (!isValidApiKey(API_KEY)) {
    console.log("유효한 API 키가 없습니다");
    return SERVICE_UNAVAILABLE;
  }

  try {
    console.log('🔥 [OpenAI 변환] 간소화된 단일 프로세스 시작');
    
    // 1. 공유 프롬프트 빌더로 최종 프롬프트 생성
    const finalPrompt = buildFinalPrompt({
      template,
      systemPrompt,
      variables
    });
    
    console.log('🎯 [OpenAI 변환] 최종 프롬프트 길이:', finalPrompt.length);
    
    // 2. GPT-Image-1 직접 호출 (3단계 프로세스 제거)
    console.log('⚡ [OpenAI 변환] GPT-Image-1 단일 호출');
    const result = await callGptImage1Api(finalPrompt, imageBuffer);
    
    console.log('✅ [OpenAI 변환] 간소화된 프로세스 완료');
    return result;
    
  } catch (error: any) {
    console.error('❌ [OpenAI 변환] 실패:', error);
    return SERVICE_UNAVAILABLE;
  }
}