/**
 * TopMediai API 성별 옵션 테스트
 */

const API_KEY = '0696de496a39450790a5582fe823c730';
const API_BASE_URL = 'https://api.topmediai.com';

async function testGenderOptions() {
  console.log('TopMediai 성별 옵션 테스트...');

  const headers = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  };

  // 성별 옵션이 있는 음악 생성 요청 테스트
  const testData = [
    {
      name: "기본 요청",
      data: {
        is_auto: 0,
        prompt: "우리아기를 위한 자장가",
        lyrics: "우리아기 예승이는 엄마의 기쁨이야",
        title: "예승이 자장가",
        instrumental: 0,
        model_version: "v3.5"
      }
    },
    {
      name: "남성 보컬",
      data: {
        is_auto: 0,
        prompt: "우리아기를 위한 자장가",
        lyrics: "우리아기 예승이는 엄마의 기쁨이야",
        title: "예승이 자장가",
        instrumental: 0,
        model_version: "v3.5",
        gender: "male"
      }
    },
    {
      name: "여성 보컬",
      data: {
        is_auto: 0,
        prompt: "우리아기를 위한 자장가",
        lyrics: "우리아기 예승이는 엄마의 기쁨이야",
        title: "예승이 자장가",
        instrumental: 0,
        model_version: "v3.5",
        gender: "female"
      }
    },
    {
      name: "voice_type 옵션",
      data: {
        is_auto: 0,
        prompt: "우리아기를 위한 자장가",
        lyrics: "우리아기 예승이는 엄마의 기쁨이야",
        title: "예승이 자장가",
        instrumental: 0,
        model_version: "v3.5",
        voice_type: "female"
      }
    }
  ];

  for (const test of testData) {
    try {
      console.log(`\n=== ${test.name} 테스트 ===`);
      console.log('요청 데이터:', JSON.stringify(test.data, null, 2));
      
      const response = await fetch(`${API_BASE_URL}/v2/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify(test.data)
      });

      console.log('응답 상태:', response.status);
      const responseText = await response.text();
      console.log('응답 내용:', responseText.substring(0, 300));

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          if (data.song_id) {
            console.log('✅ 성공! song_id:', data.song_id);
          }
        } catch (e) {
          console.log('JSON 파싱 실패');
        }
      }

      // 다음 요청 전 잠깐 대기
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`${test.name} 테스트 실패:`, error);
    }
  }
}

testGenderOptions();