/**
 * 인물 이름 통합 테스트
 * 수정된 코드로 인물 이름이 올바르게 반영되는지 확인
 */

import { generateAiMusic } from '../../server/services/topmedia-service';

interface TestMusicRequest {
  title: string;
  prompt: string;
  babyName: string;
  style: string;
  duration: number;
  userId: string;
  generateLyrics: boolean;
  gender: string;
}

async function testBabyNameIntegration() {
  console.log('🎵 인물 이름 통합 시스템 테스트 시작');

  const testRequest: TestMusicRequest = {
    title: '송기우의 자장가',
    prompt: '편안하고 따뜻한 자장가',
    babyName: '송기우',
    style: 'lullaby',
    duration: 120,
    userId: '1',
    generateLyrics: true,
    gender: 'baby'
  };

  console.log('📝 테스트 요청 데이터:', JSON.stringify(testRequest, null, 2));

  try {
    const result = await generateAiMusic({
      prompt: testRequest.prompt,
      title: testRequest.title,
      babyName: testRequest.babyName,
      style: testRequest.style,
      duration: testRequest.duration,
      generateLyrics: testRequest.generateLyrics,
      gender: testRequest.gender
    });

    console.log('✅ 음악 생성 결과:', JSON.stringify(result, null, 2));

    if (result.lyrics) {
      const lyricsIncludeName = result.lyrics.includes(testRequest.babyName);
      console.log(`🎤 가사에 "${testRequest.babyName}" 포함 여부: ${lyricsIncludeName ? '✅' : '❌'}`);
      
      if (lyricsIncludeName) {
        console.log('🎉 성공: 인물 이름이 가사에 올바르게 반영되었습니다!');
      } else {
        console.log('⚠️ 경고: 인물 이름이 가사에 포함되지 않았습니다.');
        console.log('📄 생성된 가사:', result.lyrics);
      }
    } else {
      console.log('❌ 가사가 생성되지 않았습니다.');
    }

  } catch (error: any) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.message.includes('422')) {
      console.log('📏 프롬프트 길이 문제로 인한 실패 - 추가 최적화 필요');
    }
  }
}

// 실행
testBabyNameIntegration().catch(console.error);