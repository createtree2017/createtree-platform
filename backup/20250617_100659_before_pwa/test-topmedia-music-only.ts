/**
 * TopMediai 음악 생성 API 단독 테스트
 * 가사 없이 음악만 생성
 */

import axios from 'axios';

const API_BASE_URL = 'https://api.topmediai.com';
const API_KEY = process.env.TOPMEDIA_API_KEY;

async function testMusicOnly() {
  console.log("TopMediai 음악 생성 단독 테스트");
  
  const axiosConfig = {
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  };

  try {
    // 음악 생성 요청
    const submitData = {
      is_auto: 1,
      prompt: "gentle lullaby music for baby sleep, soft and calm",
      lyrics: "",
      title: "Baby Lullaby",
      instrumental: 0,
      model_version: "v4.0"
    };

    console.log("음악 생성 요청 전송...");
    const submitResponse = await axios.post(`${API_BASE_URL}/v2/submit`, submitData, axiosConfig);
    console.log("제출 응답:", JSON.stringify(submitResponse.data, null, 2));

    if (submitResponse.data && submitResponse.data.data && submitResponse.data.data.length > 0) {
      const songId = submitResponse.data.data[0].song_id;
      console.log("받은 songId:", songId);

      // 상태 확인 (한 번만)
      console.log("상태 확인 중...");
      const queryResponse = await axios.get(`${API_BASE_URL}/v2/query?id=${songId}`, axiosConfig);
      console.log("상태 응답:", JSON.stringify(queryResponse.data, null, 2));

      return { success: true, songId, status: queryResponse.data };
    } else {
      console.log("songId를 받지 못했습니다");
      return { success: false, error: "No songId received" };
    }

  } catch (error: any) {
    console.error("오류 발생:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return { success: false, error: error.message };
  }
}

testMusicOnly();