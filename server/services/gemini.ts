// Gemini API 설정
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// 공유 프롬프트 빌더 import
import { buildFinalPrompt } from '../utils/prompt';


const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_FLASH_URL = `${GEMINI_API_BASE_URL}/gemini-1.5-flash:generateContent`;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Gemini AI 클라이언트 초기화
let genAI: GoogleGenAI | null = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

/**
 * Gemini API를 직접 호출하여 결과를 반환하는 함수
 * 요청과 응답을 그대로 처리합니다.
 */
export async function generateContent(requestBody: any): Promise<any> {
  try {
    console.log('Starting direct Gemini API call with custom payload');
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    
    // API 키를 URL에 추가
    const apiUrl = `${GEMINI_FLASH_URL}?key=${GEMINI_API_KEY}`;
    
    // API 호출
    console.log('Calling Gemini API with custom payload');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    // 응답 처리
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
    }
    
    // JSON 데이터 반환
    const data = await response.json();
    return data;
    
  } catch (error: any) {
    console.error('Error calling Gemini API directly:', error);
    throw new Error(`Failed to call Gemini API: ${error.message}`);
  }
}

/**
 * Gemini 모델을 사용하여 이미지를 생성하는 함수
 */
export async function generateImageWithGemini(
  promptText: string
): Promise<string> {
  try {
    console.log('Starting image generation with Gemini API');
    console.log('Prompt:', promptText);
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    
    // Gemini API 요청 데이터 준비
    const requestData = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Create a ${promptText}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048
      }
    };
    
    // API 키를 URL에 추가
    const apiUrl = `${GEMINI_FLASH_URL}?key=${GEMINI_API_KEY}`;
    
    // API 호출
    console.log('Calling Gemini API to generate image');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    // 응답 처리
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Gemini API response received:', JSON.stringify(data).substring(0, 200) + '...');
    
    // 이미지 URL 추출 (응답 구조에 따라 수정 필요할 수 있음)
    let imageUrl;
    
    try {
      // 응답에서 이미지 데이터 또는 URL 추출
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const content = data.candidates[0].content;
        
        // 이미지 파트 찾기
        for (const part of content.parts) {
          if (part.inlineData && part.inlineData.data) {
            // 이미지 데이터가 있는 경우 (base64 인코딩)
            imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          } else if (part.fileData && part.fileData.fileUri) {
            // 이미지 URL이 있는 경우
            imageUrl = part.fileData.fileUri;
            break;
          } else if (part.text && part.text.includes('http')) {
            // 텍스트에 URL이 포함된 경우 (응급 처리)
            const match = part.text.match(/(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/i);
            if (match) {
              imageUrl = match[0];
              break;
            }
          }
        }
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
    }
    
    if (!imageUrl) {
      console.error('No image found in Gemini response:', data);
      throw new Error('Failed to extract image URL from Gemini response');
    }
    
    console.log('Successfully extracted image URL:', imageUrl.substring(0, 50) + '...');
    return imageUrl;
    
  } catch (error: any) {
    console.error('Error generating image with Gemini:', error);
    throw new Error(`Failed to generate image: ${error.message}`);
  }
}

/**
 * Gemini 2.5 Flash Image Preview를 사용한 이미지 생성
 * 이미지 변환이 아닌 새로운 이미지 생성 (원본 이미지 불필요)
 */
export async function generateImageWithGemini25(
  prompt: string
): Promise<string> {
  try {
    console.log('🎨 [Gemini 2.5] 이미지 생성 시작');
    console.log('프롬프트:', prompt);

    if (!genAI) {
      throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');
    }

    console.log('🎯 [Gemini 2.5] 프롬프트 길이:', prompt.length);

    // 이미지 생성 요청
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image-preview", // Gemini 2.5 Flash Image Preview 모델
      contents: [{
        role: "user",
        parts: [{
          text: prompt
        }]
      }],
      config: {
        responseModalities: ["IMAGE", "TEXT"], // 이미지 생성 모드 활성화
        temperature: 1,          // 이미지의 설정값과 동일하게
        topP: 0.95,             // Top P 추가
        maxOutputTokens: 8192
      }
    });

    console.log('📥 [Gemini 2.5] 응답 수신');
    
    // 응답 구조 상세 로깅
    console.log('🔍 [Gemini 2.5] 응답 구조 분석:', {
      hasCandidates: !!response.candidates,
      candidatesLength: response.candidates?.length,
      firstCandidate: response.candidates?.[0] ? {
        hasContent: !!response.candidates[0].content,
        hasParts: !!response.candidates[0].content?.parts,
        partsLength: response.candidates[0].content?.parts?.length
      } : null,
      fullResponse: JSON.stringify(response, null, 2).substring(0, 500) + "..."
    });

    // 이미지 데이터 추출
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        console.log('🔍 [Gemini 2.5] Part 분석:', {
          hasInlineData: !!part.inlineData,
          hasData: !!part.inlineData?.data,
          mimeType: part.inlineData?.mimeType,
          hasText: !!part.text,
          partType: typeof part
        });
        
        if (part.inlineData?.data) {
          console.log('✅ [Gemini 2.5] 이미지 생성 성공');
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    // 대안적 응답 구조 확인
    if (response.data) {
      console.log('🔍 [Gemini 2.5] 대안 응답 구조 확인 - response.data 존재');
      return response.data;
    }
    
    throw new Error('이미지 생성 결과를 찾을 수 없습니다');
  } catch (error: any) {
    console.error('❌ [Gemini 2.5] 이미지 생성 실패:', error);
    throw new Error(`Gemini 2.5 이미지 생성 실패: ${error.message}`);
  }
}

