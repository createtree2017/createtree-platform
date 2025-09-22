/**
 * TopMediai v1 통일 워크플로우 테스트
 */

import { generateAiMusic } from "./server/services/topmedia-service";

async function testV1UnifiedWorkflow() {
  console.log("TopMediai v1 통일 워크플로우 테스트");
  
  try {
    const result = await generateAiMusic({
      prompt: "아기를 위한 부드러운 자장가",
      style: "lullaby", 
      duration: 180,
      userId: "test-123",
      babyName: "아기",
      generateLyrics: true,
      instrumental: false,
      gender: "female",
      title: "따뜻한 자장가"
    });
    
    console.log("최종 결과:", result);
    
  } catch (error) {
    console.error("워크플로우 오류:", error);
  }
}

testV1UnifiedWorkflow();