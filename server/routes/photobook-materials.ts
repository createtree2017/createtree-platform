import { Router, type Request, type Response } from "express";
import { z } from "zod";
import multer from "multer";
import { db } from "../../db/index";
import {
  photobookMaterialCategories,
  photobookBackgrounds,
  photobookIcons,
  photobookMaterialCategoriesInsertSchema,
  photobookBackgroundsInsertSchema,
  photobookIconsInsertSchema,
} from "../../shared/schema";
import { eq, and, desc, or, isNull, like, ilike, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireAdminOrSuperAdmin } from "../middleware/auth";
import { uploadBufferToGCS } from "../utils/gcs";

const materialImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error("허용되지 않는 파일 형식입니다. JPEG, PNG, GIF, WebP만 가능합니다."));
      return;
    }
    cb(null, true);
  },
});

const categoryCreateSchema = z.object({
  name: z.string().min(1, "카테고리 이름을 입력해주세요"),
  type: z.enum(["background", "icon"]),
  icon: z.string().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const categoryUpdateSchema = categoryCreateSchema.partial();

const materialCreateSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  imageUrl: z.string().min(1, "이미지 URL을 입력해주세요"),
  thumbnailUrl: z.string().optional(),
  category: z.string().default("general"),
  categoryId: z.number().int().positive().optional().nullable(),
  keywords: z.string().optional().nullable(),
  isPublic: z.boolean().default(true),
  hospitalId: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const materialUpdateSchema = materialCreateSchema.partial();

export const photobookMaterialsAdminRouter = Router();
export const photobookMaterialsUserRouter = Router();

photobookMaterialsAdminRouter.get("/categories", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    let query = db.query.photobookMaterialCategories.findMany({
      orderBy: [asc(photobookMaterialCategories.sortOrder), asc(photobookMaterialCategories.name)],
    });

    let categories = await query;

    if (type && (type === "background" || type === "icon")) {
      categories = categories.filter((c) => c.type === type);
    }

    return res.json({ success: true, data: categories });
  } catch (error) {
    console.error("[PhotobookMaterials] 카테고리 조회 오류:", error);
    return res.status(500).json({ success: false, error: "카테고리 조회에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.post("/categories", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = categoryCreateSchema.parse(req.body);

    const [category] = await db.insert(photobookMaterialCategories).values({
      name: parsed.name,
      type: parsed.type,
      icon: parsed.icon,
      sortOrder: parsed.sortOrder,
      isActive: parsed.isActive,
    }).returning();

    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[PhotobookMaterials] 카테고리 생성 오류:", error);
    return res.status(500).json({ success: false, error: "카테고리 생성에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.put("/categories/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 카테고리 ID입니다" });
    }

    const parsed = categoryUpdateSchema.parse(req.body);

    const [updated] = await db.update(photobookMaterialCategories)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(photobookMaterialCategories.id, categoryId))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: "카테고리를 찾을 수 없습니다" });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[PhotobookMaterials] 카테고리 수정 오류:", error);
    return res.status(500).json({ success: false, error: "카테고리 수정에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.delete("/categories/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 카테고리 ID입니다" });
    }

    const [deleted] = await db.delete(photobookMaterialCategories)
      .where(eq(photobookMaterialCategories.id, categoryId))
      .returning();

    if (!deleted) {
      return res.status(404).json({ success: false, error: "카테고리를 찾을 수 없습니다" });
    }

    return res.json({ success: true, message: "카테고리가 삭제되었습니다" });
  } catch (error) {
    console.error("[PhotobookMaterials] 카테고리 삭제 오류:", error);
    return res.status(500).json({ success: false, error: "카테고리 삭제에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.get("/backgrounds", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { categoryId, search, page = "1", limit = "50" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let backgrounds = await db.query.photobookBackgrounds.findMany({
      orderBy: [asc(photobookBackgrounds.sortOrder), desc(photobookBackgrounds.createdAt)],
      with: { materialCategory: true },
    });

    if (categoryId && categoryId !== "all") {
      const catId = parseInt(categoryId as string);
      if (!isNaN(catId)) {
        backgrounds = backgrounds.filter((b) => b.categoryId === catId);
      }
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      backgrounds = backgrounds.filter((b) =>
        b.name.toLowerCase().includes(searchLower) ||
        (b.keywords && b.keywords.toLowerCase().includes(searchLower)) ||
        (b.category && b.category.toLowerCase().includes(searchLower))
      );
    }

    const total = backgrounds.length;
    const paginatedBackgrounds = backgrounds.slice(offset, offset + limitNum);

    return res.json({
      success: true,
      data: paginatedBackgrounds,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("[PhotobookMaterials] 배경 조회 오류:", error);
    return res.status(500).json({ success: false, error: "배경 조회에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.post("/backgrounds", requireAdminOrSuperAdmin, materialImageUpload.single("image"), async (req: Request, res: Response) => {
  try {
    let imageUrl = req.body.imageUrl;
    let thumbnailUrl = req.body.thumbnailUrl;

    if (req.file) {
      const timestamp = Date.now();
      const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const targetPath = `photobook/materials/backgrounds/${timestamp}_${safeFilename}`;
      imageUrl = await uploadBufferToGCS(req.file.buffer, targetPath, req.file.mimetype);
    }

    if (!imageUrl) {
      return res.status(400).json({ success: false, error: "이미지 URL 또는 파일이 필요합니다" });
    }

    const [background] = await db.insert(photobookBackgrounds).values({
      name: req.body.name || "새 배경",
      imageUrl,
      thumbnailUrl: thumbnailUrl || imageUrl,
      category: req.body.category || "general",
      categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : null,
      keywords: req.body.keywords || null,
      isPublic: req.body.isPublic !== "false",
      hospitalId: req.body.hospitalId ? parseInt(req.body.hospitalId) : null,
      sortOrder: req.body.sortOrder ? parseInt(req.body.sortOrder) : 0,
      isActive: req.body.isActive !== "false",
    }).returning();

    return res.status(201).json({ success: true, data: background });
  } catch (error) {
    console.error("[PhotobookMaterials] 배경 생성 오류:", error);
    return res.status(500).json({ success: false, error: "배경 생성에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.put("/backgrounds/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const backgroundId = parseInt(req.params.id);
    if (isNaN(backgroundId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 배경 ID입니다" });
    }

    const parsed = materialUpdateSchema.parse(req.body);

    const updateData: any = { ...parsed, updatedAt: new Date() };
    if (parsed.categoryId !== undefined) {
      updateData.categoryId = parsed.categoryId;
    }

    const [updated] = await db.update(photobookBackgrounds)
      .set(updateData)
      .where(eq(photobookBackgrounds.id, backgroundId))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: "배경을 찾을 수 없습니다" });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[PhotobookMaterials] 배경 수정 오류:", error);
    return res.status(500).json({ success: false, error: "배경 수정에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.delete("/backgrounds/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const backgroundId = parseInt(req.params.id);
    if (isNaN(backgroundId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 배경 ID입니다" });
    }

    const [deleted] = await db.delete(photobookBackgrounds)
      .where(eq(photobookBackgrounds.id, backgroundId))
      .returning();

    if (!deleted) {
      return res.status(404).json({ success: false, error: "배경을 찾을 수 없습니다" });
    }

    return res.json({ success: true, message: "배경이 삭제되었습니다" });
  } catch (error) {
    console.error("[PhotobookMaterials] 배경 삭제 오류:", error);
    return res.status(500).json({ success: false, error: "배경 삭제에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.get("/icons", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { categoryId, search, page = "1", limit = "50" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let icons = await db.query.photobookIcons.findMany({
      orderBy: [asc(photobookIcons.sortOrder), desc(photobookIcons.createdAt)],
      with: { materialCategory: true },
    });

    if (categoryId && categoryId !== "all") {
      const catId = parseInt(categoryId as string);
      if (!isNaN(catId)) {
        icons = icons.filter((i) => i.categoryId === catId);
      }
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      icons = icons.filter((i) =>
        i.name.toLowerCase().includes(searchLower) ||
        (i.keywords && i.keywords.toLowerCase().includes(searchLower)) ||
        (i.category && i.category.toLowerCase().includes(searchLower))
      );
    }

    const total = icons.length;
    const paginatedIcons = icons.slice(offset, offset + limitNum);

    return res.json({
      success: true,
      data: paginatedIcons,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("[PhotobookMaterials] 아이콘 조회 오류:", error);
    return res.status(500).json({ success: false, error: "아이콘 조회에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.post("/icons", requireAdminOrSuperAdmin, materialImageUpload.single("image"), async (req: Request, res: Response) => {
  try {
    let imageUrl = req.body.imageUrl;
    let thumbnailUrl = req.body.thumbnailUrl;

    if (req.file) {
      const timestamp = Date.now();
      const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const targetPath = `photobook/materials/icons/${timestamp}_${safeFilename}`;
      imageUrl = await uploadBufferToGCS(req.file.buffer, targetPath, req.file.mimetype);
    }

    if (!imageUrl) {
      return res.status(400).json({ success: false, error: "이미지 URL 또는 파일이 필요합니다" });
    }

    const [icon] = await db.insert(photobookIcons).values({
      name: req.body.name || "새 아이콘",
      imageUrl,
      thumbnailUrl: thumbnailUrl || imageUrl,
      category: req.body.category || "general",
      categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : null,
      keywords: req.body.keywords || null,
      isPublic: req.body.isPublic !== "false",
      hospitalId: req.body.hospitalId ? parseInt(req.body.hospitalId) : null,
      sortOrder: req.body.sortOrder ? parseInt(req.body.sortOrder) : 0,
      isActive: req.body.isActive !== "false",
    }).returning();

    return res.status(201).json({ success: true, data: icon });
  } catch (error) {
    console.error("[PhotobookMaterials] 아이콘 생성 오류:", error);
    return res.status(500).json({ success: false, error: "아이콘 생성에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.put("/icons/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const iconId = parseInt(req.params.id);
    if (isNaN(iconId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 아이콘 ID입니다" });
    }

    const parsed = materialUpdateSchema.parse(req.body);

    const updateData: any = { ...parsed, updatedAt: new Date() };
    if (parsed.categoryId !== undefined) {
      updateData.categoryId = parsed.categoryId;
    }

    const [updated] = await db.update(photobookIcons)
      .set(updateData)
      .where(eq(photobookIcons.id, iconId))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: "아이콘을 찾을 수 없습니다" });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[PhotobookMaterials] 아이콘 수정 오류:", error);
    return res.status(500).json({ success: false, error: "아이콘 수정에 실패했습니다" });
  }
});

photobookMaterialsAdminRouter.delete("/icons/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const iconId = parseInt(req.params.id);
    if (isNaN(iconId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 아이콘 ID입니다" });
    }

    const [deleted] = await db.delete(photobookIcons)
      .where(eq(photobookIcons.id, iconId))
      .returning();

    if (!deleted) {
      return res.status(404).json({ success: false, error: "아이콘을 찾을 수 없습니다" });
    }

    return res.json({ success: true, message: "아이콘이 삭제되었습니다" });
  } catch (error) {
    console.error("[PhotobookMaterials] 아이콘 삭제 오류:", error);
    return res.status(500).json({ success: false, error: "아이콘 삭제에 실패했습니다" });
  }
});

photobookMaterialsUserRouter.get("/categories", requireAuth, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    let categories = await db.query.photobookMaterialCategories.findMany({
      where: eq(photobookMaterialCategories.isActive, true),
      orderBy: [asc(photobookMaterialCategories.sortOrder), asc(photobookMaterialCategories.name)],
    });

    if (type && (type === "background" || type === "icon")) {
      categories = categories.filter((c) => c.type === type);
    }

    return res.json({ success: true, data: categories });
  } catch (error) {
    console.error("[PhotobookMaterials] 카테고리 조회 오류:", error);
    return res.status(500).json({ success: false, error: "카테고리 조회에 실패했습니다" });
  }
});

photobookMaterialsUserRouter.get("/backgrounds", requireAuth, async (req: Request, res: Response) => {
  try {
    const categoryIdParam = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const search = req.query.search as string | undefined;
    const user = req.user!;

    const conditions: any[] = [eq(photobookBackgrounds.isActive, true)];

    conditions.push(
      or(
        eq(photobookBackgrounds.isPublic, true),
        user.hospitalId ? eq(photobookBackgrounds.hospitalId, user.hospitalId) : undefined
      )
    );

    if (categoryIdParam && !isNaN(categoryIdParam)) {
      conditions.push(eq(photobookBackgrounds.categoryId, categoryIdParam));
    }

    if (search) {
      conditions.push(
        or(
          ilike(photobookBackgrounds.name, `%${search}%`),
          ilike(photobookBackgrounds.keywords, `%${search}%`)
        )
      );
    }

    const backgrounds = await db.select().from(photobookBackgrounds)
      .where(and(...conditions))
      .orderBy(asc(photobookBackgrounds.sortOrder), desc(photobookBackgrounds.createdAt));

    return res.json({ success: true, data: backgrounds });
  } catch (error) {
    console.error("[PhotobookMaterials] 배경 조회 오류:", error);
    return res.status(500).json({ success: false, error: "배경 조회에 실패했습니다" });
  }
});

photobookMaterialsUserRouter.get("/icons", requireAuth, async (req: Request, res: Response) => {
  try {
    const categoryIdParam = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const search = req.query.search as string | undefined;
    const user = req.user!;

    const conditions: any[] = [eq(photobookIcons.isActive, true)];

    conditions.push(
      or(
        eq(photobookIcons.isPublic, true),
        user.hospitalId ? eq(photobookIcons.hospitalId, user.hospitalId) : undefined
      )
    );

    if (categoryIdParam && !isNaN(categoryIdParam)) {
      conditions.push(eq(photobookIcons.categoryId, categoryIdParam));
    }

    if (search) {
      conditions.push(
        or(
          ilike(photobookIcons.name, `%${search}%`),
          ilike(photobookIcons.keywords, `%${search}%`)
        )
      );
    }

    const icons = await db.select().from(photobookIcons)
      .where(and(...conditions))
      .orderBy(asc(photobookIcons.sortOrder), desc(photobookIcons.createdAt));

    return res.json({ success: true, data: icons });
  } catch (error) {
    console.error("[PhotobookMaterials] 아이콘 조회 오류:", error);
    return res.status(500).json({ success: false, error: "아이콘 조회에 실패했습니다" });
  }
});
