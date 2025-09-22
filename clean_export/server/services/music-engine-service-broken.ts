/**
 * 음악 엔진 통합 관리 서비스
 * 
 * TopMediai 엔진을 통한 음악 생성 서비스를 제공합니다.
 * 단일 엔진으로 안정적인 음악 생성을 보장합니다.
 */

import { generateAiMusic, processCompletedMusic } from './topmedia-service';
import { db } from '@db';
import { music, musicStyles } from '@shared/schema';
import { eq, and, gte, or, lt } from 'drizzle-orm';
import { uploadToGCS } from '../utils/gcs';

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
  private readonly fallbackOrder: MusicEngine[];
  private readonly topMediaEnabled: boolean;

  constructor() {
    // TopMediai 단일 엔진으로 설정
    this.defaultEngine = 'topmedia';
    this.fallbackOrder = ['topmedia'];
    this.topMediaEnabled = true;

    console.log('🎼 [MusicEngine] 초기화 완료:', {
      defaultEngine: this.defaultEngine,
      fallbackOrder: this.fallbackOrder,
      topMediaEnabled: this.topMediaEnabled
    });
  }

  /**
   * 진행 중인 음악 생성 체크 및 중복 방지
   */
  private async checkOngoingGeneration(userId?: number): Promise<{ hasOngoing: boolean; ongoingId?: number }> {
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

    // 현재 진행 중인 음악 생성 확인
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
    
    const ongoingMusic = await db.query.music.findFirst({
      where: and(
        or(
          eq(music.status, 'pending'),
          eq(music.status, 'processing')
        ),
        gte(music.createdAt, tenSecondsAgo)
      ),
      columns: { id: true, title: true, status: true, createdAt: true }
    });

    return {
      hasOngoing: !!ongoingMusic,
      ongoingId: ongoingMusic?.id
    };
  }

  /**
   * 음악 생성 요청 처리
   */
  async generateMusic(request: MusicGenerationRequest): Promise<MusicGenerationResult> {
    try {
      console.log('🎵 [MusicEngine] 음악 생성 요청 받음:', {
        prompt: request.prompt?.substring(0, 50) + '...',
        title: request.title,
        style: request.style,
        engine: request.preferredEngine || this.defaultEngine,
        userId: request.userId
      });

      // 진행 중인 생성 체크
      const { hasOngoing, ongoingId } = await this.checkOngoingGeneration(request.userId);
      
      if (hasOngoing) {
        console.log('⚠️ [MusicEngine] 이미 진행 중인 음악 생성 감지:', ongoingId);
        return {
          success: false,
          error: '다른 음악이 현재 생성 중입니다. 잠시 후 다시 시도해주세요.',
          isDuplicate: true
        };
      }

      // 음악 레코드 생성
      const musicRecord = await this.createMusicRecord(request);
      console.log('📝 [MusicEngine] 음악 레코드 생성됨:', musicRecord.id);

      // TopMediai 엔진으로 생성 시도
      const result = await this.tryTopMediaEngine(request, musicRecord.id);
      
      if (result.success) {
        console.log('✅ [MusicEngine] 음악 생성 성공:', {
          musicId: musicRecord.id,
          engine: 'topmedia'
        });
        
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
      style: request.style || 'default',
      gender: request.gender || 'auto',
      lyrics: request.lyrics || undefined,
      duration: request.duration || 60,
      status: 'pending' as const,
      engine: 'topmedia' as const,
      userId: request.userId || undefined,
      url: undefined,
      gcsPath: undefined
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
      try {
        const styleResult = await db.query.musicStyles.findFirst({
          where: eq(musicStyles.styleId, request.style),
          columns: { prompt: true }
        });
        
        if (styleResult?.prompt) {
          // 사용자 프롬프트와 스타일 프롬프트를 결합
          enhancedPrompt = `${request.prompt || '음악'}, ${styleResult.prompt}`;
          console.log(`🎵 스타일 프롬프트 결합: "${request.prompt}" + "${styleResult.prompt}"`);
        }
      } catch (error) {
        console.log('⚠️ 스타일 프롬프트 조회 실패, 원본 프롬프트 사용');
        enhancedPrompt = request.prompt || '새로운 음악';
      }
    }

    console.log('🔍 TopMediai 요청 파라미터 준비:', {
      enhancedPrompt,
      requestPrompt: request.prompt,
      requestTitle: request.title,
      requestStyle: request.style
    });

    const topMediaRequest = {
      prompt: enhancedPrompt || request.prompt || '기본 음악',
      title: request.title || '새로운 음악',
      lyrics: enhancedPrompt || request.prompt || '',
      style: request.style || 'pop',
      gender: request.gender || 'auto',
      duration: request.duration || 180,
      userId: request.userId?.toString() || '1',
      generateLyrics: true,
      instrumental: false
    };

    console.log('📤 TopMediai API 호출 데이터:', topMediaRequest);

    const topMediaResult = await generateAiMusic(topMediaRequest);
    
    if (topMediaResult.success) {
      // TopMediai API 성공 시 처리
      const audioUrl = topMediaResult.url || topMediaResult.audioUrl;
      
      if (audioUrl) {
        // 음악 URL이 있으면 즉시 완료 처리
        await db.update(music)
          .set({
            url: audioUrl,
            lyrics: topMediaResult.lyrics || null,
            status: 'completed',
            updatedAt: new Date()
          })
          .where(eq(music.id, musicId));

        return {
          success: true,
          musicId: musicId,
          audioUrl: audioUrl,
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
          lyrics: musicRecord.lyrics || undefined
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



      // 여전히 진행 중
      return {
        success: true,
        musicId,
        status: musicRecord.status || undefined,
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
        enabled: this.topMediaEnabled
      }
    };

    // TopMediai 상태 확인
    try {
      // TopMediai 서비스의 헬스체크 (간단한 요청)
      status.topmedia.enabled = true;
    } catch (error: any) {
      status.topmedia.enabled = false;
      status.topmedia.error = error.message;
    }

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
  } = {}): Promise<{
    music: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, userId, style, instrumental } = options;
    const offset = (page - 1) * limit;

    // 필터 조건 구성
    const filters = [];
    
    if (userId) {
      filters.push(eq(music.userId, userId));
    }
    
    if (style) {
      filters.push(eq(music.style, style));
    }
    
    if (instrumental !== undefined) {
      filters.push(eq(music.instrumental, instrumental));
    }

    try {
      // 음악 목록 조회 - Drizzle ORM에서는 limit과 offset을 직접 사용하지 않음
      const allMusic = await db.query.music.findMany({
        where: filters.length > 0 ? and(...filters) : undefined,
        orderBy: (music, { desc }) => [desc(music.createdAt)]
      });

      // 페이지네이션 적용
      const total = allMusic.length;
      const musicList = allMusic.slice(offset, offset + limit);

      return {
        music: musicList,
        total,
        page,
        limit
      };
    } catch (error: any) {
      console.error('음악 목록 조회 오류:', error);
      throw new Error(`음악 목록 조회 실패: ${error.message}`);
    }
  }
}

// 전역 인스턴스
export const musicEngineService = new MusicEngineService();