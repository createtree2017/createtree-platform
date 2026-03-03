/**
 * TopMediai 가사 API 종합 테스트
 * 1. 가사 생성 API 테스트
 * 2. 음악 생성 시 가사 포함 여부 확인
 * 3. 완성된 음악에서 가사 추출 가능성 확인
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
 * 1단계: 가사 생성 API 테스트
 */
async function testLyricsGeneration() {
  console.log('\n=== 1단계: TopMediai 가사 생성 API 테스트 ===');
  
  const lyricsEndpoints = [
    '/v1/lyrics',
    '/v2/lyrics', 
    '/lyrics',
    '/api/v1/lyrics',
    '/api/lyrics'
  ];
  
  for (const endpoint of lyricsEndpoints) {
    try {
      console.log(`\n📝 테스트 중: ${API_BASE_URL}${endpoint}`);
      
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, {
        prompt: "아이를 위한 따뜻하고 부드러운 자장가",
        theme: "lullaby",
        language: "ko"
      }, axiosConfig);
      
      console.log(`✅ 성공! 상태코드: ${response.status}`);
      console.log('응답 데이터:', JSON.stringify(response.data, null, 2));
      
      // 가사가 포함된 경우 반환
      if (response.data && (response.data.lyrics || response.data.lyric || response.data.content)) {
        return {
          endpoint,
          lyrics: response.data.lyrics || response.data.lyric || response.data.content
        };
      }
      
    } catch (error: any) {
      console.log(`❌ 실패: ${endpoint}`);
      console.log(`   상태코드: ${error.response?.status}`);
      console.log(`   오류: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
    }
  }
  
  return null;
}

/**
 * 2단계: 음악 생성 시 가사 포함 여부 확인
 */
async function testMusicWithLyrics() {
  console.log('\n=== 2단계: 음악 생성 시 가사 포함 테스트 ===');
  
  try {
    const musicData: SubmitMusicDTO = {
      is_auto: 1,
      prompt: "아이를 위한 따뜻하고 부드러운 자장가",
      title: "테스트 자장가",
      instrumental: 0,
      model_version: "v4.0"
    };
    
    console.log('🎵 음악 생성 요청:', musicData);
    
    const submitResponse = await axios.post(`${API_BASE_URL}/v2/submit`, musicData, axiosConfig);
    console.log('제출 응답:', JSON.stringify(submitResponse.data, null, 2));
    
    if (submitResponse.data.song_id || submitResponse.data.id) {
      const songId = submitResponse.data.song_id || submitResponse.data.id;
      console.log(`🔄 생성된 songId: ${songId}`);
      
      // 즉시 한 번 상태 확인
      const queryResponse = await axios.get(`${API_BASE_URL}/v2/query?song_id=${songId}`, axiosConfig);
      console.log('상태 확인 응답:', JSON.stringify(queryResponse.data, null, 2));
      
      // 응답에서 가사 관련 필드 확인
      const data = queryResponse.data;
      if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
        const musicInfo = data.data[0];
        console.log('🎼 음악 정보:', JSON.stringify(musicInfo, null, 2));
        
        // 가사 필드들 확인
        const lyricsFields = ['lyrics', 'lyric', 'text', 'content', 'description'];
        for (const field of lyricsFields) {
          if (musicInfo[field]) {
            console.log(`✅ 가사 발견! 필드: ${field}`);
            console.log(`가사 내용: ${musicInfo[field]}`);
            return { songId, lyrics: musicInfo[field] };
          }
        }
      }
      
      return { songId, lyrics: null };
    }
    
  } catch (error: any) {
    console.log('❌ 음악 생성 테스트 실패:', error.response?.data || error.message);
  }
  
  return null;
}

/**
 * 3단계: 기존 완성된 음악에서 가사 추출 시도
 */
async function testLyricsExtraction() {
  console.log('\n=== 3단계: 완성된 음악에서 가사 추출 테스트 ===');
  
  // 실제 완성된 음악의 songId들 (데이터베이스에서 가져온 것들)
  const existingSongIds = [
    '4eb7d08e-3f43-4c7b-8c6a-1a5b9d7e2f48',
    '7c2a1b3e-4d5f-6789-abcd-ef0123456789',
    'test-song-id'
  ];
  
  for (const songId of existingSongIds) {
    try {
      console.log(`\n🔍 songId 분석 중: ${songId}`);
      
      // 다양한 엔드포인트로 정보 조회 시도
      const endpoints = [
        `/v2/query?song_id=${songId}`,
        `/v1/query?song_id=${songId}`,
        `/query?song_id=${songId}`,
        `/api/v2/query?song_id=${songId}`,
        `/lyrics/${songId}`,
        `/api/lyrics/${songId}`
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${API_BASE_URL}${endpoint}`, axiosConfig);
          console.log(`✅ ${endpoint} 성공:`, JSON.stringify(response.data, null, 2));
          
          // 가사 추출 시도
          const data = response.data;
          if (data) {
            // 직접 가사 필드 확인
            if (data.lyrics || data.lyric) {
              console.log(`🎵 가사 발견: ${data.lyrics || data.lyric}`);
              return { songId, lyrics: data.lyrics || data.lyric };
            }
            
            // data 배열 내부 확인
            if (data.data && Array.isArray(data.data)) {
              for (const item of data.data) {
                if (item.lyrics || item.lyric) {
                  console.log(`🎵 배열에서 가사 발견: ${item.lyrics || item.lyric}`);
                  return { songId, lyrics: item.lyrics || item.lyric };
                }
              }
            }
          }
          
        } catch (endpointError: any) {
          console.log(`❌ ${endpoint} 실패: ${endpointError.response?.status}`);
        }
      }
      
    } catch (error: any) {
      console.log(`❌ songId ${songId} 처리 실패:`, error.message);
    }
  }
  
  return null;
}

