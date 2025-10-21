import { Router, Request } from "express";
import express from "express";
import path from "path";
import { requireAuth } from "../middleware/auth";
import { getSystemSettings } from "../utils/settings";
import { storage } from "../storage";
import { db } from "../../db/index";
import { images, users, hospitals, AI_MODELS } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// 시스템 설정 조회 API (공개용 - 클라이언트에서 사용)
router.get("/api/system-settings", async (req, res) => {
  try {
    console.log("[시스템 설정 조회] 클라이언트 요청 받음");
    
    const settings = await getSystemSettings();
    
    // 클라이언트에 필요한 설정만 반환 (보안상 민감한 정보 제외)
    const publicSettings = {
      supportedAiModels: settings.supportedAiModels,
      clientDefaultModel: settings.clientDefaultModel,
      defaultAiModel: settings.defaultAiModel
    };
    
    console.log("[시스템 설정 조회] 클라이언트용 설정 반환:", publicSettings);
    
    res.json({
      success: true,
      settings: publicSettings
    });
    
  } catch (error) {
    console.error("[시스템 설정 조회] 클라이언트 요청 오류:", error);
    
    // 오류 시 기본값 반환
    const fallbackSettings = {
      supportedAiModels: [AI_MODELS.OPENAI, AI_MODELS.GEMINI],
      clientDefaultModel: AI_MODELS.OPENAI,
      defaultAiModel: AI_MODELS.OPENAI
    };
    
    res.json({
      success: true,
      settings: fallbackSettings
    });
  }
});

// Serve embed script for iframe integration
router.get('/embed.js', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'client/public/embed.js'));
});

// 개발 대화 내보내기 페이지 제공
router.get('/dev-chat-export', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'client/public/dev-chat-export.html'));
});

// 테스트용 간단한 API
router.get("/api/public/test", (req, res) => {
  console.log("[테스트] 공개 API 호출됨");
  res.json({ message: "테스트 성공!" });
});

// 이미지 삭제 API
router.delete("/api/images/:id", requireAuth, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    const userId = req.user?.userId;

    console.log(`🗑️ 이미지 삭제 요청: ID=${imageId}, 사용자=${userId}`);

    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }

    if (isNaN(imageId)) {
      return res.status(400).json({ error: '잘못된 이미지 ID입니다' });
    }

    // 기존 deleteImage 함수 사용 
    const result = await storage.deleteImage(imageId);
    console.log(`✅ 이미지 삭제 성공: ID=${imageId}`);

    res.json({ success: true, message: '이미지가 성공적으로 삭제되었습니다' });
  } catch (error: any) {
    console.error(`❌ 이미지 삭제 오류:`, error);
    res.status(500).json({ error: '이미지 삭제 중 오류가 발생했습니다' });
  }
});

// 슈퍼관리자 API - 병원 목록 조회
router.get("/api/super/hospitals", async (req, res) => {
  try {
    // JWT 토큰에서 사용자 정보 확인
    const userData = req.user as any;

    if (!userData || !userData.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    // 실제 사용자 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, userData.userId),
    });

    if (!user) {
      return res.status(401).json({ error: '사용자 정보를 찾을 수 없습니다.' });
    }

    if (user.memberType !== 'superadmin') {
      return res.status(403).json({ error: '슈퍼관리자 권한이 필요합니다.' });
    }

    const hospitalsList = await db.query.hospitals.findMany({
      orderBy: [desc(hospitals.createdAt)]
    });
    return res.status(200).json(hospitalsList);
  } catch (error) {
    console.error('병원 목록 조회 오류:', error);
    return res.status(500).json({ error: '병원 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

// 이미지 다운로드 프록시 API (CORS 문제 해결)
router.get("/api/download-image/:imageId", requireAuth, async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user!.userId;

    // 사용자가 소유한 이미지인지 확인
    const image = await db.query.images.findFirst({
      where: and(
        eq(images.id, parseInt(imageId)),
        eq(images.userId, String(userId))
      )
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "이미지를 찾을 수 없습니다."
      });
    }

    const imageUrl = image.transformedUrl || image.originalUrl;
    console.log(`[이미지 다운로드] 사용자 ${userId}가 이미지 ${imageId} 다운로드 요청:`, imageUrl);

    // 이미지 URL이 GCS URL인지 확인
    if (imageUrl.includes('storage.googleapis.com')) {
      // GCS에서 이미지 가져오기
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error(`이미지를 가져올 수 없습니다: ${response.status}`);
      }

      const buffer = await response.buffer();
      const fileName = (image.title || 'image').replace(/\.(jpg|jpeg|png|webp)$/i, '') + '.webp';

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Content-Length', buffer.length);

      return res.send(buffer);
    } else {
      // 로컬 파일인 경우
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.join(process.cwd(), 'static', imageUrl.replace('/static/', ''));

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "파일을 찾을 수 없습니다."
        });
      }

      const fileName = (image.title || 'image').replace(/\.(jpg|jpeg|png|webp)$/i, '') + '.webp';
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

      return res.sendFile(filePath);
    }
  } catch (error) {
    console.error("이미지 다운로드 오류:", error);
    return res.status(500).json({
      success: false,
      message: "이미지 다운로드 중 오류가 발생했습니다."
    });
  }
});

// 알림 시스템 기본 API
router.get("/api/notifications", async (req, res) => {
  res.json({
    success: true,
    message: "Phase 5 알림 시스템이 구현되었습니다.",
    notifications: [],
    unreadCount: 0
  });
});

export default router;
