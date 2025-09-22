/**
 * 음악 엔진 통합 관리 서비스 - 수정된 버전
 * 
 * TopMediai 엔진을 통한 음악 생성 서비스를 제공합니다.
 * 단일 엔진으로 안정적인 음악 생성을 보장합니다.
 */
import { db } from '@db';
import { music } from '../../shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { generateAiMusic } from './topmedia-service';

// GCS 저장 함수 import
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
    
    // GCS 설정 - 환경변수 기반 ADC 인증 사용
    const { Storage } = await import('@google-cloud/storage');
    
    console.log(`🔧 [GCS] 환경변수 기반 인증 사용:`, {
      project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
      auth_method: 'GOOGLE_CLOUD_* 환경변수 기반'
    });
    
    const storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
      }
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
      
      const gcsUrl = `https://storage.googleapis.com/createtree-upload/${fileName}`;
      
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

export type MusicEngine = 'topmedia';

export interface MusicGenerationRequest {
  prompt: string;
  title?: string;
  style?: string;
  instrumental?: boolean;
  duration?: number;
  gender?: string;
  generateLyrics?: boolean;
  lyrics?: string;
  userId?: number;
  preferredEngine?: MusicEngine;
}

export interface MusicGenerationResult {
  success: boolean;
  musicId?: number;
  engine?: MusicEngine;
  taskId?: string;
  status?: string;
  audioUrl?: string;
  lyrics?: string;
  title?: string;
  duration?: number;
  fallbackUsed?: boolean;
  error?: string;
  metadata?: any;
  isDuplicate?: boolean;
}

/**
 * 음악 엔진 통합 관리 클래스
 */
export class MusicEngineService {
  private readonly defaultEngine: MusicEngine;
  private readonly topMediaEnabled: boolean;

  constructor() {
    this.defaultEngine = 'topmedia';
    this.topMediaEnabled = !!process.env.TOPMEDIA_API_KEY;
  }

  /**
   * 진행 중인 음악 생성 체크 및 중복 방지
   */
  private async checkOngoingGeneration(userId?: number): Promise<{ hasOngoing: boolean; ongoingId?: number }> {
    if (!userId) return { hasOngoing: false };

    const pendingMusic = await db.query.music.findFirst({
      where: and(
        eq(music.userId, userId),
        eq(music.status, 'pending')
      )
    });

    return {
      hasOngoing: !!pendingMusic,
      ongoingId: pendingMusic?.id
    };
  }

  /**
   * 오래된 pending 음악 정리
   */
  private async cleanupStaleMusic() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const stalePendingMusic = await db.query.music.findMany({
      where: and(
        eq(music.status, 'pending'),
        sql`${music.createdAt} < ${fiveMinutesAgo}`
      )
    });

