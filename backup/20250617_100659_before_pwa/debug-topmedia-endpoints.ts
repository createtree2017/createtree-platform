/**
 * TopMediai API 엔드포인트 구조 확인
 */

import axios from 'axios';

const API_KEY = process.env.TOPMEDIA_API_KEY;
const API_BASE_URL = 'https://api.topmediai.com';

const axiosConfig = {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
};

async function testEndpoints() {
  console.log("TopMediai API 엔드포인트 테스트");
  
  const endpoints = [
    // v1 엔드포인트들
    '/v1/lyrics',
    '/v1/submit', 
    '/v1/query',
    '/v1/music',
    '/v1/generate',
    
    // v2 엔드포인트들 (확인용)
    '/v2/lyrics',
    '/v2/submit',
    '/v2/query',
    '/v2/music',
    '/v2/generate'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      console.log(`\n테스트 중: ${endpoint}`);
      
      // GET 요청으로 엔드포인트 존재 확인
      const response = await axios.get(url, { 
        ...axiosConfig,
        timeout: 10000,
        validateStatus: (status) => status < 500 // 4xx도 응답으로 처리
      });
      
      console.log(`상태: ${response.status}`);
      console.log(`응답:`, response.data);
      
    } catch (error: any) {
      if (error.response) {
        console.log(`상태: ${error.response.status}`);
        console.log(`응답:`, error.response.data);
      } else {
        console.log(`오류: ${error.message}`);
      }
    }
  }
  
  // 실제 사용 가능한 엔드포인트 확인
  console.log("\n=== 음악 생성 테스트 ===");
  
  const testData = {
    is_auto: 1,
    prompt: "gentle lullaby music",
    title: "Test Song",
    instrumental: 0,
    model_version: "v4.0"
  };
  
  // v2 submit 테스트 (기존에 작동했던 것)
  try {
    const response = await axios.post(`${API_BASE_URL}/v2/submit`, testData, axiosConfig);
    console.log("v2/submit 성공:", response.data);
  } catch (error: any) {
    console.log("v2/submit 오류:", error.response?.data || error.message);
  }
}

testEndpoints();