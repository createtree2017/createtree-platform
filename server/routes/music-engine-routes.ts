/**
 * 통합 음악 엔진 API 라우트
 * 
 * TopMediai와 Suno를 통합하여 단일 인터페이스로 제공합니다.
 * 자동 폴백 시스템과 투명한 엔진 전환을 지원합니다.
 */

import { Router } from 'express';
import { musicEngineService } from '../services/music-engine-service';
import { requireAuth } from '../middleware/auth';
import { requirePremiumAccess, requireActiveHospital } from '../middleware/permission';
import { z } from 'zod';
import { db } from '@db';
import { music, musicStyles } from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const router = Router();

// 음악 생성 요청 스키마
const generateMusicSchema = z.object({
  prompt: z.string().min(1, '프롬프트를 입력해주세요'),

  title: z.string().optional(),
  style: z.string().optional(),
  instrumental: z.boolean().optional(),
  duration: z.number().min(30).max(300).optional(),
  gender: z.string().optional(), // 빈 문자열도 허용
  generateLyrics: z.boolean().optional(),
  preferredEngine: z.enum(['topmedia']).optional()
});

/**
 * POST /api/music-engine/generate
 * 통합 음악 생성 API
 */
router.post('/generate', requireAuth, requirePremiumAccess, requireActiveHospital(), async (req, res) => {
  try {
    console.log('🎵 [API] 통합 음악 생성 요청:', {
      userId: req.user?.id,
      body: req.body
    });

    // 요청 데이터 검증
    const validationResult = generateMusicSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('❌ [API] 데이터 검증 실패:', validationResult.error.errors);
      return res.status(400).json({
        success: false,
        error: '입력 데이터가 올바르지 않습니다',
        details: validationResult.error.errors
      });
    }

    const data = validationResult.data;

    // 음악 생성 실행
    const result = await musicEngineService.generateMusic({
      ...data,
      userId: req.user?.id
    });

    if (result.success) {
      console.log('✅ [API] 음악 생성 성공:', {
        musicId: result.musicId,
        engine: result.engine,
        fallbackUsed: result.fallbackUsed
      });

      return res.status(201).json({
        success: true,
        data: {
          musicId: result.musicId,
          engine: result.engine,
          status: result.status,
          fallbackUsed: result.fallbackUsed,
          title: result.title,
          lyrics: result.lyrics,
          message: result.fallbackUsed ? 
            '기본 엔진에서 문제가 발생하여 대체 엔진으로 진행합니다' : 
            '음악 생성이 시작되었습니다'
        }
      });
    } else {
      console.error('❌ [API] 음악 생성 실패:', result.error);

      return res.status(500).json({
        success: false,
        error: result.error || '음악 생성에 실패했습니다',
        musicId: result.musicId
      });
    }

  } catch (error: any) {
    console.error('❌ [API] 서버 오류:', error);
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류가 발생했습니다'
    });
  }
});

/**
 * GET /api/music-engine/styles
 * 음악 스타일 목록 조회
 */
router.get('/styles', async (req, res) => {
  try {
    console.log('🎵 [API] 음악 스타일 목록 조회');
    
    const styles = await db.query.musicStyles.findMany({
      where: eq(musicStyles.isActive, true),
      orderBy: [musicStyles.order, musicStyles.name],
      columns: {
        id: true,
        styleId: true,
        name: true,
        description: true,
        tags: true
      }
    });
    
    console.log(`✅ [API] 스타일 조회 성공: ${styles.length}개`);
    
    return res.json({
      success: true,
      data: styles
    });
    
  } catch (error: any) {
    console.error('❌ [API] 스타일 조회 오류:', error);
    return res.status(500).json({
      success: false,
      error: '스타일 목록을 가져오는 중 오류가 발생했습니다'
    });
  }
});

/**
 * GET /api/music-engine/status/:musicId
 * 음악 생성 상태 확인
 */
router.get('/status/:musicId', requireAuth, async (req, res) => {
  try {
    const musicId = parseInt(req.params.musicId);
    
    if (isNaN(musicId)) {
      return res.status(400).json({
        success: false,
        error: '올바른 음악 ID를 입력해주세요'
      });
    }

    console.log('🔍 [API] 상태 확인 요청:', { musicId, userId: req.user?.id });

    const result = await musicEngineService.checkMusicStatus(musicId);

    if (result.success) {
      return res.json({
        success: true,
        data: {
          musicId: result.musicId,
          engine: result.engine,
          status: result.status,
          audioUrl: result.audioUrl,
          lyrics: result.lyrics,
          title: result.title,
          duration: result.duration,
          fallbackUsed: result.fallbackUsed,
          metadata: result.metadata
        }
      });
    } else {
      return res.status(404).json({
        success: false,
        error: result.error || '음악을 찾을 수 없습니다'
      });
    }

  } catch (error: any) {
    console.error('❌ [API] 상태 확인 오류:', error);
    return res.status(500).json({
      success: false,
      error: '상태 확인 중 오류가 발생했습니다'
    });
  }
});

/**
 * GET /api/music-engine/engines
 * 사용 가능한 엔진 정보 조회
 */
