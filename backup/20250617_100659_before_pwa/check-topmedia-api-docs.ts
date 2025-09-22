/**
 * TopMediai API 문서 및 스키마 확인
 * 지원되는 파라미터와 옵션 조사
 */

import axios from 'axios';

const API_KEY = process.env.TOPMEDIA_API_KEY;
const API_BASE_URL = 'https://api.topmediai.com';

async function checkTopMediaiAPIDocs() {
  console.log('🔍 TopMediai API 지원 옵션 확인');
  
  const axiosConfig = {
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  };

  // 1. API 기본 정보 확인
  try {
    console.log('\n1️⃣ API 기본 정보 확인...');
    const infoResponse = await axios.get(`${API_BASE_URL}/v2/info`, axiosConfig);
    console.log('API 정보:', JSON.stringify(infoResponse.data, null, 2));
  } catch (error: any) {
    console.log('API 정보 조회 실패:', error.response?.status, error.response?.data || error.message);
  }

  // 2. 지원되는 모델 및 옵션 확인
  try {
    console.log('\n2️⃣ 지원 모델/옵션 확인...');
    const modelsResponse = await axios.get(`${API_BASE_URL}/v2/models`, axiosConfig);
    console.log('지원 모델:', JSON.stringify(modelsResponse.data, null, 2));
  } catch (error: any) {
    console.log('모델 정보 조회 실패:', error.response?.status, error.response?.data || error.message);
  }

  // 3. 잘못된 gender 값으로 테스트하여 오류 메시지에서 지원 옵션 확인
  try {
    console.log('\n3️⃣ 잘못된 gender 값으로 지원 옵션 확인...');
    
    const invalidGenderTest = {
      is_auto: 1,
      prompt: "test",
      lyrics: "",
      title: "test",
      instrumental: 0,
      model_version: "v4.0",
      gender: "invalid_gender_option_to_get_error_message"
    };

    await axios.post(`${API_BASE_URL}/v2/submit`, invalidGenderTest, axiosConfig);
  } catch (error: any) {
    console.log('예상된 오류 (지원 옵션 확인용):', error.response?.status);
    console.log('오류 메시지:', JSON.stringify(error.response?.data, null, 2));
    
    // 오류 메시지에서 지원되는 값들 추출
    const errorMsg = JSON.stringify(error.response?.data);
    if (errorMsg.includes('gender')) {
      console.log('🎯 gender 관련 오류 메시지 발견 - 지원 옵션 확인 가능');
    }
  }

  // 4. 기존 성공한 요청의 응답 분석
  console.log('\n4️⃣ 현재 사용 중인 gender 매핑:');
  console.log('- boy → male');
  console.log('- girl → female'); 
  console.log('- child/baby → child');
  console.log('- 기본값 → auto');
  
  // 5. 실제 음성 결과 분석 제안
  console.log('\n5️⃣ 음성 결과 분석 필요:');
  console.log('- 생성된 음악 ID 79의 실제 목소리 확인');
  console.log('- boy로 선택했는데 성인 여성 목소리가 나왔다면 API 문제일 수 있음');
  console.log('- TopMediai가 아기/어린이 목소리를 지원하지 않을 가능성');
}

// 실행
checkTopMediaiAPIDocs().catch(console.error);