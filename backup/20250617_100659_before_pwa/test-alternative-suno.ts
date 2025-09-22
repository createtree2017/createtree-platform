/**
 * 대안 Suno API 엔드포인트 테스트
 * 다양한 프록시 서비스와 엔드포인트 시도
 */

async function testAlternativeSuno() {
  const apiKey = process.env.SUNO_API_KEY;
  
  // 대안 엔드포인트들 (프록시 서비스 포함)
  const alternatives = [
    {
      name: 'Suno Clerk API',
      url: 'https://clerk.suno.com/v1/generate',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Suno 공식 API v1',
      url: 'https://api.suno.ai/v1/tracks',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Replicate Suno',
      url: 'https://api.replicate.com/v1/predictions',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: {
        version: "a45f82e1ce13ce4c2d929bcc2d77b4f0c2b3f1cf3e73cb6a3e4f6b8e7d8f9c0a",
        input: {
          prompt: "아기가 좋아하는 밝고 경쾌한 동요",
          model_version: "v3.5"
        }
      }
    }
  ];
  
  const testPayload = {
    prompt: "아기가 좋아하는 밝고 경쾌한 동요를 만들어주세요",
    title: "테스트 음악",
    make_instrumental: false,
    model: "chirp-v3-5"
  };
  
  for (const alt of alternatives) {
    console.log(`\n🔍 테스트: ${alt.name}`);
    console.log(`📍 URL: ${alt.url}`);
    
    try {
      const response = await fetch(alt.url, {
        method: 'POST',
        headers: alt.headers,
        body: JSON.stringify(alt.body || testPayload)
      });
      
      console.log(`📊 상태: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ 성공:', JSON.stringify(data, null, 2).substring(0, 300));
        return { success: true, service: alt.name, data };
      } else {
        const errorText = await response.text();
        console.log(`❌ 오류: ${errorText.substring(0, 150)}`);
      }
      
    } catch (error) {
      console.log(`❌ 네트워크 오류: ${error.message}`);
    }
  }
  
  // 현재 시스템 상태 확인
  console.log('\n📊 현재 음악 엔진 상태:');
  try {
    const response = await fetch('http://localhost:5000/api/music-engine/health', {
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTAsInVzZXJJZCI6MTAsImVtYWlsIjoiY3QuY3JlYXRldHJlZUBnbWFpbC5jb20iLCJtZW1iZXJUeXBlIjoic3VwZXJhZG1pbiIsImlhdCI6MTc0OTcwNzQwMSwiZXhwIjoxNzUyMjk5NDAxfQ.n9M8er0jKJdaXOQRE7OZ6PdpvwtWkbbXTpl2RzhnBwc`
      }
    });
    
    if (response.ok) {
      const health = await response.json();
      console.log('🔍 시스템 상태:', JSON.stringify(health, null, 2));
    }
  } catch (error) {
    console.log('❌ 헬스체크 실패:', error.message);
  }
  
  return { success: false, message: '모든 대안 서비스 접근 실패' };
}

testAlternativeSuno().then(result => {
  console.log('\n🏁 대안 테스트 완료:', result);
  process.exit(0);
}).catch(error => {
  console.error('❌ 테스트 오류:', error);
  process.exit(1);
});