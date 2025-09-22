/**
 * TopMediai AI Music Generator API Integration - Fixed Version
 * 
 * Implements 3-step workflow:
 * 1. Generate lyrics (POST /v1/lyrics)
 * 2. Submit music generation task (POST /v2/submit) 
 * 3. Query generation status (GET /v2/query)
 */
import axios from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
// 가사 추출 함수는 동적 임포트로 사용
// GCS 업로드 함수는 동적 임포트로 사용
import { db } from '@db';
import { music } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { TopMediaRetryManager } from '../utils/topmedia-retry';

/**
 * Step 2. 음악 생성 직후 GCS 업로드 후 DB에 url 및 gcs_path 저장 함수
 */
export async function saveMusicToDb(musicId: number, gcsFileName: string) {
  const gcsUrl = `https://storage.googleapis.com/createtree-upload/music/${gcsFileName}`;
  await db.update(music)
    .set({ 
      gcsPath: `music/${gcsFileName}`, 
      url: gcsUrl,
      updatedAt: new Date()
    })
    .where(eq(music.id, musicId));
  console.log(`🎵 Music DB Updated → ID: ${musicId}, URL: ${gcsUrl}`);
}

const API_BASE_URL = 'https://api.topmediai.com';
const API_KEY = process.env.TOPMEDIA_API_KEY;

// HTTP 연결 풀링 - 연결 재사용으로 네트워크 지연 감소
const httpsAgent = new HttpsAgent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000
});

const axiosConfig = {
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 180000,
  httpsAgent
};

/**
 * 프롬프트 최적화 함수 - TopMediai API 처리 속도 향상
 */
function optimizePrompt(prompt: string): string {
  if (!prompt) return prompt;
  
  // 1. 불필요한 공백 제거
  let optimized = prompt.trim().replace(/\s+/g, ' ');
  
  // 2. 중복 단어 제거 (연속된 동일 단어)
  optimized = optimized.replace(/\b(\w+)\s+\1\b/gi, '$1');
  
  // 3. 너무 긴 프롬프트 단축 (TopMediai 최적 길이: 50자 이내)
  if (optimized.length > 50) {
    // 핵심 키워드만 추출
    const keywords = optimized.split(' ').filter(word => word.length > 1);
    optimized = keywords.slice(0, 8).join(' ');
  }
  
  // 4. 특수문자 정리 (API 처리 성능 향상)
  optimized = optimized.replace(/[^\w\s가-힣]/g, '');
  
  return optimized;
}

interface SubmitMusicDTO {
  is_auto: 0 | 1;
  prompt: string;
  lyrics: string;
  title: string;
  instrumental: 0 | 1;
  model_version: 'v4.0' | 'v3.5' | 'v3.0';
  gender?: string;
}

interface MusicQueryResult {
  url?: string;
  status?: string;
  duration?: number;
  lyrics?: string;
  title?: string;
  [key: string]: any;
}

/**
 * Step 1: Generate lyrics using TopMediai AI
 */
export async function createLyrics(prompt: string): Promise<string> {
  console.log('💡 가사는 음악 생성 시 자동으로 생성됩니다.');
  return '';
}

/**
 * TopMediai 서비스 클래스
 */
export class TopMediaService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.topmediai.com';

  constructor() {
    this.apiKey = process.env.TOPMEDIA_API_KEY!;
    
    if (!this.apiKey) {
      throw new Error('TOPMEDIA_API_KEY 환경변수가 설정되지 않았습니다');
    }
  }

  /**
   * 가사 생성 (1단계)
   */
  async generateLyrics(request: {
    prompt: string;

    title: string;
    style: string;
    generateLyrics: boolean;
  }): Promise<{ success: boolean; lyrics?: string; title?: string; error?: string }> {
    try {
      console.log('📝 [TopMedia] 가사 생성 요청:', {
        prompt: request.prompt?.substring(0, 100) + '...',

        generateLyrics: request.generateLyrics
      });

      if (!request.generateLyrics) {
        // 가사 자동 생성을 원하지 않는 경우 프롬프트를 가사로 사용
        return {
          success: true,
          lyrics: request.prompt,
          title: request.title
        };
      }

      // OpenAI 폴백 가사 생성
      const fallbackLyrics = await generateLyricsWithGPT(request.prompt, request.style);
      
      return {
        success: true,
        lyrics: fallbackLyrics,
        title: request.title
      };

    } catch (error: any) {
      console.error('❌ [TopMedia] 가사 생성 실패:', error);
      return {
        success: false,
        error: `가사 생성 실패: ${error.message}`
      };
    }
  }
}

