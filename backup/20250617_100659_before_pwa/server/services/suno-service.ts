/**
 * Suno AI 음악 생성 서비스
 * 
 * 주요 기능:
 * 1. Suno API를 통한 음악 생성
 * 2. 작업 상태 확인
 * 3. 완료된 음악 파일 다운로드
 * 4. GCS 업로드 및 URL 생성
 */

import { Storage } from '@google-cloud/storage';

// Suno API 인터페이스 정의
export interface SunoMusicRequest {
  prompt: string;
  make_instrumental?: boolean;
  wait_audio?: boolean;
  model?: string;
  title?: string;
  tags?: string;
}

export interface SunoMusicResponse {
  id: string;
  title: string;
  tags: string;
  prompt: string;
  type: string;
  status: 'submitted' | 'queued' | 'streaming' | 'complete' | 'error';
  play_count: number;
  upvote_count: number;
  is_video_pending: boolean;
  video_url: string | null;
  audio_url: string | null;
  image_url: string | null;
  image_large_url: string | null;
  is_liked: boolean;
  user_id: string;
  display_name: string;
  handle: string;
  is_handle_updated: boolean;
  avatar_image_url: string | null;
  is_trashed: boolean;
  reaction: any | null;
  created_at: string;
  status_history: any[];
  metadata: {
    tags: string;
    prompt: string;
    gpt_description_prompt: string | null;
    audio_prompt_id: string | null;
    history: any | null;
    concat_history: any | null;
    type: string;
    duration: number | null;
    refund_credits: boolean | null;
    stream: boolean;
    error_type: string | null;
    error_message: string | null;
  };
  major_model_version: string;
  model_name: string;
  metadata_v2: any | null;
}

export interface SunoGenerationResult {
  success: boolean;
  taskId?: string;
  audioUrl?: string;
  lyrics?: string;
  title?: string;
  duration?: number;
  error?: string;
  metadata?: any;
}

/**
 * Suno AI 서비스 클래스
 */
