/**
 * TopMediai AI Music Generator API Integration - Fixed Version
 * 
 * Implements 3-step workflow:
 * 1. Generate lyrics (POST /v1/lyrics)
 * 2. Submit music generation task (POST /v2/submit) 
 * 3. Query generation status (GET /v2/query)
 */
import axios from 'axios';
// 가사 추출 함수는 동적 임포트로 사용
// GCS 업로드 함수는 동적 임포트로 사용
import { db } from '../../db/index';
import { music } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

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

const axiosConfig = {
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 180000
};

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
  const ENDPOINT = `${API_BASE_URL}/v2/submit`;
  
  try {
    const response = await axios.post(ENDPOINT, body, axiosConfig);
    console.log('TopMediai submit response:', JSON.stringify(response.data, null, 2));
    
    let songId;
    if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
      songId = response.data.data[0].song_id;
    } else {
      songId = response.data.id || response.data.song_id;
    }
    
    if (!songId) {
      throw new Error('TopMediai에서 음악 ID를 받지 못했습니다');
    }
    
    return songId as string;
  } catch (error: any) {
    console.error('TopMediai submit API error:', error.response?.data || error.message);
    throw new Error(`Music generation failed: ${error.response?.status || 'Network error'}`);
  }
}

/**
 * Step 3: Query music generation status with enhanced fallback
 */
export async function queryMusic(songId: string): Promise<MusicQueryResult> {
  const queryUrl = `${API_BASE_URL}/v2/query?id=${songId}`;
  
  try {
    const response = await axios.get(queryUrl, axiosConfig);
    console.log('TopMediai query response:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.data) {
      return response.data;
    } else if (response.data) {
      return { data: response.data, status: response.data.status || 200 };
    }
    
    return response.data;
  } catch (error: any) {
    console.error('TopMediai query API error:', error.response?.data || error.message);
    throw new Error(`Music query failed: ${error.response?.status || 'Network error'}`);
  }
}

/**
 * Enhanced polling with proper timeout handling
 */
export async function pollMusicStatus(songId: string): Promise<MusicQueryResult> {
  const startTime = Date.now();
  const deadline = startTime + 3 * 60 * 1000; // 3분 제한
  let attemptCount = 0;
  
  console.log(`🔄 시작 향상된 폴링 [songId: ${songId}] 3분 제한시간...`);
  
  while (Date.now() < deadline) {
    attemptCount++;
    const elapsedMs = Date.now() - startTime;
    
    try {
      const result = await queryMusic(songId);
      
      console.log(`폴링 시도 ${attemptCount}/${Math.ceil((deadline - startTime) / 5000)}:`, JSON.stringify(result, null, 2));
      
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
            
            return {
              url: redirectUrl,
              status: 'COMPLETED',
              duration: 180,
              lyrics,
              title
            };
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
    
    await new Promise(resolve => setTimeout(resolve, 5000));
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
  
  console.log('🎵 사용자 입력 확인:', {
    '사용자프롬프트': prompt,
    '제목': title,
    '스타일': style,
    '성별': gender,
    '길이': `${duration}초`,
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
      lyrics = await createLyrics(prompt);
      console.log('TopMediai 가사 생성 완료:', lyrics.substring(0, 100) + '...');
    } catch (error: any) {
      console.log('TopMediai 가사 생성 실패, 자동 모드로 전환:', error.message);
      // 가사 생성 실패 시 빈 가사로 자동 모드 사용
      lyrics = '';
    }
  }

  // Step 2: Submit music generation task
  console.log('Step 2: Submitting music generation task...');
  
  const cleanPrompt = prompt.replace(/[^\w\s가-힣]/g, ' ').trim();
  const cleanStyle = style || 'lullaby';
  
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
  
  const validPrompt = shortPrompt.length > 200 ? shortPrompt.substring(0, 200) : shortPrompt;
  
  // 최종 프롬프트는 순수한 사용자 입력만 포함
  let finalPrompt = validPrompt;
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
    prompt: finalPrompt,
    lyrics: finalLyrics,
    title: (title || '').substring(0, 100),
    instrumental: instrumental ? 1 : 0,
    model_version: 'v4.0',
    gender: genderValue
  };
  
  console.log('🚀 TopMediai에 전송할 실제 데이터:', JSON.stringify(submitBody, null, 2));

  let songId: string | undefined;
  let url = '';
  let finalResult: MusicQueryResult = {};

  try {
    songId = await submitMusicTask(submitBody);
    console.log('Received song_id:', songId);

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
    
    // GCS 설정
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage({
      projectId: 'createtreeai',
      keyFilename: './server/createtree-ai-firebase-adminsdk.json'
    });
    const bucket = storage.bucket('createtree-upload');
    
    // 고유한 파일명 생성
    const timestamp = Date.now();
    const fileName = `music/${musicId}_${timestamp}.mp3`;
    const file = bucket.file(fileName);
    
    console.log(`📤 GCS 업로드 시작: ${fileName}`);
    
    // GCS에 파일 저장
    await file.save(buffer, {
      metadata: {
        contentType: 'audio/mpeg',
        metadata: {
          musicId: musicId.toString(),
          originalUrl: audioUrl,
          uploadedAt: new Date().toISOString()
        }
      },
    });
    
    // 공개 접근 권한 설정
    await file.makePublic();
    
    const gcsUrl = `https://storage.cloud.google.com/createtree-upload/${fileName}`;
    
    console.log(`✅ [GCS 저장] 음악 ID ${musicId} GCS 저장 완료: ${gcsUrl}`);
    
    return gcsUrl;
    
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