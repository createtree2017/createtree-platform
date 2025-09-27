import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { QR_CONFIG } from "../shared/qr-config";
// import { authMiddleware } from "./common/middleware/auth"; // 임시 비활성화

import musicEngineRouter from "./routes/music-engine-routes";
import collageRouter from "./routes/collage";
import bannerMigrationRouter from "./routes/banner-migration";

import { generateThumbnail, getThumbnailUrl } from "./utils/thumbnail";
import { saveImageToGCS, saveImageFromUrlToGCS, saveBannerToGCS } from "./utils/gcs-image-storage";
import { applyTemplateVariables } from "./utils/prompt";
import { 
  getSystemSettings, 
  updateSystemSettings, 
  refreshSettingsCache,
  checkSystemSettingsHealth,
  resolveAiModel,
  getValidModelsForConcept,
  validateRequestedModel
} from "./utils/settings";



import googleOAuthRouter from "./routes/google-oauth";
import imageRouter from "./routes/image";
import { requireAuth } from "./middleware/auth";
import { requireAdminOrSuperAdmin, requireHospitalAdmin } from "./middleware/admin-auth";
import { requirePremiumAccess, requireActiveHospital } from "./middleware/permission";
import { errorHandler, notFoundHandler, asyncHandler } from "./middleware/error-handler";
import { requestLogger, responseFormatter } from "./middleware/response";
import { getUserImages } from "./storage";

// Express session 타입 확장
declare module 'express-session' {
  interface SessionData {
    tempImage?: {
      id: number;
      title: string;
      style: string;
      originalUrl: string;
      transformedUrl: string;
      createdAt: string;
      isTemporary: boolean;
      localFilePath?: string; // 로컬 파일 시스템 경로 추가
      dbImageId?: number; // 실제 DB에 저장된 ID도 추가
    };

    // Firebase 인증 관련 세션 필드 추가
    userId?: number;
    firebaseUid?: string;
    userEmail?: string;
    userRole?: string;
    isAdmin?: boolean;
    isHospitalAdmin?: boolean;
  }
}
// Chat 시스템에서는 simple 버전으로 import하고, 이미지는 DALL-E 3 버전을 사용
import { generateChatResponse } from "./services/openai";

// 공통 유틸리티 함수들
// Type safety helper functions
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

function getUserId(req: Request): string {
  const userId = req.user?.id || req.user?.userId;
  return String(userId);
}

function validateUserId(req: Request, res: express.Response): string | null {
  const userId = getUserId(req);
  if (!userId || userId === 'undefined') {
    console.error("❌ 사용자 ID가 없습니다:", req.user);
    res.status(400).json({
      success: false,
      message: "사용자 인증 정보가 올바르지 않습니다."
    });
    return null;
  }
  return userId;
}

import { generateContent } from "./services/gemini";
import {
  generateAiMusic,
  getAvailableMusicStyles,
  getAvailableDurations
} from "./services/topmedia-service";
// import geminiTestRoutes from "./routes/gemini-test-routes"; // 제거됨
import { exportChatHistoryAsHtml } from "./services/export-logs";


import {
  music,
  images,
  personas,
  personaCategories,
  concepts,
  conceptCategories,
  abTests,
  abTestVariants,
  serviceItems,
  abTestResults,
  hospitals,
  hospitalMembers,
  musicStyles,
  insertMusicStyleSchema,
  banners,
  smallBanners,  // 작은 배너 테이블 추가

  // styleCards 제거됨

  serviceCategories,
  users,
  userNotificationSettings,
  hospitalCodes,
  milestones,
  milestoneApplications,

  // 시스템 설정 관련 추가
  systemSettings,
  systemSettingsUpdateSchema,
  AI_MODELS,

  insertConceptSchema,
  insertConceptCategorySchema,
  insertBannerSchema,
  insertHospitalCodeSchema,

  insertServiceCategorySchema,
  insertServiceItemSchema,
  sql,
  like
} from "../shared/schema";
import { db } from "../db/index";
import { or, ne, eq, and, asc, desc, isNull, inArray } from "drizzle-orm";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
const staticBannerDir = path.join(process.cwd(), "static", "banner");
const staticMilestoneDir = path.join(process.cwd(), "static", "milestones");

// Create directories if they don't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(staticBannerDir)) {
  fs.mkdirSync(staticBannerDir, { recursive: true });
  fs.mkdirSync(path.join(staticBannerDir, "slide-banners"), { recursive: true });
  fs.mkdirSync(path.join(staticBannerDir, "small-banners"), { recursive: true });
}
if (!fs.existsSync(staticMilestoneDir)) {
  fs.mkdirSync(staticMilestoneDir, { recursive: true });
}

const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// Static 폴더용 multer 설정 (배너 전용)
const bannerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 임시로 모든 파일을 uploads 폴더에 저장
    // 실제 폴더 구분은 업로드 후 파일 이동으로 처리
    console.log('📁 [BANNER STORAGE] ===== DESTINATION 함수 호출 =====');
    console.log('📁 [BANNER STORAGE] req.body:', req.body);
    console.log('📁 [BANNER STORAGE] file info:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    });

    // 임시 저장소 사용 (나중에 API에서 올바른 폴더로 이동)
    const tempPath = path.join(process.cwd(), 'uploads');

    console.log('📁 [BANNER STORAGE] 임시 저장 경로:', tempPath);

    // 폴더가 존재하는지 확인
    const exists = fs.existsSync(tempPath);
    console.log('📁 [BANNER STORAGE] 폴더 존재 여부:', exists);

    if (!exists) {
      console.log('📁 [BANNER STORAGE] 폴더 생성 시도:', tempPath);
      try {
        fs.mkdirSync(tempPath, { recursive: true });
        console.log('📁 [BANNER STORAGE] ✅ 폴더 생성 성공');
      } catch (error) {
        console.error('📁 [BANNER STORAGE] ❌ 폴더 생성 실패:', error);
      }
    }

    console.log('📁 [BANNER STORAGE] ===== DESTINATION 완료 =====');
    cb(null, tempPath);
  },
  filename: function (req, file, cb) {
    console.log('📁 [BANNER STORAGE] ===== FILENAME 함수 호출 =====');
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = "banner-" + uniqueSuffix + path.extname(file.originalname);
    console.log('📁 [BANNER STORAGE] 생성된 파일명:', filename);
    console.log('📁 [BANNER STORAGE] 파일 확장자:', path.extname(file.originalname));
    console.log('📁 [BANNER STORAGE] ===== FILENAME 완료 =====');
    cb(null, filename);
  },
});

const upload = multer({
  storage: multer.memoryStorage(), // 메모리 저장으로 변경하여 buffer 사용
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    console.log('📁 파일 업로드 시도:', { fieldname: file.fieldname, mimetype: file.mimetype, originalname: file.originalname });

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/heic",
      "image/heif"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      console.error('❌ 허용되지 않는 파일 타입:', file.mimetype);
      return cb(new Error(`허용되지 않는 파일 형식입니다. 허용 형식: ${allowedTypes.join(', ')}`));
    }

    console.log('✅ 파일 타입 검증 통과:', file.mimetype);
    cb(null, true);
  },
});

// 마일스톤 헤더 이미지용 multer 설정
const milestoneStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, staticMilestoneDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "milestone-header-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const milestoneUpload = multer({
  storage: milestoneStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드할 수 있습니다.') as any, false);
    }
  },
});

// 배너 전용 multer 업로드 (static 폴더 사용)
const bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`허용되지 않는 파일 형식입니다. 허용 형식: ${allowedTypes.join(', ')}`));
    }
    cb(null, true);
  },
});



// Schema for chat message
const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required"),
  personaSystemPrompt: z.string().optional(),
});

// Schema for favorite toggle
const favoriteToggleSchema = z.object({
  itemId: z.number().int().positive(),
  type: z.enum(["music", "image"]),
});

// Schema for media sharing
const mediaShareSchema = z.object({
  id: z.number().int(), // -1 값도 허용
  type: z.enum(["music", "image"]),
});

// Schema for saving chat
const saveChatSchema = z.object({
  title: z.string().min(1, "Title is required"),
  personaId: z.string().min(1, "Persona ID is required"),
  personaName: z.string().min(1, "Persona name is required"),
  personaEmoji: z.string().min(1, "Persona emoji is required"),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      createdAt: z.string(),
    })
  ).min(1, "At least one message is required"),
  summary: z.string().min(1, "Summary is required"),
  userMemo: z.string().optional(),
  mood: z.string().optional(),
});

// Schema for persona creation/update
const personaSchema = z.object({
  personaId: z.string().min(1, "Persona ID is required"),
  name: z.string().min(1, "Name is required"),
  avatarEmoji: z.string().min(1, "Avatar emoji is required"),
  description: z.string().min(1, "Description is required"),
  welcomeMessage: z.string().min(1, "Welcome message is required"),
  systemPrompt: z.string().min(1, "System prompt is required"),
  primaryColor: z.string().min(1, "Primary color is required"),
  secondaryColor: z.string().min(1, "Secondary color is required"),

  // Additional fields (optional)
  personality: z.string().optional(),
  tone: z.string().optional(),
  usageContext: z.string().optional(),
  emotionalKeywords: z.array(z.string()).optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night", "all"]).default("all"),

  // Admin fields (optional with defaults)
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  order: z.number().int().default(0),

  // Categories
  categories: z.array(z.string()).optional(),
});

