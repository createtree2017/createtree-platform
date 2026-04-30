import { Router, Request, Response } from 'express';
import type { Express } from 'express';
import { storage } from '../storage';
import { requireAuth } from '../middleware/auth';
import { requirePremiumAccess, requireActiveHospital } from '../middleware/permission';
import { db } from '@db';
import { images, concepts, imageReferenceUploads } from '@shared/schema';
import { eq, desc, and, or } from 'drizzle-orm';
import { bucket } from '../firebase';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { createUploadMiddleware } from '../config/upload-config';
import { saveImageToGCS, saveImageFromUrlToGCS } from '../utils/gcs-image-storage';
import { applyTemplateVariables, buildPromptWithImageMappings, ImageTextMapping, applyDynamicLayoutPlaceholders, generateDefaultLayoutInstruction } from '../utils/prompt';
import { resolveAiModel, validateRequestedModel } from '../utils/settings';
import { GCS_CONSTANTS, IMAGE_MESSAGES, API_MESSAGES } from '../constants';
import { IMAGE_CONSTANTS } from '@shared/constants';
import { generateImageTitle, appendImageIdToTitle } from '../utils/image-title';
import { processFirebaseImageUrls } from '../middleware/firebase-image-download'; // 🔥 중앙화된 Firebase 미들웨어
import { generateImageWithConfiguredModel } from '../services/image-generation/image-generation-service';
import { decideGenerationMode } from '../services/image-generation/generation-mode';
import { extractReferenceImages, summarizeReferenceImages } from '../services/image-generation/request-images';

const router = Router();

// ==================== 영구 로그 저장 시스템 ====================
const IMAGE_GEN_LOG_FILE = '/tmp/image-generation.log';

function persistentLog(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] ${message}`;
  if (data !== undefined) {
    try {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      logLine += `\n${dataStr}`;
    } catch (e) {
      logLine += `\n[직렬화 실패: ${e}]`;
    }
  }
  logLine += '\n';

  // 콘솔에도 출력
  console.log(message, data !== undefined ? data : '');

  // 파일에 동기적으로 추가 (워크플로우 재시작 무관하게 보존)
  try {
    fs.appendFileSync(IMAGE_GEN_LOG_FILE, logLine);
  } catch (e) {
    console.error('[영구 로그] 파일 쓰기 실패:', e);
  }
}

function logImageGenStart(userId: string, style: string, imageCount: number, hasTexts: boolean): void {
  persistentLog('========================================');
  persistentLog('🚀 [이미지 생성 시작]', {
    userId,
    style,
    imageCount,
    hasTexts,
    timestamp: new Date().toISOString()
  });
}

function logPromptInfo(prompt: string, imageMappings?: any[]): void {
  persistentLog('📝 [프롬프트 정보]', {
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''),
    imageMappingsCount: imageMappings?.length || 0,
    imageMappings: imageMappings?.map(m => ({
      index: m.imageIndex,
      text: m.text?.substring(0, 50) || '(없음)'
    }))
  });
}

function logAiCall(model: string, imagesCount: number): void {
  persistentLog(`🤖 [AI 호출] 모델: ${model}, 이미지 수: ${imagesCount}`);
}

function logImageGenResult(success: boolean, resultUrl?: string, error?: string): void {
  if (success) {
    persistentLog('✅ [이미지 생성 완료]', { resultUrl });
  } else {
    persistentLog('❌ [이미지 생성 실패]', { error });
  }
  persistentLog('========================================\n');
}

// ==================== 영구 로그 시스템 끝 ====================

// Upload middleware
const upload = createUploadMiddleware('thumbnails', 'image');

// 다중 이미지 업로드를 위한 fields 미들웨어
const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 10 }
]);

// Helper functions
const normalizeOptionalString = (value: string | null | undefined): string | undefined => {
  return value === null ? undefined : value;
};

const isError = (error: unknown): error is Error => {
  return error instanceof Error;
};

const getErrorMessage = (error: unknown): string => {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
};

const isMissingReferenceUploadTableError = (error: unknown): boolean => {
  const err = error as { code?: string; message?: string; cause?: unknown } | undefined;
  const message = err?.message || "";

  if (err?.code === "42P01") {
    return true;
  }

  if (
    message.includes("image_reference_uploads") &&
    (message.includes("does not exist") || message.includes("relation"))
  ) {
    return true;
  }

  return err?.cause ? isMissingReferenceUploadTableError(err.cause) : false;
};

function getUserId(req: Request): string {
  const userId = req.user?.id || req.user?.userId;
  return String(userId);
}

function validateUserId(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId || userId === 'undefined') {
    console.error("❌ 사용자 ID가 없습니다:", req.user);
    res.status(400).json({
      success: false,
      message: IMAGE_MESSAGES.ERRORS.USER_AUTH_ERROR
    });
    return null;
  }
  return userId;
}

/**
 * 이미지 URL을 공개 URL로 변환
 */
function generatePublicUrl(imagePath: string): string | null {
  try {
    if (!imagePath) return null;

    // Use actual bucket.name instead of constant for accurate resolution
    const bucketPath = `/${bucket.name}/`;
    const bucketUrl = `${GCS_CONSTANTS.BUCKET.BASE_URL}/${bucket.name}`;

    // SignedURL을 직접 공개 URL로 변환
    if (imagePath.includes('GoogleAccessId=') || imagePath.includes('Signature=')) {
      try {
        const urlObj = new URL(imagePath);
        const pathname = urlObj.pathname;
        if (pathname.includes(bucketPath)) {
          const filePath = pathname.substring(pathname.indexOf(bucketPath) + bucketPath.length);
          const directUrl = `${bucketUrl}/${filePath}`;
          console.log(`[URL 변환] SignedURL → 직접 URL: ${directUrl}`);
          return directUrl;
        }
      } catch (error) {
        console.log(`[URL 변환] 파싱 오류, 원본 유지: ${imagePath}`);
      }
    }

    // 이미 HTTP URL인 경우 그대로 반환
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    // gs:// 형식인 경우 공개 URL로 변환
    if (imagePath.startsWith('gs://')) {
      const bucketName = imagePath.split('/')[2];
      const filePath = imagePath.split('/').slice(3).join('/');
      return `${GCS_CONSTANTS.BUCKET.BASE_URL}/${bucketName}/${filePath}`;
    }

    // 상대 경로인 경우 버킷 사용
    if (imagePath.startsWith(GCS_CONSTANTS.PATHS.IMAGES_PREFIX) || imagePath.includes('.webp')) {
      const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
      return `${bucketUrl}/${cleanPath}`;
    }

    // static 경로는 로컬 서빙 유지
    if (imagePath.startsWith(IMAGE_CONSTANTS.PATHS.LOCAL_STATIC)) {
      return imagePath;
    }

    // 로컬 콜라주 경로는 로컬 서빙 유지
    if (imagePath.startsWith(IMAGE_CONSTANTS.PATHS.LOCAL_COLLAGES)) {
      return imagePath;
    }

    // GCS 콜라주 경로 처리
    if (imagePath.startsWith(GCS_CONSTANTS.PATHS.COLLAGES_PREFIX)) {
      return `${bucketUrl}/${imagePath}`;
    }

    // 로컬 경로인 경우 GCS 공개 URL로 변환
    if (imagePath.startsWith(IMAGE_CONSTANTS.PATHS.LOCAL_UPLOADS)) {
      const pathParts = imagePath.split('/');
      const filename = pathParts[pathParts.length - 1];
      const gcsPath = `${GCS_CONSTANTS.PATHS.SYSTEM_IMAGES}${filename}`;
      return `${GCS_CONSTANTS.BUCKET.BASE_URL}/${bucket.name}/${gcsPath}`;
    }

    // GCS 경로인 경우 공개 URL 생성
    if (imagePath.startsWith('gs://')) {
      return imagePath.replace(`gs://${bucket.name}/`, `${GCS_CONSTANTS.BUCKET.BASE_URL}/${bucket.name}/`);
    }

    // 기타 경로는 버킷 기본 경로 사용
    return `${bucketUrl}/${imagePath}`;
  } catch (error) {
    console.error('GCS 공개 URL 생성 실패:', error);
    return null;
  }
}

// ==================== 새로 통합된 라우트 (9개) ====================

// 1. GCS 이미지 프록시 서빙 (Line 685)
router.get('/image-proxy/*', async (req, res) => {
  try {
    const filePath = (req.params as any)[0]; // * captures everything
    console.log(`🖼️ 이미지 프록시 요청: ${filePath}`);

    const file = bucket.file(filePath);
    const [exists] = await file.exists();

    if (!exists) {
      return res.status(404).json({ error: IMAGE_MESSAGES.ERRORS.IMAGE_NOT_FOUND });
    }

    // 파일 스트림 직접 전송
    const stream = file.createReadStream();

    // 적절한 Content-Type 설정
    const contentType = filePath.endsWith('.webp') ? IMAGE_CONSTANTS.CONTENT_TYPES.WEBP :
      filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? IMAGE_CONSTANTS.CONTENT_TYPES.JPEG :
        filePath.endsWith('.png') ? IMAGE_CONSTANTS.CONTENT_TYPES.PNG : IMAGE_CONSTANTS.CONTENT_TYPES.WEBP;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', GCS_CONSTANTS.CACHE.CONTROL_HEADER);

    stream.pipe(res);

    stream.on('error', (error: unknown) => {
      console.error('❌ 이미지 스트림 오류:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: IMAGE_MESSAGES.ERRORS.STREAM_ERROR });
      }
    });

  } catch (error) {
    console.error('❌ 이미지 프록시 오류:', error);
    res.status(500).json({ error: IMAGE_MESSAGES.ERRORS.PROXY_ERROR });
  }
});

