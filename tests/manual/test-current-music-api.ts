/**
 * 현재 음악 생성 API 테스트
 * TopMediai API가 Suno AI URL을 반환하는 것이 정상인지 확인
 */

const API_BASE_URL = 'https://api.topmediai.com';
const API_KEY = process.env.TOPMEDIA_API_KEY || '0696de496a39450790a5582fe823c730';

interface SubmitMusicDTO {
  is_auto: 0 | 1;
  prompt: string;
  lyrics?: string;
  title?: string;
  instrumental: 0 | 1;
  model_version?: string;
  gender?: string;
}

async function testCurrentMusicAPI() {
  console.log('🎵 현재 음악 생성 API 테스트 시작...');
  
  // Step 1: 음악 생성 제출 (올바른 파라미터로)
  const submitBody: SubmitMusicDTO = {
    is_auto: 0,
    prompt: "lullaby style music for 우리아기를 위한 따뜻한 자장가",
    lyrics: "달빛 아래 작은 천사가 잠들어요\n부드러운 바람이 흔들어주는 요람 속에서",
    title: "우리아기 자장가",
    instrumental: 0,
    model_version: 'v3.5',  // 올바른 버전
    gender: 'female'
  };

  try {
    console.log('제출할 데이터:', JSON.stringify(submitBody, null, 2));
    
    const submitResponse = await fetch(`${API_BASE_URL}/v2/submit`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submitBody)
    });

    console.log('제출 응답 상태:', submitResponse.status);
    const submitText = await submitResponse.text();
    console.log('제출 응답 내용:', submitText);

    if (submitResponse.ok) {
      try {
        const submitData = JSON.parse(submitText);
        console.log('제출 성공! song_id:', submitData.data?.[0]?.song_id || 'ID not found');
        
        const songId = submitData.data?.[0]?.song_id;
        if (songId) {
          // Step 2: 상태 확인
          console.log('\n🔍 음악 생성 상태 확인...');
          
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기
            
            const queryResponse = await fetch(`${API_BASE_URL}/v2/query?song_id=${songId}`, {
              headers: {
                'x-api-key': API_KEY
              }
            });
            
            const queryText = await queryResponse.text();
            console.log(`\n시도 ${i + 1}:`, queryResponse.status, queryText);
            
            if (queryResponse.ok) {
              const queryData = JSON.parse(queryText);
              console.log('상태:', queryData.data?.[0]?.status);
              console.log('오디오 URL:', queryData.data?.[0]?.audio);
              
              // Suno AI URL 확인
              const audioUrl = queryData.data?.[0]?.audio;
              if (audioUrl && audioUrl.includes('audiopipe.suno.ai')) {
                console.log('✅ Suno AI URL 감지됨! 이것이 정상적인 응답입니다.');
                console.log('TopMediai가 내부적으로 Suno AI를 사용합니다.');
                break;
              }
            }
          }
        }
      } catch (e) {
        console.log('JSON 파싱 실패:', e);
      }
    }
  } catch (error) {
    console.error('API 테스트 오류:', error);
  }
}

testCurrentMusicAPI();