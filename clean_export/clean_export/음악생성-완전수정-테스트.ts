/**
 * 완전 수정된 TopMediai 음악 생성 테스트
 */
import { generateAiMusic } from './server/services/topmedia-service';

async function 완전수정테스트() {
  console.log('🎵 완전 수정된 음악 생성 테스트 시작');
  
  try {
    const 결과 = await generateAiMusic({
      prompt: '예승이를 위한 사랑가득한 자장가',
      style: 'lullaby',
      duration: 180,
      userId: '10',
      babyName: '예승이',
      generateLyrics: true,
      instrumental: false,
      gender: 'female',
      title: '예승이의 꿈'
    });
    
    console.log('✅ 최종 테스트 결과:', {
      성공여부: 결과.success,
      오디오URL: 결과.url || 결과.audioUrl,
      생성가사: 결과.lyrics ? '성공' : '실패',
      오류메시지: 결과.error || '없음'
    });
    
  } catch (오류) {
    console.error('❌ 테스트 실패:', 오류.message);
  }
}

완전수정테스트();