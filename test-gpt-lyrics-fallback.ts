/**
 * GPT 기반 가사 생성 대체 시스템 테스트
 */

import { generateAiMusic } from "./server/services/topmedia-service";

async function testGPTLyricsFallback() {
  console.log("🎵 GPT 가사 생성 대체 시스템 테스트 시작");
  
  try {
    const result = await generateAiMusic({
      prompt: "사랑하는 아기를 위한 따뜻한 자장가",
      style: "lullaby",
      duration: 180,
      userId: "test-user-123",
      babyName: "민준",
      generateLyrics: true,
      instrumental: false,
      gender: "female",
      title: "우리 아기를 위한 자장가"
    });
    
    console.log("음악 생성 결과:", result);
    
  } catch (error) {
    console.error("테스트 실패:", error);
  }
}

testGPTLyricsFallback();