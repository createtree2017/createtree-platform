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
import { MUSIC_CONSTANTS } from '@shared/constants';
import { MUSIC_MESSAGES, API_MESSAGES } from '../constants';

const router = Router();

// 음악 생성 요청 스키마
const generateMusicSchema = z.object({
  prompt: z.string().min(1, MUSIC_MESSAGES.ERRORS.PROMPT_REQUIRED),

  title: z.string().optional(),
  style: z.string().optional(),
  instrumental: z.boolean().optional(),
  duration: z.number().min(MUSIC_CONSTANTS.DURATION.MIN_SECONDS).max(MUSIC_CONSTANTS.DURATION.MAX_SECONDS).optional(),
  gender: z.string().optional(),
  generateLyrics: z.boolean().optional(),
  preferredEngine: z.enum([MUSIC_CONSTANTS.ENGINES.TOPMEDIA as 'topmedia']).optional()
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
        error: MUSIC_MESSAGES.ERRORS.VALIDATION_FAILED,
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
            MUSIC_MESSAGES.SUCCESS.FALLBACK_USED : 
            MUSIC_MESSAGES.SUCCESS.GENERATION_STARTED
        }
      });
    } else {
      console.error('❌ [API] 음악 생성 실패:', result.error);

      return res.status(500).json({
        success: false,
        error: result.error || MUSIC_MESSAGES.ERRORS.GENERATION_FAILED,
        musicId: result.musicId
      });
    }

  } catch (error: any) {
    console.error('❌ [API] 서버 오류:', error);
    return res.status(500).json({
      success: false,
      error: API_MESSAGES.ERRORS.SERVER_ERROR
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
      error: API_MESSAGES.ERRORS.FETCH_FAILED
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
        error: MUSIC_MESSAGES.ERRORS.INVALID_MUSIC_ID
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
        error: result.error || MUSIC_MESSAGES.ERRORS.NOT_FOUND
      });
    }

  } catch (error: any) {
    console.error('❌ [API] 상태 확인 오류:', error);
    return res.status(500).json({
      success: false,
      error: MUSIC_MESSAGES.ERRORS.STATUS_CHECK_ERROR
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
      error: MUSIC_MESSAGES.ERRORS.ENGINE_ERROR
    });
  }
});

/**
 * 타임아웃된 음악 자동 처리 함수
 */
async function cleanupTimedOutMusic(userId?: number) {
  try {
    // 타임아웃 시간 이상 pending 상태인 음악 찾기
    const timeoutAgo = new Date(Date.now() - MUSIC_CONSTANTS.TIMEOUT.GENERATION_MS);
    
    // 먼저 타임아웃된 음악 조회
    const timedOutMusic = await db.query.music.findMany({
      where: userId ? and(
        eq(music.status, MUSIC_CONSTANTS.STATUS.PENDING),
        eq(music.userId, userId)
      ) : eq(music.status, MUSIC_CONSTANTS.STATUS.PENDING)
    });
    
    // 타임아웃 시간 이상된 음악만 필터링
    const musicToUpdate = timedOutMusic.filter(m => 
      new Date(m.createdAt) < timeoutAgo
    );
    
    // 각각 업데이트
    for (const m of musicToUpdate) {
      await db.update(music)
        .set({ 
          status: MUSIC_CONSTANTS.STATUS.FAILED, 
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
      error: API_MESSAGES.ERRORS.FETCH_FAILED
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
        error: MUSIC_MESSAGES.ERRORS.INVALID_MUSIC_ID
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
      error: API_MESSAGES.ERRORS.SERVER_ERROR
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
        error: MUSIC_MESSAGES.ERRORS.INVALID_MUSIC_ID
      });
    }

    console.log('🗑️ [API] 음악 삭제 요청:', { musicId, userId: req.user?.id });

    const result = await musicEngineService.deleteMusic(musicId, req.user!.id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || MUSIC_MESSAGES.ERRORS.NOT_FOUND
      });
    }

    console.log('✅ [API] 음악 삭제 성공:', { musicId });

    return res.json({
      success: true,
      message: API_MESSAGES.SUCCESS.DELETE_SUCCESS
    });

  } catch (error: any) {
    console.error('❌ [API] 음악 삭제 오류:', error);
    return res.status(500).json({
      success: false,
      error: API_MESSAGES.ERRORS.DELETE_FAILED
    });
  }
});