router.get('/engines', requireAuth, async (req, res) => {
  try {
    console.log('🔧 [API] 엔진 상태 조회:', { userId: req.user?.id });

    const engineStatus = await musicEngineService.getSystemStatus();

    return res.json({
      success: true,
      data: engineStatus
    });

  } catch (error: any) {
    console.error('❌ [API] 엔진 상태 조회 오류:', error);
    return res.status(500).json({
      success: false,
      error: '엔진 상태 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * 타임아웃된 음악 자동 처리 함수
 */
async function cleanupTimedOutMusic(userId?: number) {
  try {
    // 3분 이상 pending 상태인 음악 찾기
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    
    // 먼저 타임아웃된 음악 조회
    const timedOutMusic = await db.query.music.findMany({
      where: userId ? and(
        eq(music.status, 'pending'),
        eq(music.userId, userId)
      ) : eq(music.status, 'pending')
    });
    
    // 3분 이상된 음악만 필터링
    const musicToUpdate = timedOutMusic.filter(m => 
      new Date(m.createdAt) < threeMinutesAgo
    );
    
    // 각각 업데이트
    for (const m of musicToUpdate) {
      await db.update(music)
        .set({ 
          status: 'failed', 
          updatedAt: new Date() 
        })
        .where(eq(music.id, m.id));
    }
    
    if (musicToUpdate.length > 0) {
      console.log(`⏰ ${musicToUpdate.length}개의 타임아웃 음악을 failed로 변경했습니다.`);
    }
  } catch (error) {
    console.error('타임아웃 음악 정리 중 오류:', error);
  }
}

/**
 * GET /api/music-engine/list
 * 통합 음악 목록 조회 API (사용자별 필터링)
 */
router.get('/list', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const instrumental = req.query.instrumental === 'true' ? true : 
                        req.query.instrumental === 'false' ? false : undefined;
    const style = req.query.style as string;
    const userId = req.user?.id; // 항상 로그인한 사용자의 음악만 조회

    console.log('🎵 [API] 통합 음악 목록 조회:', {
      page, limit, instrumental, style, userId
    });

    // 타임아웃된 음악 자동 정리
    await cleanupTimedOutMusic(userId);

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

    // 음악 목록 조회
    const allMusic = await db.query.music.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      orderBy: (music, { desc }) => [desc(music.createdAt)]
    });

    // 페이지네이션 적용
    const offset = (page - 1) * limit;
    const total = allMusic.length;
    const musicList = allMusic.slice(offset, offset + limit);

    return res.json({
      success: true,
      data: musicList,
      meta: {
        page,
        limit,
        total
      }
    });

  } catch (error: any) {
    console.error('❌ [API] 음악 목록 조회 오류:', error);
    return res.status(500).json({
      success: false,
      error: '음악 목록 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * GET /api/music-engine/all
 * 관리자용 전체 음악 목록 조회 API
 */
router.get('/all', requireAuth, async (req, res) => {
  try {
    // 관리자 권한 확인
    const userMemberType = req.user?.memberType;
    if (!userMemberType || !['admin', 'superadmin'].includes(userMemberType)) {
      return res.status(403).json({
        success: false,
        error: '관리자 권한이 필요합니다'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const instrumental = req.query.instrumental === 'true' ? true : 
                        req.query.instrumental === 'false' ? false : undefined;
    const style = req.query.style as string;

    console.log('🎵 [API] 관리자 전체 음악 목록 조회:', {
      page, limit, instrumental, style, adminId: req.user?.id
    });

    const result = await musicEngineService.getMusicList({
      page,
      limit,
      instrumental,
      style,
      userId: undefined // 모든 사용자의 음악 조회
    });

    return res.json({
      success: true,
      data: result.music,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit
      }
    });

  } catch (error: any) {
    console.error('❌ [API] 관리자 음악 목록 조회 오류:', error);
    return res.status(500).json({
      success: false,
      error: '음악 목록 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * POST /api/music-engine/retry/:musicId
 * 실패한 음악 생성 재시도
 */
router.post('/retry/:musicId', requireAuth, async (req, res) => {
  try {
    const musicId = parseInt(req.params.musicId);
    
    if (isNaN(musicId)) {
      return res.status(400).json({
        success: false,
        error: '올바른 음악 ID를 입력해주세요'
      });
    }

    console.log('🔄 [API] 음악 재시도 요청:', { musicId, userId: req.user?.id });

    // TODO: 재시도 로직 구현
    // 현재는 기본 응답만 반환
    return res.status(501).json({
      success: false,
      error: '재시도 기능은 아직 구현되지 않았습니다'
    });

  } catch (error: any) {
    console.error('❌ [API] 재시도 오류:', error);
    return res.status(500).json({
      success: false,
      error: '재시도 중 오류가 발생했습니다'
    });
  }
});

/**
 * DELETE /api/music-engine/delete/:musicId
 * 음악 삭제 API
 */
router.delete('/delete/:musicId', requireAuth, async (req, res) => {
  try {
    const musicId = parseInt(req.params.musicId);
    
    if (isNaN(musicId)) {
      return res.status(400).json({
        success: false,
        error: '올바른 음악 ID를 입력해주세요'
      });
    }

    console.log('🗑️ [API] 음악 삭제 요청:', { musicId, userId: req.user?.id });

    const result = await musicEngineService.deleteMusic(musicId, req.user!.id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || '음악을 찾을 수 없습니다'
      });
    }

    console.log('✅ [API] 음악 삭제 성공:', { musicId });

    return res.json({
      success: true,
      message: '음악이 삭제되었습니다'
    });

  } catch (error: any) {
    console.error('❌ [API] 음악 삭제 오류:', error);
    return res.status(500).json({
      success: false,
      error: '음악 삭제 중 오류가 발생했습니다'
    });
  }
});

export default router;