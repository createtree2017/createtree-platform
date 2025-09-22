/**
 * 간단한 음악 생성 테스트
 */

import { generateAiMusic } from './server/services/topmedia-service';

async function testSimpleMusic() {
  console.log('🎵 간단한 음악 생성 테스트 시작...');
  
  try {
    const result = await generateAiMusic({
      prompt: '테스트 자장가',
      title: '무한로딩 수정 테스트',
      style: 'lullaby',
      generateLyrics: false, // 가사 생성 건너뛰기
      instrumental: false,
      gender: 'female',
      userId: '10',
      duration: 60
    });
    
    if (result.success) {
      console.log('✅ 음악 생성 성공');
      console.log('🎵 URL:', result.url);
      console.log('📋 작업 ID:', result.taskId);
    } else {
      console.log('❌ 실패:', result.error);
    }
    
  } catch (error) {
    console.error('🚨 오류:', error);
  }
}

testSimpleMusic();