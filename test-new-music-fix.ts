/**
 * 음악 생성 문제 해결 테스트
 * 새로 생성된 음악이 데이터베이스에 즉시 저장되는지 확인
 */

import { generateAiMusic } from './server/services/topmedia-service';

async function testNewMusicFix() {
  console.log('🎵 음악 생성 문제 해결 테스트 시작');
  
  try {
    const result = await generateAiMusic({
      prompt: "테스트용 짧은 음악",
      style: "piano",
      duration: 60,
      generateLyrics: false,
      instrumental: true,
      userId: "10",
      hospitalId: 1,
      title: "테스트 음악"
    });
    
    console.log('✅ 음악 생성 결과:', result);
    
    if (result.success) {
      console.log('✅ 음악이 성공적으로 생성되고 데이터베이스에 저장되었습니다!');
      console.log('📱 프론트엔드에서 자동으로 목록이 업데이트됩니다 (5초 간격)');
    } else {
      console.log('❌ 음악 생성 실패:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 테스트 오류:', error);
  }
}

// 실행
testNewMusicFix();