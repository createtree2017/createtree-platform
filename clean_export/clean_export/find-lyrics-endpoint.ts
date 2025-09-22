/**
 * TopMediai 가사 API 실제 엔드포인트 탐색
 */

const API_KEY = process.env.TOPMEDIA_API_KEY || '0696de496a39450790a5582fe823c730';

async function findWorkingEndpoint() {
  console.log('🔍 TopMediai 가사 API 엔드포인트 탐색');
  
  const baseUrls = [
    'https://aimusic-api.topmediai.com',
    'https://api.topmediai.com',
    'https://topmedia-api.com',
    'https://music-api.topmediai.com'
  ];
  
  const endpoints = [
    '/v1/lyrics',
    '/lyrics',
    '/api/lyrics',
    '/api/v1/lyrics',
    '/v2/lyrics',
    '/music/lyrics',
    '/generate/lyrics',
    '/ai/lyrics'
  ];

  const testPayload = {
    prompt: "아기 자장가"
  };

  for (const baseUrl of baseUrls) {
    console.log(`\n🌐 테스트 베이스 URL: ${baseUrl}`);
    
    for (const endpoint of endpoints) {
      const fullUrl = `${baseUrl}${endpoint}`;
      console.log(`  📡 시도: ${endpoint}`);
      
      try {
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testPayload)
        });

        console.log(`    응답: ${response.status} ${response.statusText}`);
        
        if (response.status !== 404) {
          const data = await response.text();
          console.log(`    ✅ 응답 받음: ${data.substring(0, 100)}...`);
          
          if (response.ok) {
            console.log(`\n🎉 작동하는 엔드포인트 발견: ${fullUrl}`);
            return fullUrl;
          }
        }
        
      } catch (error) {
        console.log(`    ❌ 연결 실패: ${error.message}`);
      }
      
      // API 부하 방지
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('\n❌ 작동하는 가사 API 엔드포인트를 찾지 못했습니다.');
  return null;
}

findWorkingEndpoint();