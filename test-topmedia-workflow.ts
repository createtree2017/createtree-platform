/**
 * TopMediai v2 워크플로우 완전 테스트 - 작업지시서 기준
 * 3단계 워크플로우: 가사 생성 → 음악 생성 제출 → 상태 폴링
 */
import { generateAiMusic } from './server/services/topmedia-service';

async function testCompleteWorkflow() {
  console.log('🎵 TopMediai v2 완전 워크플로우 테스트 시작');
  
  try {
    const result = await generateAiMusic({
      prompt: '아기를 위한 따뜻한 자장가',
      style: 'lullaby',
      duration: 60,
      userId: '10',
      babyName: '테스트베이비',
      generateLyrics: true,
      instrumental: false,
      gender: 'female'
    });
    
    console.log('✅ 테스트 결과:', {
      성공여부: result.success,
      오디오URL: result.url || result.audioUrl,
      가사: result.lyrics ? result.lyrics.substring(0, 100) + '...' : '없음',
      메타데이터: result.metadata,
      에러: result.error
    });
    
    if (result.success) {
      console.log('🎉 TopMediai v2 워크플로우 테스트 성공!');
    } else {
      console.log('❌ 테스트 실패:', result.error);
    }
    
  } catch (error) {
    console.error('💥 테스트 중 오류 발생:', error);
  }
}

// 테스트 실행
testCompleteWorkflow();