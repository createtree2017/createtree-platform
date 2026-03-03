/**
 * 음악 데이터베이스 저장 수정 테스트
 * 완료된 음악이 데이터베이스에 자동 저장되는지 확인
 */

import { generateAiMusic } from '../../server/services/topmedia-service';

async function testMusicDatabaseFix() {
  console.log('🧪 음악 데이터베이스 저장 테스트 시작...');
  
  try {
    const testOptions = {
      prompt: '부드러운 피아노 자장가',
      style: 'lullaby',
      title: '데이터베이스 테스트곡',
      generateLyrics: true,
      instrumental: false,
      gender: 'female',
      userId: '10', // 현재 로그인된 사용자 ID
      duration: 60
    };
    
    console.log('📝 테스트 매개변수:', testOptions);
    
    const result = await generateAiMusic(testOptions);
    
    if (result.success) {
      console.log('✅ 음악 생성 성공!');
      console.log('🎵 오디오 URL:', result.url);
      console.log('📋 작업 ID:', result.taskId);
      console.log('📊 메타데이터:', result.metadata);
      console.log('✅ 데이터베이스에 자동 저장됨');
    } else {
      console.log('❌ 음악 생성 실패:', result.error);
    }
    
  } catch (error) {
    console.error('🚨 테스트 오류:', error);
  }
}

// 실행
testMusicDatabaseFix();