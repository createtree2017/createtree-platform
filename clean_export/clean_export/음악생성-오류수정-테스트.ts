/**
 * 수정된 TopMediai 음악 생성 테스트
 * 실제 API 응답 구조에 맞게 수정 완료
 */
import { generateAiMusic } from './server/services/topmedia-service';

async function 수정된음악생성테스트() {
  console.log('🎵 수정된 TopMediai 음악 생성 테스트');
  
  try {
    const 결과 = await generateAiMusic({
      prompt: '송예승을 위한 사랑스러운 자장가',
      style: 'lullaby', 
      duration: 180,
      userId: '10',
      babyName: '예승이',
      generateLyrics: true,
      instrumental: false,
      gender: 'female',
      title: '예승이 자장가'
    });
    
    console.log('✅ 최종 결과:', {
      성공: 결과.success,
      음악URL: 결과.url || 결과.audioUrl,
      가사: 결과.lyrics ? '생성됨' : '없음',
      오류: 결과.error
    });
    
  } catch (오류) {
    console.error('테스트 실패:', 오류.message);
  }
}

수정된음악생성테스트();