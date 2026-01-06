import type { Express, Request, Response } from "express";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { requireAdminOrSuperAdmin } from "../middleware/admin-auth";
import { requireAuth } from "../middleware/auth";
import { 
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
  banners,
  smallBanners,
  popularStyles,
  mainGalleryItems,
  milestones,
  milestoneCategories,
  serviceCategories,
  users,
  hospitalCodes,
  musicStyles,
  music,
  systemSettings,
  milestoneApplications,
  milestoneApplicationFiles,

  insertConceptSchema,
  insertConceptCategorySchema,
  insertBannerSchema,
  insertServiceCategorySchema,
  insertServiceItemSchema,
  insertHospitalCodeSchema,
  insertMusicStyleSchema,
  systemSettingsUpdateSchema,
  popularStylesInsertSchema,
  mainGalleryItemsInsertSchema,
  AI_MODELS,
} from "../../shared/schema";
import { db } from "@db";
import { eq, desc, and, asc, sql, ne, like, or, inArray, isNull, count } from "drizzle-orm";
import { HOSPITAL_CONSTANTS, hospitalUtils, MEMBER_TYPE_OPTIONS, USER_CONSTANTS, userUtils } from "../../shared/constants";
import { HOSPITAL_MESSAGES, USER_MESSAGES } from "../constants";
import { 
  getSystemSettings, 
  updateSystemSettings, 
  refreshSettingsCache,
  checkSystemSettingsHealth 
} from "../utils/settings";
import { createUploadMiddleware } from "../config/upload-config";
import { saveImageToGCS, saveBannerToGCS, setAllImagesPublic } from "../utils/gcs-image-storage";
import { resolveImageUrl } from "../utils/gcs.js";
import adminSnapshotRouter from "./admin-snapshot";

// Upload middleware setup
const bannerUpload = createUploadMiddleware('banners', 'image');
const imageUpload = createUploadMiddleware('thumbnails', 'image');
const milestoneUpload = createUploadMiddleware('milestones', 'image');

// Utility functions
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const normalizeOptionalString = (value: string | null | undefined): string | undefined => {
  return value === null ? undefined : value;
};

const getUserId = (req: Request): string => {
  const userId = req.user?.id || req.user?.userId;
  return String(userId);
};

const validateUserId = (req: Request, res: Response): string | null => {
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
};

// 병원 코드 자동 생성 함수
const generateHospitalCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};


// Schema definitions
const personaSchema = z.object({
  personaId: z.string().min(1, "Persona ID is required"),
  name: z.string().min(1, "Name is required"),
  avatarEmoji: z.string().min(1, "Avatar emoji is required"),
  description: z.string().min(1, "Description is required"),
  welcomeMessage: z.string().min(1, "Welcome message is required"),
  systemPrompt: z.string().min(1, "System prompt is required"),
  primaryColor: z.string().min(1, "Primary color is required"),
  secondaryColor: z.string().min(1, "Secondary color is required"),
  personality: z.string().optional(),
  tone: z.string().optional(),
  usageContext: z.string().optional(),
  emotionalKeywords: z.array(z.string()).optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night", "all"]).default("all"),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  order: z.number().int().default(0),
  categories: z.array(z.string()).optional(),
});