    if (stalePendingMusic.length > 0) {
      console.log(`🧹 [MusicEngine] ${stalePendingMusic.length}개의 오래된 pending 음악 정리`);
      
      for (const staleMusic of stalePendingMusic) {
        await db.update(music)
          .set({ 
            status: 'failed',
            updatedAt: new Date()
          })
          .where(eq(music.id, staleMusic.id));
      }
    }
  }

  /**
   * 음악 생성 요청 처리
   */
  async generateMusic(request: MusicGenerationRequest): Promise<MusicGenerationResult> {
    console.log('🎯 [MusicEngine] 음악 생성 요청 시작:', {
      prompt: request.prompt?.substring(0, 50),
      style: request.style,
      userId: request.userId
    });

    // 오래된 pending 음악 정리
    await this.cleanupStaleMusic();

    // 진행 중인 작업 확인
    const ongoingCheck = await this.checkOngoingGeneration(request.userId);
    if (ongoingCheck.hasOngoing) {
      console.log('⚠️ [MusicEngine] 이미 진행 중인 음악 생성 있음:', ongoingCheck.ongoingId);
      return {
        success: false,
        error: '이미 진행 중인 음악 생성이 있습니다. 잠시 후 다시 시도해주세요.',
        isDuplicate: true
      };
    }

    try {
      // 음악 레코드 생성
      const musicRecord = await this.createMusicRecord(request);
      console.log('✅ [MusicEngine] 음악 레코드 생성:', musicRecord.id);

      // TopMediai 엔진으로 음악 생성 시도
      const result = await this.tryTopMediaEngine(request, musicRecord.id);
      
      if (result.success) {
        console.log('✅ [MusicEngine] 음악 생성 성공');
        return {
          ...result,
          musicId: musicRecord.id,
          engine: 'topmedia'
        };
      } else {
        // 실패 시 레코드 업데이트
        await db.update(music)
          .set({
            status: 'failed',
            updatedAt: new Date()
          })
          .where(eq(music.id, musicRecord.id));

        return {
          success: false,
          musicId: musicRecord.id,
          error: result.error || '음악 생성에 실패했습니다'
        };
      }

    } catch (error: any) {
      console.error('❌ [MusicEngine] 음악 생성 중 예외 발생:', error);
      return {
        success: false,
        error: `음악 생성 중 오류 발생: ${error.message}`
      };
    }
  }

  /**
   * 음악 레코드 생성
   */
  private async createMusicRecord(request: MusicGenerationRequest) {
    const musicData = {
      title: request.title || '새로운 음악',
      prompt: request.prompt,
      style: request.style,
      gender: request.gender,
      lyrics: request.lyrics,
      duration: request.duration,
      instrumental: request.instrumental || false,  // instrumental 필드 추가
      generateLyrics: request.generateLyrics !== false,  // generateLyrics 필드 추가
      status: 'pending' as const,
      engine: 'topmedia' as const,
      userId: request.userId
    };

    const [newMusic] = await db.insert(music).values(musicData).returning();
    return newMusic;
  }

  /**
   * TopMediai 엔진으로 음악 생성 시도
   */
  private async tryTopMediaEngine(request: MusicGenerationRequest, musicId: number): Promise<MusicGenerationResult> {
    console.log('🎯 [MusicEngine] TopMediai 엔진 시도 시작');

    // 음악 스타일 프롬프트 조회 및 결합
    let enhancedPrompt = request.prompt || '새로운 음악';
    if (request.style) {
      console.log(`🎨 [MusicEngine] 스타일 적용: ${request.style}`);
    }

    // TopMediai API 호출
    const topMediaRequest = {
      prompt: enhancedPrompt,
      style: request.style || 'lullaby',
      duration: request.duration || 180,
      userId: request.userId?.toString() || 'anonymous',
      title: request.title || '새로운 음악',
      gender: request.gender || 'auto',
      // 반주만 옵션이 선택되면 가사 생성을 자동으로 비활성화
      generateLyrics: request.instrumental ? false : (request.generateLyrics !== false),
      instrumental: request.instrumental || false       // 사용자 설정 사용 (기본값 false)
    };

    console.log('📤 TopMediai API 호출 데이터:', topMediaRequest);

    const topMediaResult = await generateAiMusic(topMediaRequest);
    
    if (topMediaResult.success) {
      // TopMediai API 성공 시 처리
      const audioUrl = topMediaResult.url || topMediaResult.audioUrl;
      
      if (audioUrl) {
        // 📤 무조건 GCS 저장 모드 활성화
        console.log('📤 무조건 GCS 저장 모드 활성화');
        
        // 🚀 즉시 TopMediai URL로 완료 처리 (GCS 저장 기다리지 않음!)
        await db.update(music)
          .set({
            url: audioUrl,  // TopMediai URL 즉시 사용
            gcsPath: null,  // GCS는 나중에 업데이트
            lyrics: topMediaResult.lyrics ?? undefined,
            status: 'completed',
            updatedAt: new Date()
          })
          .where(eq(music.id, musicId));

        // 🔄 백그라운드에서 GCS 저장 (응답 후 실행)
        process.nextTick(() => {
          console.log(`🔄 백그라운드 GCS 저장 시작...`);
          saveToGCS(musicId, audioUrl)
            .then(gcsUrl => {
              // 성공하면 URL 업데이트
              return db.update(music)
                .set({
                  url: gcsUrl,
                  gcsPath: gcsUrl,
                  updatedAt: new Date()
                })
                .where(eq(music.id, musicId));
            })
            .then(() => {
              console.log(`✅ [GCS 저장] 백그라운드 완료`);
            })
            .catch((error: any) => {
              console.error(`⚠️ 백그라운드 GCS 저장 실패:`, error.message);
            });
        });

        return {
          success: true,
          musicId: musicId,
          audioUrl: audioUrl,  // TopMediai URL 즉시 반환
          lyrics: topMediaResult.lyrics,
          title: topMediaResult.title,
          duration: topMediaResult.duration,
          status: 'completed',
          engine: 'topmedia'
        };
      } else {
        // URL이 없으면 처리 중 상태로 변경
        await db.update(music)
          .set({
            status: 'processing',
            updatedAt: new Date()
          })
          .where(eq(music.id, musicId));

        return {
          success: true,
          musicId: musicId,
          status: 'processing',
          engine: 'topmedia'
        };
      }
    } else {
      return {
        success: false,
        error: topMediaResult.error || 'TopMediai 음악 생성 실패'
      };
    }
  }

  /**
   * 음악 생성 상태 확인 및 처리
   */
  async checkMusicStatus(musicId: number): Promise<MusicGenerationResult> {
    try {
      const musicRecord = await db.query.music.findFirst({
        where: eq(music.id, musicId)
      });

      if (!musicRecord) {
        return {
          success: false,
          error: '음악 레코드를 찾을 수 없습니다'
        };
      }

      if (musicRecord.status === 'completed') {
        return {
          success: true,
          musicId,
          status: 'completed',
          audioUrl: musicRecord.url || undefined,
          title: musicRecord.title,
          lyrics: musicRecord.lyrics ?? undefined
        };
      }

      if (musicRecord.status === 'failed') {
        return {
          success: false,
          musicId,
          error: '음악 생성 실패'
        };
      }

      if (musicRecord.status === 'processing' && musicRecord.engineTaskId) {
        // TopMediai 상태 확인 (임시로 단순 처리 중 상태 반환)
        return {
          success: true,
          musicId,
          status: 'processing'
        };
      }

      // 기본적으로 진행 중 상태 반환
      return {
        success: true,
        musicId,
        status: musicRecord.status || 'pending',
        engine: 'topmedia'
      };

    } catch (error: any) {
      console.error('❌ [MusicEngine] 상태 확인 중 오류:', error);
      return {
        success: false,
        error: `상태 확인 중 오류 발생: ${error.message}`
      };
    }
  }

  /**
   * 시스템 상태 확인
   */
  async getSystemStatus(): Promise<Record<MusicEngine, { enabled: boolean; credits?: number; error?: string }>> {
    const status: Record<MusicEngine, { enabled: boolean; credits?: number; error?: string }> = {
      topmedia: {
        enabled: this.topMediaEnabled,
        credits: 100
      }
    };

    return status;
  }

  /**
   * 음악 목록 조회
   */
  async getMusicList(options: {
    page?: number;
    limit?: number;
    userId?: number;
    style?: string;
    instrumental?: boolean;
  }): Promise<{ music: any[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, userId, style, instrumental } = options;
    const offset = (page - 1) * limit;

    let filters = [];

    if (userId) {
      filters.push(eq(music.userId, userId));
    }

    if (style) {
      filters.push(eq(music.style, style));
    }

    if (instrumental !== undefined) {
      filters.push(eq(music.instrumental, instrumental));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [musicList, totalResult] = await Promise.all([
      db.query.music.findMany({
        where: whereClause,
        orderBy: desc(music.createdAt),
        limit,
        offset
      }),
      db.select({ count: sql`count(*)` }).from(music).where(whereClause)
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return {
      music: musicList,
      total,
      page,
      limit
    };
  }

  /**
   * 음악 삭제
   */
  async deleteMusic(musicId: number, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // 음악 레코드 확인 및 권한 검증
      const musicRecord = await db.query.music.findFirst({
        where: eq(music.id, musicId)
      });

      if (!musicRecord) {
        return { success: false, error: '음악을 찾을 수 없습니다' };
      }

      if (musicRecord.userId !== userId) {
        return { success: false, error: '음악을 삭제할 권한이 없습니다' };
      }

      // 데이터베이스에서 음악 레코드 삭제
      await db.delete(music).where(eq(music.id, musicId));

      return { success: true };
    } catch (error) {
      console.error('❌ [MusicEngine] 음악 삭제 오류:', error);
      return { success: false, error: '음악 삭제 중 오류가 발생했습니다' };
    }
  }
}

export const musicEngineService = new MusicEngineService();