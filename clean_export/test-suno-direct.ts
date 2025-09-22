/**
 * Suno API 직접 테스트
 * 다양한 엔드포인트와 방법으로 테스트
 */

async function testSunoAPI() {
  const apiKey = process.env.SUNO_API_KEY;
  console.log('🔑 Suno API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '없음');
  
  // 테스트할 엔드포인트들
  const endpoints = [
    'https://studio-api.suno.ai/api/generate/v2/',
    'https://api.aimlapi.com/v2/generate/audio/suno-ai/v4/music',
    'https://suno-api.netfly.top/api/generate',
    'https://api.suno.com/v1/generate'
  ];
  
  const testPayload = {
    prompt: '아기가 좋아하는 밝고 경쾌한 동요',
    title: 'Suno 테스트',
    make_instrumental: false,
    model: 'chirp-v3-5'
  };
  
  for (const endpoint of endpoints) {
    console.log(`\n🔍 테스트 중: ${endpoint}`);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'CreateTree-AI/1.0'
        },
        body: JSON.stringify(testPayload)
      });
      
      console.log(`📊 응답 상태: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ 성공 응답:', JSON.stringify(data, null, 2).substring(0, 500));
        break;
      } else {
        const errorText = await response.text();
        console.log(`❌ 오류 응답: ${errorText.substring(0, 200)}`);
      }
      
    } catch (error) {
      console.log(`❌ 네트워크 오류:`, error.message);
    }
  }
  
  // API 키 유효성 별도 확인
  console.log('\n🔐 API 키 형식 검증:');
  if (apiKey) {
    console.log(`- 길이: ${apiKey.length}`);
    console.log(`- 형식: ${apiKey.startsWith('sk-') ? 'OpenAI 스타일' : 'Other'}`);
    console.log(`- 패턴: ${apiKey.includes('-') ? '하이픈 포함' : '단순 문자열'}`);
  }
}

testSunoAPI().then(() => {
  console.log('\n🏁 Suno API 테스트 완료');
  process.exit(0);
}).catch(error => {
  console.error('❌ 테스트 실행 오류:', error);
  process.exit(1);
});