/**
 * 통일된 Gemini 2.5 Flash Image Preview 이미지 변환 함수
 * OpenAI와 동일한 프롬프트 구조 사용
 * @param template 관리자 설정 기본 프롬프트 템플릿 (필수)
 * @param systemPrompt 관리자 설정 시스템 프롬프트 (선택)
 * @param imageBuffer 원본 이미지 버퍼 (필수)
 * @param variables 변수 치환용 (선택)
 * @returns 변환된 이미지 URL
 */
export async function transformWithGemini(
  template: string,
  systemPrompt: string | undefined,
  imageBuffer: Buffer,
  variables?: Record<string, string>
): Promise<string> {
  try {
    console.log('🔥 [Gemini 변환] 간소화된 통일 프로세스 시작');

    if (!genAI) {
      throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');
    }

    // 1. 공유 프롬프트 빌더로 최종 프롬프트 생성
    const finalPrompt = buildFinalPrompt({
      template,
      systemPrompt,
      variables
    });
    
    console.log('🎯 [Gemini 변환] 최종 프롬프트 길이:', finalPrompt.length);

    // 이미지를 Base64로 인코딩
    const base64Image = imageBuffer.toString('base64');

    // 2. Gemini 2.5 Flash Image Preview 직접 호출
    console.log('⚡ [Gemini 변환] Gemini 2.5 Flash Image Preview 호출');
    const modelName = "gemini-2.5-flash-image-preview";
    console.log(`🎯 [Gemini] 사용할 모델: ${modelName}`);
    
    const response = await genAI.models.generateContent({
      model: modelName,
      contents: [{
        role: "user",
        parts: [
          {
            text: finalPrompt
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        temperature: 1,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    });

    console.log('📥 [Gemini 2.5] 변환 응답 수신');
    console.log('🔍 [Gemini 2.5] 전체 응답 구조:', JSON.stringify(response, null, 2));
    
    // 응답 구조 디버깅 - 더 자세히
    console.log('🔍 [Gemini 2.5] response 타입:', typeof response);
    console.log('🔍 [Gemini 2.5] response 키들:', Object.keys(response));
    console.log('🔍 [Gemini 2.5] candidates 확인:', response.candidates);
    
    // candidates 경로 확인
    const candidates = response.candidates;
    console.log('🔍 [Gemini 2.5] candidates (직접):', candidates);
    
    if (candidates && candidates[0]) {
      console.log('🔍 [Gemini 2.5] content 확인:', candidates[0].content);
      console.log('🔍 [Gemini 2.5] parts 확인:', candidates[0].content?.parts);
    }

    // 변환된 이미지 데이터 추출
    const actualCandidates = response.candidates;
    
    if (actualCandidates?.[0]?.content?.parts) {
      console.log('🎯 [Gemini 2.5] 후보들에서 이미지 데이터 검색 중...');
      for (const part of actualCandidates[0].content.parts) {
        if (part.inlineData?.data) {
          console.log('✅ [Gemini 2.5] 이미지 변환 성공');
          const mimeType = part.inlineData.mimeType || 'image/png';
          
          // Base64를 Buffer로 변환하여 저장 준비
          const imageData = Buffer.from(part.inlineData.data, 'base64');
          
          // 이미지를 로컬에 저장하고 URL 반환
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const datePath = `${year}/${month}/${day}`;
          
          const uuid = uuidv4();
          const filename = `${uuid}.webp`;
          
          const fullDir = path.join(process.cwd(), 'uploads', 'full', datePath);
          await fs.promises.mkdir(fullDir, { recursive: true });
          
          const fullPath = path.join(fullDir, filename);
          await fs.promises.writeFile(fullPath, imageData);
          
          // URL 형식으로 반환
          const imageUrl = `/uploads/full/${datePath}/${filename}`;
          console.log('💾 [Gemini 2.5] 이미지 저장 완료:', imageUrl);
          console.log('✅ [Gemini 변환] 간소화된 프로세스 완료');
          
          return imageUrl;
        }
      }
    }
    
    // 응답 구조 분석 완료
    console.log('🔍 [Gemini 2.5] 이미지 데이터 검색 실패');
    
    throw new Error('변환된 이미지를 찾을 수 없습니다');
  } catch (error: any) {
    console.error('❌ [Gemini 변환] 실패:', error);
    throw new Error(`Gemini 이미지 변환 실패: ${error.message}`);
  }
}