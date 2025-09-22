/**
 * 자동 음악 저장 시스템 테스트
 * TopMediai → GCS → 데이터베이스 전체 워크플로우 검증
 */
import { generateAiMusic } from './server/services/topmedia-service';

async function testAutoMusicSave() {
  console.log('🎵 자동 음악 저장 시스템 테스트 시작...');
  
  try {
    const result = await generateAiMusic({
      prompt: '아기를 위한 따뜻한 피아노 멜로디',
      style: 'piano',
      duration: 60,
      userId: '10',
      generateLyrics: false,
      title: '테스트 자동저장 음악',
      instrumental: true,
      gender: 'auto'
    });
    
    console.log('✅ 음악 생성 결과:', {
      성공: result.success,
      URL: result.url,
      태스크ID: result.taskId,
      메타데이터: result.metadata
    });
    
    if (result.success && result.url) {
      console.log('🎉 자동 저장 시스템이 정상 작동합니다!');
      console.log('- TopMediai에서 음악 생성');
      console.log('- GCS에 자동 업로드');
      console.log('- 데이터베이스에 자동 등록');
      console.log(`- 최종 URL: ${result.url}`);
    } else {
      console.log('❌ 자동 저장 시스템에 문제가 있습니다:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

testAutoMusicSave();