/**
 * TopMediai API 완전 상태 점검
 */

import axios from 'axios';

const API_BASE_URL = 'https://api.topmediai.com';
const API_KEY = process.env.TOPMEDIA_API_KEY;

async function checkTopMediaiStatus() {
  console.log("TopMediai API 완전 상태 점검");
  console.log("API 키:", API_KEY ? `${API_KEY.substring(0, 10)}...` : '없음');
  
  const axiosConfig = {
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  };

  // 1. 가사 API 상태
  console.log("\n=== 가사 API 테스트 ===");
  try {
    const response = await axios.post(`${API_BASE_URL}/v1/lyrics`, {
      prompt: "simple lullaby for baby",
      style: "lullaby"
    }, axiosConfig);
    console.log("가사 API 응답:", response.data);
  } catch (error: any) {
    console.log("가사 API 상태:", error.response?.status);
    console.log("가사 API 응답:", error.response?.data);
  }

  // 2. 음악 생성 API 상태
  console.log("\n=== 음악 생성 API 테스트 ===");
  try {
    const response = await axios.post(`${API_BASE_URL}/v2/submit`, {
      is_auto: 1,
      prompt: "simple lullaby music for baby",
      lyrics: "",
      title: "Test Baby Lullaby",
      instrumental: 0,
      model_version: "v4.0"
    }, axiosConfig);
    console.log("음악 생성 API 응답:", response.data);
    
    if (response.data && response.data.data) {
      const songId = response.data.data[0]?.song_id || response.data.id;
      console.log("받은 songId:", songId);
      
      if (songId) {
        // 상태 확인
        console.log("\n=== 상태 확인 API 테스트 ===");
        const queryResponse = await axios.get(`${API_BASE_URL}/v2/query?id=${songId}`, axiosConfig);
        console.log("상태 확인 응답:", queryResponse.data);
      }
    }
    
  } catch (error: any) {
    console.log("음악 생성 API 상태:", error.response?.status);
    console.log("음악 생성 API 응답:", error.response?.data);
  }
}

checkTopMediaiStatus();