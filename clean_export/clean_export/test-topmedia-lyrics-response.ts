/**
 * TopMediai 음악 생성 응답에서 가사 반환 여부 확인
 * 실제 음악 생성 후 완료된 응답에서 가사가 포함되는지 테스트
 */

import axios from 'axios';

const API_BASE_URL = 'https://api.topmediai.com';
const API_KEY = process.env.TOPMEDIA_API_KEY;

const axiosConfig = {
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 30000
};

interface SubmitMusicDTO {
  is_auto: 0 | 1;
  prompt: string;
  lyrics?: string;
  title?: string;
  instrumental: 0 | 1;
  model_version?: string;
  gender?: string;
}

/**
 * TopMediai 음악 생성 및 가사 확인 테스트
 */
async function testTopMediaiLyricsResponse() {
  console.log('🎵 TopMediai 음악 생성 후 가사 반환 여부 테스트');
  
  if (!API_KEY) {
    console.log('❌ TOPMEDIA_API_KEY가 설정되지 않았습니다.');
    return;
  }

  try {
    // 1단계: 음악 생성 요청 (가사 없이)
    console.log('\n1️⃣ 음악 생성 요청 (가사 미포함)');
    const musicData: SubmitMusicDTO = {
      is_auto: 1, // 자동 가사 생성 활성화
      prompt: "아기를 위한 따뜻하고 부드러운 자장가를 만들어주세요",
      title: "가사 추출 테스트 자장가",
      instrumental: 0, // 보컬 포함
      model_version: "v4.0"
    };
    
    console.log('요청 데이터:', musicData);
    
    const submitResponse = await axios.post(`${API_BASE_URL}/v2/submit`, musicData, axiosConfig);
    console.log('제출 응답:', JSON.stringify(submitResponse.data, null, 2));
    
    if (!submitResponse.data.song_id && !submitResponse.data.id) {
      console.log('❌ song_id를 받지 못했습니다.');
      return;
    }
    
    const songId = submitResponse.data.song_id || submitResponse.data.id;
    console.log(`📝 생성된 songId: ${songId}`);
    
    // 2단계: 완료될 때까지 폴링하면서 응답 구조 분석
    console.log('\n2️⃣ 음악 생성 완료까지 폴링 및 응답 분석');
    
    let attempt = 0;
    const maxAttempts = 20; // 최대 10분
    
    while (attempt < maxAttempts) {
      attempt++;
      console.log(`\n폴링 시도 ${attempt}/${maxAttempts}`);
      
      try {
        const queryResponse = await axios.get(`${API_BASE_URL}/v2/query?song_id=${songId}`, axiosConfig);
        const responseData = queryResponse.data;
        
        console.log('응답 상태:', queryResponse.status);
        console.log('응답 데이터:', JSON.stringify(responseData, null, 2));
        
        // 응답에서 가사 관련 필드 확인
        const lyricsFields = ['lyrics', 'lyric', 'text', 'content', 'description', 'prompt_text'];
        let foundLyrics = false;
        
        // 최상위 레벨에서 가사 확인
        for (const field of lyricsFields) {
          if (responseData[field]) {
            console.log(`✅ 최상위에서 가사 발견! 필드: ${field}`);
            console.log(`가사 내용: "${responseData[field]}"`);
            foundLyrics = true;
          }
        }
        
        // data 배열 내부에서 가사 확인
        if (responseData.data && Array.isArray(responseData.data)) {
          responseData.data.forEach((item: any, index: number) => {
            console.log(`\ndata[${index}] 분석:`);
            console.log('- 모든 필드:', Object.keys(item));
            
            for (const field of lyricsFields) {
              if (item[field]) {
                console.log(`✅ data[${index}]에서 가사 발견! 필드: ${field}`);
                console.log(`가사 내용: "${item[field]}"`);
                foundLyrics = true;
              }
            }
            
            // 음악 상태 확인
            if (item.status) {
              console.log(`- 상태: ${item.status}`);
            }
            if (item.audio || item.audio_url) {
              console.log(`- 음악 URL: ${item.audio || item.audio_url}`);
            }
            if (item.audio_duration) {
              console.log(`- 음악 길이: ${item.audio_duration}초`);
            }
          });
        }
        
        // 음악이 완료되었는지 확인
        const isCompleted = responseData.data && 
          Array.isArray(responseData.data) && 
          responseData.data.length > 0 && 
          (responseData.data[0].audio || responseData.data[0].audio_url);
        
        if (isCompleted) {
          console.log('\n🎉 음악 생성 완료!');
          console.log(`가사 발견 여부: ${foundLyrics ? '✅ 있음' : '❌ 없음'}`);
          
          // 최종 응답 구조 요약
          console.log('\n📊 최종 응답 구조 요약:');
          console.log('- 최상위 필드들:', Object.keys(responseData));
          if (responseData.data && responseData.data[0]) {
            console.log('- data[0] 필드들:', Object.keys(responseData.data[0]));
          }
          
          break;
        }
        
        console.log('⏳ 음악 생성 중... 30초 후 재시도');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
      } catch (error: any) {
        console.log(`❌ 폴링 에러: ${error.response?.status} - ${error.message}`);
        if (error.response?.data) {
          console.log('에러 응답:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }
    
    if (attempt >= maxAttempts) {
      console.log('⚠️ 최대 시도 횟수 초과 - 타임아웃');
    }
    
  } catch (error: any) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.response?.data) {
      console.log('에러 응답:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

/**
 * 기존 완료된 음악에서 가사 추출 테스트
 */
async function testExistingMusicLyrics() {
  console.log('\n\n🔍 기존 완료된 음악에서 가사 추출 테스트');
  
  // 데이터베이스에서 최근 생성된 TopMediai 음악의 외부 ID 확인
  const testSongIds = [
    // 실제 생성된 songId들을 여기에 추가
    // 예: '4eb7d08e-3f43-4c7b-8c6a-1a5b9d7e2f48'
  ];
  
  for (const songId of testSongIds) {
    console.log(`\n🎵 songId ${songId} 분석:`);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/v2/query?song_id=${songId}`, axiosConfig);
      console.log('응답:', JSON.stringify(response.data, null, 2));
      
      // 가사 필드 확인
      const lyricsFields = ['lyrics', 'lyric', 'text', 'content'];
      let foundLyrics = false;
      
      if (response.data.data && Array.isArray(response.data.data)) {
        response.data.data.forEach((item: any) => {
          for (const field of lyricsFields) {
            if (item[field]) {
              console.log(`✅ 가사 발견! 필드: ${field}, 내용: "${item[field]}"`);
              foundLyrics = true;
            }
          }
        });
      }
      
      if (!foundLyrics) {
        console.log('❌ 가사를 찾을 수 없음');
      }
      
    } catch (error: any) {
      console.log(`❌ 조회 실패: ${error.response?.status} - ${error.message}`);
    }
  }
}

// 실행
async function main() {
  await testTopMediaiLyricsResponse();
  await testExistingMusicLyrics();
}

main().catch(console.error);