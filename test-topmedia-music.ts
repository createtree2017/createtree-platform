/**
 * TopMediai 음악 생성 API 전체 워크플로우 테스트
 */

import dotenv from 'dotenv';
dotenv.config();

const API_KEY = '0696de496a39450790a5582fe823c730';
const API_BASE_URL = 'https://api.topmediai.com';

interface SubmitMusicDTO {
  is_auto: 0 | 1;
  prompt: string;
  lyrics?: string;
  title?: string;
  instrumental: 0 | 1;
  model_version?: string;
}

async function testMusicSubmit() {
  console.log('TopMediai 음악 생성 API 테스트 시작...');

  const headers = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  };

  // 테스트 데이터
  const musicData: SubmitMusicDTO = {
    is_auto: 0,
    prompt: "우리아기 예승이는 엄마의 기쁨이야",
    lyrics: "우리아기 예승이는 엄마의 기쁨이야\n사랑스러운 미소로 날 바라봐\n작은 손으로 나를 꼭 잡아\n세상에서 가장 소중한 보물이야",
    title: "예승이 자장가",
    instrumental: 0,
    model_version: "v3.5"
  };

  try {
    // Step 1: 음악 생성 태스크 제출 테스트
    console.log('\n=== Step 1: 음악 생성 태스크 제출 ===');
    console.log('URL:', `${API_BASE_URL}/v2/submit`);
    console.log('Data:', JSON.stringify(musicData, null, 2));

    const submitResponse = await fetch(`${API_BASE_URL}/v2/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(musicData)
    });

    console.log('Submit Response status:', submitResponse.status);
    const submitText = await submitResponse.text();
    console.log('Submit Response body:', submitText);

    if (!submitResponse.ok) {
      console.error('음악 제출 실패');
      return;
    }

    let submitData;
    try {
      submitData = JSON.parse(submitText);
    } catch (e) {
      console.error('Submit 응답 JSON 파싱 실패');
      return;
    }

    const songId = submitData.song_id || submitData.data?.song_id;
    if (!songId) {
      console.error('song_id를 받을 수 없음:', submitData);
      return;
    }

    console.log('✅ 음악 생성 태스크 제출 성공! song_id:', songId);

    // Step 2: 상태 조회 테스트
    console.log('\n=== Step 2: 음악 생성 상태 조회 ===');
    
    for (let i = 0; i < 3; i++) {
      console.log(`\n--- 조회 시도 ${i + 1} ---`);
      
      const queryResponse = await fetch(`${API_BASE_URL}/v2/query?song_id=${songId}`, {
        method: 'GET',
        headers: { 'x-api-key': API_KEY }
      });

      console.log('Query Response status:', queryResponse.status);
      const queryText = await queryResponse.text();
      console.log('Query Response body:', queryText);

      if (queryResponse.ok) {
        try {
          const queryData = JSON.parse(queryText);
          console.log('파싱된 응답:', JSON.stringify(queryData, null, 2));
          
          if (queryData.url) {
            console.log('✅ 음악 생성 완료! URL:', queryData.url);
            return;
          }
        } catch (e) {
          console.error('Query 응답 JSON 파싱 실패');
        }
      }

      // 3초 대기
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('음악 생성이 아직 진행 중입니다.');

  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  }
}

testMusicSubmit();