// 2. 인증 없는 공개 이미지 변환 API (Line 754)
// ==================== 공개 이미지 변환 API ====================
router.post("/public/image-transform", uploadFields, processFirebaseImageUrls, async (req, res) => { // 🔥 미들웨어 추가!
  console.log("[공개 이미지 변환] API 호출됨 - 파일 업로드 시작");
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const uploadedImage = files?.image?.[0] || files?.images?.[0];
    const downloadedBuffers = req.downloadedBuffers || [];
    const imageBuffer = uploadedImage?.buffer || downloadedBuffers[0];

    if (!imageBuffer) {
      return res.status(400).json({ error: IMAGE_MESSAGES.ERRORS.NO_FILE_UPLOADED });
    }

    const { style, userVariables } = req.body;
    if (!style) {
      return res.status(400).json({ error: IMAGE_MESSAGES.ERRORS.NO_STYLE_SELECTED });
    }

    console.log("[공개 이미지 변환] 파일 업로드됨:", uploadedImage?.originalname || "firebase-url");
    console.log("[공개 이미지 변환] 스타일:", style);

    // 사용자 변수 파싱
    let parsedUserVariables = {};
    if (userVariables) {
      try {
        parsedUserVariables = JSON.parse(userVariables);
        console.log("[공개 이미지 변환] 사용자 변수:", parsedUserVariables);
      } catch (e) {
        console.log("[공개 이미지 변환] 변수 파싱 실패, 기본값 사용");
      }
    }

    // 컨셉 정보 조회하여 프롬프트 생성
    const publicConceptInfo = await db.query.concepts.findFirst({
      where: eq(concepts.conceptId, style)
    });

    // 프롬프트 생성 - 컨셉 정보 또는 기본 프롬프트 사용
    let prompt = publicConceptInfo?.promptTemplate || `Transform this image into ${style} style, maintaining the original composition and subjects while applying the artistic style transformation.`;

    // 사용자 변수가 있으면 프롬프트에 적용
    if (parsedUserVariables && Object.keys(parsedUserVariables).length > 0) {
      Object.entries(parsedUserVariables).forEach(([key, value]) => {
        prompt = prompt.replace(`{{${key}}}`, value as string);
      });
    }

    console.log(`[공개 이미지 변환] 생성된 프롬프트: ${prompt}`);

    let transformedImageUrl;

    // GPT-Image-2 모델 사용
    console.log("[공개 이미지 변환] GPT-Image-2 어댑터 호출");
    const generationResult = await generateImageWithConfiguredModel({
      modelKey: "openai_gpt2",
      prompt,
      concept: publicConceptInfo,
      imageBuffer,
      variables: parsedUserVariables as Record<string, string>,
      isTextOnly: false,
    });
    transformedImageUrl = generationResult.imageUrl;
    console.log("[공개 이미지 변환] GPT-Image-2 성공", {
      apiModel: generationResult.apiModel,
      elapsedMs: generationResult.elapsedMs,
    });

    console.log("[공개 이미지 변환] OpenAI 응답 성공");

    // 컨셉 정보를 사용하여 카테고리와 제목 결정
    const categoryId = publicConceptInfo?.categoryId || 'sticker_img';
    const conceptTitle = publicConceptInfo?.title || style;
    const imageTitle = await generateImageTitle(categoryId, style, 'guest');

    console.log(`[공개 이미지 변환] 카테고리별 저장: ${categoryId}`);
    console.log(`[공개 이미지 변환] 새로운 제목 형식: ${imageTitle}`);

    // GCS에 이미지 저장
    const imageResult = await saveImageFromUrlToGCS(
      transformedImageUrl,
      'guest',
      categoryId,
      imageTitle
    );

    console.log(`[공개 이미지 변환] GCS 저장 완료: ${imageResult.originalUrl}`);

    // 📐 이미지 크기 및 DPI 정보 추출
    let imageWidth: number | undefined;
    let imageHeight: number | undefined;
    let imageDpi: number | undefined;

    // transformedImageUrl에서 이미지 다운로드 후 메타데이터 추출
    try {
      const sharp = (await import('sharp')).default;
      const fetch = (await import('node-fetch')).default;
      let downloadedBuffer: Buffer;
      if (transformedImageUrl.startsWith('data:')) {
        const base64Match = transformedImageUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (!base64Match) {
          throw new Error('지원하지 않는 data URL 형식입니다');
        }
        downloadedBuffer = Buffer.from(base64Match[1], 'base64');
      } else {
        const imageResponse = await fetch(transformedImageUrl);
        downloadedBuffer = Buffer.from(await imageResponse.arrayBuffer());
      }

      const imageMeta = await sharp(downloadedBuffer).metadata();
      imageWidth = imageMeta.width;
      imageHeight = imageMeta.height;
      imageDpi = imageMeta.density;
      console.log(`📐 [이미지 메타데이터] 크기: ${imageWidth}x${imageHeight}, DPI: ${imageDpi || '없음'}`);
    } catch (metaError) {
      console.warn(`⚠️ [이미지 메타데이터] 추출 실패:`, metaError);
    }

    // DB에 이미지 저장
    const [savedImage] = await db.insert(images).values({
      title: imageTitle,
      style: style,
      originalUrl: imageResult.originalUrl,
      transformedUrl: imageResult.originalUrl,
      thumbnailUrl: imageResult.thumbnailUrl,
      userId: "-1",
      categoryId: categoryId,
      conceptId: style,
      width: imageWidth,
      height: imageHeight,
      dpi: imageDpi,
      metadata: JSON.stringify({
        originalStyle: style,
        originalName: uploadedImage?.originalname || 'guest_upload',
        createdAt: new Date().toISOString(),
        displayTitle: imageTitle,
        model: "openai_gpt2",
        gsPath: imageResult.gsPath,
        gsThumbnailPath: imageResult.gsThumbnailPath,
        fileName: imageResult.fileName,
        storageType: 'gcs',
        isShared: true
      })
    }).returning();

    // INSERT 후 imageId를 포함한 최종 제목으로 UPDATE
    const finalImageTitle = appendImageIdToTitle(imageTitle, savedImage.id);
    await db.update(images)
      .set({ title: finalImageTitle })
      .where(eq(images.id, savedImage.id));

    console.log(`[공개 이미지 변환] DB 저장 완료: ID ${savedImage.id}, 최종 제목: ${finalImageTitle}`);

    return res.json({
      success: true,
      imageId: savedImage.id,
      transformedUrl: imageResult.originalUrl,
      thumbnailUrl: imageResult.thumbnailUrl,
      originalUrl: imageBuffer ? (await saveImageToGCS(imageBuffer, 'anonymous', 'original')).originalUrl : null,
      message: IMAGE_MESSAGES.SUCCESS.GENERATED
    });

  } catch (error) {
    console.error("[공개 이미지 변환] 오류:", error);
    return res.status(500).json({
      error: IMAGE_MESSAGES.ERRORS.GENERATION_FAILED,
      details: getErrorMessage(error)
    });
  }
});

// 3. 인증 필요한 이미지 변환 API (Line 892) - 축약 버전
// 주의: 이 라우트는 매우 길기 때문에, routes.ts에서 복사한 전체 코드를 사용합니다
// ==================== 이미지 변환 API ====================
router.post("/transform", requireAuth, uploadFields, processFirebaseImageUrls, async (req, res) => { // 🔥 미들웨어 추가!
  try {
    return res.status(410).json({
      success: false,
      message: "이전 /transform API는 사용 중단되었습니다. /generate-image, /generate-family, /generate-stickers 경로를 사용해주세요."
    });

  } catch (error) {
    console.error("[이미지 변환] 오류:", error);
    return res.status(500).json({
      error: IMAGE_MESSAGES.ERRORS.GENERATION_FAILED,
      details: getErrorMessage(error)
    });
  }
});

// 4. 관리자 전체 이미지 갤러리 (Line 1224)
router.get("/admin", requireAuth, async (req, res) => {
  try {
    const userRole = (req.user as any)?.role;

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const filter = req.query.filter as string;
    let whereCondition;

    if (filter && filter !== 'all') {
      if (filter === 'collage') {
        whereCondition = eq(images.style, 'collage');
      } else {
        whereCondition = eq(images.categoryId, filter);
      }
    }

    const imageItems = await db.query.images.findMany({
      where: whereCondition,
      orderBy: desc(images.createdAt),
      limit: 100
    });

    const galleryItems = imageItems.map((image) => {
      const convertToDirectUrl = (url: string): string => {
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          if (pathname.includes('/createtree-upload/')) {
            const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
            return `https://storage.googleapis.com/createtree-upload/${filePath}`;
          }
          return url;
        } catch (error) {
          return url;
        }
      };

      const baseUrl = generatePublicUrl(image.transformedUrl || image.originalUrl);
      const transformedUrl = baseUrl ? convertToDirectUrl(baseUrl) : '';

      const origUrl = generatePublicUrl(image.originalUrl);
      const originalUrl = origUrl ? convertToDirectUrl(origUrl) : '';

      let thumbnailUrl = transformedUrl;
      if (image.thumbnailUrl) {
        const thumbUrl = generatePublicUrl(image.thumbnailUrl);
        thumbnailUrl = thumbUrl ? convertToDirectUrl(thumbUrl) : transformedUrl;
      }

      return {
        id: image.id,
        title: image.title || `생성된 이미지 - ${image.style || '스타일'}`,
        type: image.style === 'collage' ? 'collage' as const : image.categoryId || 'image' as const,
        url: thumbnailUrl,
        transformedUrl: transformedUrl,
        thumbnailUrl: thumbnailUrl,
        originalUrl: originalUrl,
        style: image.style || '',
        userId: image.userId,
        createdAt: image.createdAt.toISOString(),
        isFavorite: false
      };
    });

    res.json(galleryItems);
  } catch (error) {
    console.error("Error fetching admin gallery:", error);
    return res.status(500).json({ error: "Failed to fetch gallery" });
  }
});

// 5. 사용자 이미지 목록 (Line 1368)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(`[사용자 이미지 목록] 사용자 ID: ${userId}`);

    const userImages = await db.query.images.findMany({
      where: eq(images.userId, String(userId)),
      orderBy: desc(images.createdAt),
      limit: 50
    });

    const processedImages = userImages.map((image) => {
      const publicTransformedUrl = generatePublicUrl(image.transformedUrl || '');
      const publicThumbnailUrl = generatePublicUrl(image.thumbnailUrl || '');

      return {
        id: image.id,
        title: image.title,
        style: image.style,
        transformedUrl: publicTransformedUrl || image.transformedUrl,
        thumbnailUrl: publicThumbnailUrl || image.thumbnailUrl,
        url: publicThumbnailUrl || image.thumbnailUrl,
        createdAt: image.createdAt.toISOString()
      };
    });

    res.json({ images: processedImages });
  } catch (error) {
    console.error("Error fetching user images:", error);
    return res.status(500).json({ error: "Failed to fetch images" });
  }
});

// 6. 최근 이미지 (Line 1460)
router.get("/recent", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const categoryId = req.query.categoryId as string;
    console.log(`[최근 이미지] 사용자 ${userId}, 카테고리: ${categoryId || 'all'}`);

    let whereCondition;
    if (categoryId) {
      whereCondition = and(
        eq(images.userId, String(userId)),
        eq(images.categoryId, categoryId)
      );
    } else {
      whereCondition = eq(images.userId, String(userId));
    }

    const recentImages = await db.query.images.findMany({
      where: whereCondition,
      orderBy: desc(images.createdAt),
      limit: 20
    });

    const convertedImages = recentImages.map((img) => {
      let metadata = {};
      if (img.metadata) {
        try {
          metadata = typeof img.metadata === 'string' ? JSON.parse(img.metadata) : img.metadata;
        } catch (e) {
          console.error("Metadata parsing error:", e);
        }
      }

      const transformedUrl = generatePublicUrl(img.transformedUrl || img.originalUrl);
      const thumbnailUrl = generatePublicUrl(img.thumbnailUrl || img.transformedUrl || img.originalUrl);

      return {
        id: img.id,
        title: img.title,
        style: img.style,
        categoryId: img.categoryId,
        transformedUrl,
        thumbnailUrl,
        url: thumbnailUrl,
        createdAt: img.createdAt.toISOString(),
        metadata
      };
    });

    return res.json(convertedImages);
  } catch (error) {
    console.error("Error fetching recent images:", error);
    return res.status(500).json({ error: "Failed to fetch recent images" });
  }
});