export class SunoService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://studio-api.suno.ai';
  private readonly gcs: Storage;
  private readonly bucketName: string;

  constructor() {
    this.apiKey = process.env.SUNO_API_KEY!;
    this.bucketName = process.env.GCS_BUCKET || 'createtree-music';
    
    if (!this.apiKey) {
      throw new Error('SUNO_API_KEY 환경변수가 설정되지 않았습니다');
    }

    // GCS 클라이언트 초기화
    this.gcs = new Storage({
      projectId: process.env.FB_PROJECT_ID,
      keyFilename: undefined, // 환경변수에서 자동으로 로드
      credentials: {
        type: process.env.FB_TYPE,
        project_id: process.env.FB_PROJECT_ID,
        private_key_id: process.env.FB_PRIVATE_KEY_ID,
        private_key: process.env.FB_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FB_CLIENT_EMAIL,
        client_id: process.env.FB_CLIENT_ID,
        auth_uri: process.env.FB_AUTH_URI,
        token_uri: process.env.FB_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FB_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.FB_CLIENT_X509_CERT_URL,
      }
    });
  }

  /**
   * 음악 생성 요청
   */
  async generateMusic(request: SunoMusicRequest): Promise<SunoGenerationResult> {
    try {
      console.log('🎵 [Suno] 음악 생성 요청:', {
        prompt: request.prompt?.substring(0, 100) + '...',
        title: request.title,
        instrumental: request.make_instrumental,
        model: request.model || 'chirp-v3-5'
      });

      const response = await fetch(`${this.baseUrl}/api/external/generate/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'CreateTree-AI/1.0'
        },
        body: JSON.stringify({
          ...request,
          model: request.model || 'chirp-v3-5',
          wait_audio: false // 비동기 처리
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Suno] API 오류:', response.status, errorText);
        
        return {
          success: false,
          error: `Suno API 오류 (${response.status}): ${errorText}`
        };
      }

      const data = await response.json();
      console.log('✅ [Suno] 생성 요청 성공:', {
        taskIds: data.map((item: any) => item.id),
        count: data.length
      });

      // 첫 번째 생성 결과의 ID 반환
      const firstResult = data[0];
      if (!firstResult) {
        return {
          success: false,
          error: 'Suno API에서 결과를 반환하지 않았습니다'
        };
      }

      return {
        success: true,
        taskId: firstResult.id,
        title: firstResult.title,
        metadata: firstResult
      };

    } catch (error: any) {
      console.error('❌ [Suno] 음악 생성 실패:', error);
      return {
        success: false,
        error: `음악 생성 중 오류 발생: ${error.message}`
      };
    }
  }

  /**
   * 작업 상태 확인
   */
  async checkStatus(taskId: string): Promise<SunoGenerationResult> {
    try {
      console.log('🔍 [Suno] 상태 확인:', taskId);

      const response = await fetch(`${this.baseUrl}/api/external/clips/?ids=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'CreateTree-AI/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Suno] 상태 확인 오류:', response.status, errorText);
        
        return {
          success: false,
          error: `상태 확인 오류 (${response.status}): ${errorText}`
        };
      }

      const data = await response.json();
      const clip = data[0] as SunoMusicResponse;

      if (!clip) {
        return {
          success: false,
          error: '작업을 찾을 수 없습니다'
        };
      }

      console.log('📊 [Suno] 상태:', {
        id: clip.id,
        status: clip.status,
        title: clip.title,
        hasAudio: !!clip.audio_url,
        duration: clip.metadata?.duration
      });

      // 완료 상태 확인
      if (clip.status === 'complete' && clip.audio_url) {
        return {
          success: true,
          taskId: clip.id,
          audioUrl: clip.audio_url,
          title: clip.title,
          duration: clip.metadata?.duration || 0,
          lyrics: clip.prompt, // Suno에서는 prompt가 가사 역할
          metadata: clip
        };
      }

      // 오류 상태 확인
      if (clip.status === 'error') {
        return {
          success: false,
          error: clip.metadata?.error_message || 'Suno에서 음악 생성에 실패했습니다'
        };
      }

      // 진행 중 상태
      return {
        success: true,
        taskId: clip.id,
        title: clip.title,
        metadata: { status: clip.status }
      };

    } catch (error: any) {
      console.error('❌ [Suno] 상태 확인 실패:', error);
      return {
        success: false,
        error: `상태 확인 중 오류 발생: ${error.message}`
      };
    }
  }

  /**
   * 완료된 음악을 GCS에 업로드하고 공개 URL 반환
   */
  async downloadAndUpload(audioUrl: string, musicId: number): Promise<string | null> {
    try {
      console.log('📥 [Suno] 음악 다운로드 시작:', { audioUrl, musicId });

      // 1. Suno에서 음악 파일 다운로드
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`음악 다운로드 실패: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(audioBuffer);

      console.log('📁 [Suno] 파일 다운로드 완료:', {
        size: `${(buffer.length / 1024 / 1024).toFixed(2)}MB`,
        contentType: response.headers.get('content-type')
      });

      // 2. GCS 업로드 경로 생성
      const timestamp = Date.now();
      const gcsPath = `${process.env.GCS_MUSIC_PATH_SUNO || 'music/suno'}/${musicId}_${timestamp}.mp3`;

      // 3. GCS에 업로드
      const bucket = this.gcs.bucket(this.bucketName);
      const file = bucket.file(gcsPath);

      await file.save(buffer, {
        metadata: {
          contentType: 'audio/mpeg',
          metadata: {
            engine: 'suno',
            musicId: musicId.toString(),
            originalUrl: audioUrl,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      // 4. 공개 접근 권한 설정
      await file.makePublic();

      // 5. 공개 URL 생성
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${gcsPath}`;

      console.log('✅ [Suno] GCS 업로드 완료:', {
        gcsPath,
        publicUrl,
        size: `${(buffer.length / 1024 / 1024).toFixed(2)}MB`
      });

      return publicUrl;

    } catch (error: any) {
      console.error('❌ [Suno] 업로드 실패:', error);
      return null;
    }
  }

  /**
   * 사용 가능한 모델 목록 조회
   */
  async getModels(): Promise<string[]> {
    try {
      // Suno의 주요 모델들 (API 문서 기준)
      return [
        'chirp-v3-5',    // 최신 모델
        'chirp-v3-0',    // 이전 모델
        'chirp-v2-xxl'   // 구 모델
      ];
    } catch (error: any) {
      console.error('❌ [Suno] 모델 목록 조회 실패:', error);
      return ['chirp-v3-5']; // 기본 모델
    }
  }

  /**
   * 크레딧 잔액 확인
   */
  async getCredits(): Promise<{ credits: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/external/credits/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'CreateTree-AI/1.0'
        }
      });

      if (!response.ok) {
        return { credits: 0, error: `크레딧 조회 실패: ${response.status}` };
      }

      const data = await response.json();
      return { credits: data.credits_left || 0 };

    } catch (error: any) {
      console.error('❌ [Suno] 크레딧 조회 실패:', error);
      return { credits: 0, error: error.message };
    }
  }
}

// 전역 Suno 서비스 인스턴스
export const sunoService = new SunoService();