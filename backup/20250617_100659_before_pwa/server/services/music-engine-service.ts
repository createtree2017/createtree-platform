/**
 * 음악 엔진 통합 관리 서비스
 * 
 * TopMediai와 Suno 엔진을 통합 관리하고 자동 폴백을 제공합니다.
 * 사용자에게는 투명한 단일 인터페이스를 제공합니다.
 */

import { generateAiMusic, processCompletedMusic } from './topmedia-service';
import { SunoService, SunoGenerationResult } from './suno-service';
import { db } from '../../db/index';
import { music, musicStyles } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import { uploadToGCS } from '../utils/gcs';

export type MusicEngine = 'topmedia' | 'suno';

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
  private sunoService: SunoService;
  private readonly defaultEngine: MusicEngine;
  private readonly fallbackOrder: MusicEngine[];
  private readonly topMediaEnabled: boolean;
  private readonly sunoEnabled: boolean;

  constructor() {
    // TopMediai 단일 엔진으로 설정
    this.defaultEngine = 'topmedia';
    this.fallbackOrder = ['topmedia'];
    this.topMediaEnabled = true;
    this.sunoEnabled = false;

    // 서비스 인스턴스 초기화
    this.sunoService = new SunoService();

    console.log('🎼 [MusicEngine] 초기화 완료:', {
      defaultEngine: this.defaultEngine,
      fallbackOrder: this.fallbackOrder,
      topMediaEnabled: this.topMediaEnabled,
      sunoEnabled: this.sunoEnabled
    });
  }

  /**
   * 진행 중인 음악 생성 체크 및 중복 방지
   */
  private async checkOngoingGeneration(userId?: number): Promise<{ hasOngoing: boolean; ongoingId?: number }> {
    const { eq, and, or, lt } = await import('drizzle-orm');
    
    // 먼저 5분 이상 된 pending/processing 상태 음악을 정리
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const stalePendingMusic = await db.query.music.findMany({
      where: and(
        or(
          eq(music.status, 'pending'),
          eq(music.status, 'processing')
        ),
        lt(music.createdAt, fiveMinutesAgo)
      ),
      columns: { id: true, title: true, status: true, createdAt: true }
    });
    
    if (stalePendingMusic.length > 0) {
      console.log(`🧹 [MusicEngine] ${stalePendingMusic.length}개의 오래된 pending 음악 정리`);
      
      // 오래된 pending 음악들을 failed로 변경
      for (const staleMusic of stalePendingMusic) {
        await db.update(music)
          .set({ 
            status: 'failed',
            updatedAt: new Date()
          })
          .where(eq(music.id, staleMusic.id));
      }
    }
    
    // 현재 진행 중인 음악 생성이 있는지 체크 (pending, processing 상태)
    let whereCondition;
    
    if (userId) {
      whereCondition = and(
        eq(music.userId, userId),
        or(
          eq(music.status, 'pending'),
          eq(music.status, 'processing')
        )
      );
    } else {
      whereCondition = or(
        eq(music.status, 'pending'),
        eq(music.status, 'processing')
      );
    }
    
    const ongoingMusic = await db.query.music.findFirst({
      where: whereCondition,
      columns: { id: true, title: true, status: true, createdAt: true }
    });
    
    if (ongoingMusic) {
      console.log('⚠️ [MusicEngine] 진행 중인 음악 생성 발견:', ongoingMusic);
      return { hasOngoing: true, ongoingId: ongoingMusic.id };
    }
    
    return { hasOngoing: false };
  }

  /**
   * 동일한 요청의 최근 완성된 음악 확인 (중복 방지)
   */
  private async checkRecentDuplicate(request: MusicGenerationRequest): Promise<{ hasDuplicate: boolean; duplicateId?: number }> {
    const { eq, and, gte } = await import('drizzle-orm');
    
    // 최근 1시간 이내 동일한 프롬프트와 스타일로 완성된 음악이 있는지 확인
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    let whereCondition;
    
    if (request.userId) {
      whereCondition = and(
        eq(music.userId, request.userId),
        eq(music.prompt, request.prompt),
        eq(music.style, request.style || ''),
        eq(music.status, 'completed'),
        gte(music.createdAt, oneHourAgo)
      );
    } else {
      whereCondition = and(
        eq(music.prompt, request.prompt),
        eq(music.style, request.style || ''),
        eq(music.status, 'completed'),
        gte(music.createdAt, oneHourAgo)
      );
    }
    
    const duplicateMusic = await db.query.music.findFirst({
      where: whereCondition,
      columns: { id: true, title: true, url: true, createdAt: true },
      orderBy: (music, { desc }) => [desc(music.createdAt)]
    });
    
    if (duplicateMusic) {
      console.log('🔄 [MusicEngine] 최근 중복 음악 발견:', {
        id: duplicateMusic.id,
        title: duplicateMusic.title,
        createdAt: duplicateMusic.createdAt
      });
      return { hasDuplicate: true, duplicateId: duplicateMusic.id };
    }
    
    return { hasDuplicate: false };
  }

  /**
   * 음악 생성 요청 (통합 엔드포인트)
   */
  async generateMusic(request: MusicGenerationRequest): Promise<MusicGenerationResult> {
    console.log('🎵 [MusicEngine] 음악 생성 요청:', {
      prompt: request.prompt?.substring(0, 100) + '...',
      title: request.title,
      defaultEngine: this.defaultEngine
    });

    // 1. 진행 중인 생성 체크 (동시 생성 방지)
    const ongoingCheck = await this.checkOngoingGeneration(request.userId);
    if (ongoingCheck.hasOngoing) {
      return {
        success: false,
        error: '이미 진행 중인 음악 생성이 있습니다. 완료된 후 다시 시도해주세요.',
        musicId: ongoingCheck.ongoingId
      };
    }

    // 2. 최근 중복 음악 체크 (중복 생성 방지)
    const duplicateCheck = await this.checkRecentDuplicate(request);
    if (duplicateCheck.hasDuplicate) {
      console.log('🔄 [MusicEngine] 중복 음악 감지 - 기존 음악 반환');
      
      // 기존 음악 정보 조회
      const existingMusic = await db.query.music.findFirst({
        where: eq(music.id, duplicateCheck.duplicateId!),
        columns: { 
          id: true, 
          title: true, 
          url: true, 
          lyrics: true, 
          duration: true, 
          engine: true 
        }
      });
      
      return {
        success: true,
        musicId: duplicateCheck.duplicateId!,
        engine: (existingMusic?.engine as MusicEngine) || this.defaultEngine,
        status: 'completed',
        title: existingMusic?.title ?? undefined,
        lyrics: existingMusic?.lyrics ?? undefined,
        audioUrl: existingMusic?.url ?? undefined,
        duration: existingMusic?.duration,
        fallbackUsed: false,
        isDuplicate: true
      };
    }

    // 2. 사용할 엔진 결정
    const targetEngine = request.preferredEngine || this.defaultEngine;
    const engines = this.getAvailableEngines(targetEngine);

    if (engines.length === 0) {
      return {
        success: false,
        error: '사용 가능한 음악 생성 엔진이 없습니다'
      };
    }

    // 3. 제목 생성 (고유성은 DB ID로 보장)
    const timestamp = new Date().toLocaleString('ko-KR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const baseTitle = request.title || `음악 생성 (${timestamp})`;

    // 4. DB에 초기 레코드 생성
    
    const [musicRecord] = await db.insert(music).values({
      title: baseTitle,
      prompt: request.prompt,
      style: request.style || '',
      translatedPrompt: request.prompt, // 번역 로직은 나중에 구현
      lyrics: '',
      instrumental: request.instrumental || false,
      duration: request.duration || 60,
      userId: request.userId || null,
      engine: targetEngine,
      engineTaskId: null,
      fallbackUsed: false,
      gcsPath: null,
      contentType: 'audio/mpeg',
      durationSec: null,
      status: 'pending',
      generateLyrics: request.generateLyrics || false,
      gender: request.gender || 'auto',
      metadata: JSON.stringify({ originalRequest: request })
    }).returning();

    const musicId = musicRecord.id;
    console.log('📝 [MusicEngine] DB 레코드 생성:', { musicId, targetEngine });

    // 3. 엔진별로 순차 시도
    let fallbackUsed = false;
    
    for (let i = 0; i < engines.length; i++) {
      const currentEngine = engines[i];
      const isFirstAttempt = i === 0;
      
      if (!isFirstAttempt) {
        fallbackUsed = true;
        console.log(`🔄 [MusicEngine] 폴백 엔진 시도: ${currentEngine}`);
      }

      try {
        const result = await this.tryEngine(currentEngine, request, musicId);
        
        if (result.success) {
          // 🚀 성능 최적화: 즉시 응답 패턴
          // audioUrl이 있으면 즉시 사용자에게 반환하고, DB 업데이트는 백그라운드 처리
          
          if (result.audioUrl) {
            console.log('⚡ 즉시 응답 모드: 음악 URL 확보, 사용자에게 즉시 반환');
            
            // 백그라운드에서 DB 업데이트 (사용자 응답 지연 없음)
            setImmediate(async () => {
              try {
                const updateData: any = {
                  engine: currentEngine,
                  engineTaskId: result.taskId,
                  fallbackUsed,
                  status: 'completed',
                  url: result.audioUrl,
                  metadata: JSON.stringify({
                    originalRequest: request,
                    engineResult: result.metadata,
                    fallbackUsed,
                    engineAttempts: i + 1
                  })
                };

                if (result.lyrics) updateData.lyrics = result.lyrics;
                if (result.title) updateData.title = result.title;
                if (result.duration) updateData.duration = result.duration;

                await db.update(music)
                  .set(updateData)
                  .where(eq(music.id, musicId));
                
                console.log('📁 백그라운드 DB 업데이트 완료:', musicId);
                
                // GCS 다운로드 트리거 (Suno URL인 경우)
                if (result.audioUrl && result.audioUrl.includes('suno.ai')) {
                  console.log('🔄 [GCS 다운로드] 음악 ID', musicId, '백그라운드 다운로드 시작');
                  // 백그라운드에서 GCS 다운로드 처리
                  setImmediate(async () => {
                    try {
                      const fileName = `${musicId}_${Date.now()}.mp3`;
                      const gcsFilePath = `music/${fileName}`;
                      const gcsUrl = await uploadToGCS(result.audioUrl!, gcsFilePath);
                      
                      await db.update(music)
                        .set({ url: gcsUrl, updatedAt: new Date() })
                        .where(eq(music.id, musicId));
                      
                      console.log(`✅ [GCS 다운로드] 음악 ID ${musicId} 완료: ${gcsUrl}`);
                    } catch (error: any) {
                      console.error(`❌ [GCS 다운로드] 음악 ID ${musicId} 오류:`, error.message);
                    }
                  });
                }
              } catch (dbError: any) {
                console.warn('📁 백그라운드 DB 업데이트 실패 (서비스에 영향 없음):', dbError.message);
              }
            });

            // 즉시 응답 반환
            return {
              success: true,
              musicId,
              engine: currentEngine,
              taskId: result.taskId,
              status: 'completed',
              fallbackUsed,
              title: result.title,
              lyrics: result.lyrics,
              audioUrl: result.audioUrl,
              duration: result.duration
            };
          } else {
            // audioUrl이 없는 경우는 기존 방식 유지 (processing 상태)
            const updateData: any = {
              engine: currentEngine,
              engineTaskId: result.taskId,
              fallbackUsed,
              status: 'processing',
              metadata: JSON.stringify({
                originalRequest: request,
                engineResult: result.metadata,
                fallbackUsed,
                engineAttempts: i + 1
              })
            };

            await db.update(music)
              .set(updateData)
              .where(eq(music.id, musicId));

            return {
              success: true,
              musicId,
              engine: currentEngine,
              taskId: result.taskId,
              status: 'processing',
              fallbackUsed,
              title: result.title,
              lyrics: result.lyrics,
              audioUrl: result.audioUrl,
              duration: result.duration
            };
          }
        }

      } catch (error: any) {
        console.error(`❌ [MusicEngine] ${currentEngine} 엔진 오류:`, error.message);
        
        // 마지막 엔진까지 실패한 경우
        if (i === engines.length - 1) {
          await db.update(music)
            .set({
              status: 'error',
              metadata: JSON.stringify({
                originalRequest: request,
                error: error.message,
                engineAttempts: i + 1,
                allEnginesFailed: true
              })
            })
            .where(eq(music.id, musicId));

          return {
            success: false,
            musicId,
            error: `모든 엔진에서 실패: ${error.message}`
          };
        }
      }
    }

    return {
      success: false,
      musicId,
      error: '알 수 없는 오류가 발생했습니다'
    };
  }

  /**
   * 특정 엔진으로 음악 생성 시도
   */
  private async tryEngine(engine: MusicEngine, request: MusicGenerationRequest, musicId: number): Promise<SunoGenerationResult> {
    console.log(`🎯 [MusicEngine] ${engine} 엔진 시도 시작`);

    switch (engine) {
      case 'suno':
        return await this.sunoService.generateMusic({
          prompt: request.prompt,
          title: request.title,
          make_instrumental: request.instrumental,
          tags: request.style,
          model: 'chirp-v3-5'
        });

      case 'topmedia':
        // 음악 스타일 프롬프트 조회 및 결합
        let enhancedPrompt = request.prompt;
        if (request.style) {
          try {
            const styleResult = await db.query.musicStyles.findFirst({
              where: eq(musicStyles.styleId, request.style),
              columns: { prompt: true }
            });
            
            if (styleResult?.prompt) {
              // 사용자 프롬프트와 스타일 프롬프트를 결합
              enhancedPrompt = `${request.prompt}, ${styleResult.prompt}`;
              console.log(`🎵 스타일 프롬프트 결합: "${request.prompt}" + "${styleResult.prompt}"`);
            }
          } catch (error) {
            console.warn('음악 스타일 프롬프트 조회 실패:', error);
          }
        }

        // TopMediai 전체 워크플로우 실행 (가사 생성 + 음악 생성 + 파일 저장)
        const topMediaResult = await generateAiMusic({
          prompt: enhancedPrompt,
          style: request.style || 'lullaby',
          duration: request.duration || 180,
          userId: (request.userId || 0).toString(),
          generateLyrics: request.generateLyrics !== false,
          lyrics: request.lyrics,
          instrumental: request.instrumental,
          gender: request.gender,
          title: request.title
        });

        if (!topMediaResult.success) {
          throw new Error(topMediaResult.error || 'TopMediai 음악 생성 실패');
        }

        return {
          success: true,
          taskId: `topmedia_${musicId}_${Date.now()}`,
          audioUrl: topMediaResult.audioUrl || topMediaResult.url,
          title: topMediaResult.title,
          lyrics: topMediaResult.lyrics,
          duration: topMediaResult.duration,
          metadata: topMediaResult
        };

      default:
        throw new Error(`지원하지 않는 엔진: ${engine}`);
    }
  }

  /**
   * 음악 생성 상태 확인
   */
  async checkStatus(musicId: number): Promise<MusicGenerationResult> {
    try {
      // DB에서 현재 상태 조회
      const musicRecord = await db.query.music.findFirst({
        where: eq(music.id, musicId)
      });

      if (!musicRecord) {
        return {
          success: false,
          error: '음악 레코드를 찾을 수 없습니다'
        };
      }

      console.log('🔍 [MusicEngine] 상태 확인:', {
        musicId,
        engine: musicRecord.engine,
        status: musicRecord.status,
        taskId: musicRecord.engineTaskId
      });

      // 이미 완료된 경우
      if (musicRecord.status === 'done' && musicRecord.url) {
        return {
          success: true,
          musicId,
          engine: musicRecord.engine as MusicEngine,
          status: 'done',
          audioUrl: musicRecord.url,
          lyrics: musicRecord.lyrics || '',
          title: musicRecord.title,
          duration: musicRecord.durationSec || musicRecord.duration,
          fallbackUsed: musicRecord.fallbackUsed || false
        };
      }

      // 오류 상태인 경우
      if (musicRecord.status === 'error') {
        return {
          success: false,
          musicId,
          error: '음악 생성에 실패했습니다',
          metadata: musicRecord.metadata
        };
      }

      // 진행 중인 경우 엔진별 상태 확인
      if (musicRecord.engineTaskId) {
        const result = await this.checkEngineStatus(
          musicRecord.engine as MusicEngine,
          musicRecord.engineTaskId,
          musicId
        );

        // 완료 상태인 경우 DB 업데이트
        if (result.success && result.audioUrl) {
          await db.update(music)
            .set({
              status: 'done',
              url: result.audioUrl,
              lyrics: result.lyrics || musicRecord.lyrics,
              durationSec: result.duration,
              gcsPath: result.audioUrl.includes('googleapis.com') ? 
                result.audioUrl.split('/').slice(-2).join('/') : null,
              metadata: JSON.stringify({
                completedAt: new Date().toISOString(),
                finalResult: result.metadata || {}
              })
            })
            .where(eq(music.id, musicId));

          return {
            success: true,
            musicId,
            engine: musicRecord.engine as MusicEngine,
            status: 'done',
            audioUrl: result.audioUrl,
            lyrics: result.lyrics || musicRecord.lyrics || undefined,
            title: musicRecord.title || undefined,
            duration: result.duration,
            fallbackUsed: musicRecord.fallbackUsed || false
          };
        }

        return {
          success: true,
          musicId,
          engine: musicRecord.engine as MusicEngine,
          status: musicRecord.status || undefined,
          fallbackUsed: musicRecord.fallbackUsed || false,
          metadata: result.metadata
        };
      }

      return {
        success: true,
        musicId,
        engine: musicRecord.engine as MusicEngine,
        status: musicRecord.status || undefined,
        fallbackUsed: musicRecord.fallbackUsed || false
      };

    } catch (error: any) {
      console.error('❌ [MusicEngine] 상태 확인 실패:', error);
      return {
        success: false,
        musicId,
        error: `상태 확인 중 오류: ${error.message}`
      };
    }
  }

  /**
   * 엔진별 상태 확인
   */
  private async checkEngineStatus(engine: MusicEngine, taskId: string, musicId: number): Promise<SunoGenerationResult> {
    switch (engine) {
      case 'suno':
        const sunoResult = await this.sunoService.checkStatus(taskId);
        
        // Suno에서 완료된 경우 GCS에 업로드
        if (sunoResult.success && sunoResult.audioUrl && !sunoResult.audioUrl.includes('googleapis.com')) {
          const gcsUrl = await this.sunoService.downloadAndUpload(sunoResult.audioUrl, musicId);
          if (gcsUrl) {
            sunoResult.audioUrl = gcsUrl;
          }
        }
        
        return sunoResult;

      case 'topmedia':
        // TopMediai는 3단계 워크플로우이므로 별도 처리 필요
        // 여기서는 기본 상태만 반환 (상세 구현은 나중에)
        return {
          success: true,
          taskId,
          metadata: { status: 'processing', engine: 'topmedia' }
        };

      default:
        return {
          success: false,
          error: `지원하지 않는 엔진: ${engine}`
        };
    }
  }

  /**
   * 사용 가능한 엔진 목록 반환 (우선순위 순)
   */
  private getAvailableEngines(preferredEngine: MusicEngine): MusicEngine[] {
    const engines: MusicEngine[] = [];

    // 선호 엔진이 사용 가능하면 첫 번째로 추가
    if (this.isEngineEnabled(preferredEngine)) {
      engines.push(preferredEngine);
    }

    // 폴백 순서에 따라 나머지 엔진 추가
    for (const engine of this.fallbackOrder) {
      if (engine !== preferredEngine && this.isEngineEnabled(engine) && !engines.includes(engine)) {
        engines.push(engine);
      }
    }

    return engines;
  }

  /**
   * 엔진 활성화 상태 확인
   */
  private isEngineEnabled(engine: MusicEngine): boolean {
    switch (engine) {
      case 'topmedia':
        return this.topMediaEnabled;
      case 'suno':
        return this.sunoEnabled;
      default:
        return false;
    }
  }

  /**
   * 엔진 상태 정보 반환
   */
  async getEngineStatus(): Promise<{
    default: MusicEngine;
    available: MusicEngine[];
    fallbackOrder: MusicEngine[];
    status: Record<MusicEngine, { enabled: boolean; credits?: number; error?: string }>;
  }> {
    const status: Record<MusicEngine, { enabled: boolean; credits?: number; error?: string }> = {
      topmedia: { enabled: this.topMediaEnabled },
      suno: { enabled: this.sunoEnabled }
    };

    // Suno 크레딧 확인
    if (this.sunoEnabled) {
      try {
        const credits = await this.sunoService.getCredits();
        status.suno.credits = credits.credits;
        if (credits.error) {
          status.suno.error = credits.error;
        }
      } catch (error: any) {
        status.suno.error = error.message;
      }
    }

    return {
      default: this.defaultEngine,
      available: this.getAvailableEngines(this.defaultEngine),
      fallbackOrder: this.fallbackOrder,
      status
    };
  }

  /**
   * 음악 삭제
   */
  async deleteMusic(musicId: number, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🗑️ [MusicEngine] 음악 삭제 시작:', { musicId, userId });

      // 음악 레코드 조회 및 권한 확인
      const musicRecord = await db.query.music.findFirst({
        where: eq(music.id, musicId)
      });

      if (!musicRecord) {
        return {
          success: false,
          error: '음악을 찾을 수 없습니다'
        };
      }

      // 권한 확인 (본인 음악만 삭제 가능)
      if (musicRecord.userId !== Number(userId)) {
        return {
          success: false,
          error: '음악을 삭제할 권한이 없습니다'
        };
      }

      // GCS에서 파일 삭제 (있는 경우)
      if (musicRecord.gcsPath || (musicRecord.url && musicRecord.url.includes('googleapis.com'))) {
        try {
          const { deleteGcsObject } = await import('../utils/gcs');
          
          let gcsPath = musicRecord.gcsPath;
          if (!gcsPath && musicRecord.url && musicRecord.url.includes('googleapis.com')) {
            // URL에서 GCS 경로 추출
            const urlParts = musicRecord.url.split('/');
            gcsPath = urlParts.slice(-2).join('/'); // 예: "music/111_1749908489555.mp3"
          }
          
          if (gcsPath) {
            await deleteGcsObject(gcsPath);
          }
        } catch (gcsError: any) {
          console.error('❌ [MusicEngine] GCS 파일 삭제 오류:', gcsError);
          // GCS 삭제 실패해도 DB는 삭제 진행 (사용자 경험 우선)
        }
      }

      // 데이터베이스에서 음악 레코드 삭제
      await db.delete(music).where(eq(music.id, musicId));

      console.log('✅ [MusicEngine] 음악 삭제 완료 (DB + GCS):', { musicId });

      return { success: true };

    } catch (error: any) {
      console.error('❌ [MusicEngine] 음악 삭제 오류:', error);
      return {
        success: false,
        error: '음악 삭제 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * 음악 목록 조회
   */
  async getMusicList(options: {
    page?: number;
    limit?: number;
    instrumental?: boolean;
    style?: string;
    userId?: number;
  }): Promise<{
    success: boolean;
    music?: any[];
    meta?: {
      page: number;
      totalPages: number;
      totalItems: number;
    };
    error?: string;
  }> {
    try {
      const { page = 1, limit = 10, instrumental, style, userId } = options;
      const offset = (page - 1) * limit;

      console.log('🎵 [MusicEngine] 음악 목록 조회:', {
        page, limit, instrumental, style, userId
      });

      // 조건 구성 - 완료된 음악만 조회
      const { ne, isNotNull, like, or } = await import('drizzle-orm');
      const conditions = [
        eq(music.status, 'completed'), // 완료된 음악만
        or(
          like(music.url, '%googleapis%'), // GCS URL 패턴
          like(music.url, '%storage.cloud.google.com%'), // 대체 GCS URL 패턴
          isNotNull(music.gcsPath) // gcsPath가 있는 레코드도 포함
        )
      ];
      
      // userId 필터링 적용 - 사용자별 음악만 표시
      if (userId) {
        conditions.push(eq(music.userId, Number(userId)));
      }
      
      if (instrumental !== undefined) {
        conditions.push(eq(music.instrumental, instrumental));
      }
      
      if (style) {
        conditions.push(eq(music.style, style));
      }

      // 음악 목록 조회
      const musicList = await db.query.music.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: (music, { desc }) => [desc(music.createdAt)],
        limit: limit,
        offset: offset
      });

      // 전체 개수 조회 (완료된 음악만)
      const totalMusic = await db.query.music.findMany({
        where: and(...conditions)
      });

      const totalItems = totalMusic.length;
      const totalPages = Math.ceil(totalItems / limit);

      console.log('✅ [MusicEngine] 음악 목록 조회 완료:', {
        count: musicList.length,
        totalItems,
        totalPages
      });

      return {
        success: true,
        music: musicList,
        meta: {
          page,
          totalPages,
          totalItems
        }
      };

    } catch (error: any) {
      console.error('❌ [MusicEngine] 음악 목록 조회 오류:', error);
      return {
        success: false,
        error: '음악 목록 조회 중 오류가 발생했습니다'
      };
    }
  }
}

// 전역 음악 엔진 서비스 인스턴스


export const musicEngineService = new MusicEngineService();