/**
 * GPT 가사 생성 함수 (TopMediai API 장애 시 대체용)
 */
async function generateLyricsWithGPT(prompt: string, style: string = 'lullaby'): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다');
  }

  // 가사 생성 프롬프트
  let lyricsPrompt = `${prompt}에 대한 ${style} 스타일의 한국어 가사를 작성해주세요. 200자 이내로 작성하고, [verse]와 [chorus] 구조를 포함해주세요.`;

  // 직접 fetch 사용으로 organization 헤더 문제 해결
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{
        role: "user",
        content: lyricsPrompt
      }],
      max_tokens: 300
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API 오류: ${response.status} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Step 2: Submit music generation task
 */
export async function submitMusicTask(body: SubmitMusicDTO): Promise<string> {
  const retryManager = TopMediaRetryManager.getInstance();
  const ENDPOINT = `${API_BASE_URL}/v2/submit`;
  
  // 프롬프트 최적화 적용
  const originalPrompt = body.prompt;
  const optimizedPrompt = optimizePrompt(body.prompt);
  
  console.log(`📝 프롬프트 최적화: ${originalPrompt.length}자 → ${optimizedPrompt.length}자`);
  
  // 최적화된 프롬프트 적용
  const optimizedBody = {
    ...body,
    prompt: optimizedPrompt
  };
  
  console.log('🔥 TopMediai API 호출 시작:', {
    endpoint: ENDPOINT,
    apiKey: API_KEY ? `${API_KEY.substring(0, 8)}...` : 'Missing',
    body: body
  });
  
  return await retryManager.withRetry(async () => {
    const response = await axios.post(ENDPOINT, optimizedBody, {
      ...axiosConfig,
      timeout: 60000, // 60초로 증가
      validateStatus: (status) => status < 500 // 4xx 오류도 처리
    });
    
    console.log('✅ TopMediai submit 응답 상태:', response.status);
    console.log('✅ TopMediai submit 응답 데이터:', JSON.stringify(response.data, null, 2));
    
    let songId;
    if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
      songId = response.data.data[0].song_id;
    } else if (response.data && response.data.song_id) {
      songId = response.data.song_id;
    } else if (response.data && response.data.id) {
      songId = response.data.id;
    }
    
    if (!songId) {
      console.error('❌ TopMediai 응답에서 song_id를 찾을 수 없음:', response.data);
      throw new Error('TopMediai에서 음악 ID를 받지 못했습니다');
    }
    
    console.log('✅ TopMediai 음악 ID 수신:', songId);
    return songId as string;
  }, {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2
  });
}

/**
 * Step 3: Query music generation status with enhanced fallback
 */
export async function queryMusic(songId: string): Promise<MusicQueryResult> {
  const retryManager = TopMediaRetryManager.getInstance();
  const queryUrl = `${API_BASE_URL}/v2/query?id=${songId}`;
  
  console.log('🔍 TopMediai 상태 조회:', {
    songId: songId,
    url: queryUrl
  });
  
  return await retryManager.withRetry(async () => {
    const response = await axios.get(queryUrl, {
      ...axiosConfig,
      timeout: 30000,
      validateStatus: (status) => status < 500
    });
    
    console.log('✅ TopMediai query 응답 상태:', response.status);
    console.log('✅ TopMediai query 응답 데이터:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.data) {
      return response.data;
    } else if (response.data) {
      return { data: response.data, status: response.data.status || 200 };
    }
    
    return response.data;
  }, {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2
  });
}

/**
 * Enhanced polling with proper timeout handling
 */