const personaCategorySchema = z.object({
  categoryId: z.string().min(1, "Category ID is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  emoji: z.string().min(1, "Emoji is required"),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const conceptCategorySchema = z.object({
  categoryId: z.string().min(1, "Category ID is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const conceptSchema = z.object({
  conceptId: z.string().min(1, "Concept ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  promptTemplate: z.string().min(1, "Prompt template is required"),
  systemPrompt: z.string().optional(),
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
});

export function registerAdminRoutes(app: Express): void {
  
  // Snapshot prompts management
  app.use('/api/admin', adminSnapshotRouter);

  // Model Capabilities Routes
  app.get("/api/admin/model-capabilities", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      // 모든 컨셉들의 availableAspectRatios를 집계하여 모델별 기본값 계산 (관리자는 비활성 컨셉도 포함)
      const allConcepts = await db.select({
        conceptId: concepts.conceptId,
        title: concepts.title,
        isActive: concepts.isActive,
        availableAspectRatios: concepts.availableAspectRatios
      }).from(concepts).orderBy(asc(concepts.order));

      console.log(`[Admin Model Capabilities] ${allConcepts.length}개 전체 컨셉에서 비율 정보 집계 중...`);

      // 모델별로 지원하는 비율을 집계
      const modelCapabilities: Record<string, Set<string>> = {};
      
      for (const concept of allConcepts) {
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

      // 빈 결과인 경우 기본값 반환 (fallback)
      if (Object.keys(finalCapabilities).length === 0) {
        console.warn("[Admin Model Capabilities] 데이터베이스에서 비율 정보를 찾을 수 없어 기본값을 반환합니다");
        const fallbackCapabilities = {
          "openai": ["1:1", "2:3", "3:2"],
          "gemini": ["1:1", "9:16", "16:9"]
        };
        return res.json(fallbackCapabilities);
      }

      console.log("[Admin Model Capabilities] 지원 가능한 비율 정보 반환 (관리자):", finalCapabilities);

      // 관리자용 추가 정보 (디버깅용)
      const debugInfo = {
        totalConcepts: allConcepts.length,
        activeConcepts: allConcepts.filter(c => c.isActive).length,
        inactiveConcepts: allConcepts.filter(c => !c.isActive).length,
        capabilities: finalCapabilities
      };

      res.json(debugInfo.capabilities);
    } catch (error) {
      console.error("Error fetching admin model capabilities:", error);
      res.status(500).json({ error: "Failed to fetch model capabilities" });
    }
  });

  // Banner Management Routes
  app.post("/api/admin/create-small-banner", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const bannerData = {
        title: req.body.title,
        description: req.body.description,
        imageUrl: req.body.imageSrc,
        linkUrl: req.body.href,
        isActive: req.body.isActive,
        order: req.body.order
      };

      const newBanner = await db.insert(smallBanners).values(bannerData).returning();

      const formattedBanner = {
        id: newBanner[0].id,
        title: newBanner[0].title,
        description: newBanner[0].description,
        imageSrc: newBanner[0].imageUrl,
        href: newBanner[0].linkUrl,
        isActive: newBanner[0].isActive,
        order: newBanner[0].order,
        createdAt: newBanner[0].createdAt
      };

      res.status(201).json(formattedBanner);
    } catch (error) {
      console.error("Error creating small banner:", error);
      res.status(500).json({ error: "Failed to create small banner" });
    }
  });

  app.put("/api/admin/small-banners/:id", requireAdminOrSuperAdmin, async (req, res) => {
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

      const formattedBanner = {
        id: updatedSmallBanner[0].id,
        title: updatedSmallBanner[0].title,
        description: updatedSmallBanner[0].description,
        imageSrc: updatedSmallBanner[0].imageUrl,
        href: updatedSmallBanner[0].linkUrl,
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

  app.delete("/api/admin/small-banners/:id", requireAdminOrSuperAdmin, async (req, res) => {
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

  // ========================================
  // 인기스타일 (Popular Styles) CRUD API
  // ========================================
  
  app.get("/api/admin/popular-styles", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const styles = await db.select().from(popularStyles).orderBy(asc(popularStyles.sortOrder));
      res.json(styles);
    } catch (error) {
      console.error("Error fetching popular styles:", error);
      res.status(500).json({ error: "Failed to fetch popular styles" });
    }
  });

  app.post("/api/admin/popular-styles", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const validatedData = popularStylesInsertSchema.parse({
        ...req.body,
        sortOrder: Number(req.body.sortOrder) || 0
      });
      const newStyle = await db.insert(popularStyles).values(validatedData).returning();
      res.status(201).json(newStyle[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "입력 데이터가 올바르지 않습니다", details: error.errors });
      }
      console.error("Error creating popular style:", error);
      res.status(500).json({ error: "Failed to create popular style" });
    }
  });

  // 인기스타일 순서 일괄 변경 API (반드시 /:id 라우트보다 먼저 정의)
  app.put("/api/admin/popular-styles/reorder", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items 배열이 필요합니다" });
      }

      for (let i = 0; i < items.length; i++) {
        await db
          .update(popularStyles)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(popularStyles.id, items[i].id));
      }

      res.json({ message: "순서가 성공적으로 변경되었습니다" });
    } catch (error) {
      console.error("Error reordering popular styles:", error);
      res.status(500).json({ error: "순서 변경에 실패했습니다" });
    }
  });

  app.put("/api/admin/popular-styles/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid popular style ID" });
      }

      const validatedData = popularStylesInsertSchema.parse({
        ...req.body,
        sortOrder: Number(req.body.sortOrder) || 0
      });

      const styleData = {
        ...validatedData,
        updatedAt: new Date()
      };

      const updatedStyle = await db
        .update(popularStyles)
        .set(styleData)
        .where(eq(popularStyles.id, id))
        .returning();

      if (updatedStyle.length === 0) {
        return res.status(404).json({ error: "Popular style not found" });
      }

      res.json(updatedStyle[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "입력 데이터가 올바르지 않습니다", details: error.errors });
      }
      console.error("Error updating popular style:", error);
      res.status(500).json({ error: "Failed to update popular style" });
    }
  });

  app.delete("/api/admin/popular-styles/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid popular style ID" });
      }

      const deletedStyle = await db
        .delete(popularStyles)
        .where(eq(popularStyles.id, id))
        .returning();

      if (deletedStyle.length === 0) {
        return res.status(404).json({ error: "Popular style not found" });
      }

      res.json({ message: "Popular style deleted successfully" });
    } catch (error) {
      console.error("Error deleting popular style:", error);
      res.status(500).json({ error: "Failed to delete popular style" });
    }
  });

  // ========================================
  // 메인갤러리 (Main Gallery Items) CRUD API
  // ========================================
  
  app.get("/api/admin/main-gallery", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const items = await db.select().from(mainGalleryItems).orderBy(asc(mainGalleryItems.sortOrder));
      res.json(items);
    } catch (error) {
      console.error("Error fetching main gallery items:", error);
      res.status(500).json({ error: "Failed to fetch main gallery items" });
    }
  });

  app.post("/api/admin/main-gallery", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const validatedData = mainGalleryItemsInsertSchema.parse({
        ...req.body,
        sortOrder: Number(req.body.sortOrder) || 0
      });
      const newItem = await db.insert(mainGalleryItems).values(validatedData).returning();
      res.status(201).json(newItem[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "입력 데이터가 올바르지 않습니다", details: error.errors });
      }
      console.error("Error creating main gallery item:", error);
      res.status(500).json({ error: "Failed to create main gallery item" });
    }
  });

  // 메인갤러리 순서 일괄 변경 API (반드시 /:id 라우트보다 먼저 정의)
  app.put("/api/admin/main-gallery/reorder", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items 배열이 필요합니다" });
      }

      for (let i = 0; i < items.length; i++) {
        await db
          .update(mainGalleryItems)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(mainGalleryItems.id, items[i].id));
      }

      res.json({ message: "순서가 성공적으로 변경되었습니다" });
    } catch (error) {
      console.error("Error reordering main gallery items:", error);
      res.status(500).json({ error: "순서 변경에 실패했습니다" });
    }
  });

  app.put("/api/admin/main-gallery/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid main gallery item ID" });
      }

      const validatedData = mainGalleryItemsInsertSchema.parse({
        ...req.body,
        sortOrder: Number(req.body.sortOrder) || 0
      });

      const itemData = {
        ...validatedData,
        updatedAt: new Date()
      };

      const updatedItem = await db
        .update(mainGalleryItems)
        .set(itemData)
        .where(eq(mainGalleryItems.id, id))
        .returning();

      if (updatedItem.length === 0) {
        return res.status(404).json({ error: "Main gallery item not found" });
      }

      res.json(updatedItem[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "입력 데이터가 올바르지 않습니다", details: error.errors });
      }
      console.error("Error updating main gallery item:", error);
      res.status(500).json({ error: "Failed to update main gallery item" });
    }
  });

  app.delete("/api/admin/main-gallery/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid main gallery item ID" });
      }

      const deletedItem = await db
        .delete(mainGalleryItems)
        .where(eq(mainGalleryItems.id, id))
        .returning();

      if (deletedItem.length === 0) {
        return res.status(404).json({ error: "Main gallery item not found" });
      }

      res.json({ message: "Main gallery item deleted successfully" });
    } catch (error) {
      console.error("Error deleting main gallery item:", error);
      res.status(500).json({ error: "Failed to delete main gallery item" });
    }
  });

  app.post("/api/admin/banners", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const bannerData = insertBannerSchema.parse(req.body);
      const newBanner = await db.insert(banners).values(bannerData).returning();
      res.status(201).json(newBanner[0]);
    } catch (error) {
      console.error("Error creating banner:", error);
      res.status(500).json({ error: "Failed to create banner" });
    }
  });

  app.put("/api/admin/banners/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const bannerData = insertBannerSchema.parse(req.body);

      const updatedBanner = await db
        .update(banners)
        .set({ ...bannerData, updatedAt: new Date() })
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

  app.delete("/api/admin/banners/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const deletedBanner = await db
        .delete(banners)
        .where(eq(banners.id, id))
        .returning();

      if (deletedBanner.length === 0) {
        return res.status(404).json({ error: "Banner not found" });
      }

      res.json({ message: "Banner deleted successfully" });
    } catch (error) {
      console.error("Error deleting banner:", error);
      res.status(500).json({ error: "Failed to delete banner" });
    }
  });

  // User Management Routes
  // 회원 목록 조회 API (병원 정보 포함)
  app.get("/api/admin/users", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      console.log('[MemberManagement API] 회원 목록 조회 요청');
      
      // 쿼리 파라미터 추출
      const search = req.query.search as string || '';
      const memberType = req.query.memberType as string || '';
      const hospitalId = req.query.hospitalId as string || '';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      console.log('[MemberManagement API] 쿼리 파라미터:', { search, memberType, hospitalId, page, limit });

      // 기본 쿼리 조건 구성
      let whereConditions: any[] = [];
      
      // 검색어가 있으면 username, email, fullName에서 검색
      if (search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        whereConditions.push(
          sql`(${users.username} ILIKE ${searchTerm} OR ${users.email} ILIKE ${searchTerm} OR ${users.fullName} ILIKE ${searchTerm})`
        );
      }
      
      // 회원 등급 필터
      if (memberType && memberType !== 'all') {
        whereConditions.push(eq(users.memberType, memberType));
      }
      
      // 병원 필터
      if (hospitalId && hospitalId !== 'all') {
        whereConditions.push(eq(users.hospitalId, parseInt(hospitalId)));
      }

      // 총 개수 조회
      const totalCountQuery = whereConditions.length > 0 
        ? db.select({ count: sql<number>`count(*)` }).from(users).where(and(...whereConditions))
        : db.select({ count: sql<number>`count(*)` }).from(users);
      
      const totalCountResult = await totalCountQuery;
      const totalCount = totalCountResult[0]?.count || 0;

      // 사용자 목록 조회 (병원 정보 포함)
      const usersQuery = db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          memberType: users.memberType,
          hospitalId: users.hospitalId,
          phoneNumber: users.phoneNumber,
          birthdate: users.birthdate,
          fullName: users.fullName,
          createdAt: users.createdAt,
          lastLogin: users.lastLogin,
          // 병원 정보
          hospitalName: hospitals.name,
          hospitalSlug: hospitals.slug
        })
        .from(users)
        .leftJoin(hospitals, eq(users.hospitalId, hospitals.id))
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      const usersWithHospitals = whereConditions.length > 0
        ? await usersQuery.where(and(...whereConditions))
        : await usersQuery;

      // 병원 정보를 포함한 사용자 데이터 구성
      const formattedUsers = usersWithHospitals.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        memberType: user.memberType,
        hospitalId: user.hospitalId,
        hospital: user.hospitalId ? {
          id: user.hospitalId,
          name: user.hospitalName || '알 수 없는 병원'
        } : null,
        phoneNumber: user.phoneNumber,
        birthdate: user.birthdate 
          ? (() => {
              try {
                if (user.birthdate instanceof Date) {
                  // Date 객체이지만 Invalid Date일 수 있음
                  return isNaN(user.birthdate.getTime()) ? null : user.birthdate.toISOString().split('T')[0];
                } else {
                  // 문자열이나 다른 타입
                  const dateObj = new Date(user.birthdate);
                  return isNaN(dateObj.getTime()) ? null : dateObj.toISOString().split('T')[0];
                }
              } catch (error) {
                console.warn(`[MemberManagement] Invalid birthdate for user ${user.id}: ${user.birthdate}`);
                return null;
              }
            })()
          : null,
        fullName: user.fullName,
        createdAt: user.createdAt.toISOString(),
        lastLogin: user.lastLogin?.toISOString() || null
      }));

      const response = {
        users: formattedUsers,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      };

      console.log(`[MemberManagement API] 회원 목록 조회 완료: ${formattedUsers.length}명 / 총 ${totalCount}명`);
      res.json(response);

    } catch (error) {
      console.error('[MemberManagement API] 회원 목록 조회 오류:', error);
      res.status(500).json({ 
        error: '회원 목록을 조회하는 중 오류가 발생했습니다.',
        users: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
      });
    }
  });

  app.delete("/api/admin/users/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).user;

      // 슈퍼관리자만 회원 삭제 가능
      if (currentUser.memberType !== USER_CONSTANTS.MEMBER_TYPES.SUPERADMIN) {
        return res.status(403).json({ 
          error: USER_MESSAGES.ERRORS.SUPERADMIN_REQUIRED 
        });
      }

      const userId = parseInt(req.params.id);

      const userToDelete = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!userToDelete) {
        return res.status(404).json({ 
          error: USER_MESSAGES.ERRORS.USER_NOT_FOUND 
        });
      }

      // 슈퍼관리자는 삭제할 수 없음
      if (userToDelete.memberType === USER_CONSTANTS.MEMBER_TYPES.SUPERADMIN) {
        return res.status(403).json({ 
          error: USER_MESSAGES.ERRORS.CANNOT_DELETE_SUPERADMIN 
        });
      }

      await db.delete(users).where(eq(users.id, userId));

      res.json({ 
        message: USER_MESSAGES.SUCCESS.USER_DELETED 
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "회원을 삭제하는 중 오류가 발생했습니다" });
    }
  });

  app.put("/api/admin/users/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const userId = parseInt(req.params.id);
      const { memberType, username, email, hospitalId, phoneNumber, birthdate } = req.body;

      // 회원 등급 유효성 검사
      if (memberType && !userUtils.validateMemberType(memberType)) {
        return res.status(400).json({ 
          error: USER_MESSAGES.ERRORS.INVALID_MEMBER_TYPE 
        });
      }

      // 수정할 사용자 정보 조회
      const userToUpdate = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!userToUpdate) {
        return res.status(404).json({ 
          error: USER_MESSAGES.ERRORS.USER_NOT_FOUND 
        });
      }

      // 슈퍼관리자끼리는 서로 수정 불가 (본인 제외)
      if (userToUpdate.memberType === USER_CONSTANTS.MEMBER_TYPES.SUPERADMIN && 
          currentUser.id !== userId) {
        return res.status(403).json({ 
          error: USER_MESSAGES.ERRORS.CANNOT_MODIFY_SUPERADMIN 
        });
      }

      // 일반 관리자는 슈퍼관리자로 승격시킬 수 없음
      if (memberType === USER_CONSTANTS.MEMBER_TYPES.SUPERADMIN && 
          currentUser.memberType !== USER_CONSTANTS.MEMBER_TYPES.SUPERADMIN) {
        return res.status(403).json({ 
          error: USER_MESSAGES.ERRORS.SUPERADMIN_REQUIRED 
        });
      }

      const updateData: any = {
        updatedAt: new Date()
      };

      if (username) updateData.username = username;
      if (email) updateData.email = email;
      if (memberType) updateData.memberType = memberType;
      if (hospitalId !== undefined) updateData.hospitalId = hospitalId || null;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null;
      if (birthdate !== undefined) updateData.birthdate = birthdate || null;

      const updatedUser = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      if (updatedUser.length === 0) {
        return res.status(404).json({ 
          error: USER_MESSAGES.ERRORS.USER_NOT_FOUND 
        });
      }

      res.json(updatedUser[0]);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "회원 정보를 수정하는 중 오류가 발생했습니다" });
    }
  });

  app.patch("/admin/users/:id/role", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { memberType } = req.body;

      const updatedUser = await db
        .update(users)
        .set({ 
          memberType,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      if (updatedUser.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser[0]);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // Hospital Management Routes

  // 병원 목록 조회
  app.get("/api/admin/hospitals", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || HOSPITAL_CONSTANTS.PAGINATION.DEFAULT_PAGE;
      const limit = Math.min(
        parseInt(req.query.limit as string) || HOSPITAL_CONSTANTS.PAGINATION.DEFAULT_LIMIT,
        HOSPITAL_CONSTANTS.PAGINATION.MAX_LIMIT
      );
      const offset = (page - 1) * limit;

      const hospitalsList = await db.query.hospitals.findMany({
        limit,
        offset,
        orderBy: (hospitals, { desc }) => [desc(hospitals.createdAt)]
      });

      // 전체 병원 수 조회
      const totalResult = await db.select({ count: sql`count(*)::int` }).from(hospitals);
      const total = Number(totalResult[0]?.count) || 0;

      console.log(`[관리자 API] 병원 목록 조회 - ${hospitalsList.length}개 병원 반환`);

      res.json({
        success: true,
        data: hospitalsList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("병원 목록 조회 오류:", error);
      res.status(500).json({ error: HOSPITAL_MESSAGES.ERRORS.FETCH_FAILED });
    }
  });

  app.post("/api/admin/hospitals", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { name, address, phone, email, packageType, themeColor, contractStartDate, contractEndDate } = req.body;

      // 필수 필드 유효성 검사
      if (!hospitalUtils.validateHospitalName(name)) {
        return res.status(400).json({ error: HOSPITAL_MESSAGES.ERRORS.INVALID_NAME });
      }

      if (!address?.trim()) {
        return res.status(400).json({ error: HOSPITAL_MESSAGES.ERRORS.INVALID_ADDRESS });
      }

      if (!phone?.trim() || !hospitalUtils.validatePhoneNumber(phone)) {
        return res.status(400).json({ error: HOSPITAL_MESSAGES.ERRORS.INVALID_PHONE });
      }

      // 중복 병원명 검사
      const existingHospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.name, name.trim())
      });

      if (existingHospital) {
        return res.status(409).json({ error: HOSPITAL_MESSAGES.ERRORS.DUPLICATE_NAME });
      }

      // 병원 데이터 준비 (기본값 적용)
      const hospitalData = {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        packageType: packageType || HOSPITAL_CONSTANTS.DEFAULTS.PACKAGE_TYPE,
        themeColor: themeColor || HOSPITAL_CONSTANTS.DEFAULTS.THEME_COLOR,
        contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
        contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
        isActive: HOSPITAL_CONSTANTS.DEFAULTS.IS_ACTIVE,
        slug: hospitalUtils.generateSlug(name),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [newHospital] = await db.insert(hospitals).values(hospitalData).returning();

      console.log(`[관리자 API] 병원 생성 성공: ${newHospital.name} (ID: ${newHospital.id})`);

      res.status(201).json({
        success: true,
        data: newHospital,
        message: HOSPITAL_MESSAGES.SUCCESS.CREATED
      });
    } catch (error) {
      console.error("병원 생성 오류:", error);
      res.status(500).json({ error: HOSPITAL_MESSAGES.ERRORS.CREATE_FAILED });
    }
  });

  app.patch("/api/admin/hospitals/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const hospitalData = req.body;

      console.log(`[관리자 API] 병원 수정 요청 - ID: ${id}`, hospitalData);

      // 기존 병원 정보 조회 (isActive 변경 감지용)
      const existingHospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.id, id)
      });

      if (!existingHospital) {
        console.log(`[관리자 API] 병원 수정 실패 - ID ${id} 찾을 수 없음`);
        return res.status(404).json({ error: "Hospital not found" });
      }

      // 날짜 필드 변환 처리
      const processedData = { ...hospitalData };

      // contractStartDate 처리
      if (hospitalData.contractStartDate) {
        processedData.contractStartDate = hospitalData.contractStartDate === "" 
          ? null 
          : new Date(hospitalData.contractStartDate);
      }

      // contractEndDate 처리  
      if (hospitalData.contractEndDate) {
        processedData.contractEndDate = hospitalData.contractEndDate === ""
          ? null
          : new Date(hospitalData.contractEndDate);
      }

      // updatedAt은 항상 현재 시간으로 설정
      processedData.updatedAt = new Date();

      // isActive 상태 변경 감지
      const isActiveChanged = hospitalData.hasOwnProperty('isActive') && 
                              hospitalData.isActive !== existingHospital.isActive;

      console.log(`[관리자 API] isActive 변경 감지: ${isActiveChanged ? '예' : '아니오'}`);
      if (isActiveChanged) {
        console.log(`[관리자 API] 상태 변경: ${existingHospital.isActive} → ${hospitalData.isActive}`);
      }

      const updatedHospital = await db
        .update(hospitals)
        .set(processedData)
        .where(eq(hospitals.id, id))
        .returning();

      // 🚀 병원 상태 변경 시 동적 회원 등급 자동화 트리거
      if (isActiveChanged) {
        console.log(`[자동화 트리거] 병원 상태 변경 감지 - 회원 등급 자동 변경 시작`);

        const isActive = hospitalData.isActive;

        // 해당 병원의 모든 membership 회원 조회 (과거 membership이었던 pro, free 회원 포함)
        const targetUsers = await db.query.users.findMany({
          where: eq(users.hospitalId, id)
        });

        // membership 기본 등급 회원들과 이전에 변경된 pro/free 회원들 구분
        const membershipUsers = targetUsers.filter(u => u.memberType === 'membership');
        const changedUsers = targetUsers.filter(u => u.memberType && ['pro', 'free'].includes(u.memberType) && u.hospitalId === id);

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
            if (currentType && ['admin', 'superadmin', 'hospital_admin'].includes(currentType)) {
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
      }

      console.log(`[관리자 API] 병원 수정 성공 - ID: ${id}`, updatedHospital[0]);

      // 자동화 결과 메시지 포함
      const responseMessage = isActiveChanged ? {
        hospital: updatedHospital[0],
        automationTriggered: true,
        message: hospitalData.isActive 
          ? `병원이 활성화되었으며, 소속 회원들이 pro 등급으로 승격되었습니다`
          : `병원이 비활성화되었으며, 소속 회원들이 free 등급으로 변경되었습니다`
      } : { hospital: updatedHospital[0] };

      res.json(responseMessage);
    } catch (error) {
      console.error("[관리자 API] 병원 수정 오류:", error);
      res.status(500).json({ error: "Failed to update hospital" });
    }
  });

  app.delete("/api/admin/hospitals/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const deletedHospital = await db
        .delete(hospitals)
        .where(eq(hospitals.id, id))
        .returning();

      if (deletedHospital.length === 0) {
        return res.status(404).json({ error: "Hospital not found" });
      }

      res.json({ message: "Hospital deleted successfully" });
    } catch (error) {
      console.error("Error deleting hospital:", error);
      res.status(500).json({ error: "Failed to delete hospital" });
    }
  });





  // Service Management Routes
  app.get("/api/admin/service-categories", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categories = await db.query.serviceCategories.findMany({
        orderBy: (serviceCategories, { asc }) => [asc(serviceCategories.order)]
      });

      res.json(categories);
    } catch (error) {
      console.error("Error fetching service categories:", error);
      res.status(500).json({ error: "Failed to fetch service categories" });
    }
  });

  app.post("/api/admin/service-categories", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categoryData = insertServiceCategorySchema.parse(req.body);
      const newCategory = await db.insert(serviceCategories).values(categoryData).returning();
      res.status(201).json(newCategory[0]);
    } catch (error) {
      console.error("Error creating service category:", error);
      res.status(500).json({ error: "Failed to create service category" });
    }
  });

  app.patch("/api/admin/service-categories/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertServiceCategorySchema.parse(req.body);

      const updatedCategory = await db
        .update(serviceCategories)
        .set({ ...categoryData, updatedAt: new Date() })
        .where(eq(serviceCategories.id, id))
        .returning();

      if (updatedCategory.length === 0) {
        return res.status(404).json({ error: "Service category not found" });
      }

      res.json(updatedCategory[0]);
    } catch (error) {
      console.error("Error updating service category:", error);
      res.status(500).json({ error: "Failed to update service category" });
    }
  });

  app.delete("/api/admin/service-categories/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const deletedCategory = await db
        .delete(serviceCategories)
        .where(eq(serviceCategories.id, id))
        .returning();

      if (deletedCategory.length === 0) {
        return res.status(404).json({ error: "Service category not found" });
      }

      res.json({ message: "Service category deleted successfully" });
    } catch (error) {
      console.error("Error deleting service category:", error);
      res.status(500).json({ error: "Failed to delete service category" });
    }
  });

  // Service Items Management Routes
  app.get("/api/admin/service-items", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const items = await db.query.serviceItems.findMany({
        with: {
          category: true
        },
        orderBy: (serviceItems, { asc }) => [asc(serviceItems.order)]
      });

      res.json(items);
    } catch (error) {
      console.error("Error fetching service items:", error);
      res.status(500).json({ error: "Failed to fetch service items" });
    }
  });

  app.post("/api/admin/service-items", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { itemId, title, description, icon, categoryId, isPublic, order } = req.body;

      // path 필드를 itemId 기반으로 자동 생성
      const itemData = {
        itemId,
        title,
        description,
        path: `/${itemId}`, // 자동 생성
        icon,
        categoryId,
        isPublic: isPublic ?? true,
        order: order ?? 0
      };

      const newItem = await db.insert(serviceItems).values(itemData).returning();
      res.status(201).json(newItem[0]);
    } catch (error) {
      console.error("Error creating service item:", error);
      res.status(500).json({ error: "Failed to create service item" });
    }
  });

  app.put("/api/admin/service-items/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const itemData = insertServiceItemSchema.parse(req.body);

      const updatedItem = await db
        .update(serviceItems)
        .set({ ...itemData, updatedAt: new Date() })
        .where(eq(serviceItems.id, id))
        .returning();

      if (updatedItem.length === 0) {
        return res.status(404).json({ error: "Service item not found" });
      }

      res.json(updatedItem[0]);
    } catch (error) {
      console.error("Error updating service item:", error);
      res.status(500).json({ error: "Failed to update service item" });
    }
  });

  app.patch("/api/admin/service-items/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const itemData = req.body;

      const updatedItem = await db
        .update(serviceItems)
        .set({ ...itemData, updatedAt: new Date() })
        .where(eq(serviceItems.id, id))
        .returning();

      if (updatedItem.length === 0) {
        return res.status(404).json({ error: "Service item not found" });
      }

      res.json(updatedItem[0]);
    } catch (error) {
      console.error("Error updating service item:", error);
      res.status(500).json({ error: "Failed to update service item" });
    }
  });

  app.delete("/api/admin/service-items/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const deletedItem = await db
        .delete(serviceItems)
        .where(eq(serviceItems.id, id))
        .returning();

      if (deletedItem.length === 0) {
        return res.status(404).json({ error: "Service item not found" });
      }

      res.json({ message: "Service item deleted successfully" });
    } catch (error) {
      console.error("Error deleting service item:", error);
      res.status(500).json({ error: "Failed to delete service item" });
    }
  });

  // File Upload Routes removed - using GCS endpoints from routes.ts instead

  // Milestone Management Routes
  app.get("/api/milestones", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { type } = req.query;
      
      let query = db.query.milestones.findMany({
        with: {
          category: true,
          hospital: true
        },
        orderBy: (milestones, { asc }) => [asc(milestones.order)]
      });

      let milestonesList = await query;

      // 타입 필터링
      if (type) {
        milestonesList = milestonesList.filter(m => m.type === type);
      }

      res.json(milestonesList);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ error: "Failed to fetch milestones" });
    }
  });

  app.post("/api/admin/milestones", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const milestoneData = req.body;
      
      const newMilestone = await db.insert(milestones).values(milestoneData).returning();
      
      res.status(201).json(newMilestone[0]);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(500).json({ error: "Failed to create milestone" });
    }
  });

  app.put("/api/admin/milestones/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const milestoneData = req.body;

      // Convert hospitalId = 0 to null for "전체" selection
      if (milestoneData.hospitalId === 0) {
        milestoneData.hospitalId = null;
      }

      // Convert date strings to Date objects
      const dateFields = ['campaignStartDate', 'campaignEndDate', 'selectionStartDate', 'selectionEndDate', 'participationStartDate', 'participationEndDate'];
      dateFields.forEach(field => {
        if (milestoneData[field]) {
          milestoneData[field] = new Date(milestoneData[field]);
        }
      });

      const updatedMilestone = await db
        .update(milestones)
        .set({ ...milestoneData, updatedAt: new Date() })
        .where(eq(milestones.id, id))
        .returning();

      if (updatedMilestone.length === 0) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      res.json(updatedMilestone[0]);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  app.delete("/api/admin/milestones/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const deletedMilestone = await db
        .delete(milestones)
        .where(eq(milestones.id, id))
        .returning();

      if (deletedMilestone.length === 0) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      res.json({ message: "Milestone deleted successfully" });
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

  app.get("/api/milestone-categories", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categories = await db.query.milestoneCategories.findMany({
        orderBy: (milestoneCategories, { asc }) => [asc(milestoneCategories.order)]
      });

      res.json(categories);
    } catch (error) {
      console.error("Error fetching milestone categories:", error);
      res.status(500).json({ error: "Failed to fetch milestone categories" });
    }
  });

  app.get("/api/hospitals", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const hospitalsList = await db.query.hospitals.findMany({
        orderBy: (hospitals, { asc }) => [asc(hospitals.name)]
      });

      res.json(hospitalsList);
    } catch (error) {
      console.error("Error fetching hospitals:", error);
      res.status(500).json({ error: "Failed to fetch hospitals" });
    }
  });

  // Milestone header upload endpoint removed - using GCS endpoints from routes.ts instead

  // Concept Management Routes
  app.get("/api/admin/concepts", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      // 관계 설정 없이 직접 조회하여 오류 방지
      const conceptsList = await db.select().from(concepts).orderBy(asc(concepts.order));
      
      // 카테고리 정보가 필요한 경우 별도로 조회
      const conceptsWithCategories = await Promise.all(
        conceptsList.map(async (concept) => {
          let category = null;
          if (concept.categoryId) {
            const categoryResult = await db.query.conceptCategories.findFirst({
              where: eq(conceptCategories.categoryId, concept.categoryId)
            });
            category = categoryResult || null;
          }
          return {
            ...concept,
            category
          };
        })
      );
      
      res.json(conceptsWithCategories);
    } catch (error) {
      console.error("Error fetching concepts:", error);
      res.status(500).json({ error: "Failed to fetch concepts" });
    }
  });

  app.post("/api/admin/concepts", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const conceptData = insertConceptSchema.parse(req.body);
      const newConcept = await db.insert(concepts).values(conceptData).returning();
      res.status(201).json(newConcept[0]);
    } catch (error) {
      console.error("Error creating concept:", error);
      res.status(500).json({ error: "Failed to create concept" });
    }
  });

  app.put("/api/admin/concepts/:conceptId", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const conceptId = req.params.conceptId;
      
      // 날짜 필드 변환 처리
      const requestData = { ...req.body };
      
      // createdAt과 updatedAt이 문자열인 경우 Date 객체로 변환 또는 제거
      if (requestData.createdAt && typeof requestData.createdAt === 'string') {
        try {
          requestData.createdAt = new Date(requestData.createdAt);
        } catch {
          delete requestData.createdAt; // 변환 실패시 제거
        }
      }
      
      if (requestData.updatedAt && typeof requestData.updatedAt === 'string') {
        try {
          requestData.updatedAt = new Date(requestData.updatedAt);
        } catch {
          delete requestData.updatedAt; // 변환 실패시 제거
        }
      }

      const conceptData = insertConceptSchema.parse(requestData);

      const updatedConcept = await db
        .update(concepts)
        .set({ ...conceptData, updatedAt: new Date() })
        .where(eq(concepts.conceptId, conceptId))
        .returning();

      if (updatedConcept.length === 0) {
        return res.status(404).json({ error: "Concept not found" });
      }

      res.json(updatedConcept[0]);
    } catch (error) {
      console.error("Error updating concept:", error);
      res.status(500).json({ error: "Failed to update concept" });
    }
  });

  app.delete("/api/admin/concepts/:conceptId", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const conceptId = req.params.conceptId;

      const deletedConcept = await db
        .delete(concepts)
        .where(eq(concepts.conceptId, conceptId))
        .returning();

      if (deletedConcept.length === 0) {
        return res.status(404).json({ error: "Concept not found" });
      }

      res.json({ message: "Concept deleted successfully" });
    } catch (error) {
      console.error("Error deleting concept:", error);
      res.status(500).json({ error: "Failed to delete concept" });
    }
  });

  app.get("/api/admin/concept-categories", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categories = await db.query.conceptCategories.findMany({
        orderBy: (conceptCategories, { asc }) => [asc(conceptCategories.order)]
      });
      res.json(categories);
    } catch (error) {
      console.error("Error fetching concept categories:", error);
      res.status(500).json({ error: "Failed to fetch concept categories" });
    }
  });

  app.post("/api/admin/reorder-concepts", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { conceptOrders } = req.body;
      
      if (!Array.isArray(conceptOrders)) {
        return res.status(400).json({ error: "conceptOrders must be an array" });
      }

      // 트랜잭션으로 모든 순서 업데이트
      for (const { conceptId, order } of conceptOrders) {
        await db
          .update(concepts)
          .set({ order, updatedAt: new Date() })
          .where(eq(concepts.conceptId, conceptId));
      }

      res.json({ 
        success: true, 
        message: `${conceptOrders.length}개 컨셉의 순서가 변경되었습니다.` 
      });
    } catch (error) {
      console.error("Error reordering concepts:", error);
      res.status(500).json({ error: "Failed to reorder concepts" });
    }
  });

  // File upload endpoints removed - using GCS endpoints from routes.ts instead

  // Super Admin Features
  app.get("/api/super/hospitals", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const hospitalsList = await db.select().from(hospitals).orderBy(hospitals.createdAt);
      res.json(hospitalsList);
    } catch (error) {
      console.error("Error fetching super admin hospitals:", error);
      res.status(500).json({ error: "Failed to fetch hospitals" });
    }
  });

  // Hospital Codes Management
  app.get("/api/admin/hospital-codes", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      // hospital 정보를 포함하여 조회 (QR 기능 안전성 보장)
      const codes = await db.query.hospitalCodes.findMany({
        orderBy: (hospitalCodes, { desc }) => [desc(hospitalCodes.createdAt)],
        with: {
          hospital: true  // hospitalCodesRelations를 통해 병원 정보 포함
        }
      });

      // hospitalName을 최상위 레벨로 추출하여 프론트엔드 호환성 유지
      const codesWithHospitalName = codes.map(code => ({
        ...code,
        hospitalName: code.hospital?.name || null,
        // hospital 객체는 제거하여 응답 크기 최적화
        hospital: undefined
      }));

      res.json(codesWithHospitalName);
    } catch (error) {
      console.error("Error fetching hospital codes:", error);
      res.status(500).json({ error: "Failed to fetch hospital codes" });
    }
  });

  app.post("/api/admin/hospital-codes", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      console.log("🔵 [병원코드생성] 요청 데이터:", JSON.stringify(req.body, null, 2));
      
      // 0단계: 날짜 문자열을 Date 객체로 변환 (Zod 검증 전 전처리)
      const processedBody = {
        ...req.body,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null
      };
      console.log("🔄 [병원코드생성] 날짜 변환 완료:", processedBody.expiresAt);
      
      // 1단계: Zod 스키마 검증
      const validatedData = insertHospitalCodeSchema.parse(processedBody);
      console.log("✅ [병원코드생성] Zod 검증 통과:", validatedData);
      
      // 2단계: 빈 코드면 자동 생성하여 새 객체 생성
      let finalCode = validatedData.code;
      if (!validatedData.code || validatedData.code.trim() === '') {
        finalCode = generateHospitalCode();
        console.log("🔑 [병원코드생성] 자동 생성된 코드:", finalCode);
      }
      
      // 3단계: 중복 코드 체크
      const existingCode = await db.query.hospitalCodes.findFirst({
        where: eq(hospitalCodes.code, finalCode)
      });
      
      if (existingCode) {
        console.error("❌ [병원코드생성] 중복 코드:", finalCode);
        return res.status(409).json({ 
          error: "중복된 코드입니다", 
          details: `코드 '${finalCode}'는 이미 사용 중입니다.` 
        });
      }
      
      // 4단계: DB 삽입용 데이터 준비 (타입 안전성 보장)
      const insertData = {
        ...validatedData,
        code: finalCode,
        codeType: validatedData.codeType as "master" | "limited" | "qr_unlimited" | "qr_limited"
      };
      
      console.log("💾 [병원코드생성] DB 삽입 시도:", insertData);
      const newCode = await db.insert(hospitalCodes).values([insertData]).returning();
      console.log("✅ [병원코드생성] 성공:", newCode[0]);
      
      res.status(201).json(newCode[0]);
    } catch (error) {
      // Zod 검증 에러
      if (error instanceof z.ZodError) {
        console.error("❌ [병원코드생성] Zod 검증 실패:", error.errors);
        return res.status(400).json({ 
          error: "입력 데이터 검증 실패", 
          details: error.errors 
        });
      }
      
      // DB 에러
      console.error("❌ [병원코드생성] DB 에러:", error);
      console.error("에러 상세:", {
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      
      return res.status(500).json({ 
        error: "병원 코드 생성 중 오류가 발생했습니다",
        details: (error as Error).message
      });
    }
  });

  app.delete("/api/admin/hospital-codes/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deletedCode = await db
        .delete(hospitalCodes)
        .where(eq(hospitalCodes.id, id))
        .returning();

      if (deletedCode.length === 0) {
        return res.status(404).json({ error: "Hospital code not found" });
      }

      res.json({ message: "Hospital code deleted successfully" });
    } catch (error) {
      console.error("Error deleting hospital code:", error);
      res.status(500).json({ error: "Failed to delete hospital code" });
    }
  });

  app.patch("/api/admin/hospital-codes/:id/status", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = req.body;

      const updatedCode = await db
        .update(hospitalCodes)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(hospitalCodes.id, id))
        .returning();

      if (updatedCode.length === 0) {
        return res.status(404).json({ error: "Hospital code not found" });
      }

      res.json(updatedCode[0]);
    } catch (error) {
      console.error("Error updating hospital code status:", error);
      res.status(500).json({ error: "Failed to update hospital code status" });
    }
  });

  // Hospital Status Management (separate endpoint)
  app.patch("/api/admin/hospitals/:id/status", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = req.body;

      const updatedHospital = await db
        .update(hospitals)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(hospitals.id, id))
        .returning();

      if (updatedHospital.length === 0) {
        return res.status(404).json({ error: "Hospital not found" });
      }

      res.json(updatedHospital[0]);
    } catch (error) {
      console.error("Error updating hospital status:", error);
      res.status(500).json({ error: "Failed to update hospital status" });
    }
  });

  // System Settings Management
  app.get("/api/admin/system-settings", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const settings = await getSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ error: "Failed to fetch system settings" });
    }
  });

  app.put("/api/admin/system-settings", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const validatedSettings = systemSettingsUpdateSchema.parse(req.body);
      const updatedSettings = await updateSystemSettings(validatedSettings);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating system settings:", error);
      res.status(500).json({ error: "Failed to update system settings" });
    }
  });

  app.get("/api/admin/system-settings/health", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const health = await checkSystemSettingsHealth();
      res.json(health);
    } catch (error) {
      console.error("Error checking system settings health:", error);
      res.status(500).json({ error: "Failed to check system settings health" });
    }
  });

  app.post("/api/admin/system-settings/refresh-cache", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      await refreshSettingsCache();
      res.json({ message: "Settings cache refreshed successfully" });
    } catch (error) {
      console.error("Error refreshing settings cache:", error);
      res.status(500).json({ error: "Failed to refresh settings cache" });
    }
  });

  // Persona Management
  app.get("/api/admin/personas", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const personasList = await db.query.personas.findMany({
        orderBy: (personas, { asc }) => [asc(personas.order)]
      });
      res.json(personasList);
    } catch (error) {
      console.error("Error fetching personas:", error);
      res.status(500).json({ error: "Failed to fetch personas" });
    }
  });

  app.post("/api/admin/personas", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const personaData = req.body;
      const newPersona = await db.insert(personas).values(personaData).returning();
      res.status(201).json(newPersona[0]);
    } catch (error) {
      console.error("Error creating persona:", error);
      res.status(500).json({ error: "Failed to create persona" });
    }
  });

  app.put("/api/admin/personas/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const personaId = req.params.id;
      const personaData = req.body;

      const updatedPersona = await db
        .update(personas)
        .set({ ...personaData, updatedAt: new Date() })
        .where(eq(personas.personaId, personaId))
        .returning();

      if (updatedPersona.length === 0) {
        return res.status(404).json({ error: "Persona not found" });
      }

      res.json(updatedPersona[0]);
    } catch (error) {
      console.error("Error updating persona:", error);
      res.status(500).json({ error: "Failed to update persona" });
    }
  });

  app.delete("/api/admin/personas/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const personaId = req.params.id;

      const deletedPersona = await db
        .delete(personas)
        .where(eq(personas.personaId, personaId))
        .returning();

      if (deletedPersona.length === 0) {
        return res.status(404).json({ error: "Persona not found" });
      }

      res.json({ message: "Persona deleted successfully" });
    } catch (error) {
      console.error("Error deleting persona:", error);
      res.status(500).json({ error: "Failed to delete persona" });
    }
  });

  app.get("/api/admin/personas/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const personaId = req.params.id;

      const persona = await db.query.personas.findFirst({
        where: eq(personas.personaId, personaId)
      });

      if (!persona) {
        return res.status(404).json({ error: "Persona not found" });
      }

      res.json(persona);
    } catch (error) {
      console.error("Error fetching persona:", error);
      res.status(500).json({ error: "Failed to fetch persona" });
    }
  });

  app.post("/api/admin/personas/batch", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { personas: personasData } = req.body;
      
      if (!Array.isArray(personasData)) {
        return res.status(400).json({ error: "personas must be an array" });
      }

      const newPersonas = await db.insert(personas).values(personasData).returning();
      res.status(201).json(newPersonas);
    } catch (error) {
      console.error("Error creating personas batch:", error);
      res.status(500).json({ error: "Failed to create personas batch" });
    }
  });

  // Persona Categories Management
  app.get("/api/admin/categories", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categories = await db.query.personaCategories.findMany({
        orderBy: (personaCategories, { asc }) => [asc(personaCategories.order)]
      });
      res.json(categories);
    } catch (error) {
      console.error("Error fetching persona categories:", error);
      res.status(500).json({ error: "Failed to fetch persona categories" });
    }
  });

  app.post("/api/admin/categories", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categoryData = req.body;
      const newCategory = await db.insert(personaCategories).values(categoryData).returning();
      res.status(201).json(newCategory[0]);
    } catch (error) {
      console.error("Error creating persona category:", error);
      res.status(500).json({ error: "Failed to create persona category" });
    }
  });

  app.put("/api/admin/categories/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categoryId = req.params.id;
      const categoryData = req.body;

      const updatedCategory = await db
        .update(personaCategories)
        .set({ ...categoryData, updatedAt: new Date() })
        .where(eq(personaCategories.categoryId, categoryId))
        .returning();

      if (updatedCategory.length === 0) {
        return res.status(404).json({ error: "Persona category not found" });
      }

      res.json(updatedCategory[0]);
    } catch (error) {
      console.error("Error updating persona category:", error);
      res.status(500).json({ error: "Failed to update persona category" });
    }
  });

  app.delete("/api/admin/categories/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categoryId = req.params.id;

      const deletedCategory = await db
        .delete(personaCategories)
        .where(eq(personaCategories.categoryId, categoryId))
        .returning();

      if (deletedCategory.length === 0) {
        return res.status(404).json({ error: "Persona category not found" });
      }

      res.json({ message: "Persona category deleted successfully" });
    } catch (error) {
      console.error("Error deleting persona category:", error);
      res.status(500).json({ error: "Failed to delete persona category" });
    }
  });

  app.get("/api/admin/categories/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categoryId = req.params.id;

      const category = await db.query.personaCategories.findFirst({
        where: eq(personaCategories.categoryId, categoryId)
      });

      if (!category) {
        return res.status(404).json({ error: "Persona category not found" });
      }

      res.json(category);
    } catch (error) {
      console.error("Error fetching persona category:", error);
      res.status(500).json({ error: "Failed to fetch persona category" });
    }
  });

  // Concept Categories Management (additional routes)
  app.post("/api/admin/concept-categories", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categoryData = insertConceptCategorySchema.parse(req.body);
      const newCategory = await db.insert(conceptCategories).values(categoryData).returning();
      res.status(201).json(newCategory[0]);
    } catch (error) {
      console.error("Error creating concept category:", error);
      res.status(500).json({ error: "Failed to create concept category" });
    }
  });

  app.put("/api/admin/concept-categories/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categoryId = req.params.id;
      const categoryData = insertConceptCategorySchema.parse(req.body);

      const updatedCategory = await db
        .update(conceptCategories)
        .set({ ...categoryData, updatedAt: new Date() })
        .where(eq(conceptCategories.categoryId, categoryId))
        .returning();

      if (updatedCategory.length === 0) {
        return res.status(404).json({ error: "Concept category not found" });
      }

      res.json(updatedCategory[0]);
    } catch (error) {
      console.error("Error updating concept category:", error);
      res.status(500).json({ error: "Failed to update concept category" });
    }
  });

  app.delete("/api/admin/concept-categories/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categoryId = req.params.id;

      const deletedCategory = await db
        .delete(conceptCategories)
        .where(eq(conceptCategories.categoryId, categoryId))
        .returning();

      if (deletedCategory.length === 0) {
        return res.status(404).json({ error: "Concept category not found" });
      }

      res.json({ message: "Concept category deleted successfully" });
    } catch (error) {
      console.error("Error deleting concept category:", error);
      res.status(500).json({ error: "Failed to delete concept category" });
    }
  });

  app.get("/api/admin/concept-categories/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const categoryId = req.params.id;

      const category = await db.query.conceptCategories.findFirst({
        where: eq(conceptCategories.categoryId, categoryId)
      });

      if (!category) {
        return res.status(404).json({ error: "Concept category not found" });
      }

      res.json(category);
    } catch (error) {
      console.error("Error fetching concept category:", error);
      res.status(500).json({ error: "Failed to fetch concept category" });
    }
  });

  // Additional Concept Routes
  app.get("/api/admin/concepts/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const conceptId = req.params.id;

      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, conceptId)
      });

      if (!concept) {
        return res.status(404).json({ error: "Concept not found" });
      }

      res.json(concept);
    } catch (error) {
      console.error("Error fetching concept:", error);
      res.status(500).json({ error: "Failed to fetch concept" });
    }
  });

  app.post("/api/admin/concepts/reorder", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { conceptOrders } = req.body;
      
      if (!Array.isArray(conceptOrders)) {
        return res.status(400).json({ error: "conceptOrders must be an array" });
      }

      for (const { conceptId, order } of conceptOrders) {
        await db
          .update(concepts)
          .set({ order, updatedAt: new Date() })
          .where(eq(concepts.conceptId, conceptId));
      }

      res.json({ 
        success: true, 
        message: `${conceptOrders.length}개 컨셉의 순서가 변경되었습니다.` 
      });
    } catch (error) {
      console.error("Error reordering concepts:", error);
      res.status(500).json({ error: "Failed to reorder concepts" });
    }
  });

  app.get("/api/admin/concepts/:conceptId/variables", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { conceptId } = req.params;

      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, conceptId)
      });

      if (!concept) {
        return res.status(404).json({ error: "Concept not found" });
      }

      res.json({ variables: concept.variables || [] });
    } catch (error) {
      console.error("Error fetching concept variables:", error);
      res.status(500).json({ error: "Failed to fetch concept variables" });
    }
  });

  // Translations Management
  app.post("/api/admin/translations/:lang", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { lang } = req.params;
      const translationData = req.body;

      // This would typically interact with a translations table or file system
      // For now, return a success response
      res.json({ 
        success: true, 
        message: `Translations for ${lang} updated successfully`,
        data: translationData 
      });
    } catch (error) {
      console.error("Error updating translations:", error);
      res.status(500).json({ error: "Failed to update translations" });
    }
  });

  // File Upload Routes
  app.post("/api/admin/upload/banner", requireAdminOrSuperAdmin, bannerUpload.single('banner'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = await saveBannerToGCS(req.file.buffer, 'slide', req.file.originalname);

      res.json({
        success: true,
        url: fileUrl.publicUrl,  // ✅ publicUrl 반환
        imageSrc: fileUrl.publicUrl,  // 클라이언트가 기대하는 필드
        filename: req.file.originalname
      });
    } catch (error) {
      console.error("Error uploading banner:", error);
      res.status(500).json({ 
        error: "Failed to upload banner",
        message: getErrorMessage(error)
      });
    }
  });

  app.post("/api/admin/upload/thumbnail", requireAdminOrSuperAdmin, imageUpload.single('thumbnail'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = await saveImageToGCS(req.file.buffer, req.file.originalname, 'thumbnails');

      res.json({
        success: true,
        url: fileUrl,
        filename: req.file.originalname
      });
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      res.status(500).json({
        error: "Failed to upload thumbnail",
        message: getErrorMessage(error)
      });
    }
  });

  app.post("/api/admin/upload-thumbnail", requireAdminOrSuperAdmin, imageUpload.single('thumbnail'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = await saveImageToGCS(req.file.buffer, req.file.originalname, 'thumbnails');

      res.json({
        success: true,
        url: fileUrl,
        filename: req.file.originalname
      });
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      res.status(500).json({
        error: "Failed to upload thumbnail",
        message: getErrorMessage(error)
      });
    }
  });

  // A/B Testing Routes
  app.get("/api/admin/abtests", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const allTests = await db.query.abTests.findMany({
        orderBy: [asc(abTests.name)],
      });

      res.json(allTests);
    } catch (error) {
      console.error("Error fetching A/B tests:", error);
      res.status(500).json({ error: "Failed to fetch A/B tests" });
    }
  });

  app.get("/api/admin/abtests/:id", requireAdminOrSuperAdmin, async (req, res) => {
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

      res.json({
        ...test,
        variants
      });
    } catch (error) {
      console.error("Error fetching A/B test:", error);
      res.status(500).json({ error: "Failed to fetch A/B test" });
    }
  });

  app.post("/api/admin/abtests", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const abTestSchema = z.object({
        testId: z.string().min(1, "Test ID is required"),
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
        conceptId: z.string().min(1, "Concept ID is required"),
        isActive: z.boolean().default(true),
        startDate: z.date().optional(),
        variants: z.array(z.object({
          variantId: z.string().min(1, "Variant ID is required"),
          name: z.string().min(1, "Name is required"),
          promptTemplate: z.string().min(1, "Prompt template is required"),
          variables: z.array(z.any()).optional(),
        })).min(2, "At least two variants are required")
      });

      const validatedData = abTestSchema.parse(req.body);

      const concept = await db.query.concepts.findFirst({
        where: eq(concepts.conceptId, validatedData.conceptId)
      });

      if (!concept) {
        return res.status(404).json({ error: "Concept not found" });
      }

      const [newTest] = await db.insert(abTests).values({
        testId: validatedData.testId,
        name: validatedData.name,
        description: validatedData.description || null,
        conceptId: validatedData.conceptId,
        isActive: validatedData.isActive,
        startDate: validatedData.startDate || new Date(),
      }).returning();

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

      res.status(201).json({
        ...newTest,
        variants
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating A/B test:", error);
      res.status(500).json({ error: "Failed to create A/B test" });
    }
  });

  // Milestone Categories Management (additional routes)
  app.get("/api/admin/milestone-categories", requireAuth, async (req, res) => {
    try {
      const categories = await db.query.milestoneCategories.findMany({
        orderBy: (milestoneCategories, { asc }) => [asc(milestoneCategories.order)]
      });
      res.json(categories);
    } catch (error) {
      console.error("Error fetching milestone categories:", error);
      res.status(500).json({
        error: "카테고리 목록을 가져오는데 실패했습니다",
        message: getErrorMessage(error)
      });
    }
  });

  app.post("/api/admin/milestone-categories", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const newCategory = await db.insert(milestoneCategories).values(req.body).returning();
      res.status(201).json(newCategory[0]);
    } catch (error) {
      console.error("Error creating milestone category:", error);
      res.status(500).json({
        error: "카테고리 생성에 실패했습니다",
        message: getErrorMessage(error)
      });
    }
  });

  app.put("/api/admin/milestone-categories/:categoryId", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { categoryId } = req.params;

      const existingCategory = await db.query.milestoneCategories.findFirst({
        where: eq(milestoneCategories.categoryId, categoryId)
      });

      if (!existingCategory) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }

      const updatedCategory = await db
        .update(milestoneCategories)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(milestoneCategories.categoryId, categoryId))
        .returning();

      res.json(updatedCategory[0]);
    } catch (error) {
      console.error("Error updating milestone category:", error);
      res.status(500).json({
        error: "카테고리 업데이트에 실패했습니다",
        message: getErrorMessage(error)
      });
    }
  });

  app.delete("/api/admin/milestone-categories/:categoryId", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { categoryId } = req.params;

      const existingCategory = await db.query.milestoneCategories.findFirst({
        where: eq(milestoneCategories.categoryId, categoryId)
      });

      if (!existingCategory) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }

      const deletedCategory = await db
        .delete(milestoneCategories)
        .where(eq(milestoneCategories.categoryId, categoryId))
        .returning();

      res.json(deletedCategory[0]);
    } catch (error) {
      console.error("Error deleting milestone category:", error);
      res.status(500).json({
        error: "카테고리 삭제에 실패했습니다",
        message: getErrorMessage(error)
      });
    }
  });

  // Admin Milestones List
  app.get("/api/admin/milestones", requireAuth, async (req, res) => {
    try {
      const allMilestones = await db.query.milestones.findMany({
        with: {
          category: true,
          hospital: true
        },
        orderBy: (milestones, { asc }) => [asc(milestones.order)]
      });
      res.json(allMilestones);
    } catch (error) {
      console.error("Error fetching admin milestones:", error);
      res.status(500).json({
        error: "마일스톤 목록을 가져오는데 실패했습니다",
        message: getErrorMessage(error)
      });
    }
  });

  // Admin Banners List
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

  // Music Styles Management
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

  app.post("/api/admin/music-styles", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const processedData = {
        styleId: req.body.styleId?.toString() || '',
        name: req.body.name?.toString() || '',
        description: req.body.description?.toString() || '',
        prompt: req.body.prompt?.toString() || '',
        tags: Array.isArray(req.body.tags) ? req.body.tags : [],
        isActive: req.body.isActive === true || req.body.isActive === 'true',
        order: parseInt(req.body.order) || 0
      };

      if (!processedData.styleId || !processedData.name || !processedData.description || !processedData.prompt) {
        return res.status(400).json({
          success: false,
          error: "필수 필드가 누락되었습니다."
        });
      }

      const validatedData = insertMusicStyleSchema.parse(processedData);

      const existingStyle = await db.select()
        .from(musicStyles)
        .where(eq(musicStyles.styleId, validatedData.styleId))
        .limit(1);

      if (existingStyle.length > 0) {
        return res.status(400).json({
          success: false,
          error: "이미 존재하는 스타일 ID입니다."
        });
      }

      const insertData = {
        styleId: validatedData.styleId,
        name: validatedData.name,
        description: validatedData.description,
        prompt: validatedData.prompt,
        tags: Array.isArray(validatedData.tags) && validatedData.tags.length === 0 ? null : validatedData.tags,
        isActive: validatedData.isActive,
        order: validatedData.order,
        creatorId: (req as any).user?.id || null
      };

      const result = await db.insert(musicStyles)
        .values(insertData)
        .returning();

      res.status(201).json(result[0]);
    } catch (error: any) {
      if (error.name === 'ZodError') {
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

  app.put("/api/admin/music-styles/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const styleId = parseInt(req.params.id);

      const existingStyle = await db.select()
        .from(musicStyles)
        .where(eq(musicStyles.id, styleId))
        .limit(1);

      if (existingStyle.length === 0) {
        return res.status(404).json({
          success: false,
          error: "음악 스타일을 찾을 수 없습니다."
        });
      }

      if (req.body.styleId && req.body.styleId !== existingStyle[0].styleId) {
        return res.status(400).json({
          success: false,
          error: "스타일 ID는 생성 후 수정할 수 없습니다. 데이터 무결성을 위해 스타일 ID는 변경 불가능합니다."
        });
      }

      const updateData = {
        name: req.body.name || existingStyle[0].name,
        description: req.body.description || existingStyle[0].description,
        prompt: req.body.prompt || existingStyle[0].prompt,
        tags: Array.isArray(req.body.tags) && req.body.tags.length === 0 ? null : req.body.tags || existingStyle[0].tags,
        isActive: req.body.isActive !== undefined ? req.body.isActive : existingStyle[0].isActive,
        order: req.body.order !== undefined ? req.body.order : existingStyle[0].order
      };

      const result = await db.update(musicStyles)
        .set(updateData)
        .where(eq(musicStyles.id, styleId))
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error("음악 스타일 업데이트 오류:", error);
      res.status(500).json({
        success: false,
        error: "음악 스타일 업데이트에 실패했습니다.",
        details: getErrorMessage(error)
      });
    }
  });

  app.delete("/api/admin/music-styles/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const styleId = parseInt(req.params.id);

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

  // Music Gallery Management
  app.get("/api/admin/music", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const offset = (page - 1) * pageSize;

      const totalCount = await db.$count(music);

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

  app.delete("/api/admin/music/:id", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const musicId = parseInt(req.params.id);

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

  // GCS Image Management
  app.post("/api/admin/fix-gcs-images", requireAuth, async (req, res) => {
    try {
      console.log('🌐 GCS 이미지 공개 설정 시작...');
      
      await setAllImagesPublic();
      
      console.log('✅ GCS 이미지 공개 설정 완료');
      
      res.json({
        success: true,
        message: "공개 콘텐츠 이미지가 성공적으로 공개 설정되었습니다.",
        note: "공개 콘텐츠용으로만 사용하세요. 개인정보가 포함된 이미지는 피하세요.",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ GCS 이미지 공개 설정 실패:', error);
      res.status(500).json({
        success: false,
        error: "이미진 공개 설정 실패",
        details: getErrorMessage(error)
      });
    }
  });

  // ==================== Milestone Applications Management API
  // ====================

  // 관리자 - 신청 목록 조회 (상태별 필터링 지원)
  app.get('/api/admin/milestone-applications', requireAuth, async (req: Request, res: Response) => {
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
  app.get('/api/admin/milestone-applications/:id', requireAuth, async (req: Request, res: Response) => {
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
  app.patch('/api/admin/milestone-applications/:id/status', requireAuth, async (req: Request, res: Response) => {
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
  app.get('/api/admin/milestone-applications/stats', requireAuth, async (req: Request, res: Response) => {
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
  app.post('/api/admin/milestones/upload-header', requireAuth, milestoneUpload.single('headerImage'), (req: Request, res: Response) => {
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

  // 관리자 - 전체 이미지 갤러리 조회 (모든 사용자)
  app.get('/api/admin/images', requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      console.log(`📋 [관리자] 전체 이미지 갤러리 조회 - 페이지: ${page}, 개수: ${limit}`);

      // 전체 이미지 개수 조회
      const totalCountResult = await db.select({ count: count() })
        .from(images);
      const totalImages = totalCountResult[0]?.count || 0;
      const totalPages = Math.ceil(totalImages / limit);

      // 이미지 목록 조회 (JOIN 없이)
      const imageList = await db.select({
        id: images.id,
        title: images.title,
        transformedUrl: images.transformedUrl,
        thumbnailUrl: images.thumbnailUrl,
        createdAt: images.createdAt,
        userId: images.userId,
        categoryId: images.categoryId,
        conceptId: images.conceptId
      })
      .from(images)
      .orderBy(desc(images.createdAt))
      .limit(limit)
      .offset(offset);

      // 사용자 정보 별도 조회 (userId가 숫자인 경우만)
      const userIds = imageList
        .map(img => img.userId)
        .filter(id => id && !isNaN(Number(id)))
        .map(id => Number(id));

      const uniqueUserIds = [...new Set(userIds)];
      
      const userMap: Record<number, string> = {};
      if (uniqueUserIds.length > 0) {
        const usersList = await db.select({
          id: users.id,
          username: users.username
        })
        .from(users)
        .where(inArray(users.id, uniqueUserIds));
        
        usersList.forEach(user => {
          userMap[user.id] = user.username || '';
        });
      }

      // 썸네일 우선, 없으면 원본 URL 반환 + 사용자명 추가
      // resolveImageUrl로 만료된 Signed URL을 공개 URL로 자동 변환 (모든 URL 필드 처리)
      const imagesWithUrl = imageList.map(img => {
        // 모든 URL 필드에 resolveImageUrl 적용
        const resolvedThumbnailUrl = img.thumbnailUrl ? resolveImageUrl(img.thumbnailUrl) : img.thumbnailUrl;
        const resolvedTransformedUrl = img.transformedUrl ? resolveImageUrl(img.transformedUrl) : img.transformedUrl;
        const resolvedOriginalUrl = img.originalUrl ? resolveImageUrl(img.originalUrl) : img.originalUrl;
        
        // url 필드는 썸네일 우선, 없으면 transformedUrl
        const displayUrl = resolvedThumbnailUrl || resolvedTransformedUrl || resolvedOriginalUrl;
        
        return {
          ...img,
          url: displayUrl,
          thumbnailUrl: resolvedThumbnailUrl,
          transformedUrl: resolvedTransformedUrl,
          originalUrl: resolvedOriginalUrl,
          username: img.userId && !isNaN(Number(img.userId)) ? userMap[Number(img.userId)] || null : null
        };
      });

      console.log(`✅ [관리자] ${imagesWithUrl.length}개 이미지 조회 완료 (전체 ${totalImages}개)`);

      res.json({
        images: imagesWithUrl,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalImages,
          itemsPerPage: limit
        }
      });

    } catch (error) {
      console.error("❌ [관리자] 이미지 갤러리 조회 오류:", error);
      res.status(500).json({ error: "이미지 목록을 불러오는 데 실패했습니다." });
    }
  });
}