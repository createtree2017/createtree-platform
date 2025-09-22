import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
// import { authMiddleware } from "./common/middleware/auth"; // 임시 비활성화
import { DevHistoryManager } from "./services/dev-history-manager";
import musicEngineRouter from "./routes/music-engine-routes";

import { generateThumbnail, getThumbnailUrl } from "./utils/thumbnail";
import { saveImageToGCS } from "./utils/gcs-image-storage";



import googleOAuthRouter from "./routes/google-oauth";
// import imageRouter from "./routes/image"; // 중복 제거됨
import { requireAuth } from "./middleware/auth";
import { requireAdminOrSuperAdmin, requireHospitalAdmin } from "./middleware/admin-auth";
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
      aspectRatio?: string; // 이미지 종횡비 추가
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
import { generateChatResponse } from "./services/openai-simple";

// 공통 유틸리티 함수들
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
import { exportDevChatAsHtml, exportDevChatAsText } from "./services/dev-chat-export";
import { AutoChatSaver } from "./services/auto-chat-saver";

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
  musicStyles,
  insertMusicStyleSchema,
  banners,
  smallBanners,  // 작은 배너 테이블 추가

  // styleCards 제거됨

  serviceCategories,
  users,
  userNotificationSettings,

  insertConceptSchema,
  insertConceptCategorySchema,
  insertBannerSchema,

  insertServiceCategorySchema,
  insertServiceItemSchema,
  sql,
  like
} from "../shared/schema";
import { db } from "../db/index";
import { or, ne, eq, and, asc, desc } from "drizzle-orm";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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
  // OpenAI 이미지 생성 관련 필드만 유지
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

      const { bucket } = await import('./firebase.js');
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

    } catch (error) {
      console.error('❌ GCS 업로드 실패:', error);
      
      // 임시 파일이 있다면 삭제
      const fsModule = await import('fs');
      if (req.file && fsModule.existsSync(req.file.path)) {
        fsModule.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        success: false,
        error: 'GCS 업로드 실패', 
        details: error.message 
      });
    }
  });

  // 🔥 GCS 업로드 라우터 등록
  const { default: uploadRouter } = await import('./routes/upload.js');
  app.use('/api/upload', uploadRouter);

  
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
        .where(eq(users.id, userId))
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
        where: eq(users.id, userId)
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
        .where(eq(users.id, userId));

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
        where: eq(users.id, userId)
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
      
      const bannerData = {
        title: req.body.title,
        description: req.body.description,
        imageUrl: req.body.imageSrc,
        linkUrl: req.body.href,
        isActive: req.body.isActive,
        order: req.body.order
      };
      
      console.log("💾 DB 저장할 데이터:", bannerData);
      
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
      res.status(500).json({ error: "Failed to create small banner", details: error.message });
    }
  });



  app.put("/api/admin/small-banners/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid small banner ID" });
      }
      
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
        
      if (updatedSmallBanner.length === 0) {
        return res.status(404).json({ error: "Small banner not found" });
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
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid small banner ID" });
      }
      
      const deletedSmallBanner = await db
        .delete(smallBanners)
        .where(eq(smallBanners.id, id))
        .returning();
        
      if (deletedSmallBanner.length === 0) {
        return res.status(404).json({ error: "Small banner not found" });
      }
      
      res.json({ message: "Small banner deleted successfully" });
    } catch (error) {
      console.error("Error deleting small banner:", error);
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
          path: serviceItems.itemId, // 클라이언트 라우팅에 사용될 경로
          iconName: serviceItems.icon // 아이콘 이름
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
              // 클라이언트 사이드 라우팅에 필요한 형식으로 변환
              path: `/${item.path}` // 경로 앞에 슬래시 추가
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
  
  // 개발 대화 기록을 관리하기 위한 인스턴스 생성
  const devHistoryManager = new DevHistoryManager();
  
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
      const { bucket } = await import('./firebase.js');
      const filePath = req.params[0]; // * captures everything after /api/image-proxy/
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
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      stream.pipe(res);
      
      stream.on('error', (error) => {
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
  
  // 개발 대화 히스토리 관리 페이지 제공
  app.get('/dev-history', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'client/public/dev-history.html'));
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

  // 🔐 인증 기반 이미지 변환 API (메인 사용)
  app.post("/api/image/transform", requireAuth, upload.single("image"), async (req, res) => {
    console.log("[이미지 변환] 인증된 사용자 API 호출됨 - 파일 업로드 시작");
    // 사용자 ID 확인 및 검증
    const userId = validateUserId(req, res);
    if (!userId) return;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }
      
      const { style, aspectRatio, userVariables, variables, categoryId } = req.body;
      if (!style) {
        return res.status(400).json({ error: "No style selected" });
      }

      console.log("[이미지 변환] 파일 업로드됨:", req.file.filename);
      console.log("[이미지 변환] 스타일:", style);
      console.log("[이미지 변환] 화면비:", aspectRatio);
      console.log("[이미지 변환] 사용자 ID:", userId);
      console.log("[이미지 변환] 카테고리 ID:", categoryId);
      
      // 컨셉 정보 조회
      let conceptInfo = null;
      try {
        conceptInfo = await db.query.concepts.findFirst({
          where: eq(concepts.conceptId, style)
        });
        console.log("[이미지 변환] 컨셉 정보 조회:", conceptInfo ? "성공" : "없음");
      } catch (e) {
        console.log("[이미지 변환] 컨셉 정보 조회 실패:", e);
      }

      // 사용자 변수 파싱 (두 가지 형식 지원)
      let parsedUserVariables = {};
      const variableData = userVariables || variables;
      if (variableData) {
        try {
          parsedUserVariables = typeof variableData === 'string' ? JSON.parse(variableData) : variableData;
          console.log("[이미지 변환] 사용자 변수:", parsedUserVariables);
        } catch (e) {
          console.log("[이미지 변환] 변수 파싱 실패, 기본값 사용");
        }
      }

      // 기존 이미지 변환 로직과 동일하게 처리
      const originalImagePath = req.file.path;
      const imageId = Date.now();
      
      // OpenAI API 호출
      const imageBuffer = fs.readFileSync(originalImagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // 프롬프트 생성 - 컨셉 정보의 시스템 프롬프트 우선 사용
      let prompt = conceptInfo?.systemPrompt || conceptInfo?.promptTemplate || `Transform this image into ${style} style, maintaining the original composition and subjects while applying the artistic style transformation.`;
      
      // 사용자 변수가 있으면 프롬프트에 적용
      if (parsedUserVariables && Object.keys(parsedUserVariables).length > 0) {
        Object.entries(parsedUserVariables).forEach(([key, value]) => {
          prompt = prompt.replace(`{{${key}}}`, value as string);
        });
      }
      
      console.log(`[이미지 변환] 생성된 프롬프트: ${prompt}`);
      
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      let transformedImageUrl;
      
      try {
        // 먼저 gpt-image-1 모델 시도
        console.log("[이미지 변환] gpt-image-1 모델 시도");
        const response = await openai.images.generate({
          model: "gpt-image-1",
          prompt: prompt,
          n: 1,
          size: aspectRatio === "16:9" ? "1792x1024" : 
                aspectRatio === "9:16" ? "1024x1792" : "1024x1024",
          quality: "standard",
        });
        transformedImageUrl = response.data[0].url;
        console.log("[이미지 변환] gpt-image-1 성공");
      } catch (gptError) {
        console.log("[이미지 변환] gpt-image-1 실패, DALL-E 3로 폴백");
        
        // gpt-image-1 실패시 DALL-E 3로 폴백
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: aspectRatio === "16:9" ? "1792x1024" : 
                aspectRatio === "9:16" ? "1024x1792" : "1024x1024",
          quality: "standard",
        });
        transformedImageUrl = response.data[0].url;
        console.log("[이미지 변환] DALL-E 3 성공");
      }
      
      console.log("[이미지 변환] OpenAI 응답 성공");
      
      // 컨셉에서 카테고리 정보를 가져오거나 기본값 사용
      const finalCategoryId = conceptInfo?.categoryId || categoryId || 'general';
      const conceptTitle = conceptInfo?.title || style;
      
      // 사용자 이름 가져오기 (JWT 토큰에서 userId 필드 사용)
      const userId = req.user?.userId;
      const userName = req.user?.username || req.user?.email || `user_${userId}`;
      
      // 이미지를 GCS에 저장
      if (!transformedImageUrl) {
        throw new Error('이미지 생성 실패: 유효하지 않은 URL');
      }
      
      const { saveImageFromUrlToGCS } = await import('./utils/gcs-image-storage');
      
      // GCS에 이미지 저장 (원본 + 썸네일 자동 생성)
      const imageResult = await saveImageFromUrlToGCS(
        transformedImageUrl, 
        userId?.toString() || 'guest',
        finalCategoryId,
        `${conceptTitle}_${style}_${userName}`
      );
      
      console.log("[이미지 변환] GCS 이미지 저장 완료:", imageResult.originalUrl);
      console.log("[이미지 변환] GCS 썸네일 생성 완료:", imageResult.thumbnailUrl);
      
      // 데이터베이스에 이미지 정보 저장
      const imageRecord = await db.insert(images).values({
        title: `${conceptTitle}_generated`,
        style: style,
        originalUrl: imageResult.originalUrl, // GCS 원본 이미지 URL (로컬 경로 제거)
        transformedUrl: imageResult.originalUrl, // GCS 원본 이미지 URL
        thumbnailUrl: imageResult.thumbnailUrl, // GCS 썸네일 URL
        metadata: JSON.stringify({
          prompt: typeof prompt === 'string' ? prompt : 'Generated image',
          userVariables: parsedUserVariables,
          conceptId: conceptInfo?.id || null,
          categoryId: finalCategoryId,
          gsPath: imageResult.gsPath, // GCS 경로 추가
          gsThumbnailPath: imageResult.gsThumbnailPath, // GCS 썸네일 경로 추가
          fileName: imageResult.fileName,
          storageType: 'gcs'
        }),
        userId: userId ? userId.toString() : null
      }).returning();
      
      console.log("[이미지 변환] JWT 인증된 사용자", userId, "의 이미지 생성 완료");
      console.log("[이미지 변환] 이미지 ID:", imageRecord[0].id, ", 저장 경로:", imageResult.originalUrl);
      
      return res.status(201).json({
        id: imageRecord[0].id,
        title: imageRecord[0].title,
        url: imageResult.thumbnailUrl, // 갤러리에서 썸네일 표시
        transformedUrl: imageResult.originalUrl, // 원본 이미지
        thumbnailUrl: imageResult.thumbnailUrl,
        prompt: prompt,
        style: style,
        metadata: parsedUserVariables,
        createdAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('[이미지 변환] 오류 발생:', error);
      return res.status(500).json({ 
        error: "이미지 변환에 실패했습니다.", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 🔥 인증 없는 이미지 변환 API (임시 개발용)
  app.post("/api/public/image-transform", upload.single("image"), async (req, res) => {
    console.log("[공개 이미지 변환] API 호출됨 - 파일 업로드 시작");
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }
      
      const { style, aspectRatio, userVariables } = req.body;
      if (!style) {
        return res.status(400).json({ error: "No style selected" });
      }

      console.log("[공개 이미지 변환] 파일 업로드됨:", req.file.filename);
      console.log("[공개 이미지 변환] 스타일:", style);
      console.log("[공개 이미지 변환] 화면비:", aspectRatio);
      
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
      
      try {
        // 먼저 gpt-image-1 모델 시도
        console.log("[공개 이미지 변환] gpt-image-1 모델 시도");
        const response = await openai.images.generate({
          model: "gpt-image-1",
          prompt: prompt,
          n: 1,
          size: aspectRatio === "16:9" ? "1792x1024" : 
                aspectRatio === "9:16" ? "1024x1792" : "1024x1024",
          quality: "standard",
        });
        transformedImageUrl = response.data[0].url;
        console.log("[공개 이미지 변환] gpt-image-1 성공");
      } catch (gptError) {
        console.log("[공개 이미지 변환] gpt-image-1 실패, DALL-E 3로 폴백");
        
        // gpt-image-1 실패시 DALL-E 3로 폴백
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: aspectRatio === "16:9" ? "1792x1024" : 
                aspectRatio === "9:16" ? "1024x1792" : "1024x1024",
          quality: "standard",
        });
        transformedImageUrl = response.data[0].url;
        console.log("[공개 이미지 변환] DALL-E 3 성공");
      }
      
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
        styleId: style,
        isShared: true,
        metadata: JSON.stringify({
          originalStyle: style,
          originalName: req.file?.filename || 'guest_upload',
          createdAt: new Date().toISOString(),
          displayTitle: imageTitle,
          gsPath: imageResult.gsPath, // GCS 경로 추가
          gsThumbnailPath: imageResult.gsThumbnailPath, // GCS 썸네일 경로 추가
          fileName: imageResult.fileName,
          storageType: 'gcs'
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
        details: error.message 
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
      
      const { style, aspectRatio, categoryId, variables } = req.body;
      if (!style) {
        return res.status(400).json({ error: "No style selected" });
      }
      
      console.log(`[이미지 변환] 카테고리 ID 수신: ${categoryId}`);
      console.log("[DEBUG] req.body 전체:", req.body);
      console.log("[DEBUG] req.body.variables:", variables);
      
      // 기본값 1:1로 설정하고, 제공된 경우 해당 값 사용
      const selectedAspectRatio = aspectRatio || "1:1";
      
      // Check if this is a specific variant request for A/B testing
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
          
          // 각 변수를 프롬프트 템플릿과 시스템 프롬프트에 적용 (단일 중괄호 형식)
          Object.entries(userVariables).forEach(([key, value]: [string, any]) => {
            if (value && typeof value === 'string' && value.trim()) {
              const placeholder = `{${key}}`;
              
              // 프롬프트 템플릿에서 변수 치환
              if (processedPromptTemplate && processedPromptTemplate.includes(placeholder)) {
                processedPromptTemplate = processedPromptTemplate.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                console.log(`[변수 치환 - 프롬프트] ${placeholder} -> ${value}`);
              }
              
              // 시스템 프롬프트에서 변수 치환
              if (processedSystemPrompt && processedSystemPrompt.includes(placeholder)) {
                processedSystemPrompt = processedSystemPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                console.log(`[변수 치환 - 시스템] ${placeholder} -> ${value}`);
              }
            }
          });
          
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
        imageBuffer = fsModule.readFileSync(req.file.path);
        console.log("📁 스티커 생성 - 디스크 기반 파일 처리:", imageBuffer.length, 'bytes');
        
        // 임시 파일 삭제
        fsModule.unlinkSync(req.file.path);
      } else {
        console.error("❌ 스티커 생성 - 파일 버퍼와 경로 모두 없음");
        return res.status(500).json({ 
          success: false, 
          message: "업로드된 파일을 처리할 수 없습니다." 
        });
      }

      // 임시 파일 생성하여 기존 transformImage 메서드 사용
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fsModule.existsSync(tempDir)) {
        fsModule.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${req.file.originalname}`);
      fsModule.writeFileSync(tempFilePath, imageBuffer);
      
      let transformedImageUrl: string;
      
      try {
        // Process image using AI service (transforming to specified art style)
        transformedImageUrl = await storage.transformImage(
          tempFilePath, 
          style, 
          processedPromptTemplate, 
          processedSystemPrompt,
          selectedAspectRatio
        );
        
        // 임시 파일 정리
        if (fsModule.existsSync(tempFilePath)) {
          fsModule.unlinkSync(tempFilePath);
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
        if (fsModule.existsSync(tempFilePath)) {
          fsModule.unlinkSync(tempFilePath);
        }
        console.error("❌ [스티커 생성] 이미지 변환 실패:", error);
        return res.status(500).json({ 
          success: false, 
          message: "이미지 변환 중 오류가 발생했습니다." 
        });
      }
      
      // Check if this is a request from admin panel or if it's a variant test
      // Admin 요청이거나 A/B 테스트 변형일 경우에만 데이터베이스에 저장
      const isAdmin = req.query.admin === 'true' || req.headers['x-admin-request'] === 'true';
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
          filePath,
          transformedImageUrl,
          userId, // JWT 인증 후 항상 존재
          username, // JWT 인증 후 항상 존재
          categoryId, // 카테고리 ID가 먼저
          variantId // 변형 ID가 나중
        );
        
        console.log(`[이미지 변환] 이미지 저장 성공: ID=${dbSavedImage.id}, 제목=${dbSavedImage.title}`);
        
        if (isAdmin || isVariantTest) {
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
            originalUrl: filePath,
            transformedUrl: transformedImageUrl, // 작업지시서: 로컬 경로 제거, GCS URL만 사용
            localFilePath: tempImageResult.localPath || '', // 전체 파일 경로 (내부 사용)
            createdAt: new Date().toISOString(),
            isTemporary: true, // 클라이언트에서 임시 여부 식별을 위한 플래그
            dbImageId: dbSavedImage.id, // 실제 DB에 저장된 ID (필요시 사용)
            aspectRatio: selectedAspectRatio // 사용된 비율 정보 추가
          };
          
          console.log(`[이미지 변환] JWT 인증된 사용자 ${username}의 임시 이미지 생성 완료`);
          console.log(`[이미지 변환] 이미지 ID: ${dbSavedImage.id}, 임시 경로: ${savedImage.transformedUrl}`);
        }
      } catch (error) {
        console.error("[이미지 변환] 이미지 저장 중 오류:", error);
        
        // 오류 내용 상세히 로깅
        console.error("[이미지 변환] 오류 세부 정보:", {
          message: error.message || "알 수 없는 오류",
          stack: error.stack,
          time: new Date().toISOString(),
          requestInfo: {
            file: req.file?.originalname || "파일 없음",
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
          const imgUrl = transformedImageUrl.includes("placehold.co") 
            ? transformedImageUrl  // 이미 에러 이미지인 경우 그대로 사용
            : `/api/placeholder?style=${encodeURIComponent(style)}&text=${encodeURIComponent("이미지 처리 중 문제가 발생했습니다")}`;
          
          savedImage = {
            id: -1,
            title: `${style} ${nameWithoutExt}`, // "오류:" 접두사 제거
            style,
            originalUrl: filePath,
            transformedUrl: imgUrl,
            createdAt: new Date().toISOString(),
            isTemporary: true,
            aspectRatio: selectedAspectRatio, // 선택된 비율 정보 추가
            // 디버깅 정보 추가 (클라이언트에서는 표시되지 않음)
            debug: { 
              errorOccurred: true, 
              errorTime: new Date().toISOString(),
              errorType: error.name || "UnknownError",
              errorMessage: error.message || "알 수 없는 오류"
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
      
      // 🎯 클라이언트용 데이터 변환
      const optimizedImages = userImages.map(img => {
        // Base64 데이터 제외하고 파일 경로만 사용
        let displayUrl = "";
        
        if (img.thumbnailUrl) {
          displayUrl = img.thumbnailUrl;
        } else if (img.transformedUrl && !img.transformedUrl.startsWith('data:')) {
          displayUrl = img.transformedUrl;
        } else if (img.originalUrl && !img.originalUrl.startsWith('data:')) {
          displayUrl = img.originalUrl;
        } else {
          // Base64인 경우 플레이스홀더 사용
          displayUrl = `/api/placeholder?id=${img.id}&text=Loading`;
        }
        
        return {
          id: img.id,
          title: img.title || "",
          url: displayUrl,
          thumbnailUrl: img.thumbnailUrl || "",
          transformedUrl: img.transformedUrl?.startsWith('data:') ? "" : (img.transformedUrl || ""),
          originalUrl: img.originalUrl || "",
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
      
      // 디버깅: 각 이미지의 기본 정보를 로그로 출력
      recentImages.forEach((img: any, index: number) => {
        let metadataInfo = '없음';
        if (img.metadata) {
          try {
            const metadata = typeof img.metadata === 'string' 
              ? JSON.parse(img.metadata) 
              : img.metadata;
            metadataInfo = `userId: ${metadata.userId || '없음'}, isShared: ${metadata.isShared || false}`;
          } catch (e) {}
        }
        
        console.log(`[최근 이미지 ${index+1}/${recentImages.length}] ID: ${img.id}, 제목: ${img.title}, 생성일: ${new Date(img.createdAt).toISOString()}, 메타데이터: ${metadataInfo}`);
      });
      
      return res.json(recentImages);
    } catch (error) {
      console.error("Error fetching recent images:", error);
      return res.status(500).json({ error: "Failed to fetch recent images" });
    }
  });

  // 🎯 만삭사진/가족사진 이미지 생성 API (파일 업로드 + 변수 지원) - 3단계 변환 전용
  app.post("/api/generate-image", requireAuth, (req, res, next) => {
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
      
      if (!req.file) {
        console.log("❌ [이미지 생성] 파일이 업로드되지 않음");
        return res.status(400).json({ 
          success: false, 
          message: "이미지 파일을 업로드해주세요" 
        });
      }
      
      const { style, aspectRatio = "1:1", variables } = req.body;
      
      if (!style) {
        console.log("❌ [이미지 생성] 스타일이 선택되지 않음");
        return res.status(400).json({ error: "스타일을 선택해주세요" });
      }

      console.log("📝 [이미지 생성] 요청 정보:");
      console.log("- 파일:", req.file.filename);
      console.log("- 스타일:", style);
      console.log("- 비율:", aspectRatio);
      console.log("- 변수:", variables);
      
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
      
      // 컨셉 정보 조회
      console.log(`🔍 [컨셉 조회] ${style} 컨셉 검색 중...`);
      
      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, style)
      });
      
      if (concept) {
        console.log(`📋 [컨셉 발견] ${style} 컨셉 정보:`, {
          title: concept.title,
          hasSystemPrompt: !!(concept.systemPrompt && concept.systemPrompt.trim()),
          hasPromptTemplate: !!(concept.promptTemplate && concept.promptTemplate.trim())
        });
        
        // 시스템 프롬프트가 있으면 우선 사용
        if (concept.systemPrompt && concept.systemPrompt.trim() !== '') {
          console.log(`🎯 [시스템 프롬프트] 적용:`, concept.systemPrompt.substring(0, 100) + "...");
          systemPrompt = concept.systemPrompt;
          
          // 변수 치환 (시스템 프롬프트에도 적용)
          if (parsedVariables && Object.keys(parsedVariables).length > 0) {
            console.log(`🔄 [변수 치환] 시스템 프롬프트에 변수 적용 중...`);
            Object.entries(parsedVariables).forEach(([key, value]) => {
              const placeholder = `{{${key}}}`;
              const beforeReplace = systemPrompt;
              const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
              systemPrompt = systemPrompt!.replace(new RegExp(escapedPlaceholder, 'g'), value as string || '');
              if (beforeReplace !== systemPrompt) {
                console.log(`✅ [변수 치환] 시스템 프롬프트에서 ${placeholder} → "${value}"`);
              }
            });
          }
        }
        
        // 기본 프롬프트 템플릿 적용
        if (concept.promptTemplate && concept.promptTemplate.trim() !== '') {
          console.log(`🎯 [프롬프트 템플릿] 적용:`, concept.promptTemplate.substring(0, 100) + "...");
          prompt = concept.promptTemplate;
          
          // 변수 치환 (프롬프트 템플릿에 적용)
          if (parsedVariables && Object.keys(parsedVariables).length > 0) {
            console.log(`🔄 [변수 치환] 프롬프트 템플릿에 변수 적용 중...`);
            Object.entries(parsedVariables).forEach(([key, value]) => {
              const placeholder = `{{${key}}}`;
              const beforeReplace = prompt;
              const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
              prompt = prompt.replace(new RegExp(escapedPlaceholder, 'g'), value as string || '');
              if (beforeReplace !== prompt) {
                console.log(`✅ [변수 치환] 프롬프트 템플릿에서 ${placeholder} → "${value}"`);
              }
            });
          }
        }
      } else {
        console.log(`❌ [컨셉 미발견] ${style} 컨셉을 찾을 수 없습니다.`);
      }
      
      console.log("🎨 [이미지 생성] 최종 프롬프트:", prompt);
      if (systemPrompt) {
        console.log("🔧 [시스템 프롬프트] 전달됨:", systemPrompt.substring(0, 100) + "...");
      }
      
      // 🔥 3단계 변환 프로세스 (GPT-4V + GPT-4o + gpt-image-1) 실행
      console.log("🔥 [이미지 생성] 3단계 변환 프로세스 시작");
      console.log("📸 업로드된 파일:", req.file.originalname);
      console.log("🎨 적용할 컨셉:", prompt);
      
      const openaiService = await import('./services/openai-dalle3');
      
      // 파일 버퍼 처리 - 메모리 저장 방식 지원
      let imageBuffer: Buffer;
      
      if (req.file.buffer && req.file.buffer.length > 0) {
        // 메모리 저장 방식
        imageBuffer = req.file.buffer;
        console.log("📁 메모리 기반 파일 처리:", imageBuffer.length, 'bytes');
      } else if (req.file.path) {
        // 디스크 저장 방식 - 파일 경로에서 읽기
        imageBuffer = fsModule.readFileSync(req.file.path);
        console.log("📁 디스크 기반 파일 처리:", imageBuffer.length, 'bytes');
        
        // 임시 파일 삭제
        fsModule.unlinkSync(req.file.path);
      } else {
        console.error("❌ 파일 버퍼와 경로 모두 없음");
        return res.status(500).json({ 
          success: false, 
          message: "업로드된 파일을 처리할 수 없습니다." 
        });
      }
      
      const transformedImageUrl = await openaiService.transformImage(
        imageBuffer,
        style,
        prompt,
        systemPrompt
      );
      
      console.log("✅ [이미지 생성] 3단계 변환 결과:", transformedImageUrl);
      
      if (!transformedImageUrl || transformedImageUrl.includes('placehold.co')) {
        console.error("🚨 이미지 변환 실패");
        return res.status(500).json({ 
          success: false, 
          message: "이미지 변환 중 오류가 발생했습니다." 
        });
      }
      
      // 🔽 이미지를 로컬에 다운로드하여 저장
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePath = `${year}/${month}/${day}`;
      
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
      const downloadedImageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      
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
      const gcsResult = await saveImageToGCS(downloadedImageBuffer, userId.toString(), 'full', filename);
      const savedImageUrl = gcsResult.originalUrl;
      const savedThumbnailUrl = gcsResult.thumbnailUrl;
      
      console.log("✅ [GCS 업로드] 완료:", savedImageUrl);

      // 🗄️ 데이터베이스에 이미지 저장 (GCS URL 사용)
      const [savedImage] = await db.insert(images).values({
        title: `생성된 이미지 - ${style}`,
        style: style,
        originalUrl: savedImageUrl, // GCS 원본 이미지 URL
        transformedUrl: savedImageUrl,
        thumbnailUrl: savedThumbnailUrl,
        userId: String(userId),
        categoryId: "mansak_img",
        conceptId: style,
        metadata: JSON.stringify({ 
          prompt, 
          aspectRatio, 
          variables: parsedVariables,
          categoryId: "mansak_img",
          conceptId: style
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
          aspectRatio: aspectRatio,
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

  // 🏠 가족사진 이미지 생성 API (3단계 변환 사용)
  app.post("/api/generate-family", requireAuth, upload.single("image"), async (req, res) => {
    console.log("🚀 [가족사진 생성] API 호출 시작");
    
    try {
      if (!req.file) {
        console.log("❌ [가족사진 생성] 파일이 업로드되지 않음");
        return res.status(400).json({ error: "이미지 파일을 업로드해주세요" });
      }
      
      const { style, aspectRatio = "1:1", variables } = req.body;
      
      if (!style) {
        console.log("❌ [가족사진 생성] 스타일이 선택되지 않음");
        return res.status(400).json({ error: "스타일을 선택해주세요" });
      }

      console.log("📝 [가족사진 생성] 요청 정보:");
      console.log("- 파일:", req.file.filename);
      console.log("- 스타일:", style);
      console.log("- 비율:", aspectRatio);
      console.log("- 변수:", variables);
      
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
          console.log("✅ [가족사진 생성] 변수 파싱 성공:", parsedVariables);
        } catch (e) {
          console.log("⚠️ [가족사진 생성] 변수 파싱 실패, 기본값 사용");
        }
      }

      // 🎨 컨셉별 프롬프트 생성
      let prompt = "A beautiful family portrait with professional lighting and artistic styling";
      
      // 컨셉 정보 조회
      console.log(`🔍 [컨셉 조회] ${style} 컨셉 검색 중...`);
      
      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, style)
      });
      
      if (concept) {
        // 시스템프롬프트 우선 사용, 없으면 기본 프롬프트 템플릿 사용
        const useSystemPrompt = concept.systemPrompt && concept.systemPrompt.trim() !== '';
        const finalPrompt = useSystemPrompt ? concept.systemPrompt : concept.promptTemplate;
        
        if (finalPrompt) {
          console.log(`🎯 [프롬프트] ${style} 컨셉 ${useSystemPrompt ? '시스템프롬프트' : '기본템플릿'} 사용:`, finalPrompt);
          prompt = finalPrompt;
          
          // 변수 치환
          if (parsedVariables && Object.keys(parsedVariables).length > 0) {
            Object.entries(parsedVariables).forEach(([key, value]) => {
              const placeholder = `{${key}}`;
              prompt = prompt.replace(new RegExp(placeholder, 'g'), value as string || '');
            });
            console.log(`✅ [프롬프트] 변수 치환 완료:`, prompt);
          }
        }
      }
      
      console.log("🎨 [가족사진 생성] 최종 프롬프트:", prompt);
      
      // 🔥 3단계 변환 프로세스 (GPT-4V + GPT-4o + gpt-image-1) 실행
      console.log("🔥 [가족사진 생성] 3단계 변환 프로세스 시작");
      console.log("📸 업로드된 파일:", req.file.originalname);
      console.log("🎨 적용할 컨셉:", prompt);
      
      const openaiService = await import('./services/openai-dalle3');
      
      // 파일 버퍼 처리 - 메모리 저장 방식 지원
      let imageBuffer: Buffer;
      
      if (req.file.buffer && req.file.buffer.length > 0) {
        // 메모리 저장 방식
        imageBuffer = req.file.buffer;
        console.log("📁 메모리 기반 파일 처리:", imageBuffer.length, 'bytes');
      } else if (req.file.path) {
        // 디스크 저장 방식 - 파일 경로에서 읽기
        imageBuffer = fsModule.readFileSync(req.file.path);
        console.log("📁 디스크 기반 파일 처리:", imageBuffer.length, 'bytes');
        
        // 임시 파일 삭제
        fsModule.unlinkSync(req.file.path);
      } else {
        console.error("❌ 파일 버퍼와 경로 모두 없음");
        return res.status(500).json({ 
          success: false, 
          message: "업로드된 파일을 처리할 수 없습니다." 
        });
      }
      
      const transformedImageUrl = await openaiService.transformImage(
        imageBuffer,
        style,
        prompt,
        null
      );
      
      console.log("✅ [가족사진 생성] 3단계 변환 결과:", transformedImageUrl);
      
      if (!transformedImageUrl || transformedImageUrl.includes('placehold.co')) {
        console.error("🚨 이미지 변환 실패");
        return res.status(500).json({ 
          success: false, 
          message: "이미지 변환 중 오류가 발생했습니다." 
        });
      }
      
      // 🔽 이미지를 로컬에 다운로드하여 저장
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePath = `${year}/${month}/${day}`;
      
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
      const downloadedImageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      
      // Full 이미지 저장
      const fullPath = pathModule.join(fullDir, filename);
      await sharp(downloadedImageBuffer)
        .webp({ quality: 85 })
        .toFile(fullPath);
      
      // 썸네일 생성 및 저장
      const thumbnailPath = pathModule.join(thumbnailDir, thumbnailFilename);
      await sharp(downloadedImageBuffer)
        .resize(300, 300, { fit: 'cover' })
        .webp({ quality: 75 })
        .toFile(thumbnailPath);
      
      // 작업지시서: GCS에 직접 업로드하고 GCS URL 저장
      const gcsResult = await saveImageToGCS(downloadedImageBuffer, 'anonymous', 'family_img', filename);
      const savedImageUrl = gcsResult.originalUrl;
      const savedThumbnailUrl = gcsResult.thumbnailUrl;
      
      console.log("✅ [가족사진 GCS 업로드] 완료:", savedImageUrl);
      
      // 🗄️ 데이터베이스에 이미지 저장
      // 사용자 ID 확인 및 검증
      const userId = validateUserId(req, res);
      if (!userId) return;

      const [savedImage] = await db.insert(images).values({
        title: `family_${style}_generated`,
        transformedUrl: savedImageUrl,
        originalUrl: savedImageUrl, // GCS 원본 이미지 URL (로컬 경로 제거)
        thumbnailUrl: savedThumbnailUrl,
        userId: String(userId),
        categoryId: "family_img",
        conceptId: style,
        metadata: JSON.stringify({ 
          prompt, 
          aspectRatio, 
          variables: parsedVariables,
          categoryId: "family_img",
          conceptId: style
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
        aspectRatio: aspectRatio,
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

  // 🎭 스티커 이미지 생성 API (3단계 변환 사용)
  app.post("/api/generate-stickers", requireAuth, upload.single("image"), async (req, res) => {
    console.log("🚀 [스티커 생성] API 호출 시작");
    
    try {
      if (!req.file) {
        console.log("❌ [스티커 생성] 파일이 업로드되지 않음");
        return res.status(400).json({ error: "이미지 파일을 업로드해주세요" });
      }
      
      const { style, aspectRatio = "1:1", variables } = req.body;
      
      if (!style) {
        console.log("❌ [스티커 생성] 스타일이 선택되지 않음");
        return res.status(400).json({ error: "스타일을 선택해주세요" });
      }

      console.log("📝 [스티커 생성] 요청 정보:");
      console.log("- 파일:", req.file.filename);
      console.log("- 스타일:", style);
      console.log("- 비율:", aspectRatio);
      console.log("- 변수:", variables);
      
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
      
      // 컨셉 정보 조회
      console.log(`🔍 [컨셉 조회] ${style} 컨셉 검색 중...`);
      
      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, style)
      });
      
      if (concept) {
        console.log(`📋 [컨셉 발견] ${style} 컨셉 정보:`, {
          title: concept.title,
          hasSystemPrompt: !!(concept.systemPrompt && concept.systemPrompt.trim()),
          hasPromptTemplate: !!(concept.promptTemplate && concept.promptTemplate.trim())
        });
        
        // 시스템 프롬프트가 있으면 우선 사용
        if (concept.systemPrompt && concept.systemPrompt.trim() !== '') {
          console.log(`🎯 [시스템 프롬프트] 적용:`, concept.systemPrompt.substring(0, 100) + "...");
          systemPrompt = concept.systemPrompt;
          
          // 변수 치환 (시스템 프롬프트에도 적용)
          if (parsedVariables && Object.keys(parsedVariables).length > 0) {
            console.log(`🔄 [변수 치환] 시스템 프롬프트에 변수 적용 중...`);
            Object.entries(parsedVariables).forEach(([key, value]) => {
              const placeholder = `{{${key}}}`;
              const beforeReplace = systemPrompt;
              const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
              systemPrompt = systemPrompt!.replace(new RegExp(escapedPlaceholder, 'g'), value as string || '');
              if (beforeReplace !== systemPrompt) {
                console.log(`✅ [변수 치환] 시스템 프롬프트에서 ${placeholder} → "${value}"`);
              }
            });
          }
        }
        
        // 기본 프롬프트 템플릿 적용
        if (concept.promptTemplate && concept.promptTemplate.trim() !== '') {
          console.log(`🎯 [프롬프트 템플릿] 적용:`, concept.promptTemplate.substring(0, 100) + "...");
          prompt = concept.promptTemplate;
          
          // 변수 치환 (프롬프트 템플릿에 적용)
          if (parsedVariables && Object.keys(parsedVariables).length > 0) {
            console.log(`🔄 [변수 치환] 프롬프트 템플릿에 변수 적용 중...`);
            Object.entries(parsedVariables).forEach(([key, value]) => {
              const placeholder = `{{${key}}}`;
              const beforeReplace = prompt;
              const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
              prompt = prompt.replace(new RegExp(escapedPlaceholder, 'g'), value as string || '');
              if (beforeReplace !== prompt) {
                console.log(`✅ [변수 치환] 프롬프트 템플릿에서 ${placeholder} → "${value}"`);
              }
            });
          }
        }
      } else {
        console.log(`❌ [컨셉 미발견] ${style} 컨셉을 찾을 수 없습니다.`);
      }
      
      console.log("🎨 [스티커 생성] 최종 프롬프트:", prompt);
      
      // 🔥 3단계 변환 프로세스 (GPT-4V + GPT-4o + gpt-image-1) 실행
      console.log("🔥 [스티커 생성] 3단계 변환 프로세스 시작");
      console.log("📸 업로드된 파일:", req.file.originalname);
      console.log("🎨 적용할 컨셉:", prompt);
      
      const openaiService = await import('./services/openai-dalle3');
      
      // 파일 버퍼 처리 - 메모리 저장 방식 지원
      let imageBuffer: Buffer;
      
      if (req.file.buffer && req.file.buffer.length > 0) {
        // 메모리 저장 방식
        imageBuffer = req.file.buffer;
        console.log("📁 스티커 생성 - 메모리 기반 파일 처리:", imageBuffer.length, 'bytes');
      } else if (req.file.path) {
        // 디스크 저장 방식 - 파일 경로에서 읽기
        imageBuffer = fsModule.readFileSync(req.file.path);
        console.log("📁 스티커 생성 - 디스크 기반 파일 처리:", imageBuffer.length, 'bytes');
        
        // 임시 파일 삭제
        fsModule.unlinkSync(req.file.path);
      } else {
        console.error("❌ 스티커 생성 - 파일 버퍼와 경로 모두 없음");
        return res.status(500).json({ 
          success: false, 
          message: "업로드된 파일을 처리할 수 없습니다." 
        });
      }
      
      const transformedImageUrl = await openaiService.transformImage(
        imageBuffer,
        style,
        prompt,
        systemPrompt
      );
      
      console.log("✅ [스티커 생성] 3단계 변환 결과:", transformedImageUrl);
      
      if (!transformedImageUrl || transformedImageUrl.includes('placehold.co')) {
        console.error("🚨 이미지 변환 실패");
        return res.status(500).json({ 
          success: false, 
          message: "이미지 변환 중 오류가 발생했습니다." 
        });
      }
      
      // 🔽 이미지를 GCS에 직접 저장 (썸네일 자동 생성)
      console.log("📤 [스티커 저장] GCS 저장 시작...");
      
      // 이미지 다운로드
      const imageResponse = await fetch(transformedImageUrl);
      const downloadedImageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      
      // GCS에 이미지와 썸네일 저장
      const { saveImageFromUrlToGCS } = await import('./utils/gcs-image-storage');
      
      const imageResult = await saveImageFromUrlToGCS(
        transformedImageUrl,
        String(validateUserId(req, res)),
        'sticker_img',
        `sticker_${style}_generated`
      );
      
      console.log("✅ [스티커 저장] GCS 저장 완료:", imageResult.originalUrl);
      
      // 🗄️ 데이터베이스에 이미지 저장
      // 사용자 ID 확인 및 검증
      const userId = validateUserId(req, res);
      if (!userId) return;

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
          aspectRatio, 
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
        aspectRatio: aspectRatio,
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

  // GCS 공개 URL 생성 공통 함수
  const generatePublicUrl = (imagePath: string): string | null => {
    try {
      if (!imagePath) return null;
      
      console.log(`[GCS URL 생성] 입력 경로: ${imagePath}`);
      
      // 이미 완전한 HTTP URL인 경우 그대로 반환
      if (imagePath.startsWith('http')) {
        console.log(`[GCS URL 생성] HTTP URL 유지: ${imagePath}`);
        return imagePath;
      }
      
      // gs:// 형식인 경우 공개 URL로 변환
      if (imagePath.startsWith('gs://')) {
        const bucketName = imagePath.split('/')[2];
        const filePath = imagePath.split('/').slice(3).join('/');
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
        console.log(`[GCS URL 생성] gs:// 변환: ${publicUrl}`);
        return publicUrl;
      }
      
      // 상대 경로인 경우 createtree-upload 버킷 사용 (올바른 버킷)
      if (imagePath.startsWith('images/') || imagePath.includes('.webp')) {
        const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
        const publicUrl = `https://storage.googleapis.com/createtree-upload/${cleanPath}`;
        console.log(`[GCS URL 생성] 상대 경로 변환 (createtree-upload): ${publicUrl}`);
        return publicUrl;
      }
      
      // 작업지시서: /uploads/ 경로는 더 이상 처리하지 않음 (GCS URL만 사용)
      
      // static 경로는 로컬 서빙 유지
      if (imagePath.startsWith('/static/')) {
        console.log(`[GCS URL 생성] 로컬 경로 유지: ${imagePath}`);
        return imagePath;
      }
      
      // 기타 경우 createtree-upload 버킷 기본 경로 사용
      const publicUrl = `https://storage.googleapis.com/createtree-upload/${imagePath}`;
      console.log(`[GCS URL 생성] 기본 변환 (createtree-upload): ${publicUrl}`);
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
        whereCondition = and(
          eq(images.userId, userId.toString()),
          eq(images.categoryId, filter)
        );
      } else {
        whereCondition = eq(images.userId, userId.toString());
      }
      
      // 개인 이미지만 조회
      const imageItems = await db.query.images.findMany({
        where: whereCondition,
        orderBy: desc(images.createdAt),
        limit: 20
      });
      
      const galleryItems = imageItems.map(image => {
        const transformedUrl = generatePublicUrl(image.transformedUrl || image.originalUrl);
        const originalUrl = generatePublicUrl(image.originalUrl);
        
        // 썸네일이 없거나 접근 불가능한 경우 원본 이미지 사용
        const thumbnailUrl = image.thumbnailUrl ? 
          generatePublicUrl(image.thumbnailUrl) : 
          transformedUrl;

        return {
          id: image.id,
          title: image.title || `생성된 이미지 - ${image.style || '스타일'}`,
          type: 'image' as const,
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
      
      console.log(`[갤러리 API] ${galleryItems.length}개 이미지 반환`);
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
          url = (mediaItem as typeof music.$inferSelect).url;
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
          const { bucket } = await import('./firebase.js');
          
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
          res.setHeader('Cache-Control', 'public, max-age=3600');
          
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
      
      // CORS 헤더 추가
      res.header('Access-Control-Allow-Origin', '*');
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
            url = musicItem.url;
            filename = `${musicItem.title || 'music'}.mp3`;
            
            console.log(`[음악 다운로드] ID: ${parsedId}, URL: ${url}, 파일명: ${filename}`);
            
            // GCS URL인 경우 SignedURL로 다운로드
            if (url && url.includes('storage.googleapis.com')) {
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
                  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCevUl+Y5xGrsVR\nhWJvr8stawdae+MWgy85E/zHKqN660EOjqY643Y//gp07NIb0XuJWTMbJcZYNLxi\nTcczDyggqPYn2UQUbdKIpp0XbiYkD/GLo1Hqi3CVPsIRa1xRT70S5Yx9q9rkAbxB\n+eF8gdxXQ8y+eIIhJRauZTbK7g5+f9Df8TRyjfofI8WZRNPXsQhqfpwQbp8VJwL8\nDCp7cXI2vIrCq7SbxlD02vdsaSQ97DGVIBF7Nr6QE6otSBxl4fqHYjmx6RfCAynz\nHWH1nOuYxkYszhDjawsVEaXjuGCa6SAzKmgHWaoXAM6V692lm+VLx9/1EO9b+r2I\nzJj5ak2/AgMBAAECggEAC+cRZWU7TBkbWY80JnMniHqZUA5KPlKZQWEZMXPy7MR9\ns2vV1URfn9FakyuvK3/SXaYIs3uD7lkLjesOfNEhOj9N4208PueA0FdLhmMiszSK\ncTG08qHNaZtz+mtmJJpJvDd/7wWdjnHLRHH9fhQ2SeLSR0i9wfxIDmaV37LokLdb\n9+nnoGxvDPnJKDbwXXB6gv7CL2VDAKGkSEEoqE5MnwfdCmEZwSvpYzHG4qxGuIrr\nc5JCxNkW9ib4UBBTG+S94quykzpD7MSSaP4BTEOhyx/bUA8zJwk8TW5f5vsavtxB\n6nyuo+kBS6ow4JVxFgIAs9R1MsvCBpu+OAwnHO4rnQKBgQDKtjIJf19ZccoHTndV\nAsjagQp6hibvDGelVNxq7pQDnZj2z8NH/lEX5KbAyhSHWURi/FHgzmuCybFZqs8d\nsuQd+MJekwsOYs7IONq00Pi9QE1xLMt4DCLhPj29BVa3Rn88/RcQOkCgcITKGs7+\nopqEnJDVKutEXKlykAH3qR0dewKBgQDId+gAwGLpWWMdDuTIcBR9GldUJyAMdMz3\nlWODsJK4n6V9G7I2ZA5iYn1nGHE5SAegKkOxiWRsbJzAUxhy3WedkC7Ws5yvmEkH\nNDggq6uEqf+AOEWnMPV166FoMkULVn9MwNym+GbqCRMt6dL12Px0Q+bBz+qUp9IH\nUQq62KfjjQKBgEg6CLQXnSqqf5iA3cX9ewFXzxr+56pvGhLvnKXBIh3zrkfqmSLy\nu4Qu5Td2CUB8jwBR9P6LrgToxnczhB6J2fvP4bl+3QagMBtpHowklSwhWDaGBm1c\nraTh32+VEmO1C6r4ZppSlypTTQ0R5kUWPMYZXwWFCFTQS1PVec37hLM3AoGBALGM\nYVKpEfGSVZIa6s4LVlomxkmmDWB64j41dVnhPVF/M9bGfORnYcYJbP+uSjltbjOQ\nuzu2b9cHqx07e1/gcDDAznshwRhUS/mxajSlVte8qKorLKWTWxMBiob6XuRXy49z\nEPpg7uVA/FehzFIpyA5BRVNKjnzy1bXdNR+fW7LRAoGBAK9yAL+ER3fIIHAHrYkd\nwOo4Agd6gRfVPpR2VclOWgwfG6vCiIccx+j9n4G2muJd5L0ZLGqOQMfKy4WjHdBR\n/SHg1s7YhbtVtddwdluSobZ03q6hztqMkejOaemngTMSvGOk8jlyFfmrgU0OcClf\nnEoJ2Uh1U2PmPz9iZuyUI2GA\n-----END PRIVATE KEY-----\n",
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
                
                // 24시간 유효한 SignedURL 생성
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
            } else {
              // GCS URL이 아닌 경우 오류 반환
              console.error(`[음악 다운로드 오류] 지원하지 않는 URL 형식: ${url}`);
              return res.status(400).json({ 
                error: "지원하지 않는 음악 URL 형식입니다", 
                message: "GCS URL만 지원됩니다" 
              });
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
        
        // 🎯 로컬 WEBP 파일 직접 다운로드 (새로운 파일 시스템)
        if (url.startsWith('/uploads/')) {
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
      
      // CORS 헤더 추가
      res.header('Access-Control-Allow-Origin', '*');
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
          shareUrl = musicItem.url;
          
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
  
  app.get("/api/chat/saved", async (req, res) => {
    try {
      const savedChats = await storage.getSavedChats();
      return res.json(savedChats);
    } catch (error) {
      console.error("Error fetching saved chats:", error);
      return res.status(500).json({ error: "Failed to fetch saved chats" });
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
  app.get("/api/milestones", async (req, res) => {
    try {
      const { getAllMilestones } = await import("./services/milestones");
      const milestones = await getAllMilestones();
      return res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      return res.status(500).json({ error: "Failed to fetch milestones" });
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
  
  // Get all concepts
  app.get("/api/admin/concepts", async (req, res) => {
    try {
      const allConcepts = await db.select().from(concepts).orderBy(asc(concepts.order));
      return res.json(allConcepts);
    } catch (error) {
      console.error("Error fetching concepts:", error);
      return res.status(500).json({ error: "Failed to fetch concepts" });
    }
  });
  
  // Get all active concepts (public endpoint)
  app.get("/api/concepts", async (req, res) => {
    try {
      const activeConcepts = await db.select().from(concepts)
        .where(eq(concepts.isActive, true))
        .orderBy(asc(concepts.order));
      return res.json(activeConcepts);
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
      
      return res.json(concept);
    } catch (error) {
      console.error("Error fetching concept:", error);
      return res.status(500).json({ error: "Failed to fetch concept" });
    }
  });
  
  // Create a new concept
  app.post("/api/admin/concepts", async (req, res) => {
    try {
      const validatedData = conceptSchema.parse(req.body);
      
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
        systemPrompt: validatedData.systemPrompt,  // 시스템 프롬프트 필드 추가
        thumbnailUrl: validatedData.thumbnailUrl,
        tagSuggestions: validatedData.tagSuggestions,
        variables: validatedData.variables,
        categoryId: validatedData.categoryId,
        isActive: validatedData.isActive,
        isFeatured: validatedData.isFeatured,
        order: validatedData.order,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      
      return res.status(201).json(newConcept);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating concept:", error);
      return res.status(500).json({ error: "Failed to create concept" });
    }
  });
  
  // Update a concept
  app.put("/api/admin/concepts/:id", async (req, res) => {
    try {
      const conceptId = req.params.id;
      
      // 요청 데이터 로깅 (디버깅용)
      console.log("컨셉 업데이트 요청 데이터:", JSON.stringify(req.body, null, 2));
      
      const validatedData = conceptSchema.parse(req.body);
      
      // 유효성 검사 통과한 데이터 로깅 (디버깅용)
      console.log("검증된 컨셉 데이터:", JSON.stringify(validatedData, null, 2));
      
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
          systemPrompt: validatedData.systemPrompt,  // 시스템 프롬프트 필드 추가
          thumbnailUrl: validatedData.thumbnailUrl,
          tagSuggestions: validatedData.tagSuggestions,
          variables: validatedData.variables,
          categoryId: validatedData.categoryId,
          isActive: validatedData.isActive,
          isFeatured: validatedData.isFeatured,
          order: validatedData.order,
          // OpenAI 이미지 생성 관련 필드만 유지
          updatedAt: new Date(),
        })
        .where(eq(concepts.conceptId, conceptId))
        .returning();
      
      return res.json(updatedConcept);
    } catch (error) {
      if (error instanceof z.ZodError) {
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

  // 🎯 컨셉별 변수 조회 API (이미지 생성 템플릿용)
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
      console.log(`[변수 조회] ${conceptId} 컨셉에 ${variables.length}개 변수 반환`);
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
          iconName: serviceItems.iconName,
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
      
      // 카테고리 ID로 필터링 (옵션)
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
        const items = await db.query.serviceItems.findMany({
          where: eq(serviceItems.categoryId, category.id),
          orderBy: [asc(serviceItems.order), asc(serviceItems.id)]
        });
        
        return res.json(items);
      } else {
        // 모든 서비스 항목 조회 (카테고리 정보 포함)
        const items = await db.query.serviceItems.findMany({
          orderBy: [asc(serviceItems.order), asc(serviceItems.id)],
          with: {
            category: true
          }
        });
        
        return res.json(items);
      }
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
      
      // 카테고리 ID를 변경하려는 경우, 중복 확인
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

  // Thumbnail upload endpoint for concepts - GCS 연동
  app.post("/api/admin/upload/thumbnail", upload.single("thumbnail"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log('업로드된 파일 정보:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        hasBuffer: !!req.file.buffer,
        bufferLength: req.file.buffer ? req.file.buffer.length : 0,
        hasPath: !!req.file.path,
        path: req.file.path
      });

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
  
  // Reference image upload endpoint for PhotoMaker - GCS 연동
  app.post("/api/admin/upload/reference", upload.single("reference"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // 작업지시서: GCS에 업로드하고 GCS URL 직접 반환
      const gcsResult = await saveImageToGCS(req.file.buffer, 'anonymous', 'reference', req.file.originalname);
      const fileUrl = gcsResult.originalUrl;
      
      return res.json({
        success: true,
        url: fileUrl,
        filename: req.file.filename
      });
    } catch (error) {
      console.error("Error uploading reference image:", error);
      return res.status(500).json({ error: "Failed to upload reference image" });
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
        startDate: new Date(),
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
      const textContent = await exportChatHistoryAsText();
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="chat_history.txt"');
      
      return res.send(textContent);
    } catch (error) {
      console.error("Error exporting chat history as text:", error);
      return res.status(500).json({ error: "Failed to export chat history" });
    }
  });
  
  // 개발 대화 기록 내보내기 - HTML 형식
  app.get("/api/export/dev-chat/html", async (req, res) => {
    try {
      const htmlContent = await exportDevChatAsHtml();
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', 'attachment; filename="dev_chat_history.html"');
      
      return res.send(htmlContent);
    } catch (error) {
      console.error("Error exporting development chat history as HTML:", error);
      return res.status(500).json({ error: "Failed to export development chat history" });
    }
  });

  // 개발 대화 기록 내보내기 - 텍스트 형식
  app.get("/api/export/dev-chat/text", async (req, res) => {
    try {
      const textContent = await exportDevChatAsText();
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="dev_chat_history.txt"');
      
      return res.send(textContent);
    } catch (error) {
      console.error("Error exporting development chat history as text:", error);
      return res.status(500).json({ error: "Failed to export development chat history" });
    }
  });
  
  // ===== 개발자 대화 히스토리 관리 API =====
  
  // 날짜 목록 가져오기
  app.get("/api/dev-history/dates", (req, res) => {
    try {
      const historyManager = new DevHistoryManager();
      const dates = historyManager.getDateList();
      return res.json({ dates });
    } catch (error) {
      console.error("Error getting dev history dates:", error);
      return res.status(500).json({ error: "Failed to get history dates" });
    }
  });
  
  // 특정 날짜의 대화 히스토리 가져오기
  app.get("/api/dev-history/:date", (req, res) => {
    try {
      const { date } = req.params;
      const historyManager = new DevHistoryManager();
      const htmlContent = historyManager.getHistoryByDate(date);
      
      // HTML 형식으로 반환
      res.setHeader('Content-Type', 'text/html');
      return res.send(htmlContent);
    } catch (error) {
      console.error(`Error getting dev history for date ${req.params.date}:`, error);
      return res.status(500).json({ error: "Failed to get history for this date" });
    }
  });
  
  // 특정 날짜의 대화 히스토리 다운로드
  app.get("/api/dev-history/:date/download", (req, res) => {
    try {
      const { date } = req.params;
      const historyManager = new DevHistoryManager();
      const htmlContent = historyManager.getHistoryByDate(date);
      
      // 파일 다운로드용 헤더 설정
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="dev_chat_${date}.html"`);
      
      return res.send(htmlContent);
    } catch (error) {
      console.error(`Error downloading dev history for date ${req.params.date}:`, error);
      return res.status(500).json({ error: "Failed to download history for this date" });
    }
  });
  
  // 현재 대화를 특정 날짜로 저장
  app.post("/api/dev-history/save/:date", (req, res) => {
    try {
      const { date } = req.params;
      const historyManager = new DevHistoryManager();
      const success = historyManager.saveCurrentHistoryByDate(date);
      
      if (success) {
        return res.json({ success: true, message: `개발 대화가 ${date} 날짜로 저장되었습니다.` });
      } else {
        return res.status(400).json({ error: "Failed to save the current chat history" });
      }
    } catch (error) {
      console.error(`Error saving dev history for date ${req.params.date}:`, error);
      return res.status(500).json({ error: "Failed to save history for this date" });
    }
  });
  
  // "채팅저장" 명령어 처리 엔드포인트 - 현재 날짜로 자동 저장
  app.post("/api/dev-history/save-by-command", (req, res) => {
    try {
      const autoChatSaver = AutoChatSaver.getInstance();
      const success = autoChatSaver.saveByCommand();
      
      if (success) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
        return res.json({ 
          success: true, 
          message: `"채팅저장" 명령에 의해 대화가 ${today} 날짜로 성공적으로 저장되었습니다.` 
        });
      } else {
        return res.status(400).json({ 
          error: "채팅 저장 실패", 
          message: "변경된 내용이 없거나 저장할 내용이 없습니다." 
        });
      }
    } catch (error) {
      console.error("Error saving chat by command:", error);
      return res.status(500).json({ 
        error: "채팅 저장 실패", 
        message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      });
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
      
      const milestone = await createMilestone(req.body);
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
      
      const updatedMilestone = await updateMilestone(milestoneId, req.body);
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
      const { milestoneId } = req.params;
      const { 
        deleteMilestone,
        getMilestoneById 
      } = await import("./services/milestones");
      
      // 마일스톤이 존재하는지 확인
      const existingMilestone = await getMilestoneById(milestoneId);
      if (!existingMilestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }
      
      const deletedMilestone = await deleteMilestone(milestoneId);
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
      
      const bannerData = insertBannerSchema.partial().parse(req.body);
      const updatedBanner = await db
        .update(banners)
        .set({
          ...bannerData,
          updatedAt: new Date()
        })
        .where(eq(banners.id, id))
        .returning();
        
      if (updatedBanner.length === 0) {
        return res.status(404).json({ error: "Banner not found" });
      }
      
      res.json(updatedBanner[0]);
    } catch (error) {
      console.error("Error updating banner:", error);
      res.status(500).json({ error: "Failed to update banner" });
    }
  });
  
  app.delete("/api/admin/banners/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid banner ID" });
      }
      
      const result = await db
        .delete(banners)
        .where(eq(banners.id, id))
        .returning({ id: banners.id });
        
      if (result.length === 0) {
        return res.status(404).json({ error: "Banner not found" });
      }
      
      res.json({ message: "Banner deleted successfully" });
    } catch (error) {
      console.error("Error deleting banner:", error);
      res.status(500).json({ error: "Failed to delete banner" });
    }
  });
  
  // 🗑️ 기존 스타일 카드 API 제거됨 - 새로운 컨셉 관리 시스템 사용
  



  
  // 병원 관리자 전용 캠페인 API
  // 병원 정보 조회 API
  app.get("/api/hospitals/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const user = req.user;
      const hospitalId = parseInt(req.params.id, 10);
      
      // 권한 체크: 해당 병원 관리자 또는 슈퍼 관리자만 접근 가능
      if (user.memberType !== 'superadmin' && (user.memberType !== 'hospital_admin' || user.hospitalId !== hospitalId)) {
        return res.status(403).json({ error: "접근 권한이 없습니다." });
      }
      
      console.log(`병원 정보 조회 - 병원 ID: ${hospitalId}`);
      
      const hospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.id, hospitalId)
      });
      
      if (!hospital) {
        return res.status(404).json({ error: "병원을 찾을 수 없습니다." });
      }
      
      res.json(hospital);
    } catch (error) {
      console.error("병원 정보 조회 오류:", error);
      res.status(500).json({ error: "병원 정보를 가져오는데 실패했습니다." });
    }
  });
  

  

  



  


  // 관리자 전용: 회원 등급 수동 변경 API
  app.patch("/admin/users/:id/role", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const targetUserId = parseInt(req.params.id);
      const { memberType: newMemberType } = req.body;

      // 유효한 memberType인지 검증
      const validMemberTypes = ['general', 'pro', 'membership', 'hospital_admin', 'admin', 'superadmin'];
      if (!validMemberTypes.includes(newMemberType)) {
        return res.status(400).json({
          success: false,
          error: "유효하지 않은 회원 등급입니다.",
          message: "허용된 등급: general, pro, membership, hospital_admin, admin, superadmin"
        });
      }

      // 대상 사용자 조회
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, targetUserId)
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: "사용자를 찾을 수 없습니다.",
          message: "해당 ID의 사용자가 존재하지 않습니다."
        });
      }

      // 권한 체크 로직 (admin 제한 포함)
      if (req.user!.memberType === 'admin') {
        const forbidden = ['admin', 'superadmin'];
        
        // 기존 등급이 admin/superadmin인 사용자는 수정 불가
        if (forbidden.includes(targetUser.memberType)) {
          return res.status(403).json({
            success: false,
            error: "이 등급은 수정할 수 없습니다.",
            message: "admin 권한으로는 admin/superadmin 등급 사용자를 수정할 수 없습니다."
          });
        }
        
        // admin/superadmin으로 승격 불가
        if (forbidden.includes(newMemberType)) {
          return res.status(403).json({
            success: false,
            error: "이 등급으로 변경할 수 없습니다.",
            message: "admin 권한으로는 admin/superadmin 등급으로 승격할 수 없습니다."
          });
        }
      }

      // 회원 등급 업데이트
      const [updatedUser] = await db.update(users)
        .set({ 
          memberType: newMemberType,
          updatedAt: new Date()
        })
        .where(eq(users.id, targetUserId))
        .returning();

      console.log(`[회원 등급 변경] 관리자 ${req.user!.userId}가 사용자 ${targetUserId}의 등급을 ${targetUser.memberType} → ${newMemberType}로 변경`);

      return res.json({
        success: true,
        message: "회원 등급이 변경되었습니다.",
        data: {
          userId: targetUserId,
          previousMemberType: targetUser.memberType,
          newMemberType: newMemberType,
          updatedAt: updatedUser.updatedAt
        }
      });

    } catch (error) {
      console.error("회원 등급 변경 오류:", error);
      return res.status(500).json({
        success: false,
        error: "회원 등급 변경 중 오류가 발생했습니다.",
        message: "서버 내부 오류"
      });
    }
  });

  // 관리자 전용: 사용자 목록 조회 API
  app.get("/api/admin/users", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      // 사용자 목록 조회 (민감한 정보 제외)
      const userList = await db.query.users.findMany({
        limit,
        offset,
        orderBy: (users, { desc }) => [desc(users.createdAt)],
        columns: {
          id: true,
          username: true,
          email: true,
          memberType: true,
          createdAt: true,
          hospitalId: true
        }
      });

      // 전체 사용자 수 조회
      const totalUsers = await db.select({ count: sql`count(*)::int` }).from(users);
      const total = totalUsers[0]?.count || 0;

      console.log(`[사용자 목록 조회] 관리자 ${req.user!.userId}가 사용자 목록 조회 (${userList.length}명)`);

      return res.json({
        success: true,
        data: userList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error("사용자 목록 조회 오류:", error);
      return res.status(500).json({
        success: false,
        error: "사용자 목록 조회 중 오류가 발생했습니다.",
        message: "서버 내부 오류"
      });
    }
  });

  // ==================== 병원 관리자 전용 API ====================
  
  // 현재 사용자의 병원 정보 조회
  app.get("/api/hospital/info", requireHospitalAdmin, async (req, res) => {
    try {
      // 병원 관리자인 경우 본인 병원 정보만 조회
      const hospitalId = req.user!.memberType === 'hospital_admin' ? req.user!.hospitalId : null;
      
      if (!hospitalId && req.user!.memberType === 'hospital_admin') {
        return res.status(400).json({
          success: false,
          error: "병원 정보가 설정되지 않았습니다.",
          message: "계정에 병원 ID가 연결되어 있지 않습니다."
        });
      }

      const hospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.id, hospitalId!),
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
        return res.status(404).json({
          success: false,
          error: "병원 정보를 찾을 수 없습니다."
        });
      }

      console.log(`[병원 정보 조회] 병원관리자 ${req.user!.userId}가 병원 ${hospital.name} 정보 조회`);

      return res.json({
        success: true,
        data: hospital
      });

    } catch (error) {
      console.error("병원 정보 조회 오류:", error);
      return res.status(500).json({
        success: false,
        error: "병원 정보 조회 중 오류가 발생했습니다.",
        message: "서버 내부 오류"
      });
    }
  });
  










  // ==================== 관리자 전용 병원 관리 API ====================
  // 구버전 병원 관리 API 제거됨 - admin-routes.ts의 /api/admin/hospitals/* 사용

  // 구버전 병원 CRUD API 제거됨 - admin-routes.ts의 /api/admin/hospitals/* 사용
  



  
  // 썸네일 이미지 업로드 API - GCS 연동
  app.post("/api/admin/upload-thumbnail", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // 작업지시서: GCS에 업로드하고 GCS URL 직접 저장
      const gcsResult = await saveImageToGCS(req.file.buffer, 'anonymous', 'thumbnails', req.file.originalname);
      const gcsUrl = gcsResult.originalUrl;
      
      res.status(201).json({
        url: gcsUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("썸네일 업로드 에러:", error);
      res.status(500).json({ error: "Failed to upload thumbnail" });
    }
  });
  
  // Service Categories 관련 API 엔드포인트
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
      
      const [newCategory] = await db
        .insert(serviceCategories)
        .values(validatedData)
        .returning();
        
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
      
      const validatedData = insertServiceCategorySchema.parse(req.body);
      
      const [updatedCategory] = await db
        .update(serviceCategories)
        .set(validatedData)
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

  // Replicate API 테스트 엔드포인트 추가
  app.get("/api/test-replicate", async (req, res) => {
    try {
      const { testReplicateAPI } = await import("./test-replicate");
      console.log("Replicate API 테스트 요청 수신됨");
      const result = await testReplicateAPI();
      return res.json(result);
    } catch (error) {
      console.error("Replicate API 테스트 엔드포인트 오류:", error);
      return res.status(500).json({ error: error.message || "알 수 없는 오류" });
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
      const result = await storage.deleteImage(imageId, String(userId));
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
  // app.use('/api/image', imageRouter); // 중복 제거됨

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
        where: eq(users.id, userId)
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
        details: error.message,
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
        details: error.message
      });
    }
  });

  // 음악 스타일 삭제
  app.delete("/api/admin/music-styles/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const styleId = parseInt(req.params.id);
      
      // 기존 스타일 존재 확인
      const existingStyle = await db.execute(
        'SELECT id FROM music_styles WHERE id = $1',
        [styleId]
      );
      
      if (existingStyle.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "음악 스타일을 찾을 수 없습니다."
        });
      }
      
      await db.execute('DELETE FROM music_styles WHERE id = $1', [styleId]);
      
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

  // 정적 파일 서빙 설정 - 이미지 표시를 위해 필수
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use('/static', express.static(path.join(process.cwd(), 'static')));

  // 전역 미들웨어 등록 (모든 라우트에 적용)
  app.use(requestLogger);
  app.use(responseFormatter);

  // 전역 에러 핸들링 미들웨어 (마지막에 등록)
  app.use(errorHandler);

  const httpServer = createServer(app);

  return httpServer;
}