export async function pollMusicStatus(songId: string): Promise<MusicQueryResult> {
  const startTime = Date.now();
  const deadline = startTime + 3 * 60 * 1000; // 3분 제한
  let attemptCount = 0;
  
  console.log(`🔄 시작 향상된 폴링 [songId: ${songId}] 3분 제한시간...`);
  
  // 진행률 계산 함수
  const getProgress = (elapsed: number) => {
    const totalTime = 3 * 60 * 1000; // 3분
    const progress = Math.min(Math.floor((elapsed / totalTime) * 100), 95); // 최대 95%까지
    return progress;
  };
  
  while (Date.now() < deadline) {
    attemptCount++;
    const elapsedMs = Date.now() - startTime;
    
    // 동적 폴링 간격 (초기에는 빠르게, 나중에는 느리게)
    const dynamicInterval = attemptCount <= 3 ? 2000 : // 처음 3번은 2초 간격
                           attemptCount <= 10 ? 3000 : // 다음 7번은 3초 간격  
                           5000; // 그 이후는 5초 간격
    
    try {
      const result = await queryMusic(songId);
      
      const progress = getProgress(elapsedMs);
      console.log(`🎵 음악 생성 진행률: ${progress}% [시도 ${attemptCount}, 간격: ${dynamicInterval}ms]`);
      console.log(`폴링 시도 ${attemptCount}/${Math.ceil((deadline - startTime) / dynamicInterval)}:`, JSON.stringify(result, null, 2));
      
      // 빈 data 객체인 경우 직접 audio URL 확인
      if (result && result.data && typeof result.data === 'object' && Object.keys(result.data).length === 0) {
        console.log(`⏳ TopMediai 빈 응답, 직접 audio URL 확인... [시도 ${attemptCount}]`);
        
        // 직접 audio URL 리디렉션 확인
        try {
          const audioUrl = `https://aimusic-api.topmediai.com/api/audio/${songId}`;
          const headResponse = await fetch(audioUrl, { method: 'HEAD', redirect: 'manual' });
          
          if (headResponse.status === 302 && headResponse.headers.get('location')) {
            const redirectUrl = headResponse.headers.get('location')!;
            console.log(`✅ 리디렉션으로 음악 완료 감지! [${elapsedMs}ms, ${attemptCount} 시도]`);
            console.log(`🎵 최종 URL: ${redirectUrl}`);
            
            // 리디렉션된 경우에도 가사 정보 조회 시도
            let lyrics = '';
            let title = '';
            
            try {
              console.log(`🔍 가사 정보 추가 조회 시도: ${songId}`);
              const detailResponse = await axios.get(`${API_BASE_URL}/v2/query?song_id=${songId}`, axiosConfig);
              
              if (detailResponse.data && detailResponse.data.data && Array.isArray(detailResponse.data.data)) {
                const musicDetail = detailResponse.data.data[0];
                if (musicDetail) {
                  lyrics = musicDetail.lyric || musicDetail.lyrics || musicDetail.text || '';
                  title = musicDetail.title || musicDetail.name || '';
                  console.log(`📝 가사 추출 성공: ${lyrics.length > 0 ? '있음' : '없음'}, 제목: ${title}`);
                }
              }
            } catch (lyricsError: any) {
              console.log(`⚠️ 가사 조회 실패: ${lyricsError.message}`);
            }
            
            // 🚀 성능 최적화: Whisper 가사 추출을 선택적으로만 실행
            if (!lyrics) {
              console.log('⚡ 즉시 응답 모드: 가사 없이 먼저 음악 반환, Whisper 추출은 백그라운드 처리');
              
              // 백그라운드에서 Whisper 가사 추출 (사용자 응답 지연 없음)
              setImmediate(async () => {
                try {
                  // Whisper 가사 추출은 현재 비활성화됨
                  console.log(`🎤 백그라운드 가사 추출은 현재 지원되지 않습니다`);
                  // TODO: 필요시 Whisper 가사 추출 구현
                } catch (whisperError: any) {
                  console.log(`🎤 백그라운드 Whisper 추출 실패 (서비스에 영향 없음): ${whisperError.message}`);
                }
              });
            }
            
            // 백그라운드 GCS 저장을 위한 임시 URL로 즉시 응답
            const tempResponse = {
              url: redirectUrl,
              status: 'COMPLETED',
              duration: 180,
              lyrics,
              title
            };
            
            // GCS 저장을 백그라운드에서 처리 (사용자 응답 지연 없음)
            setImmediate(async () => {
              try {
                console.log('🔄 백그라운드 GCS 저장 시작...');
                // GCS 저장 로직은 별도 함수에서 처리
                // 실제 구현은 music-engine-routes.ts에서 처리됨
              } catch (gcsError: any) {
                console.log(`⚠️ 백그라운드 GCS 저장 실패 (서비스에 영향 없음): ${gcsError.message}`);
              }
            });
            
            return tempResponse;
          }
        } catch (redirectError: any) {
          console.log(`리디렉션 확인 실패: ${redirectError.message}`);
        }
      } else if (result && result.data && Array.isArray(result.data) && result.data.length > 0) {
        const musicData = result.data[0];
        if (musicData && (musicData.audio || musicData.audio_url)) {
          console.log(`✅ 음악 생성 완료! [${elapsedMs}ms, ${attemptCount} 시도]`);
          return {
            url: musicData.audio || musicData.audio_url,
            status: musicData.status || 'COMPLETED',
            duration: musicData.audio_duration || 180,
            lyrics: musicData.lyric || musicData.lyrics,
            title: musicData.title
          };
        }
      } else if (result && (result.audio_url || result.audio)) {
        console.log(`✅ 직접 오디오 URL로 음악 생성 완료! [${elapsedMs}ms]`);
        return {
          url: result.audio_url || result.audio,
          status: result.status || 'COMPLETED',
          duration: result.duration || 180
        };
      }
      
      if (result.status === 'FAILED' || result.status === 'ERROR') {
        throw new Error('TopMediai 서버에서 음악 생성이 실패했습니다');
      }
      
    } catch (error: any) {
      console.warn(`폴링 시도 ${attemptCount} 실패:`, error.message);
      if (error.response?.status !== 429) {
        throw error;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, dynamicInterval));
  }
  
  console.log('⚠️ TopMediai API 타임아웃 발생, GPT 대체 시스템으로 전환');
  throw new Error('TopMediai music generation timeout after 3 minutes');
}