// Schema for persona category creation/update
const personaCategorySchema = z.object({
  categoryId: z.string().min(1, "Category ID is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  emoji: z.string().min(1, "Emoji is required"),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// Schema for concept category creation/update
const conceptCategorySchema = z.object({
  categoryId: z.string().min(1, "Category ID is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  systemPrompt: z.string().optional(), // GPT-4o 이미지 분석 지침 필드 추가
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// Schema for image generation request
const imageGenerationSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
});

// Schema for concept creation/update
const conceptSchema = z.object({
  conceptId: z.string().min(1, "Concept ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  promptTemplate: z.string().min(1, "Prompt template is required"),
  systemPrompt: z.string().optional(), // GPT-4o 이미지 분석 지침 필드 추가
  thumbnailUrl: z.string().optional(),
  tagSuggestions: z.array(z.string()).optional(),
  variables: z.array(
    z.object({
      name: z.string().min(1, "Variable name is required"),
      label: z.string().min(1, "Variable label is required"),
      placeholder: z.string().optional()
    })
  ).optional(),
  referenceImageUrl: z.string().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  order: z.number().int().default(0),
  // AI 모델 관련 필드 추가
  generationType: z.enum(["image_upload", "text_only"]).default("image_upload"),
  availableModels: z.array(z.string()).min(1, "최소 1개 이상의 AI 모델을 선택해야 합니다").optional(),
  availableAspectRatios: z.record(z.string(), z.array(z.string())).optional(),
  // 병원별 공개 설정 필드 추가
  visibilityType: z.enum(["public", "hospital"]).default("public"),
  hospitalId: z.number().int().optional(),
});

// 인증 라우트 가져오기
import authRoutes from "./routes/auth";
// 인증 서비스 가져오기
import { initPassport } from "./services/auth";
import cookieParser from "cookie-parser";
import session from "express-session";
import { placeholderRouter } from './routes/placeholder';
// import musicRouter from './routes/music-routes'; // 중복 제거

// import testOpenAIRouter from './routes/test-openai-route'; // 제거됨

// 새로운 역할별 라우트 파일들
import { registerAdminRoutes } from './routes/admin-routes';
import { registerHospitalRoutes } from './routes/hospital-routes';
import { registerPublicRoutes } from './routes/public-routes';

export async function registerRoutes(app: Express): Promise<Server> {

  // 역할별 라우트 등록
  registerAdminRoutes(app);
  registerHospitalRoutes(app);
  registerPublicRoutes(app);

  // 🔥 GCS 업로드 테스트 엔드포인트 (인증 없음, 최우선 등록)
  const multerModule = await import('multer');
  const multerTest = multerModule.default;
  const uploadTest = multerTest({ dest: 'temp/' });

  // [PUBLIC] GCS upload test endpoint
  app.post('/api/gcs-test', uploadTest.single('file'), async (req, res) => {
    try {
      console.log('🧪 GCS 테스트 엔드포인트 호출됨');

      if (!req.file) {
        return res.status(400).json({ error: '파일이 없습니다.' });
      }

      const { bucket } = await import('./firebase') as { bucket: any };
      const fs = await import('fs');

      const userId = 'test-user';
      const file = req.file;
      // 작업지시서: GCS 경로 구조로 변경
      const destination = `${userId}/${Date.now()}_${file.originalname}`;

      console.log('📤 GCS 업로드 시작:', destination);

      // GCS에 업로드 (공개 모드)
      await bucket.upload(file.path, {
        destination,
        metadata: {
          contentType: file.mimetype,
        },
        public: true, // 공개 파일로 설정
      });

      // 임시 파일 삭제
      fs.unlinkSync(file.path);

      // 공개 URL 생성
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;

      console.log('✅ GCS 업로드 성공:', destination);
      res.status(200).json({
        success: true,
        url: publicUrl,
        gsPath: `gs://${bucket.name}/${destination}`,
        message: 'GCS 업로드 테스트 성공',
        bucket: bucket.name,
        destination: destination
      });

    } catch (error: any) {
      console.error('❌ GCS 업로드 실패:', error);

      // 임시 파일이 있다면 삭제
      const fsModule = await import('fs');
      if (req.file && fsModule.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        error: 'GCS 업로드 실패',
        details: error?.message || '알 수 없는 오류'
      });
    }
  });

  // 🔥 GCS 업로드 라우터 등록
  const { default: uploadRouter } = await import('./routes/upload');
  app.use('/api/upload', uploadRouter);

  // 이미지 서빙 라우터 (필요시 활성화)
  // const { default: imageRouter } = await import('./routes/images');
  // app.use('/api/images', imageRouter);

  // 관리자 도구 라우터 (필요시 활성화)
  // const { default: adminToolsRouter } = await import('./routes/admin-tools');
  // app.use('/api/admin-tools', adminToolsRouter);

  // Phase 6: 마일스톤 신청 파일 업로드 API
  const multer = (await import('multer')).default;

  // 파일 업로드용 (디스크 저장)
  const upload = multer({
    dest: 'uploads/milestone-files/',
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5 // 최대 5개 파일
    }
  });

  // 이미지 업로드용 (메모리 저장)
  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type') as any, false);
      }
    }
  });

  const {
    addFileToApplication,
    getApplicationFiles,
    deleteFile,
    getApplicationFileStats,
    validateFileType,
    generateSafeFileName
  } = await import('./services/file-upload.js');

  // 파일 업로드 (단일 파일)
  app.post('/api/milestone-applications/:applicationId/files', requireAuth, upload.single('file'), async (req, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
      }

      // 파일 타입 검증
      if (!validateFileType(req.file.mimetype)) {
        return res.status(400).json({
          error: '허용되지 않은 파일 타입입니다.',
          allowed: ['이미지 파일 (JPG, PNG, GIF)', 'PDF', '텍스트', 'Word 문서']
        });
      }

      // 안전한 파일명 생성
      const safeFileName = generateSafeFileName(req.file.originalname);

      const newFile = await addFileToApplication({
        applicationId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
        uploadedBy: userId
      });

      res.status(201).json({
        success: true,
        file: newFile,
        message: '파일이 성공적으로 업로드되었습니다.'
      });
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '파일 업로드에 실패했습니다.'
      });
    }
  });

  // 신청의 파일 목록 조회
  app.get('/api/milestone-applications/:applicationId/files', requireAuth, async (req, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);

      const files = await getApplicationFiles(applicationId);
      const stats = await getApplicationFileStats(applicationId);

      res.json({
        files,
        stats
      });
    } catch (error) {
      console.error('파일 목록 조회 오류:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '파일 목록 조회에 실패했습니다.'
      });
    }
  });

  // 파일 삭제
  app.delete('/api/milestone-application-files/:fileId', requireAuth, async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      const result = await deleteFile(fileId, userId);
      res.json(result);
    } catch (error) {
      console.error('파일 삭제 오류:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '파일 삭제에 실패했습니다.'
      });
    }
  });

  // 파일 다운로드
  app.get('/api/milestone-application-files/:fileId/download', requireAuth, async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);

      const { milestoneApplicationFiles } = await import('@shared/schema.js');
      const { eq } = await import('drizzle-orm');

      const file = await db.query.milestoneApplicationFiles.findFirst({
        where: eq(milestoneApplicationFiles.id, fileId),
        with: {
          application: {
            columns: {
              userId: true
            }
          }
        }
      });

      if (!file) {
        return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
      }

      // 접근 권한 확인 (신청자, 업로드자, 관리자)
      const userId = req.user?.id;
      const isOwner = file.application.userId === userId || file.uploadedBy === userId;
      const isAdmin = req.user?.memberType === 'admin' || req.user?.memberType === 'superadmin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: '파일에 접근할 권한이 없습니다.' });
      }

      // 파일 서빙
      res.download(file.filePath, file.fileName);
    } catch (error) {
      console.error('파일 다운로드 오류:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '파일 다운로드에 실패했습니다.'
      });
    }
  });


  // [중복 제거됨] Small banners, user profile, notifications - public-routes.ts로 이동

  // [LEGACY] 기존 라우트들 - 역할별 라우트 파일로 분리됨
  // 다음 라우트들은 새로운 파일에서 처리됩니다:
  // - admin-routes.ts: 관리자 전용 라우트 (89개)
  // - hospital-routes.ts: 병원 관리자 라우트 (23개)
  // - public-routes.ts: 공개/인증 사용자 라우트 (51개)

  // [TEMP] 기존 코드 유지 - 점진적 마이그레이션을 위해
  app.put("/api/auth/profile-legacy", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { fullName, email, phoneNumber, dueDate, birthdate } = req.body;

      // 이메일 중복 체크 (다른 사용자가 사용 중인지 확인)
      if (email) {
        const existingUser = await db.query.users.findFirst({
          where: (users, { eq, and, ne }) => and(eq(users.email, email), ne(users.id, userId))
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "이미 사용 중인 이메일입니다."
          });
        }
      }

      // 사용자 정보 업데이트
      const updateData: any = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (birthdate !== undefined) updateData.birthdate = birthdate ? new Date(birthdate) : null;
      updateData.updatedAt = new Date();

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, Number(userId)))
        .returning();

      res.json({
        success: true,
        message: "프로필이 업데이트되었습니다.",
        user: updatedUser
      });
    } catch (error) {
      console.error("프로필 업데이트 오류:", error);
      res.status(500).json({
        success: false,
        message: "프로필 업데이트 중 오류가 발생했습니다."
      });
    }
  });

  // [PUBLIC] Change password - requires authentication
  app.put("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { currentPassword, newPassword } = req.body;

      // 현재 사용자 정보 조회
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
      });

      if (!user || !user.password) {
        return res.status(400).json({
          success: false,
          message: "비밀번호를 변경할 수 없습니다. 소셜 로그인 계정입니다."
        });
      }

      // 현재 비밀번호 확인
      const bcrypt = require('bcrypt');
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "현재 비밀번호가 올바르지 않습니다."
        });
      }

      // 새 비밀번호 해시화
      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // 비밀번호 업데이트
      await db
        .update(users)
        .set({
          password: hashedNewPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, Number(userId)));

      res.json({
        success: true,
        message: "비밀번호가 성공적으로 변경되었습니다."
      });
    } catch (error) {
      console.error("비밀번호 변경 오류:", error);
      res.status(500).json({
        success: false,
        message: "비밀번호 변경 중 오류가 발생했습니다."
      });
    }
  });

  // [PUBLIC] Get notification settings - requires authentication
  app.get("/api/auth/notification-settings", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;

      // 알림 설정이 있는지 확인, 없으면 기본값으로 생성
      let settings = await db.query.userNotificationSettings?.findFirst({
        where: eq(userNotificationSettings.userId, userId)
      });

      if (!settings) {
        // 기본 설정으로 생성
        const [newSettings] = await db.insert(userNotificationSettings).values({
          userId,
          emailNotifications: true,
          pushNotifications: true,
          pregnancyReminders: true,
          weeklyUpdates: true,
          promotionalEmails: false,
        }).returning();
        settings = newSettings;
      }

      res.json({
        success: true,
        settings
      });
    } catch (error) {
      console.error("알림 설정 조회 오류:", error);
      res.status(500).json({
        success: false,
        message: "알림 설정을 불러오는 중 오류가 발생했습니다."
      });
    }
  });

  // 알림 설정 업데이트 API
  app.put("/api/auth/notification-settings", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const {
        emailNotifications,
        pushNotifications,
        pregnancyReminders,
        weeklyUpdates,
        promotionalEmails
      } = req.body;

      // 기존 설정 확인
      const existingSettings = await db.query.userNotificationSettings?.findFirst({
        where: eq(userNotificationSettings.userId, userId)
      });

      if (existingSettings) {
        // 업데이트
        const [updatedSettings] = await db
          .update(userNotificationSettings)
          .set({
            emailNotifications,
            pushNotifications,
            pregnancyReminders,
            weeklyUpdates,
            promotionalEmails,
            updatedAt: new Date()
          })
          .where(eq(userNotificationSettings.userId, userId))
          .returning();

        res.json({
          success: true,
          message: "알림 설정이 업데이트되었습니다.",
          settings: updatedSettings
        });
      } else {
        // 새로 생성
        const [newSettings] = await db.insert(userNotificationSettings).values({
          userId,
          emailNotifications,
          pushNotifications,
          pregnancyReminders,
          weeklyUpdates,
          promotionalEmails,
        }).returning();

        res.json({
          success: true,
          message: "알림 설정이 생성되었습니다.",
          settings: newSettings
        });
      }
    } catch (error) {
      console.error("알림 설정 업데이트 오류:", error);
      res.status(500).json({
        success: false,
        message: "알림 설정 업데이트 중 오류가 발생했습니다."
      });
    }
  });

  // 이메일 인증 발송 API
  app.post("/api/auth/send-verification-email", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;

      // 사용자 정보 조회
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
      });

      if (!user || !user.email) {
        return res.status(400).json({
          success: false,
          message: "이메일 정보를 찾을 수 없습니다."
        });
      }

      if (user.emailVerified) {
        return res.status(400).json({
          success: false,
          message: "이미 인증된 이메일입니다."
        });
      }

      // TODO: 실제 이메일 발송 로직 구현
      // 현재는 성공 응답만 반환
      res.json({
        success: true,
        message: "인증 이메일이 발송되었습니다."
      });
    } catch (error) {
      console.error("이메일 인증 발송 오류:", error);
      res.status(500).json({
        success: false,
        message: "이메일 발송 중 오류가 발생했습니다."
      });
    }
  });

  // [ADMIN] Create small banner for homepage
  app.post("/api/admin/create-small-banner", async (req, res) => {
    try {
      console.log("🚨🚨🚨 Small banner 생성 요청 도달!!!", req.body);
      console.log("🔍 [SMALL BANNER CREATE] 요청 필드별 값:");
      console.log("  - title:", req.body.title);
      console.log("  - description:", req.body.description);
      console.log("  - imageSrc:", req.body.imageSrc);
      console.log("  - href:", req.body.href);
      console.log("  - isActive:", req.body.isActive);
      console.log("  - order:", req.body.order);

      const bannerData = {
        title: req.body.title,
        description: req.body.description,
        imageUrl: req.body.imageSrc,
        linkUrl: req.body.href,
        isActive: req.body.isActive,
        order: req.body.order
      };

      console.log("💾 DB 저장할 데이터:", bannerData);

      // imageUrl이 null이면 경고
      if (!bannerData.imageUrl) {
        console.log("⚠️ [SMALL BANNER CREATE] 경고: imageUrl이 null 또는 undefined입니다!");
        console.log("⚠️ [SMALL BANNER CREATE] req.body.imageSrc 값:", req.body.imageSrc);
      }

      const newBanner = await db.insert(smallBanners).values(bannerData).returning();

      console.log("🎉🎉🎉 배너 생성 성공!!!", newBanner[0]);

      // 프론트엔드 인터페이스에 맞게 필드명 변환
      const formattedBanner = {
        id: newBanner[0].id,
        title: newBanner[0].title,
        description: newBanner[0].description,
        imageSrc: newBanner[0].imageUrl,  // imageUrl -> imageSrc로 변환
        href: newBanner[0].linkUrl,       // linkUrl -> href로 변환
        isActive: newBanner[0].isActive,
        order: newBanner[0].order,
        createdAt: newBanner[0].createdAt
      };

      res.status(201).json(formattedBanner);
    } catch (error) {
      console.error("💥💥💥 배너 생성 실패:", error);
      res.status(500).json({ error: "Failed to create small banner", details: getErrorMessage(error) });
    }
  });



  app.put("/api/admin/small-banners/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid small banner ID" });
      }

      // 기존 작은 배너 정보 조회 (파일 삭제를 위해)
      const existingBanner = await db
        .select()
        .from(smallBanners)
        .where(eq(smallBanners.id, id))
        .limit(1);

      if (existingBanner.length === 0) {
        return res.status(404).json({ error: "Small banner not found" });
      }

      const oldImageUrl = existingBanner[0].imageUrl;
      const newImageUrl = req.body.imageSrc;

      const smallBannerData = {
        title: req.body.title,
        description: req.body.description,
        imageUrl: req.body.imageSrc,
        linkUrl: req.body.href,
        isActive: req.body.isActive,
        order: req.body.order,
        updatedAt: new Date()
      };

      const updatedSmallBanner = await db
        .update(smallBanners)
        .set(smallBannerData)
        .where(eq(smallBanners.id, id))
        .returning();

      // 이미지가 변경된 경우 기존 파일 삭제
      if (oldImageUrl !== newImageUrl && oldImageUrl.startsWith('/static/banner/')) {
        // '/static/' 제거하고 절대 경로 생성
        const relativePath = oldImageUrl.replace('/static/', '');
        const oldFilePath = path.join(process.cwd(), 'static', relativePath);
        try {
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
            console.log(`🗑️ 기존 작은 배너 파일 삭제: ${oldImageUrl} → ${oldFilePath}`);
          } else {
            console.log(`⚠️ 기존 파일이 존재하지 않음: ${oldFilePath}`);
          }
        } catch (error) {
          console.error(`❌ 기존 파일 삭제 실패: ${oldImageUrl}`, error);
        }
      }

      // 프론트엔드 인터페이스에 맞게 필드명 변환
      const formattedBanner = {
        id: updatedSmallBanner[0].id,
        title: updatedSmallBanner[0].title,
        description: updatedSmallBanner[0].description,
        imageSrc: updatedSmallBanner[0].imageUrl,  // imageUrl -> imageSrc로 변환
        href: updatedSmallBanner[0].linkUrl,       // linkUrl -> href로 변환
        isActive: updatedSmallBanner[0].isActive,
        order: updatedSmallBanner[0].order,
        createdAt: updatedSmallBanner[0].createdAt
      };

      res.json(formattedBanner);
    } catch (error) {
      console.error("Error updating small banner:", error);
      res.status(500).json({ error: "Failed to update small banner" });
    }
  });

  app.delete("/api/admin/small-banners/:id", async (req, res) => {
    try {
      console.log(`🗑️ [SMALL BANNER DELETE] 삭제 요청 받음 - ID: ${req.params.id}`);

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid small banner ID" });
      }

      // 삭제 전 파일 정보 조회
      console.log(`🔍 [SMALL BANNER DELETE] DB에서 배너 정보 조회 중...`);
      const bannerToDelete = await db
        .select()
        .from(smallBanners)
        .where(eq(smallBanners.id, id))
        .limit(1);

      if (bannerToDelete.length === 0) {
        console.log(`❌ [SMALL BANNER DELETE] DB에서 배너 찾을 수 없음 - ID: ${id}`);
        return res.status(404).json({ error: "Small banner not found" });
      }

      const imageUrl = bannerToDelete[0].imageUrl;
      console.log(`📋 [SMALL BANNER DELETE] 삭제할 배너 정보:`, {
        id: bannerToDelete[0].id,
        title: bannerToDelete[0].title,
        imageUrl: imageUrl
      });

      // DB에서 삭제
      console.log(`🗃️ [SMALL BANNER DELETE] DB에서 삭제 중...`);
      const deletedSmallBanner = await db
        .delete(smallBanners)
        .where(eq(smallBanners.id, id))
        .returning();

      console.log(`✅ [SMALL BANNER DELETE] DB 삭제 완료`);

      // DB 삭제 성공 후 파일 삭제
      if (imageUrl && imageUrl.startsWith('/static/banner/')) {
        // '/static/' 제거하고 절대 경로 생성
        const relativePath = imageUrl.replace('/static/', '');
        const filePath = path.join(process.cwd(), 'static', relativePath);

        console.log(`📁 [SMALL BANNER DELETE] 파일 삭제 시도:`, {
          imageUrl: imageUrl,
          relativePath: relativePath,
          filePath: filePath,
          fileExists: fs.existsSync(filePath)
        });

        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✅ [SMALL BANNER DELETE] 파일 삭제 성공: ${filePath}`);
          } else {
            console.log(`⚠️ [SMALL BANNER DELETE] 파일이 존재하지 않음: ${filePath}`);
          }
        } catch (error) {
          console.error(`❌ [SMALL BANNER DELETE] 파일 삭제 실패: ${imageUrl}`, error);
        }
      } else {
        console.log(`⚠️ [SMALL BANNER DELETE] 파일 URL이 올바르지 않음: ${imageUrl}`);
      }

      console.log(`🎉 [SMALL BANNER DELETE] 작은 배너 삭제 완료 - ID: ${id}`);
      res.json({ message: "Small banner deleted successfully" });
    } catch (error) {
      console.error("❌ [SMALL BANNER DELETE] 오류 발생:", error);
      res.status(500).json({ error: "Failed to delete small banner" });
    }
  });



  // ⚠️ 중복 제거됨: admin-routes.ts에서 처리

  // 🚨 중복 라우터 제거됨 - 상단의 새로운 라우터 사용

  // 쿠키 파서 미들웨어 등록
  app.use(cookieParser());

  // 세션 미들웨어 등록 (무한 루프 방지)
  app.use(session({
    secret: process.env.SESSION_SECRET || 'create-tree-mobile-session-secret',
    resave: false,             // 세션 변경사항이 없으면 저장 안함 (무한 루프 방지)
    saveUninitialized: false,  // 초기화되지 않은 세션 저장 안함
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000  // 30일
    },
    name: 'createtree.sid'
  }));

  // Passport 초기화 및 미들웨어 등록
  const passport = initPassport();
  app.use(passport.initialize());
  app.use(passport.session());

  // 🗑️ 복잡한 스타일카드 시스템 완전히 제거됨

  // ✅ 기존 banners 테이블 활용 - 복잡한 시스템 제거하고 간단하게!

  // 인증 라우트 등록
  app.use("/api/auth", authRoutes);

  // 플레이스홀더 이미지 라우트 등록
  app.use("/api/placeholder", placeholderRouter);

  // 슈퍼관리자 라우트 등록
  // 슈퍼관리자 라우터 제거됨 - 통합 관리자 시스템 사용

  // 음악 관련 API 라우트 등록 (music-engine-routes.ts로 통합됨)

  // OpenAI API 테스트 라우트 등록
  // app.use("/api/test-openai", testOpenAIRouter); // 제거됨

  // 통합 메뉴 API - 카테고리와 서비스 항목을 함께 제공
  app.get("/api/menu", async (req, res) => {
    try {
      // 1. 활성화된 서비스 카테고리 가져오기 (공개 상태인 것만)
      const categories = await db.select().from(serviceCategories)
        .where(eq(serviceCategories.isPublic, true))
        .orderBy(serviceCategories.order);

      if (!categories || categories.length === 0) {
        return res.status(200).json([]);
      }

      // 2. 메뉴 구조 생성
      const menu = [];

      // 3. 각 카테고리별로 해당하는 서비스 항목 조회
      for (const category of categories) {
        // 해당 카테고리에 속한 활성화된 서비스 항목만 가져오기
        const items = await db.select({
          id: serviceItems.id,
          title: serviceItems.title,
          path: serviceItems.path, // DB의 path 필드 직접 사용 (itemId 중복 제거)
          iconName: serviceItems.icon // 아이콘 이름 (일관성 유지)
        }).from(serviceItems)
          .where(and(
            eq(serviceItems.categoryId, category.id),
            eq(serviceItems.isPublic, true)
          ))
          .orderBy(serviceItems.order);

        // 항목이 있는 카테고리만 메뉴에 추가
        if (items && items.length > 0) {
          menu.push({
            id: category.id,
            title: category.title,
            icon: category.icon, // 카테고리 아이콘 (icons 필드)
            items: items.map(item => ({
              ...item,
              // path가 이미 슬래시로 시작하는지 확인 후 변환
              path: item.path?.startsWith('/') ? item.path : `/${item.path}`
            }))
          });
        }
      }

      console.log("메뉴 구조:", JSON.stringify(menu));
      return res.status(200).json(menu);
    } catch (error) {
      console.error('메뉴 조회 오류:', error);
      return res.status(500).json({ error: "menu-error" });
    }
  });

  // 일반 사용자를 위한 병원 목록 API (로그인 필요없이 접근 가능)
  app.get("/api/hospitals", async (req, res) => {
    try {
      const activeHospitals = await db.select().from(hospitals).where(eq(hospitals.isActive, true)).orderBy(hospitals.name);
      return res.status(200).json(activeHospitals);
    } catch (error) {
      console.error('병원 목록 조회 오류:', error);
      return res.status(500).json({ error: '병원 목록을 가져오는 중 오류가 발생했습니다.' });
    }
  });

  // 병원 코드 검증 API
  app.post("/api/auth/verify-hospital-code", async (req, res) => {
    try {
      const { hospitalId, code } = req.body;

      if (!hospitalId || !code) {
        return res.status(400).json({
          valid: false,
          message: "병원과 인증코드를 모두 입력해주세요"
        });
      }

      // 코드 조회 및 검증
      const hospitalCode = await db.select()
        .from(hospitalCodes)
        .where(and(
          eq(hospitalCodes.hospitalId, parseInt(hospitalId)),
          eq(hospitalCodes.code, code),
          eq(hospitalCodes.isActive, true)
        ))
        .limit(1);

      if (!hospitalCode.length) {
        return res.status(400).json({
          valid: false,
          message: "유효하지 않은 인증코드입니다"
        });
      }

      const codeData = hospitalCode[0];

      // 만료일 체크
      if (codeData.expiresAt && new Date() > new Date(codeData.expiresAt)) {
        return res.status(400).json({
          valid: false,
          message: "만료된 인증코드입니다"
        });
      }

      // 인원 제한 체크 (limited, qr_limited 타입)
      if ((codeData.codeType === 'limited' || codeData.codeType === 'qr_limited') &&
          codeData.maxUsage && codeData.currentUsage >= codeData.maxUsage) {
        return res.status(400).json({
          valid: false,
          message: "인증코드 사용 인원이 마감되었습니다"
        });
      }

      // 사용 가능한 경우 남은 자리 수 계산
      let remainingSlots: number | undefined;
      if (codeData.maxUsage) {
        remainingSlots = codeData.maxUsage - codeData.currentUsage;
      }

      return res.status(200).json({
        valid: true,
        message: "유효한 인증코드입니다",
        remainingSlots,
        codeType: codeData.codeType
      });

    } catch (error) {
      console.error('코드 검증 오류:', error);
      return res.status(500).json({
        valid: false,
        message: "코드 검증 중 오류가 발생했습니다"
      });
    }
  });

  // QR코드 데이터 생성 API
  app.get("/api/qr/hospital/:hospitalId/:codeId", async (req, res) => {
    try {
      const { hospitalId, codeId } = req.params;

      // 코드 존재 확인
      const codeData = await db.select()
        .from(hospitalCodes)
        .where(and(
          eq(hospitalCodes.id, parseInt(codeId)),
          eq(hospitalCodes.hospitalId, parseInt(hospitalId)),
          eq(hospitalCodes.isQREnabled, true),
          eq(hospitalCodes.isActive, true)
        ))
        .limit(1);

      if (!codeData.length) {
        return res.status(404).json({ error: "QR 코드를 찾을 수 없습니다" });
      }

      // QR 데이터 생성
      const baseUrl = process.env.NODE_ENV === 'production'
        ? `https://${req.get('host')}`
        : `http://${req.get('host')}`;

      const qrData = `${baseUrl}/signup?hospital=${hospitalId}&code=${codeData[0].code}&type=qr`;

      return res.status(200).json({
        qrData,
        description: codeData[0].qrDescription,
        codeType: codeData[0].codeType,
        remainingSlots: codeData[0].maxUsage ? codeData[0].maxUsage - codeData[0].currentUsage : null
      });

    } catch (error) {
      console.error('QR 데이터 생성 오류:', error);
      return res.status(500).json({ error: "QR 데이터 생성 중 오류가 발생했습니다" });
    }
  });

  // 관리자 병원 코드 목록 조회 API
  app.get("/api/admin/hospital-codes", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const codes = await db.select({
        id: hospitalCodes.id,
        hospitalId: hospitalCodes.hospitalId,
        hospitalName: hospitals.name,
        code: hospitalCodes.code,
        codeType: hospitalCodes.codeType,
        maxUsage: hospitalCodes.maxUsage,
        currentUsage: hospitalCodes.currentUsage,
        isQREnabled: hospitalCodes.isQREnabled,
        qrDescription: hospitalCodes.qrDescription,
        isActive: hospitalCodes.isActive,
        expiresAt: hospitalCodes.expiresAt,
        createdAt: hospitalCodes.createdAt,
        updatedAt: hospitalCodes.updatedAt,
      })
      .from(hospitalCodes)
      .leftJoin(hospitals, eq(hospitalCodes.hospitalId, hospitals.id))
      .orderBy(desc(hospitalCodes.createdAt));

      res.json(codes);
    } catch (error) {
      console.error('병원 코드 목록 조회 오류:', error);
      res.status(500).json({ error: "코드 목록 조회에 실패했습니다" });
    }
  });

  // 관리자 병원 코드 생성 API
  app.post("/api/admin/hospital-codes", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { hospitalId, code, codeType, maxUsage, isQREnabled, qrDescription, expiresAt } = req.body;

      console.log('[병원 코드 생성] 요청 데이터:', JSON.stringify({ hospitalId, code, codeType, maxUsage, isQREnabled, qrDescription, expiresAt }, null, 2));
      console.log('[병원 코드 생성] 요청 바디 전체:', JSON.stringify(req.body, null, 2));

      // 필수 필드 검증 - hospitalId가 숫자인지도 확인
      const hospitalIdNum = parseInt(hospitalId);
      if (!hospitalId || isNaN(hospitalIdNum) || !codeType) {
        console.log('[병원 코드 생성] 필수 필드 누락 또는 잘못된 형식:', {
          hospitalId,
          hospitalIdNum,
          isHospitalIdValid: !isNaN(hospitalIdNum),
          codeType
        });
        return res.status(400).json({
          error: "필수 필드가 누락되었거나 형식이 잘못되었습니다",
          required: ["hospitalId (숫자)", "codeType"],
          received: { hospitalId, hospitalIdNum, codeType },
          validation: {
            hospitalIdExists: !!hospitalId,
            hospitalIdIsNumber: !isNaN(hospitalIdNum),
            codeTypeExists: !!codeType
          }
        });
      }

      // 코드 중복 검사
      const existingCode = await db.select()
        .from(hospitalCodes)
        .where(eq(hospitalCodes.code, code))
        .limit(1);

      if (existingCode.length > 0) {
        return res.status(400).json({ error: "이미 존재하는 코드입니다" });
      }

      // 병원 존재 확인
      const hospital = await db.select()
        .from(hospitals)
        .where(eq(hospitals.id, hospitalIdNum))
        .limit(1);

      if (!hospital.length) {
        console.log(`[병원 코드 생성] 병원 ID ${hospitalIdNum}를 찾을 수 없음`);
        return res.status(400).json({ error: "존재하지 않는 병원입니다" });
      }

      console.log(`[병원 코드 생성] 병원 확인됨: ${hospital[0].name} (ID: ${hospitalIdNum})`);

      // 코드 자동 생성 (없으면)
      let finalCode = code;
      if (!code || code.trim() === '') {
        // 병원 이름과 코드 타입을 기반으로 자동 생성
        const hospital = await db.select()
          .from(hospitals)
          .where(eq(hospitals.id, hospitalId))
          .limit(1);

        if (hospital.length > 0) {
          const hospitalName = hospital[0].name;
          const prefix = hospitalName.substring(0, 2).toUpperCase();
          const typeCode = codeType.toUpperCase().substring(0, 3);
          const timestamp = Date.now().toString().slice(-4);
          finalCode = `${prefix}${typeCode}${timestamp}`;
        } else {
          finalCode = `AUTO${Date.now().toString().slice(-6)}`;
        }
      }

      console.log('[병원 코드 생성] 최종 코드:', finalCode);

      // 코드 생성
      const insertData = {
        hospitalId: hospitalIdNum,
        code: finalCode.toUpperCase(),
        codeType,
        maxUsage: maxUsage ? parseInt(maxUsage) : null,
        currentUsage: 0,
        isQREnabled: isQREnabled || false,
        qrDescription: qrDescription || null,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      };

      console.log('[병원 코드 생성] 삽입 데이터:', JSON.stringify(insertData, null, 2));

      const newCode = await db.insert(hospitalCodes)
        .values(insertData)
        .returning();

      console.log(`새 병원 코드 생성: ${finalCode} (병원 ID: ${hospitalIdNum}, 타입: ${codeType})`);

      res.status(201).json({
        success: true,
        code: newCode[0],
        message: "병원 코드가 생성되었습니다"
      });

    } catch (error) {
      console.error('병원 코드 생성 오류:', error);
      res.status(500).json({ error: "코드 생성에 실패했습니다" });
    }
  });

  // 관리자 병원 코드 삭제 API
  app.delete("/api/admin/hospital-codes/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const codeId = parseInt(req.params.id);

      if (isNaN(codeId)) {
        return res.status(400).json({ error: "유효하지 않은 코드 ID입니다" });
      }

      // 코드 존재 확인
      const existingCode = await db.select()
        .from(hospitalCodes)
        .where(eq(hospitalCodes.id, codeId))
        .limit(1);

      if (!existingCode.length) {
        return res.status(404).json({ error: "존재하지 않는 코드입니다" });
      }

      // 코드 삭제
      await db.delete(hospitalCodes)
        .where(eq(hospitalCodes.id, codeId));

      console.log(`병원 코드 삭제: ID ${codeId} (코드: ${existingCode[0].code})`);

      res.json({
        success: true,
        message: "병원 코드가 삭제되었습니다"
      });

    } catch (error) {
      console.error('병원 코드 삭제 오류:', error);
      res.status(500).json({ error: "코드 삭제에 실패했습니다" });
    }
  });

  // 관리자 병원 코드 상태 변경 API
  app.patch("/api/admin/hospital-codes/:id/status", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const codeId = parseInt(req.params.id);
      const { isActive } = req.body;

      if (isNaN(codeId)) {
        return res.status(400).json({ error: "유효하지 않은 코드 ID입니다" });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: "isActive 값은 boolean이어야 합니다" });
      }

      console.log(`[병원 코드 상태 변경] 병원 ID: ${codeId}, 새 상태: ${isActive ? '활성화' : '비활성화'}`);

      // 코드 존재 확인
      const existingCode = await db.select()
        .from(hospitalCodes)
        .where(eq(hospitalCodes.id, codeId))
        .limit(1);

      if (!existingCode.length) {
        return res.status(404).json({ error: "존재하지 않는 코드입니다" });
      }

      // 상태 업데이트
      const updatedCode = await db.update(hospitalCodes)
        .set({
          isActive,
          updatedAt: new Date()
        })
        .where(eq(hospitalCodes.id, codeId))
        .returning();

      console.log(`병원 코드 상태 변경: ${existingCode[0].code} → ${isActive ? '활성' : '비활성'}`);

      res.json({
        success: true,
        code: updatedCode[0],
        message: `코드가 ${isActive ? '활성화' : '비활성화'}되었습니다`
      });

    } catch (error) {
      console.error('병원 코드 상태 변경 오류:', error);
      res.status(500).json({ error: "상태 변경에 실패했습니다" });
    }
  });

  // 관리자 병원 상태 변경 API (자동화 트리거 포함)
  app.patch("/api/admin/hospitals/:id/status", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const hospitalId = parseInt(req.params.id);
      const { isActive } = req.body;

      if (isNaN(hospitalId)) {
        return res.status(400).json({ error: "유효하지 않은 병원 ID입니다" });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: "isActive 값은 boolean이어야 합니다" });
      }

      console.log(`[병원 상태 변경] 병원 ID: ${hospitalId}, 새 상태: ${isActive ? '활성화' : '비활성화'}`);

      // 1. 병원 상태 업데이트
      const updatedHospital = await db.update(hospitals)
        .set({
          isActive,
          updatedAt: new Date()
        })
        .where(eq(hospitals.id, hospitalId))
        .returning();

      if (updatedHospital.length === 0) {
        return res.status(404).json({ error: "병원을 찾을 수 없습니다" });
      }

      console.log(`[병원 상태 변경] ${updatedHospital[0].name} 상태 변경 완료`);

      // 2. 병원 상태 변경 시 자동 회원 등급 변경 트리거
      console.log(`[자동화 트리거] 병원 상태 변경 감지 - 회원 등급 자동 변경 시작`);

      // 해당 병원의 모든 membership 회원 조회 (과거 membership이었던 pro, free 회원 포함)
      const targetUsers = await db.query.users.findMany({
        where: eq(users.hospitalId, hospitalId)
      });

      // membership 기본 등급 회원들과 이전에 변경된 pro/free 회원들 구분
      const membershipUsers = targetUsers.filter(u => u.memberType === 'membership');
      const changedUsers = targetUsers.filter(u => ['pro', 'free'].includes(u.memberType || '') && Number(u.hospitalId) === hospitalId);

      console.log(`[자동화 트리거] 병원 소속 회원 현황:`);
      console.log(`  - membership 회원: ${membershipUsers.length}명`);
      console.log(`  - 기존 변경된 회원 (pro/free): ${changedUsers.length}명`);

      // 목표 등급 결정
      const targetMemberType = isActive ? 'pro' : 'free';
      console.log(`[자동화 트리거] 목표 등급: ${targetMemberType} (병원 ${isActive ? '활성화' : '비활성화'})`);

      // 모든 해당 병원 소속 회원들의 등급 변경
      const usersToUpdate = [...membershipUsers, ...changedUsers];

      if (usersToUpdate.length > 0) {
        for (const user of usersToUpdate) {
          const currentType = user.memberType;

          // 관리자는 제외
          if (['admin', 'superadmin', 'hospital_admin'].includes(currentType || '')) {
            console.log(`[자동화 트리거] ${user.email} - 관리자 등급이므로 변경 제외`);
            continue;
          }

          await db.update(users)
            .set({
              memberType: targetMemberType,
              updatedAt: new Date()
            })
            .where(eq(users.id, user.id));

          console.log(`[자동화 트리거] ${user.email} (ID: ${user.id}) - ${currentType} → ${targetMemberType} 변경 완료`);
        }

        console.log(`[자동화 트리거] 총 ${usersToUpdate.length}명의 회원 등급 변경 완료`);
      } else {
        console.log(`[자동화 트리거] 변경할 회원이 없습니다`);
      }

      res.json({
        success: true,
        hospital: updatedHospital[0],
        message: isActive
          ? `병원이 활성화되었으며, 소속 회원들이 pro 등급으로 승격되었습니다`
          : `병원이 비활성화되었으며, 소속 회원들이 free 등급으로 변경되었습니다`
      });

    } catch (error) {
      console.error("[병원 상태 변경] 오류:", error);
      res.status(500).json({
        error: "병원 상태 변경에 실패했습니다",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ========================================
  // 시스템 설정 관리자 API
  // ========================================

  // 시스템 설정 조회 API (관리자 전용)
  app.get("/api/admin/system-settings", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      console.log("[시스템 설정 조회] 관리자 요청 받음");
      
      const settings = await getSystemSettings();
      
      console.log("[시스템 설정 조회] 성공:", {
        defaultAiModel: settings.defaultAiModel,
        supportedAiModels: settings.supportedAiModels,
        clientDefaultModel: settings.clientDefaultModel
      });
      
      res.json({
        success: true,
        settings,
        message: "시스템 설정을 성공적으로 조회했습니다"
      });
      
    } catch (error) {
      console.error("[시스템 설정 조회] 오류:", error);
      res.status(500).json({
        success: false,
        error: "시스템 설정 조회에 실패했습니다",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 시스템 설정 업데이트 API (관리자 전용)
  app.put("/api/admin/system-settings", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      console.log("[시스템 설정 업데이트] 관리자 요청 받음:", req.body);
      
      // Zod 검증
      const validatedData = systemSettingsUpdateSchema.parse(req.body);
      
      console.log("[시스템 설정 업데이트] 검증 통과:", validatedData);
      
      // 시스템 설정 업데이트
      const updatedSettings = await updateSystemSettings(validatedData);
      
      console.log("[시스템 설정 업데이트] 성공:", {
        defaultAiModel: updatedSettings.defaultAiModel,
        supportedAiModels: updatedSettings.supportedAiModels,
        clientDefaultModel: updatedSettings.clientDefaultModel
      });
      
      res.json({
        success: true,
        settings: updatedSettings,
        message: "시스템 설정이 성공적으로 업데이트되었습니다"
      });
      
    } catch (error) {
      console.error("[시스템 설정 업데이트] 오류:", error);
      
      // Zod 검증 오류 처리
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "입력 데이터가 올바르지 않습니다",
          validationErrors: error.errors,
          message: "설정 데이터 형식을 확인해주세요"
        });
      }
      
      res.status(500).json({
        success: false,
        error: "시스템 설정 업데이트에 실패했습니다",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 시스템 설정 상태 확인 API (관리자 전용)
  app.get("/api/admin/system-settings/health", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      console.log("[시스템 설정 상태 확인] 요청 받음");
      
      const healthStatus = await checkSystemSettingsHealth();
      
      console.log("[시스템 설정 상태 확인] 결과:", healthStatus);
      
      res.json({
        success: true,
        health: healthStatus,
        message: "시스템 설정 상태를 성공적으로 확인했습니다"
      });
      
    } catch (error) {
      console.error("[시스템 설정 상태 확인] 오류:", error);
      res.status(500).json({
        success: false,
        error: "시스템 설정 상태 확인에 실패했습니다",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 시스템 설정 캐시 새로고침 API (관리자 전용)
  app.post("/api/admin/system-settings/refresh-cache", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      console.log("[시스템 설정 캐시 새로고침] 요청 받음");
      
      // 캐시 무효화
      refreshSettingsCache();
      
      // 새로운 설정 로드 (캐시 재구성)
      const refreshedSettings = await getSystemSettings();
      
      console.log("[시스템 설정 캐시 새로고침] 성공");
      
      res.json({
        success: true,
        settings: refreshedSettings,
        message: "시스템 설정 캐시가 성공적으로 새로고침되었습니다"
      });
      
    } catch (error) {
      console.error("[시스템 설정 캐시 새로고침] 오류:", error);
      res.status(500).json({
        success: false,
        error: "시스템 설정 캐시 새로고침에 실패했습니다",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 시스템 설정 조회 API (공개용 - 클라이언트에서 사용)
  app.get("/api/system-settings", async (req, res) => {
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

  // ========================================
  // QR 코드 관련 API
  // ========================================

  // QR 코드 생성 API
  app.get("/api/qr/generate/:hospitalId/:codeId", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { hospitalId, codeId } = req.params;

      // 병원 코드 정보 조회
      const codeInfo = await db.select({
        id: hospitalCodes.id,
        hospitalId: hospitalCodes.hospitalId,
        hospitalName: hospitals.name,
        code: hospitalCodes.code,
        codeType: hospitalCodes.codeType,
        isQREnabled: hospitalCodes.isQREnabled,
        isActive: hospitalCodes.isActive,
        expiresAt: hospitalCodes.expiresAt,
        qrDescription: hospitalCodes.qrDescription,
      })
      .from(hospitalCodes)
      .leftJoin(hospitals, eq(hospitalCodes.hospitalId, hospitals.id))
      .where(and(
        eq(hospitalCodes.id, parseInt(codeId)),
        eq(hospitalCodes.hospitalId, parseInt(hospitalId)),
        eq(hospitalCodes.isActive, true),
        eq(hospitalCodes.isQREnabled, true)
      ))
      .limit(1);

      if (codeInfo.length === 0) {
        return res.status(404).json({ error: "QR 활성화된 코드를 찾을 수 없습니다" });
      }

      const code = codeInfo[0];

      // QR 데이터 구조 생성 (설정에서 상수 사용)
      const qrData = {
        type: QR_CONFIG.TYPE,
        version: QR_CONFIG.VERSION,
        hospitalId: code.hospitalId,
        hospitalName: code.hospitalName,
        codeId: code.id,
        code: code.code,
        codeType: code.codeType,
        description: code.qrDescription,
        generated: new Date().toISOString(),
        expires: code.expiresAt ? new Date(code.expiresAt).toISOString() : null,
        url: `${req.protocol}://${req.get('host')}/api/qr/verify`
      };

      // QR 코드 이미지 생성 - 회원가입 페이지 직접 링크
      const qrString = `${req.protocol}://${req.get('host')}/signup?type=qr&hospital=${code.hospitalId}&code=${code.code}`;
      const qrImageBuffer = await QRCode.toBuffer(qrString, {
        type: 'png',
        width: QR_CONFIG.IMAGE_WIDTH,
        margin: QR_CONFIG.IMAGE_MARGIN,
        color: {
          dark: QR_CONFIG.DARK_COLOR,
          light: QR_CONFIG.LIGHT_COLOR
        }
      });

      // 응답 헤더 설정 (설정에서 상수 사용)
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': qrImageBuffer.length,
        'Cache-Control': QR_CONFIG.CACHE_CONTROL,
        'Content-Disposition': `inline; filename="hospital-${hospitalId}-code-${codeId}.png"`
      });

      res.send(qrImageBuffer);

    } catch (error) {
      console.error('QR 코드 생성 오류:', error);
      res.status(500).json({ error: "QR 코드 생성에 실패했습니다" });
    }
  });

  // QR 코드 데이터 조회 API (이미지가 아닌 JSON 데이터)
  app.get("/api/qr/data/:hospitalId/:codeId", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { hospitalId, codeId } = req.params;

      const codeInfo = await db.select({
        id: hospitalCodes.id,
        hospitalId: hospitalCodes.hospitalId,
        hospitalName: hospitals.name,
        code: hospitalCodes.code,
        codeType: hospitalCodes.codeType,
        isQREnabled: hospitalCodes.isQREnabled,
        isActive: hospitalCodes.isActive,
        expiresAt: hospitalCodes.expiresAt,
        qrDescription: hospitalCodes.qrDescription,
      })
      .from(hospitalCodes)
      .leftJoin(hospitals, eq(hospitalCodes.hospitalId, hospitals.id))
      .where(and(
        eq(hospitalCodes.id, parseInt(codeId)),
        eq(hospitalCodes.hospitalId, parseInt(hospitalId)),
        eq(hospitalCodes.isActive, true),
        eq(hospitalCodes.isQREnabled, true)
      ))
      .limit(1);

      if (codeInfo.length === 0) {
        return res.status(404).json({ error: "QR 활성화된 코드를 찾을 수 없습니다" });
      }

      const code = codeInfo[0];

      // QR 데이터 구조 생성 (설정에서 상수 사용)
      const qrData = {
        type: QR_CONFIG.TYPE,
        version: QR_CONFIG.VERSION,
        hospitalId: code.hospitalId,
        hospitalName: code.hospitalName,
        codeId: code.id,
        code: code.code,
        codeType: code.codeType,
        description: code.qrDescription,
        generated: new Date().toISOString(),
        expires: code.expiresAt ? new Date(code.expiresAt).toISOString() : null,
        url: `${req.protocol}://${req.get('host')}/api/qr/verify`
      };

      res.json({
        success: true,
        qrData,
        qrString: `${req.protocol}://${req.get('host')}/signup?type=qr&hospital=${code.hospitalId}&code=${code.code}`,
        imageUrl: `/api/qr/generate/${hospitalId}/${codeId}`
      });

    } catch (error) {
      console.error('QR 데이터 조회 오류:', error);
      res.status(500).json({ error: "QR 데이터 조회에 실패했습니다" });
    }
  });

  // QR 스캔 검증 API (공개 접근 가능)
  app.post("/api/qr/verify", async (req, res) => {
    try {
      const { qrData } = req.body;

      if (!qrData || typeof qrData !== 'string') {
        return res.status(400).json({ error: "유효하지 않은 QR 데이터입니다" });
      }

      let parsedData;
      try {
        parsedData = JSON.parse(qrData);
      } catch {
        return res.status(400).json({ error: "QR 데이터 형식이 올바르지 않습니다" });
      }

      // QR 데이터 구조 검증 (설정에서 상수 사용)
      if (parsedData.type !== QR_CONFIG.TYPE || !parsedData.hospitalId || !parsedData.codeId) {
        return res.status(400).json({ error: "병원 인증 QR 코드가 아닙니다" });
      }

      // 만료 시간 검증
      if (parsedData.expires && new Date(parsedData.expires) < new Date()) {
        return res.status(400).json({ error: "만료된 QR 코드입니다" });
      }

      // 데이터베이스에서 코드 확인
      const codeInfo = await db.select({
        id: hospitalCodes.id,
        hospitalId: hospitalCodes.hospitalId,
        hospitalName: hospitals.name,
        code: hospitalCodes.code,
        codeType: hospitalCodes.codeType,
        maxUsage: hospitalCodes.maxUsage,
        currentUsage: hospitalCodes.currentUsage,
        isQREnabled: hospitalCodes.isQREnabled,
        isActive: hospitalCodes.isActive,
      })
      .from(hospitalCodes)
      .leftJoin(hospitals, eq(hospitalCodes.hospitalId, hospitals.id))
      .where(and(
        eq(hospitalCodes.id, parsedData.codeId),
        eq(hospitalCodes.hospitalId, parsedData.hospitalId),
        eq(hospitalCodes.code, parsedData.code),
        eq(hospitalCodes.isActive, true),
        eq(hospitalCodes.isQREnabled, true)
      ))
      .limit(1);

      if (codeInfo.length === 0) {
        return res.status(404).json({ error: "유효하지 않은 QR 코드입니다" });
      }

      const code = codeInfo[0];

      // 사용량 제한 확인 (limited, qr_limited 타입)
      if ((code.codeType === 'limited' || code.codeType === 'qr_limited') &&
          code.maxUsage && code.currentUsage >= code.maxUsage) {
        return res.status(400).json({ error: "사용 가능한 인원이 초과되었습니다" });
      }

      // 성공 응답
      res.json({
        success: true,
        message: "QR 코드 인증 성공",
        hospital: {
          id: code.hospitalId,
          name: code.hospitalName
        },
        code: code.code,
        codeType: code.codeType,
        autoFill: {
          hospitalId: code.hospitalId,
          promoCode: code.code
        }
      });

    } catch (error) {
      console.error('QR 스캔 검증 오류:', error);
      res.status(500).json({ error: "QR 코드 검증에 실패했습니다" });
    }
  });

  // Serve uploaded files from the uploads directory
  app.use('/uploads', (req, res, next) => {
    // 정적 파일 제공 - 직접 파일 읽고 제공
    const filePath = path.join(process.cwd(), 'uploads', req.path);
    console.log(`Serving static file: ${filePath}`);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error(`Error serving static file: ${filePath}`, err);
        next();
      }
    });
  });

  // 임시 이미지 파일 제공 (별도 라우트로 처리)
  app.use('/uploads/temp', (req, res, next) => {
    // 임시 파일 제공
    const tempFilePath = path.join(process.cwd(), 'uploads', 'temp', req.path);
    console.log(`Serving temporary file: ${tempFilePath}`);
    res.sendFile(tempFilePath, (err) => {
      if (err) {
        console.error(`Error serving temporary file: ${tempFilePath}`, err);
        next();
      }
    });
  });

  // GCS 이미지 프록시 서빙 (권한 문제 해결)
  app.get('/api/image-proxy/*', async (req, res) => {
    try {
      const { bucket } = await import('./firebase') as { bucket: any };
      const filePath = (req.params as any)[0]; // * captures everything after /api/image-proxy/
      console.log(`🖼️ 이미지 프록시 요청: ${filePath}`);

      const file = bucket.file(filePath);
      const [exists] = await file.exists();

      if (!exists) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // 파일 스트림 직접 전송
      const stream = file.createReadStream();

      // 적절한 Content-Type 설정
      const contentType = filePath.endsWith('.webp') ? 'image/webp' :
                         filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? 'image/jpeg' :
                         filePath.endsWith('.png') ? 'image/png' : 'image/webp';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 일반 이미지 캐시 정책

      stream.pipe(res);

      stream.on('error', (error: unknown) => {
        console.error('❌ 이미지 스트림 오류:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to load image' });
        }
      });

    } catch (error) {
      console.error('❌ 이미지 프록시 오류:', error);
      res.status(500).json({ error: 'Image proxy error' });
    }
  });

  // Serve embed script for iframe integration
  app.get('/embed.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'client/public/embed.js'));
  });

  // 개발 대화 내보내기 페이지 제공
  app.get('/dev-chat-export', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'client/public/dev-chat-export.html'));
  });



  // API routes

  // Music endpoints


  // 음악 목록 API는 /api/music 라우터에서 처리됨 (중복 제거)

  // 음악 관련 모든 API는 /api/music-engine으로 통합됨 (중복 제거)

  // 🔥 테스트용 간단한 API
  app.get("/api/public/test", (req, res) => {
    console.log("[테스트] 공개 API 호출됨");
    res.json({ message: "테스트 성공!" });
  });

  // 첫 번째 중복 라우트는 제거되었음

  // 🔥 인증 없는 이미지 변환 API (임시 개발용)
  app.post("/api/public/image-transform", upload.single("image"), async (req, res) => {
    console.log("[공개 이미지 변환] API 호출됨 - 파일 업로드 시작");
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const { style, userVariables } = req.body;
      if (!style) {
        return res.status(400).json({ error: "No style selected" });
      }

      console.log("[공개 이미지 변환] 파일 업로드됨:", req.file.filename);
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

      // 기존 이미지 변환 로직과 동일하게 처리
      const originalImagePath = req.file.path;
      const imageId = Date.now();

      // OpenAI API 호출
      const imageBuffer = fs.readFileSync(originalImagePath);
      const base64Image = imageBuffer.toString('base64');

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

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      let transformedImageUrl;

      // GPT-Image-1 모델만 사용 (DALL-E 3 폴백 제거)
      console.log("[공개 이미지 변환] GPT-Image-1 모델 시도");
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });
      if (!response.data || !response.data[0]?.url) {
        throw new Error("No image generated from GPT-Image-1");
      }
      transformedImageUrl = response.data[0].url;
      console.log("[공개 이미지 변환] GPT-Image-1 성공");

      console.log("[공개 이미지 변환] OpenAI 응답 성공");

      // 컨셉 정보를 사용하여 카테고리와 제목 결정
      const categoryId = publicConceptInfo?.categoryId || 'sticker_img';
      const conceptTitle = publicConceptInfo?.title || style;
      const imageTitle = `${conceptTitle}_${style}_게스트`;

      console.log(`[공개 이미지 변환] 카테고리별 저장: ${categoryId}`);
      console.log(`[공개 이미지 변환] 새로운 제목 형식: ${imageTitle}`);

      // GCS에 이미지 저장
      const { saveImageFromUrlToGCS } = await import('./utils/gcs-image-storage');

      const imageResult = await saveImageFromUrlToGCS(
        transformedImageUrl,
        'guest', // 게스트 사용자
        categoryId,
        imageTitle
      );

      console.log(`[공개 이미지 변환] GCS 저장 완료: ${imageResult.originalUrl}`);

      // DB에 이미지 저장 - GCS URL만 사용
      const [savedImage] = await db.insert(images).values({
        title: imageTitle,
        style: style,
        originalUrl: imageResult.originalUrl, // GCS 원본 이미지 URL (로컬 경로 제거)
        transformedUrl: imageResult.originalUrl, // GCS 원본 이미지 URL
        thumbnailUrl: imageResult.thumbnailUrl, // GCS 썸네일 URL
        userId: "-1", // 게스트 사용자
        categoryId: categoryId,
        conceptId: style,
        metadata: JSON.stringify({
          originalStyle: style,
          originalName: req.file?.filename || 'guest_upload',
          createdAt: new Date().toISOString(),
          displayTitle: imageTitle,
          gsPath: imageResult.gsPath, // GCS 경로 추가
          gsThumbnailPath: imageResult.gsThumbnailPath, // GCS 썸네일 경로 추가
          fileName: imageResult.fileName,
          storageType: 'gcs',
          isShared: true
        })
      }).returning();

      console.log(`[공개 이미지 변환] DB 저장 완료: ID ${savedImage.id}`);

      return res.json({
        success: true,
        imageId: savedImage.id,
        transformedUrl: imageResult.originalUrl, // GCS 원본 이미지
        thumbnailUrl: imageResult.thumbnailUrl, // GCS 썸네일
        originalUrl: req.file ? (await saveImageToGCS(req.file.buffer, 'anonymous', 'original')).originalUrl : null,
        message: "이미지가 성공적으로 생성되었습니다."
      });

    } catch (error) {
      console.error("[공개 이미지 변환] 오류:", error);
      return res.status(500).json({
        error: "이미지 변환 중 오류가 발생했습니다.",
        details: getErrorMessage(error)
      });
    }
  });

  // 기존 인증 필요한 이미지 변환 API
  // JWT 기반 이미지 변환 API - requireAuth 미들웨어 적용
  app.post("/api/image/transform", requireAuth, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const { style, categoryId, variables } = req.body;
      if (!style) {
        return res.status(400).json({ error: "No style selected" });
      }

      console.log(`[이미지 변환] 카테고리 ID 수신: ${categoryId}`);
      console.log("[DEBUG] req.body 전체:", req.body);
      console.log("[DEBUG] req.body.variables:", req.body.variables);
      console.log("[DEBUG] req.user:", req.user);


      // Check if this is a request from admin panel or if it's a variant request for A/B testing
      const isTransformAdmin = req.query.admin === 'true' || req.headers['x-admin-request'] === 'true';
      const variantId = req.body.variant;
      let promptTemplate = null;
      let categorySystemPrompt = null;  // 변수 미리 정의 (scope 문제 해결)

      if (variantId) {
        // Get the active test for this concept/style
        const activeTest = await db.query.abTests.findFirst({
          where: and(
            eq(abTests.conceptId, style),
            eq(abTests.isActive, true)
          ),
        });

        if (activeTest) {
          // Find the requested variant
          const variant = await db.query.abTestVariants.findFirst({
            where: and(
              eq(abTestVariants.testId, activeTest.testId),
              eq(abTestVariants.variantId, variantId)
            ),
          });

          if (variant) {
            promptTemplate = variant.promptTemplate;

            // 변형 테스트에도 시스템 프롬프트 지원 추가
            // 원본 컨셉의 systemPrompt 또는 카테고리 systemPrompt 가져오기
            const concept = await db.query.concepts.findFirst({
              where: eq(concepts.conceptId, style)
            });

            if (concept) {
              if (concept.systemPrompt) {
                categorySystemPrompt = concept.systemPrompt;
                console.log(`A/B 테스트용 컨셉 '${concept.title}'의 시스템 프롬프트 적용: ${categorySystemPrompt.substring(0, 50)}...`);
              } else if (concept.categoryId) {
                const category = await db.query.conceptCategories.findFirst({
                  where: eq(conceptCategories.categoryId, concept.categoryId)
                });

                if (category && category.systemPrompt) {
                  categorySystemPrompt = category.systemPrompt;
                  console.log(`A/B 테스트용 카테고리 '${category.name}'의 시스템 프롬프트 적용: ${categorySystemPrompt.substring(0, 50)}...`);
                }
              }
            }
          }
        }
      }
      else {
        // Check if this is a custom concept from the database
        const concept = await db.query.concepts.findFirst({
          where: eq(concepts.conceptId, style)
        });

        // 카테고리 정보와 시스템 프롬프트 가져오기 (이미지 분석 지침용)
        if (concept && concept.categoryId) {
          const category = await db.query.conceptCategories.findFirst({
            where: eq(conceptCategories.categoryId, concept.categoryId)
          });

          if (category && category.systemPrompt) {
            categorySystemPrompt = category.systemPrompt;
            console.log(`카테고리 '${category.name}'의 시스템 프롬프트 적용: ${categorySystemPrompt.substring(0, 50)}...`);
          }
        }

        if (concept) {
          // Use the prompt template from the concept
          promptTemplate = concept.promptTemplate;
          // 컨셉 자체의 systemPrompt가 있다면 우선 적용
          if (concept.systemPrompt) {
            categorySystemPrompt = concept.systemPrompt;
            console.log(`컨셉 '${concept.title}'의 시스템 프롬프트 적용: ${categorySystemPrompt.substring(0, 50)}...`);
          }
        }
      }

      // 사용자 변수 처리 및 프롬프트 템플릿 적용
      let processedPromptTemplate = promptTemplate;
      let processedSystemPrompt = categorySystemPrompt;

      // 사용자가 입력한 변수값들을 프롬프트 템플릿과 시스템 프롬프트에 적용
      console.log("[DEBUG] req.body 전체:", req.body);
      console.log("[DEBUG] req.body.variables:", req.body.variables);
      if (req.body.variables) {
        try {
          const userVariables = JSON.parse(req.body.variables);
          console.log("[만삭사진 변환] 사용자 변수:", userVariables);

          // 공통 변수 치환 함수 사용 (기존 {var}와 새로운 {{var}} 형식 모두 지원)
          console.log(`🔄 [변수 치환] 프롬프트 템플릿과 시스템 프롬프트에 변수 적용 중...`);
          processedPromptTemplate = applyTemplateVariables(processedPromptTemplate || '', userVariables);
          processedSystemPrompt = applyTemplateVariables(normalizeOptionalString(processedSystemPrompt) || '', userVariables);

          console.log("[변수 치환] 최종 프롬프트:", processedPromptTemplate);
          console.log("[변수 치환] 최종 시스템 프롬프트:", processedSystemPrompt);
        } catch (error) {
          console.log("[변수 치환] 사용자 변수 파싱 실패, 기본 프롬프트 사용");
        }
      }

      // 파일 버퍼 처리 - 메모리 저장 방식 지원
      let imageBuffer: Buffer;

      if (req.file.buffer && req.file.buffer.length > 0) {
        // 메모리 저장 방식
        imageBuffer = req.file.buffer;
        console.log("📁 스티커 생성 - 메모리 기반 파일 처리:", imageBuffer.length, 'bytes');
      } else if (req.file.path) {
        // 디스크 저장 방식 - 파일 경로에서 읽기
        const originalImagePath = req.file.path;
        imageBuffer = fs.readFileSync(originalImagePath);
        console.log("📁 스티커 생성 - 디스크 기반 파일 처리:", imageBuffer.length, 'bytes');

        // 임시 파일 삭제
        fs.unlinkSync(originalImagePath);
      } else {
        console.error("❌ 스티커 생성 - 파일 버퍼와 경로 모두 없음");
        return res.status(500).json({
          success: false,
          message: "업로드된 파일을 처리할 수 없습니다."
        });
      }

      // 임시 파일 생성하여 기존 transformImage 메서드 사용
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${req.file.originalname}`);
      fs.writeFileSync(tempFilePath, imageBuffer);

      let transformedImageUrl: string;

      try {
        // Process image using AI service (transforming to specified art style)
        transformedImageUrl = await storage.transformImage(
          tempFilePath,
          style,
          processedPromptTemplate,
          processedSystemPrompt
        );

        // 임시 파일 정리
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }

        console.log("✅ [스티커 생성] 이미지 변환 완료:", transformedImageUrl);

        if (!transformedImageUrl || transformedImageUrl.includes('placehold.co')) {
          console.error("🚨 스티커 이미지 변환 실패");
          return res.status(500).json({
            success: false,
            message: "이미지 변환 중 오류가 발생했습니다."
          });
        }
      } catch (error) {
        // 임시 파일 정리
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        console.error("❌ [스티커 생성] 이미지 변환 실패:", error);
        return res.status(500).json({
          success: false,
          message: "이미지 변환 중 오류가 발생했습니다."
        });
      }

      // Check if this is a request from admin panel or if it's a variant test
      // Admin 요청이거나 A/B 테스트 변형일 경우에만 DB에 저장
      const isAdminRequest = req.query.admin === 'true' || req.headers['x-admin-request'] === 'true';
      const isVariantTest = !!variantId;

      let savedImage;
      let dbSavedImage;

      try {
        // JWT에서 인증된 사용자 정보 가져오기 (requireAuth 미들웨어에서 설정됨)
        const userId = req.user!.userId;
        const username = req.user!.username;

        // 요청 정보 자세히 로깅
        console.log(`[이미지 변환] 요청 시작 - 시간: ${new Date().toISOString()}`);
        console.log(`[이미지 변환] 파일: ${req.file.originalname}, 스타일: ${style}`);
        console.log(`[이미지 변환] 요청 헤더: admin=${req.query.admin}, x-admin-request=${req.headers['x-admin-request']}`);
        console.log(`[이미지 변환] JWT 인증된 사용자 ${username} (ID: ${userId})`);

        // 모든 이미지 요청은 데이터베이스에 저장 (사용자 정보 포함)
        console.log(`[이미지 변환] 이미지 저장 시작: ${style} ${req.file.originalname}`);

        dbSavedImage = await storage.saveImageTransformation(
          req.file.originalname,
          style,
          tempFilePath,
          transformedImageUrl,
          userId, // JWT 인증 후 항상 존재
          username, // JWT 인증 후 항상 존재
          categoryId, // 카테고리 ID가 먼저
          variantId // 변형 ID가 나중
        );

        console.log(`[이미지 변환] 이미지 저장 성공: ID=${dbSavedImage.id}, 제목=${dbSavedImage.title}`);

        if (isAdminRequest || isVariantTest) {
          // 관리자 패널이나 A/B 테스트 요청은 DB 이미지 직접 반환
          savedImage = dbSavedImage;
          console.log(`관리자 요청: 이미지가 데이터베이스에 저장됨 (ID: ${dbSavedImage.id})`);
        } else {
          // 일반 사용자 요청인 경우 - 데이터베이스에 저장은 했지만 임시 객체로 응답
          console.log(`일반 사용자 이미지: DB에 저장됨 (ID: ${dbSavedImage.id}), 사용자에게는 임시 이미지로 제공`);

          // 데이터베이스에서 컨셉 정보 조회하여 제목 동적 결정
          const conceptInfo = await db.query.concepts.findFirst({
            where: eq(concepts.conceptId, style)
          });

          const conceptTitle = conceptInfo?.title || style;
          const title = `${conceptTitle}_${style}_${username}`;
          const tempImageResult = await storage.saveTemporaryImage(transformedImageUrl, title);
          console.log("[디버그] tempImageResult 구조:", tempImageResult);

          // 임시 응답 객체 생성 (JWT 인증 후에는 세션 불필요)
          savedImage = {
            id: -1, // -1은 저장되지 않은 임시 ID
            title,
            style,
            originalUrl: tempFilePath,
            transformedUrl: transformedImageUrl, // 작업지시서: 로컬 경로 제거, GCS URL만 사용
            localFilePath: (tempImageResult as any).localPath || tempFilePath, // 전체 파일 경로 (내부 사용)
            createdAt: new Date().toISOString(),
            isTemporary: true, // 클라이언트에서 임시 여부 식별을 위한 플래그
            dbImageId: dbSavedImage.id // 실제 DB에 저장된 ID (필요시 사용)
          };

          console.log(`[이미지 변환] JWT 인증된 사용자 ${username}의 임시 이미지 생성 완료`);
          console.log(`[이미지 변환] 이미지 ID: ${dbSavedImage.id}, 임시 경로: ${savedImage.transformedUrl}`);
        }
      } catch (error) {
        console.error("[이미지 변환] 이미지 저장 중 오류:", error);

        // 오류 내용 상세히 로깅
        console.error("[이미지 변환] 오류 세부 정보:", {
          message: getErrorMessage(error),
          stack: isError(error) ? error.stack : 'No stack trace',
          time: new Date().toISOString(),
          requestInfo: {
            file: req.file ? req.file.originalname : "파일 없음",
            style: style || "스타일 없음",
            hasSession: !!req.session,
            user: req.user ? `${req.user.username} (ID: ${req.user.id})` : "로그인 없음"
          }
        });

        try {
          // 원래 파일명에서 확장자를 제외한 이름 사용
          const nameWithoutExt = path.basename(req.file.originalname, path.extname(req.file.originalname));

          // 이미지 저장에 실패하더라도 사용자에게 친숙한 제목 유지
          console.log("[이미지 변환] 오류 발생 시에도 친숙한 제목으로 응답 생성");

          // 이미지 URL 변환 상태에 따라 다르게 처리
          const imgUrl = transformedImageUrl && transformedImageUrl.includes("placehold.co")
            ? transformedImageUrl  // 이미 에러 이미지인 경우 그대로 사용
            : `/api/placeholder?id=${dbSavedImage?.id || 'error'}&text=${encodeURIComponent("이미지 처리 중 문제가 발생했습니다")}`;

          savedImage = {
            id: -1,
            title: `${style} ${nameWithoutExt}`, // "오류:" 접두사 제거
            style,
            originalUrl: tempFilePath,
            transformedUrl: imgUrl,
            createdAt: new Date().toISOString(),
            isTemporary: true,
            // 디버깅 정보 추가 (클라이언트에서는 표시되지 않음)
            debug: {
              errorOccurred: true,
              errorTime: new Date().toISOString(),
              errorType: isError(error) ? error.name : "UnknownError",
              errorMessage: getErrorMessage(error)
            }
          };

          console.log(`[이미지 변환] 오류 응답 객체 생성 완료: ${savedImage.title}`);
        } catch (formatError) {
          console.error("[이미지 변환] 오류 응답 생성 중 추가 오류:", formatError);

          // 완전 실패 시 최소한의 정보만 포함한 기본 응답
          savedImage = {
            id: -1,
            title: `이미지 ${new Date().toLocaleTimeString()}`,
            style: style || "기본",
            originalUrl: "",
            transformedUrl: "/api/placeholder?error=true",
            createdAt: new Date().toISOString(),
            isTemporary: true
          };
        }
      }

      return res.status(201).json(savedImage);
    } catch (error) {
      console.error("Error transforming image:", error);
      return res.status(500).json({ error: "Failed to transform image" });
    }
  });



  // 🖼️ 이미지 조회 API (카테고리 필터링 포함)
  // 관리자용 전체 이미지 갤러리 API
  app.get("/api/image", requireAuth, async (req, res) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      // 관리자 권한 확인
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
      });

      if (!user || !['admin', 'superadmin'].includes(user.memberType || '')) {
        return res.status(403).json({ error: "관리자 권한이 필요합니다." });
      }

      // 페이지네이션 파라미터
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // 썸네일이므로 더 많이
      const offset = (page - 1) * limit;

      console.log(`🔍 [관리자] 전체 이미지 조회 - 페이지: ${page}, 한계: ${limit}`);

      // 전체 이미지 개수 먼저 조회
      const totalImages = await db.query.images.findMany();
      const total = totalImages.length;
      const totalPages = Math.ceil(total / limit);

      // 페이지네이션된 이미지 조회 (모든 사용자)
      const allImages = await db.query.images.findMany({
        orderBy: desc(images.createdAt),
        limit: limit,
        offset: offset
      });

      // 각 이미지의 사용자 정보를 별도로 조회
      const imagesWithUsers = await Promise.all(
        allImages.map(async (image) => {
          let username = '익명';
          let memberType = 'free';

          if (image.userId) {
            // userId가 숫자인지 확인하여 사용자 조회
            const userIdAsNumber = parseInt(image.userId);
            if (!isNaN(userIdAsNumber)) {
              const user = await db.query.users.findFirst({
                where: eq(users.id, userIdAsNumber),
                columns: {
                  username: true,
                  memberType: true
                }
              });
              if (user) {
                username = user.username;
                memberType = user.memberType || 'free';
              }
            }
          }

          return {
            ...image,
            user: {
              username,
              memberType
            }
          };
        })
      );

      console.log(`✅ [관리자] ${imagesWithUsers.length}개 이미지 조회됨 (전체: ${total}개)`);

      // URL 변환 함수 - SignedURL을 직접 공개 URL로 변환
      const convertToDirectUrl = (url: string): string => {
        if (!url) return url;
        try {
          if (url.includes('GoogleAccessId=') || url.includes('Signature=')) {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            if (pathname.includes('/createtree-upload/')) {
              const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
              return `https://storage.googleapis.com/createtree-upload/${filePath}`;
            }
          }
          return url;
        } catch (error) {
          return url;
        }
      };

      // 관리자용 데이터 변환 (썸네일 우선)
      const optimizedImages = imagesWithUsers.map(img => {
        // 썸네일 URL 우선 사용
        let displayUrl = "";

        if (img.thumbnailUrl) {
          const thumbUrl = generatePublicUrl(img.thumbnailUrl);
          displayUrl = thumbUrl ? convertToDirectUrl(thumbUrl) : img.thumbnailUrl;
        } else if (img.transformedUrl && !img.transformedUrl.startsWith('data:')) {
          const transformUrl = generatePublicUrl(img.transformedUrl);
          displayUrl = transformUrl ? convertToDirectUrl(transformUrl) : img.transformedUrl;
        } else if (img.originalUrl && !img.originalUrl.startsWith('data:')) {
          const origUrl = generatePublicUrl(img.originalUrl);
          displayUrl = origUrl ? convertToDirectUrl(origUrl) : img.originalUrl;
        } else {
          displayUrl = `/api/placeholder?id=${img.id}&text=Loading`;
        }

        // 각 URL 필드도 변환 적용
        const thumbUrl = img.thumbnailUrl ? generatePublicUrl(img.thumbnailUrl) : '';
        const transformUrl = img.transformedUrl && !img.transformedUrl.startsWith('data:') ? generatePublicUrl(img.transformedUrl) : '';
        const origUrl = img.originalUrl ? generatePublicUrl(img.originalUrl) : '';

        return {
          id: img.id,
          title: img.title || `이미지 ${img.id}`,
          url: displayUrl, // 썸네일 우선
          thumbnailUrl: thumbUrl ? convertToDirectUrl(thumbUrl) : "",
          transformedUrl: transformUrl ? convertToDirectUrl(transformUrl) : "",
          originalUrl: origUrl ? convertToDirectUrl(origUrl) : "",
          categoryId: img.categoryId,
          style: img.style,
          createdAt: img.createdAt,
          userId: img.userId,
          username: img.user?.username || '알 수 없음',
          userType: img.user?.memberType || 'free'
        };
      });

      res.json({
        images: optimizedImages,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      console.error("❌ [관리자] 이미지 조회 오류:", error);
      res.status(500).json({ error: "이미지 조회에 실패했습니다." });
    }
  });

  app.get("/api/images", requireAuth, async (req, res) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      const category = req.query.category as string;
      console.log(`🔍 이미지 조회 - 사용자: ${userId}, 카테고리: ${category || '전체'}`);

      // 필터 조건 설정
      const whereConditions = [eq(images.userId, String(userId))];

      // 카테고리 필터 적용
      if (category && category !== 'all') {
        whereConditions.push(eq(images.categoryId, category));
      }

      // DB 조회 (카테고리 필터 포함)
      const userImages = await db.query.images.findMany({
        where: and(...whereConditions),
        orderBy: desc(images.createdAt),
        limit: 50
      });

      console.log(`✅ ${userImages.length}개 이미지 조회됨 (카테고리: ${category || '전체'})`);

      // URL 변환 함수 - SignedURL을 직접 공개 URL로 변환
      const convertToDirectUrl = (url: string): string => {
        if (!url) return url;
        try {
          // SignedURL인 경우 직접 공개 URL로 변환
          if (url.includes('GoogleAccessId=') || url.includes('Signature=')) {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            if (pathname.includes('/createtree-upload/')) {
              const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
              return `https://storage.googleapis.com/createtree-upload/${filePath}`;
            }
          }
          // 이미 직접 URL인 경우 그대로 반환
          return url;
        } catch (error) {
          return url;
        }
      };

      // 🎯 클라이언트용 데이터 변환
      const optimizedImages = userImages.map(img => {
        // Base64 데이터 제외하고 파일 경로만 사용
        let displayUrl = "";

        if (img.thumbnailUrl) {
          const thumbUrl = generatePublicUrl(img.thumbnailUrl);
          displayUrl = thumbUrl ? convertToDirectUrl(thumbUrl) : img.thumbnailUrl;
        } else if (img.transformedUrl && !img.transformedUrl.startsWith('data:')) {
          const transformUrl = generatePublicUrl(img.transformedUrl);
          displayUrl = transformUrl ? convertToDirectUrl(transformUrl) : img.transformedUrl;
        } else if (img.originalUrl && !img.originalUrl.startsWith('data:')) {
          const origUrl = generatePublicUrl(img.originalUrl);
          displayUrl = origUrl ? convertToDirectUrl(origUrl) : img.originalUrl;
        } else {
          // Base64인 경우 플레이스홀더 사용
          displayUrl = `/api/placeholder?id=${img.id}&text=Loading`;
        }

        // 각 URL 필드도 변환 적용
        const thumbUrl = img.thumbnailUrl ? generatePublicUrl(img.thumbnailUrl) : '';
        const transformUrl = img.transformedUrl && !img.transformedUrl.startsWith('data:') ? generatePublicUrl(img.transformedUrl) : '';
        const origUrl = img.originalUrl ? generatePublicUrl(img.originalUrl) : '';

        return {
          id: img.id,
          title: img.title || "",
          url: displayUrl,
          thumbnailUrl: thumbUrl ? convertToDirectUrl(thumbUrl) : "",
          transformedUrl: transformUrl ? convertToDirectUrl(transformUrl) : "",
          originalUrl: origUrl ? convertToDirectUrl(origUrl) : "",
          createdAt: img.createdAt?.toISOString() || "",
          categoryId: img.categoryId
        };
      });

      console.log(`🚀 이미지 API 완료`);

      res.json({ images: optimizedImages });

    } catch (error: any) {
      console.error(`❌ 이미지 API 오류:`, error);
      res.status(500).json({ error: "서버 오류" });
    }
  });

  // JWT 기반 최근 이미지 조회 API (사용자 메모리 컬렉션용)
  app.get("/api/image/recent", requireAuth, async (req, res) => {
    try {
      // 캐싱 방지 헤더 추가
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');

      // JWT에서 인증된 사용자 정보 가져오기
      const userId = req.user!.userId;
      const username = req.user!.username;

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const category = req.query.category as string; // 'maternity', 'family', 'sticker'

      // JWT 인증 후 항상 해당 사용자의 이미지만 필터링
      console.log(`[최근 이미지 API] JWT 인증된 사용자 ${username} (ID: ${userId})의 최근 이미지 조회`);

      // 여러 개의 이미지를 얻기 위해 제한을 높임
      const dbLimit = Math.max(30, limit * 3); // 최소 30개 또는 요청한 limit의 3배

      console.log(`[최근 이미지 API] 데이터베이스에서 ${dbLimit}개의 이미지를 가져오는 중...`);

      // 초고속 직접 DB 쿼리로 교체
      const dbImages = await db
        .select()
        .from(images)
        .where(eq(images.userId, String(userId)))
        .orderBy(desc(images.createdAt))
        .limit(dbLimit);

      // 필터링 조건 완화: 최근 24시간 내의 이미지도 포함 (1시간→24시간)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24시간 전 타임스탬프

      let recentImages = dbImages
        .filter(img => {
          // createdAt이 24시간 이내인 이미지 포함
          const createTime = new Date(img.createdAt);
          return createTime > dayAgo;
        })
        .slice(0, limit); // 요청한 제한으로 결과 제한

      // 결과 개수가 부족하면 시간 제한 없이 최근 이미지 포함
      if (recentImages.length < limit) {
        console.log(`[최근 이미지 API] 24시간 이내 이미지가 ${recentImages.length}개로 부족합니다. 시간 제한 없이 최근 이미지를 포함합니다.`);

        // 이미 포함된 이미지 ID 집합
        const existingIds = new Set(recentImages.map(img => img.id));

        // 시간 제한 없이 추가 이미지를 포함
        const additionalImages = dbImages
          .filter(img => !existingIds.has(img.id)) // 중복 방지
          .slice(0, limit - recentImages.length); // 남은 제한까지만 추가

        // 결합
        recentImages = [...recentImages, ...additionalImages];
      }

      // 카테고리별 필터링 적용
      if (category) {
        const originalCount = recentImages.length;
        recentImages = recentImages.filter((image: any) => {
          const style = image.style?.toLowerCase() || '';
          const title = image.title?.toLowerCase() || '';

          switch (category) {
            case 'maternity':
              return style.includes('maternity') || style.includes('만삭') ||
                     title.includes('만삭') || style.includes('goddess') ||
                     style.includes('ethereal') || style.includes('vintage') ||
                     style.includes('_________') || title.includes('여신');
            case 'family':
              return style.includes('family') || style.includes('가족') ||
                     title.includes('가족') || style.includes('modern_minimalist');
            case 'sticker':
              return style.includes('sticker') || style.includes('스티커') ||
                     title.includes('스티커') || style.includes('chibi') ||
                     style.includes('star') || style.includes('cute');
            default:
              return true;
          }
        });
        console.log(`[최근 이미지 API] 카테고리 '${category}' 필터링: ${originalCount}개 → ${recentImages.length}개`);
      }

      console.log(`[최근 이미지 API] 전체 ${dbImages.length}개 중 ${recentImages.length}개 이미지 반환 (사용자: ${userId || 'None'})`);

      // URL 변환 함수 - SignedURL을 직접 공개 URL로 변환
      const convertToDirectUrl = (url: string): string => {
        if (!url) return url;
        try {
          // SignedURL인 경우 직접 공개 URL로 변환
          if (url.includes('GoogleAccessId=') || url.includes('Signature=')) {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            if (pathname.includes('/createtree-upload/')) {
              const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
              return `https://storage.googleapis.com/createtree-upload/${filePath}`;
            }
          }
          // 이미 직접 URL인 경우 그대로 반환
          return url;
        } catch (error) {
          return url;
        }
      };

      // 이미지 URL 변환 적용
      const convertedImages = recentImages.map((img: any) => {
        const thumbUrl = img.thumbnailUrl ? generatePublicUrl(img.thumbnailUrl) : '';
        const transformUrl = img.transformedUrl ? generatePublicUrl(img.transformedUrl) : '';
        const origUrl = img.originalUrl ? generatePublicUrl(img.originalUrl) : '';

        return {
          ...img,
          thumbnailUrl: thumbUrl ? convertToDirectUrl(thumbUrl) : img.thumbnailUrl,
          transformedUrl: transformUrl ? convertToDirectUrl(transformUrl) : img.transformedUrl,
          originalUrl: origUrl ? convertToDirectUrl(origUrl) : img.originalUrl
        };
      });

      // 디버깅: 각 이미지의 기본 정보를 로그로 출력
      convertedImages.forEach((img: any, index: number) => {
        let metadataInfo = '없음';
        if (img.metadata) {
          try {
            const metadata = typeof img.metadata === 'string'
              ? JSON.parse(img.metadata)
              : img.metadata;
            metadataInfo = `userId: ${metadata.userId || '없음'}, isShared: ${metadata.isShared || false}`;
          } catch (e) {}
        }

        console.log(`[최근 이미지 ${index+1}/${convertedImages.length}] ID: ${img.id}, 제목: ${img.title}, 생성일: ${new Date(img.createdAt).toISOString()}, 메타데이터: ${metadataInfo}`);
      });

      return res.json(convertedImages);
    } catch (error) {
      console.error("Error fetching recent images:", error);
      return res.status(500).json({ error: "Failed to fetch recent images" });
    }
  });

  // 🎯 만삭사진/가족사진 이미지 생성 API (파일 업로드 + 변수 지원) - 3단계 변환 전용
  app.post("/api/generate-image", requireAuth, requirePremiumAccess, requireActiveHospital(), (req, res, next) => {
    console.log("🚀 [이미지 생성] API 호출 시작");
    console.log("- Content-Type:", req.headers['content-type']);
    console.log("- Authorization:", req.headers.authorization ? '존재함' : '없음');

    upload.single("image")(req, res, (err) => {
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
  }, async (req, res) => {
    try {
      console.log("📁 [파일 확인] 업로드된 파일:", req.file ? req.file.filename : '없음');

      const { style, variables, model, categoryId = "mansak_img" } = req.body;

      if (!style) {
        console.log("❌ [이미지 생성] 스타일이 선택되지 않음");
        return res.status(400).json({ error: "스타일을 선택해주세요" });
      }

      console.log("📝 [이미지 생성] 요청 정보:");
      console.log("- 파일:", req.file ? req.file.filename : '없음');
      console.log("- 스타일:", style);
      console.log("- 변수:", variables);
      console.log("- 모델:", model);
      console.log("- 카테고리:", categoryId);
      console.log("📋 [디버깅] 전체 req.body:", JSON.stringify(req.body, null, 2));

      // 사용자 ID 확인 및 검증
      const userId = validateUserId(req, res);
      if (!userId) return;

      // 필요한 모듈들을 먼저 import
      const pathModule = await import('path');
      const fsModule = await import('fs');
      const fetch = (await import('node-fetch')).default;
      const sharp = (await import('sharp')).default;
      const { v4: uuidv4 } = await import('uuid');

      // 변수 파싱
      let parsedVariables = {};
      if (variables) {
        try {
          parsedVariables = typeof variables === 'string' ? JSON.parse(variables) : variables;
          console.log("✅ [이미지 생성] 변수 파싱 성공:", parsedVariables);
        } catch (e) {
          console.log("⚠️ [이미지 생성] 변수 파싱 실패, 기본값 사용");
        }
      }

      // 🎨 컨셉별 프롬프트 생성
      let prompt = "A beautiful portrait with professional lighting and artistic styling";
      let systemPrompt: string | null = null;
      let finalModel: string; // 🔥 함수 레벨에서 finalModel 선언

      // 컨셉 정보 조회
      console.log(`🔍 [컨셉 조회] ${style} 컨셉 검색 중...`);

      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, style)
      });

      if (concept) {
        console.log(`📋 [컨셉 발견] ${style} 컨셉 정보:`, {
          title: concept.title,
          hasSystemPrompt: !!(concept.systemPrompt && concept.systemPrompt.trim()),
          hasPromptTemplate: !!(concept.promptTemplate && concept.promptTemplate.trim()),
          availableModels: concept.availableModels
        });

        // 🔒 요청된 모델 검증 (잘못된 모델 요청 시 400 에러 반환)
        const modelValidation = await validateRequestedModel(model, concept.availableModels as string[] | null | undefined);
        if (!modelValidation.isValid && modelValidation.error) {
          console.log(`❌ [모델 검증 실패] ${modelValidation.error.requestedModel}는 지원되지 않는 모델입니다`);
          return res.status(400).json({
            error: modelValidation.error.message,
            requestedModel: modelValidation.error.requestedModel,
            allowedModels: modelValidation.error.allowedModels
          });
        }

        // 🔒 AI 모델 결정 (요청 모델 → 컨셉 제한 → 시스템 기본값)
        finalModel = await resolveAiModel(model, concept.availableModels as string[] | null | undefined);
        console.log(`✅ [AI 모델 결정] 최종 선택된 모델: ${finalModel} (요청: ${model || 'none'})`);

        // systemPrompt가 있으면 systemPrompt를 사용하고, promptTemplate는 최종 프롬프트로 사용
        if (concept.systemPrompt && concept.systemPrompt.trim() !== '') {
          console.log(`🎯 [시스템 프롬프트] 적용:`, concept.systemPrompt.substring(0, 100) + "...");
          systemPrompt = concept.systemPrompt;

          // 공통 변수 치환 함수 사용 (기존 {var}와 새로운 {{var}} 형식 모두 지원)
          if (parsedVariables && Object.keys(parsedVariables).length > 0) {
            console.log(`🔄 [변수 치환] 시스템 프롬프트에 변수 적용 중...`);
            systemPrompt = applyTemplateVariables(systemPrompt, parsedVariables);
          }
        }

        // 기본 프롬프트 템플릿 적용
        if (concept.promptTemplate && concept.promptTemplate.trim() !== '') {
          console.log(`🎯 [프롬프트 템플릿] 적용:`, concept.promptTemplate.substring(0, 100) + "...");
          prompt = concept.promptTemplate;

          // 공통 변수 치환 함수 사용 (기존 {var}와 새로운 {{var}} 형식 모두 지원)
          if (parsedVariables && Object.keys(parsedVariables).length > 0) {
            console.log(`🔄 [변수 치환] 프롬프트 템플릿에 변수 적용 중...`);
            prompt = applyTemplateVariables(prompt, parsedVariables);
          }
        }
      } else {
        console.log(`❌ [컨셉 미발견] ${style} 컨셉을 찾을 수 없습니다.`);
        // 🔥 컨셉이 없을 때는 요청된 모델이나 기본값 사용
        finalModel = await resolveAiModel(model, null);
        console.log(`✅ [AI 모델 결정] 기본 모델 사용: ${finalModel} (요청: ${model || 'none'})`);
      }

      console.log("🎨 [이미지 생성] 최종 프롬프트:", prompt);
      if (systemPrompt) {
        console.log("🔧 [시스템 프롬프트] 전달됨:", systemPrompt.substring(0, 100) + "...");
      }

      // 파일 버퍼 처리 - 메모리 저장 방식 지원
      let imageBuffer: Buffer;

      // req.file 존재 여부 확인 (텍스트 전용 이미지 생성은 파일 없이도 가능)
      const isTextOnlyGeneration = !req.file;
      console.log(`📝 [이미지 생성 모드] ${isTextOnlyGeneration ? '텍스트 전용 생성' : '이미지 변환'}`);
      
      if (isTextOnlyGeneration && finalModel === "gemini") {
        console.error("❌ [Gemini 제한] Gemini는 텍스트→이미지 생성을 지원하지 않습니다");
        return res.status(400).json({
          success: false,
          message: "Gemini 모델은 텍스트 전용 이미지 생성을 지원하지 않습니다. OpenAI 모델을 선택해주세요."
        });
      }

      // 파일이 있는 경우에만 파일 처리 실행
      if (req.file) {
        if (req.file.buffer && req.file.buffer.length > 0) {
          // 메모리 저장 방식
          imageBuffer = req.file.buffer;
          console.log("📁 메모리 기반 파일 처리:", imageBuffer.length, 'bytes');
        } else if (req.file.path) {
          // 디스크 저장 방식 - 파일 경로에서 읽기
          try {
            imageBuffer = await fs.promises.readFile(req.file.path);
            console.log("📁 디스크 기반 파일 처리:", imageBuffer.length, 'bytes');
          } finally {
            // 파일 읽기 성공/실패와 관계없이 임시 파일 삭제
            try {
              await fs.promises.unlink(req.file.path);
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
      } else {
        console.log("📝 [텍스트 전용 생성] 파일 없이 텍스트로만 이미지를 생성합니다");
      }

      // 🔥 모델에 따른 이미지 생성/변환 프로세스 실행
      let transformedImageUrl: string;
      let downloadedImageBuffer: Buffer | undefined;
      let isTextOnlyHttpUrl = false;

      if (isTextOnlyGeneration) {
        // 텍스트 전용 이미지 생성 (OpenAI만 지원)
        console.log("🔥 [텍스트 전용 생성] OpenAI 텍스트→이미지 생성 시작");
        const openaiService = await import('./services/openai');
        
        // 시스템 프롬프트와 프롬프트를 결합
        const finalPrompt = systemPrompt 
          ? `${systemPrompt}\n\n${prompt}`
          : prompt;
        
        const imageResult = await openaiService.generateImageWithDALLE(finalPrompt);
        console.log("✅ [텍스트 전용 생성] OpenAI 이미지 생성 완료:", imageResult?.substring(0, 100) + "...");
        
        // 이미지 데이터 처리 (OpenAI는 URL 반환)
        if (imageResult && !imageResult.includes('placehold.co')) {
          // OpenAI는 URL을 반환하므로 저장용 플래그 설정
          console.log("🌐 [텍스트 전용 생성] OpenAI URL 반환, saveImageFromUrlToGCS 사용");
          transformedImageUrl = imageResult;
          isTextOnlyHttpUrl = true;
        } else {
          console.error("🚨 [텍스트 전용 생성] 이미지 데이터 처리 실패");
          transformedImageUrl = imageResult; // fallback URL
        }
      } else {
        // 기존 이미지 변환 프로세스
        if (finalModel === "gemini") {
          // Gemini 2.5 Flash Image Preview 사용
          console.log("🚀 [이미지 변환] Gemini 2.5 Flash 프로세스 시작");
          const geminiService = await import('./services/gemini');
          transformedImageUrl = await geminiService.transformWithGemini(
            prompt,
            normalizeOptionalString(systemPrompt),
            imageBuffer!,
            parsedVariables
          );
          console.log("✅ [이미지 변환] Gemini 2.5 변환 결과:", transformedImageUrl);
        } else {
          // 기본값: OpenAI 3단계 변환 프로세스 (GPT-4V + GPT-4o + gpt-image-1)
          console.log("🔥 [이미지 변환] OpenAI 3단계 변환 프로세스 시작");
          const openaiService = await import('./services/openai-dalle3');
          transformedImageUrl = await openaiService.transformWithOpenAI(
            prompt,
            imageBuffer!,
            normalizeOptionalString(systemPrompt),
            parsedVariables
          );
          console.log("✅ [이미지 변환] OpenAI 3단계 변환 결과:", transformedImageUrl);
        }
      }

      if (!transformedImageUrl || transformedImageUrl.includes('placehold.co')) {
        console.error("🚨 이미지 변환 실패");
        return res.status(500).json({
          success: false,
          message: "이미지 변환 중 오류가 발생했습니다."
        });
      }

      // 🔽 이미지 처리 (모델에 따라 다르게 처리)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePath = `${year}/${month}/${day}`;

      let savedImageUrl: string;
      let savedThumbnailUrl: string;

      // userId는 이미 2875줄에서 검증되었으므로 여기서는 String으로만 변환
      const userIdString = String(userId);

      if (isTextOnlyGeneration && transformedImageUrl === "text_only_generation_success") {
        // 텍스트 전용 생성: downloadedImageBuffer가 이미 설정됨
        console.log("🎯 [텍스트 전용 생성] 이미지 Buffer 처리 시작");
        
        // UUID 파일명 생성
        const uuid = uuidv4();
        const filename = `${uuid}.webp`;

        // GCS에 직접 업로드
        const gcsResult = await saveImageToGCS(downloadedImageBuffer!, userIdString, categoryId, filename);
        savedImageUrl = gcsResult.originalUrl;
        savedThumbnailUrl = gcsResult.thumbnailUrl;
        
        console.log("✅ [텍스트 전용 생성] GCS 업로드 완료:", savedImageUrl);
      } else if (finalModel?.toLowerCase() === "gemini" && transformedImageUrl.startsWith('/uploads/')) {
        // Gemini는 이미 로컬에 저장되어 있음
        console.log("✅ [Gemini] 로컬 이미지 경로 사용:", transformedImageUrl);

        // 파일 경로에서 읽기
        const localPath = pathModule.join(process.cwd(), transformedImageUrl.substring(1));
        downloadedImageBuffer = await fsModule.promises.readFile(localPath);

        // UUID 파일명 생성
        const uuid = uuidv4();
        const filename = `${uuid}.webp`;

        // GCS에 업로드
        const gcsResult = await saveImageToGCS(downloadedImageBuffer, userIdString, categoryId, filename);
        savedImageUrl = gcsResult.originalUrl;
        savedThumbnailUrl = gcsResult.thumbnailUrl;
      } else {
        // OpenAI는 원격 URL에서 다운로드
        console.log("🔽 [OpenAI] 이미지 다운로드 시작:", transformedImageUrl);

        // UUID 파일명 생성
        const uuid = uuidv4();
        const filename = `${uuid}.webp`;
        const thumbnailFilename = `${uuid}_thumb.webp`;

        // 디렉토리 경로 설정
        const fullDir = pathModule.join(process.cwd(), 'uploads', 'full', datePath);
        const thumbnailDir = pathModule.join(process.cwd(), 'uploads', 'thumbnails', datePath);

        // 디렉토리 생성
        await fsModule.promises.mkdir(fullDir, { recursive: true });
        await fsModule.promises.mkdir(thumbnailDir, { recursive: true });

        // 이미지 다운로드 및 저장
        const imageResponse = await fetch(transformedImageUrl);
        downloadedImageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        // Full 이미지 저장
        const fullPath = pathModule.join(fullDir, filename);
        await sharp(downloadedImageBuffer)
          .webp({ quality: 85 })
          .toFile(fullPath);

        // 썸네일 생성 및 저장
        const thumbnailPath = pathModule.join(thumbnailDir, thumbnailFilename);
        // 작업지시서: GCS에 직접 업로드, 로컬 저장 제거
        const thumbnailBuffer = await sharp(downloadedImageBuffer)
          .resize(300, 300, { fit: 'cover' })
          .webp({ quality: 75 })
          .toBuffer();

        // GCS에 직접 업로드하고 GCS URL 저장 (실제 사용자 ID 사용)
        const gcsResult = await saveImageToGCS(downloadedImageBuffer, userId, categoryId, filename);
        savedImageUrl = gcsResult.originalUrl;
        savedThumbnailUrl = gcsResult.thumbnailUrl;
      }

      console.log("✅ [GCS 업로드] 완료:", savedImageUrl);

      // 🗄️ 데이터베이스에 이미지 저장 (GCS URL 사용)
      const [savedImage] = await db.insert(images).values({
        title: `생성된 이미지 - ${style}`,
        style: style,
        originalUrl: savedImageUrl, // GCS 원본 이미지 URL
        transformedUrl: savedImageUrl,
        thumbnailUrl: savedThumbnailUrl,
        userId: String(userId),
        categoryId: categoryId,
        conceptId: style,
        metadata: JSON.stringify({
          prompt,
          variables: parsedVariables,
          categoryId: categoryId,
          conceptId: style,
          model: finalModel
        })
      }).returning();

      console.log("✅ [이미지 저장] DB 저장 완료 (GCS URL):", savedImage.id);

      return res.json({
        success: true,
        message: "이미지가 성공적으로 생성되었습니다.",
        image: {
          id: savedImage.id,
          title: savedImage.title,
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
      return res.status(500).json({
        error: "이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 🏠 가족사진 이미지 생성 API (다중 모델 지원)
  app.post("/api/generate-family", requireAuth, requirePremiumAccess, requireActiveHospital(), upload.single("image"), async (req, res) => {
    console.log("🚀 [가족사진 생성] API 호출 시작");

    try {
      if (!req.file) {
        console.log("❌ [가족사진 생성] 파일이 업로드되지 않음");
        return res.status(400).json({ error: "이미지 파일을 업로드해주세요" });
      }

      // 🔍 요청 파라미터 검증
      const requestBodySchema = z.object({
        style: z.string().min(1, "스타일을 선택해주세요"),
        variables: z.union([z.string(), z.object({}).passthrough()]).optional(),
        model: z.string().optional()
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

      const { style, variables, model } = parsedBody;

      // 📋 variables 파싱 처리
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

      // 🎨 컨셉별 프롬프트 생성
      let prompt = "A beautiful family portrait with professional lighting and artistic styling";
      let systemPrompt: string | null = null;
      let finalModel: string; // 🔥 함수 레벨에서 finalModel 선언

      // 컨셉 정보 조회
      console.log(`🔍 [컨셉 조회] ${style} 컨셉 검색 중...`);

      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, style)
      });

      if (concept) {
        console.log(`📋 [컨셉 발견] ${style} 컨셉 정보:`, {
          title: concept.title,
          availableModels: concept.availableModels
        });

        // 🔒 요청된 모델 검증 (잘못된 모델 요청 시 400 에러 반환)
        const modelValidation = await validateRequestedModel(model, concept.availableModels as string[] | null | undefined);
        if (!modelValidation.isValid && modelValidation.error) {
          console.log(`❌ [모델 검증 실패] ${modelValidation.error.requestedModel}는 지원되지 않는 모델입니다`);
          return res.status(400).json({
            error: modelValidation.error.message,
            requestedModel: modelValidation.error.requestedModel,
            allowedModels: modelValidation.error.allowedModels
          });
        }

        // 🔒 AI 모델 결정 (요청 모델 → 컨셉 제한 → 시스템 기본값)
        finalModel = await resolveAiModel(model, concept.availableModels as string[] | null | undefined);
        console.log(`✅ [AI 모델 결정] 최종 선택된 모델: ${finalModel} (요청: ${model || 'none'})`);

        // systemPrompt가 있으면 systemPrompt를 사용하고, promptTemplate는 최종 프롬프트로 사용
        if (concept.systemPrompt && concept.systemPrompt.trim() !== '') {
          systemPrompt = concept.systemPrompt;
          console.log(`🔧 [시스템프롬프트] ${style} 컨셉 시스템프롬프트 사용:`, systemPrompt.substring(0, 100) + "...");
        }

        if (concept.promptTemplate && concept.promptTemplate.trim() !== '') {
          prompt = concept.promptTemplate;
          console.log(`🎯 [프롬프트템플릿] ${style} 컨셉 프롬프트 템플릿 사용:`, prompt);

          // 공통 변수 치환 함수 사용 (기존 {var}와 새로운 {{var}} 형식 모두 지원)
          if (parsedVariables && Object.keys(parsedVariables).length > 0) {
            console.log(`🔄 [변수 치환] 프롬프트 템플릿에 변수 적용 중...`);
            prompt = applyTemplateVariables(prompt, parsedVariables);
          }
        }
      } else {
        console.log(`❌ [컨셉 미발견] ${style} 컨셉을 찾을 수 없습니다.`);
        // 🔥 컨셉이 없을 때는 요청된 모델이나 기본값 사용
        finalModel = await resolveAiModel(model, null);
        console.log(`✅ [AI 모델 결정] 기본 모델 사용: ${finalModel} (요청: ${model || 'none'})`);
      }

      console.log("🎨 [가족사진 생성] 최종 프롬프트:", prompt);
      if (systemPrompt) {
        console.log("🔧 [시스템 프롬프트] 전달됨:", systemPrompt.substring(0, 100) + "...");
      }

      // 파일 버퍼 처리 - 메모리 저장 방식 지원
      let imageBuffer: Buffer;

      if (req.file.buffer && req.file.buffer.length > 0) {
        // 메모리 저장 방식
        imageBuffer = req.file.buffer;
        console.log("📁 메모리 기반 파일 처리:", imageBuffer.length, 'bytes');
      } else if (req.file.path) {
        // 디스크 저장 방식 - 파일 경로에서 읽기
        try {
          imageBuffer = await fs.promises.readFile(req.file.path);
          console.log("📁 디스크 기반 파일 처리:", imageBuffer.length, 'bytes');
        } finally {
          // 파일 읽기 성공/실패와 관계없이 임시 파일 삭제
          try {
            await fs.promises.unlink(req.file.path);
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

      // 🔥 모델에 따른 이미지 변환 프로세스 실행
      let transformedImageUrl: string;

      if (finalModel === "gemini") {
        // Gemini 2.5 Flash Image Preview 사용
        console.log("🚀 [가족사진 생성] Gemini 2.5 Flash 프로세스 시작");
        const geminiService = await import('./services/gemini');
        transformedImageUrl = await geminiService.transformWithGemini(
          prompt,
          normalizeOptionalString(systemPrompt),
          imageBuffer
        );
        console.log("✅ [가족사진 생성] Gemini 2.5 변환 결과:", transformedImageUrl);
      } else {
        // 기본값: OpenAI 3단계 변환 프로세스 (GPT-4V + GPT-4o + gpt-image-1)
        console.log("🔥 [가족사진 생성] OpenAI 3단계 변환 프로세스 시작");
        const openaiService = await import('./services/openai-dalle3');
        transformedImageUrl = await openaiService.transformWithOpenAI(
          prompt,
          imageBuffer,
          normalizeOptionalString(systemPrompt),
          parsedVariables
        );
        console.log("✅ [가족사진 생성] OpenAI 3단계 변환 결과:", transformedImageUrl);
      }

      if (!transformedImageUrl || transformedImageUrl.includes('placehold.co')) {
        console.error("🚨 이미지 변환 실패");
        return res.status(500).json({
          success: false,
          message: "이미지 변환 중 오류가 발생했습니다."
        });
      }

      // 🔽 이미지 처리 (모델에 따라 다르게 처리)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePath = `${year}/${month}/${day}`;

      let downloadedImageBuffer: Buffer;
      let savedImageUrl: string;
      let savedThumbnailUrl: string;
      let gcsResult: any; // GCS 결과 저장용 (전역 선언)

      // 사용자 ID 한 번만 검증 (중복 제거)
      const uid2 = validateUserId(req, res);
      if (!uid2) return;
      const familyUserId = String(uid2);

      if (finalModel?.toLowerCase() === "gemini" && transformedImageUrl.startsWith('/uploads/')) {
        // Gemini는 이미 로컬에 저장되어 있음
        console.log("✅ [Gemini] 로컬 이미지 경로 사용:", transformedImageUrl);

        // 파일 경로에서 읽기
        const normalizedPath = transformedImageUrl.startsWith('/')
          ? transformedImageUrl.substring(1)
          : transformedImageUrl;
        const localFilePath = path.join(process.cwd(), normalizedPath);

        // 비동기 파일 읽기 (이벤트 루프 차단 방지)
        downloadedImageBuffer = await fs.promises.readFile(localFilePath);

        // GCS에 업로드
        const uuid = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const filename = `${uuid}.webp`;

        // GCS에 업로드 (실제 사용자 ID 사용)
        gcsResult = await saveImageToGCS(
          downloadedImageBuffer,
          familyUserId,
          'family_img',
          `family_${style}_generated`
        );
        savedImageUrl = gcsResult.originalUrl;
        savedThumbnailUrl = gcsResult.thumbnailUrl;
      } else {
        // OpenAI: URL에서 다운로드 후 GCS 업로드 (스티커와 동일한 방식)
        console.log("🌐 [OpenAI] URL에서 GCS 업로드:", transformedImageUrl);

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

      // 🗄️ 데이터베이스에 이미지 저장
      // 사용자 ID는 이미 위에서 검증됨 (중복 제거)

      const [savedImage] = await db.insert(images).values({
        title: `family_${style}_generated`,
        transformedUrl: savedImageUrl,
        originalUrl: savedImageUrl, // GCS 원본 이미지 URL (로컬 경로 제거)
        thumbnailUrl: savedThumbnailUrl,
        userId: familyUserId,
        categoryId: "family_img",
        conceptId: style,
        metadata: JSON.stringify({
          prompt,
          variables: parsedVariables,
          categoryId: "family_img",
          conceptId: style,
          // ✅ GCS 경로 정보 저장 (이전 1789번 문제 해결)
          gsPath: gcsResult.gsPath,
          gsThumbnailPath: gcsResult.gsThumbnailPath,
          fileName: gcsResult.fileName,
          storageType: "gcs"
        }),
        style: style
      }).returning();

      console.log("✅ [가족사진 저장] DB 저장 완료:", savedImage.id);

      return res.status(200).json({
        id: savedImage.id,
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

  // 🎭 스티커 이미지 생성 API (다중 모델 지원)
  app.post("/api/generate-stickers", requireAuth, requirePremiumAccess, requireActiveHospital(), upload.single("image"), async (req, res) => {
    console.log("🚀 [스티커 생성] API 호출 시작");

    try {
      // 🆔 JWT에서 사용자 ID 추출 (중요!)
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);
      
      if (!userId) {
        console.log("❌ [스티커 생성] 사용자 ID 누락");
        return res.status(400).json({ error: "사용자 인증 정보가 올바르지 않습니다" });
      }

      console.log(`👤 [스티커 생성] 사용자 ID: ${userId}`);

      // 🔍 요청 파라미터 검증
      const requestBodySchema = z.object({
        style: z.string().min(1, "스타일을 선택해주세요"),
        variables: z.union([z.string(), z.object({}).passthrough()]).optional(),
        model: z.string().optional()
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

      const { style, variables, model } = parsedBody;

      // 🎨 컨셉 정보 먼저 조회 (generationType 확인을 위해)
      console.log(`🔍 [컨셉 조회] ${style} 컨셉 검색 중...`);

      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, style)
      });

      if (!concept) {
        console.log("❌ [스티커 생성] 컨셉을 찾을 수 없음");
        return res.status(400).json({ error: "선택한 스타일을 찾을 수 없습니다" });
      }

      // generationType 확인 후 조건부 파일 검증
      const generationType = concept.generationType || "image_upload";
      const requiresImageUpload = generationType === "image_upload";

      console.log(`📋 [컨셉 발견] ${style} 컨셉 정보:`, {
        title: concept.title,
        generationType: generationType,
        requiresImageUpload: requiresImageUpload,
        availableModels: concept.availableModels
      });

      // 🔒 요청된 모델 검증 (잘못된 모델 요청 시 400 에러 반환)
      const modelValidation = await validateRequestedModel(model, concept.availableModels as string[] | null | undefined);
      if (!modelValidation.isValid && modelValidation.error) {
        console.log(`❌ [모델 검증 실패] ${modelValidation.error.requestedModel}는 지원되지 않는 모델입니다`);
        return res.status(400).json({
          error: modelValidation.error.message,
          requestedModel: modelValidation.error.requestedModel,
          allowedModels: modelValidation.error.allowedModels
        });
      }

      // 🔒 AI 모델 결정 (요청 모델 → 컨셉 제한 → 시스템 기본값)
      const finalModel = await resolveAiModel(model, concept.availableModels as string[] | null | undefined);
      console.log(`✅ [AI 모델 결정] 최종 선택된 모델: ${finalModel} (요청: ${model || 'none'})`);

      // 파일이 필요한 경우에만 파일 검증
      if (requiresImageUpload && !req.file) {
        console.log("❌ [스티커 생성] 이미지 업로드가 필요한 컨셉인데 파일이 업로드되지 않음");
        return res.status(400).json({ error: "이미지 파일을 업로드해주세요" });
      }

      console.log("📝 [스티커 생성] 요청 정보:");
      console.log("- 파일:", req.file?.filename || "없음 (텍스트 전용)");
      console.log("- 스타일:", style);
      console.log("- 변수:", variables);
      console.log("- 생성 방식:", generationType);

      // 필요한 모듈들을 먼저 import
      const pathModule = await import('path');
      const fsModule = await import('fs');
      const fetch = (await import('node-fetch')).default;
      const sharp = (await import('sharp')).default;
      const { v4: uuidv4 } = await import('uuid');

      // 변수 파싱
      let parsedVariables = {};
      if (variables) {
        try {
          parsedVariables = typeof variables === 'string' ? JSON.parse(variables) : variables;
          console.log("✅ [스티커 생성] 변수 파싱 성공:", parsedVariables);
        } catch (e) {
          console.log("⚠️ [스티커 생성] 변수 파싱 실패, 기본값 사용");
        }
      }

      // 🎨 컨셉별 프롬프트 생성
      let prompt = "A beautiful sticker-style character with clean lines and vibrant colors";
      let systemPrompt: string | null = null;

      // 이미 위에서 조회한 concept 사용 (concept는 항상 존재함 - 위에서 검증함)
      console.log(`📋 [컨셉 발견] ${style} 컨셉 정보:`, {
        title: concept.title,
        hasSystemPrompt: !!(concept.systemPrompt && concept.systemPrompt.trim()),
        hasPromptTemplate: !!(concept.promptTemplate && concept.promptTemplate.trim())
      });

      // 시스템 프롬프트가 있으면 우선 사용
      if (concept.systemPrompt && concept.systemPrompt.trim() !== '') {
        console.log(`🎯 [시스템 프롬프트] 적용:`, concept.systemPrompt.substring(0, 100) + "...");
        systemPrompt = concept.systemPrompt;

        // 공통 변수 치환 함수 사용 (기존 {var}와 새로운 {{var}} 형식 모두 지원)
        if (parsedVariables && Object.keys(parsedVariables).length > 0) {
          console.log(`🔄 [변수 치환] 시스템 프롬프트에 변수 적용 중...`);
          systemPrompt = applyTemplateVariables(systemPrompt, parsedVariables);
        }
      }

      // 기본 프롬프트 템플릿 적용
      if (concept.promptTemplate && concept.promptTemplate.trim() !== '') {
        console.log(`🎯 [프롬프트 템플릿] 적용:`, concept.promptTemplate.substring(0, 100) + "...");
        prompt = concept.promptTemplate;

        // 공통 변수 치환 함수 사용 (기존 {var}와 새로운 {{var}} 형식 모두 지원)
        if (parsedVariables && Object.keys(parsedVariables).length > 0) {
          console.log(`🔄 [변수 치환] 프롬프트 템플릿에 변수 적용 중...`);
          prompt = applyTemplateVariables(prompt, parsedVariables);
        }
      }

      console.log("🎨 [스티커 생성] 최종 프롬프트:", prompt);
      if (systemPrompt) {
        console.log("🔧 [시스템 프롬프트] 전달됨:", systemPrompt.substring(0, 100) + "...");
      }

      // 파일 버퍼 처리 - 파일이 있는 경우에만
      let imageBuffer: Buffer | null = null;

      if (req.file) {
        if (req.file.buffer && req.file.buffer.length > 0) {
          // 메모리 저장 방식
          imageBuffer = req.file.buffer;
          console.log("📁 스티커 생성 - 메모리 기반 파일 처리:", imageBuffer.length, 'bytes');
        } else if (req.file.path) {
          // 디스크 저장 방식 - 파일 경로에서 읽기
          imageBuffer = fs.readFileSync(req.file.path);
          console.log("📁 스티커 생성 - 디스크 기반 파일 처리:", imageBuffer.length, 'bytes');

          // 임시 파일 삭제
          fs.unlinkSync(req.file.path);
        } else {
          console.error("❌ 스티커 생성 - 파일 버퍼와 경로 모두 없음");
          return res.status(500).json({
            success: false,
            message: "업로드된 파일을 처리할 수 없습니다."
          });
        }
      }

      // 🔥 모델에 따른 이미지 변환 프로세스 실행
      let transformedImageUrl: string;

      if (finalModel === "gemini") {
        // Gemini 텍스트→이미지 생성 (스티커 생성은 기존 이미지가 필요하지 않음)
        console.log("🚀 [스티커 생성] Gemini 텍스트→이미지 생성 시작");
        const geminiService = await import('./services/gemini');
        
        // 시스템 프롬프트와 프롬프트를 결합
        const finalPrompt = systemPrompt 
          ? `${systemPrompt}\n\n${prompt}`
          : prompt;
        
        transformedImageUrl = await geminiService.generateImageWithGemini25(finalPrompt);
        console.log("✅ [스티커 생성] Gemini 이미지 생성 결과:", transformedImageUrl);
      } else {
        // OpenAI 텍스트→이미지 생성 (스티커 생성은 기존 이미지가 필요하지 않음)
        console.log("🔥 [스티커 생성] OpenAI 텍스트→이미지 생성 시작");
        const openaiService = await import('./services/openai');
        
        // 시스템 프롬프트와 프롬프트를 결합
        const finalPrompt = systemPrompt 
          ? `${systemPrompt}\n\n${prompt}`
          : prompt;
        
        transformedImageUrl = await openaiService.generateImageWithDALLE(finalPrompt);
        console.log("✅ [스티커 생성] OpenAI 이미지 생성 결과:", transformedImageUrl);
      }

      if (!transformedImageUrl || transformedImageUrl.includes('placehold.co')) {
        console.error("🚨 이미지 변환 실패");
        return res.status(500).json({
          success: false,
          message: "이미지 변환 중 오류가 발생했습니다."
        });
      }

      // 🔽 이미지를 GCS에 직접 저장 (썸네일 자동 생성)
      console.log("📤 [스티커 저장] GCS 저장 시작...");

      // 사용자 ID 올바른 검증
      const uid3 = validateUserId(req, res);
      if (!uid3) return;
      const stickerUserId = String(uid3);

      let imageResult;

      if (finalModel?.toLowerCase() === "gemini" && transformedImageUrl.startsWith('/uploads/')) {
        // Gemini는 이미 로컬에 저장되어 있음
        console.log("✅ [Gemini] 로컬 파일에서 GCS 업로드:", transformedImageUrl);

        // 올바른 로컬 파일 경로 처리 (가족사진과 동일한 방식)
        const normalizedPath = transformedImageUrl.startsWith('/')
          ? transformedImageUrl.substring(1)
          : transformedImageUrl;
        const localFilePath = path.join(process.cwd(), normalizedPath);

        try {
          // 비동기 파일 읽기 (이벤트 루프 차단 방지)
          const imageBuffer = await fs.promises.readFile(localFilePath);

          imageResult = await saveImageToGCS(
            imageBuffer,
            stickerUserId,
            'sticker_img',
            `sticker_${style}_generated`
          );
        } catch (fileError) {
          console.error("❌ [Gemini] 로컬 파일 읽기 실패:", fileError);
          return res.status(500).json({
            error: "생성된 이미지 파일을 읽을 수 없습니다."
          });
        }
      } else {
        // OpenAI: URL에서 다운로드 후 GCS 업로드
        console.log("🌐 [OpenAI] URL에서 GCS 업로드:", transformedImageUrl);
        const { saveImageFromUrlToGCS } = await import('./utils/gcs-image-storage');
        imageResult = await saveImageFromUrlToGCS(
          transformedImageUrl,
          String(userId),  // 👈 안전하게 문자열로 변환
          'sticker_img',
          `sticker_${style}_generated`
        );
      }

      console.log("✅ [스티커 저장] GCS 저장 완료:", imageResult.originalUrl);

      // 🗄️ 데이터베이스에 이미지 저장
      // 사용자 ID는 이미 위에서 검증됨 (중복 제거)

      const [savedImage] = await db.insert(images).values({
        title: `sticker_${style}_generated`,
        transformedUrl: imageResult.originalUrl,
        originalUrl: imageResult.originalUrl,
        thumbnailUrl: imageResult.thumbnailUrl,
        userId: String(userId),
        categoryId: "sticker_img",
        conceptId: style,
        metadata: JSON.stringify({
          prompt,
          variables: parsedVariables,
          categoryId: "sticker_img",
          conceptId: style,
          gsPath: imageResult.gsPath,
          gsThumbnailPath: imageResult.gsThumbnailPath,
          fileName: imageResult.fileName,
          storageType: 'gcs'
        }),
        style: style
      }).returning();

      console.log("✅ [스티커 저장] DB 저장 완료:", savedImage.id);

      return res.status(200).json({
        id: savedImage.id,
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
      return res.status(500).json({
        error: "스티커 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Chat endpoints
  app.post("/api/chat/message", async (req, res) => {
    try {
      const validatedData = chatMessageSchema.parse(req.body);

      // Check if this is an ephemeral request
      const isEphemeral = req.query.ephemeral === 'true';

      let userMessage, assistantMessage;

      // Generate AI response with persona's system prompt if provided
      const aiResponse = await generateChatResponse(
        validatedData.message,
        validatedData.personaSystemPrompt
      );

      if (isEphemeral) {
        // For ephemeral messages, we don't save to database
        // Just create response objects with the content
        userMessage = {
          id: Date.now(),
          role: "user",
          content: validatedData.message,
          createdAt: new Date().toISOString(),
        };

        assistantMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: aiResponse,
          createdAt: new Date().toISOString(),
        };
      } else {
        // 채팅 메시지 저장 기능 비활성화 (데이터베이스 정리로 인해)
      }

      return res.json({
        userMessage,
        assistantMessage,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error sending chat message:", error);
      return res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  app.get("/api/chat/history", async (req, res) => {
    try {
      const chatHistory = await storage.getChatHistory();
      return res.json(chatHistory);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      return res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  // SignedURL을 직접 공개 URL로 변환하는 중앙 집중식 함수
  const convertSignedUrlToDirectUrl = (url: string): string => {
    if (!url) return url;

    // SignedURL 감지 및 변환
    if (url.includes('GoogleAccessId=') || url.includes('Signature=')) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        if (pathname.includes('/createtree-upload/')) {
          const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
          const directUrl = `https://storage.googleapis.com/createtree-upload/${filePath}`;
          console.log(`[URL 변환] SignedURL → 직접 URL: ${directUrl}`);
          return directUrl;
        }
      } catch (error) {
        console.log(`[URL 변환] 파싱 오류, 원본 유지: ${url}`);
      }
    }

    return url;
  };

  // GCS 공개 URL 생성 공통 함수
  const generatePublicUrl = (imagePath: string): string | null => {
    try {
      if (!imagePath) return null;

      // 이미 완전한 HTTP URL인 경우 SignedURL 변환 적용
      if (imagePath.startsWith('http')) {
        return convertSignedUrlToDirectUrl(imagePath);
      }

      // gs:// 형식인 경우 공개 URL로 변환
      if (imagePath.startsWith('gs://')) {
        const bucketName = imagePath.split('/')[2];
        const filePath = imagePath.split('/').slice(3).join('/');
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
        return publicUrl;
      }

      // 상대 경로인 경우 createtree-upload 버킷 사용
      if (imagePath.startsWith('images/') || imagePath.includes('.webp')) {
        const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
        const publicUrl = `https://storage.googleapis.com/createtree-upload/${cleanPath}`;
        return publicUrl;
      }

      // static 경로는 로컬 서빙 유지
      if (imagePath.startsWith('/static/')) {
        return imagePath;
      }

      // 로컬 콜라주 경로는 로컬 서빙 유지 (/uploads/collages/)
      if (imagePath.startsWith('/uploads/collages/')) {
        return imagePath;
      }

      // GCS 콜라주 경로 처리 (collages/)
      if (imagePath.startsWith('collages/')) {
        return `https://storage.googleapis.com/createtree-upload/${imagePath}`;
      }

      // 기타 경우 createtree-upload 버킷 기본 경로 사용
      const publicUrl = `https://storage.googleapis.com/createtree-upload/${imagePath}`;
      return publicUrl;
    } catch (error) {
      console.error('GCS 공개 URL 생성 실패:', error);
      return null;
    }
  };

  // Gallery endpoints - 간소화된 이미지 갤러리
  app.get("/api/gallery", requireAuth, async (req, res) => {
    try {
      const filter = req.query.filter as string;
      const userId = req.user!.id;
      console.log(`[갤러리 API] 사용자 ${userId} 개인 갤러리 요청 - 필터: ${filter || 'all'}`);

      // 모든 사용자는 본인이 생성한 이미지만 조회 가능
      let whereCondition;
      if (filter && filter !== 'all') {
        // collage는 style 필터, 나머지는 categoryId 필터
        if (filter === 'collage') {
          whereCondition = and(
            eq(images.userId, userId.toString()),
            eq(images.style, 'collage')
          );
        } else {
          whereCondition = and(
            eq(images.userId, userId.toString()),
            eq(images.categoryId, filter)
          );
        }
      } else {
        whereCondition = eq(images.userId, userId.toString());
      }

      // 개인 이미지만 조회 (모든 이미지 표시)
      const imageItems = await db.query.images.findMany({
        where: whereCondition,
        orderBy: desc(images.createdAt)
      });

      const galleryItems = imageItems.map(image => {
        // SignedURL을 직접 공개 URL로 변환하는 간단한 함수
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

        // 썸네일이 없거나 접근 불가능한 경우 원본 이미지 사용
        let thumbnailUrl = transformedUrl;
        if (image.thumbnailUrl) {
          const thumbUrl = generatePublicUrl(image.thumbnailUrl);
          thumbnailUrl = thumbUrl ? convertToDirectUrl(thumbUrl) : transformedUrl;
        }

        return {
          id: image.id,
          title: image.title || `생성된 이미지 - ${image.style || '스타일'}`,
          type: image.style === 'collage' ? 'collage' as const : image.categoryId || 'image' as const,
          url: thumbnailUrl, // 갤러리에서는 썸네일 우선, 없으면 원본
          transformedUrl: transformedUrl,
          thumbnailUrl: thumbnailUrl,
          originalUrl: originalUrl,
          style: image.style || '',
          userId: image.userId,
          createdAt: image.createdAt.toISOString(),
          isFavorite: false
        };
      });

      console.log(`[갤러리 API] 전체 ${galleryItems.length}개 이미지 반환`);
      res.json(galleryItems);
    } catch (error) {
      console.error('[갤러리 API] 오류:', error);
      res.status(500).json({ error: '갤러리 로딩 실패' });
    }
  });

  app.post("/api/gallery/favorite", async (req, res) => {
    try {
      res.json({ success: true, message: "즐겨찾기 기능은 현재 비활성화됨" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error toggling favorite:", error);
      return res.status(500).json({ error: "Failed to toggle favorite" });
    }
  });

  // 갤러리 이미지 삭제 API
  app.delete("/api/gallery/:id", requireAuth, async (req, res) => {
    try {
      const imageId = parseInt(req.params.id);
      const userId = req.user!.id;

      if (isNaN(imageId)) {
        return res.status(400).json({ error: "유효하지 않은 이미지 ID입니다." });
      }

      // 이미지 존재 여부 및 소유권 확인
      const existingImage = await db.query.images.findFirst({
        where: and(
          eq(images.id, imageId),
          eq(images.userId, userId.toString())
        )
      });

      if (!existingImage) {
        return res.status(404).json({ error: "이미지를 찾을 수 없거나 삭제 권한이 없습니다." });
      }

      // 이미지 삭제
      await db.delete(images).where(
        and(
          eq(images.id, imageId),
          eq(images.userId, userId.toString())
        )
      );

      console.log(`[갤러리 삭제] 이미지 ID ${imageId} 삭제 완료`);

      res.json({
        success: true,
        message: "이미지가 성공적으로 삭제되었습니다.",
        deletedId: imageId
      });
    } catch (error) {
      console.error("[갤러리 삭제] 오류:", error);
      res.status(500).json({ error: "이미지 삭제 중 오류가 발생했습니다." });
    }
  });

  // Media management endpoints
  // OPTIONS 요청을 위한 헤더 추가
  app.options("/api/media/download/:type/:id", (req, res) => {
    res.header('Allow', 'GET, HEAD, OPTIONS');
    res.status(200).end();
  });

  // HEAD 요청 처리 추가 (다운로드 검증용)
  app.head("/api/media/download/:type/:id", async (req, res) => {
    try {
      const { type, id } = req.params;
      const parsedId = parseInt(id);

      if (type !== "music" && type !== "image") {
        return res.status(400).end();
      }

      // 세션 이미지 확인 또는 DB 조회
      let url = '';
      let contentType = '';

      if (type === "image" && parsedId === -1 && req.session && req.session.tempImage) {
        url = req.session.tempImage.transformedUrl;
        contentType = 'image/jpeg';

        // 로컬 파일이 있으면 성공 응답
        if (req.session.tempImage.localFilePath && fs.existsSync(req.session.tempImage.localFilePath)) {
          res.setHeader('Content-Type', contentType);
          return res.status(200).end();
        }
      } else {
        // DB 조회
        const mediaItem = await storage.getMediaItem(parsedId, type);
        if (!mediaItem) {
          return res.status(404).end();
        }

        if (type === "music") {
          url = (mediaItem as typeof music.$inferSelect).url || '';
          contentType = 'audio/mpeg';
        } else {
          url = (mediaItem as typeof images.$inferSelect).transformedUrl;
          contentType = 'image/jpeg';

          // 로컬 파일 확인
          const urlBasename = path.basename(url);
          const possibleLocalPaths = [
            path.join(process.cwd(), 'uploads', urlBasename),
            path.join(process.cwd(), 'uploads', 'temp', urlBasename)
          ];

          for (const localPath of possibleLocalPaths) {
            if (fs.existsSync(localPath)) {
              res.setHeader('Content-Type', contentType);
              return res.status(200).end();
            }
          }
        }
      }

      // 로컬 파일이 없는 경우 원격 URL 확인
      if (!url.startsWith('http')) {
        url = `https://${url}`;
      }

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          headers: {
            'Accept': 'image/*,audio/*,*/*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        if (!response.ok) {
          return res.status(502).json({
            error: "원격 서버에서 파일을 찾을 수 없습니다",
            url: url
          });
        }

        // 성공 시 컨텐츠 타입 설정
        res.setHeader('Content-Type', response.headers.get('content-type') || contentType);
        return res.status(200).end();
      } catch (error) {
        return res.status(502).json({
          error: "원격 URL에 접근할 수 없습니다",
          url: url,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      console.error("Error in HEAD request:", error);
      return res.status(500).end();
    }
  });

  // 음악 다운로드 전용 엔드포인트 - 간단한 리다이렉트 방식
  app.get("/api/music/:id/download", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      console.log(`[음악 다운로드] 요청 - ID: ${id}`);

      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid music ID" });
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
          const { bucket } = await import('./firebase') as { bucket: any };

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

  // GET 요청 처리 (실제 다운로드)
  app.get("/api/media/download/:type/:id", async (req, res) => {
    try {
      const { type, id } = req.params;
      const parsedId = parseInt(id);

      // CORS 헤더는 중앙 미들웨어에서 처리
      res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin, X-Requested-With');

      if (type !== "music" && type !== "image") {
        return res.status(400).json({ error: "Invalid media type" });
      }

      // 임시 이미지 처리 (-1 ID인 경우 임시 캐시에서 찾기)
      let url = '';
      let filename = '';
      let mediaItem;

      // 세션에서 임시 이미지 확인 (ID가 -1인 경우)
      if (type === "image" && parsedId === -1 && req.session && req.session.tempImage) {
        console.log("임시 이미지 다운로드 요청 처리 중:", req.session.tempImage.title);

        // 로컬 파일 경로가 있으면 직접 파일을 읽어서 반환
        if (req.session.tempImage.localFilePath) {
          try {
            console.log(`로컬 파일에서 읽기: ${req.session.tempImage.localFilePath}`);
            const imageBuffer = fs.readFileSync(req.session.tempImage.localFilePath);
            filename = `${req.session.tempImage.title || 'transformed_image'}.jpg`;

            // 응답 헤더 설정
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

            // 파일 데이터 전송
            return res.send(imageBuffer);
          } catch (fileError) {
            console.error('로컬 파일 읽기 실패:', fileError);
            // 파일 읽기 실패 시 원래 URL 사용
            url = req.session.tempImage.transformedUrl;
            filename = `${req.session.tempImage.title || 'transformed_image'}.jpg`;
          }
        } else {
          // 기존 방식으로 URL에서 읽기
          url = req.session.tempImage.transformedUrl;
          filename = `${req.session.tempImage.title || 'transformed_image'}.jpg`;
        }
      } else {
        // 정상적인 데이터베이스 조회
        try {
          mediaItem = await storage.getMediaItem(parsedId, type);

          if (!mediaItem) {
            return res.status(404).json({ error: "Media not found" });
          }

          if (type === "music") {
            const musicItem = mediaItem as typeof music.$inferSelect;
            url = musicItem.url || '';
            filename = `${musicItem.title || 'music'}.mp3`;

            console.log(`[음악 다운로드] ID: ${parsedId}, URL: ${url}, 파일명: ${filename}`);

            // GCS URL인 경우 SignedURL로 다운로드
            if (url.includes('storage.googleapis.com')) {
              try {
                // GCS 파일 경로 추출 (기존 스트리밍 API와 동일한 로직)
                const urlParts = url.split('/');
                const fileName = urlParts[urlParts.length - 1];
                const filePath = `music/${fileName}`;

                // SignedURL 생성 (기존 스트리밍 API와 동일한 로직)
                const { Storage } = await import('@google-cloud/storage');
                const serviceAccountKey = {
                  type: "service_account",
                  project_id: "createtreeai",
                  private_key_id: "5ae3581cc6a4ccdc012c18c0775fdd51614eee24",
                  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCevUl+Y5xGrsVR\nhWJvr8stawdae+MWgy85E/zHKqN660EOjqY643Y//gp07NIb0XuJWTMbJcZYNLxi\nTcczDyggqPYn2UQUbdKIpp0XbiYkD/GLo1Hqi3CVPsIRa1xRT70S5Yx9q9rkAbxB\n+eF8gdxXQ8y+eIIhJRauZTbK7g5+f9Df8TRyjfofI8WZRNPXsQhqfpwQbp8VJwL8\nDCp7cXI2vIrCq7SbxlD02vdsaSQ97DGVIBF7Nr6QE6otSBxl4fqHYjmx6RfCAynz\nHWH1nOuYxkYszhDjawsVEaXjuGCa6SAzKmgHWaoXAM6V692lm+VLx9/1EO9b+r2I\nzJj5ak2/AgMBAAECggEAAk+gAwGLpWWMdDuTIcBR9GldUJyAMdMz3lWODsJK4n6V9\nG7I2ZA5iYn1nGHE5SAegKkOxiWRsbJzAUxhy3WedkC7Ws5yvmEkHNDggq6uEqf+AO\nEWnMPV166FoMkULVn9MwNym+GbqCRMt6MSSaP4BTEOhyx/bUA8zJwk8TW5f5vsavtxB\n6nyuo+kBS6ow4JVxFgIAs9R1MsvCBpu+OAwnHO4rnQKBgQDKtjIJf19ZccoHTndV\nAsjagQp6hibvDGelVNxq7pQDnZj2z8NH/lEX5KbAyhSHWURi/FHgzmuCybFZqs8d\nsuQd+MJekwsOYs7IONq00Pi9QE1xLMt4DCLhPj29BVa3Rn88/RcQOkCgcITKGs7+\nopqEnJDVKutEXKlykAH3qR0dewKBgQDId+gAwGLpWWMdDuTIcBR9GldUJyAMdMz3\nlWODsJK4n6V9G7I2ZA5iYn1nGHE5SAegKkOxiWRsbJzAUxhy3WedkC7Ws5yvmEkH\nNDggq6uEqf+AOEWnMPV166FoMkULVn9MwNym+GbqCRMt6dL12Px0Q+bBz+qUp9IH\nUQq62KfjjQKBgEg6CLQXnSqqf5iA3cX9ewFXzxr+56pvGhLvnKXBIh3zrkfqmSLy\nu4Qu5Td2CUB8jwBR9P6LrgToxnczhB6J2fvP4bl+3QagMBtpHowklSwhWDaGBm1c\nraTh32+VEmO1C6r4ZppSlypTTQ0R5kUWPMYZXwWFCFTQS1PVec37hLM3AoGBALGM\nYVKpEfGSVZIa6s4LVlomxkmmDWB64j41dVnhPVF/M9bGfORnYcYJbP+uSjltbjOQ\nEPpg7uVA/FehzFIpyA5BRVNKjnzy1bXdNR+fW7LRAoGBAK9yAL+ER3fIIHAHrYkd\nwOo4Agd6gRfVPpR2VclOWgwfG6vCiIccx+j9n4G2muJd5L0ZLGqOQMfKy4WjHdBR\n/SHg1s7YhbtVtddwdluSobZ03q6hztqMkejOaemngTMSvGOk8jlyFfmrgU0OcClf\nnEoJ2Uh1U2PmPz9iZuyUI2GA\n-----END PRIVATE KEY-----\n",
                  client_email: "upload-server@createtree.iam.gserviceaccount.com",
                  client_id: "115537304083050477734",
                  auth_uri: "https://accounts.google.com/o/oauth2/auth",
                  token_uri: "https://oauth2.googleapis.com/token",
                  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/upload-server%40createtree.iam.gserviceaccount.com"
                };

                const storage = new Storage({
                  projectId: 'createtreeai',
                  credentials: serviceAccountKey
                });

                const bucket = storage.bucket('createtree-upload');
                const file = bucket.file(filePath);

                // SignedURL 생성 (24시간 유효)
                const [signedUrl] = await file.getSignedUrl({
                  version: 'v4',
                  action: 'read',
                  expires: Date.now() + 24 * 60 * 60 * 1000, // 24시간
                });

                console.log(`[음악 다운로드] SignedURL 생성: ${signedUrl.substring(0, 100)}...`);

                // 실제 음악 파일 다운로드
                const fetch = await import('node-fetch');
                const response = await fetch.default(signedUrl);

                if (!response.ok) {
                  throw new Error(`GCS 파일 다운로드 실패: ${response.status} ${response.statusText}`);
                }

                const musicBuffer = Buffer.from(await response.arrayBuffer());
                console.log(`[음악 다운로드] 파일 크기: ${musicBuffer.length} bytes`);

                if (musicBuffer.length < 1000) {
                  throw new Error(`다운로드된 파일이 너무 작습니다: ${musicBuffer.length} bytes`);
                }

                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                res.setHeader('Content-Length', musicBuffer.length.toString());

                return res.send(musicBuffer);

              } catch (musicError) {
                console.error(`[음악 다운로드 오류] ID: ${parsedId}:`, musicError);
                return res.status(500).json({
                  error: "음악 파일 다운로드 실패",
                  message: musicError instanceof Error ? musicError.message : String(musicError)
                });
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
          } else {
            const imageItem = mediaItem as typeof images.$inferSelect;
            url = imageItem.transformedUrl;
            filename = `${imageItem.title || 'transformed_image'}.jpg`;

            // uploads 폴더 내에 이미지 파일이 존재하는지 확인
            const urlBasename = path.basename(imageItem.transformedUrl);
            const possibleLocalPaths = [
              path.join(process.cwd(), 'uploads', urlBasename),
              path.join(process.cwd(), 'uploads', 'temp', urlBasename)
            ];

            for (const localPath of possibleLocalPaths) {
              if (fs.existsSync(localPath)) {
                console.log(`로컬에서 이미지 파일 찾음: ${localPath}`);
                try {
                  const imageBuffer = fs.readFileSync(localPath);
                  // 응답 헤더 설정
                  res.setHeader('Content-Type', 'image/jpeg');
                  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                  // 파일 데이터 전송
                  return res.send(imageBuffer);
                } catch (fileError) {
                  console.error('로컬 파일 읽기 실패:', fileError);
                  // 파일 읽기 실패 시 계속 진행 (원격 URL 시도)
                  break;
                }
              }
            }
          }
        } catch (dbError) {
          console.error("DB에서 미디어 조회 실패:", dbError);
          return res.status(500).json({ error: "데이터베이스 조회 실패", message: dbError instanceof Error ? dbError.message : String(dbError) });
        }
      }

      // 이미지 없이 바로 클라이언트에게 URL 반환하는 방식으로 변경
      if (url) {
        console.log(`[미디어 다운로드] ID: ${parsedId}, URL: ${url.substring(0, 50)}...`);

        // base64 데이터인지 확인
        if (url.startsWith('data:')) {
          console.log('✅ Base64 데이터 감지됨. 처리 중...');
          try {
            // data:image/png;base64,... 형태에서 실제 base64 데이터 추출
            const base64Data = url.split(',')[1];
            if (!base64Data) {
              throw new Error('Base64 데이터를 찾을 수 없습니다');
            }

            const buffer = Buffer.from(base64Data, 'base64');
            console.log('Base64 버퍼 크기:', buffer.length, 'bytes');

            // MIME 타입 추출
            const mimeMatch = url.match(/data:([^;]+)/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            console.log('MIME 타입:', mimeType);

            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            console.log('✅ Base64 이미지 전송 완료');
            return res.send(buffer);
          } catch (base64Error) {
            console.error('❌ Base64 데이터 처리 실패:', base64Error);
            return res.status(500).json({ error: "Base64 데이터 처리 중 오류가 발생했습니다." });
          }
        }

        // 🎯 로컬 파일 직접 다운로드 (새로운 파일 시스템)
        if (url.startsWith('/uploads/') || url.startsWith('/static/banner/')) {
          try {
            const fullPath = path.join(process.cwd(), url);
            console.log(`[로컬 다운로드] 파일 경로: ${fullPath}`);

            if (fs.existsSync(fullPath)) {
              // 파일 확장자에 따른 MIME 타입 설정
              const ext = path.extname(fullPath).toLowerCase();
              let contentType = 'image/jpeg';
              let downloadExt = '.jpg';

              if (ext === '.webp') {
                contentType = 'image/webp';
                downloadExt = '.webp';
              } else if (ext === '.png') {
                contentType = 'image/png';
                downloadExt = '.png';
              }

              // 올바른 확장자로 파일명 설정
              const titleWithoutExt = (filename.split('.')[0] || 'image');
              const correctFilename = `${titleWithoutExt}${downloadExt}`;

              console.log(`[다운로드] 파일타입: ${contentType}, 파일명: ${correctFilename}`);

              const fileBuffer = fs.readFileSync(fullPath);
              res.setHeader('Content-Type', contentType);
              res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(correctFilename)}"`);
              res.setHeader('Content-Length', fileBuffer.length.toString());

              return res.send(fileBuffer);
            } else {
              console.log(`[오류] 파일 없음: ${fullPath}`);
            }
          } catch (localFileError) {
            console.error("[로컬 파일 오류]:", localFileError);
          }
        }

        // 🚫 구버전 원격 다운로드 로직 제거
        // 모든 이미지는 로컬 파일 시스템에 저장되어야 함
        console.log(`[오류] 로컬 파일이 아닌 URL: ${url}`);
        return res.status(404).json({
          error: "로컬 파일을 찾을 수 없습니다",
          message: "모든 이미지는 로컬 파일 시스템에 저장되어야 합니다"
        });
      } else {
        return res.status(404).json({ error: "다운로드할 URL을 찾을 수 없습니다." });
      }
    } catch (error) {
      console.error("Error downloading media:", error);
      return res.status(500).json({
        error: "Failed to download media",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/media/share", async (req, res) => {
    try {
      console.log("미디어 공유 요청 수신:", req.body);
      const validatedData = mediaShareSchema.parse(req.body);

      // CORS 헤더는 중앙 미들웨어에서 처리
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin, X-Requested-With');

      try {
        // 임시 이미지 처리 (ID가 -1인 경우)
        if (validatedData.type === 'image' && validatedData.id === -1 && req.session && req.session.tempImage) {
          console.log("임시 이미지 공유 시도:", req.session.tempImage.title);

          // 임시 이미지의 URL 생성
          let shareUrl = '';
          if (req.session.tempImage.localFilePath) {
            // 현재 도메인 기반으로 URL 생성
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const relativePath = req.session.tempImage.localFilePath.replace(process.cwd(), '');
            shareUrl = `${baseUrl}${relativePath.replace(/\\/g, '/').replace('/uploads', '/uploads')}`;
            console.log("임시 이미지 공유 URL 생성:", shareUrl);

            // URL이 올바른 형식인지 확인
            if (!shareUrl.includes('://')) {
              shareUrl = `${req.protocol}://${req.get('host')}${shareUrl.startsWith('/') ? '' : '/'}${shareUrl}`;
            }

            return res.json({
              shareUrl,
              message: "임시 이미지 URL이 생성되었습니다. 이 URL을 통해 미디어를 공유할 수 있습니다."
            });
          }
        }

        // 미디어 아이템 조회
        console.log(`미디어 조회 시도 - ID: ${validatedData.id}, 타입: ${validatedData.type}`);
        const mediaItem = await storage.getMediaItem(
          validatedData.id,
          validatedData.type
        );

        if (!mediaItem) {
          console.error(`미디어 항목을 찾을 수 없음 - ID: ${validatedData.id}, 타입: ${validatedData.type}`);
          return res.status(404).json({
            error: "Media not found",
            message: "공유할 미디어 항목을 찾을 수 없습니다."
          });
        }

        console.log("미디어 항목 찾음:", mediaItem);

        // 미디어 타입에 따라 URL 직접 반환
        let shareUrl = '';
        if (validatedData.type === 'image') {
          const imageItem = mediaItem as typeof images.$inferSelect;
          shareUrl = imageItem.transformedUrl;

          // URL이 로컬 파일 경로인 경우 웹 접근 가능한 URL로 변환
          if (!shareUrl.includes('://')) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            shareUrl = `${baseUrl}${shareUrl.startsWith('/') ? '' : '/'}${shareUrl}`;
          }
        } else if (validatedData.type === 'music') {
          const musicItem = mediaItem as typeof music.$inferSelect;
          shareUrl = musicItem.url || '';

          // URL이 로컬 파일 경로인 경우 웹 접근 가능한 URL로 변환
          if (!shareUrl.includes('://')) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            shareUrl = `${baseUrl}${shareUrl.startsWith('/') ? '' : '/'}${shareUrl}`;
          }
        }

        // URL이 있는 경우 직접 반환
        if (shareUrl) {
          return res.json({
            shareUrl,
            message: "미디어 URL이 생성되었습니다. 이 URL을 통해 미디어를 공유할 수 있습니다."
          });
        }

        // 없는 경우에는 기존 로직 진행
        const shareLink = await storage.createShareLink(
          validatedData.id,
          validatedData.type
        );

        return res.json({ shareUrl: shareLink });
      } catch (lookupError) {
        console.error("미디어 조회 실패:", lookupError);
        return res.status(500).json({
          error: "Media lookup failed",
          message: "미디어 정보를 불러오는 데 실패했습니다."
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error sharing media:", error);
      return res.status(500).json({ error: "Failed to share media" });
    }
  });

  // Saved chat endpoints
  app.post("/api/chat/save", async (req, res) => {
    try {
      const validatedData = saveChatSchema.parse(req.body);

      // Save the chat to the database
      const savedChat = await storage.saveChat(validatedData);

      return res.status(201).json(savedChat);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error saving chat:", error);
      return res.status(500).json({ error: "Failed to save chat" });
    }
  });

  app.get("/api/chat/history", async (req, res) => {
    try {
      const chatHistory = await storage.getChatHistory();
      return res.json(chatHistory);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      return res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  app.get("/api/chat/saved/:id", async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      if (isNaN(chatId)) {
        return res.status(400).json({ error: "Invalid chat ID" });
      }

      const savedChat = await storage.getSavedChat(chatId);

      if (!savedChat) {
        return res.status(404).json({ error: "Saved chat not found" });
      }

      return res.json(savedChat);
    } catch (error) {
      console.error("Error fetching saved chat:", error);
      return res.status(500).json({ error: "Failed to fetch saved chat" });
    }
  });

  app.delete("/api/chat/saved/:id", async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      if (isNaN(chatId)) {
        return res.status(400).json({ error: "Invalid chat ID" });
      }

      const result = await storage.deleteSavedChat(chatId);
      return res.json(result);
    } catch (error) {
      console.error("Error deleting saved chat:", error);
      return res.status(500).json({ error: "Failed to delete saved chat" });
    }
  });

  // Milestone and Pregnancy Profile endpoints

  // Get or update the pregnancy profile
  app.get("/api/pregnancy-profile", requireAuth, async (req, res) => {
    try {
      // JWT에서 userId 추출하고 숫자로 변환
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);

      console.log("[프로필 조회] 사용자 ID:", userId, "타입:", typeof userId);

      const { getOrCreatePregnancyProfile } = await import("./services/milestones");
      const profile = await getOrCreatePregnancyProfile(userId);
      return res.json(profile || { error: "No profile found" });
    } catch (error) {
      console.error("Error fetching pregnancy profile:", error);
      return res.status(500).json({ error: "Failed to fetch pregnancy profile" });
    }
  });

  app.post("/api/pregnancy-profile", requireAuth, async (req, res) => {
    try {
      // JWT에서 userId 추출하고 숫자로 변환
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);

      console.log("[프로필 저장] 사용자 ID:", userId, "타입:", typeof userId);

      const { updatePregnancyProfile } = await import("./services/milestones");
      const profileData = req.body;

      // Ensure dueDate is a proper Date object if provided
      if (profileData.dueDate) {
        profileData.dueDate = new Date(profileData.dueDate);
      }

      const profile = await updatePregnancyProfile(userId, profileData);

      if (!profile) {
        return res.status(400).json({ error: "Failed to update profile - dueDate is required" });
      }

      return res.json(profile);
    } catch (error) {
      console.error("Error updating pregnancy profile:", error);
      return res.status(500).json({ error: "Failed to update pregnancy profile" });
    }
  });

  // Milestone endpoints
  // 모든 마일스톤 조회 (정보형 + 참여형)
  app.get("/api/milestones", async (req, res) => {
    try {
      const { type, hospitalId } = req.query;
      const { getAllMilestones } = await import("./services/milestones");
      const milestones = await getAllMilestones({
        type: type as string,
        hospitalId: hospitalId ? Number(hospitalId) : undefined
      });
      return res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      return res.status(500).json({ error: "Failed to fetch milestones" });
    }
  });

  // 참여형 마일스톤만 조회
  app.get("/api/milestones/campaigns", async (req, res) => {
    try {
      const { hospitalId, status } = req.query;
      const { getCampaignMilestones } = await import("./services/milestones");
      const campaigns = await getCampaignMilestones({
        hospitalId: hospitalId ? Number(hospitalId) : undefined,
        status: status as string
      });
      return res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaign milestones:", error);
      return res.status(500).json({ error: "Failed to fetch campaign milestones" });
    }
  });

  // 모든 마일스톤 카테고리 조회
  app.get("/api/milestone-categories", async (req, res) => {
    try {
      const { getAllMilestoneCategories } = await import("./services/milestones");
      const categories = await getAllMilestoneCategories();
      return res.status(200).json(categories);
    } catch (error) {
      console.error("Error fetching milestone categories:", error);
      return res.status(500).json({
        error: "Failed to fetch milestone categories",
        message: error instanceof Error ? error.message : "마일스톤 카테고리 조회 중 오류가 발생했습니다."
      });
    }
  });

  app.get("/api/milestones/available", requireAuth, async (req, res) => {
    try {
      // JWT에서 userId 추출하고 숫자로 변환
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);

      console.log("[마일스톤 가능 목록] 사용자 ID:", userId, "타입:", typeof userId);

      const { getAvailableMilestones } = await import("./services/milestones");
      const milestones = await getAvailableMilestones(userId);
      return res.json(milestones);
    } catch (error) {
      console.error("Error fetching available milestones:", error);
      return res.status(500).json({ error: "Failed to fetch available milestones" });
    }
  });

  app.get("/api/milestones/completed", requireAuth, async (req, res) => {
    try {
      // JWT에서 userId 추출하고 숫자로 변환
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);

      console.log("[마일스톤 완료 목록] 사용자 ID:", userId, "타입:", typeof userId);

      const { getUserCompletedMilestones } = await import("./services/milestones");
      const milestones = await getUserCompletedMilestones(userId);
      return res.json(milestones);
    } catch (error) {
      console.error("Error fetching completed milestones:", error);
      return res.status(500).json({ error: "Failed to fetch completed milestones" });
    }
  });

  app.post("/api/milestones/:milestoneId/complete", async (req, res) => {
    try {
      // 현재 로그인한 사용자 ID 사용
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }

      const { milestoneId } = req.params;
      const { notes, photoUrl } = req.body;

      console.log("[마일스톤 완료 처리] 사용자 ID:", userId, "마일스톤 ID:", milestoneId);

      const { completeMilestone } = await import("./services/milestones");
      const result = await completeMilestone(userId, milestoneId, notes);

      return res.json(result);
    } catch (error) {
      console.error("Error completing milestone:", error);
      return res.status(500).json({ error: "Failed to complete milestone" });
    }
  });

  // 참여형 마일스톤 신청
  app.post("/api/milestones/applications", requireAuth, async (req, res) => {
    try {
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);
      const { milestoneId, applicationData } = req.body;

      console.log("[마일스톤 신청] 사용자 ID:", userId, "마일스톤 ID:", milestoneId, "신청 데이터:", applicationData);

      const { applyToMilestone } = await import("./services/milestones");
      const application = await applyToMilestone(userId, milestoneId, applicationData);
      return res.status(201).json(application);
    } catch (error) {
      console.error("Error applying to milestone:", error);
      return res.status(500).json({ error: "Failed to apply to milestone" });
    }
  });

  // 사용자의 신청 내역 조회
  app.get("/api/milestones/applications", requireAuth, async (req, res) => {
    try {
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);
      const { status, milestoneId } = req.query;

      console.log("[신청 내역 조회] 사용자 ID:", userId);

      const { getUserApplications } = await import("./services/milestones");
      const applications = await getUserApplications(userId, {
        status: status as string,
        milestoneId: milestoneId as string
      });
      return res.json(applications);
    } catch (error) {
      console.error("Error fetching user applications:", error);
      return res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  // 특정 신청의 상세 정보 조회
  app.get("/api/milestones/applications/:applicationId", requireAuth, async (req, res) => {
    try {
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);
      const { applicationId } = req.params;

      console.log("[신청 상세 조회] 사용자 ID:", userId, "신청 ID:", applicationId);

      const { getApplicationDetails } = await import("./services/milestones");
      const application = await getApplicationDetails(Number(applicationId), userId);
      return res.json(application);
    } catch (error) {
      console.error("Error fetching application details:", error);
      return res.status(500).json({ error: "Failed to fetch application details" });
    }
  });

  // 신청 취소 API
  app.patch("/api/milestones/applications/:applicationId/cancel", requireAuth, async (req, res) => {
    try {
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);
      const { applicationId } = req.params;

      console.log("[신청 취소] 사용자 ID:", userId, "신청 ID:", applicationId);

      const { cancelApplication } = await import("./services/milestones");
      const result = await cancelApplication(Number(applicationId), userId);
      return res.json(result);
    } catch (error) {
      console.error("Error cancelling application:", error);
      return res.status(500).json({ error: "Failed to cancel application" });
    }
  });

  app.get("/api/milestones/stats", requireAuth, async (req, res) => {
    try {
      // JWT에서 userId 추출하고 숫자로 변환
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);

      console.log("[마일스톤 통계] 사용자 ID:", userId, "타입:", typeof userId);

      const { getUserAchievementStats } = await import("./services/milestones");
      const stats = await getUserAchievementStats(userId);
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching achievement stats:", error);
      return res.status(500).json({ error: "Failed to fetch achievement stats" });
    }
  });

  // 권한 시스템 테스트 전용 API
  app.post("/api/test-permissions", requireAuth, requirePremiumAccess, requireActiveHospital(), (req, res) => {
    res.json({
      success: true,
      message: "권한 확인 완료 - 모든 권한 미들웨어를 통과했습니다",
      userInfo: {
        id: req.user?.id,
        memberType: req.user?.memberType,
        hospitalId: req.user?.hospitalId,
        hasPermission: true
      },
      timestamp: new Date().toISOString()
    });
  });

  // Admin-only persona management endpoints
  // Note: In a production app, these would need authentication/authorization

  // Get all personas
  app.get("/api/admin/personas", async (req, res) => {
    try {
      const allPersonas = await db.query.personas.findMany({
        orderBy: (personas, { asc }) => [asc(personas.order)]
      });
      return res.json(allPersonas);
    } catch (error) {
      console.error("Error fetching personas:", error);
      return res.status(500).json({ error: "Failed to fetch personas" });
    }
  });

  // Get a specific persona
  app.get("/api/admin/personas/:id", async (req, res) => {
    try {
      const personaId = req.params.id;

      const persona = await db.query.personas.findFirst({
        where: eq(personas.personaId, personaId)
      });

      if (!persona) {
        return res.status(404).json({ error: "Persona not found" });
      }

      return res.json(persona);
    } catch (error) {
      console.error("Error fetching persona:", error);
      return res.status(500).json({ error: "Failed to fetch persona" });
    }
  });

  // Create a new persona
  app.post("/api/admin/personas", async (req, res) => {
    try {
      const validatedData = personaSchema.parse(req.body);

      // Check if persona with this ID already exists
      const existingPersona = await db.query.personas.findFirst({
        where: eq(personas.personaId, validatedData.personaId)
      });

      if (existingPersona) {
        return res.status(409).json({ error: "A persona with this ID already exists" });
      }

      // Insert new persona
      const [newPersona] = await db.insert(personas).values({
        personaId: validatedData.personaId,
        name: validatedData.name,
        avatarEmoji: validatedData.avatarEmoji,
        description: validatedData.description,
        welcomeMessage: validatedData.welcomeMessage,
        systemPrompt: validatedData.systemPrompt,
        primaryColor: validatedData.primaryColor,
        secondaryColor: validatedData.secondaryColor,
        personality: validatedData.personality,
        tone: validatedData.tone,
        usageContext: validatedData.usageContext,
        emotionalKeywords: validatedData.emotionalKeywords,
        timeOfDay: validatedData.timeOfDay,
        isActive: validatedData.isActive,
        isFeatured: validatedData.isFeatured,
        order: validatedData.order,
        categories: validatedData.categories,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return res.status(201).json(newPersona);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating persona:", error);
      return res.status(500).json({ error: "Failed to create persona" });
    }
  });

  // Update an existing persona
  app.put("/api/admin/personas/:id", async (req, res) => {
    try {
      const personaId = req.params.id;
      const validatedData = personaSchema.parse(req.body);

      // Check if persona exists
      const existingPersona = await db.query.personas.findFirst({
        where: eq(personas.personaId, personaId)
      });

      if (!existingPersona) {
        return res.status(404).json({ error: "Persona not found" });
      }

      // Update persona
      const [updatedPersona] = await db.update(personas)
        .set({
          personaId: validatedData.personaId,
          name: validatedData.name,
          avatarEmoji: validatedData.avatarEmoji,
          description: validatedData.description,
          welcomeMessage: validatedData.welcomeMessage,
          systemPrompt: validatedData.systemPrompt,
          primaryColor: validatedData.primaryColor,
          secondaryColor: validatedData.secondaryColor,
          personality: validatedData.personality,
          tone: validatedData.tone,
          usageContext: validatedData.usageContext,
          emotionalKeywords: validatedData.emotionalKeywords,
          timeOfDay: validatedData.timeOfDay,
          isActive: validatedData.isActive,
          isFeatured: validatedData.isFeatured,
          order: validatedData.order,
          categories: validatedData.categories,
          updatedAt: new Date(),
        })
        .where(eq(personas.personaId, personaId))
        .returning();

      return res.json(updatedPersona);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating persona:", error);
      return res.status(500).json({ error: "Failed to update persona" });
    }
  });

  // Delete a persona
  app.delete("/api/admin/personas/:id", async (req, res) => {
    try {
      const personaId = req.params.id;

      // Check if persona exists
      const existingPersona = await db.query.personas.findFirst({
        where: eq(personas.personaId, personaId)
      });

      if (!existingPersona) {
        return res.status(404).json({ error: "Persona not found" });
      }

      // Delete persona
      await db.delete(personas).where(eq(personas.personaId, personaId));

      return res.json({ success: true, message: "Persona deleted successfully" });
    } catch (error) {
      console.error("Error deleting persona:", error);
      return res.status(500).json({ error: "Failed to delete persona" });
    }
  });

  // Batch import personas (admin-only)
  app.post("/api/admin/personas/batch", async (req, res) => {
    try {
      // Parse as array of persona objects
      const personaBatchSchema = z.array(personaSchema);
      const personaList = personaBatchSchema.parse(req.body);

      const results = [];
      const actions = [];

      // Process each persona in the batch
      for (const validatedData of personaList) {
        try {
          // Check if persona with this ID already exists
          const existingPersona = await db.query.personas.findFirst({
            where: eq(personas.personaId, validatedData.personaId)
          });

          let result;
          let action;

          if (existingPersona) {
            // Update existing persona
            const [updatedPersona] = await db.update(personas)
              .set({
                name: validatedData.name,
                avatarEmoji: validatedData.avatarEmoji,
                description: validatedData.description,
                welcomeMessage: validatedData.welcomeMessage,
                systemPrompt: validatedData.systemPrompt,
                primaryColor: validatedData.primaryColor,
                secondaryColor: validatedData.secondaryColor,
                personality: validatedData.personality,
                tone: validatedData.tone,
                usageContext: validatedData.usageContext,
                emotionalKeywords: validatedData.emotionalKeywords,
                timeOfDay: validatedData.timeOfDay,
                isActive: validatedData.isActive,
                isFeatured: validatedData.isFeatured,
                order: validatedData.order,
                categories: validatedData.categories,
                updatedAt: new Date(),
              })
              .where(eq(personas.personaId, validatedData.personaId))
              .returning();

            result = updatedPersona;
            action = 'updated';
          } else {
            // Create new persona
            const [newPersona] = await db.insert(personas).values({
              personaId: validatedData.personaId,
              name: validatedData.name,
              avatarEmoji: validatedData.avatarEmoji,
              description: validatedData.description,
              welcomeMessage: validatedData.welcomeMessage,
              systemPrompt: validatedData.systemPrompt,
              primaryColor: validatedData.primaryColor,
              secondaryColor: validatedData.secondaryColor,
              personality: validatedData.personality,
              tone: validatedData.tone,
              usageContext: validatedData.usageContext,
              emotionalKeywords: validatedData.emotionalKeywords,
              timeOfDay: validatedData.timeOfDay,
              isActive: validatedData.isActive,
              isFeatured: validatedData.isFeatured,
              order: validatedData.order,
              useCount: 0,
              categories: validatedData.categories,
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning();

            result = newPersona;
            action = 'created';
          }

          results.push(result);
          actions.push(action);
        } catch (error) {
          console.error(`Error processing persona ${validatedData.personaId}:`, error);
          // Continue processing the rest of the batch even if one fails
          results.push({ error: `Failed to process persona ${validatedData.personaId}` });
          actions.push('failed');
        }
      }

      return res.status(201).json({
        success: true,
        count: results.length,
        created: actions.filter(a => a === 'created').length,
        updated: actions.filter(a => a === 'updated').length,
        failed: actions.filter(a => a === 'failed').length,
        results
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error in batch import:", error);
      return res.status(500).json({ error: "Failed to process personas in batch import" });
    }
  });

  // Admin-only persona category management endpoints

  // Get all categories
  app.get("/api/admin/categories", async (req, res) => {
    try {
      const allCategories = await db.query.personaCategories.findMany({
        orderBy: (personaCategories, { asc }) => [asc(personaCategories.order)]
      });
      return res.json(allCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      return res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Get a specific category
  app.get("/api/admin/categories/:id", async (req, res) => {
    try {
      const categoryId = req.params.id;

      const category = await db.query.personaCategories.findFirst({
        where: eq(personaCategories.categoryId, categoryId)
      });

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }

      return res.json(category);
    } catch (error) {
      console.error("Error fetching category:", error);
      return res.status(500).json({ error: "Failed to fetch category" });
    }
  });

  // Create a new category
  app.post("/api/admin/categories", async (req, res) => {
    try {
      const validatedData = personaCategorySchema.parse(req.body);

      // Check if category with this ID already exists
      const existingCategory = await db.query.personaCategories.findFirst({
        where: eq(personaCategories.categoryId, validatedData.categoryId)
      });

      if (existingCategory) {
        return res.status(409).json({ error: "A category with this ID already exists" });
      }

      // Insert new category
      const [newCategory] = await db.insert(personaCategories).values({
        categoryId: validatedData.categoryId,
        name: validatedData.name,
        description: validatedData.description,
        emoji: validatedData.emoji,
        order: validatedData.order,
        isActive: validatedData.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating category:", error);
      return res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Update an existing category
  app.put("/api/admin/categories/:id", async (req, res) => {
    try {
      const categoryId = req.params.id;
      const validatedData = personaCategorySchema.parse(req.body);

      // Check if category exists
      const existingCategory = await db.query.personaCategories.findFirst({
        where: eq(personaCategories.categoryId, categoryId)
      });

      if (!existingCategory) {
        return res.status(404).json({ error: "Category not found" });
      }

      // Update category
      const [updatedCategory] = await db.update(personaCategories)
        .set({
          categoryId: validatedData.categoryId,
          name: validatedData.name,
          description: validatedData.description,
          emoji: validatedData.emoji,
          order: validatedData.order,
          isActive: validatedData.isActive,
          updatedAt: new Date(),
        })
        .where(eq(personaCategories.categoryId, categoryId))
        .returning();

      return res.json(updatedCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating category:", error);
      return res.status(500).json({ error: "Failed to update category" });
    }
  });

  // Delete a category
  app.delete("/api/admin/categories/:id", async (req, res) => {
    try {
      const categoryId = req.params.id;

      // Check if category exists
      const existingCategory = await db.query.personaCategories.findFirst({
        where: eq(personaCategories.categoryId, categoryId)
      });

      if (!existingCategory) {
        return res.status(404).json({ error: "Category not found" });
      }

      // Delete category
      await db.delete(personaCategories).where(eq(personaCategories.categoryId, categoryId));

      return res.json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      return res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // API to increment usage count for a persona (for recommendation engine)
  app.post("/api/personas/:id/use", async (req, res) => {
    try {
      const personaId = req.params.id;

      // Check if persona exists
      const existingPersona = await db.query.personas.findFirst({
        where: eq(personas.personaId, personaId)
      });

      if (!existingPersona) {
        return res.status(404).json({ error: "Persona not found" });
      }

      // Increment use count
      const [updatedPersona] = await db.update(personas)
        .set({
          useCount: (existingPersona.useCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(personas.personaId, personaId))
        .returning();

      return res.json({ success: true, useCount: updatedPersona.useCount });
    } catch (error) {
      console.error("Error incrementing persona use count:", error);
      return res.status(500).json({ error: "Failed to increment persona use count" });
    }
  });

  // API to recommend personas based on various factors
  app.get("/api/personas/recommend", async (req, res) => {
    try {
      // Get query parameters
      const timeOfDay = req.query.timeOfDay as string ||
                        (() => {
                          const hour = new Date().getHours();
                          if (hour >= 5 && hour < 12) return "morning";
                          if (hour >= 12 && hour < 17) return "afternoon";
                          if (hour >= 17 && hour < 21) return "evening";
                          return "night";
                        })();

      // Get emotion keywords from query if provided
      const emotions = req.query.emotions
                      ? (req.query.emotions as string).split(',')
                      : [];

      // Get all active personas
      const allPersonas = await db.query.personas.findMany({
        where: eq(personas.isActive, true)
      });

      // Score each persona based on recommendation factors
      const scoredPersonas = allPersonas.map(persona => {
        let score = 0;

        // Factor 1: Time of day match
        if (persona.timeOfDay === timeOfDay || persona.timeOfDay === "all") {
          score += 10;
        }

        // Factor 2: Emotional keyword match
        const personaEmotions = persona.emotionalKeywords as string[] || [];
        emotions.forEach(emotion => {
          if (personaEmotions.includes(emotion)) {
            score += 5;
          }
        });

        // Factor 3: Featured status
        if (persona.isFeatured) {
          score += 15;
        }

        // Factor 4: Popularity (use count)
        score += Math.min(persona.useCount || 0, 50) / 5;

        return { persona, score };
      });

      // Sort by score (descending) and return top results
      scoredPersonas.sort((a, b) => b.score - a.score);

      // Return top recommendations with scores
      return res.json({
        timeOfDay,
        emotions,
        recommendations: scoredPersonas.slice(0, 5).map(({ persona, score }) => ({
          id: persona.personaId,
          name: persona.name,
          avatarEmoji: persona.avatarEmoji,
          description: persona.description,
          score: Math.round(score),
          categories: persona.categories as string[] || [],
        }))
      });
    } catch (error) {
      console.error("Error getting persona recommendations:", error);
      return res.status(500).json({ error: "Failed to get persona recommendations" });
    }
  });

  // AI Image Generation Concept Management

  // Get all concept categories
  app.get("/api/admin/concept-categories", async (req, res) => {
    try {
      const allCategories = await db.select().from(conceptCategories).orderBy(asc(conceptCategories.order));
      return res.json(allCategories);
    } catch (error) {
      console.error("Error fetching concept categories:", error);
      return res.status(500).json({ error: "Failed to fetch concept categories" });
    }
  });

  // Get all active concept categories (public endpoint)
  app.get("/api/concept-categories", async (req, res) => {
    try {
      const activeCategories = await db.select().from(conceptCategories)
        .where(eq(conceptCategories.isActive, true))
        .orderBy(asc(conceptCategories.order));
      return res.json(activeCategories);
    } catch (error) {
      console.error("Error fetching public concept categories:", error);
      return res.status(500).json({ error: "Failed to fetch concept categories" });
    }
  });

  // Get a specific concept category
  app.get("/api/admin/concept-categories/:id", async (req, res) => {
    try {
      const categoryId = req.params.id;

      const category = await db.query.conceptCategories.findFirst({
        where: eq(conceptCategories.categoryId, categoryId)
      });

      if (!category) {
        return res.status(404).json({ error: "Concept category not found" });
      }

      return res.json(category);
    } catch (error) {
      console.error("Error fetching concept category:", error);
      return res.status(500).json({ error: "Failed to fetch concept category" });
    }
  });

  // Create a new concept category
  app.post("/api/admin/concept-categories", async (req, res) => {
    try {
      const validatedData = conceptCategorySchema.parse(req.body);

      // Check if category with this ID already exists
      const existingCategory = await db.query.conceptCategories.findFirst({
        where: eq(conceptCategories.categoryId, validatedData.categoryId)
      });

      if (existingCategory) {
        return res.status(409).json({ error: "A concept category with this ID already exists" });
      }

      // Insert new category
      const [newCategory] = await db.insert(conceptCategories).values({
        categoryId: validatedData.categoryId,
        name: validatedData.name,
        description: validatedData.description,
        order: validatedData.order,
        isActive: validatedData.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating concept category:", error);
      return res.status(500).json({ error: "Failed to create concept category" });
    }
  });

  // Update a concept category
  app.put("/api/admin/concept-categories/:id", async (req, res) => {
    try {
      const categoryId = req.params.id;
      const validatedData = conceptCategorySchema.parse(req.body);

      // Check if category exists
      const existingCategory = await db.query.conceptCategories.findFirst({
        where: eq(conceptCategories.categoryId, categoryId)
      });

      if (!existingCategory) {
        return res.status(404).json({ error: "Concept category not found" });
      }

      // Update category
      const [updatedCategory] = await db.update(conceptCategories)
        .set({
          name: validatedData.name,
          description: validatedData.description,
          systemPrompt: validatedData.systemPrompt,  // 시스템 프롬프트 필드 추가
          order: validatedData.order,
          isActive: validatedData.isActive,
          updatedAt: new Date(),
        })
        .where(eq(conceptCategories.categoryId, categoryId))
        .returning();

      return res.json(updatedCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating concept category:", error);
      return res.status(500).json({ error: "Failed to update concept category" });
    }
  });

  // Delete a concept category
  app.delete("/api/admin/concept-categories/:id", async (req, res) => {
    try {
      const categoryId = req.params.id;

      // Check if category exists
      const existingCategory = await db.query.conceptCategories.findFirst({
        where: eq(conceptCategories.categoryId, categoryId)
      });

      if (!existingCategory) {
        return res.status(404).json({ error: "Concept category not found" });
      }

      // Delete category
      await db.delete(conceptCategories).where(eq(conceptCategories.categoryId, categoryId));

      return res.json({ success: true, message: "Concept category deleted successfully" });
    } catch (error) {
      console.error("Error deleting concept category:", error);
      return res.status(500).json({ error: "Failed to delete concept category" });
    }
  });

  // Get model capabilities - Public endpoint (no auth required)
  app.get("/api/model-capabilities", async (req, res) => {
    try {
      // 시스템 설정에서 지원하는 AI 모델 목록 반환
      const systemSettings = await getSystemSettings();
      const supportedModels = systemSettings.supportedAiModels as string[];
      
      console.log("[Model Capabilities] 지원 가능한 모델 목록 반환:", supportedModels);

      // 지원되는 모델 목록을 객체 형태로 반환 (이전 API 호환성 유지)
      const modelCapabilities: Record<string, boolean> = {};
      supportedModels.forEach((model: string) => {
        modelCapabilities[model] = true;
      });

      return res.json(modelCapabilities);
    } catch (error) {
      console.error("Error fetching model capabilities:", error);
      
      // 에러 발생 시 기본 모델 목록 반환 (graceful fallback)
      const fallbackCapabilities = {
        "openai": true,
        "gemini": true
      };
      console.warn("[Model Capabilities] 에러로 인해 기본값을 반환합니다:", fallbackCapabilities);
      
      return res.json(fallbackCapabilities);
    }
  });


  // Get all concepts
  app.get("/api/admin/concepts", requireAuth, async (req, res) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      // 사용자 정보 조회 (병원 소속 확인)
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
      });

      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      console.log(`[컨셉 조회] 사용자 ${userId} (${user.memberType}, 병원ID: ${user.hospitalId || 'none'})`);

      let filteredConcepts;

      // 관리자는 모든 컨셉 조회
      if (user.memberType === 'superadmin' || user.memberType === 'admin') {
        filteredConcepts = await db.select().from(concepts).orderBy(asc(concepts.order));
        console.log(`[컨셉 조회] 관리자 - 모든 컨셉 반환: ${filteredConcepts.length}개`);
      } else {
        // 일반 사용자는 공개 컨셉 + 자신의 병원 전용 컨셉만 조회
        const publicConcepts = await db.select().from(concepts)
          .where(
            or(
              eq(concepts.visibilityType, 'public'),
              isNull(concepts.visibilityType)
            )
          )
          .orderBy(asc(concepts.order));

        let hospitalConcepts: any[] = [];

        // 병원 회원이면 해당 병원 전용 컨셉도 포함
        if (user.hospitalId && user.memberType === 'membership') {
          hospitalConcepts = await db.select().from(concepts)
            .where(
              and(
                eq(concepts.visibilityType, 'hospital'),
                eq(concepts.hospitalId, user.hospitalId)
              )
            )
            .orderBy(asc(concepts.order));

          console.log(`[컨셉 조회] 일반 사용자 - 병원 ${user.hospitalId} 전용 컨셉: ${hospitalConcepts.length}개`);
        }

        // 중복 제거하면서 합치기
        const conceptMap = new Map();
        [...publicConcepts, ...hospitalConcepts].forEach(concept => {
          conceptMap.set(concept.id, concept);
        });
        filteredConcepts = Array.from(conceptMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));

        console.log(`[컨셉 조회] 일반 사용자 - 총 컨셉: ${filteredConcepts.length}개 (공개: ${publicConcepts.length}, 병원전용: ${hospitalConcepts.length})`);
      }

      // URL 변환 함수 - SignedURL을 직접 공개 URL로 변환
      const convertToDirectUrl = (url: string): string => {
        if (!url) return url;
        try {
          // SignedURL인 경우 직접 공개 URL로 변환
          if (url.includes('GoogleAccessId=') || url.includes('Signature=')) {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            if (pathname.includes('/createtree-upload/')) {
              const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
              return `https://storage.googleapis.com/createtree-upload/${filePath}`;
            }
          }
          // 이미 직접 URL인 경우 그대로 반환
          return url;
        } catch (error) {
          return url;
        }
      };

      // 모든 컨셉의 썸네일 URL을 직접 공개 URL로 변환
      const convertedConcepts = filteredConcepts.map(concept => ({
        ...concept,
        thumbnailUrl: concept.thumbnailUrl ? convertToDirectUrl(concept.thumbnailUrl) : concept.thumbnailUrl
      }));

      return res.json(convertedConcepts);
    } catch (error) {
      console.error("Error fetching concepts:", error);
      return res.status(500).json({ error: "Failed to fetch concepts" });
    }
  });

  // Get all active concepts (public endpoint)
  app.get("/api/concepts", async (req, res) => {
    try {
      // 사용자 인증 정보 가져오기 (쿠키 우선, 헤더 대안)
      let userHospitalId = null;
      let isAdmin = false;
      
      // 쿠키에서 먼저 확인 (브라우저 로그인)
      let token = req.cookies?.auth_token;
      
      // Authorization 헤더에서 대안으로 확인 (API 호출)
      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

          const userId = decoded.userId || decoded.id;
          if (userId) {
            // 🔥 관리자 권한 확인
            isAdmin = decoded.memberType === 'admin' || decoded.memberType === 'superadmin';
            
            console.log(`[컨셉 조회] 사용자 ID: ${userId}, 관리자: ${isAdmin}, memberType: ${decoded.memberType}`);

            // 일반 사용자인 경우에만 병원 멤버십 확인
            if (!isAdmin) {
              const hospitalMember = await db.query.hospitalMembers.findFirst({
                where: eq(hospitalMembers.userId, userId)
              });

              if (hospitalMember) {
                userHospitalId = hospitalMember.hospitalId;
                console.log(`[컨셉 조회] 일반 사용자의 병원 ID: ${userHospitalId}`);
              }
            }
          }
        } catch (error) {
          // 토큰 검증 실패시 공개 컨셉만 보여줌
          console.log('[컨셉 조회] JWT 토큰 검증 실패:', error);
        }
      }

      // 🎯 컨셉 필터링: 관리자면 모든 활성화된 컨셉, 일반 사용자면 공개 + 본인 병원 전용
      let whereConditions;
      
      if (isAdmin) {
        // 관리자: 모든 활성화된 컨셉 (공개 + 병원전용 모두)
        whereConditions = eq(concepts.isActive, true);
        console.log('[컨셉 조회] 관리자 - 모든 활성화된 컨셉 반환');
      } else {
        // 일반 사용자: 공개 + 본인 소속 병원 전용
        whereConditions = and(
          eq(concepts.isActive, true),
          or(
            eq(concepts.visibilityType, 'public'),
            userHospitalId ? and(
              eq(concepts.visibilityType, 'hospital'),
              eq(concepts.hospitalId, userHospitalId)
            ) : undefined
          )
        );
        console.log(`[컨셉 조회] 일반 사용자 - 공개 + 병원 ${userHospitalId} 전용 컨셉 반환`);
      }

      const activeConcepts = await db.select().from(concepts)
        .where(whereConditions)
        .orderBy(asc(concepts.order));

      // URL 변환 함수 - SignedURL을 직접 공개 URL로 변환
      const convertToDirectUrl = (url: string): string => {
        if (!url) return url;
        try {
          // SignedURL인 경우 직접 공개 URL로 변환
          if (url.includes('GoogleAccessId=') || url.includes('Signature=')) {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            if (pathname.includes('/createtree-upload/')) {
              const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
              return `https://storage.googleapis.com/createtree-upload/${filePath}`;
            }
          }
          // 이미 직접 URL인 경우 그대로 반환
          return url;
        } catch (error) {
          return url;
        }
      };

      // 모든 컨셉의 썸네일 URL을 직접 공개 URL로 변환
      const convertedConcepts = activeConcepts.map(concept => ({
        ...concept,
        thumbnailUrl: concept.thumbnailUrl ? convertToDirectUrl(concept.thumbnailUrl) : concept.thumbnailUrl
      }));

      return res.json(convertedConcepts);
    } catch (error) {
      console.error("Error fetching public concepts:", error);
      return res.status(500).json({ error: "Failed to fetch concepts" });
    }
  });

  // Get a specific concept
  app.get("/api/admin/concepts/:id", async (req, res) => {
    try {
      const conceptId = req.params.id;

      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, conceptId)
      });

      if (!concept) {
        return res.status(404).json({ error: "Concept not found" });
      }

      // URL 변환 함수 - SignedURL을 직접 공개 URL로 변환
      const convertToDirectUrl = (url: string): string => {
        if (!url) return url;
        try {
          // SignedURL인 경우 직접 공개 URL로 변환
          if (url.includes('GoogleAccessId=') || url.includes('Signature=')) {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            if (pathname.includes('/createtree-upload/')) {
              const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
              return `https://storage.googleapis.com/createtree-upload/${filePath}`;
            }
          }
          // 이미 직접 URL인 경우 그대로 반환
          return url;
        } catch (error) {
          return url;
        }
      };

      // 썸네일 URL 변환
      const convertedConcept = {
        ...concept,
        thumbnailUrl: concept.thumbnailUrl ? convertToDirectUrl(concept.thumbnailUrl) : concept.thumbnailUrl
      };

      return res.json(convertedConcept);
    } catch (error) {
      console.error("Error fetching concept:", error);
      return res.status(500).json({ error: "Failed to fetch concept" });
    }
  });

  // Create a new concept
  app.post("/api/admin/concepts", async (req, res) => {
    try {
      console.log("컨셉 생성 요청 데이터:", JSON.stringify(req.body, null, 2));

      const validatedData = insertConceptSchema.parse(req.body);

      console.log("검증된 컨셉 생성 데이터:", JSON.stringify(validatedData, null, 2));

      // Check if concept with this ID already exists
      const existingConcept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, validatedData.conceptId)
      });

      if (existingConcept) {
        return res.status(409).json({ error: "A concept with this ID already exists" });
      }

      // Insert new concept
      const [newConcept] = await db.insert(concepts).values({
        conceptId: validatedData.conceptId,
        title: validatedData.title,
        description: validatedData.description,
        promptTemplate: validatedData.promptTemplate,
        systemPrompt: validatedData.systemPrompt,
        thumbnailUrl: validatedData.thumbnailUrl,
        tagSuggestions: validatedData.tagSuggestions,
        variables: validatedData.variables,
        categoryId: validatedData.categoryId,
        visibilityType: validatedData.visibilityType || "public",
        hospitalId: validatedData.hospitalId || null,
        isActive: validatedData.isActive,
        isFeatured: validatedData.isFeatured,
        order: validatedData.order,
        availableModels: validatedData.availableModels || (await getSystemSettings()).supportedAiModels,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      console.log("컨셉 생성 완료:", JSON.stringify(newConcept, null, 2));

      return res.status(201).json(newConcept);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("컨셉 생성 검증 오류:", error.errors);
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating concept:", error);
      return res.status(500).json({ error: "Failed to create concept" });
    }
  });

  // 🎯 순서 변경 API 엔드포인트 추가
  app.post("/api/admin/concepts/reorder", requireAuth, async (req, res) => {
    try {
      console.log("컨셉 순서 변경 요청:", JSON.stringify(req.body, null, 2));

      const reorderSchema = z.object({
        concepts: z.array(z.object({
          conceptId: z.string(),
          order: z.number()
        }))
      });

      const validatedData = reorderSchema.parse(req.body);

      // 트랜잭션으로 모든 순서 업데이트
      const updatePromises = validatedData.concepts.map(async (conceptOrder) => {
        return await db.update(concepts)
          .set({
            order: conceptOrder.order,
            updatedAt: new Date()
          })
          .where(eq(concepts.conceptId, conceptOrder.conceptId))
          .returning();
      });

      const results = await Promise.all(updatePromises);

      console.log(`컨셉 순서 변경 완료: ${results.length}개 컨셉 업데이트`);

      return res.json({
        success: true,
        updated: results.length,
        message: `${results.length}개 컨셉의 순서가 변경되었습니다.`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error reordering concepts:", error);
      return res.status(500).json({ error: "Failed to reorder concepts" });
    }
  });

  // Update a concept
  app.put("/api/admin/concepts/:id", async (req, res) => {
    try {
      const conceptId = req.params.id;

      console.log("컨셉 업데이트 요청 데이터:", JSON.stringify(req.body, null, 2));

      const validatedData = insertConceptSchema.parse(req.body);

      console.log("검증된 컨셉 업데이트 데이터:", JSON.stringify(validatedData, null, 2));

      // Check if concept exists
      const existingConcept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, conceptId)
      });

      if (!existingConcept) {
        return res.status(404).json({ error: "Concept not found" });
      }

      // Update concept
      const [updatedConcept] = await db.update(concepts)
        .set({
          title: validatedData.title,
          description: validatedData.description,
          promptTemplate: validatedData.promptTemplate,
          systemPrompt: validatedData.systemPrompt,
          thumbnailUrl: validatedData.thumbnailUrl,
          tagSuggestions: validatedData.tagSuggestions,
          variables: validatedData.variables,
          categoryId: validatedData.categoryId,
          generationType: validatedData.generationType || "image_upload",
          visibilityType: validatedData.visibilityType || "public",
          hospitalId: validatedData.hospitalId || null,
          isActive: validatedData.isActive,
          isFeatured: validatedData.isFeatured,
          order: validatedData.order,
          availableModels: validatedData.availableModels || (await getSystemSettings()).supportedAiModels,
          updatedAt: new Date(),
        })
        .where(eq(concepts.conceptId, conceptId))
        .returning();

      console.log("컨셉 업데이트 완료:", JSON.stringify(updatedConcept, null, 2));

      return res.json(updatedConcept);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("컨셉 업데이트 검증 오류:", error.errors);
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating concept:", error);
      return res.status(500).json({ error: "Failed to update concept" });
    }
  });

  // Delete a concept
  app.delete("/api/admin/concepts/:id", async (req, res) => {
    try {
      const conceptId = req.params.id;

      // Check if concept exists
      const existingConcept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, conceptId)
      });

      if (!existingConcept) {
        return res.status(404).json({ error: "Concept not found" });
      }

      // Delete concept
      await db.delete(concepts).where(eq(concepts.conceptId, conceptId));

      return res.json({ success: true, message: "Concept deleted successfully" });
    } catch (error) {
      console.error("Error deleting concept:", error);
      return res.status(500).json({ error: "Failed to delete concept" });
    }
  });

  // 🎯 컨셉 순서 변경 API (관리자 전용)
  app.post("/api/admin/reorder-concepts", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      console.log("🎯🎯🎯 컨셉 순서 변경 API 호출됨!");
      console.log("컨셉 순서 변경 요청:", req.body);

      // 요청 데이터 검증
      const { conceptOrders } = req.body;

      if (!Array.isArray(conceptOrders)) {
        return res.status(400).json({ error: "conceptOrders must be an array" });
      }

      // 각 항목 검증
      for (const item of conceptOrders) {
        if (!item.conceptId || typeof item.order !== 'number') {
          return res.status(400).json({
            error: "Each item must have conceptId (string) and order (number)"
          });
        }
      }

      console.log(`${conceptOrders.length}개 컨셉의 순서를 업데이트합니다`);

      // 순서 업데이트 (안전성 확보)
      const updateResults = [];

      for (const item of conceptOrders) {
        try {
          // 컨셉 존재 여부 확인
          const existingConcept = await db.query.concepts.findFirst({
            where: eq(concepts.conceptId, item.conceptId)
          });

          if (!existingConcept) {
            console.warn(`컨셉 ${item.conceptId}를 찾을 수 없음 - 건너뜀`);
            continue;
          }

          // 순서 업데이트
          await db.update(concepts)
            .set({
              order: item.order,
              updatedAt: new Date()
            })
            .where(eq(concepts.conceptId, item.conceptId));

          updateResults.push({
            conceptId: item.conceptId,
            newOrder: item.order,
            success: true
          });

          console.log(`컨셉 ${item.conceptId} 순서를 ${item.order}로 업데이트 완료`);

        } catch (error) {
          console.error(`컨셉 ${item.conceptId} 순서 업데이트 실패:`, error);
          updateResults.push({
            conceptId: item.conceptId,
            newOrder: item.order,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      const successCount = updateResults.filter(r => r.success).length;
      const failCount = updateResults.filter(r => !r.success).length;

      console.log(`순서 변경 완료: 성공 ${successCount}개, 실패 ${failCount}개`);

      return res.json({
        success: true,
        message: `${successCount}개 컨셉의 순서가 변경되었습니다`,
        results: updateResults,
        summary: {
          total: conceptOrders.length,
          success: successCount,
          failed: failCount
        }
      });

    } catch (error) {
      console.error("컨셉 순서 변경 중 오류:", error);
      return res.status(500).json({
        error: "Failed to reorder concepts",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // 🎯 컨셉별 변수 조회 API (공개 - 사용자용)
  app.get("/api/concepts/:conceptId/variables", async (req, res) => {
    try {
      const { conceptId } = req.params;

      // 활성화된 컨셉만 조회 (공개 API이므로)
      const concept = await db.query.concepts.findFirst({
        where: and(
          eq(concepts.conceptId, conceptId),
          eq(concepts.isActive, true) // 🔥 활성화된 컨셉만
        )
      });

      if (!concept) {
        return res.status(404).json({ error: "Active concept not found" });
      }

      // 변수 정보 파싱 및 반환
      let variables = [];
      if (concept.variables) {
        try {
          variables = typeof concept.variables === 'string'
            ? JSON.parse(concept.variables)
            : concept.variables;
        } catch (e) {
          console.log(`[변수 조회] ${conceptId} 컨셉의 변수 파싱 실패`);
          variables = [];
        }
      }

      console.log(`[변수 조회] ${conceptId} 컨셉 변수:`, variables);
      console.log(`[변수 조회] ${conceptId} 반환할 JSON:`, JSON.stringify(variables));

      return res.json(variables);
    } catch (error) {
      console.error("[변수 조회] API 에러:", error);
      return res.status(500).json({ error: "Failed to fetch concept variables" });
    }
  });

  // 🎯 컨셉별 변수 조회 API (관리자용 - 기존 유지)
  app.get("/api/admin/concepts/:conceptId/variables", async (req, res) => {
    try {
      const { conceptId } = req.params;

      console.log(`[변수 조회] ${conceptId} 컨셉의 변수 정보 조회 중...`);

      // 컨셉 정보 조회
      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, conceptId)
      });

      if (!concept) {
        console.log(`[변수 조회] ${conceptId} 컨셉을 찾을 수 없음`);
        return res.status(404).json({ error: "Concept not found" });
      }

      // 변수 정보 파싱 및 반환
      let variables = [];
      if (concept.variables) {
        try {
          variables = typeof concept.variables === 'string'
            ? JSON.parse(concept.variables)
            : concept.variables;
        } catch (e) {
          console.log(`[변수 조회] ${conceptId} 컨셉의 변수 파싱 실패`);
          variables = [];
        }
      }

      console.log(`[변수 조회] ${conceptId} 컨셉 변수:`, variables);
      console.log(`[변수 조회] ${conceptId} 반환할 JSON:`, JSON.stringify(variables));

      return res.json(variables);
    } catch (error) {
      console.error("[변수 조회] API 에러:", error);
      return res.status(500).json({ error: "Failed to fetch concept variables" });
    }
  });

  // Internationalization (i18n) API endpoints

  // Upload translations for a specific language
  app.post("/api/admin/translations/:lang", async (req, res) => {
    try {
      const lang = req.params.lang;
      const translations = req.body;

      if (!translations || typeof translations !== 'object') {
        return res.status(400).json({ error: "Invalid translations format. Expected JSON object with key-value pairs." });
      }

      // In a real implementation, we would store these in a database or file system
      // For now, we'll just return a success response

      return res.json({
        success: true,
        message: `Successfully uploaded translations for ${lang}`,
        count: Object.keys(translations).length
      });
    } catch (error) {
      console.error("Error uploading translations:", error);
      return res.status(500).json({ error: "Failed to upload translations" });
    }
  });

  // Get available languages
  app.get("/api/languages", async (req, res) => {
    try {
      // In a real implementation, we would retrieve this from a database
      // For now, we'll just return a predefined list
      return res.json([
        { code: "en", name: "English", isDefault: true },
        { code: "ko", name: "Korean" }
      ]);
    } catch (error) {
      console.error("Error fetching languages:", error);
      return res.status(500).json({ error: "Failed to fetch languages" });
    }
  });

  // 서비스 카테고리 API 엔드포인트

  // --- public menu (카테고리 + 하위메뉴) --------------------------
  app.get("/api/menu", async (req, res) => {
    try {
      const rows = await db
        .select({
          categoryId: serviceCategories.id,
          categoryTitle: serviceCategories.title,
          categoryIcon: serviceCategories.icon,
          itemId: serviceItems.itemId,
          itemTitle: serviceItems.title,
          path: serviceItems.path,
          iconName: serviceItems.icon,
          order: serviceItems.order,
        })
        .from(serviceItems)
        .innerJoin(serviceCategories, eq(serviceItems.categoryId, serviceCategories.id))
        .where(eq(serviceItems.isPublic, true))
        .orderBy(serviceCategories.order, serviceItems.order);

      // 각 카테고리마다 id, title, icon을 포함하는 구조로 변경
      const grouped = Object.values(
        rows.reduce<Record<number, any>>((acc, r) => {
          if (!acc[r.categoryId]) {
            acc[r.categoryId] = {
              id: r.categoryId,
              title: r.categoryTitle,
              icon: r.categoryIcon || 'image', // 기본값 설정
              items: []
            };
          }
          acc[r.categoryId].items.push({
            id: r.itemId,
            title: r.itemTitle,
            path: r.path,
            iconName: r.iconName || 'layers', // 기본값 설정
          });
          return acc;
        }, {})
      );

      console.log("메뉴 구조:", JSON.stringify(grouped));
      res.json(grouped);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "menu-error" });
    }
  });

  // 공개 서비스 카테고리 조회 (일반 사용자용)
  app.get("/api/service-categories", async (req, res) => {
    try {
      const publicCategories = await db.query.serviceCategories.findMany({
        where: eq(serviceCategories.isPublic, true),
        orderBy: [asc(serviceCategories.order), asc(serviceCategories.id)]
      });
      return res.json(publicCategories);
    } catch (error) {
      console.error("Error fetching public service categories:", error);
      return res.status(500).json({ error: "서비스 카테고리를 가져오는 데 실패했습니다." });
    }
  });

  // 서비스 카테고리 API 엔드포인트 (관리자용)

  // 모든 서비스 카테고리 조회 (관리자용)
  app.get("/api/admin/service-categories", async (req, res) => {
    try {
      const allCategories = await db.query.serviceCategories.findMany({
        orderBy: [asc(serviceCategories.order), asc(serviceCategories.id)]
      });
      return res.json(allCategories);
    } catch (error) {
      console.error("Error fetching service categories:", error);
      return res.status(500).json({ error: "서비스 카테고리를 가져오는 데 실패했습니다." });
    }
  });

  // 하위 서비스 항목 관리 API 엔드포인트 (관리자용)
  app.get("/api/admin/service-items", async (req, res) => {
    try {
      const { categoryId } = req.query;
      let query = db.select().from(serviceItems);

      if (categoryId && typeof categoryId === 'string') {
        // 카테고리 ID는 숫자로 직접 변환 시도
        const categoryIdNum = parseInt(categoryId);

        if (isNaN(categoryIdNum)) {
          return res.status(400).json({ error: "카테고리 ID는 유효한 숫자여야 합니다." });
        }

        // 카테고리 기본 키로 카테고리 조회
        const category = await db.query.serviceCategories.findFirst({
          where: eq(serviceCategories.id, categoryIdNum)
        });

        if (!category) {
          return res.status(404).json({ error: "해당 카테고리를 찾을 수 없습니다." });
        }

        // 카테고리에 속한 서비스 항목 조회
        const items = await db.select().from(serviceItems)
          .where(eq(serviceItems.categoryId, category.id))
          .orderBy(asc(serviceItems.order));
        return res.json(items);
      }

      const items = await db.select().from(serviceItems).orderBy(asc(serviceItems.order));
      res.json(items);
    } catch (error) {
      console.error("Error fetching service items:", error);
      return res.status(500).json({ error: "서비스 항목을 가져오는 데 실패했습니다." });
    }
  });

  // 새 서비스 항목 생성
  app.post("/api/admin/service-items", async (req, res) => {
    try {
      const itemData = insertServiceItemSchema.parse(req.body);

      // 중복 itemId 체크
      const existingItemId = await db.query.serviceItems.findFirst({
        where: eq(serviceItems.itemId, itemData.itemId)
      });

      if (existingItemId) {
        return res.status(400).json({ error: "이미 사용 중인 서비스 항목 ID입니다." });
      }

      // 카테고리 존재 여부 확인
      const category = await db.query.serviceCategories.findFirst({
        where: eq(serviceCategories.id, itemData.categoryId)
      });

      if (!category) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다." });
      }

      // 새 서비스 항목 저장
      const [newItem] = await db
        .insert(serviceItems)
        .values(itemData)
        .returning();

      return res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating service item:", error);
      return res.status(500).json({ error: "서비스 항목을 생성하는 데 실패했습니다." });
    }
  });

  // 서비스 항목 수정
  app.patch("/api/admin/service-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // 기존 항목 존재 여부 확인
      const existingItem = await db.query.serviceItems.findFirst({
        where: eq(serviceItems.id, id)
      });

      if (!existingItem) {
        return res.status(404).json({ error: "서비스 항목을 찾을 수 없습니다." });
      }

      const itemData = insertServiceItemSchema.partial().parse(req.body);

      // itemId 수정 시 중복 체크
      if (itemData.itemId && itemData.itemId !== existingItem.itemId) {
        const existingItemId = await db.query.serviceItems.findFirst({
          where: eq(serviceItems.itemId, itemData.itemId)
        });

        if (existingItemId) {
          return res.status(400).json({ error: "이미 사용 중인 서비스 항목 ID입니다." });
        }
      }

      // 카테고리 변경 시 카테고리 존재 여부 확인
      if (itemData.categoryId) {
        const category = await db.query.serviceCategories.findFirst({
          where: eq(serviceCategories.id, itemData.categoryId)
        });

        if (!category) {
          return res.status(404).json({ error: "카테고리를 찾을 수 없습니다." });
        }
      }

      // 항목 업데이트
      const [updatedItem] = await db
        .update(serviceItems)
        .set({
          ...itemData,
          updatedAt: new Date()
        })
        .where(eq(serviceItems.id, id))
        .returning();

      return res.json(updatedItem);
    } catch (error) {
      console.error("Error updating service item:", error);
      return res.status(500).json({ error: "서비스 항목을 수정하는 데 실패했습니다." });
    }
  });

  // 서비스 항목 삭제
  app.delete("/api/admin/service-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // 기존 항목 존재 여부 확인
      const existingItem = await db.query.serviceItems.findFirst({
        where: eq(serviceItems.id, id)
      });

      if (!existingItem) {
        return res.status(404).json({ error: "서비스 항목을 찾을 수 없습니다." });
      }

      // 항목 삭제
      await db
        .delete(serviceItems)
        .where(eq(serviceItems.id, id));

      return res.status(204).end();
    } catch (error) {
      console.error("Error deleting service item:", error);
      return res.status(500).json({ error: "서비스 항목을 삭제하는 데 실패했습니다." });
    }
  });

  // 새 서비스 카테고리 생성
  app.post("/api/admin/service-categories", async (req, res) => {
    try {
      const categoryData = insertServiceCategorySchema.parse(req.body);

      // 이미 존재하는 카테고리 ID인지 확인
      const existingCategory = await db.query.serviceCategories.findFirst({
        where: eq(serviceCategories.categoryId, categoryData.categoryId)
      });

      if (existingCategory) {
        return res.status(400).json({ error: "이미 존재하는 카테고리 ID입니다." });
      }

      const newCategory = await db.insert(serviceCategories)
        .values({
          ...categoryData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return res.status(201).json(newCategory[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating service category:", error);
      return res.status(500).json({ error: "서비스 카테고리 생성에 실패했습니다." });
    }
  });

  // 서비스 카테고리 업데이트
  app.patch("/api/admin/service-categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 카테고리 ID입니다." });
      }

      const categoryData = insertServiceCategorySchema.partial().parse(req.body);

      // 이미 존재하는 카테고리 ID인지 확인 (자기 자신 제외)
      if (categoryData.categoryId) {
        const existingWithSameId = await db.query.serviceCategories.findFirst({
          where: and(
            eq(serviceCategories.categoryId, categoryData.categoryId),
            sql`${serviceCategories.id} != ${id}`
          )
        });

        if (existingWithSameId) {
          return res.status(400).json({ error: "이미 존재하는 카테고리 ID입니다." });
        }
      }

      const updatedCategory = await db.update(serviceCategories)
        .set({
          ...categoryData,
          updatedAt: new Date()
        })
        .where(eq(serviceCategories.id, id))
        .returning();

      if (updatedCategory.length === 0) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다." });
      }

      return res.json(updatedCategory[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating service category:", error);
      return res.status(500).json({ error: "서비스 카테고리 업데이트에 실패했습니다." });
    }
  });

  // 서비스 카테고리 삭제
  app.delete("/api/admin/service-categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 카테고리 ID입니다." });
      }

      const result = await db.delete(serviceCategories)
        .where(eq(serviceCategories.id, id))
        .returning({ id: serviceCategories.id });

      if (result.length === 0) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다." });
      }

      return res.json({ message: "카테고리가 성공적으로 삭제되었습니다." });
    } catch (error) {
      console.error("Error deleting service category:", error);
      return res.status(500).json({ error: "서비스 카테고리 삭제에 실패했습니다." });
    }
  });


  // 배너 이미지 업로드 - GCS 저장 (영구 저장)
  app.post("/api/admin/upload/banner", bannerUpload.single("file"), async (req, res) => {
    try {
      console.log('🚀 배너 업로드 API 호출됨 (GCS 저장):', {
        body: req.body,
        file: req.file ? {
          originalname: req.file.originalname,
          filename: req.file.filename,
          path: req.file.path,
          destination: req.file.destination,
          size: req.file.size
        } : null
      });

      if (!req.file) {
        console.error('❌ 파일이 업로드되지 않음');
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
      }

      // bannerType 확인 및 GCS 폴더 결정
      const bannerType = req.body.bannerType === 'small' ? 'small' : 'slide';
      const gcsCategory = `banners/${bannerType}`;
      
      console.log('📂 배너 타입 결정 (GCS):', {
        requestType: req.body.bannerType,
        resolvedType: bannerType,
        gcsCategory: gcsCategory
      });

      // 파일을 읽어서 버퍼로 변환
      let imageBuffer: Buffer;
      const tempPath = req.file.path;

      try {
        imageBuffer = fs.readFileSync(tempPath);
        console.log('📁 파일 버퍼 읽기 완료:', imageBuffer.length, 'bytes');
      } catch (error) {
        console.error('❌ 파일 읽기 오류:', error);
        return res.status(400).json({ error: "업로드된 파일을 읽을 수 없습니다" });
      }

      try {
        // 🌐 배너 전용 PUBLIC GCS 저장 (의료 데이터가 아니므로 안전)
        const gcsResult = await saveBannerToGCS(
          imageBuffer,
          bannerType as 'slide' | 'small', // 배너 타입 ('slide' | 'small')
          req.file.originalname
        );

        console.log('✅ 배너 PUBLIC 이미지 업로드 완료:', {
          originalname: req.file.originalname,
          publicUrl: gcsResult.publicUrl,
          gsPath: gcsResult.gsPath,
          fileName: gcsResult.fileName,
          bannerType: bannerType,
          size: req.file.size,
          storage: 'gcs_public'
        });

        return res.json({
          success: true,
          url: gcsResult.publicUrl,           // 🌐 영구 PUBLIC URL
          imageSrc: gcsResult.publicUrl,      // 🌐 영구 PUBLIC URL  
          thumbnailUrl: gcsResult.publicUrl,  // 배너는 썸네일과 원본이 동일
          gsPath: gcsResult.gsPath,
          fileName: gcsResult.fileName,
          originalname: req.file.originalname,
          size: req.file.size,
          bannerType: bannerType,
          storage: 'gcs_public',               // 저장소 타입 명시
          isPermanent: true                    // 🌐 영구 URL임을 명시
        });

      } catch (gcsError) {
        console.error('❌ GCS 업로드 실패, 로컬 저장소로 폴백:', gcsError);
        
        try {
          // 폴백: 로컬 static 폴더에 저장
          const staticDir = path.join(process.cwd(), "static", "banner", `${bannerType}-banners`);
          
          // 폴더가 없으면 생성
          if (!fs.existsSync(staticDir)) {
            fs.mkdirSync(staticDir, { recursive: true });
            console.log('📁 로컬 저장 폴더 생성:', staticDir);
          }
          
          // 고유한 파일명 생성
          const timestamp = Date.now();
          const fileExtension = path.extname(req.file.originalname) || '.png';
          const fileName = `banner-${timestamp}-${Math.round(Math.random() * 1e9)}${fileExtension}`;
          const localFilePath = path.join(staticDir, fileName);
          
          // 파일을 로컬에 저장
          fs.writeFileSync(localFilePath, imageBuffer);
          
          // 웹에서 접근 가능한 URL 생성
          const webUrl = `/static/banner/${bannerType}-banners/${fileName}`;
          
          console.log('✅ 로컬 저장소 폴백 완료:', {
            originalname: req.file.originalname,
            localPath: localFilePath,
            webUrl: webUrl,
            fileName: fileName,
            bannerType: bannerType,
            size: req.file.size,
            fallbackReason: 'GCS 인증 실패'
          });
          
          return res.json({
            success: true,
            url: webUrl,
            imageSrc: webUrl,
            thumbnailUrl: webUrl, // 로컬에서는 원본과 동일
            localPath: localFilePath,
            fileName: fileName,
            originalname: req.file.originalname,
            size: req.file.size,
            bannerType: bannerType,
            storage: 'local',
            fallbackReason: 'GCS 인증 문제로 인한 로컬 저장소 사용',
            gcsError: gcsError instanceof Error ? gcsError.message : String(gcsError)
          });
          
        } catch (fallbackError) {
          console.error('❌ 로컬 저장소 폴백도 실패:', fallbackError);
          return res.status(500).json({
            error: "이미지 저장에 실패했습니다",
            gcsError: gcsError instanceof Error ? gcsError.message : String(gcsError),
            fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          });
        }
      } finally {
        // 임시 파일 정리
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
            console.log('🗑️ 임시 파일 삭제 완료:', tempPath);
          }
        } catch (cleanupError) {
          console.warn('⚠️ 임시 파일 삭제 실패 (무시 가능):', cleanupError);
        }
      }

    } catch (error) {
      console.error("❌ 배너 이미지 업로드 실패:", error);
      
      // 임시 파일 정리
      try {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.warn('⚠️ 오류 후 임시 파일 삭제 실패:', cleanupError);
      }

      return res.status(500).json({
        error: "파일 업로드 중 오류가 발생했습니다",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Thumbnail upload endpoint for concepts - GCS 연동
  app.post("/api/admin/upload/thumbnail", imageUpload.single("thumbnail"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // 파일 유효성 검증 - 버퍼 또는 경로 기반 처리
      let imageBuffer: Buffer;

      if (req.file.buffer && req.file.buffer.length > 0) {
        // 메모리 저장 방식
        imageBuffer = req.file.buffer;
        console.log('메모리 기반 파일 처리:', imageBuffer.length, 'bytes');
      } else if (req.file.path) {
        // 디스크 저장 방식 - 파일 경로에서 읽기
        try {
          imageBuffer = fs.readFileSync(req.file.path);
          console.log('디스크 기반 파일 처리:', imageBuffer.length, 'bytes');

          // 임시 파일 삭제
          fs.unlinkSync(req.file.path);
        } catch (error) {
          console.error('파일 읽기 오류:', error);
          return res.status(400).json({ error: "Failed to read uploaded file" });
        }
      } else {
        console.error('파일 버퍼와 경로 모두 없음');
        return res.status(400).json({ error: "Invalid file data" });
      }

      // 이미지 파일 형식 검증
      const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: "Invalid file type. Only JPEG, PNG, WebP, and GIF files are allowed"
        });
      }

      // 파일 크기 검증 (10MB 제한)
      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "File size too large. Maximum 10MB allowed" });
      }

      console.log('thumbnail 업로드 시작:', {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      // 작업지시서: GCS에 업로드하고 GCS URL 직접 반환
      const gcsResult = await saveImageToGCS(imageBuffer, 'anonymous', 'thumbnails', req.file.originalname);
      const fileUrl = gcsResult.originalUrl;

      console.log('thumbnail 업로드 성공:', fileUrl);

      return res.json({
        success: true,
        url: fileUrl,
        filename: req.file.originalname
      });
    } catch (error) {
      console.error("thumbnail 이미지 업로드 중 오류:", error);
      console.error("컨셉 저장 중 오류:", error);
      return res.status(500).json({
        error: "Failed to upload thumbnail",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // A/B Testing routes
  // Get all A/B tests
  app.get("/api/admin/abtests", async (req, res) => {
    try {
      const allTests = await db.query.abTests.findMany({
        orderBy: [asc(abTests.name)],
      });

      return res.json(allTests);
    } catch (error) {
      console.error("Error fetching A/B tests:", error);
      return res.status(500).json({ error: "Failed to fetch A/B tests" });
    }
  });

  // Get a single A/B test with its variants
  app.get("/api/admin/abtests/:id", async (req, res) => {
    try {
      const testId = req.params.id;

      const test = await db.query.abTests.findFirst({
        where: eq(abTests.testId, testId),
      });

      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      const variants = await db.query.abTestVariants.findMany({
        where: eq(abTestVariants.testId, testId),
      });

      return res.json({
        ...test,
        variants
      });
    } catch (error) {
      console.error("Error fetching A/B test:", error);
      return res.status(500).json({ error: "Failed to fetch A/B test" });
    }
  });

  // Create an A/B test
  app.post("/api/admin/abtests", async (req, res) => {
    try {
      const abTestSchema = z.object({
        testId: z.string().min(1, "Test ID is required"),
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
        conceptId: z.string().min(1, "Concept ID is required"),
        isActive: z.boolean().default(true),
        startDate: z.date().optional(), // Add startDate
        variants: z.array(z.object({
          variantId: z.string().min(1, "Variant ID is required"),
          name: z.string().min(1, "Name is required"),
          promptTemplate: z.string().min(1, "Prompt template is required"),
          variables: z.array(z.any()).optional(),
        })).min(2, "At least two variants are required")
      });

      const validatedData = abTestSchema.parse(req.body);

      // Check if concept exists
      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, validatedData.conceptId)
      });

      if (!concept) {
        return res.status(404).json({ error: "Concept not found" });
      }

      // Create test
      const [newTest] = await db.insert(abTests).values({
        testId: validatedData.testId,
        name: validatedData.name,
        description: validatedData.description || null,
        conceptId: validatedData.conceptId,
        isActive: validatedData.isActive,
        startDate: validatedData.startDate || new Date(), // Use provided start date or current date
      }).returning();

      // Create variants
      const variants = await Promise.all(
        validatedData.variants.map(async (variant) => {
          const [newVariant] = await db.insert(abTestVariants).values({
            testId: validatedData.testId,
            variantId: variant.variantId,
            name: variant.name,
            promptTemplate: variant.promptTemplate,
            variables: variant.variables || [],
          }).returning();

          return newVariant;
        })
      );

      return res.status(201).json({
        ...newTest,
        variants
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating A/B test:", error);
      return res.status(500).json({ error: "Failed to create A/B test" });
    }
  });

  // Get active A/B test for a specific concept/style
  app.get("/api/abtests/active/:conceptId", async (req, res) => {
    try {
      const { conceptId } = req.params;

      const activeTest = await db.query.abTests.findFirst({
        where: and(
          eq(abTests.conceptId, conceptId),
          eq(abTests.isActive, true)
        ),
        with: {
          variants: true
        }
      });

      if (!activeTest) {
        return res.status(404).json({ error: "No active A/B test found for this concept" });
      }

      return res.json(activeTest);
    } catch (error) {
      console.error("Error fetching active A/B test:", error);
      return res.status(500).json({ error: "Failed to fetch active A/B test" });
    }
  });

  // Record A/B test result
  app.post("/api/abtests/result", async (req, res) => {
    try {
      const resultSchema = z.object({
        testId: z.string().min(1, "Test ID is required"),
        selectedVariantId: z.string().min(1, "Selected variant ID is required"),
        userId: z.number().int().optional(),
        context: z.record(z.any()).optional(),
      });

      const validatedData = resultSchema.parse(req.body);

      // Record the result
      const [result] = await db.insert(abTestResults).values({
        testId: validatedData.testId,
        selectedVariantId: validatedData.selectedVariantId,
        userId: validatedData.userId || null,
        context: validatedData.context || {},
      }).returning();

      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error recording A/B test result:", error);
      return res.status(500).json({ error: "Failed to record A/B test result" });
    }
  });

  // 🗑️ 기존 스타일 카드 API 제거됨 - 새로운 컨셉 관리 시스템 사용

  // Get active A/B test for a concept
  app.get("/api/concepts/:conceptId/abtest", async (req, res) => {
    try {
      const conceptId = req.params.conceptId;

      // Find active A/B test for the concept
      const activeTest = await db.query.abTests.findFirst({
        where: and(
          eq(abTests.conceptId, conceptId),
          eq(abTests.isActive, true)
        ),
      });

      if (!activeTest) {
        return res.status(404).json({ error: "No active A/B test found for this concept" });
      }

      // Get variants for the test
      const variants = await db.query.abTestVariants.findMany({
        where: eq(abTestVariants.testId, activeTest.testId),
      });

      return res.json({
        ...activeTest,
        variants
      });
    } catch (error) {
      console.error("Error fetching active A/B test:", error);
      return res.status(500).json({ error: "Failed to fetch active A/B test" });
    }
  });

  // 채팅 기록 내보내기 - HTML 형식
  app.get("/api/export/chat/html", async (req, res) => {
    try {
      const htmlContent = await exportChatHistoryAsHtml();

      // Set headers for file download
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', 'attachment; filename="chat_history.html"');

      return res.send(htmlContent);
    } catch (error) {
      console.error("Error exporting chat history as HTML:", error);
      return res.status(500).json({ error: "Failed to export chat history" });
    }
  });

  // 채팅 기록 내보내기 - 텍스트 형식
  app.get("/api/export/chat/text", async (req, res) => {
    try {
      const textContent = await exportChatHistoryAsHtml();

      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="chat_history.txt"');

      return res.send(textContent);
    } catch (error) {
      console.error("Error exporting chat history as text:", error);
      return res.status(500).json({ error: "Failed to export chat history" });
    }
  });

  // 배너 관리 API
  app.get("/api/banners", async (req, res) => {
    try {
      const allBanners = await db.query.banners.findMany({
        where: eq(banners.isActive, true),
        orderBy: [asc(banners.sortOrder), desc(banners.createdAt)]
      });
      res.json(allBanners);
    } catch (error) {
      console.error("Error getting banners:", error);
      res.status(500).json({ error: "Failed to get banners" });
    }
  });

  // 관리자용 마일스톤 API 엔드포인트
  app.post("/api/admin/milestones", async (req, res) => {
    try {
      const {
        createMilestone
      } = await import("./services/milestones");

      // 프론트엔드에서 전송된 데이터를 createMilestone 함수 형식에 맞게 변환
      const milestoneData = {
        title: req.body.title,
        description: req.body.description,
        // categoryId 검증: 숫자형이면 문자열로 변환
        categoryId: req.body.categoryId === "6" ? "prenatal-culture" : req.body.categoryId,
        weekStart: req.body.weekStart,
        weekEnd: req.body.weekEnd,
        // badgeEmoji 기본값 설정
        badgeEmoji: req.body.badgeEmoji || "🎯",
        badgeImageUrl: req.body.badgeImageUrl,
        // encouragementMessage 기본값 설정
        encouragementMessage: req.body.encouragementMessage || "함께 참여해보세요!",
        order: req.body.order || 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        // 참여형 마일스톤 필드 (옵셔널)
        type: req.body.type || 'info',
        hospitalId: req.body.hospitalId,
        headerImageUrl: req.body.headerImageUrl,
        campaignStartDate: req.body.campaignStartDate ? new Date(req.body.campaignStartDate) : undefined,
        campaignEndDate: req.body.campaignEndDate ? new Date(req.body.campaignEndDate) : undefined,
        selectionStartDate: req.body.selectionStartDate ? new Date(req.body.selectionStartDate) : undefined,
        selectionEndDate: req.body.selectionEndDate ? new Date(req.body.selectionEndDate) : undefined,
        participationStartDate: req.body.participationStartDate ? new Date(req.body.participationStartDate) : undefined,
        participationEndDate: req.body.participationEndDate ? new Date(req.body.participationEndDate) : undefined,
        maxParticipants: req.body.maxParticipants
      };

      console.log('🔍 마일스톤 생성 요청 데이터:', milestoneData);

      // hospitalId가 0인 경우 null로 변환 (전체 선택을 의미)
      if (milestoneData.hospitalId === 0) {
        milestoneData.hospitalId = null;
      }

      const milestone = await createMilestone(milestoneData);
      return res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      return res.status(500).json({
        error: "Failed to create milestone",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.put("/api/admin/milestones/:milestoneId", async (req, res) => {
    try {
      const { milestoneId } = req.params;
      const {
        updateMilestone,
        getMilestoneById
      } = await import("./services/milestones");

      // 마일스톤이 존재하는지 확인
      const existingMilestone = await getMilestoneById(milestoneId);
      if (!existingMilestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      // hospitalId가 0인 경우 null로 변환 (전체 선택을 의미)
      const updateData = { ...req.body
      };
      if (updateData.hospitalId === 0) {
        updateData.hospitalId = null;
      }

      const updatedMilestone = await updateMilestone(milestoneId, updateData);
      return res.json(updatedMilestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      return res.status(500).json({
        error: "Failed to update milestone",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.delete("/api/admin/milestones/:milestoneId", async (req, res) => {
    try {
      const idParam = req.params.milestoneId;
      console.log('🗑️ [마일스톤 삭제] 요청 ID:', idParam, '타입:', typeof idParam);

      const {
        deleteMilestoneByNumericId,
        getMilestoneByNumericId,
        deleteMilestoneByStringId,
        getMilestoneByStringId
      } = await import("./services/milestones");

      let existingMilestone;
      let deletedMilestone;

      // 숫자 ID인지 확인 (순수 숫자만)
      const numericId = parseInt(idParam);
      if (!isNaN(numericId) && numericId.toString() === idParam) {
        console.log('🗑️ [마일스톤 삭제] 숫자 ID로 처리:', numericId);
        // 숫자 ID로 처리
        existingMilestone = await getMilestoneByNumericId(numericId);
        if (!existingMilestone) {
          return res.status(404).json({ error: "Milestone not found" });
        }
        deletedMilestone = await deleteMilestoneByNumericId(numericId);
      } else {
        console.log('🗑️ [마일스톤 삭제] 문자열 ID로 처리:', idParam);
        // 문자열 ID로 처리
        existingMilestone = await getMilestoneByStringId(idParam);
        if (!existingMilestone) {
          return res.status(404).json({ error: "Milestone not found" });
        }
        deletedMilestone = await deleteMilestoneByStringId(idParam);
      }

      console.log('🗑️ [마일스톤 삭제] 성공:', deletedMilestone?.id || deletedMilestone?.milestoneId);
      return res.json(deletedMilestone);
    } catch (error) {
      console.error("Error deleting milestone:", error);
      return res.status(500).json({
        error: "Failed to delete milestone",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // 관리자용 마일스톤 목록 조회
  app.get("/api/admin/milestones", requireAuth, async (req, res) => {
    try {
      const { getAllMilestones } = await import("./services/milestones");
      const milestones = await getAllMilestones();
      console.log('✅ 관리자 마일스톤 조회 성공:', milestones.length);
      return res.json(milestones);
    } catch (error) {
      console.error("Error fetching admin milestones:", error);
      return res.status(500).json({
        error: "마일스톤 목록을 가져오는데 실패했습니다",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // 마일스톤 카테고리 관리 API 엔드포인트 (관리자용)
  app.get("/api/admin/milestone-categories", requireAuth, async (req, res) => {
    try {
      const { getAllMilestoneCategories } = await import("./services/milestones");
      const categories = await getAllMilestoneCategories();
      console.log('✅ 마일스톤 카테고리 조회 성공:', categories);
      return res.json(categories);
    } catch (error) {
      console.error("Error fetching milestone categories:", error);
      return res.status(500).json({
        error: "카테고리 목록을 가져오는데 실패했습니다",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/milestone-categories/:categoryId", async (req, res) => {
    try {
      const { categoryId } = req.params;
      const { getMilestoneCategoryById } = await import("./services/milestones");

      const category = await getMilestoneCategoryById(categoryId);
      if (!category) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }

      return res.json(category);
    } catch (error) {
      console.error("Error fetching milestone category:", error);
      return res.status(500).json({
        error: "카테고리 정보를 가져오는데 실패했습니다",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/admin/milestone-categories", async (req, res) => {
    try {
      const { createMilestoneCategory } = await import("./services/milestones");

      const newCategory = await createMilestoneCategory(req.body);
      return res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error creating milestone category:", error);
      return res.status(500).json({
        error: "카테고리 생성에 실패했습니다",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.put("/api/admin/milestone-categories/:categoryId", async (req, res) => {
    try {
      const { categoryId } = req.params;
      const {
        updateMilestoneCategory,
        getMilestoneCategoryById
      } = await import("./services/milestones");

      // 카테고리가 존재하는지 확인
      const existingCategory = await getMilestoneCategoryById(categoryId);
      if (!existingCategory) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }

      const updatedCategory = await updateMilestoneCategory(categoryId, req.body);
      return res.json(updatedCategory);
    } catch (error) {
      console.error("Error updating milestone category:", error);
      return res.status(500).json({
        error: "카테고리 업데이트에 실패했습니다",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.delete("/api/admin/milestone-categories/:categoryId", async (req, res) => {
    try {
      const { categoryId } = req.params;
      const {
        deleteMilestoneCategory,
        getMilestoneCategoryById
      } = await import("./services/milestones");

      // 카테고리가 존재하는지 확인
      const existingCategory = await getMilestoneCategoryById(categoryId);
      if (!existingCategory) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }

      const deletedCategory = await deleteMilestoneCategory(categoryId);
      return res.json(deletedCategory);
    } catch (error) {
      console.error("Error deleting milestone category:", error);
      return res.status(500).json({
        error: "카테고리 삭제에 실패했습니다",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });



  // 관리자용 배너 목록 조회 (모든 배너 포함)
  app.get("/api/admin/banners", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const allBanners = await db.query.banners.findMany({
        orderBy: [asc(banners.sortOrder), desc(banners.createdAt)]
      });
      res.json(allBanners);
    } catch (error) {
      console.error("Error getting admin banners:", error);
      res.status(500).json({ error: "Failed to get banners" });
    }
  });

  app.post("/api/admin/banners", async (req, res) => {
    try {
      const bannerData = insertBannerSchema.parse(req.body);
      const newBanner = await db.insert(banners).values(bannerData).returning();
      res.status(201).json(newBanner[0]);
    } catch (error) {
      console.error("Error creating banner:", error);
      res.status(500).json({ error: "Failed to create banner" });
    }
  });

  app.put("/api/admin/banners/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid banner ID" });
      }

      // 기존 배너 정보 조회 (파일 삭제를 위해)
      const existingBanner = await db
        .select()
        .from(banners)
        .where(eq(banners.id, id))
        .limit(1);

      if (existingBanner.length === 0) {
        return res.status(404).json({ error: "Banner not found" });
      }

      const oldImageSrc = existingBanner[0].imageSrc;
      const bannerData = insertBannerSchema.partial().parse(req.body);
      const newImageSrc = bannerData.imageSrc;

      const updatedBanner = await db
        .update(banners)
        .set({
          ...bannerData,
          updatedAt: new Date()
        })
        .where(eq(banners.id, id))
        .returning();

      // 이미지가 변경된 경우 기존 파일 삭제
      if (newImageSrc && oldImageSrc !== newImageSrc && oldImageSrc.startsWith('/static/banner/')) {
        // '/static/' 제거하고 절대 경로 생성
        const relativePath = oldImageSrc.replace('/static/', '');
        const oldFilePath = path.join(process.cwd(), 'static', relativePath);
        try {
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
            console.log(`🗑️ 기존 슬라이드 배너 파일 삭제: ${oldImageSrc} → ${oldFilePath}`);
          } else {
            console.log(`⚠️ 기존 파일이 존재하지 않음: ${oldFilePath}`);
          }
        } catch (error) {
          console.error(`❌ 기존 파일 삭제 실패: ${oldImageSrc}`, error);
        }
      }

      res.json(updatedBanner[0]);
    } catch (error) {
      console.error("Error updating banner:", error);
      res.status(500).json({ error: "Failed to update banner" });
    }
  });

  app.delete("/api/admin/banners/:id", async (req, res) => {
    try {
      console.log(`🗑️ [SLIDE BANNER DELETE] 삭제 요청 받음 - ID: ${req.params.id}`);

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid banner ID" });
      }

      // 삭제 전 파일 정보 조회
      console.log(`🔍 [SLIDE BANNER DELETE] DB에서 배너 정보 조회 중...`);
      const bannerToDelete = await db
        .select()
        .from(banners)
        .where(eq(banners.id, id))
        .limit(1);

      if (bannerToDelete.length === 0) {
        console.log(`❌ [SLIDE BANNER DELETE] DB에서 배너 찾을 수 없음 - ID: ${id}`);
        return res.status(404).json({ error: "Banner not found" });
      }

      const imageSrc = bannerToDelete[0].imageSrc;
      console.log(`📋 [SLIDE BANNER DELETE] 삭제할 배너 정보:`, {
        id: bannerToDelete[0].id,
        title: bannerToDelete[0].title,
        imageSrc: imageSrc
      });

      // DB에서 삭제
      console.log(`🗃️ [SLIDE BANNER DELETE] DB에서 삭제 중...`);
      const result = await db
        .delete(banners)
        .where(eq(banners.id, id))
        .returning({ id: banners.id });

      console.log(`✅ [SLIDE BANNER DELETE] DB 삭제 완료`);

      // DB 삭제 성공 후 파일 삭제
      if (imageSrc && imageSrc.startsWith('/static/banner/')) {
        // '/static/' 제거하고 절대 경로 생성
        const relativePath = imageSrc.replace('/static/', '');
        const filePath = path.join(process.cwd(), 'static', relativePath);

        console.log(`📁 [SLIDE BANNER DELETE] 파일 삭제 시도:`, {
          imageSrc: imageSrc,
          relativePath: relativePath,
          filePath: filePath,
          fileExists: fs.existsSync(filePath)
        });

        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✅ [SLIDE BANNER DELETE] 파일 삭제 성공: ${filePath}`);
          } else {
            console.log(`⚠️ [SLIDE BANNER DELETE] 파일이 존재하지 않음: ${filePath}`);
          }
        } catch (error) {
          console.error(`❌ [SLIDE BANNER DELETE] 파일 삭제 실패: ${imageSrc}`, error);
        }
      } else {
        console.log(`⚠️ [SLIDE BANNER DELETE] 파일 URL이 올바르지 않음: ${imageSrc}`);
      }

      console.log(`🎉 [SLIDE BANNER DELETE] 슬라이드 배너 삭제 완료 - ID: ${id}`);
      res.json({ message: "Banner deleted successfully" });
    } catch (error) {
      console.error("❌ [SLIDE BANNER DELETE] 오류 발생:", error);
      res.status(500).json({ error: "Failed to delete banner" });
    }
  });


  // 🗑️ 기존 스타일 카드 API 제거됨 - 새로운 컨셉 관리 시스템 사용


  // 병원 관리자 전용 캠페인 API
  // 병원 정보 조회 API
  app.get("/api/hospital/info", requireHospitalAdmin, async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const user = req.user;
      // hospitalId는 requireHospitalAdmin 미들웨어에서 설정됨
      const hospitalId = user.hospitalId;

      if (!hospitalId) {
        return res.status(400).json({
          success: false,
          error: "병원 정보가 설정되지 않았습니다.",
          message: "계정에 병원 ID가 연결되어 있지 않습니다."
        });
      }

      console.log(`병원 정보 조회 - 병원 ID: ${hospitalId}`);

      const hospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.id, hospitalId),
        columns: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          logoUrl: true,
          themeColor: true
        }
      });

      if (!hospital) {
        return res.status(404).json({ error: "병원을 찾을 수 없습니다." });
      }

      console.log(`[병원 정보 조회] 병원관리자 ${req.user!.userId}가 병원 ${hospital.name} 정보 조회`);

      return res.json({
        success: true,
        data: hospital
      });

    } catch (error) {
      console.error("병원 정보 조회 오류:", error);
      res.status(500).json({ error: "병원 정보를 가져오는데 실패했습니다." });
    }
  });











  // ==================== 관리자 전용 병원 관리 API ====================
  // 구버전 병원 관리 API 제거됨 - admin-routes.ts의 /api/admin/hospitals 사용

  // 구버전 병원 CRUD API 제거됨 - admin-routes.ts의 /api/admin/hospitals 사용





  // 썸네일 이미지 업로드 API - GCS 연동
  app.post("/api/admin/upload-thumbnail", imageUpload.single("thumbnail"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // 작업지시서: GCS에 업로드하고 GCS URL 직접 반환
      const gcsResult = await saveImageToGCS(req.file.buffer, 'anonymous', 'thumbnails', req.file.originalname);
      const fileUrl = gcsResult.originalUrl;

      res.status(201).json({
        url: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("thumbnail 이미지 업로드 중 오류:", error);
      res.status(500).json({ error: "Failed to upload thumbnail" });
    }
  });

  // Service Categories related API endpoints
  app.get("/api/service-categories", async (req, res) => {
    try {
      const categories = await db.query.serviceCategories.findMany({
        orderBy: asc(serviceCategories.order)
      });

      res.json(categories);
    } catch (error) {
      console.error("Error fetching service categories:", error);
      res.status(500).json({ error: "Failed to fetch service categories" });
    }
  });

  app.post("/api/admin/service-categories", async (req, res) => {
    try {
      const validatedData = insertServiceCategorySchema.parse(req.body);

      const [newCategory] = await db.insert(serviceCategories).values(validatedData).returning();

      res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating service category:", error);
      res.status(500).json({ error: "Failed to create service category" });
    }
  });

  app.put("/api/admin/service-categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid service category ID" });
      }

      const validatedData = insertServiceCategorySchema.partial().parse(req.body);

      const [updatedCategory] = await db
        .update(serviceCategories)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(serviceCategories.id, id))
        .returning();

      if (!updatedCategory) {
        return res.status(404).json({ error: "Service category not found" });
      }

      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating service category:", error);
      res.status(500).json({ error: "Failed to update service category" });
    }
  });

  app.delete("/api/admin/service-categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid service category ID" });
      }

      const result = await db
        .delete(serviceCategories)
        .where(eq(serviceCategories.id, id))
        .returning({ id: serviceCategories.id });

      if (result.length === 0) {
        return res.status(404).json({ error: "Service category not found" });
      }

      res.json({ message: "Service category deleted successfully" });
    } catch (error) {
      console.error("Error deleting service category:", error);
      res.status(500).json({ error: "Failed to delete service category" });
    }
  });


  // Service Items related API endpoints
  app.get("/api/service-items", async (req, res) => {
    try {
      const { categoryId } = req.query;
      
      if (categoryId && typeof categoryId === 'string') {
        const categoryIdNum = parseInt(categoryId);
        if (!isNaN(categoryIdNum)) {
          const items = await db.select().from(serviceItems)
            .where(eq(serviceItems.categoryId, categoryIdNum))
            .orderBy(asc(serviceItems.order));
          return res.json(items);
        }
      }

      const items = await db.select().from(serviceItems).orderBy(asc(serviceItems.order));
      res.json(items);
    } catch (error) {
      console.error("Error fetching service items:", error);
      res.status(500).json({ error: "Failed to fetch service items" });
    }
  });

  app.post("/api/admin/service-items", async (req, res) => {
    try {
      const itemData = insertServiceItemSchema.parse(req.body);
      const [newItem] = await db.insert(serviceItems).values(itemData).returning();
      res.status(201).json(newItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating service item:", error);
      res.status(500).json({ error: "Failed to create service item" });
    }
  });

  app.patch("/api/admin/service-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid service item ID" });
      }

      const itemData = insertServiceItemSchema.partial().parse(req.body);
      const [updatedItem] = await db
        .update(serviceItems)
        .set(itemData)
        .where(eq(serviceItems.id, id))
        .returning();

      if (!updatedItem) {
        return res.status(404).json({ error: "Service item not found" });
      }

      res.json(updatedItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating service item:", error);
      res.status(500).json({ error: "Failed to update service item" });
    }
  });

  app.delete("/api/admin/service-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid service item ID" });
      }

      const result = await db
        .delete(serviceItems)
        .where(eq(serviceItems.id, id))
        .returning({ id: serviceItems.id });

      if (result.length === 0) {
        return res.status(404).json({ error: "Service item not found" });
      }

      res.json({ message: "Service item deleted successfully" });
    } catch (error) {
      console.error("Error deleting service item:", error);
      res.status(500).json({ error: "Failed to delete service item" });
    }
  });


  // Gemini API 테스트 라우터 등록
  // app.use("/api/test-gemini", geminiTestRoutes); // 제거됨
  console.log("Gemini API 테스트 라우터가 등록되었습니다 (/api/test-gemini/*)");

  // 병원 목록 조회 API
  app.get("/api/hospitals", async (req, res) => {
    try {
      // 임포트 추가
      const { hospitals } = await import("@shared/schema");
      const { eq, asc } = await import("drizzle-orm");

      const hospitalsList = await db.query.hospitals.findMany({
        where: eq(hospitals.isActive, true),
        orderBy: asc(hospitals.name),
        columns: {
          id: true,
          name: true,
          slug: true,
          address: true,
          phone: true,
          email: true,
          logoUrl: true
        }
      });

      return res.json(hospitalsList);
    } catch (error) {
      console.error("병원 목록 조회 오류:", error);
      return res.status(500).json({ error: "병원 목록을 가져오는 중 오류가 발생했습니다." });
    }
  });

  // 임시 라우터들 제거됨 - 통합 인증 시스템으로 대체



  // 이미지 스타일 관리 라우터 등록



  // 🗑️ 이미지 삭제 API (단순 버전)
  app.delete("/api/images/:id", requireAuth, async (req, res) => {
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
  console.log("✅ 이미지 삭제 API가 등록되었습니다 (DELETE /api/images/:id)");

  // 음악 스트리밍 API는 server/index.ts에서 처리됨 (중복 제거)

  // Google OAuth2 라우터 등록
  app.use("/api/google-oauth", googleOAuthRouter);
  console.log("Google OAuth2 라우터가 등록되었습니다 (/api/google-oauth/*)");
  console.log("🔐 Google OAuth2 설정 확인:", {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '설정됨' : '없음',
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '설정됨' : '없음'
  });

  // 🚨 중복 라우터 제거됨 - 상단의 새로운 라우터 사용 (274번 줄)



  // 인증 없는 병원 API 제거됨 - admin-routes.ts의 /api/admin/hospitals 사용

  // 슈퍼관리자 API 라우트 추가 (JWT 인증 방식)
  app.get("/api/super/hospitals", async (req, res) => {
    try {
      // JWT 토큰에서 사용자 정보 확인
      const userData = req.user as any;

      if (!userData || !userData.userId) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      // 실제 사용자 정보 조회
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const user = await db.query.users.findFirst({
        where: eq(users.id, userData.userId),
      });

      if (!user) {
        return res.status(401).json({ error: '사용자 정보를 찾을 수 없습니다.' });
      }

      if (user.memberType !== 'superadmin') {
        return res.status(403).json({ error: '슈퍼관리자 권한이 필요합니다.' });
      }

      const { hospitals } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");

      const hospitalsList = await db.query.hospitals.findMany({
        orderBy: [desc(hospitals.createdAt)]
      });
      return res.status(200).json(hospitalsList);
    } catch (error) {
      console.error('병원 목록 조회 오류:', error);
      return res.status(500).json({ error: '병원 목록을 가져오는 중 오류가 발생했습니다.' });
    }
  });

  // 인증 없는 중복 병원 CRUD API 제거됨 - admin-routes.ts의 인증된 API 사용

  // 중복된 라우터 제거됨 - 첫 번째 라우터로 통합

  // 이미지 라우터 등록
  app.use('/api/image', imageRouter);

  // 🗑️ 복잡한 스타일카드 생성 API들 완전히 제거됨

  // 알림 설정 API
  app.get("/api/notification-settings", requireAuth, async (req, res) => {
    try {
      console.log("알림 설정 조회 요청 - req.user:", req.user);
      // JWT에서 userId 추출하고 숫자로 변환
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);
      console.log("조회용 userId:", userId, "타입:", typeof userId);
      const { userNotificationSettings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const settings = await db.query.userNotificationSettings.findFirst({
        where: eq(userNotificationSettings.userId, userId)
      });

      if (!settings) {
        // 기본 설정으로 새 레코드 생성
        const [newSettings] = await db.insert(userNotificationSettings)
          .values({
            userId,
            emailNotifications: true,
            pushNotifications: false,
            pregnancyReminders: true,
            weeklyUpdates: true,
            promotionalEmails: false,
          })
          .returning();

        return res.json({ success: true, settings: newSettings });
      }

      return res.json({ success: true, settings });
    } catch (error) {
      console.error("알림 설정 조회 오류:", error);
      return res.status(500).json({
        success: false,
        message: "알림 설정을 불러오는 중 오류가 발생했습니다."
      });
    }
  });

  app.put("/api/notification-settings", requireAuth, async (req, res) => {
    try {
      console.log("알림 설정 업데이트 요청 - req.user:", req.user);
      // JWT에서 userId 추출하고 숫자로 변환
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);
      console.log("추출된 userId:", userId, "타입:", typeof userId);
      const { emailNotifications, pushNotifications, pregnancyReminders, weeklyUpdates, promotionalEmails } = req.body;

      const { userNotificationSettings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const existingSettings = await db.query.userNotificationSettings.findFirst({
        where: eq(userNotificationSettings.userId, userId)
      });

      let updatedSettings;

      if (existingSettings) {
        [updatedSettings] = await db.update(userNotificationSettings)
          .set({
            emailNotifications,
            pushNotifications,
            pregnancyReminders,
            weeklyUpdates,
            promotionalEmails,
            updatedAt: new Date(),
          })
          .where(eq(userNotificationSettings.userId, userId))
          .returning();
      } else {
        [updatedSettings] = await db.insert(userNotificationSettings)
          .values({
            userId,
            emailNotifications,
            pushNotifications,
            pregnancyReminders,
            weeklyUpdates,
            promotionalEmails,
          })
          .returning();
      }

      return res.json({ success: true, settings: updatedSettings });
    } catch (error) {
      console.error("알림 설정 업데이트 오류:", error);
      return res.status(500).json({
        success: false,
        message: "알림 설정을 저장하는 중 오류가 발생했습니다."
      });
    }
  });

  // 사용자 설정 API
  app.get("/api/user-settings", requireAuth, async (req, res) => {
    try {
      console.log("사용자 설정 조회 요청 - req.user:", req.user);
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);
      console.log("추출된 userId:", userId, "타입:", typeof userId);

      const { userSettings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      let settings = await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, userId)
      });

      // 설정이 없으면 기본 설정 생성
      if (!settings) {
        console.log("사용자 설정이 없어서 기본 설정 생성");
        const [newSettings] = await db.insert(userSettings).values({
          userId,
          theme: "light",
          language: "ko",
          timezone: "Asia/Seoul",
          dateFormat: "YYYY-MM-DD",
          autoSave: true,
          showTutorials: true,
        }).returning();
        settings = newSettings;
      }

      res.json({
        success: true,
        settings
      });
    } catch (error) {
      console.error("사용자 설정 조회 오류:", error);
      res.status(500).json({
        success: false,
        message: "사용자 설정을 불러오는 중 오류가 발생했습니다."
      });
    }
  });

  app.put("/api/user-settings", requireAuth, async (req, res) => {
    try {
      console.log("사용자 설정 업데이트 요청 - req.user:", req.user);
      const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
      const userId = Number(userIdRaw);
      console.log("추출된 userId:", userId, "타입:", typeof userId);

      const { theme, language, timezone, dateFormat, autoSave, showTutorials } = req.body;

      const { userSettings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const existingSettings = await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, userId)
      });

      let updatedSettings;

      if (existingSettings) {
        [updatedSettings] = await db.update(userSettings)
          .set({
            theme,
            language,
            timezone,
            dateFormat,
            autoSave,
            showTutorials,
            updatedAt: new Date(),
          })
          .where(eq(userSettings.userId, userId))
          .returning();
      } else {
        [updatedSettings] = await db.insert(userSettings).values({
          userId,
          theme,
          language,
          timezone,
          dateFormat,
          autoSave,
          showTutorials,
        }).returning();
      }

      res.json({
        success: true,
        settings: updatedSettings
      });
    } catch (error) {
      console.error("사용자 설정 업데이트 오류:", error);
      res.status(500).json({
        success: false,
        message: "설정을 저장하는 중 오류가 발생했습니다."
      });
    }
  });

  // 이메일 인증 발송 API
  app.post("/api/auth/send-verification-email", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
      });

      if (!user || !user.email) {
        return res.status(400).json({
          success: false,
          message: "이메일 주소가 등록되지 않았습니다."
        });
      }

      if (user.emailVerified) {
        return res.status(400).json({
          success: false,
          message: "이미 인증된 이메일입니다."
        });
      }

      // 실제 이메일 발송 로직은 이메일 서비스 설정이 필요합니다
      // 현재는 성공 응답만 반환
      console.log(`이메일 인증 요청: ${user.email}`);

      return res.json({
        success: true,
        message: "인증 이메일이 발송되었습니다."
      });
    } catch (error) {
      console.error("이메일 인증 발송 오류:", error);
      return res.status(500).json({
        success: false,
        message: "이메일 발송 중 오류가 발생했습니다."
      });
    }
  });

  // 이미지 다운로드 프록시 API (CORS 문제 해결)
  app.get("/api/download-image/:imageId", requireAuth, async (req, res) => {
    try {
      const { imageId } = req.params;
      const userId = req.user!.userId;
      const { images } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

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

  // 이메일 인증 확인 API
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "인증 토큰이 필요합니다."
        });
      }

      // 실제 토큰 검증 로직은 이메일 서비스 설정이 필요합니다
      // 현재는 기본 구현만 제공
      console.log(`이메일 인증 토큰: ${token}`);

      return res.json({
        success: true,
        message: "이메일이 성공적으로 인증되었습니다."
      });
    } catch (error) {
      console.error("이메일 인증 확인 오류:", error);
      return res.status(500).json({
        success: false,
        message: "이메일 인증 중 오류가 발생했습니다."
      });
    }
  });

  // 음악 스타일 API는 /api/music-engine 라우터에서 처리됨 (중복 제거)

  // 음악 스타일 목록 조회 (관리자용)
  app.get("/api/admin/music-styles", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const styles = await db.execute(`
        SELECT id, style_id, name, description, prompt, tags, is_active, "order", created_at, updated_at
        FROM music_styles
        ORDER BY "order", created_at
      `);

      res.json(styles.rows);
    } catch (error) {
      console.error("음악 스타일 목록 조회 오류:", error);
      res.status(500).json({
        success: false,
        error: "음악 스타일을 불러오는데 실패했습니다."
      });
    }
  });

  // 음악 스타일 생성
  app.post("/api/admin/music-styles", requireAdminOrSuperAdmin, async (req, res) => {
    console.log("=== 음악 스타일 생성 API 호출 ===");
    console.log("원본 요청 데이터:", JSON.stringify(req.body, null, 2));
    console.log("사용자 정보:", req.user);

    try {
      // 기본값 설정 및 타입 변환
      const processedData = {
        styleId: req.body.styleId?.toString() || '',
        name: req.body.name?.toString() || '',
        description: req.body.description?.toString() || '',
        prompt: req.body.prompt?.toString() || '',
        tags: Array.isArray(req.body.tags) ? req.body.tags : [],
        isActive: req.body.isActive === true || req.body.isActive === 'true',
        order: parseInt(req.body.order) || 0
      };

      console.log("처리된 데이터:", JSON.stringify(processedData, null, 2));

      // 필수 필드 확인
      if (!processedData.styleId || !processedData.name || !processedData.description || !processedData.prompt) {
        console.log("❌ 필수 필드 누락");
        return res.status(400).json({
          success: false,
          error: "필수 필드가 누락되었습니다."
        });
      }

      // Zod 스키마로 검증
      const validatedData = insertMusicStyleSchema.parse(processedData);
      console.log("유효성 검사 통과:", validatedData);

      // 중복 styleId 체크
      console.log("중복 스타일 ID 체크:", validatedData.styleId);
      const existingStyle = await db.select()
        .from(musicStyles)
        .where(eq(musicStyles.styleId, validatedData.styleId))
        .limit(1);

      if (existingStyle.length > 0) {
        console.log("❌ 중복 스타일 ID:", validatedData.styleId);
        return res.status(400).json({
          success: false,
          error: "이미 존재하는 스타일 ID입니다."
        });
      }

      // 데이터베이스 삽입용 데이터 준비 - tags 필드를 null로 처리
      const insertData = {
        styleId: validatedData.styleId,
        name: validatedData.name,
        description: validatedData.description,
        prompt: validatedData.prompt,
        tags: Array.isArray(validatedData.tags) && validatedData.tags.length === 0 ? null : validatedData.tags,
        isActive: validatedData.isActive,
        order: validatedData.order,
        creatorId: req.user?.id || null
      };

      console.log("DB 삽입 데이터:", JSON.stringify(insertData, null, 2));
      console.log("각 필드 타입 확인:");
      console.log("- styleId:", typeof insertData.styleId, insertData.styleId);
      console.log("- name:", typeof insertData.name, insertData.name);
      console.log("- description:", typeof insertData.description, insertData.description);
      console.log("- prompt:", typeof insertData.prompt, insertData.prompt);
      console.log("- tags:", typeof insertData.tags, Array.isArray(insertData.tags), insertData.tags);
      console.log("- isActive:", typeof insertData.isActive, insertData.isActive);
      console.log("- order:", typeof insertData.order, insertData.order);
      console.log("- creatorId:", typeof insertData.creatorId, insertData.creatorId);

      const result = await db.insert(musicStyles)
        .values(insertData)
        .returning();

      console.log("✅ 음악 스타일 생성 성공:", result[0]);
      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("❌ 음악 스타일 생성 오류:");
      console.error("오류 메시지:", error.message);
      console.error("오류 코드:", error.code);
      console.error("오류 상세:", error.detail);
      console.error("전체 오류 객체:", error);
      console.error("오류 스택:", error.stack);

      if (error.name === 'ZodError') {
        console.log("Zod 유효성 검사 실패:", error.errors);
        return res.status(400).json({
          success: false,
          error: "입력 데이터 유효성 검사 실패",
          details: error.errors
        });
      }

      res.status(500).json({
        success: false,
        error: "음악 스타일 생성에 실패했습니다.",
        details: getErrorMessage(error),
        code: error.code
      });
    }
  });

  // 음악 스타일 업데이트
  app.put("/api/admin/music-styles/:id", requireAdminOrSuperAdmin, async (req, res) => {
    console.log("=== 음악 스타일 업데이트 API 호출 ===");
    console.log("요청 데이터:", JSON.stringify(req.body, null, 2));
    console.log("스타일 ID:", req.params.id);

    try {
      const styleId = parseInt(req.params.id);

      // 기존 스타일 존재 확인
      const existingStyle = await db.select()
        .from(musicStyles)
        .where(eq(musicStyles.id, styleId))
        .limit(1);

      if (existingStyle.length === 0) {
        console.log("❌ 스타일을 찾을 수 없음:", styleId);
        return res.status(404).json({
          success: false,
          error: "음악 스타일을 찾을 수 없습니다."
        });
      }

      console.log("기존 스타일:", existingStyle[0]);

      // 스타일 ID 수정 불가 정책 적용 (이미지 스타일과 일관성 유지)
      if (req.body.styleId && req.body.styleId !== existingStyle[0].styleId) {
        console.log("❌ 스타일 ID 수정 시도 차단:", req.body.styleId);
        return res.status(400).json({
          success: false,
          error: "스타일 ID는 생성 후 수정할 수 없습니다. 데이터 무결성을 위해 스타일 ID는 변경 불가능합니다."
        });
      }

      // 업데이트 데이터 준비 (styleId 제외)
      const updateData = {
        name: req.body.name || existingStyle[0].name,
        description: req.body.description || existingStyle[0].description,
        prompt: req.body.prompt || existingStyle[0].prompt,
        tags: Array.isArray(req.body.tags) && req.body.tags.length === 0 ? null : req.body.tags || existingStyle[0].tags,
        isActive: req.body.isActive !== undefined ? req.body.isActive : existingStyle[0].isActive,
        order: req.body.order !== undefined ? req.body.order : existingStyle[0].order
      };

      console.log("업데이트할 데이터:", updateData);

      const result = await db.update(musicStyles)
        .set(updateData)
        .where(eq(musicStyles.id, styleId))
        .returning();

      console.log("✅ 음악 스타일 업데이트 성공:", result[0]);
      res.json(result[0]);
    } catch (error: any) {
      console.error("❌ 음악 스타일 업데이트 오류:", error);
      res.status(500).json({
        success: false,
        error: "음악 스타일 업데이트에 실패했습니다.",
        details: getErrorMessage(error)
      });
    }
  });

  // 음악 스타일 삭제
  app.delete("/api/admin/music-styles/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const styleId = parseInt(req.params.id);

      // 기존 스타일 존재 확인
      const existingStyle = await db.query.musicStyles.findFirst({
        where: eq(musicStyles.id, styleId)
      });

      if (!existingStyle) {
        return res.status(404).json({
          success: false,
          error: "음악 스타일을 찾을 수 없습니다."
        });
      }

      await db.delete(musicStyles).where(eq(musicStyles.id, styleId));

      res.json({
        success: true,
        message: "음악 스타일이 삭제되었습니다."
      });
    } catch (error: any) {
      console.error("음악 스타일 삭제 오류:", error);
      res.status(500).json({
        success: false,
        error: "음악 스타일 삭제에 실패했습니다."
      });
    }
  });

  // 음악 엔진 API는 /api/music-engine 라우터에서 처리됨 (중복 제거)

  // 음악 엔진 상태 API는 /api/music-engine 라우터에서 처리됨 (중복 제거)

  // 음악 엔진 스타일 API는 /api/music-engine 라우터에서 처리됨 (중복 제거)

  // ==================== 음악 갤러리 관리 API ====================

  // 관리자용 음악 목록 조회 (페이지네이션 포함)
  app.get("/api/admin/music", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const offset = (page - 1) * pageSize;

      // 전체 음악 수 조회
      const totalCount = await db.$count(music);

      // 음악 목록 조회 (재생 가능한 음악만 필터링)
      const musicList = await db.select({
        id: music.id,
        title: music.title,
        url: music.url,
        style: music.style,
        prompt: music.prompt,
        lyrics: music.lyrics,
        duration: music.duration,
        status: music.status,
        engine: music.engine,
        engineTaskId: music.engineTaskId,
        songId: music.songId,
        userId: music.userId,
        provider: music.provider,
        createdAt: music.createdAt,
        updatedAt: music.updatedAt,
      })
      .from(music)
      .where(and(
        eq(music.status, 'completed'),
        ne(music.url, ''),
        // Suno URL만 필터링 (GCS URL은 인증 문제로 제외)
        like(music.url, '%suno%')
      ))
      .orderBy(desc(music.createdAt))
      .limit(pageSize)
      .offset(offset);

      res.json({
        music: musicList,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      });
    } catch (error) {
      console.error("음악 목록 조회 오류:", error);
      res.status(500).json({
        success: false,
        error: "음악 목록을 불러오는데 실패했습니다."
      });
    }
  });

  // 관리자용 음악 삭제
  app.delete("/api/admin/music/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const musicId = parseInt(req.params.id);

      // 음악 존재 확인
      const existingMusic = await db.query.music.findFirst({
        where: eq(music.id, musicId)
      });

      if (!existingMusic) {
        return res.status(404).json({
          success: false,
          error: "음악을 찾을 수 없습니다."
        });
      }

      await db.delete(music).where(eq(music.id, musicId));

      res.json({
        success: true,
        message: "음악이 삭제되었습니다."
      });
    } catch (error) {
      console.error("음악 삭제 오류:", error);
      res.status(500).json({
        success: false,
        error: "음악 삭제에 실패했습니다."
      });
    }
  });

  // 통합 음악 엔진 API 라우트 등록
  app.use('/api/music-engine', musicEngineRouter);

  // 배너 마이그레이션 라우터 등록 - 관리자만 접근 가능
  app.use('/api/admin/banner-migration', bannerMigrationRouter);

  // 콜라주 라우터 등록 - 인증된 사용자만 접근 가능
  app.use('/api/collage', (req, res, next) => {
    // requireAuth 미들웨어 실행
    requireAuth(req, res, (err?: any) => {
      if (err) return next(err);
      // collage 라우터로 전달
      collageRouter(req, res, next);
    });
  });
  console.log('📸 콜라주 라우터가 등록되었습니다 (/api/collage/*) - 인증 필수');

  // 정적 파일 서빙 설정 - 이미지 표시를 위해 필수
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
  app.use('/static', express.static(path.join(process.cwd(), 'static')));

  // 전역 미들웨어 등록 (모든 라우트에 적용)
  app.use(requestLogger);
  app.use(responseFormatter);

  // 전역 에러 핸들링 미들웨어 (마지막에 등록)
  app.use(errorHandler);

  // 🌐 GCS 이미지 공개 배치 도구 (공개 콘텐츠 전용)
  // 주의: 개인정보가 포함된 이미지에는 사용하지 마세요
  app.post("/api/admin/fix-gcs-images", requireAuth, async (req, res) => {
    try {
      console.log('🌐 GCS 이미지 공개 설정 시작...');
      
      // setAllImagesPublic 함수 동적 import
      const { setAllImagesPublic } = await import('./utils/gcs-image-storage');
      
      await setAllImagesPublic();
      
      console.log('✅ GCS 이미지 공개 설정 완료');
      
      return res.json({
        success: true,
        message: "공개 콘텐츠 이미지가 성공적으로 공개 설정되었습니다.",
        note: "공개 콘텐츠용으로만 사용하세요. 개인정보가 포함된 이미지는 피하세요.",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ GCS 이미지 공개 설정 실패:', error);
      return res.status(500).json({
        success: false,
        error: "이미진 공개 설정 실패",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ===== Phase 5: 알림 시스템 API 엔드포인트 (기본 구현) =====

  // 알림 시스템 기본 API
  app.get("/api/notifications", async (req, res) => {
    res.json({
      success: true,
      message: "Phase 5 알림 시스템이 구현되었습니다.",
      notifications: [],
      unreadCount: 0
    });
  });

  // 테스트용 스키마 확인 엔드포인트
  app.get('/api/test/schema/:tableName', async (req: Request, res: express.Response) => {
    try {
      const { tableName } = req.params;

      if (tableName === 'milestone_application_files') {
        // milestoneApplicationFiles 테이블 스키마 정보 반환
        const schema = {
          tableName: 'milestone_application_files',
          columns: [
            { name: 'id', type: 'serial', nullable: false },
            { name: 'applicationId', type: 'integer', nullable: false },
            { name: 'fileName', type: 'text', nullable: false },
            { name: 'originalName', type: 'text', nullable: false },
            { name: 'mimeType', type: 'text', nullable: false },
            { name: 'fileSize', type: 'integer', nullable: false },
            { name: 'filePath', type: 'text', nullable: false },
            { name: 'description', type: 'text', nullable: true },
            { name: 'uploadedAt', type: 'timestamp', nullable: false },
            { name: 'uploadedBy', type: 'integer', nullable: false },
            { name: 'isDeleted', type: 'boolean', nullable: false, default: false }
          ]
        };

        res.json(schema);
      } else {
        res.status(404).json({ error: 'Table not found or not supported' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Schema query failed' });
    }
  });

  // 테스트용 Multer 설정 확인 엔드포인트
  app.get('/api/test/multer-config', async (req: Request, res: express.Response) => {
    try {
      // Multer 설정이 올바른지 확인
      const multerConfig = {
        configured: true,
        maxFileSize: '10MB',
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        uploadDirectory: 'uploads/'
      };

      res.json(multerConfig);
    } catch (error) {
      res.status(500).json({ error: 'Multer configuration check failed' });
    }
  });

  // ==================== Phase 7-1: 관리자 신청 내역 관리 API
  // ====================

  // 관리자 - 신청 목록 조회 (상태별 필터링 지원)
  app.get('/api/admin/milestone-applications', requireAuth, async (req: Request, res: express.Response) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      // 관리자 권한 확인
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
      });

      if (!user || !['admin', 'superadmin'].includes(user.memberType || '')) {
        return res.status(403).json({ error: "관리자 권한이 필요합니다." });
      }

      const { status } = req.query;

      // 신청 목록 조회 with 조인
      let applicationsQuery = db.query.milestoneApplications.findMany({
        with: {
          milestone: {
            with: {
              category: true
            }
          },
          user: {
            columns: {
              id: true,
              username: true,
              email: true
            }
          },
          files: true
        },
        orderBy: (milestoneApplications, { desc }) => [desc(milestoneApplications.appliedAt)]
      });

      let applications;
      if (status && status !== 'all') {
        applications = await db.query.milestoneApplications.findMany({
          where: eq(milestoneApplications.status, status as string),
          with: {
            milestone: {
              with: {
                category: true
              }
            },
            user: {
              columns: {
                id: true,
                username: true,
                email: true
              }
            },
            files: true
          },
          orderBy: (milestoneApplications, { desc }) => [desc(milestoneApplications.appliedAt)]
        });
      } else {
        applications = await applicationsQuery;
      }

      console.log(`✅ 관리자 신청 내역 조회 성공: ${applications.length}개`);
      res.json(applications);

    } catch (error) {
      console.error("❌ 관리자 신청 내역 조회 오류:", error);
      res.status(500).json({ error: "신청 내역 조회에 실패했습니다." });
    }
  });

  // 관리자 - 신청 상세 조회
  app.get('/api/admin/milestone-applications/:id', requireAuth, async (req: Request, res: express.Response) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      // 관리자 권한 확인
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
      });

      if (!user || !['admin', 'superadmin'].includes(user.memberType || '')) {
        return res.status(403).json({ error: "관리자 권한이 필요합니다." });
      }

      const applicationId = parseInt(req.params.id);

      const application = await db.query.milestoneApplications.findFirst({
        where: eq(milestoneApplications.id, applicationId),
        with: {
          milestone: {
            with: {
              category: true
            }
          },
          user: {
            columns: {
              id: true,
              username: true,
              email: true,
              memberType: true
            }
          },
          files: true
        }
      });

      if (!application) {
        return res.status(404).json({ error: "신청을 찾을 수 없습니다." });
      }

      console.log(`✅ 관리자 신청 상세 조회 성공: ${applicationId}`);
      res.json(application);

    } catch (error) {
      console.error("❌ 관리자 신청 상세 조회 오류:", error);
      res.status(500).json({ error: "신청 상세 조회에 실패했습니다." });
    }
  });

  // 관리자 - 신청 승인/거절 처리
  app.patch('/api/admin/milestone-applications/:id/status', requireAuth, async (req: Request, res: express.Response) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      // 관리자 권한 확인
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
      });

      if (!user || !['admin', 'superadmin'].includes(user.memberType || '')) {
        return res.status(403).json({ error: "관리자 권한이 필요합니다." });
      }

      const applicationId = parseInt(req.params.id);
      const { status, notes } = req.body;

      // 유효한 상태 확인
      if (!['approved', 'rejected', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: "유효하지 않은 상태입니다." });
      }

      // 기존 신청 확인
      const existingApplication = await db.query.milestoneApplications.findFirst({
        where: eq(milestoneApplications.id, applicationId)
      });

      if (!existingApplication) {
        return res.status(404).json({ error: "신청을 찾을 수 없습니다." });
      }

      // 처리 가능한 상태 확인
      if (status === 'cancelled') {
        // 승인 취소는 approved 상태에서만 가능
        if (existingApplication.status !== 'approved') {
          return res.status(400).json({ error: "승인된 신청만 취소할 수 있습니다." });
        }
      } else {
        // 승인/거절은 pending 상태에서만 가능
        if (existingApplication.status !== 'pending') {
          return res.status(400).json({ error: "대기 중인 신청만 처리할 수 있습니다." });
        }
      }

      // 상태 업데이트
      await db.update(milestoneApplications)
        .set({
          status: status,
          notes: notes || null,
          processedAt: new Date(),
          processedBy: parseInt(userId)
        })
        .where(eq(milestoneApplications.id, applicationId));

      // 알림 생성 (Phase 5에서 구현한 시스템 사용)
      try {
        const getNotificationData = (status: string) => {
          switch (status) {
            case 'approved':
              return {
                type: 'application_approved',
                title: '마일스톤 신청 승인',
                message: '마일스톤 신청이 승인되었습니다.'
              };
            case 'rejected':
              return {
                type: 'application_rejected',
                title: '마일스톤 신청 거절',
                message: '마일스톤 신청이 거절되었습니다.'
              };
            case 'cancelled':
              return {
                type: 'application_cancelled',
                title: '마일스톤 신청 승인 취소',
                message: '마일스톤 신청 승인이 취소되었습니다.'
              };
            default:
              return {
                type: 'application_status_changed',
                title: '마일스톤 신청 상태 변경',
                message: '마일스톤 신청 상태가 변경되었습니다.'
              };
          }
        };

        const notificationInfo = getNotificationData(status);
        const notificationData = {
          userId: existingApplication.userId,
          type: notificationInfo.type,
          title: notificationInfo.title,
          message: notificationInfo.message,
          relatedId: applicationId.toString(),
          relatedType: 'milestone_application'
        };

        await fetch(`http://localhost:${process.env.PORT || 5000}/api/notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.authorization || ''
          },
          body: JSON.stringify(notificationData)
        });
      } catch (notificationError) {
        console.error("알림 생성 실패:", notificationError);
        // 알림 실패해도 핵심 기능은 계속 진행
      }

      console.log(`✅ 관리자 신청 처리 성공: ${applicationId} → ${status}`);
      const statusMessage = status === 'approved' ? '승인' : status === 'rejected' ? '거절' : '취소';
      res.json({
        success: true,
        message: `신청이 ${statusMessage}되었습니다.`
      });

    } catch (error) {
      console.error("❌ 관리자 신청 처리 오류:", error);
      res.status(500).json({ error: "신청 처리에 실패했습니다." });
    }
  });

  // 관리자 - 신청 통계 조회
  app.get('/api/admin/milestone-applications/stats', requireAuth, async (req: Request, res: express.Response) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      // 관리자 권한 확인
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
      });

      if (!user || !['admin', 'superadmin'].includes(user.memberType || '')) {
        return res.status(403).json({ error: "관리자 권한이 필요합니다." });
      }

      // 상태별 통계 조회
      const allApplications = await db.query.milestoneApplications.findMany();

      const stats = {
        total: allApplications.length,
        pending: allApplications.filter(app => app.status === 'pending').length,
        approved: allApplications.filter(app => app.status === 'approved').length,
        rejected: allApplications.filter(app => app.status === 'rejected').length,
        cancelled: allApplications.filter(app => app.status === 'cancelled').length,
        expired: allApplications.filter(app => app.status === 'expired').length,
        thisMonth: allApplications.filter(app => {
          const month = new Date().getMonth();
          const year = new Date().getFullYear();
          const appMonth = new Date(app.appliedAt).getMonth();
          const appYear = new Date(app.appliedAt).getFullYear();
          return appMonth === month && appYear === year;
        }).length
      };

      console.log(`✅ 관리자 신청 통계 조회 성공:`, stats);
      res.json(stats);

    } catch (error) {
      console.error("❌ 관리자 신청 통계 조회 오류:", error);
      res.status(500).json({ error: "신청 통계 조회에 실패했습니다." });
    }
  });

  // 마일스톤 헤더 이미지 업로드 API
  app.post('/api/admin/milestones/upload-header', requireAuth, milestoneUpload.single('headerImage'), (req: Request, res: express.Response) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      // 관리자 권한 확인 (간단한 확인)
      // 여기서는 파일 업로드만 처리하고, 실제 관리자 권한은 마일스톤 생성/수정 시 확인

      if (!req.file) {
        return res.status(400).json({ error: "이미지 파일이 필요합니다." });
      }

      // 업로드된 파일의 상대 경로 반환 (static/milestones/ 제거)
      const relativePath = `/static/milestones/${req.file.filename}`;

      console.log(`✅ 마일스톤 헤더 이미지 업로드 성공: ${relativePath}`);

      res.json({
        success: true,
        imageUrl: relativePath,
        filename: req.file.filename,
        originalName: req.file.originalname
      });

    } catch (error) {
      console.error("❌ 마일스톤 헤더 이미지 업로드 오류:", error);
      res.status(500).json({ error: "이미지 업로드에 실패했습니다." });
    }
  });

  // ========== OpenAI API 테스트 라우트 ==========
  app.post('/api/test-openai', async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const keyExists = !!apiKey;
      const keyPrefix = apiKey ? apiKey.substring(0, 7) + "..." : "없음";
      const keyType = apiKey?.startsWith('sk-proj-') ? 'Project Key' : apiKey?.startsWith('sk-') ? 'Standard Key' : 'Invalid';

      console.log("🔑 API 키 상태 확인:");
      console.log("  - 키 존재:", keyExists);
      console.log("  - 키 접두사:", keyPrefix);
      console.log("  - 키 타입:", keyType);

      // 간단한 API 호출 테스트 (할당량 소모 최소화)
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const statusCode = response.status;

        if (response.ok) {
          console.log("✅ OpenAI API 연결 성공");
          res.json({
            success: true,
            apiKeyStatus: "valid",
            keyPrefix,
            keyType,
            apiResponse: "연결 성공"
          });
        } else {
          const errorData = await response.text();
          console.log("❌ OpenAI API 오류:", statusCode, errorData);
          res.json({
            success: false,
            apiKeyStatus: "error",
            keyPrefix,
            keyType,
            statusCode,
            error: errorData
          });
        }
      } catch (apiError) {
        console.log("❌ API 호출 실패:", apiError);
        res.json({
          success: false,
          apiKeyStatus: "connection_failed",
          keyPrefix,
          keyType,
          error: String(apiError)
        });
      }
    } catch (error) {
      console.error("테스트 엔드포인트 오류:", error);
      res.status(500).json({ success: false, error: "테스트 실패" });
    }
  });

  // ========== Pollo AI 테스트 라우트 ==========
  // Phase 1: API 작동 검증을 위한 임시 테스트 엔드포인트
  app.post("/api/test/pollo-image", async (req, res) => {
    try {
      // USE_POLLO_API 환경변수 확인
      const usePolloApi = process.env.USE_POLLO_API === 'true';

      if (!usePolloApi) {
        return res.status(400).json({
          error: "Pollo API is not enabled. Set USE_POLLO_API=true to test."
        });
      }

      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      console.log(`[Pollo Test] 이미지 생성 테스트 시작: ${prompt}`);

      // Pollo 서비스 가져오기
      const { generateImageWithPollo } = await import("./services/pollo-service");

      // Pollo API로 이미지 생성
      const imageUrl = await generateImageWithPollo(prompt);

      console.log(`[Pollo Test] 이미지 생성 성공: ${imageUrl}`);

      return res.json({
        success: true,
        message: "Pollo API test successful",
        imageUrl,
        prompt,
        engine: "pollo"
      });

    } catch (error) {
      console.error("[Pollo Test] 오류:", error);
      return res.status(500).json({
        error: "Pollo API test failed",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}