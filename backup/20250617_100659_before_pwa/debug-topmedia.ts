/**
 * TopMediai API 디버깅 스크립트
 * 실제 API 응답 구조를 확인하여 문제점 파악
 */

const API_BASE_URL = 'https://api.topmediai.com';
const API_KEY = process.env.TOPMEDIA_API_KEY || '0696de496a39450790a5582fe823c730';

async function debugTopMediaiAPI() {
  console.log('🔍 TopMediai API 디버깅 시작...');
  console.log('API_BASE_URL:', API_BASE_URL);
  console.log('API_KEY:', API_KEY ? '설정됨' : '없음');

  // Step 1: 가사 생성 테스트
  console.log('\n📝 Step 1: 가사 생성 API 테스트');
  try {
    const lyricsResponse = await fetch(`${API_BASE_URL}/v1/lyrics`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: "우리아기를 위한 따뜻한 자장가",
        style: "lullaby"
      })
    });

    console.log('가사 API 응답 상태:', lyricsResponse.status);
    console.log('가사 API 응답 헤더:', Object.fromEntries(lyricsResponse.headers.entries()));
    
    const lyricsText = await lyricsResponse.text();
    console.log('가사 API 응답 본문:', lyricsText);

    if (lyricsResponse.ok) {
      try {
        const lyricsData = JSON.parse(lyricsText);
        console.log('가사 JSON 파싱 성공:', lyricsData);
      } catch (e) {
        console.log('가사 JSON 파싱 실패, 텍스트 응답:', lyricsText);
      }
    }
  } catch (error) {
    console.error('가사 API 오류:', error);
  }

  // Step 2: 음악 생성 제출 테스트
  console.log('\n🎵 Step 2: 음악 생성 제출 API 테스트');
  try {
    const submitResponse = await fetch(`${API_BASE_URL}/v2/submit`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        is_auto: 1,
        prompt: "피아노와 함께하는 부드러운 자장가",
        instrumental: 0,
        model_version: "chirp-v3-5"
      })
    });

    console.log('제출 API 응답 상태:', submitResponse.status);
    console.log('제출 API 응답 헤더:', Object.fromEntries(submitResponse.headers.entries()));
    
    const submitText = await submitResponse.text();
    console.log('제출 API 응답 본문:', submitText);

    if (submitResponse.ok) {
      try {
        const submitData = JSON.parse(submitText);
        console.log('제출 JSON 파싱 성공:', submitData);
        console.log('응답 필드들:', Object.keys(submitData));
      } catch (e) {
        console.log('제출 JSON 파싱 실패, 텍스트 응답:', submitText);
      }
    }
  } catch (error) {
    console.error('제출 API 오류:', error);
  }

  // Step 3: 다른 엔드포인트 테스트
  console.log('\n🔄 Step 3: 기타 엔드포인트 테스트');
  
  const testEndpoints = [
    '/v1/models',
    '/v1/status',
    '/v1/health',
    '/api/status',
    '/health'
  ];

  for (const endpoint of testEndpoints) {
    try {
      console.log(`\n테스트 중: ${endpoint}`);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        }
      });

      console.log(`${endpoint} 응답 상태:`, response.status);
      const text = await response.text();
      console.log(`${endpoint} 응답:`, text.substring(0, 200));
    } catch (error) {
      console.log(`${endpoint} 오류:`, error.message);
    }
  }
}

// 실행
debugTopMediaiAPI().catch(console.error);