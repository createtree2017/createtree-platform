/**
 * Simplified OpenAI Service 
 * DALL-E 3 이미지 생성을 위한 간소화된 서비스
 */
import OpenAI from "openai";
import { generateWithOpenAI } from "./image-generation/openai-adapter";

// OpenAI API 키
const API_KEY = process.env.OPENAI_API_KEY;

// OpenAI 클라이언트 생성
const openai = new OpenAI({
  apiKey: API_KEY,
  organization: undefined // organization 헤더 제거
});

// 간단한 API 키 유효성 검증
function isValidApiKey(apiKey: string | undefined): boolean {
  return !!apiKey && (apiKey.startsWith('sk-') || apiKey.startsWith('sk-proj-'));
}

console.log("OpenAI 클라이언트 생성됨");

// 서비스 불가능 상태 메시지
const SERVICE_UNAVAILABLE = "https://placehold.co/1024x1024/A7C1E2/FFF?text=현재+이미지생성+서비스가+금일+종료+되었습니다";

/**
 * DALL-E 3를 사용하여 이미지 생성
 */
export async function generateImage(promptText: string): Promise<string> {
  try {
    const result = await generateWithOpenAI({
      modelKey: "openai_gpt1_5",
      prompt: promptText,
      isTextOnly: true,
    });
    return result.imageUrl;
  } catch (error) {
    console.error("이미지 생성 중 오류 발생:", error);
    return SERVICE_UNAVAILABLE;
  }
}

/**
 * DALL-E 3를 사용하여 이미지 변환
 */
export async function transformImage(
  imageBuffer: Buffer,
  style: string,
  customPromptTemplate?: string | null
): Promise<string> {
  try {
    const result = await generateWithOpenAI({
      modelKey: "openai_gpt1_5",
      prompt: customPromptTemplate || style || "Transform this image into a beautiful artistic style",
      imageBuffer,
      isTextOnly: false,
    });
    return result.imageUrl;
  } catch (error) {
    console.error("이미지 변환 중 오류 발생:", error);
    return SERVICE_UNAVAILABLE;
  }
}

/**
 * OpenAI GPT를 사용하여 채팅 응답 생성
 */
export async function generateChatResponse(userMessage: string, systemPrompt?: string): Promise<string> {
  try {
    // API 키 확인
    if (!isValidApiKey(API_KEY)) {
      console.log("유효한 API 키가 없습니다");
      return "I'm having trouble responding right now. Please try again in a moment.";
    }

    // 기본 시스템 프롬프트
    const defaultSystemPrompt = `You are MomMelody Assistant, a supportive AI companion for pregnant women and young mothers.
    Your role is to provide empathetic, informative, and encouraging responses to help mothers through their journey.
    Always be warm, patient, and positive in your tone. Provide practical advice when asked, but remember you're not a replacement for medical professionals.
    Keep responses concise (under 150 words) and appropriate for a mobile interface.`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "I'm here to support you.";
    return content;
  } catch (error) {
    console.error("Chat response generation error:", error);
    return "I'm having trouble responding right now. Please try again in a moment.";
  }
}