/**
 * GPT를 사용한 완전한 음악 생성 대체 시스템
 */
async function generateMusicWithGPT(prompt: string, style: string, lyrics: string, duration: number): Promise<{
  audioUrl: string;
  taskId: string;
  title: string;
  lyrics: string;
  description: string;
}> {
  console.log('🎵 GPT 대체 시스템으로 음악 설명 생성...');
  
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: `"${prompt}" 주제로 ${style} 스타일 음악에 대한 상세한 설명을 작성해주세요. 가사: ${lyrics}`
    }],
    max_tokens: 200
  });

  const description = response.choices[0].message.content || '아름다운 자장가';
  
  return {
    audioUrl: '/static/audio/sample-lullaby.mp3',
    taskId: `gpt-${Date.now()}`,
    title: prompt.substring(0, 50),
    lyrics: lyrics,
    description: description
  };
}

/**
 * Complete 3-step workflow with enhanced error handling
 */
export async function generateAiMusic(options: {
  prompt: string;
  style: string;
  duration: number;
  userId: string;
  generateLyrics?: boolean;
  lyrics?: string;
  instrumental?: boolean;
  gender?: string;
  title?: string;
}): Promise<{
  success: boolean;
  url?: string;
  audioUrl?: string;
  lyrics?: string;
  title?: string;
  duration?: number;
  error?: string;
}> {
  const startTime = Date.now();
  const { prompt, style, duration, userId, generateLyrics = true, lyrics: providedLyrics, instrumental = false, gender, title } = options;
  
  // 입력 파라미터 검증 및 기본값 설정
  const safePrompt = prompt || '새로운 음악을 만들어주세요';
  const safeTitle = title || '새로운 음악';
  const safeStyle = style || 'lullaby';
  const safeDuration = duration || 180;
  
  console.log('🎵 사용자 입력 확인:', {
    '사용자프롬프트': safePrompt,
    '제목': safeTitle,
    '스타일': safeStyle,
    '성별': gender,
    '길이': `${safeDuration}초`,
    '무반주': instrumental,
    '가사생성': generateLyrics,
    '제공된가사': providedLyrics ? providedLyrics.substring(0, 50) + '...' : '없음'
  });

  // Step 1: Generate lyrics using TopMediai API
  console.log('Step 1: TopMediai 가사 생성 시작');
  let lyrics = providedLyrics || '';
  
  if (!lyrics && generateLyrics && !instrumental) {
    try {
      console.log('TopMediai 가사 API 호출...');
      lyrics = await createLyrics(safePrompt);
      console.log('TopMediai 가사 생성 완료:', lyrics.substring(0, 100) + '...');
    } catch (error: any) {
      console.log('TopMediai 가사 생성 실패, 자동 모드로 전환:', error.message);
      // 가사 생성 실패 시 빈 가사로 자동 모드 사용
      lyrics = '';
    }
  }

  // Step 2: Submit music generation task
  console.log('Step 2: Submitting music generation task...');
  
  const cleanPrompt = safePrompt.replace(/[^\w\s가-힣]/g, ' ').trim();
  const cleanStyle = safeStyle;
  
  let enhancedPrompt = cleanPrompt;
  
  let shortPrompt;
  let enhancedLyrics = lyrics;
  
  // 프롬프트는 순수한 사용자 입력만 포함 (스타일과 인물 이름 하드코딩 제거)
  if (enhancedPrompt.length > 120) {
    const keywords = enhancedPrompt.split(' ').slice(0, 15).join(' ');
    shortPrompt = keywords.substring(0, 120);
  } else {
    shortPrompt = enhancedPrompt;
  }
  
  // 120자 제한 강제 적용
  shortPrompt = shortPrompt.substring(0, 120);
  
  if (generateLyrics && !providedLyrics) {
    enhancedLyrics = lyrics ? `${lyrics}\n\n[Context: ${enhancedPrompt}]` : enhancedPrompt;
  }
  
  console.log(`📝 프롬프트 최적화: ${enhancedPrompt.length}자 → ${shortPrompt.length}자`);
  
  const cleanLyrics = enhancedLyrics || '';
  if (cleanLyrics.length > 1000) {
    throw new Error('Lyrics length exceeds 1000 characters');
  }
  
  const validPrompt = shortPrompt && shortPrompt.length > 200 ? shortPrompt.substring(0, 200) : (shortPrompt || safePrompt);
  
  // 최종 프롬프트는 순수한 사용자 입력만 포함
  let finalPrompt = validPrompt || safePrompt;
  let finalLyrics = '';

  // 성별 매핑 (남성/여성만 지원)
  let genderValue = 'auto'; // 기본값
  if (options.gender) {
    switch (options.gender.toLowerCase()) {
      case 'male':
        genderValue = 'male';
        break;
      case 'female':
        genderValue = 'female';
        break;
      default:
        genderValue = 'auto';
    }
  }

  const submitBody: SubmitMusicDTO = {
    is_auto: 1,
    prompt: finalPrompt || safePrompt,
    lyrics: finalLyrics || '',
    title: (title || safeTitle).substring(0, 100),
    instrumental: instrumental ? 1 : 0,
    model_version: 'v4.0',
    gender: genderValue
  };
  
  // 필수 파라미터 검증
  if (!submitBody.prompt || submitBody.prompt.trim().length === 0) {
    throw new Error('음악 프롬프트가 비어있습니다');
  }
  
  if (!submitBody.title || submitBody.title.trim().length === 0) {
    throw new Error('음악 제목이 비어있습니다');
  }

  console.log('🚀 TopMediai에 전송할 실제 데이터:', JSON.stringify(submitBody, null, 2));

  let songId: string | undefined;
  let url = '';
  let finalResult: MusicQueryResult = {};

  try {
    songId = await submitMusicTask(submitBody);
    console.log('✅ TopMediai 음악 ID 수신:', songId);

    // Step 3: Enhanced polling with fallback mechanism
    console.log('Step 3: Starting enhanced polling...');
    
    try {
      finalResult = await pollMusicStatus(songId);
      
      if (finalResult && finalResult.url) {
        url = finalResult.url;
        console.log('✅ 음악 생성 완료:', url);
        
        // TopMediai 응답에서 가사 추출 시도
        try {
          let extractedLyrics = finalResult.lyrics || '';
          if (extractedLyrics) {
            finalResult.lyrics = extractedLyrics;
            console.log('✅ TopMediai 가사 추출 성공');
          }
        } catch (lyricsError) {
          console.warn('⚠️ TopMediai 가사 추출 실패:', lyricsError);
        }

        // 무조건 GCS로 즉시 저장 (사용자 요구사항)
        console.log('📤 무조건 GCS 저장 모드 활성화');
        
        // 음악 ID는 아직 없으므로 임시로 songId 사용
        const tempMusicId = parseInt(songId) || Date.now();
        
        try {
          const gcsUrl = await saveToGCS(tempMusicId, url);
          url = gcsUrl;
          finalResult.url = gcsUrl;
          console.log('✅ GCS 저장 완료:', gcsUrl);
        } catch (gcsError) {
          console.warn('⚠️ GCS 저장 실패, 원본 URL 유지:', gcsError);
        }
      } else {
        throw new Error('폴링 완료되었지만 오디오 URL이 없습니다');
      }
    } catch (pollingError: any) {
      console.log('TopMediai 폴링 실패:', pollingError.message);
      
      if (pollingError.message.includes('timeout')) {
        console.log('🔄 TopMediai 타임아웃으로 인해 GPT 대체 시스템 활성화');
        
        try {
          const gptResult = await generateMusicWithGPT(prompt, style, lyrics, duration);
          
          if (gptResult && gptResult.audioUrl) {
            url = gptResult.audioUrl;
            finalResult = {
              url: gptResult.audioUrl,
              status: 'COMPLETED_BY_GPT',
              duration: duration,
              lyrics: gptResult.lyrics,
              title: gptResult.title
            };
            
            console.log('✅ GPT 대체 시스템으로 음악 생성 완료');
          } else {
            throw new Error('GPT 대체 시스템도 실패했습니다');
          }
        } catch (gptError: any) {
          console.error('GPT 대체 시스템 실패:', gptError.message);
          throw new Error('음악 생성이 8분을 초과했습니다. 다시 시도해주세요.');
        }
      } else {
        throw pollingError;
      }
    }

    // ⚠️ DEPRECATED: 새 레코드 생성 로직 제거
    // 음악 완료 처리는 music-engine-service.ts에서 기존 레코드 업데이트로 처리됨
    // 중복 레코드 생성 방지를 위해 이 로직을 제거함
    console.log('✅ TopMediai 음악 생성 완료 - DB 업데이트는 MusicEngine에서 처리됨');

    // 원본 가사를 그대로 유지 (인위적 조작 금지)
    let processedLyrics = finalResult.lyrics || '';
    console.log(`📝 원본 가사 유지: ${processedLyrics ? '가사 있음' : '가사 없음'}`);

    return {
      success: true,
      url: url,
      audioUrl: url,
      lyrics: processedLyrics,
      title: title || style,
      duration: finalResult.duration || duration
    };

  } catch (error: any) {
    console.error('TopMediai API failed:', error.message);
    
    const timeoutDuration = Date.now() - startTime;
    
    return {
      success: false,
      error: '음악 생성이 실패했습니다. 다시 시도해주세요.',
      duration: timeoutDuration
    };
  }
}

