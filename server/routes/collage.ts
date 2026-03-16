import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { collageServiceV2 } from '../services/collageServiceV2';
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';

const router = Router();

// 디바이스 이미지 업로드용 multer (메모리 저장 — 휘발성)
const deviceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 24 }, // 20MB per file, 최대 24개
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다'));
  },
});

// 임시 세션 저장소 (DB 대체)
const collageSessions = new Map<string, any>();

// 콜라주 생성 요청 스키마 (갤러리만 사용 시)
const createCollageSchema = z.object({
  imageIds: z.array(z.number()).min(1).max(24),
  layout: z.enum(['2', '6', '12', '24']),
  resolution: z.enum(['web', 'high', 'print']),
  format: z.enum(['png', 'jpg', 'webp'])
});

// 콜라주 생성 API (JSON + FormData 하이브리드 지원)
router.post('/create', deviceUpload.array('deviceFiles', 24), async (req, res) => {
  try {
    console.log('📸 콜라주 생성 요청 받음');
    console.log('🔐 인증 사용자:', (req as any).user);
    
    // 사용자 ID 가져오기
    const userId = (req as any).user?.id;
    if (!userId) {
      console.warn('⚠️ 사용자 ID를 찾을 수 없습니다. 인증 정보:', (req as any).user);
    }

    // FormData / JSON 공통 파싱
    const layout = (req.body.layout as string) || '';
    const resolution = (req.body.resolution as string) || 'print';
    const format = (req.body.format as string) || 'webp';

    // 갤러리 imageIds 파싱 (JSON string 또는 배열)
    let imageIds: number[] = [];
    if (req.body.imageIds) {
      const raw = typeof req.body.imageIds === 'string'
        ? JSON.parse(req.body.imageIds)
        : req.body.imageIds;
      imageIds = (Array.isArray(raw) ? raw : [raw]).map(Number).filter(n => !isNaN(n));
    }

    // 디바이스 업로드 파일 버퍼
    const deviceFiles = (req.files as Express.Multer.File[]) || [];
    const deviceBuffers = deviceFiles.map(f => f.buffer);

    const totalImageCount = imageIds.length + deviceBuffers.length;
    const requiredCount = parseInt(layout);

    console.log(`📊 갤러리: ${imageIds.length}개, 디바이스: ${deviceBuffers.length}개, 합계: ${totalImageCount}개, 필요: ${requiredCount}`);

    // 기본 검증
    if (!['2', '6', '12', '24'].includes(layout)) {
      return res.status(400).json({ error: '유효하지 않은 레이아웃입니다' });
    }
    if (totalImageCount !== requiredCount) {
      return res.status(400).json({
        error: `${layout}분할 레이아웃은 정확히 ${requiredCount}개의 이미지가 필요합니다 (현재: ${totalImageCount}개)`
      });
    }

    // 콜라주 세션 생성
    const result = await collageServiceV2.prepareCollage({
      imageIds,
      layout: layout as '2' | '6' | '12' | '24',
      resolution: resolution as 'web' | 'high' | 'print',
      format: format as 'png' | 'jpg' | 'webp',
      userId
    });
    
    // 세션 저장 (디바이스 버퍼 포함)
    collageSessions.set(result.sessionId, {
      ...result,
      imageIds,
      deviceBuffers,
      layout,
      resolution,
      format,
      userId,
      createdAt: new Date()
    });

    console.log('✅ 콜라주 세션 생성 완료:', result.sessionId);
    return res.json(result);
    
  } catch (error) {
    console.error('❌ 콜라주 생성 오류:', error);
    return res.status(500).json({ error: '콜라주 생성 중 오류가 발생했습니다' });
  }
});

// 콜라주 프리뷰/생성 API
router.get('/generate/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log('🎨 콜라주 생성 요청:', sessionId);
    
    // 세션 정보 조회
    const sessionData = collageSessions.get(sessionId);
    if (!sessionData) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }

    // 현재 사용자 ID 또는 세션에 저장된 userId 사용
    const userId = (req as any).user?.id || sessionData.userId;
    console.log('🔐 콜라주 생성 사용자 ID:', userId);

    // 콜라주 생성
    const result = await collageServiceV2.generateCollage(sessionId, {
      imageIds: sessionData.imageIds,
      layout: sessionData.layout,
      resolution: sessionData.resolution,
      format: sessionData.format,
      userId
    }, sessionData.deviceBuffers || []);

    // 세션 업데이트
    collageSessions.set(sessionId, {
      ...sessionData,
      ...result
    });

    return res.json(result);
    
  } catch (error) {
    console.error('❌ 콜라주 생성 오류:', error);
    return res.status(500).json({ error: '콜라주 생성 중 오류가 발생했습니다' });
  }
});

// 콜라주 다운로드 API
router.get('/download/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log('⬇️ 콜라주 다운로드 요청:', sessionId);
    
    // 세션 정보 조회
    const sessionData = collageSessions.get(sessionId);
    if (!sessionData) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }

    // 콜라주가 생성되지 않았으면 먼저 생성
    if (sessionData.status !== 'completed') {
      const userId = (req as any).user?.id || sessionData.userId;
      const result = await collageServiceV2.generateCollage(sessionId, {
        imageIds: sessionData.imageIds,
        layout: sessionData.layout,
        resolution: sessionData.resolution,
        format: sessionData.format,
        userId
      }, sessionData.deviceBuffers || []);
      
      collageSessions.set(sessionId, {
        ...sessionData,
        ...result
      });
      
      sessionData.outputUrl = result.outputUrl;  // GCS URL 저장
      sessionData.outputPath = result.outputPath;
      sessionData.format = result.format || sessionData.format;
    }

    // GCS URL 확인 (이제 GCS에 저장되므로 outputUrl 사용)
    if (!sessionData.outputUrl) {
      return res.status(404).json({ error: '콜라주 파일을 찾을 수 없습니다' });
    }

    // 파일명 설정
    const fileName = `collage_${sessionId}.${sessionData.format}`;
    
    // GCS에서 파일 가져오기
    const response = await fetch(sessionData.outputUrl);
    if (!response.ok) {
      throw new Error('GCS에서 파일을 가져올 수 없습니다');
    }
    
    const buffer = await response.arrayBuffer();
    
    // MIME 타입 설정
    const mimeType = sessionData.format === 'jpg' ? 'image/jpeg' : 
                     sessionData.format === 'webp' ? 'image/webp' : 'image/png';
    
    // 다운로드 헤더 설정
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.byteLength.toString()
    });
    
    // 파일 전송
    res.send(Buffer.from(buffer));
    
  } catch (error) {
    console.error('❌ 다운로드 오류:', error);
    return res.status(500).json({ error: '다운로드 중 오류가 발생했습니다' });
  }
});

// 헬스체크
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'collage',
    message: '콜라주 서비스가 정상 작동 중입니다'
  });
});

export default router;