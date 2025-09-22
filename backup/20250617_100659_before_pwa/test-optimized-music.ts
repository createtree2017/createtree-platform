/**
 * 최적화된 TopMediai v2 시스템 실제 음악 생성 테스트
 */

import { generateAiMusic } from "./server/services/topmedia-service";

async function testOptimizedMusicGeneration() {
  console.log("최적화된 음악 생성 시스템 테스트");
  
  try {
    // 가사 생성 없이 음악만 생성하는 테스트
    const result = await generateAiMusic({
      prompt: "gentle baby lullaby music",
      style: "lullaby", 
      duration: 180,
      userId: "test-optimized",
      babyName: "아기",
      generateLyrics: false, // 가사 생성 비활성화
      instrumental: false,
      gender: "female",
      title: "최적화된 자장가",
      lyrics: "" // 빈 가사로 시작
    });
    
    console.log("=== 최적화된 음악 생성 결과 ===");
    console.log("성공:", result.success);
    console.log("URL:", result.url || result.audioUrl);
    console.log("제목:", result.title);
    console.log("가사:", result.lyrics);
    console.log("길이:", result.duration);
    
    if (result.error) {
      console.log("오류:", result.error);
    }
    
  } catch (error) {
    console.error("시스템 오류:", error);
  }
}

testOptimizedMusicGeneration();