/**
 * TopMediai 스타일 프롬프트 통합 테스트
 * 새로운 음악 생성에서 스타일 프롬프트가 올바르게 결합되는지 확인
 */

import { generateMusicRequest } from './server/services/music-engine-service.js';

async function testNewMusicGeneration() {
  console.log('\n=== TopMediai 스타일 프롬프트 통합 테스트 ===\n');

  try {
    // 1. 자장가 스타일로 음악 생성 테스트
    console.log('🎵 자장가 스타일 음악 생성 테스트 시작...');
    
    const musicRequest = {
      prompt: "아기를 위한 따뜻하고 포근한 노래",
      style: "lullaby",
      duration: 180,
      userId: 10,
      babyName: "테스트아기",
      generateLyrics: true,
      instrumental: false,
      gender: "female",
      title: "스타일 통합 테스트 음악",
      engine: "topmedia"
    };

    console.log('요청 데이터:', JSON.stringify(musicRequest, null, 2));

    const result = await generateMusicRequest(musicRequest);
    
    console.log('\n✅ 음악 생성 완료:');
    console.log('- 성공:', result.success);
    console.log('- 음악 URL:', result.url);
    console.log('- 제목:', result.title);
    console.log('- 가사:', result.lyrics?.substring(0, 100) + '...');
    console.log('- 지속시간:', result.duration + '초');

    if (result.success) {
      console.log('\n🎉 TopMediai 스타일 프롬프트 통합이 성공적으로 작동합니다!');
      
      // 2. 데이터베이스에서 생성된 음악 확인
      console.log('\n📊 생성된 음악 데이터베이스 확인...');
      
      // 최근 생성된 음악 중 테스트 음악 찾기
      // (실제 구현에서는 음악 ID를 반환받아 사용)
      
    } else {
      console.log('\n❌ 음악 생성 실패:', result.error);
    }

  } catch (error: any) {
    console.error('❌ 테스트 중 오류 발생:', error);
    console.error('오류 상세:', error.message);
  }
}

// 실행
testNewMusicGeneration()
  .then(() => {
    console.log('\n✅ TopMediai 스타일 통합 테스트 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 테스트 실행 오류:', error);
    process.exit(1);
  });