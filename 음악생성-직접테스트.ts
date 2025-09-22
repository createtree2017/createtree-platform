/**
 * TopMediai 직접 음악 생성 테스트 (가사 생성 건너뛰기)
 */
import { generateAiMusic } from './server/services/topmedia-service';

async function 직접음악생성테스트() {
  console.log('🎵 TopMediai 직접 음악 생성 테스트 (가사 제공)');
  
  const 미리준비된가사 = `[verse 1]
예승이야 우리의 보물
별처럼 빛나는 소중한 아이
부모의 사랑을 받으며
평안히 잠들어가렴

[chorus]
꿈나라에서 천사들과 놀아요
예승이의 행복한 꿈속 여행
사랑하는 우리 아기
좋은 꿈 꾸어요`;

  try {
    const 결과 = await generateAiMusic({
      prompt: '예승이를 위한 사랑스러운 자장가',
      style: 'lullaby',
      duration: 180,
      userId: '10',
      babyName: '예승이',
      generateLyrics: false, // 가사 생성 비활성화
      lyrics: 미리준비된가사, // 미리 준비된 가사 사용
      instrumental: false,
      gender: 'female',
      title: '예승이 자장가'
    });
    
    console.log('✅ 직접 테스트 결과:', {
      성공: 결과.success,
      음악URL: 결과.url || 결과.audioUrl,
      가사: 결과.lyrics ? '포함됨' : '없음',
      오류: 결과.error || '없음'
    });
    
  } catch (오류) {
    console.error('❌ 직접 테스트 실패:', 오류.message);
  }
}

직접음악생성테스트();