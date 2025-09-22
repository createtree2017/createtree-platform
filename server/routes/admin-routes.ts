import type { Express } from "express";
import { z } from "zod";
import { requireAdminOrSuperAdmin } from "../middleware/admin-auth";
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
  milestones,
  milestoneCategories,
  serviceCategories,
  users,

  insertConceptSchema,
  insertConceptCategorySchema,
  insertBannerSchema,
  insertServiceCategorySchema,
  insertServiceItemSchema,
} from "../../shared/schema";
import { db } from "@db";
import { eq, desc, and, asc, sql } from "drizzle-orm";
import { HOSPITAL_CONSTANTS, hospitalUtils, MEMBER_TYPE_OPTIONS, USER_CONSTANTS, userUtils } from "../../shared/constants";


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
          ? user.birthdate instanceof Date 
            ? user.birthdate.toISOString().split('T')[0]
            : (() => {
                try {
                  const dateObj = new Date(user.birthdate);
                  return isNaN(dateObj.getTime()) ? null : dateObj.toISOString().split('T')[0];
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
          error: USER_CONSTANTS.MESSAGES.ERRORS.SUPERADMIN_REQUIRED 
        });
      }

      const userId = parseInt(req.params.id);

      const userToDelete = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!userToDelete) {
        return res.status(404).json({ 
          error: USER_CONSTANTS.MESSAGES.ERRORS.USER_NOT_FOUND 
        });
      }

      // 슈퍼관리자는 삭제할 수 없음
      if (userToDelete.memberType === USER_CONSTANTS.MEMBER_TYPES.SUPERADMIN) {
        return res.status(403).json({ 
          error: USER_CONSTANTS.MESSAGES.ERRORS.CANNOT_DELETE_SUPERADMIN 
        });
      }

      await db.delete(users).where(eq(users.id, userId));

      res.json({ 
        message: USER_CONSTANTS.MESSAGES.SUCCESS.USER_DELETED 
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
          error: USER_CONSTANTS.MESSAGES.ERRORS.INVALID_MEMBER_TYPE 
        });
      }

      // 수정할 사용자 정보 조회
      const userToUpdate = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!userToUpdate) {
        return res.status(404).json({ 
          error: USER_CONSTANTS.MESSAGES.ERRORS.USER_NOT_FOUND 
        });
      }

      // 슈퍼관리자끼리는 서로 수정 불가 (본인 제외)
      if (userToUpdate.memberType === USER_CONSTANTS.MEMBER_TYPES.SUPERADMIN && 
          currentUser.id !== userId) {
        return res.status(403).json({ 
          error: USER_CONSTANTS.MESSAGES.ERRORS.CANNOT_MODIFY_SUPERADMIN 
        });
      }

      // 일반 관리자는 슈퍼관리자로 승격시킬 수 없음
      if (memberType === USER_CONSTANTS.MEMBER_TYPES.SUPERADMIN && 
          currentUser.memberType !== USER_CONSTANTS.MEMBER_TYPES.SUPERADMIN) {
        return res.status(403).json({ 
          error: USER_CONSTANTS.MESSAGES.ERRORS.SUPERADMIN_REQUIRED 
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
          error: USER_CONSTANTS.MESSAGES.ERRORS.USER_NOT_FOUND 
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
      res.status(500).json({ error: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.FETCH_FAILED });
    }
  });

  app.post("/api/admin/hospitals", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { name, address, phone, email, packageType, themeColor, contractStartDate, contractEndDate } = req.body;

      // 필수 필드 유효성 검사
      if (!hospitalUtils.validateHospitalName(name)) {
        return res.status(400).json({ error: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_NAME });
      }

      if (!address?.trim()) {
        return res.status(400).json({ error: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_ADDRESS });
      }

      if (!phone?.trim() || !hospitalUtils.validatePhoneNumber(phone)) {
        return res.status(400).json({ error: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_PHONE });
      }

      // 중복 병원명 검사
      const existingHospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.name, name.trim())
      });

      if (existingHospital) {
        return res.status(409).json({ error: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.DUPLICATE_NAME });
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
        message: HOSPITAL_CONSTANTS.MESSAGES.SUCCESS.CREATED
      });
    } catch (error) {
      console.error("병원 생성 오류:", error);
      res.status(500).json({ error: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.CREATE_FAILED });
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
}