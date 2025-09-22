/**
 * TopMediai API 상태 확인 스크립트
 */
async function testTopMediaiStatus() {
  console.log('TopMediai API 상태 확인 중...');
  
  const apiKey = process.env.TOPMEDIA_API_KEY;
  if (!apiKey) {
    console.log('❌ TOPMEDIA_API_KEY 환경변수가 설정되지 않음');
    return;
  }
  
  try {
    // 음악 생성 제출 API 테스트
    const submitResponse = await fetch('https://api.topmediai.com/v2/submit', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        is_auto: 0,
        prompt: 'test',
        lyrics: 'test lyrics',
        title: 'test',
        instrumental: 0,
        model_version: 'v4.0'
      })
    });
    
    console.log('Submit API 응답 상태:', submitResponse.status);
    const submitData = await submitResponse.text();
    console.log('Submit API 응답:', submitData.substring(0, 200));
    
  } catch (error) {
    console.error('API 테스트 실패:', error.message);
  }
}

testTopMediaiStatus();