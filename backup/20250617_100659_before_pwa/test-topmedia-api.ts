/**
 * TopMediai API 테스트 스크립트
 * 실제 API 엔드포인트와 파라미터를 검증합니다.
 */

import { generateAiMusic } from './server/services/topmedia-service';

async function testTopMediaiAPI() {
  console.log('=== TopMediai API 테스트 시작 ===');
  
  try {
    const result = await generateAiMusic({
      prompt: '우리 아기를 위한 자장가',
      style: 'lullaby',
      duration: 60,
      userId: 'test-user',
      hospitalId: 1
    });
    
    console.log('✅ 음악 생성 성공:', result);
    
    if (result.audioUrl) {
      console.log('🎵 생성된 음악 URL:', result.audioUrl);
    } else {
      console.log('⚠️ 음악 URL이 없습니다. 응답 구조를 확인하세요.');
    }
    
  } catch (error) {
    console.error('❌ 음악 생성 실패:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('TOPMEDIA_API_KEY')) {
        console.log('💡 TOPMEDIA_API_KEY 환경변수를 확인하세요.');
      } else if (error.message.includes('401')) {
        console.log('💡 API 키가 유효하지 않습니다.');
      } else if (error.message.includes('422')) {
        console.log('💡 API 파라미터가 올바르지 않습니다.');
      }
    }
  }
}

// 스크립트 실행
testTopMediaiAPI();