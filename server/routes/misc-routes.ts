import { Router, Request } from "express";
import express from "express";
import path from "path";
import { requireAuth } from "../middleware/auth";
import { getSystemSettings } from "../utils/settings";
import { storage } from "../storage";
import { storage as gcsStorage } from "../utils/gcs-image-storage";
import { db } from "../../db/index";
import { images, users, hospitals, AI_MODELS, concepts } from "../../shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { IMAGE_CONSTANTS } from "@shared/constants";
import { IMAGE_MESSAGES, API_MESSAGES } from "../constants";

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
      defaultAiModel: settings.defaultAiModel,
      milestoneEnabled: settings.milestoneEnabled ?? true
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
      defaultAiModel: AI_MODELS.OPENAI,
      milestoneEnabled: true
    };
    
    res.json({
      success: true,
      settings: fallbackSettings
    });
  }
});

// 모델 능력 조회 API (공개용 - 클라이언트에서 사용)
router.get("/api/model-capabilities", async (req, res) => {
  try {
    console.log("[모델 능력 조회] 클라이언트 요청 받음");
    
    // 활성화된 컨셉들의 availableAspectRatios를 집계하여 모델별 기본값 계산
    const activeConcepts = await db.select({
      conceptId: concepts.conceptId,
      title: concepts.title,
      availableAspectRatios: concepts.availableAspectRatios
    })
    .from(concepts)
    .where(eq(concepts.isActive, true))
    .orderBy(asc(concepts.order));

    console.log(`[모델 능력 조회] ${activeConcepts.length}개 활성 컨셉에서 비율 정보 집계 중...`);

    // 모델별로 지원하는 비율을 집계
    const modelCapabilities: Record<string, Set<string>> = {};
    
    for (const concept of activeConcepts) {
      if (concept.availableAspectRatios && typeof concept.availableAspectRatios === 'object') {
        const ratios = concept.availableAspectRatios as Record<string, string[]>;
        
        for (const [model, aspectRatios] of Object.entries(ratios)) {
          if (!modelCapabilities[model]) {
            modelCapabilities[model] = new Set();
          }
          
          if (Array.isArray(aspectRatios)) {
            aspectRatios.forEach((ratio: string) => {
              if (typeof ratio === 'string' && ratio.trim()) {
                modelCapabilities[model].add(ratio.trim());
              }
            });
          }
        }
      }
    }

    // Set을 배열로 변환하고 정렬
    const finalCapabilities: Record<string, string[]> = {};
    for (const [model, ratioSet] of Object.entries(modelCapabilities)) {
      finalCapabilities[model] = Array.from(ratioSet).sort();
    }

    // gemini_3가 없으면 기본값 추가 (Gemini 3.0 Pro 지원 비율)
    if (!finalCapabilities["gemini_3"]) {
      finalCapabilities["gemini_3"] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
    }

    // 빈 결과인 경우 기본값 반환 (fallback)
    if (Object.keys(finalCapabilities).length === 0) {
      console.warn("[모델 능력 조회] 데이터베이스에서 비율 정보를 찾을 수 없어 기본값을 반환합니다");
      const fallbackCapabilities = {
        "openai": ["1:1", "2:3", "3:2"],
        "gemini": ["1:1", "9:16", "16:9"],
        "gemini_3": ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
      };
      return res.json(fallbackCapabilities);
    }

    console.log("[모델 능력 조회] 지원 가능한 비율 정보 반환:", finalCapabilities);
    res.json(finalCapabilities);
  } catch (error) {
    console.error("[모델 능력 조회] 클라이언트 요청 오류:", error);
    
    // 오류 시 기본값 반환
    const fallbackCapabilities = {
      "openai": ["1:1", "2:3", "3:2"],
      "gemini": ["1:1", "9:16", "16:9"],
      "gemini_3": ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
    };
    res.json(fallbackCapabilities);
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
      return res.status(401).json({ error: API_MESSAGES.ERRORS.UNAUTHORIZED });
    }

    if (isNaN(imageId)) {
      return res.status(400).json({ error: IMAGE_MESSAGES.ERRORS.INVALID_ID });
    }

    // 기존 deleteImage 함수 사용 
    const result = await storage.deleteImage(imageId);
    console.log(`✅ 이미지 삭제 성공: ID=${imageId}`);

    res.json({ success: true, message: API_MESSAGES.SUCCESS.DELETE_SUCCESS });
  } catch (error: any) {
    console.error(`❌ 이미지 삭제 오류:`, error);
    res.status(500).json({ error: API_MESSAGES.ERRORS.DELETE_FAILED });
  }
});

