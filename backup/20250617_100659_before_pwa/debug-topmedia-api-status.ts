/**
 * TopMediai API 상태 진단
 */

import axios from 'axios';

const API_BASE_URL = 'https://api.topmediai.com';
const API_KEY = process.env.TOPMEDIA_API_KEY;

async function debugTopMediaiAPI() {
  console.log("TopMediai API 상태 진단 시작");
  
  const axiosConfig = {
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  };

  // 1. 가사 API 테스트
  console.log("\n1. 가사 API 테스트:");
  try {
    const lyricsResponse = await axios.post(`${API_BASE_URL}/v1/lyrics`, {
      prompt: "test lullaby",
      style: "lullaby"
    }, axiosConfig);
    console.log("가사 API 응답:", lyricsResponse.status, lyricsResponse.data);
  } catch (error: any) {
    console.log("가사 API 오류:", error.response?.status, error.response?.data || error.message);
  }

  // 2. 음악 제출 API 테스트
  console.log("\n2. 음악 제출 API 테스트:");
  try {
    const submitResponse = await axios.post(`${API_BASE_URL}/v2/submit`, {
      is_auto: 1,
      prompt: "test lullaby music",
      lyrics: "",
      title: "Test Song",
      instrumental: 0,
      model_version: "v4.0"
    }, axiosConfig);
    console.log("음악 제출 API 응답:", submitResponse.status, submitResponse.data);
  } catch (error: any) {
    console.log("음악 제출 API 오류:", error.response?.status, error.response?.data || error.message);
  }

  // 3. API 키 확인
  console.log("\n3. API 키 확인:");
  console.log("API 키 존재:", !!API_KEY);
  console.log("API 키 길이:", API_KEY?.length);
  console.log("API 키 시작:", API_KEY?.substring(0, 10) + "...");

  // 4. 네트워크 연결 테스트
  console.log("\n4. 네트워크 연결 테스트:");
  try {
    const pingResponse = await axios.get(`${API_BASE_URL}/health`, { timeout: 10000 });
    console.log("헬스체크 응답:", pingResponse.status);
  } catch (error: any) {
    console.log("헬스체크 오류:", error.message);
    
    // 기본 연결 테스트
    try {
      const basicResponse = await axios.get(API_BASE_URL, { timeout: 10000 });
      console.log("기본 연결 성공:", basicResponse.status);
    } catch (basicError: any) {
      console.log("기본 연결 실패:", basicError.message);
    }
  }
}

debugTopMediaiAPI();