/**
 * GET /api/music/:id/download
 * 음악 다운로드 전용 엔드포인트 - 간단한 리다이렉트 방식
 */
router.get("/:id/download", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    console.log(`[음악 다운로드] 요청 - ID: ${id}`);

    if (isNaN(id)) {
      return res.status(400).json({ error: MUSIC_MESSAGES.ERRORS.INVALID_MUSIC_ID });
    }

    // 음악 정보 조회
    const musicItem = await db.query.music.findFirst({
      where: eq(music.id, id)
    });

    if (!musicItem) {
      return res.status(404).json({ error: "Music not found" });
    }

    const url = musicItem.url;

    console.log(`[음악 다운로드] 원본 URL: ${url}`);

    if (!url) {
      console.error(`[음악 다운로드] URL이 없음 - ID: ${id}`);
      return res.status(404).json({ error: "음악 파일 URL을 찾을 수 없습니다" });
    }

    // GCS URL인 경우 SignedURL 생성하여 직접 다운로드
    if (url.includes('storage.googleapis.com')) {
      try {
        const { bucket } = await import('../firebase') as { bucket: any };

        // GCS 경로에서 파일명 추출
        const urlPath = new URL(url).pathname;
        const gcsFilePath = urlPath.replace('/createtree-upload/', '');

        console.log(`[음악 다운로드] GCS 파일 경로: ${gcsFilePath}`);

        const file = bucket.file(gcsFilePath);
        const [exists] = await file.exists();

        if (!exists) {
          console.error(`[음악 다운로드] 파일이 존재하지 않음: ${gcsFilePath}`);
          return res.status(404).json({ error: "음악 파일을 찾을 수 없습니다" });
        }

        // SignedURL 생성 (1시간 유효)
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 3600000, // 1시간
          responseDisposition: `attachment; filename="${musicItem.title || 'music'}.mp3"`
        });

        console.log(`[음악 다운로드] SignedURL 생성 완료 - 리다이렉트`);
        return res.redirect(302, signedUrl);

      } catch (gcsError) {
        console.error(`[음악 다운로드] GCS 처리 실패:`, gcsError);
        return res.status(500).json({ error: "파일 접근 중 오류가 발생했습니다" });
      }
    } else if (url.includes('audiopipe.suno.ai')) {
      // Suno URL인 경우 프록시 다운로드로 처리
      console.log(`[음악 다운로드] ${musicItem.title} - Suno URL 프록시 다운로드`);

      try {
        const fetch = (await import('node-fetch')).default;

        // Suno URL에서 오디오 파일 가져오기
        const audioResponse = await fetch(url, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!audioResponse.ok) {
          console.error(`[음악 다운로드] Suno 응답 실패: ${audioResponse.status}`);
          return res.status(500).json({ error: "음악 파일을 가져올 수 없습니다" });
        }

        if (!audioResponse.body) {
          return res.status(500).json({ error: "음악 데이터가 없습니다" });
        }

        // 다운로드 헤더 설정
        const filename = `${musicItem.title || 'music'}.mp3`;
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 일반 오디오 캐시 정책

        // 스트림으로 전송
        audioResponse.body.pipe(res);

      } catch (proxyError) {
        console.error(`[음악 다운로드] 프록시 오류:`, proxyError);
        return res.status(500).json({ error: "음악 다운로드 중 오류가 발생했습니다" });
      }
    } else {
      // 기타 외부 URL인 경우 리다이렉트
      console.log(`[음악 다운로드] ${musicItem.title} - 외부 URL로 리다이렉트`);
      return res.redirect(302, url);
    }

  } catch (error) {
    console.error(`[음악 다운로드] 오류 - ID: ${req.params.id}:`, error);
    return res.status(500).json({
      error: "음악 다운로드 중 오류가 발생했습니다",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;