// 슈퍼관리자 API - 병원 목록 조회
router.get("/api/super/hospitals", async (req, res) => {
  try {
    // JWT 토큰에서 사용자 정보 확인
    const userData = req.user as any;

    if (!userData || !userData.userId) {
      return res.status(401).json({ error: API_MESSAGES.ERRORS.LOGIN_REQUIRED });
    }

    // 실제 사용자 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, userData.userId),
    });

    if (!user) {
      return res.status(401).json({ error: API_MESSAGES.ERRORS.USER_NOT_FOUND });
    }

    if (user.memberType !== 'superadmin') {
      return res.status(403).json({ error: API_MESSAGES.ERRORS.SUPERADMIN_REQUIRED });
    }

    const hospitalsList = await db.query.hospitals.findMany({
      orderBy: [desc(hospitals.createdAt)]
    });
    return res.status(200).json(hospitalsList);
  } catch (error) {
    console.error('병원 목록 조회 오류:', error);
    return res.status(500).json({ error: API_MESSAGES.ERRORS.FETCH_FAILED });
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
        message: IMAGE_MESSAGES.ERRORS.NOT_FOUND
      });
    }

    let imageUrl = image.transformedUrl || image.originalUrl;
    
    // HTML 엔티티 디코딩 (DB에 &amp;로 저장된 경우 대비)
    imageUrl = imageUrl.replace(/&amp;/g, '&');
    
    console.log(`[이미지 다운로드] 사용자 ${userId}가 이미지 ${imageId} 다운로드 요청:`, imageUrl);

    // 이미지 URL이 GCS URL인지 확인
    if (imageUrl.includes('storage.googleapis.com')) {
      // GCS에서 이미지 가져오기
      const fetch = (await import('node-fetch')).default;
      let response = await fetch(imageUrl);

      // 만료된 signed URL 감지 (400, 401, 403)
      if (!response.ok && (response.status === 400 || response.status === 401 || response.status === 403)) {
        console.log(`[이미지 다운로드] Signed URL 만료 감지 (${response.status}), 새 URL 생성 중...`);
        
        try {
          // GCS URL에서 파일 경로 추출
          // 예: https://storage.googleapis.com/createtree-upload/images/mansak_img/.../file.webp
          const bucketName = 'createtree-upload';
          const urlParts = imageUrl.split(`${bucketName}/`);
          
          if (urlParts.length > 1) {
            // ? 이전까지가 파일 경로 (query string 제거)
            const filePath = urlParts[1].split('?')[0];
            console.log(`[이미지 다운로드] 파일 경로 추출: ${filePath}`);
            
            // Storage bucket에서 파일 참조
            const bucket = gcsStorage.bucket(bucketName);
            const file = bucket.file(filePath);
            
            // 새 signed URL 생성 (1시간 유효)
            const [newSignedUrl] = await file.getSignedUrl({
              version: 'v4',
              action: 'read',
              expires: Date.now() + 60 * 60 * 1000 // 1시간
            });
            
            console.log(`[이미지 다운로드] 새 signed URL 생성 완료`);
            
            // 새 URL로 재시도
            response = await fetch(newSignedUrl);
            
            if (!response.ok) {
              throw new Error(`새 URL로도 실패: ${response.status}`);
            }
          } else {
            throw new Error('GCS URL에서 파일 경로 추출 실패');
          }
        } catch (urlError) {
          console.error('[이미지 다운로드] Signed URL 재생성 실패:', urlError);
          throw new Error(`${IMAGE_MESSAGES.ERRORS.FETCH_FAILED}: ${response.status}`);
        }
      } else if (!response.ok) {
        throw new Error(`${IMAGE_MESSAGES.ERRORS.FETCH_FAILED}: ${response.status}`);
      }

      const buffer = await response.buffer();
      const fileName = (image.title || 'image').replace(/\.(jpg|jpeg|png|webp)$/i, '') + '.webp';

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Type', IMAGE_CONSTANTS.CONTENT_TYPES.WEBP);
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
          message: IMAGE_MESSAGES.ERRORS.FILE_NOT_FOUND
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
      message: IMAGE_MESSAGES.ERRORS.DOWNLOAD_FAILED
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

// 이미지 프록시 API (CORS 우회용 - 내보내기 기능에서 사용)
router.get("/api/proxy-image", async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // GCS URL만 허용 (보안)
    const allowedDomains = ['storage.googleapis.com', 'storage.cloud.google.com'];
    const parsedUrl = new URL(url);
    
    if (!allowedDomains.some(domain => parsedUrl.hostname.includes(domain))) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }
    
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.send(buffer);
  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    return res.status(500).json({ error: 'Proxy failed' });
  }
});

export default router;
