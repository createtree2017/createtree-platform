/**
 * Suno API 상태 분석 보고서
 * 서비스 중단 판단 근거 수집 및 분석
 */

interface APITestResult {
  endpoint: string;
  status: number;
  statusText: string;
  responseBody: string;
  timestamp: string;
  error?: string;
}

async function generateSunoStatusReport() {
  const apiKey = process.env.SUNO_API_KEY;
  const testResults: APITestResult[] = [];
  
  console.log('📊 Suno API 상태 분석 보고서');
  console.log('='.repeat(50));
  console.log(`🕐 분석 시간: ${new Date().toISOString()}`);
  console.log(`🔑 API 키: ${apiKey ? `${apiKey.substring(0, 10)}...` : '미설정'}`);
  console.log('');
  
  // 테스트할 공식 및 알려진 Suno API 엔드포인트들
  const endpoints = [
    {
      name: 'Suno Studio API (메인)',
      url: 'https://studio-api.suno.ai/api/generate/v2/',
      isOfficial: true
    },
    {
      name: 'Suno 공식 API v1',
      url: 'https://api.suno.ai/v1/tracks',
      isOfficial: true
    },
    {
      name: 'Suno 공식 웹사이트',
      url: 'https://suno.com',
      isOfficial: true,
      method: 'GET'
    },
    {
      name: 'Suno App 도메인',
      url: 'https://app.suno.ai',
      isOfficial: true,
      method: 'GET'
    }
  ];
  
  const testPayload = {
    prompt: "test music generation",
    title: "API Test",
    make_instrumental: false,
    model: "chirp-v3-5"
  };
  
  console.log('🔍 테스트 결과:');
  console.log('-'.repeat(50));
  
  for (const endpoint of endpoints) {
    const method = endpoint.method || 'POST';
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`\n${endpoint.isOfficial ? '🟢' : '🟡'} ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      console.log(`   방식: ${method}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'CreateTree-AI-Test/1.0'
      };
      
      if (method === 'POST') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const requestOptions: RequestInit = {
        method,
        headers
      };
      
      if (method === 'POST') {
        requestOptions.body = JSON.stringify(testPayload);
      }
      
      const response = await fetch(endpoint.url, requestOptions);
      const responseText = await response.text();
      
      const result: APITestResult = {
        endpoint: endpoint.url,
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText.substring(0, 500),
        timestamp
      };
      
      testResults.push(result);
      
      console.log(`   📊 상태: ${response.status} ${response.statusText}`);
      
      // 응답 분석
      if (response.status === 503) {
        console.log('   ❌ 서비스 중단 확인됨');
        if (responseText.includes('Service Suspended') || responseText.includes('Service Temporarily Unavailable')) {
          console.log('   🚫 공식 서비스 중단 메시지 감지');
        }
      } else if (response.status === 200) {
        console.log('   ✅ 정상 응답');
      } else if (response.status === 401) {
        console.log('   🔐 인증 문제 (API 키 관련)');
      } else if (response.status === 404) {
        console.log('   🔍 엔드포인트 존재하지 않음');
      } else {
        console.log('   ⚠️  기타 오류');
      }
      
      console.log(`   📝 응답: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
      
    } catch (error: any) {
      console.log(`   ❌ 네트워크 오류: ${error.message}`);
      testResults.push({
        endpoint: endpoint.url,
        status: 0,
        statusText: 'Network Error',
        responseBody: error.message,
        timestamp,
        error: error.message
      });
    }
  }
  
  // 분석 결과 요약
  console.log('\n📋 분석 결과 요약:');
  console.log('='.repeat(50));
  
  const officialEndpoints = testResults.filter((_, i) => endpoints[i].isOfficial);
  const serviceUnavailableCount = testResults.filter(r => r.status === 503).length;
  const totalOfficialEndpoints = endpoints.filter(e => e.isOfficial).length;
  
  console.log(`총 테스트 엔드포인트: ${testResults.length}개`);
  console.log(`공식 엔드포인트: ${totalOfficialEndpoints}개`);
  console.log(`503 Service Unavailable: ${serviceUnavailableCount}개`);
  console.log(`네트워크 오류: ${testResults.filter(r => r.status === 0).length}개`);
  console.log(`정상 응답 (200): ${testResults.filter(r => r.status === 200).length}개`);
  
  // 서비스 중단 판단
  const isServiceDown = serviceUnavailableCount >= 2 || 
                       (serviceUnavailableCount >= 1 && testResults.filter(r => r.status === 200).length === 0);
  
  console.log(`\n🎯 결론: ${isServiceDown ? '서비스 중단 상태' : '서비스 정상 또는 부분적 장애'}`);
  
  if (isServiceDown) {
    console.log('\n📋 서비스 중단 판단 근거:');
    testResults.forEach((result, i) => {
      if (result.status === 503) {
        console.log(`   • ${endpoints[i].name}: ${result.status} ${result.statusText}`);
        if (result.responseBody.includes('Service Suspended')) {
          console.log(`     → 공식 서비스 중단 메시지 확인`);
        }
      }
    });
  }
  
  return { testResults, isServiceDown, summary: {
    totalEndpoints: testResults.length,
    officialEndpoints: totalOfficialEndpoints,
    serviceUnavailable: serviceUnavailableCount,
    networkErrors: testResults.filter(r => r.status === 0).length,
    successfulResponses: testResults.filter(r => r.status === 200).length
  }};
}

generateSunoStatusReport().then(report => {
  console.log('\n✅ 상태 분석 완료');
  process.exit(0);
}).catch(error => {
  console.error('❌ 분석 오류:', error);
  process.exit(1);
});