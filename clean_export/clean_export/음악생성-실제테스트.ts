/**
 * TopMediai v2 실제 음악 생성 테스트
 * 한국어 개발 지침에 따른 실제 워크플로우 검증
 */
import { generateAiMusic } from './server/services/topmedia-service';

async function 실제음악생성테스트() {
  console.log('🎵 TopMediai v2 실제 음악 생성 테스트 시작');
  
  try {
    const 결과 = await generateAiMusic({
      prompt: '우리 아기를 위한 따뜻하고 부드러운 자장가',
      style: 'lullaby',
      duration: 180,
      userId: '10',
      babyName: '소중한아기',
      generateLyrics: true,
      instrumental: false,
      gender: 'female',
      title: '아기를 위한 자장가'
    });
    
    console.log('✅ 음악 생성 결과:', {
      성공여부: 결과.success,
      오디오주소: 결과.url || 결과.audioUrl,
      생성된가사: 결과.lyrics ? 결과.lyrics.substring(0, 100) + '...' : '가사없음',
      작업아이디: 결과.taskId,
      사용크레딧: 결과.creditUsed,
      오류메시지: 결과.error
    });
    
    if (결과.success) {
      console.log('🎉 음악 생성 성공! 데이터베이스에 저장 완료');
      console.log('📁 GCS 업로드:', 결과.url?.includes('storage.googleapis.com') ? '성공' : '원본URL사용');
    } else {
      console.log('❌ 음악 생성 실패:', 결과.error);
    }
    
  } catch (오류) {
    console.error('💥 테스트 중 오류:', 오류.message);
  }
}

// 실제 테스트 실행
실제음악생성테스트();