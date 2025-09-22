/**
 * TopMediai 완전 워크플로우 테스트
 * 가사 생성 + 음악 생성 + 상태 폴링
 */

import { generateAiMusic } from "./server/services/topmedia-service";

async function testCompleteWorkflow() {
  console.log("TopMediai 완전 워크플로우 테스트 시작");
  
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
    
    console.log("=== 최종 결과 ===");
    console.log("성공:", result.success);
    console.log("음악 URL:", result.url || result.audioUrl);
    console.log("제목:", result.title);
    console.log("가사:", result.lyrics);
    console.log("길이:", result.duration);
    
    if (result.error) {
      console.log("오류:", result.error);
    }
    
  } catch (error) {
    console.error("워크플로우 테스트 실패:", error);
  }
}

testCompleteWorkflow();