/**
 * 메인 테스트 실행
 */
async function comprehensiveLyricsTest() {
  console.log('🎼 TopMediai 가사 시스템 종합 분석 시작');
  console.log(`API 키 상태: ${API_KEY ? '설정됨' : '❌ 없음'}`);
  
  if (!API_KEY) {
    console.log('❌ TOPMEDIA_API_KEY가 설정되지 않았습니다.');
    return;
  }
  
  const results = {
    lyricsGeneration: null as any,
    musicWithLyrics: null as any,
    lyricsExtraction: null as any
  };
  
  // 1단계: 가사 생성 API 테스트
  results.lyricsGeneration = await testLyricsGeneration();
  
  // 2단계: 음악 생성 시 가사 포함 테스트
  results.musicWithLyrics = await testMusicWithLyrics();
  
  // 3단계: 기존 음악에서 가사 추출 테스트
  results.lyricsExtraction = await testLyricsExtraction();
  
  console.log('\n=== 🎯 종합 결과 분석 ===');
  console.log('1. 가사 생성 API:', results.lyricsGeneration ? '✅ 작동함' : '❌ 사용 불가');
  console.log('2. 음악 생성 시 가사:', results.musicWithLyrics?.lyrics ? '✅ 포함됨' : '❌ 포함 안됨');
  console.log('3. 완성 음악 가사 추출:', results.lyricsExtraction ? '✅ 가능함' : '❌ 불가능함');
  
  // 해결 방안 제시
  console.log('\n=== 💡 해결 방안 ===');
  if (results.lyricsGeneration) {
    console.log('✅ 방안 1: 독립적인 가사 생성 API 활용');
    console.log(`   엔드포인트: ${results.lyricsGeneration.endpoint}`);
  }
  
  if (results.musicWithLyrics?.lyrics) {
    console.log('✅ 방안 2: 음악 생성 응답에서 가사 추출');
  }
  
  if (results.lyricsExtraction) {
    console.log('✅ 방안 3: 완성된 음악에서 가사 조회');
  }
  
  if (!results.lyricsGeneration && !results.musicWithLyrics?.lyrics && !results.lyricsExtraction) {
    console.log('⚠️ TopMediai API에서 가사 추출 불가능 - 대안 필요');
    console.log('   대안 1: OpenAI로 가사 생성 후 TopMediai에 전달');
    console.log('   대안 2: 음성 인식을 통한 가사 추출');
    console.log('   대안 3: 음악 제목/프롬프트 기반 가사 재생성');
  }
}

// 실행
comprehensiveLyricsTest().catch(console.error);