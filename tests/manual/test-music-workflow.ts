/**
 * TopMediai v2 워크플로우 테스트 스크립트
 * 현재 API 상태 및 네트워크 연결 확인
 */

import axios from 'axios';

const API_KEY = process.env.TOPMEDIA_API_KEY || '0696de496a39450790a5582fe823c730';
const API_BASE_URL = 'https://api.topmediai.com';

async function testTopMediaiStatus() {
  console.log('🔍 TopMediai API 상태 확인 중...');
  
  try {
    // Test basic connectivity
    const response = await axios.get(`${API_BASE_URL}/v2/query`, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      params: { song_id: 'test-connectivity' }
    });
    
    console.log('✅ TopMediai API 연결 성공');
    console.log('📊 응답 상태:', response.status);
    
  } catch (error: any) {
    console.log('❌ TopMediai API 연결 실패');
    console.log('🔍 오류 상세:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      timeout: error.code === 'ECONNABORTED'
    });
    
    if (error.code === 'ECONNABORTED') {
      console.log('⏰ 타임아웃 감지 - API 서버 응답 지연');
    } else if (error.response?.status === 401) {
      console.log('🔑 인증 실패 - API 키가 유효하지 않음');
    } else if (error.response?.status === 429) {
      console.log('🚫 요청 제한 - Rate Limit 초과');
    } else {
      console.log('🌐 네트워크 연결 문제');
    }
  }
}

async function testLyricsAPI() {
  console.log('\n🎵 가사 생성 API 테스트...');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/v1/lyrics`, {
      prompt: 'peaceful lullaby for baby'
    }, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      }
    });
    
    console.log('✅ 가사 API 성공');
    console.log('📝 생성된 가사:', response.data);
    
  } catch (error: any) {
    console.log('❌ 가사 API 실패');
    console.log('📄 응답:', error.response?.data);
    
    if (error.response?.data?.message?.includes('maintenance')) {
      console.log('🔧 가사 API 유지보수 중 - GPT 대체 사용');
    }
  }
}

async function main() {
  console.log('🚀 TopMediai v2 시스템 진단 시작\n');
  console.log('🔑 사용 중인 API 키:', API_KEY);
  console.log('🌐 API 엔드포인트:', API_BASE_URL);
  console.log('=' .repeat(50));
  
  await testTopMediaiStatus();
  await testLyricsAPI();
  
  console.log('\n' + '=' .repeat(50));
  console.log('📋 진단 완료');
  console.log('💡 새로운 TopMediai API 키가 필요한 경우 제공해주세요.');
}

main().catch(console.error);