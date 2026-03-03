import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function testGeminiModel() {
  console.log('=== Gemini 모델 테스트 시작 ===\n');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
    return;
  }

  const genAI = new GoogleGenAI({ apiKey });
  
  // 테스트할 모델명들
  const modelNames = [
    'gemini-2.5-flash-image-preview',  // 우리가 사용하려는 모델
    'gemini-2.0-flash-exp',             // 사용자가 말한 현재 사용되는 모델
    'gemini-1.5-flash',                 // 일반적인 Gemini Flash 모델
    'gemini-pro-vision'                 // Vision 모델
  ];

  for (const modelName of modelNames) {
    console.log(`\n📌 테스트 모델: ${modelName}`);
    console.log('----------------------------------------');
    
    try {
      // genAI.models.generateContent 형식으로 사용
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: [{
          role: 'user',
          parts: [{ text: 'Say "Hello" in one word' }]
        }],
        config: {
          temperature: 0.4,
          maxOutputTokens: 100
        }
      });
      
      console.log(`✅ 모델 ${modelName} 작동 확인`);
      
      // 응답 구조 확인
      if (result.candidates && result.candidates[0]) {
        const text = result.candidates[0].content?.parts?.[0]?.text;
        console.log(`텍스트 응답: ${text?.substring(0, 50) || '텍스트 없음'}`);
      }
      
    } catch (error: any) {
      console.log(`❌ 모델 ${modelName} 사용 불가`);
      console.log(`에러: ${error.message?.substring(0, 200)}`);
      if (error.response) {
        console.log(`API 응답:`, error.response?.data || error.response);
      }
    }
  }
  
  console.log('\n\n=== 실제 사용 가능한 이미지 생성 모델 확인 ===');
  
  // 이미지 생성을 위한 정확한 API 사용법 테스트
  try {
    const modelForImage = 'gemini-2.5-flash-image-preview';
    console.log(`\n🎨 이미지 생성 모델 테스트: ${modelForImage}`);
    
    const imagePrompt = 'Create a simple test image';
    console.log(`프롬프트: ${imagePrompt}`);
    
    const result = await genAI.models.generateContent({
      model: modelForImage,
      contents: [{
        role: 'user',
        parts: [{ text: imagePrompt }]
      }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        temperature: 0.4,
        maxOutputTokens: 8192,
      }
    });

    console.log('✅ 이미지 생성 요청 성공');
    console.log('응답 구조:', Object.keys(result));
    
    // 실제 응답 내용 확인
    if (result.candidates && result.candidates[0]) {
      const candidate = result.candidates[0];
      console.log('Candidate 구조:', Object.keys(candidate));
      if (candidate.content) {
        console.log('Content 구조:', Object.keys(candidate.content));
        if (candidate.content.parts) {
          console.log('Parts 개수:', candidate.content.parts.length);
          for (const part of candidate.content.parts) {
            console.log('Part 타입:', Object.keys(part));
          }
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ 이미지 생성 실패:', error.message);
    console.error('전체 에러:', error);
  }
  
  console.log('\n=== 테스트 완료 ===');
}

testGeminiModel().catch(console.error);