/**
 * TopMediai v2 통일 시스템 테스트
 */

import { generateAiMusic } from "./server/services/topmedia-service";

async function testV2UnifiedSystem() {
  console.log("TopMediai v2 통일 시스템 테스트");
  
  try {
    const result = await generateAiMusic({
      prompt: "부드러운 아기 자장가",
      style: "lullaby", 
      duration: 180,
      userId: "test-v2",
      babyName: "아기",
      generateLyrics: true,
      instrumental: false,
      gender: "female",
      title: "v2 자장가 테스트"
    });
    
    console.log("=== v2 시스템 최종 결과 ===");
    console.log("성공:", result.success);
    console.log("URL:", result.url || result.audioUrl);
    console.log("제목:", result.title);
    console.log("가사:", result.lyrics);
    console.log("오류:", result.error);
    
  } catch (error) {
    console.error("v2 시스템 오류:", error);
  }
}

testV2UnifiedSystem();