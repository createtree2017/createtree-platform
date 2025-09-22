/**
 * TopMediai 음악 생성 테스트 (가사 없이)
 * 가사 API가 유지보수 중이므로 음악 생성만 테스트
 */

import { submitMusicTask, queryMusic } from "./server/services/topmedia-service";

async function testMusicWithoutLyrics() {
  console.log("🎵 TopMediai 음악 생성 테스트 (가사 없이)");
  
  try {
    // Step 1: Submit music generation task
    const musicData = {
      is_auto: 1, // 자동 모드 (TopMediai가 프롬프트에서 가사 자동 생성)
      prompt: "lullaby music: 사랑하는 아기를 위한 따뜻한 자장가",
      lyrics: "", // 빈 가사 - TopMediai가 자동 생성
      title: "우리 아기를 위한 자장가",
      instrumental: 0,
      model_version: "v4.0" as const
    };
    
    console.log("1️⃣ 음악 생성 요청 제출 중...");
    const songId = await submitMusicTask(musicData);
    console.log("음악 ID 받음:", songId);
    
    // Step 2: Query music status
    console.log("2️⃣ 음악 생성 상태 확인 중...");
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      console.log(`상태 확인 시도 ${attempts + 1}/${maxAttempts}`);
      
      const result = await queryMusic(songId);
      console.log("현재 상태:", result);
      
      if (result.url || result.status === 'COMPLETED') {
        console.log("✅ 음악 생성 완료!");
        console.log("결과:", {
          url: result.url,
          title: result.title,
          lyrics: result.lyrics,
          duration: result.duration
        });
        return;
      }
      
      if (result.status === 'FAILED' || result.status === 'ERROR') {
        console.error("❌ 음악 생성 실패");
        return;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기
    }
    
    console.log("⏰ 타임아웃: 음악 생성이 완료되지 않았습니다");
    
  } catch (error) {
    console.error("❌ 테스트 실패:", error);
  }
}

testMusicWithoutLyrics();