/**
 * Duration 파라미터 전달 테스트
 * 3분(180초) 음악 생성 요청
 */

import { generateAiMusic } from './server/services/topmedia-service';

async function testDurationFix() {
  console.log('🎵 Duration 파라미터 테스트 시작');
  
  try {
    const result = await generateAiMusic({
      prompt: "내아들 송에준",
      style: "piano",
      duration: 180, // 3분
      generateLyrics: true,
      instrumental: false,
      userId: "10",
      hospitalId: 1,
      title: "내아들 송에준",
      gender: "male"
    });
    
    console.log('✅ 음악 생성 결과:', result);
    
  } catch (error) {
    console.error('❌ 테스트 오류:', error);
  }
}

testDurationFix();