// 이미지 목록 조회 API (간단한 버전)
router.get('/list', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '인증 필요' });
    }

    const userImages = await db.select()
      .from(images)
      .where(eq(images.userId, String(userId)))
      .orderBy(desc(images.createdAt))
      .limit(20);

    // 공개 URL로 변환
    const processedImages = userImages.map((image) => {
      const publicTransformedUrl = generatePublicUrl(image.transformedUrl || '');
      const publicThumbnailUrl = generatePublicUrl(image.thumbnailUrl || '');

      return {
        ...image,
        transformedUrl: publicTransformedUrl || image.transformedUrl,
        thumbnailUrl: publicThumbnailUrl || image.thumbnailUrl,
        url: publicThumbnailUrl || image.thumbnailUrl
      };
    });

    res.json({ images: processedImages });
  } catch (error) {
    console.error('이미지 목록 조회 오류:', error);
    res.status(500).json({ error: '이미지 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// ==================== 이미지 생성 API 3개 (복원됨) ====================

// 1. POST /generate-image - 일반 이미지 생성 (텍스트 전용 또는 이미지 변환) - 다중 이미지 지원
router.post("/generate-image", requireAuth, requirePremiumAccess, requireActiveHospital(), (req, res, next) => {
  console.log("🚀 [이미지 생성] API 호출 시작");
  console.log("- Content-Type:", req.headers['content-type']);
  console.log("- Authorization:", req.headers.authorization ? '존재함' : '없음');

  uploadFields(req, res, (err) => {
    if (err) {
      console.error("❌ [파일 업로드] Multer 오류:", err.message);
      return res.status(400).json({
        success: false,
        message: err.message.includes('File too large')
          ? "파일 크기가 너무 큽니다. 10MB 이하의 파일을 업로드해주세요."
          : err.message
      });
    }
    next();
  });
}, processFirebaseImageUrls, async (req, res) => { // 🔥 미들웨어 추가!
  try {
    // 🔥 Safe JSON 유틸리티 import (imageTexts, variables 파싱용)
    const { safeJsonParseArray, safeJsonParseObject } = await import('../utils/safe-json');

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const singleImage = files?.image?.[0];
    const multipleImages = files?.images || [];

    // 🔥 미들웨어가 처리한 downloadedBuffers 사용
    const downloadedBuffers = req.downloadedBuffers || [];
    const referenceImages = await extractReferenceImages(req, {
      fileFields: ["image", "images"],
      includeOtherImageFields: true,
      includeFirebaseBuffers: true,
    });
    const referenceSummary = summarizeReferenceImages(referenceImages);
    const isMultiImageMode = multipleImages.length > 0 || downloadedBuffers.length > 1 || referenceImages.length > 1;

    console.log(`📁 [파일 확인] 모드: ${req.isFirebaseMode ? 'Firebase URL' : '파일'}, 다중: ${isMultiImageMode}`);
    console.log("🧩 [참조 이미지 정규화]", referenceSummary);

    if (isMultiImageMode) {
      console.log(`🖼️ [다중 이미지 모드] ${multipleImages.length || downloadedBuffers.length}개`);
    }

    const { style, variables, model, categoryId = "mansak_img", aspectRatio, imageTexts, imageCount } = req.body;

    if (!style) {
      console.log("❌ [이미지 생성] 스타일이 선택되지 않음");
      return res.status(400).json({ error: "스타일을 선택해주세요" });
    }

    console.log("📝 [이미지 생성] 요청 정보:");
    console.log("- 단일 파일:", singleImage ? singleImage.originalname : '없음');
    console.log("- 다중 파일:", multipleImages.length > 0 ? `${multipleImages.length}개` : '없음');
    console.log("- 스타일:", style);
    console.log("- 변수:", variables);
    console.log("- 모델:", model);
    console.log("- 카테고리:", categoryId);
    console.log("- 비율:", aspectRatio);
    console.log("- 이미지 텍스트:", imageTexts);
    console.log("- 이미지 개수:", imageCount);
    console.log("📋 [디버깅] 전체 req.body:", JSON.stringify(req.body, null, 2));

    const userId = validateUserId(req, res);
    if (!userId) return;

    const pathModule = await import('path');
    const fsModule = await import('fs');
    const sharp = (await import('sharp')).default;
    const { v4: uuidv4 } = await import('uuid');

    // 🛡️ 안전한 JSON 파싱
    const parsedVariables = safeJsonParseObject(variables, {});
    console.log("✅ [변수 파싱 완료]:", parsedVariables);

    const isDev = process.env.NODE_ENV !== 'production';

    // 🛡️ 안전한 JSON 파싱
    const parsedImageTexts = safeJsonParseArray<string>(imageTexts, []);
    if (isDev && parsedImageTexts.length > 0) {
      console.log(`✅ [이미지 텍스트] ${parsedImageTexts.length}개 파싱 성공`);
    }

    // 🔒 영구 로그 시작 (parsedImageTexts 파싱 완료 후)
    logImageGenStart(userId, style, referenceImages.length, parsedImageTexts.length > 0);

    let imageMappings: ImageTextMapping[] = [];
    if (isMultiImageMode) {
      if (isDev) console.log(`🔍 [다중 이미지 매핑] 생성 시작 - 참조 이미지 ${referenceImages.length}개, 텍스트 ${parsedImageTexts.length}개`);
      imageMappings = referenceImages.map((image, index) => ({
        imageIndex: index + 1,
        imageUrl: `[업로드된 이미지 ${index + 1}]`,
        text: parsedImageTexts[index] || ''
      }));
      if (isDev) {
        console.log(`🗺️ [이미지 매핑] ${imageMappings.length}개 생성됨:`);
        imageMappings.forEach((m, i) => {
          console.log(`   - [${i}] imageIndex: ${m.imageIndex}, text: "${m.text?.substring(0, 30) || '(없음)'}..."`);
        });
      }
    } else {
      if (isDev) console.log("ℹ️ [이미지 매핑] 다중 이미지 모드 아님 - 매핑 생성 건너뜀");
    }

    let prompt = "A beautiful portrait with professional lighting and artistic styling";
    let systemPrompt: string | null = null;
    let finalModel: string;

    console.log(`🔍 [컨셉 조회] ${style} 컨셉 검색 중...`);

    const concept = await db.query.concepts.findFirst({
      where: eq(concepts.conceptId, style)
    });

    if (concept) {
      console.log(`📋 [컨셉 발견] ${style} 컨셉 정보:`, {
        title: concept.title,
        hasSystemPrompt: !!(concept.systemPrompt && concept.systemPrompt.trim()),
        hasPromptTemplate: !!(concept.promptTemplate && concept.promptTemplate.trim()),
        availableModels: concept.availableModels,
        gemini3AspectRatio: concept.gemini3AspectRatio,
        gemini3ImageSize: concept.gemini3ImageSize
      });

      const modelValidation = await validateRequestedModel(model, concept.availableModels as string[] | null | undefined);
      if (!modelValidation.isValid && modelValidation.error) {
        console.log(`❌ [모델 검증 실패] ${modelValidation.error.requestedModel}는 지원되지 않는 모델입니다`);
        return res.status(400).json({
          error: modelValidation.error.message,
          requestedModel: modelValidation.error.requestedModel,
          allowedModels: modelValidation.error.allowedModels
        });
      }

      finalModel = await resolveAiModel(model, concept.availableModels as string[] | null | undefined);
      console.log(`✅ [AI 모델 결정] 최종 선택된 모델: ${finalModel} (요청: ${model || 'none'})`);

      if (concept.systemPrompt && concept.systemPrompt.trim() !== '') {
        console.log(`🎯 [시스템 프롬프트] 적용:`, concept.systemPrompt.substring(0, 100) + "...");
        systemPrompt = concept.systemPrompt;

        if (parsedVariables && Object.keys(parsedVariables).length > 0) {
          console.log(`🔄 [변수 치환] 시스템 프롬프트에 변수 적용 중...`);
          systemPrompt = applyTemplateVariables(systemPrompt, parsedVariables);
        }
      }

      if (concept.promptTemplate && concept.promptTemplate.trim() !== '') {
        console.log(`🎯 [프롬프트 템플릿] 적용:`, concept.promptTemplate.substring(0, 100) + "...");

        if (isMultiImageMode && imageMappings.length > 0) {
          console.log(`🔄 [다중 이미지 프롬프트] buildPromptWithImageMappings 사용`);
          prompt = buildPromptWithImageMappings({
            template: concept.promptTemplate,
            systemPrompt: concept.systemPrompt || undefined,
            variables: parsedVariables
          }, imageMappings);
          systemPrompt = null;
        } else {
          prompt = concept.promptTemplate;
          if (parsedVariables && Object.keys(parsedVariables).length > 0) {
            console.log(`🔄 [변수 치환] 프롬프트 템플릿에 변수 적용 중...`);
            prompt = applyTemplateVariables(prompt, parsedVariables);
          }
        }
      }
    } else {
      console.log(`❌ [컨셉 미발견] ${style} 컨셉을 찾을 수 없습니다.`);
      finalModel = await resolveAiModel(model, null);
      console.log(`✅ [AI 모델 결정] 기본 모델 사용: ${finalModel} (요청: ${model || 'none'})`);
    }

    // 최종 프롬프트 디버깅 - 치환되지 않은 플레이스홀더 검사 (개발 환경에서만)
    if (isDev) {
      const unsubstitutedImagePlaceholders = prompt.match(/\[IMAGE_\d+\]/g) || [];
      const unsubstitutedTextPlaceholders = prompt.match(/\[TEXT_\d+\]/g) || [];

      if (unsubstitutedImagePlaceholders.length > 0 || unsubstitutedTextPlaceholders.length > 0) {
        console.warn(`⚠️ [프롬프트 경고] 치환되지 않은 플레이스홀더 발견!`);
        console.warn(`   - IMAGE 플레이스홀더: ${unsubstitutedImagePlaceholders.join(', ') || '없음'}`);
        console.warn(`   - TEXT 플레이스홀더: ${unsubstitutedTextPlaceholders.join(', ') || '없음'}`);
        console.warn(`   - 조건 확인: isMultiImageMode=${isMultiImageMode}, imageMappings.length=${imageMappings.length}`);
      }

      console.log("🎨 [이미지 생성] 최종 프롬프트 (500자):", prompt.substring(0, 500) + (prompt.length > 500 ? "..." : ""));
      console.log("📏 [프롬프트 길이]", prompt.length, "자");
      if (systemPrompt) {
        console.log("🔧 [시스템 프롬프트] 전달됨:", systemPrompt.substring(0, 100) + "...");
      }
    }

    // 🔒 영구 로그 - 프롬프트 정보
    logPromptInfo(prompt, imageMappings);

    let imageBuffer: Buffer | undefined;
    let imageBuffers: Buffer[] = [];

    const modeDecision = decideGenerationMode({
      concept,
      modelKey: finalModel,
      referenceImageCount: referenceImages.length,
    });
    const isTextOnlyGeneration = modeDecision.isTextOnly;
    console.log("📝 [이미지 생성 모드]", {
      generationType: modeDecision.generationType,
      requiresImageUpload: modeDecision.requiresImageUpload,
      isTextOnlyGeneration,
      referenceImageCount: referenceImages.length,
      referenceImageSources: referenceSummary.sources,
      modeLabel: isTextOnlyGeneration
        ? "텍스트 전용 생성"
        : (isMultiImageMode ? `다중 이미지 변환 (${referenceImages.length}개)` : "단일 이미지 변환"),
    });

    if (modeDecision.error) {
      console.error("❌ [이미지 생성 모드 검증 실패]", modeDecision.error);
      return res.status(400).json({
        success: false,
        message: modeDecision.error
      });
    }

    // 표준화된 참조 이미지 버퍼 사용: Firebase URL과 Multer 파일을 동일하게 처리
    if (referenceImages.length > 0) {
      imageBuffers = referenceImages.map((image) => image.buffer);
      imageBuffer = imageBuffers[0];
      console.log("✅ [참조 이미지] 버퍼 준비 완료", {
        count: imageBuffers.length,
        sources: referenceSummary.sources,
        primarySize: imageBuffer.length,
      });
    } else {
      console.log("📝 [텍스트 전용 생성] 파일 없이 텍스트로만 이미지를 생성합니다");

      // 레퍼런스 이미지 다운로드
      if (finalModel === "gemini_3" && concept?.referenceImageUrl) {
        console.log("🖼️ [레퍼런스 이미지] 다운로드 시작:", concept.referenceImageUrl);
        try {
          const imageResponse = await fetch(concept.referenceImageUrl);
          if (!imageResponse.ok) {
            throw new Error(`레퍼런스 이미지 다운로드 실패: ${imageResponse.status}`);
          }
          imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          console.log("✅ [레퍼런스 이미지] 다운로드 완료:", imageBuffer.length, 'bytes');
        } catch (refError) {
          console.error("❌ [레퍼런스 이미지] 다운로드 실패:", refError);
          console.log("ℹ️ [텍스트 전용 생성] 레퍼런스 없이 생성 API로 진행합니다");
        }
      } else {
        console.log("ℹ️ [텍스트 전용 생성] 빈 캔버스 없이 생성 API로 진행합니다");
      }
    }

    let transformedImageUrl: string;
    let downloadedImageBuffer: Buffer | undefined;

    const effectiveImageBuffers = isMultiImageMode ? imageBuffers : (imageBuffer ? [imageBuffer] : []);
    console.log(`🖼️ [AI 호출 준비] ${effectiveImageBuffers.length}개 이미지 버퍼 준비됨`);

    // 🔒 영구 로그 - AI 호출 준비
    logAiCall(finalModel, effectiveImageBuffers.length);

    const generationResult = await generateImageWithConfiguredModel({
      modelKey: finalModel,
      prompt,
      concept,
      imageBuffer: isTextOnlyGeneration && finalModel.startsWith("openai_") ? null : imageBuffer,
      imageBuffers: isMultiImageMode ? effectiveImageBuffers : undefined,
      systemPrompt: normalizeOptionalString(systemPrompt),
      variables: parsedVariables,
      aspectRatio,
      isTextOnly: isTextOnlyGeneration,
      generationType: modeDecision.generationType,
    });
    transformedImageUrl = generationResult.imageUrl;
    console.log(`✅ [이미지 변환] ${finalModel} 변환 결과:`, {
      imageUrl: transformedImageUrl,
      apiModel: generationResult.apiModel,
      elapsedMs: generationResult.elapsedMs,
    });

    if (!transformedImageUrl || transformedImageUrl.includes('placehold.co')) {
      console.error("🚨 이미지 변환 실패");
      return res.status(500).json({
        success: false,
        message: "이미지 변환 중 오류가 발생했습니다."
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePath = `${year}/${month}/${day}`;

    let savedImageUrl: string;
    let savedThumbnailUrl: string;
    const userIdString = String(userId);

    const isGeminiModel = finalModel?.toLowerCase() === "gemini_3_1" || finalModel?.toLowerCase() === "gemini_3";
    if (isGeminiModel && transformedImageUrl.startsWith('/uploads/')) {
      console.log(`✅ [${finalModel}] 로컬 이미지 경로 사용:`, transformedImageUrl);

      const localPath = pathModule.join(process.cwd(), 'public', transformedImageUrl.substring(1));
      downloadedImageBuffer = await fsModule.promises.readFile(localPath);

      const uuid = uuidv4();
      const filename = `${uuid}.webp`;

      const gcsResult = await saveImageToGCS(downloadedImageBuffer, userIdString, categoryId, filename);
      savedImageUrl = gcsResult.originalUrl;
      savedThumbnailUrl = gcsResult.thumbnailUrl;

      // 로컬 파일 삭제 (보안 및 저장소 관리)
      try {
        await fsModule.promises.unlink(localPath);
        console.log(`🗑️ [${finalModel}] 로컬 임시 파일 삭제 완료:`, localPath);
      } catch (unlinkError) {
        console.warn(`⚠️ [${finalModel}] 로컬 파일 삭제 실패 (무시):`, unlinkError);
      }
    } else {
      console.log("🔽 [OpenAI] 이미지 다운로드 시작:", transformedImageUrl);

      const uuid = uuidv4();
      const filename = `${uuid}.webp`;
      const thumbnailFilename = `${uuid}_thumb.webp`;

      const fullDir = pathModule.join(process.cwd(), 'uploads', 'full', datePath);
      const thumbnailDir = pathModule.join(process.cwd(), 'uploads', 'thumbnails', datePath);

      await fsModule.promises.mkdir(fullDir, { recursive: true });
      await fsModule.promises.mkdir(thumbnailDir, { recursive: true });

      const imageResponse = await fetch(transformedImageUrl);
      downloadedImageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      const fullPath = pathModule.join(fullDir, filename);
      await sharp(downloadedImageBuffer)
        .webp({ quality: 85 })
        .toFile(fullPath);

      const thumbnailPath = pathModule.join(thumbnailDir, thumbnailFilename);
      const thumbnailBuffer = await sharp(downloadedImageBuffer)
        .resize(300, 300, { fit: 'cover' })
        .webp({ quality: 75 })
        .toBuffer();

      const gcsResult = await saveImageToGCS(downloadedImageBuffer, userId, categoryId, filename);
      savedImageUrl = gcsResult.originalUrl;
      savedThumbnailUrl = gcsResult.thumbnailUrl;
    }

    console.log("✅ [GCS 업로드] 완료:", savedImageUrl);

    // 📐 이미지 크기 및 DPI 정보 추출
    let imageWidth: number | undefined;
    let imageHeight: number | undefined;
    let imageDpi: number | undefined;

    if (downloadedImageBuffer) {
      try {
        const imageMeta = await sharp(downloadedImageBuffer).metadata();
        imageWidth = imageMeta.width;
        imageHeight = imageMeta.height;
        imageDpi = imageMeta.density; // DPI 정보 (없으면 undefined)
        console.log(`📐 [이미지 메타데이터] 크기: ${imageWidth}x${imageHeight}, DPI: ${imageDpi || '없음'}`);
      } catch (metaError) {
        console.warn(`⚠️ [이미지 메타데이터] 추출 실패:`, metaError);
      }
    }

    // 🔥 배경제거 적용 (컨셉에서 활성화된 경우)
    let finalImageUrl = savedImageUrl;
    let finalThumbnailUrl = savedThumbnailUrl;
    let bgRemovalApplied = false;

    if (concept?.bgRemovalEnabled) {
      console.log(`🔧 [배경제거] 컨셉에서 배경제거 활성화됨 - 타입: ${concept.bgRemovalType || 'foreground'}`);
      try {
        const { removeBackgroundFromBuffer } = await import('../services/backgroundRemoval');
        const bgRemovalOptions = {
          type: (concept.bgRemovalType as 'foreground' | 'background') || 'foreground'
        };

        // 다운로드된 이미지 버퍼 사용 (이미 있음)
        if (downloadedImageBuffer) {
          const bgResult = await removeBackgroundFromBuffer(
            downloadedImageBuffer,
            userId,
            bgRemovalOptions
          );
          finalImageUrl = bgResult.url;
          bgRemovalApplied = true;
          console.log(`✅ [배경제거] 완료 - 결과: ${finalImageUrl}`);
        } else {
          console.warn(`⚠️ [배경제거] 이미지 버퍼 없음 - 건너뜀`);
        }
      } catch (bgError) {
        console.error(`❌ [배경제거] 실패 (원본 이미지 사용):`, bgError);
        // 배경제거 실패시 원본 사용
      }
    }

    const imageTitle = await generateImageTitle(categoryId, style, String(userId));

    const [savedImage] = await db.insert(images).values({
      title: imageTitle,
      style: style,
      originalUrl: savedImageUrl,
      transformedUrl: bgRemovalApplied ? finalImageUrl : savedImageUrl,
      thumbnailUrl: finalThumbnailUrl,
      userId: String(userId),
      categoryId: categoryId,
      conceptId: style,
      width: imageWidth,
      height: imageHeight,
      dpi: imageDpi,
      metadata: JSON.stringify({
        prompt,
        variables: parsedVariables,
        categoryId: categoryId,
        conceptId: style,
        model: finalModel,
        generationType: modeDecision.generationType,
        generationMode: isTextOnlyGeneration ? "text_only" : "image_to_image",
        referenceImageCount: referenceImages.length,
        referenceImageSources: referenceSummary.sources,
        bgRemovalApplied,
        bgRemovalType: bgRemovalApplied ? concept?.bgRemovalType : undefined
      })
    }).returning();

    // INSERT 후 imageId를 포함한 최종 제목으로 UPDATE
    const finalImageTitle = appendImageIdToTitle(imageTitle, savedImage.id);
    await db.update(images)
      .set({ title: finalImageTitle })
      .where(eq(images.id, savedImage.id));

    console.log("✅ [이미지 저장] DB 저장 완료 (GCS URL):", savedImage.id, "최종 제목:", finalImageTitle);

    // 🔒 영구 로그 - 성공
    logImageGenResult(true, savedImage.transformedUrl || savedImage.originalUrl);

    return res.json({
      success: true,
      message: "이미지가 성공적으로 생성되었습니다.",
      image: {
        id: savedImage.id,
        title: finalImageTitle,
        style: savedImage.style,
        originalUrl: savedImage.originalUrl,
        transformedUrl: savedImage.transformedUrl,
        thumbnailUrl: savedImage.thumbnailUrl,
        isTemporary: false,
        dbImageId: savedImage.id
      }
    });

  } catch (error) {
    console.error("❌ [이미지 생성] 전체 에러:", error);

    // 🔒 영구 로그 - 실패
    logImageGenResult(false, undefined, error instanceof Error ? error.message : String(error));

    return res.status(500).json({
      error: "이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// 2. POST /generate-family - 가족사진 생성
router.post("/generate-family", requireAuth, requirePremiumAccess, requireActiveHospital(), uploadFields, processFirebaseImageUrls, async (req, res) => { // 🔥 미들웨어 추가!
  console.log("🚀 [가족사진 생성] API 호출 시작");

  try {
    // 🔥 파일 확인: uploadFields 사용 시 req.files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const singleImage = files?.image?.[0];
    const downloadedBuffers = req.downloadedBuffers || [];

    if (!singleImage && downloadedBuffers.length === 0) {
      console.log("❌ [가족사진 생성] 파일이 업로드되지 않음");
      return res.status(400).json({ error: "이미지 파일을 업로드해주세요" });
    }

    console.log(`📁 [가족사진] 파일 확인 - 업로드: ${singleImage ? singleImage.originalname : '없음'}${downloadedBuffers.length > 0 ? `, Firebase: ${downloadedBuffers.length}개` : ''}`);

    const requestBodySchema = z.object({
      style: z.string().min(1, "스타일을 선택해주세요"),
      variables: z.union([z.string(), z.object({}).passthrough()]).optional(),
      model: z.string().optional(),
      aspectRatio: z.string().optional()
    });

    let parsedBody;
    try {
      parsedBody = requestBodySchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.log("❌ [가족사진 생성] 파라미터 검증 실패:", validationError.errors);
        return res.status(400).json({
          error: "요청 파라미터가 올바르지 않습니다",
          details: validationError.errors
        });
      }
      throw validationError;
    }

    const { style, variables, model, aspectRatio } = parsedBody;

    let parsedVariables: Record<string, any> = {};
    if (variables) {
      try {
        if (typeof variables === "string") {
          parsedVariables = JSON.parse(variables);
        } else if (typeof variables === "object") {
          parsedVariables = variables;
        }
      } catch (error) {
        console.warn("⚠️ variables 파싱 실패:", error);
      }
    }

    let prompt = "A beautiful family portrait with professional lighting and artistic styling";
    let systemPrompt: string | null = null;
    let finalModel: string;

    console.log(`🔍 [컨셉 조회] ${style} 컨셉 검색 중...`);

    const concept = await db.query.concepts.findFirst({
      where: eq(concepts.conceptId, style)
    });

    if (concept) {
      console.log(`📋 [컨셉 발견] ${style} 컨셉 정보:`, {
        title: concept.title,
        availableModels: concept.availableModels
      });

      const modelValidation = await validateRequestedModel(model, concept.availableModels as string[] | null | undefined);
      if (!modelValidation.isValid && modelValidation.error) {
        console.log(`❌ [모델 검증 실패] ${modelValidation.error.requestedModel}는 지원되지 않는 모델입니다`);
        return res.status(400).json({
          error: modelValidation.error.message,
          requestedModel: modelValidation.error.requestedModel,
          allowedModels: modelValidation.error.allowedModels
        });
      }

      finalModel = await resolveAiModel(model, concept.availableModels as string[] | null | undefined);
      console.log(`✅ [AI 모델 결정] 최종 선택된 모델: ${finalModel} (요청: ${model || 'none'})`);

      if (concept.systemPrompt && concept.systemPrompt.trim() !== '') {
        systemPrompt = concept.systemPrompt;
        console.log(`🔧 [시스템프롬프트] ${style} 컨셉 시스템프롬프트 사용:`, systemPrompt.substring(0, 100) + "...");
      }

      if (concept.promptTemplate && concept.promptTemplate.trim() !== '') {
        prompt = concept.promptTemplate;
        console.log(`🎯 [프롬프트템플릿] ${style} 컨셉 프롬프트 템플릿 사용:`, prompt);

        if (parsedVariables && Object.keys(parsedVariables).length > 0) {
          console.log(`🔄 [변수 치환] 프롬프트 템플릿에 변수 적용 중...`);
          prompt = applyTemplateVariables(prompt, parsedVariables);
        }
      }
    } else {
      console.log(`❌ [컨셉 미발견] ${style} 컨셉을 찾을 수 없습니다.`);
      finalModel = await resolveAiModel(model, null);
      console.log(`✅ [AI 모델 결정] 기본 모델 사용: ${finalModel} (요청: ${model || 'none'})`);
    }

    console.log("🎨 [가족사진 생성] 최종 프롬프트:", prompt);
    if (systemPrompt) {
      console.log("🔧 [시스템 프롬프트] 전달됨:", systemPrompt.substring(0, 100) + "...");
    }

    let imageBuffer: Buffer;

    // 🔥 Firebase 다운로드 버퍼 우선 사용
    if (downloadedBuffers.length > 0) {
      imageBuffer = downloadedBuffers[0];
      console.log("🔥 [Firebase 다운로드] Firebase에서 다운로드한 이미지 사용:", imageBuffer.length, 'bytes');
    } else if (singleImage?.buffer && singleImage.buffer.length > 0) {
      imageBuffer = singleImage.buffer;
      console.log("📁 [메모리 기반] 메모리 버퍼 파일 처리:", imageBuffer.length, 'bytes');
    } else if (singleImage?.path) {
      try {
        imageBuffer = await fs.promises.readFile(singleImage.path);
        console.log("📁 [디스크 기반] 디스크 파일 처리:", imageBuffer.length, 'bytes');
      } finally {
        try {
          await fs.promises.unlink(singleImage.path);
        } catch (unlinkError) {
          console.warn("⚠️ 임시 파일 삭제 실패:", unlinkError);
        }
      }
    } else {
      console.error("❌ 파일 버퍼와 경로 모두 없음");
      return res.status(500).json({
        success: false,
        message: "업로드된 파일을 처리할 수 없습니다."
      });
    }

    let transformedImageUrl: string;

    const generationResult = await generateImageWithConfiguredModel({
      modelKey: finalModel,
      prompt,
      concept,
      imageBuffer,
      systemPrompt: normalizeOptionalString(systemPrompt),
      variables: parsedVariables,
      aspectRatio,
      isTextOnly: false,
    });
    transformedImageUrl = generationResult.imageUrl;
    console.log(`✅ [가족사진 생성] ${finalModel} 변환 결과:`, {
      imageUrl: transformedImageUrl,
      apiModel: generationResult.apiModel,
      elapsedMs: generationResult.elapsedMs,
    });

    if (!transformedImageUrl || transformedImageUrl.includes('placehold.co')) {
      console.error("🚨 이미지 변환 실패");
      return res.status(500).json({
        success: false,
        message: "이미지 변환 중 오류가 발생했습니다."
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePath = `${year}/${month}/${day}`;

    let downloadedImageBuffer: Buffer | null = null;
    let savedImageUrl: string;
    let savedThumbnailUrl: string;
    let gcsResult: any;

    const uid2 = validateUserId(req, res);
    if (!uid2) return;
    const familyUserId = String(uid2);

    const isFamilyGeminiModel = finalModel?.toLowerCase() === "gemini_3_1" || finalModel?.toLowerCase() === "gemini_3";
    if (isFamilyGeminiModel && transformedImageUrl.startsWith('/uploads/')) {
      console.log(`✅ [${finalModel}] 로컬 이미지 경로 사용:`, transformedImageUrl);

      const normalizedPath = transformedImageUrl.startsWith('/')
        ? transformedImageUrl.substring(1)
        : transformedImageUrl;
      const localFilePath = path.join(process.cwd(), 'public', normalizedPath);

      downloadedImageBuffer = await fs.promises.readFile(localFilePath);

      const uuid = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const filename = `${uuid}.webp`;

      gcsResult = await saveImageToGCS(
        downloadedImageBuffer,
        familyUserId,
        'family_img',
        `family_${style}_generated`
      );
      savedImageUrl = gcsResult.originalUrl;
      savedThumbnailUrl = gcsResult.thumbnailUrl;

      // 로컬 파일 삭제 (보안 및 저장소 관리)
      try {
        await fs.promises.unlink(localFilePath);
        console.log(`🗑️ [${finalModel}] 로컬 임시 파일 삭제 완료:`, localFilePath);
      } catch (unlinkError) {
        console.warn(`⚠️ [${finalModel}] 로컬 파일 삭제 실패 (무시):`, unlinkError);
      }
    } else {
      console.log("🌐 [OpenAI] URL에서 GCS 업로드:", transformedImageUrl);

      // OpenAI URL에서 이미지 다운로드하여 버퍼 저장 (배경제거용)
      try {
        const imageResponse = await fetch(transformedImageUrl);
        downloadedImageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      } catch (downloadError) {
        console.warn("⚠️ [가족사진] 이미지 다운로드 실패:", downloadError);
      }

      gcsResult = await saveImageFromUrlToGCS(
        transformedImageUrl,
        familyUserId,
        'family_img',
        `family_${style}_generated`
      );
      savedImageUrl = gcsResult.originalUrl;
      savedThumbnailUrl = gcsResult.thumbnailUrl;
    }

    console.log("✅ [가족사진 GCS 업로드] 완료:", savedImageUrl);

    // 📐 이미지 크기 및 DPI 정보 추출
    let imageWidth: number | undefined;
    let imageHeight: number | undefined;
    let imageDpi: number | undefined;

    if (downloadedImageBuffer) {
      try {
        const sharpModule = (await import('sharp')).default;
        const imageMeta = await sharpModule(downloadedImageBuffer).metadata();
        imageWidth = imageMeta.width;
        imageHeight = imageMeta.height;
        imageDpi = imageMeta.density;
        console.log(`📐 [가족사진 메타데이터] 크기: ${imageWidth}x${imageHeight}, DPI: ${imageDpi || '없음'}`);
      } catch (metaError) {
        console.warn(`⚠️ [가족사진 메타데이터] 추출 실패:`, metaError);
      }
    }

    // 🔥 배경제거 적용 (컨셉에서 활성화된 경우)
    let finalImageUrl = savedImageUrl;
    let finalThumbnailUrl = savedThumbnailUrl;
    let bgRemovalApplied = false;

    if (concept?.bgRemovalEnabled) {
      console.log(`🔧 [배경제거] 컨셉에서 배경제거 활성화됨 - 타입: ${concept.bgRemovalType || 'foreground'}`);
      try {
        const { removeBackgroundFromBuffer } = await import('../services/backgroundRemoval');
        const bgRemovalOptions = {
          type: (concept.bgRemovalType as 'foreground' | 'background') || 'foreground'
        };

        // 다운로드된 이미지 버퍼 사용
        if (downloadedImageBuffer) {
          const bgResult = await removeBackgroundFromBuffer(
            downloadedImageBuffer,
            familyUserId,
            bgRemovalOptions
          );
          finalImageUrl = bgResult.url;
          bgRemovalApplied = true;
          console.log(`✅ [배경제거] 완료 - 결과: ${finalImageUrl}`);
        } else {
          console.warn(`⚠️ [배경제거] 이미지 버퍼 없음 - 건너뜀`);
        }
      } catch (bgError) {
        console.error(`❌ [배경제거] 실패 (원본 이미지 사용):`, bgError);
        // 배경제거 실패시 원본 사용
      }
    }

    const familyImageTitle = await generateImageTitle('family_img', style, familyUserId);

    const [savedImage] = await db.insert(images).values({
      title: familyImageTitle,
      transformedUrl: bgRemovalApplied ? finalImageUrl : savedImageUrl,
      originalUrl: savedImageUrl,
      thumbnailUrl: finalThumbnailUrl,
      userId: familyUserId,
      categoryId: "family_img",
      conceptId: style,
      width: imageWidth,
      height: imageHeight,
      dpi: imageDpi,
      metadata: JSON.stringify({
        prompt,
        variables: parsedVariables,
        categoryId: "family_img",
        conceptId: style,
        model: finalModel,
        gsPath: gcsResult.gsPath,
        gsThumbnailPath: gcsResult.gsThumbnailPath,
        fileName: gcsResult.fileName,
        storageType: "gcs",
        bgRemovalApplied,
        bgRemovalType: bgRemovalApplied ? concept?.bgRemovalType : undefined
      }),
      style: style
    }).returning();

    // INSERT 후 imageId를 포함한 최종 제목으로 UPDATE
    const finalFamilyImageTitle = appendImageIdToTitle(familyImageTitle, savedImage.id);
    await db.update(images)
      .set({ title: finalFamilyImageTitle })
      .where(eq(images.id, savedImage.id));

    console.log("✅ [가족사진 저장] DB 저장 완료:", savedImage.id, "최종 제목:", finalFamilyImageTitle);

    return res.status(200).json({
      id: savedImage.id,
      title: finalFamilyImageTitle,
      transformedUrl: savedImage.transformedUrl,
      originalUrl: savedImage.originalUrl,
      style: savedImage.style,
      prompt: prompt,
      createdAt: savedImage.createdAt,
      categoryId: savedImage.categoryId
    });

  } catch (error) {
    console.error("❌ [가족사진 생성] 전체 에러:", error);
    return res.status(500).json({
      error: "가족사진 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// 3. POST /generate-stickers - 스티커 생성
router.post("/generate-stickers", requireAuth, requirePremiumAccess, requireActiveHospital(), uploadFields, processFirebaseImageUrls, async (req, res) => { // 🔥 미들웨어 추가!
  // 🔒 [영구 로그] API 진입 즉시 기록 - 이 로그가 없으면 API 자체가 호출되지 않은 것
  persistentLog('========================================');
  persistentLog('🚀 [스티커 생성 API] 진입', {
    timestamp: new Date().toISOString(),
    bodyKeys: Object.keys(req.body || {}),
    filesKeys: req.files ? Object.keys(req.files) : [],
    hasImageTexts: !!req.body?.imageTexts,
    imageTextsRaw: req.body?.imageTexts ? String(req.body.imageTexts).substring(0, 200) : '없음'
  });
  console.log("🚀 [스티커 생성] API 호출 시작");

  try {
    // 🔥 Safe JSON 유틸리티 import
    const { safeJsonParseObject } = await import('../utils/safe-json');

    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);

    if (!userId) {
      console.log("❌ [스티커 생성] 사용자 ID 누락");
      return res.status(400).json({ error: "사용자 인증 정보가 올바르지 않습니다" });
    }

    console.log(`👤 [스티커 생성] 사용자 ID: ${userId}`);

    const requestBodySchema = z.object({
      style: z.string().min(1, "스타일을 선택해주세요"),
      variables: z.union([z.string(), z.object({}).passthrough()]).optional(),
      model: z.string().optional(),
      aspectRatio: z.string().optional(),
      imageTexts: z.union([z.string(), z.array(z.string())]).optional()  // imageUrls는 검증 스킵 (미들웨어가 처리)
    });

    let parsedBody;
    try {
      parsedBody = requestBodySchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.log("❌ [스티커 생성] 파라미터 검증 실패:", validationError.errors);
        return res.status(400).json({
          error: "요청 파라미터가 올바르지 않습니다",
          details: validationError.errors
        });
      }
      throw validationError;
    }

    const { style, variables, model, aspectRatio, imageTexts } = parsedBody;

    console.log(`🔍 [컨셉 조회] ${style} 컨셉 검색 중...`);

    const concept = await db.query.concepts.findFirst({
      where: eq(concepts.conceptId, style)
    });

    if (!concept) {
      console.log("❌ [스티커 생성] 컨셉을 찾을 수 없음");
      return res.status(400).json({ error: "선택한 스타일을 찾을 수 없습니다" });
    }

    const generationType = concept.generationType || "image_upload";
    const requiresImageUpload = generationType === "image_upload";

    console.log(`📋 [컨셉 발견] ${style} 컨셉 정보:`, {
      title: concept.title,
      generationType: generationType,
      requiresImageUpload: requiresImageUpload,
      availableModels: concept.availableModels,
      bgRemovalEnabled: concept.bgRemovalEnabled,
      bgRemovalType: concept.bgRemovalType
    });

    const modelValidation = await validateRequestedModel(model, concept.availableModels as string[] | null | undefined);
    if (!modelValidation.isValid && modelValidation.error) {
      console.log(`❌ [모델 검증 실패] ${modelValidation.error.requestedModel}는 지원되지 않는 모델입니다`);
      return res.status(400).json({
        error: modelValidation.error.message,
        requestedModel: modelValidation.error.requestedModel,
        allowedModels: modelValidation.error.allowedModels
      });
    }

    const finalModel = await resolveAiModel(model, concept.availableModels as string[] | null | undefined);
    console.log(`✅ [AI 모델 결정] 최종 선택된 모델: ${finalModel} (요청: ${model || 'none'})`);

    // 🔥 미들웨어가 처리한 downloadedBuffers 사용
    const downloadedBuffers = req.downloadedBuffers || [];

    // 다중 이미지 및 단일 이미지 모두 지원
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const singleImage = files?.image?.[0];
    const multipleImages = files?.images || [];
    const hasAnyImage = singleImage || multipleImages.length > 0 || downloadedBuffers.length > 0;

    if (requiresImageUpload && !hasAnyImage) {
      console.log("❌ [스티커 생성] 이미지 업로드가 필요한 컨셉인데 파일이 업로드되지 않음");
      return res.status(400).json({ error: "이미지 파일을 업로드해주세요" });
    }

    // 다중 이미지 모드 판단
    const isMultiImageMode = multipleImages.length > 1;

    // 🔒 [영구 로그] 파일 업로드 상세 정보
    persistentLog('📁 [파일 업로드 정보]', {
      singleImage: singleImage ? { name: singleImage.originalname, size: singleImage.size } : null,
      multipleImagesCount: multipleImages.length,
      multipleImagesDetails: multipleImages.map((f, i) => ({ index: i, name: f.originalname, size: f.size })),
      isMultiImageMode,
      style,
      imageTextsReceived: imageTexts ? String(imageTexts).substring(0, 300) : '없음'
    });

    console.log("📝 [스티커 생성] 요청 정보:");
    console.log("- 파일:", singleImage?.filename || (multipleImages.length > 0 ? `다중 이미지 ${multipleImages.length}개` : "없음 (텍스트 전용)"));
    console.log("- 스타일:", style);
    console.log("- 변수:", variables);
    console.log("- 이미지 텍스트:", imageTexts);
    console.log("- 생성 방식:", generationType);
    console.log("- 다중 이미지 모드:", isMultiImageMode);

    const fsModule = await import('fs');
    const fetch = (await import('node-fetch')).default;

    let parsedVariables: Record<string, string> = {};
    if (variables) {
      try {
        parsedVariables = typeof variables === 'string' ? JSON.parse(variables) : variables;
        console.log("✅ [스티커 생성] 변수 파싱 성공:", parsedVariables);
      } catch (e) {
        console.log("⚠️ [스티커 생성] 변수 파싱 실패, 기본값 사용");
      }
    }

    // imageTexts 파싱
    const isDev = process.env.NODE_ENV !== 'production';
    let parsedImageTexts: string[] = [];
    if (imageTexts) {
      try {
        parsedImageTexts = typeof imageTexts === 'string' ? JSON.parse(imageTexts) : imageTexts;
        // 🔒 [영구 로그] imageTexts 파싱 성공
        persistentLog('✅ [imageTexts 파싱 성공]', {
          count: parsedImageTexts.length,
          texts: parsedImageTexts.map((t, i) => `[${i}] "${t?.substring(0, 50) || '(빈값)'}"`),
          rawType: typeof imageTexts
        });
        if (isDev) console.log(`✅ [스티커 이미지 텍스트] ${parsedImageTexts.length}개 파싱 성공:`, JSON.stringify(parsedImageTexts, null, 2));
      } catch (e) {
        // 🔒 [영구 로그] imageTexts 파싱 실패
        persistentLog('❌ [imageTexts 파싱 실패]', {
          error: String(e),
          rawValue: String(imageTexts).substring(0, 200),
          rawType: typeof imageTexts
        });
        if (isDev) console.log("⚠️ [스티커 이미지 텍스트] 파싱 실패, 빈 배열 사용. 원본:", imageTexts);
      }
    } else {
      // 🔒 [영구 로그] imageTexts 미전송
      persistentLog('⚠️ [imageTexts 미전송]', { bodyKeys: Object.keys(req.body || {}) });
      if (isDev) console.log("ℹ️ [스티커 이미지 텍스트] 텍스트가 전송되지 않음");
    }

    // 🔒 영구 로그 시작 (파싱 완료 후)
    logImageGenStart(String(userId), style, multipleImages.length || (singleImage ? 1 : 0), parsedImageTexts.length > 0);

    // imageMappings 배열 생성
    let imageMappings: ImageTextMapping[] = [];
    if (isMultiImageMode) {
      if (isDev) console.log(`🔍 [스티커 다중 이미지 매핑] 생성 시작 - 파일 ${multipleImages.length}개, 텍스트 ${parsedImageTexts.length}개`);
      imageMappings = multipleImages.map((file, index) => ({
        imageIndex: index + 1,
        imageUrl: `[업로드된 이미지 ${index + 1}]`,
        text: parsedImageTexts[index] || ''
      }));
      // 🔒 [영구 로그] imageMappings 생성 결과
      persistentLog('🗺️ [imageMappings 생성 완료]', {
        count: imageMappings.length,
        mappings: imageMappings.map(m => ({
          imageIndex: m.imageIndex,
          imageUrl: m.imageUrl,
          text: m.text ? `"${m.text.substring(0, 50)}"` : '(빈값)'
        }))
      });
      if (isDev) {
        console.log(`🗺️ [스티커 이미지 매핑] ${imageMappings.length}개 생성됨:`);
        imageMappings.forEach((m, i) => {
          console.log(`   - [${i}] imageIndex: ${m.imageIndex}, text: "${m.text?.substring(0, 30) || '(없음)'}..."`);
        });
      }
    } else {
      // 🔒 [영구 로그] 다중 이미지 모드 아님
      persistentLog('ℹ️ [다중 이미지 모드 비활성]', {
        multipleImagesLength: multipleImages.length,
        condition: 'multipleImages.length > 1',
        result: isMultiImageMode
      });
      if (isDev) console.log("ℹ️ [스티커 이미지 매핑] 다중 이미지 모드 아님 - 매핑 생성 건너뜀");
    }

    let prompt = "A beautiful sticker-style character with clean lines and vibrant colors";
    let systemPrompt: string | null = null;

    console.log(`📋 [컨셉 발견] ${style} 컨셉 정보:`, {
      title: concept.title,
      hasSystemPrompt: !!(concept.systemPrompt && concept.systemPrompt.trim()),
      hasPromptTemplate: !!(concept.promptTemplate && concept.promptTemplate.trim())
    });

    if (concept.systemPrompt && concept.systemPrompt.trim() !== '') {
      console.log(`🎯 [시스템 프롬프트] 적용:`, concept.systemPrompt.substring(0, 100) + "...");
      systemPrompt = concept.systemPrompt;

      if (parsedVariables && Object.keys(parsedVariables).length > 0) {
        console.log(`🔄 [변수 치환] 시스템 프롬프트에 변수 적용 중...`);
        systemPrompt = applyTemplateVariables(systemPrompt, parsedVariables);
      }
    }

    if (concept.promptTemplate && concept.promptTemplate.trim() !== '') {
      console.log(`🎯 [프롬프트 템플릿] 적용:`, concept.promptTemplate.substring(0, 100) + "...");

      // 다중 이미지 모드일 때 buildPromptWithImageMappings 사용
      if (isMultiImageMode && imageMappings.length > 0) {
        console.log(`🔄 [스티커 다중 이미지 프롬프트] buildPromptWithImageMappings 사용`);
        // 🔒 [영구 로그] buildPromptWithImageMappings 호출 전
        persistentLog('🔄 [buildPromptWithImageMappings 호출 전]', {
          templateLength: concept.promptTemplate.length,
          templatePreview: concept.promptTemplate.substring(0, 200),
          imageMappingsCount: imageMappings.length,
          hasSystemPrompt: !!(concept.systemPrompt),
          variablesCount: Object.keys(parsedVariables).length
        });

        prompt = buildPromptWithImageMappings({
          template: concept.promptTemplate,
          systemPrompt: concept.systemPrompt || undefined,
          variables: parsedVariables
        }, imageMappings);

        // 🔒 [영구 로그] buildPromptWithImageMappings 호출 후
        persistentLog('✅ [buildPromptWithImageMappings 호출 후]', {
          promptLength: prompt.length,
          promptPreview: prompt.substring(0, 500),
          containsIMAGE_1: prompt.includes('[IMAGE_1]'),
          containsTEXT_1: prompt.includes('[TEXT_1]'),
          containsAttachedImage: prompt.includes('[첨부된 이미지')
        });

        // 시스템 프롬프트는 buildPromptWithImageMappings에서 통합되므로 null 처리
        systemPrompt = null;
      } else {
        // 🔒 [영구 로그] 다중 이미지 프롬프트 빌드 건너뜀
        persistentLog('ℹ️ [다중 이미지 프롬프트 빌드 건너뜀]', {
          reason: isMultiImageMode ? 'imageMappings 비어있음' : '다중 이미지 모드 아님',
          isMultiImageMode,
          imageMappingsLength: imageMappings.length
        });
        prompt = concept.promptTemplate;
        if (parsedVariables && Object.keys(parsedVariables).length > 0) {
          console.log(`🔄 [변수 치환] 프롬프트 템플릿에 변수 적용 중...`);
          prompt = applyTemplateVariables(prompt, parsedVariables);
        }
      }
    }

    console.log("🎨 [스티커 생성] 최종 프롬프트:", prompt.substring(0, 500) + (prompt.length > 500 ? "..." : ""));
    if (systemPrompt) {
      console.log("🔧 [시스템 프롬프트] 전달됨:", systemPrompt.substring(0, 100) + "...");
    }

    // 🔒 [영구 로그] 최종 프롬프트 전체
    persistentLog('🎨 [최종 프롬프트]', {
      promptLength: prompt.length,
      promptFull: prompt.length <= 2000 ? prompt : prompt.substring(0, 2000) + '... (잘림)',
      systemPrompt: systemPrompt ? systemPrompt.substring(0, 200) : null
    });

    // 🔒 영구 로그 - 프롬프트 정보 기록
    logPromptInfo(prompt, imageMappings);

    let imageBuffer: Buffer | null = null;
    let imageBuffers: Buffer[] = [];

    // 파일 버퍼 처리 헬퍼 함수
    const processFileBuffer = async (file: Express.Multer.File): Promise<Buffer> => {
      if (file.buffer && file.buffer.length > 0) {
        console.log(`📁 메모리 기반 파일 처리: ${file.originalname}, ${file.buffer.length} bytes`);
        return file.buffer;
      } else if (file.path) {
        try {
          const buffer = await fsModule.promises.readFile(file.path);
          console.log(`📁 디스크 기반 파일 처리: ${file.originalname}, ${buffer.length} bytes`);
          return buffer;
        } finally {
          try {
            await fsModule.promises.unlink(file.path);
          } catch (unlinkError) {
            console.warn("⚠️ 임시 파일 삭제 실패:", unlinkError);
          }
        }
      } else {
        throw new Error(`파일 버퍼와 경로 모두 없음: ${file.originalname}`);
      }
    };

    // 다중 이미지 또는 단일 이미지 처리
    if (isMultiImageMode) {
      console.log(`🖼️ [스티커 다중 이미지] ${multipleImages.length}개 이미지 버퍼 처리 중...`);
      for (const file of multipleImages) {
        const buffer = await processFileBuffer(file);
        imageBuffers.push(buffer);
      }
      imageBuffer = imageBuffers[0];
      console.log(`✅ [스티커 다중 이미지] ${imageBuffers.length}개 버퍼 준비 완료`);
    } else {
      const primaryImage = singleImage || multipleImages[0];

      if (primaryImage) {
        imageBuffer = await processFileBuffer(primaryImage);
        console.log("📁 스티커 생성 - 이미지 처리 완료:", imageBuffer.length, 'bytes');
      }
    }

    // 🔥 Firebase 미들웨어에서 다운로드한 버퍼 사용 (파일 업로드 없이 imageUrls만 전송한 경우)
    if (!imageBuffer && downloadedBuffers.length > 0) {
      console.log(`🔥 [Firebase 버퍼 적용] 파일 업로드 없음 → downloadedBuffers ${downloadedBuffers.length}개 사용`);
      imageBuffer = downloadedBuffers[0];
      if (downloadedBuffers.length > 1) {
        imageBuffers = downloadedBuffers;
      }
    }

    if (!imageBuffer && !requiresImageUpload && finalModel === "gemini_3" && concept.referenceImageUrl) {
      console.log("📥 [텍스트 전용] 레퍼런스 이미지 다운로드:", concept.referenceImageUrl);
      try {
        const imageResponse = await fetch(concept.referenceImageUrl);
        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}`);
        }
        imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        console.log("✅ [텍스트 전용] 레퍼런스 이미지 다운로드 성공:", imageBuffer.length, 'bytes');
      } catch (downloadError) {
        console.warn("⚠️ [텍스트 전용] 레퍼런스 이미지 다운로드 실패, 이미지 없이 생성 API로 진행:", downloadError);
      }
    } else if (!imageBuffer && !requiresImageUpload) {
      console.log("📥 [텍스트 전용] 빈 캔버스 없이 생성 API로 진행합니다");
    }

    let transformedImageUrl: string;

    // 다중 이미지 버퍼 준비
    const effectiveImageBuffers = isMultiImageMode && imageBuffers.length > 1 ? imageBuffers : (imageBuffer ? [imageBuffer] : []);
    console.log(`🖼️ [스티커 AI 호출 준비] ${effectiveImageBuffers.length}개 이미지 버퍼 준비됨`);

    // 🔒 영구 로그 - AI 호출 준비
    logAiCall(finalModel, effectiveImageBuffers.length);

    if (!imageBuffer && requiresImageUpload) {
      console.error("❌ [스티커 생성] 이미지 업로드가 필요한 스타일입니다");
      logImageGenResult(false, undefined, "이미지 업로드 필요");
      return res.status(400).json({
        error: "이미지를 업로드해주세요"
      });
    }

    const isStickerTextOnlyGeneration = !imageBuffer && !requiresImageUpload;
    const generationResult = await generateImageWithConfiguredModel({
      modelKey: finalModel,
      prompt,
      concept,
      imageBuffer: isStickerTextOnlyGeneration && finalModel.startsWith("openai_") ? null : imageBuffer,
      imageBuffers: isMultiImageMode ? effectiveImageBuffers : undefined,
      systemPrompt: normalizeOptionalString(systemPrompt),
      variables: parsedVariables,
      aspectRatio,
      isTextOnly: isStickerTextOnlyGeneration,
      generationType,
    });
    transformedImageUrl = generationResult.imageUrl;
    console.log(`✅ [스티커 생성] ${finalModel} 이미지 변환 결과:`, {
      imageUrl: transformedImageUrl,
      apiModel: generationResult.apiModel,
      elapsedMs: generationResult.elapsedMs,
    });

    if (!transformedImageUrl || transformedImageUrl.includes('placehold.co')) {
      console.error("🚨 이미지 변환 실패");
      logImageGenResult(false, undefined, "이미지 변환 실패 (placehold.co 또는 빈 URL)");
      return res.status(500).json({
        success: false,
        message: "이미지 변환 중 오류가 발생했습니다."
      });
    }

    console.log("📤 [스티커 저장] GCS 저장 시작...");

    const uid3 = validateUserId(req, res);
    if (!uid3) return;
    const stickerUserId = String(uid3);

    let imageResult;
    let downloadedStickerBuffer: Buffer | null = null;

    const isStickerGeminiModel = finalModel?.toLowerCase() === "gemini_3_1" || finalModel?.toLowerCase() === "gemini_3";
    if (isStickerGeminiModel && transformedImageUrl.startsWith('/uploads/')) {
      console.log(`✅ [${finalModel}] 로컬 파일에서 GCS 업로드:`, transformedImageUrl);

      const normalizedPath = transformedImageUrl.startsWith('/')
        ? transformedImageUrl.substring(1)
        : transformedImageUrl;
      const localFilePath = path.join(process.cwd(), 'public', normalizedPath);

      try {
        downloadedStickerBuffer = await fs.promises.readFile(localFilePath);

        imageResult = await saveImageToGCS(
          downloadedStickerBuffer,
          stickerUserId,
          'sticker_img',
          `sticker_${style}_generated`
        );

        // 로컬 파일 삭제 (보안 및 저장소 관리)
        try {
          await fs.promises.unlink(localFilePath);
          console.log(`🗑️ [${finalModel}] 로컬 임시 파일 삭제 완료:`, localFilePath);
        } catch (unlinkError) {
          console.warn(`⚠️ [${finalModel}] 로컬 파일 삭제 실패 (무시):`, unlinkError);
        }
      } catch (fileError) {
        console.error(`❌ [${finalModel}] 로컬 파일 읽기 실패:`, fileError);
        return res.status(500).json({
          error: "생성된 이미지 파일을 읽을 수 없습니다."
        });
      }
    } else {
      persistentLog(`🌐 [${finalModel}] URL에서 GCS 업로드`, transformedImageUrl.substring(0, 100));

      // 이미지 URL에서 버퍼 다운로드 (배경제거용)
      try {
        // data: URL 처리 (base64)
        if (transformedImageUrl.startsWith('data:')) {
          persistentLog(`📦 [${finalModel}] Base64 data URL 처리 중...`);
          const base64Match = transformedImageUrl.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            downloadedStickerBuffer = Buffer.from(base64Match[1], 'base64');
            persistentLog(`✅ [${finalModel}] Base64 버퍼 생성 완료`, `${downloadedStickerBuffer.length} bytes`);
          }
        } else {
          // HTTP/HTTPS URL 처리
          persistentLog(`📥 [${finalModel}] HTTP URL에서 이미지 다운로드 중...`);
          const imageResponse = await fetch(transformedImageUrl);
          if (imageResponse.ok) {
            downloadedStickerBuffer = Buffer.from(await imageResponse.arrayBuffer());
            persistentLog(`✅ [${finalModel}] 이미지 다운로드 완료`, `${downloadedStickerBuffer.length} bytes`);
          } else {
            persistentLog(`⚠️ [${finalModel}] 이미지 다운로드 실패`, `HTTP ${imageResponse.status}`);
          }
        }
      } catch (downloadError) {
        persistentLog(`⚠️ [${finalModel}] 이미지 다운로드 실패`, downloadError instanceof Error ? downloadError.message : String(downloadError));
      }

      imageResult = await saveImageFromUrlToGCS(
        transformedImageUrl,
        String(userId),
        'sticker_img',
        `sticker_${style}_generated`
      );
    }

    persistentLog("✅ [스티커 저장] GCS 저장 완료", imageResult.originalUrl);

    // 📐 이미지 크기 및 DPI 정보 추출
    let stickerWidth: number | undefined;
    let stickerHeight: number | undefined;
    let stickerDpi: number | undefined;

    if (downloadedStickerBuffer) {
      try {
        const sharp = (await import('sharp')).default;
        const imageMeta = await sharp(downloadedStickerBuffer).metadata();
        stickerWidth = imageMeta.width;
        stickerHeight = imageMeta.height;
        stickerDpi = imageMeta.density;
        persistentLog(`📐 [스티커 메타데이터] 크기: ${stickerWidth}x${stickerHeight}, DPI: ${stickerDpi || '없음'}`);
      } catch (metaError) {
        persistentLog(`⚠️ [스티커 메타데이터] 추출 실패:`, metaError instanceof Error ? metaError.message : String(metaError));
      }
    }

    // 🔥 배경제거 적용 (컨셉에서 활성화된 경우)
    let finalStickerImageUrl = imageResult.originalUrl;
    let finalStickerThumbnailUrl = imageResult.thumbnailUrl;
    let bgRemovalApplied = false;

    // 🔒 영구 로그 - 배경제거 조건 확인
    persistentLog('🔍 [배경제거 조건 확인]', {
      bgRemovalEnabled: concept?.bgRemovalEnabled,
      bgRemovalType: concept?.bgRemovalType,
      hasBuffer: !!downloadedStickerBuffer,
      bufferSize: downloadedStickerBuffer?.length || 0
    });

    if (concept?.bgRemovalEnabled) {
      persistentLog(`🔧 [배경제거] 컨셉에서 배경제거 활성화됨`, `타입: ${concept.bgRemovalType || 'foreground'}`);
      try {
        const { removeBackgroundFromBuffer } = await import('../services/backgroundRemoval');
        const bgRemovalOptions = {
          type: (concept.bgRemovalType as 'foreground' | 'background') || 'foreground'
        };

        // 다운로드된 이미지 버퍼 사용
        if (downloadedStickerBuffer) {
          persistentLog('🚀 [배경제거] 시작', `버퍼 크기: ${downloadedStickerBuffer.length} bytes`);
          const bgResult = await removeBackgroundFromBuffer(
            downloadedStickerBuffer,
            stickerUserId,
            bgRemovalOptions
          );
          finalStickerImageUrl = bgResult.url;
          bgRemovalApplied = true;
          persistentLog(`✅ [배경제거] 완료`, finalStickerImageUrl);
        } else {
          persistentLog(`⚠️ [배경제거] 이미지 버퍼 없음 - 건너뜀`);
        }
      } catch (bgError) {
        persistentLog(`❌ [배경제거] 실패 (원본 이미지 사용)`, bgError instanceof Error ? bgError.message : String(bgError));
        // 배경제거 실패시 원본 사용
      }
    } else {
      persistentLog('ℹ️ [배경제거] 비활성화됨 - 건너뜀');
    }

    const stickerImageTitle = await generateImageTitle('sticker_img', style, String(userId));

    const [savedImage] = await db.insert(images).values({
      title: stickerImageTitle,
      transformedUrl: bgRemovalApplied ? finalStickerImageUrl : imageResult.originalUrl,
      originalUrl: imageResult.originalUrl,
      thumbnailUrl: finalStickerThumbnailUrl,
      userId: String(userId),
      categoryId: "sticker_img",
      conceptId: style,
      width: stickerWidth,
      height: stickerHeight,
      dpi: stickerDpi,
      metadata: JSON.stringify({
        prompt,
        variables: parsedVariables,
        categoryId: "sticker_img",
        conceptId: style,
        model: finalModel,
        gsPath: imageResult.gsPath,
        gsThumbnailPath: imageResult.gsThumbnailPath,
        fileName: imageResult.fileName,
        storageType: 'gcs',
        bgRemovalApplied,
        bgRemovalType: bgRemovalApplied ? concept?.bgRemovalType : undefined
      }),
      style: style
    }).returning();

    // INSERT 후 imageId를 포함한 최종 제목으로 UPDATE
    const finalStickerImageTitle = appendImageIdToTitle(stickerImageTitle, savedImage.id);
    await db.update(images)
      .set({ title: finalStickerImageTitle })
      .where(eq(images.id, savedImage.id));

    console.log("✅ [스티커 저장] DB 저장 완료:", savedImage.id, "최종 제목:", finalStickerImageTitle);

    // 🔒 영구 로그 - 성공
    logImageGenResult(true, imageResult.originalUrl);

    return res.status(200).json({
      id: savedImage.id,
      title: finalStickerImageTitle,
      transformedUrl: imageResult.originalUrl,
      originalUrl: imageResult.originalUrl,
      thumbnailUrl: imageResult.thumbnailUrl,
      style: savedImage.style,
      prompt: prompt,
      createdAt: savedImage.createdAt,
      categoryId: savedImage.categoryId
    });

  } catch (error) {
    console.error("❌ [스티커 생성] 전체 에러:", error);
    // 🔒 [영구 로그] 에러 상세 정보
    persistentLog('❌ [스티커 생성 에러]', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
      timestamp: new Date().toISOString()
    });
    logImageGenResult(false, undefined, error instanceof Error ? error.message : String(error));
    return res.status(500).json({
      error: "스티커 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
      message: error instanceof Error ? error.message : String(error)
    });
  }
})

// ==================== Catch-all 라우트 (마지막에 배치) ====================

// 이미지 상세 정보 조회 API
router.get('/:id', (req, res, next) => {
  // ID가 완전한 숫자인지 정규식으로 검증
  if (!/^\d+$/.test(req.params.id)) {
    console.log(`⚠️ 유효하지 않은 ID 형식, 다음 라우터로 전달: ${req.params.id}`);
    return next('route');
  }
  next();
}, async (req, res) => {
  try {
    console.log(`🔍 [IMAGE ROUTER] /:id 라우트 호출됨! 요청 경로: ${req.originalUrl}, params.id: ${req.params.id}`);
    const imageId = parseInt(req.params.id);
    console.log(`🔍 이미지 상세 조회 시작: ID ${imageId}`);

    if (isNaN(imageId)) {
      console.log('❌ 유효하지 않은 이미지 ID');
      return res.status(400).json({ error: '유효하지 않은 이미지 ID입니다.' });
    }

    // 데이터베이스에서 직접 조회
    const image = await db.query.images.findFirst({
      where: eq(images.id, imageId)
    });

    console.log(`🔍 DB 조회 결과:`, image ? { id: image.id, title: image.title } : 'null');

    if (!image) {
      console.log('❌ 이미지를 찾을 수 없음');
      return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }

    // 이미지 메타데이터가 문자열이면 JSON으로 파싱
    let metadata = {};
    if (image.metadata && typeof image.metadata === 'string') {
      try {
        metadata = JSON.parse(image.metadata);
      } catch (err) {
        console.error('메타데이터 파싱 오류:', err);
      }
    } else if (image.metadata) {
      metadata = image.metadata;
    }

    // transformedUrl을 그대로 사용
    const transformedUrl = image.transformedUrl;
    const originalUrl = image.originalUrl;

    // 응답 객체 형식화
    const response = {
      id: image.id,
      title: image.title,
      description: '',
      style: image.style,
      originalUrl: originalUrl,
      transformedUrl: transformedUrl,
      createdAt: image.createdAt.toISOString(),
      metadata
    };

    console.log('✅ 이미지 상세 정보 API 응답:', {
      id: image.id,
      title: image.title,
      transformedUrl,
      originalUrl: image.originalUrl
    });

    res.json(response);
  } catch (error) {
    console.error('이미지 상세 정보 조회 오류:', error);
    res.status(500).json({ error: '이미지 상세 정보를 불러오는 중 오류가 발생했습니다.' });
  }
});

// 이미지 삭제 API
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    console.log(`🔍 삭제 요청 시작: ID ${imageId}`);

    if (isNaN(imageId)) {
      console.log('❌ 유효하지 않은 이미지 ID');
      return res.status(400).json({ error: '유효하지 않은 이미지 ID입니다.' });
    }

    // 인증된 사용자 정보 가져오기
    const userData = req.user as any;
    console.log(`🔍 인증된 사용자 정보:`, userData);

    const userId = userData.userId || userData.id;
    console.log(`🔍 사용자 ID: ${userId}`);

    // 이미지 소유자 확인
    const image = await storage.getImageById(imageId);
    console.log(`🔍 이미지 조회 결과:`, image ? { id: image.id, userId: image.userId } : 'null');

    if (!image) {
      console.log('❌ 이미지를 찾을 수 없음');
      return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }

    console.log(`🔍 권한 확인: 이미지 소유자 ${image.userId} vs 요청자 ${userId}`);
    if (image.userId !== userId) {
      console.log('❌ 삭제 권한 없음');
      return res.status(403).json({ error: '이미지를 삭제할 권한이 없습니다.' });
    }

    // 이미지 삭제
    console.log(`🗑️ 삭제 실행 중: ID ${imageId}`);
    await storage.deleteImage(imageId);

    console.log(`✅ 이미지 삭제 완료: ID ${imageId}, 사용자 ${userId}`);

    res.json({
      success: true,
      message: '이미지가 성공적으로 삭제되었습니다',
      deletedId: imageId
    });

  } catch (error) {
    console.error('❌ 이미지 삭제 오류:', error);
    res.status(500).json({ error: '이미지 삭제 중 오류가 발생했습니다' });
  }
});

// 이미지 다운로드 API
router.get('/:id/download', async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);

    if (isNaN(imageId)) {
      return res.status(400).json({ error: '유효하지 않은 이미지 ID입니다.' });
    }

    // 이미지 정보 조회
    const image = await storage.getImageById(imageId);

    if (!image) {
      return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }

    // 변환된 이미지 URL 확인
    if (!image.transformedUrl) {
      return res.status(404).json({ error: '이미지 URL이 유효하지 않습니다.' });
    }

    // 다운로드할 파일명 설정
    const filename = `image-${imageId}.jpg`;

    console.log(`[이미지 다운로드] ID: ${imageId}, URL: ${image.transformedUrl.substring(0, 50)}...`);

    // base64 데이터인지 확인
    if (image.transformedUrl.startsWith('data:')) {
      console.log('✅ Base64 데이터 감지됨. 처리 중...');
      try {
        const base64Data = image.transformedUrl.split(',')[1];
        if (!base64Data) {
          throw new Error('Base64 데이터를 찾을 수 없습니다');
        }

        const buffer = Buffer.from(base64Data, 'base64');
        console.log('Base64 버퍼 크기:', buffer.length, 'bytes');

        const mimeMatch = image.transformedUrl.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        console.log('MIME 타입:', mimeType);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        console.log('✅ Base64 이미지 전송 완료');
        return res.send(buffer);
      } catch (base64Error) {
        console.error('❌ Base64 데이터 처리 실패:', base64Error);
        return res.status(500).json({ error: "Base64 데이터 처리 중 오류가 발생했습니다." });
      }
    }
    // URL이 로컬 파일 경로인지 확인
    else if (image.transformedUrl.startsWith('/') || image.transformedUrl.startsWith('./')) {
      const filePath = path.resolve(process.cwd(), image.transformedUrl.replace(/^\//, ''));

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '이미지 파일을 찾을 수 없습니다.' });
      }

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
    // URL이 외부 URL인 경우
    else if (image.transformedUrl.startsWith('http')) {
      try {
        const response = await fetch(image.transformedUrl);

        if (!response.ok) {
          return res.status(response.status).json({
            error: `외부 이미지 서버 오류: ${response.statusText}`
          });
        }

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      } catch (error) {
        console.error('외부 이미지 다운로드 오류:', error);
        return res.status(500).json({ error: '이미지 다운로드 중 오류가 발생했습니다.' });
      }
    } else {
      return res.status(400).json({ error: '지원하지 않는 이미지 URL 형식입니다.' });
    }
  } catch (error) {
    console.error('이미지 다운로드 오류:', error);
    res.status(500).json({ error: '이미지 다운로드 중 오류가 발생했습니다.' });
  }
});

// 🔥 Firebase Direct Upload: URL 저장 API
/**
 * Firebase Storage에 업로드된 이미지 URL을 DB에 저장
 * 클라이언트에서 Firebase에 직접 업로드한 후 이 API를 호출하여 메타데이터를 저장합니다.
 * 
 * 🔐 보안: storagePath 소유권 검증 필수
 */
router.post('/save-url', requireAuth, async (req, res) => {
  try {
    const userId = validateUserId(req, res);
    if (!userId) return;

    const { imageUrl, storagePath, fileName, fileSize, mimeType } = req.body;

    // 입력 검증
    if (!imageUrl || !storagePath) {
      return res.status(400).json({
        success: false,
        message: 'imageUrl과 storagePath는 필수 항목입니다.'
      });
    }

    console.log(`🔥 [Firebase URL 저장] 사용자 ${userId}의 이미지 저장 요청`);
    console.log(`- imageUrl: ${imageUrl.substring(0, 80)}...`);
    console.log(`- storagePath: ${storagePath}`);
    console.log(`- fileName: ${fileName}`);
    console.log(`- fileSize: ${fileSize} bytes`);

    // 🔐 중요: storagePath 소유권 검증 (보안 필수)
    // Firebase Auth UID 형식이 2가지:
    //   - auth.ts /me API: createCustomToken(String(user.id)) → UID = "24"  → 경로: uploads/24/...
    //   - firebase-auth.ts: createFirebaseCustomToken → UID = "user_24" → 경로: uploads/user_24/...
    const expectedPrefixWithLabel = `uploads/user_${userId}/`;
    const expectedPrefixDirect = `uploads/${userId}/`;

    if (!storagePath.startsWith(expectedPrefixWithLabel) && !storagePath.startsWith(expectedPrefixDirect)) {
      console.error(`❌ [보안] 권한 없는 경로 접근 시도: ${storagePath}`);
      console.error(`   - 허용 경로1: ${expectedPrefixWithLabel}*`);
      console.error(`   - 허용 경로2: ${expectedPrefixDirect}*`);
      console.error(`   - 사용자 ID: ${userId}`);

      return res.status(403).json({
        success: false,
        message: '권한 없음: 본인의 경로에만 업로드할 수 있습니다.'
      });
    }

    const normalizedFileSize = typeof fileSize === 'number' ? fileSize : Number(fileSize);
    const safeFileSize = Number.isFinite(normalizedFileSize) ? normalizedFileSize : null;
    const uploadMetadata = {
      uploadMethod: 'firebase-direct',
      storagePath: storagePath,
      fileName: fileName,
      fileSize: safeFileSize,
      mimeType: mimeType,
      uploadedAt: new Date().toISOString()
    };

    try {
      const [savedUpload] = await db.insert(imageReferenceUploads).values({
        userId: String(userId),
        imageUrl,
        storagePath,
        fileName: fileName || null,
        fileSize: safeFileSize,
        mimeType: mimeType || null,
        provider: 'firebase',
        purpose: 'generation_reference',
        status: 'uploaded',
        metadata: uploadMetadata
      }).returning({ id: imageReferenceUploads.id });

      console.log(`✅ [Firebase URL 저장] 원본 첨부 전용 테이블 저장 완료: upload ID ${savedUpload.id}`);

      return res.json({
        success: true,
        uploadId: savedUpload.id,
        imageId: null,
        storageMode: 'reference_uploads',
        message: 'Firebase 업로드 원본 첨부 저장 완료'
      });
    } catch (saveError) {
      if (!isMissingReferenceUploadTableError(saveError)) {
        throw saveError;
      }

      console.warn('⚠️ [Firebase URL 저장] image_reference_uploads 테이블이 없어 legacy images 저장으로 fallback합니다.');
    }

    // 마이그레이션 전 배포 안전장치: 새 테이블이 없을 때만 기존 방식으로 저장한다.
    // 관리자 갤러리에서는 firebase_upload/firebase-direct row를 별도 제외한다.
    const [savedImage] = await db.insert(images).values({
      userId: String(userId),
      title: fileName || 'Firebase 업로드 이미지',
      style: 'firebase-direct',
      transformedUrl: imageUrl,
      originalUrl: imageUrl,
      categoryId: 'firebase_upload',
      metadata: JSON.stringify(uploadMetadata),
      createdAt: new Date()
    }).returning();

    console.log(`✅ [Firebase URL 저장] legacy images 저장 완료: 이미지 ID ${savedImage.id}`);

    return res.json({
      success: true,
      imageId: savedImage.id,
      uploadId: null,
      storageMode: 'legacy_images',
      message: 'Firebase 업로드 이미지 저장 완료'
    });

  } catch (error) {
    console.error('❌ [Firebase URL 저장] 오류:', error);
    return res.status(500).json({
      success: false,
      message: 'URL 저장 중 오류가 발생했습니다.',
      error: getErrorMessage(error)
    });
  }
});

export default router;
