/**
 * 간단한 TopMediai API 테스트 - 작업지시서 기준
 */
import { submitMusicTask, queryMusic } from '../../server/services/topmedia-service';

async function testSimpleTopMediai() {
  console.log('🎵 TopMediai API 단순 테스트 시작');
  
  try {
    // Step 1: 음악 생성 작업 제출
    console.log('Step 1: 음악 생성 작업 제출 중...');
    const songId = await submitMusicTask({
      is_auto: 0,
      prompt: '아기 자장가',
      lyrics: '잠자라 우리 아기 꿈나라로 가자',
      title: '테스트 자장가',
      instrumental: 0,
      model_version: 'v4.0'
    });
    
    console.log('✅ 음악 작업 제출 성공, songId:', songId);
    
    // Step 2: 상태 확인
    console.log('Step 2: 상태 확인 중...');
    const result = await queryMusic(songId);
    console.log('✅ 상태 확인 결과:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  }
}

// 테스트 실행
testSimpleTopMediai();