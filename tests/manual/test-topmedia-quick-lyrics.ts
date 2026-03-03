/**
 * TopMediai API 가사 반환 여부 빠른 테스트
 * 짧은 음악으로 빠르게 응답 구조 확인
 */

import axios from 'axios';

const API_BASE_URL = 'https://api.topmediai.com';
const API_KEY = process.env.TOPMEDIA_API_KEY;

const axiosConfig = {
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 15000
};

async function quickLyricsTest() {
  console.log('🔍 TopMediai 가사 반환 빠른 테스트');
  
  if (!API_KEY) {
    console.log('❌ TOPMEDIA_API_KEY 없음');
    return;
  }

  try {
    // 매우 짧은 음악으로 빠른 테스트
    const musicData = {
      is_auto: 1,
      prompt: "짧은 자장가",
      title: "빠른 테스트",
      instrumental: 0,
      model_version: "v4.0"
    };
    
    console.log('📤 음악 생성 요청...');
    const submitResponse = await axios.post(`${API_BASE_URL}/v2/submit`, musicData, axiosConfig);
    
    const songId = submitResponse.data.song_id || submitResponse.data.id;
    if (!songId) {
      console.log('❌ songId 없음');
      return;
    }
    
    console.log(`📝 songId: ${songId}`);
    
    // 즉시 상태 확인 (몇 번만)
    for (let i = 0; i < 3; i++) {
      console.log(`\n${i + 1}번째 확인...`);
      
      try {
        const queryResponse = await axios.get(`${API_BASE_URL}/v2/query?song_id=${songId}`, axiosConfig);
        const data = queryResponse.data;
        
        console.log('응답 구조:', {
          topLevelFields: Object.keys(data),
          hasData: !!data.data,
          dataLength: data.data ? data.data.length : 0
        });
        
        // 가사 필드 확인
        const checkLyrics = (obj: any, path: string) => {
          const lyricsFields = ['lyrics', 'lyric', 'text', 'content'];
          for (const field of lyricsFields) {
            if (obj[field] && typeof obj[field] === 'string' && obj[field].length > 10) {
              console.log(`✅ ${path}.${field} 가사 발견: "${obj[field].substring(0, 50)}..."`);
              return true;
            }
          }
          return false;
        };
        
        // 최상위 레벨 확인
        checkLyrics(data, 'root');
        
        // data 배열 확인
        if (data.data && Array.isArray(data.data)) {
          data.data.forEach((item: any, index: number) => {
            console.log(`data[${index}] 필드:`, Object.keys(item));
            checkLyrics(item, `data[${index}]`);
            
            if (item.status) console.log(`  상태: ${item.status}`);
            if (item.audio || item.audio_url) {
              console.log(`  ✅ 음악 완료: ${item.audio || item.audio_url}`);
              return; // 완료되면 종료
            }
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기
        
      } catch (error: any) {
        console.log(`❌ 확인 실패: ${error.response?.status}`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.response?.data) {
      console.log('에러 응답:', error.response.data);
    }
  }
}

// 음성 인식으로 가사 추출 가능성 체크
async function checkVoiceRecognitionOption() {
  console.log('\n🎤 음성 인식을 통한 가사 추출 가능성');
  
  // 현재 환경에서 사용 가능한 음성 인식 API들
  console.log('가능한 옵션들:');
  console.log('1. OpenAI Whisper API - 음성을 텍스트로 변환');
  console.log('2. Google Speech-to-Text API');
  console.log('3. Azure Speech Services');
  
  console.log('\n📋 구현 방법:');
  console.log('- TopMediai에서 음악 파일 생성');
  console.log('- 생성된 음악 파일을 Whisper API로 전송');
  console.log('- 반환된 텍스트를 가사로 저장');
  console.log('- UI에서 가사 표시');
}

async function main() {
  await quickLyricsTest();
  await checkVoiceRecognitionOption();
}

main().catch(console.error);