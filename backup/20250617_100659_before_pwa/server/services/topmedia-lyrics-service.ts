/**
 * TopMediai 가사 생성 전용 서비스
 * 음악과 별도로 가사만 생성하여 UI에 표시
 * TopMediai API만 사용
 */

interface TopMediaiLyricsResponse {
  details: Array<{
    lyc: string;
    string: string;
  }>;
}

interface LyricsGenerationResult {
  lyrics: string;
  success: boolean;
  error?: string;
}

/**
 * TopMediai API로 가사만 생성 - 다양한 엔드포인트 시도
 */
export async function generateLyricsOnly(prompt: string): Promise<LyricsGenerationResult> {
  const API_KEY = process.env.TOPMEDIA_API_KEY;
  
  if (!API_KEY) {
    throw new Error('TOPMEDIA_API_KEY가 설정되지 않았습니다.');
  }

  // 시도할 엔드포인트 목록
  const endpoints = [
    'https://api.topmediai.com/v2/lyrics',
    'https://api.topmediai.com/lyrics',
    'https://api.topmediai.com/v1/music/lyrics',
    'https://api.topmediai.com/v2/music/lyrics'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🎵 TopMediai 가사 생성 시도 (${endpoint}):`, prompt);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
          prompt: prompt
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ ${endpoint} 실패:`, response.status, errorText);
        continue; // 다음 엔드포인트 시도
      }

      const data = await response.json();
      console.log(`✅ ${endpoint} 응답:`, data);

      // 다양한 응답 구조에 대응
      let lyricsText = '';
      
      // 응답 구조 1: details 배열
      if (data.details && Array.isArray(data.details) && data.details.length > 0) {
        lyricsText = data.details[0].lyc || data.details[0].string || '';
      }
      // 응답 구조 2: 직접 lyrics 필드
      else if (data.lyrics) {
        lyricsText = data.lyrics;
      }
      // 응답 구조 3: data.lyrics 필드
      else if (data.data && data.data.lyrics) {
        lyricsText = data.data.lyrics;
      }
      // 응답 구조 4: content 필드
      else if (data.content) {
        lyricsText = data.content;
      }

      if (lyricsText && lyricsText.trim()) {
        console.log(`✅ TopMediai 가사 생성 성공 (${endpoint})`);
        return {
          lyrics: lyricsText.trim(),
          success: true
        };
      }
      
      console.log(`⚠️ ${endpoint}에서 가사 데이터가 비어있음`);
    } catch (endpointError: any) {
      console.log(`❌ ${endpoint} 오류:`, endpointError.message);
      continue; // 다음 엔드포인트 시도
    }
  }

  // 모든 엔드포인트 실패
  console.warn('⚠️ 모든 TopMediai 가사 엔드포인트 실패');
  return {
    lyrics: '',
    success: false,
    error: '모든 가사 생성 엔드포인트가 실패했습니다.'
  };
}

/**
 * 음악 생성 시 사용할 가사 추출 함수
 * 음악과 동일한 프롬프트로 가사를 별도 생성
 */
export async function extractLyricsForMusic(
  musicPrompt: string,
  babyName?: string
): Promise<string> {
  try {
    // 아기 이름이 있는 경우 가사용 프롬프트 조정
    let lyricsPrompt = musicPrompt;
    
    if (babyName && babyName.trim()) {
      const nickname = convertToNickname(babyName.trim());
      if (nickname) {
        lyricsPrompt = `${musicPrompt} (아기 이름: ${nickname}을 가사에 자연스럽게 포함해주세요)`;
      }
    }

    console.log('🎼 음악용 가사 추출:', lyricsPrompt);

    const result = await generateLyricsOnly(lyricsPrompt);
    
    if (result.success && result.lyrics) {
      console.log('✅ 음악용 가사 추출 성공');
      return result.lyrics;
    } else {
      console.warn('⚠️ 음악용 가사 추출 실패, 빈 문자열 반환');
      return '';
    }

  } catch (error: any) {
    console.error('음악용 가사 추출 오류:', error);
    return '';
  }
}

/**
 * 아기 이름을 자연스러운 애칭으로 변환
 */
function convertToNickname(babyName: string): string {
  if (!babyName || babyName.trim().length === 0) {
    return '';
  }

  const name = babyName.trim();
  
  // 2-3글자 한국어 이름 처리
  if (name.length >= 2 && /^[가-힣]+$/.test(name)) {
    const lastName = name.charAt(0);
    const firstName = name.slice(1);
    
    // 성을 제외한 이름에 '이' 추가
    if (firstName.length === 1) {
      return firstName + '이'; // 예: 민준 -> 준이
    } else if (firstName.length >= 2) {
      return firstName; // 예: 서연 -> 서연
    }
  }
  
  // 영어나 기타 언어는 그대로 반환
  return name;
}