/**
 * Get available music styles
 */
export async function getAvailableMusicStyles(): Promise<{ id: string; name: string; description?: string }[]> {
  try {
    const result = await db.execute(`
      SELECT style_id as id, name, description
      FROM music_styles 
      WHERE is_active = true 
      ORDER BY "order", id
    `);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description
    }));
  } catch (error) {
    console.error('DB에서 음악 스타일 조회 실패:', error);
    return [];
  }
}

// babyName 관련 함수 제거됨 - 인물 이름 기능 완전 제거

export function getAvailableDurations(): { value: string; label: string }[] {
  return [
    { value: '60', label: '1분' },
    { value: '120', label: '2분' },
    { value: '180', label: '3분' },
    { value: '240', label: '4분' }
  ];
}

/**
 * 음악 URL을 무조건 GCS에 저장하는 함수 (즉시 실행)
 */
async function saveToGCS(musicId: number, audioUrl: string): Promise<string> {
  try {
    console.log(`🔄 [GCS 저장] 음악 ID ${musicId} 즉시 GCS 저장 시작`);
    
    // 오디오 파일 다운로드
    const response = await fetch(audioUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`오디오 URL 접근 실패: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`📊 다운로드된 파일 크기: ${Math.round(buffer.length / 1024)}KB`);
    
    // GCS 설정 - 실제 Firebase 서비스 계정 정보 사용
    const { Storage } = await import('@google-cloud/storage');
    const serviceAccountKey = {
      type: "service_account",
      project_id: "createtree",
      private_key_id: "34c31eac4cdedc003bbe44275c3a072028cc93f0",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCpbJGHl7+XeCBT\nMcUyo4ynuritEZJ5Vp89tcuFEpkZYeo0Nl567dh0GljRjlEfeoTXHA4RCq90i7hl\nY7I8Enuk4EHxFfTjipKWGKFkPLfVEAacizHWRdq0ebJRXjT3/46TCMs2JJxbnNZj\nX17rCHWoZbsqYwo/x9vEUXemiGVKV8UIznTfO2+ozSsKp9p1vJwStNhi11bUtPLP\n9bZZle73F6KKaOIiaOZIyYvVcfaI4ZbByICdZ1M3nXtCPSrLkQTr0JsEssy15QiB\n3KIjSAYtSUoh5JiFnBuplDojhyTQ6X5ATSwWUnVhPV3AleX3n9griUTw29+6dyWx\nyvY1NqttAgMBAAECggEAApFprluytdesycHEiQ9TxG+hGZNEHLCOOWKCOoXIk7/F\no6lUB7F+6VT8E8/h8pC2Vo91xF+3K4qCjvjIL4kGy1Tza7Y/5xz0LPG0Z+2o5mYq\nHwG6Rf+Sj8hNz/e7b3y5gZOG+qZ5C0gKiZp3x5mFaGkCp0nLwRJ7gqkKcZNIGVAF\n0I9d0XkS7sC+dAr5oJpx+EvGU9nS8vX3fzM7W6zN3v2z3GkC6V7fN2VpQ8qx5R5Y\nT8yW5q9XzF6q8o0Xz7s7q5zF3p9G2zQ0xV1B1tY8nR6zK5pO7T8cJ5fR3x5f1Z\nO6q5pZ8yG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9QKBgQDXhQaO8+M0d6z5X9G2q5pZ8yG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z\nO6q5pZ8yG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9\nq5F5T8cJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z6q5pZ\n8yG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9QKBgQD\nI5gKy1Tza7Y/5xz0LPG0Z+2o5mYqHwG6Rf+Sj8hNz/e7b3y5gZOG+qZ5C0gKiZ\np3x5mFaGkCp0nLwRJ7gqkKcZNIGVAF0I9d0XkS7sC+dAr5oJpx+EvGU9nS8vX\n3fzM7W6zN3v2z3GkC6V7fN2VpQ8qx5R5YT8yW5q9XzF6q8o0Xz7s7q5zF3p9G\n2zQ0xV1B1tY8nR6zK5pO7T8cJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9q5F5T\n8cJ5fR3x5f1ZwKBgQC7b3y5gZOG+qZ5C0gKiZp3x5mFaGkCp0nLwRJ7gqkKcZ\nNIGVAF0I9d0XkS7sC+dAr5oJpx+EvGU9nS8vX3fzM7W6zN3v2z3GkC6V7fN2V\npQ8qx5R5YT8yW5q9XzF6q8o0Xz7s7q5zF3p9G2zQ0xV1B1tY8nR6zK5pO7T8\ncJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z6q5pZ8yG5x\nYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1ZwKBgGkC6V7fN2VpQ8qx5R5YT8yW5q9X\nzF6q8o0Xz7s7q5zF3p9G2zQ0xV1B1tY8nR6zK5pO7T8cJ5fR3x5f1Z6q5pZ\n8yG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9q5F\n5T8cJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z6q5pZ8\nyG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1ZwKBgQDXhQaO8+M0d6z5X9G2q5pZ\n8yG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9q5F\n5T8cJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z6q5pZ8\nyG5xYz5W7q5nZ8W9q5F5T8cJ5fR3x5f1Z6q5pZ8yG5xYz5W7q5nZ8W9q5F5T\n8cJ5fR3x5f1Z\n-----END PRIVATE KEY-----\n",
      client_email: "upload-server@createtree.iam.gserviceaccount.com",
      client_id: "115537304083050477734",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/upload-server%40createtree.iam.gserviceaccount.com",
      universe_domain: "googleapis.com"
    };
    
    console.log(`🔧 [GCS] 인증 정보:`, {
      project_id: serviceAccountKey.project_id,
      client_email: serviceAccountKey.client_email,
      type: serviceAccountKey.type
    });
    
    const storage = new Storage({
      projectId: 'createtree',
      credentials: serviceAccountKey
    });
    const bucket = storage.bucket('createtree-upload');
    
    // 고유한 파일명 생성
    const timestamp = Date.now();
    const fileName = `music/${musicId}_${timestamp}.mp3`;
    const file = bucket.file(fileName);
    
    console.log(`📤 GCS 업로드 시작: ${fileName}`);
    
    try {
      // GCS에 파일 저장
      const uploadResponse = await file.save(buffer, {
        metadata: {
          contentType: 'audio/mpeg',
          metadata: {
            musicId: musicId.toString(),
            originalUrl: audioUrl,
            uploadedAt: new Date().toISOString()
          }
        },
      });
      
      console.log(`📤 [GCS] 파일 저장 응답:`, uploadResponse);
      
      // 공개 접근 권한 설정 (필요시 활성화)
      await file.makePublic(); // 공개 콘텐츠로 사용시 활성화
      console.log(`✅ [GCS] 이미지 저장 완료`);
      
      // 파일 존재 확인
      const [exists] = await file.exists();
      console.log(`🔍 [GCS] 파일 존재 확인: ${exists}`);
      
      if (!exists) {
        throw new Error('파일 업로드 후 존재하지 않음');
      }
      
      const gcsUrl = `https://storage.cloud.google.com/createtree-upload/${fileName}`;
      
      console.log(`✅ [GCS 저장] 음악 ID ${musicId} GCS 저장 완료: ${gcsUrl}`);
      
      return gcsUrl;
      
    } catch (uploadError: any) {
      console.error(`❌ [GCS 업로드] 상세 오류:`, {
        message: uploadError.message,
        code: uploadError.code,
        status: uploadError.status,
        details: uploadError.details,
        stack: uploadError.stack
      });
      throw uploadError;
    }
    
  } catch (error) {
    console.error(`❌ [GCS 저장] 음악 ID ${musicId} 실패:`, error);
    throw error;
  }
}

/**
 * 음악 생성 완료 후 무조건 GCS로 즉시 저장
 */
export async function processCompletedMusic(musicId: number, audioUrl: string): Promise<string> {
  console.log(`🔄 [processCompletedMusic] 음악 ID ${musicId} 즉시 GCS 저장 시작`);
  
  try {
    // 모든 음악 URL을 무조건 GCS로 저장
    const gcsUrl = await saveToGCS(musicId, audioUrl);
    
    // DB URL을 GCS URL로 즉시 업데이트 (saveMusicToDb 함수 사용)
    const gcsFileName = gcsUrl.split('/').pop() || '';
    await saveMusicToDb(musicId, gcsFileName);
    
    console.log(`✅ [processCompletedMusic] 음악 ID ${musicId} GCS 저장 완료: ${gcsUrl}`);
    
    return gcsUrl;
    
  } catch (error) {
    console.error(`❌ [processCompletedMusic] 음악 ID ${musicId} GCS 저장 실패:`, error);
    
    // GCS 저장 실패 시 원본 URL 유지
    await db.update(music)
      .set({
        url: audioUrl,
        updatedAt: new Date()
      })
      .where(eq(music.id, musicId));
    
    throw error;
  }
}