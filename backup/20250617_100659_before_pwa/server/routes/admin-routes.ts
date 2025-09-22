import type { Express } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
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

  serviceCategories,
  users,

  insertConceptSchema,
  insertConceptCategorySchema,
  insertBannerSchema,
  insertServiceCategorySchema,
  insertServiceItemSchema,
} from "../../shared/schema";
import { db } from "../../db/index";
import { eq, desc, and, asc, sql } from "drizzle-orm";
import { HOSPITAL_CONSTANTS, hospitalUtils, MEMBER_TYPE_OPTIONS, USER_CONSTANTS, userUtils } from "../../shared/constants";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

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
  app.get("/api/admin/users", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const usersList = await db.query.users.findMany({
        orderBy: [desc(users.createdAt)]
      });
      
      res.status(200).json({ users: usersList });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
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
      const { memberType, username, email, hospitalId } = req.body;
      
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
      const total = totalResult[0]?.count || 0;

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
      
      const updatedHospital = await db
        .update(hospitals)
        .set(processedData)
        .where(eq(hospitals.id, id))
        .returning();
        
      if (updatedHospital.length === 0) {
        console.log(`[관리자 API] 병원 수정 실패 - ID ${id} 찾을 수 없음`);
        return res.status(404).json({ error: "Hospital not found" });
      }
      
      console.log(`[관리자 API] 병원 수정 성공 - ID: ${id}`, updatedHospital[0]);
      res.json({ hospital: updatedHospital[0] });
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

  // File Upload Routes
  app.post("/api/admin/upload-thumbnail", requireAdminOrSuperAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ 
        success: true, 
        url: fileUrl,
        filename: req.file.filename 
      });
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      res.status(500).json({ error: "Failed to upload thumbnail" });
    }
  });

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