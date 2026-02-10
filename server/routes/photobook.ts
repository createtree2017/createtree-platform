import { Router, type Request, type Response } from "express";
import { z } from "zod";
import multer from "multer";
import { db } from "../../db/index";
import {
  photobookProjects,
  photobookVersions,
  photobookTemplates,
  photobookBackgrounds,
  photobookIcons,
  photobookProjectsInsertSchema,
  photobookVersionsInsertSchema,
  photobookTemplatesInsertSchema,
  photobookBackgroundsInsertSchema,
  photobookIconsInsertSchema,
} from "../../shared/schema";
import { eq, and, desc, or, isNull, sql } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { requireAdminOrSuperAdmin } from "../middleware/auth";
import { uploadBufferToGCS } from "../utils/gcs";

const photobookImageUpload = multer({
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

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const projectCreateSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").default("새 포토북"),
  description: z.string().optional(),
  templateId: z.number().int().positive().optional(),
  canvasWidth: z.number().int().positive().default(800),
  canvasHeight: z.number().int().positive().default(600),
});

const projectUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  currentPage: z.number().int().min(0).optional(),
  pagesData: z.any().optional(),
  status: z.enum(["draft", "in_progress", "completed", "archived"]).optional(),
});

const versionCreateSchema = z.object({
  description: z.string().optional(),
  isAutoSave: z.boolean().default(false),
});

const templateCreateSchema = z.object({
  name: z.string().min(1, "템플릿 이름을 입력해주세요"),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  pageCount: z.number().int().positive().default(1),
  canvasWidth: z.number().int().positive().default(800),
  canvasHeight: z.number().int().positive().default(600),
  pagesData: z.any().default({ pages: [{ id: "page-1", objects: [], backgroundColor: "#ffffff" }] }),
  category: z.string().default("general"),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(true),
  hospitalId: z.number().int().positive().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const templateUpdateSchema = templateCreateSchema.partial();

const backgroundCreateSchema = z.object({
  name: z.string().min(1, "배경 이름을 입력해주세요"),
  imageUrl: z.string().min(1, "이미지 URL을 입력해주세요"),
  thumbnailUrl: z.string().optional(),
  category: z.string().default("general"),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(true),
  hospitalId: z.number().int().positive().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const backgroundUpdateSchema = backgroundCreateSchema.partial();

const iconCreateSchema = z.object({
  name: z.string().min(1, "아이콘 이름을 입력해주세요"),
  imageUrl: z.string().min(1, "이미지 URL을 입력해주세요"),
  thumbnailUrl: z.string().optional(),
  category: z.string().default("general"),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(true),
  hospitalId: z.number().int().positive().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const iconUpdateSchema = iconCreateSchema.partial();

export const photobookUserRouter = Router();

photobookUserRouter.post("/images", requireAuth, photobookImageUpload.single("image"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: "이미지 파일이 필요합니다" });
    }

    const timestamp = Date.now();
    const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const targetPath = `photobook/${userId}/${timestamp}_${safeFilename}`;

    console.log(`[Photobook] 이미지 업로드 시작: ${targetPath}`);

    const imageUrl = await uploadBufferToGCS(file.buffer, targetPath, file.mimetype);

    console.log(`[Photobook] 이미지 업로드 완료: ${imageUrl}`);

    res.status(201).json({
      success: true,
      data: {
        url: imageUrl,
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
    });
  } catch (error) {
    console.error("[Photobook] 이미지 업로드 오류:", error);
    res.status(500).json({ success: false, error: "이미지 업로드 실패" });
  }
});

photobookUserRouter.get("/projects", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { page, limit } = paginationSchema.parse(req.query);
    const { lightweight } = req.query;
    const offset = (page - 1) * limit;

    if (lightweight === 'true') {
      const [projects, countResult] = await Promise.all([
        db.select({
          id: photobookProjects.id,
          userId: photobookProjects.userId,
          title: photobookProjects.title,
          description: photobookProjects.description,
          coverImageUrl: photobookProjects.coverImageUrl,
          status: photobookProjects.status,
          createdAt: photobookProjects.createdAt,
          updatedAt: photobookProjects.updatedAt
        })
          .from(photobookProjects)
          .where(eq(photobookProjects.userId, userId))
          .orderBy(desc(photobookProjects.updatedAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` })
          .from(photobookProjects)
          .where(eq(photobookProjects.userId, userId)),
      ]);

      const total = countResult[0]?.count || 0;

      res.json({
        success: true,
        data: projects,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
      return;
    }

    const [projects, countResult] = await Promise.all([
      db.query.photobookProjects.findMany({
        where: eq(photobookProjects.userId, userId),
        orderBy: desc(photobookProjects.updatedAt),
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` })
        .from(photobookProjects)
        .where(eq(photobookProjects.userId, userId)),
    ]);

    const total = countResult[0]?.count || 0;

    res.json({
      success: true,
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Photobook] 프로젝트 목록 조회 오류:", error);
    res.status(500).json({ success: false, error: "프로젝트 목록 조회 실패" });
  }
});

photobookUserRouter.get("/projects/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 프로젝트 ID" });
    }

    const project = await db.query.photobookProjects.findFirst({
      where: and(
        eq(photobookProjects.id, projectId),
        eq(photobookProjects.userId, userId)
      ),
      with: {
        template: true,
      },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "프로젝트를 찾을 수 없습니다" });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    console.error("[Photobook] 프로젝트 조회 오류:", error);
    res.status(500).json({ success: false, error: "프로젝트 조회 실패" });
  }
});

photobookUserRouter.post("/projects", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const hospitalId = req.user!.hospitalId;
    const validated = projectCreateSchema.parse(req.body);

    let initialPagesData = { pages: [{ id: "page-1", objects: [], backgroundColor: "#ffffff" }] };

    if (validated.templateId) {
      const template = await db.query.photobookTemplates.findFirst({
        where: eq(photobookTemplates.id, validated.templateId),
      });
      if (template && template.pagesData) {
        initialPagesData = template.pagesData as typeof initialPagesData;
      }
    }

    const [newProject] = await db.insert(photobookProjects).values({
      userId,
      hospitalId: hospitalId || undefined,
      title: validated.title,
      description: validated.description,
      templateId: validated.templateId,
      canvasWidth: validated.canvasWidth,
      canvasHeight: validated.canvasHeight,
      pagesData: initialPagesData,
      pageCount: initialPagesData.pages.length,
      status: "draft",
    }).returning();

    res.status(201).json({ success: true, data: newProject });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Photobook] 프로젝트 생성 오류:", error);
    res.status(500).json({ success: false, error: "프로젝트 생성 실패" });
  }
});

photobookUserRouter.patch("/projects/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 프로젝트 ID" });
    }

    const validated = projectUpdateSchema.parse(req.body);

    const existing = await db.query.photobookProjects.findFirst({
      where: and(
        eq(photobookProjects.id, projectId),
        eq(photobookProjects.userId, userId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "프로젝트를 찾을 수 없습니다" });
    }

    const updateData: Record<string, any> = {
      ...validated,
      updatedAt: new Date(),
      lastSavedAt: new Date(),
    };

    if (validated.pagesData) {
      updateData.pageCount = validated.pagesData.pages?.length || 1;
    }

    const [updated] = await db.update(photobookProjects)
      .set(updateData)
      .where(and(
        eq(photobookProjects.id, projectId),
        eq(photobookProjects.userId, userId)
      ))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Photobook] 프로젝트 업데이트 오류:", error);
    res.status(500).json({ success: false, error: "프로젝트 업데이트 실패" });
  }
});

photobookUserRouter.delete("/projects/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 프로젝트 ID" });
    }

    const existing = await db.query.photobookProjects.findFirst({
      where: and(
        eq(photobookProjects.id, projectId),
        eq(photobookProjects.userId, userId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "프로젝트를 찾을 수 없습니다" });
    }

    await db.delete(photobookProjects).where(
      and(
        eq(photobookProjects.id, projectId),
        eq(photobookProjects.userId, userId)
      )
    );

    res.json({ success: true, message: "프로젝트가 삭제되었습니다" });
  } catch (error) {
    console.error("[Photobook] 프로젝트 삭제 오류:", error);
    res.status(500).json({ success: false, error: "프로젝트 삭제 실패" });
  }
});

photobookUserRouter.post("/projects/:id/versions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 프로젝트 ID" });
    }

    const validated = versionCreateSchema.parse(req.body);

    const project = await db.query.photobookProjects.findFirst({
      where: and(
        eq(photobookProjects.id, projectId),
        eq(photobookProjects.userId, userId)
      ),
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "프로젝트를 찾을 수 없습니다" });
    }

    const lastVersion = await db.query.photobookVersions.findFirst({
      where: eq(photobookVersions.projectId, projectId),
      orderBy: desc(photobookVersions.versionNumber),
    });

    const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

    const [newVersion] = await db.insert(photobookVersions).values({
      projectId,
      versionNumber: nextVersionNumber,
      pagesDataSnapshot: project.pagesData as any,
      description: validated.description,
      isAutoSave: validated.isAutoSave,
    }).returning();

    res.status(201).json({ success: true, data: newVersion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Photobook] 버전 생성 오류:", error);
    res.status(500).json({ success: false, error: "버전 저장 실패" });
  }
});

photobookUserRouter.get("/projects/:id/versions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 프로젝트 ID" });
    }

    const project = await db.query.photobookProjects.findFirst({
      where: and(
        eq(photobookProjects.id, projectId),
        eq(photobookProjects.userId, userId)
      ),
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "프로젝트를 찾을 수 없습니다" });
    }

    const versions = await db.query.photobookVersions.findMany({
      where: eq(photobookVersions.projectId, projectId),
      orderBy: desc(photobookVersions.versionNumber),
      limit: 10,
    });

    res.json({ success: true, data: versions });
  } catch (error) {
    console.error("[Photobook] 버전 목록 조회 오류:", error);
    res.status(500).json({ success: false, error: "버전 목록 조회 실패" });
  }
});

photobookUserRouter.post("/projects/:id/restore/:versionId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);

    if (isNaN(projectId) || isNaN(versionId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 ID" });
    }

    const project = await db.query.photobookProjects.findFirst({
      where: and(
        eq(photobookProjects.id, projectId),
        eq(photobookProjects.userId, userId)
      ),
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "프로젝트를 찾을 수 없습니다" });
    }

    const version = await db.query.photobookVersions.findFirst({
      where: and(
        eq(photobookVersions.id, versionId),
        eq(photobookVersions.projectId, projectId)
      ),
    });

    if (!version) {
      return res.status(404).json({ success: false, error: "버전을 찾을 수 없습니다" });
    }

    const [updated] = await db.update(photobookProjects)
      .set({
        pagesData: version.pagesDataSnapshot as any,
        pageCount: (version.pagesDataSnapshot as any)?.pages?.length || 1,
        updatedAt: new Date(),
        lastSavedAt: new Date(),
      })
      .where(eq(photobookProjects.id, projectId))
      .returning();

    res.json({ success: true, data: updated, message: `버전 ${version.versionNumber}로 복원되었습니다` });
  } catch (error) {
    console.error("[Photobook] 버전 복원 오류:", error);
    res.status(500).json({ success: false, error: "버전 복원 실패" });
  }
});

export const photobookPublicRouter = Router();

photobookPublicRouter.get("/templates", optionalAuth, async (req: Request, res: Response) => {
  try {
    const hospitalId = req.user?.hospitalId;
    const category = req.query.category as string | undefined;

    let whereCondition;
    if (hospitalId) {
      whereCondition = and(
        eq(photobookTemplates.isActive, true),
        or(
          eq(photobookTemplates.isPublic, true),
          eq(photobookTemplates.hospitalId, hospitalId)
        )
      );
    } else {
      whereCondition = and(
        eq(photobookTemplates.isActive, true),
        eq(photobookTemplates.isPublic, true)
      );
    }

    const templates = await db.query.photobookTemplates.findMany({
      where: whereCondition,
      orderBy: [desc(photobookTemplates.sortOrder), desc(photobookTemplates.createdAt)],
    });

    const filteredTemplates = category && category !== "all"
      ? templates.filter(t => t.category === category)
      : templates;

    res.json({ success: true, data: filteredTemplates });
  } catch (error) {
    console.error("[Photobook] 템플릿 조회 오류:", error);
    res.status(500).json({ success: false, error: "템플릿 조회 실패" });
  }
});

photobookPublicRouter.get("/backgrounds", optionalAuth, async (req: Request, res: Response) => {
  try {
    const hospitalId = req.user?.hospitalId;
    const category = req.query.category as string | undefined;

    let whereCondition;
    if (hospitalId) {
      whereCondition = and(
        eq(photobookBackgrounds.isActive, true),
        or(
          eq(photobookBackgrounds.isPublic, true),
          eq(photobookBackgrounds.hospitalId, hospitalId)
        )
      );
    } else {
      whereCondition = and(
        eq(photobookBackgrounds.isActive, true),
        eq(photobookBackgrounds.isPublic, true)
      );
    }

    const backgrounds = await db.query.photobookBackgrounds.findMany({
      where: whereCondition,
      orderBy: [desc(photobookBackgrounds.sortOrder), desc(photobookBackgrounds.createdAt)],
    });

    const filteredBackgrounds = category && category !== "all"
      ? backgrounds.filter(b => b.category === category)
      : backgrounds;

    res.json({ success: true, data: filteredBackgrounds });
  } catch (error) {
    console.error("[Photobook] 배경 조회 오류:", error);
    res.status(500).json({ success: false, error: "배경 조회 실패" });
  }
});

photobookPublicRouter.get("/icons", optionalAuth, async (req: Request, res: Response) => {
  try {
    const hospitalId = req.user?.hospitalId;
    const category = req.query.category as string | undefined;

    let whereCondition;
    if (hospitalId) {
      whereCondition = and(
        eq(photobookIcons.isActive, true),
        or(
          eq(photobookIcons.isPublic, true),
          eq(photobookIcons.hospitalId, hospitalId)
        )
      );
    } else {
      whereCondition = and(
        eq(photobookIcons.isActive, true),
        eq(photobookIcons.isPublic, true)
      );
    }

    const icons = await db.query.photobookIcons.findMany({
      where: whereCondition,
      orderBy: [desc(photobookIcons.sortOrder), desc(photobookIcons.createdAt)],
    });

    const filteredIcons = category && category !== "all"
      ? icons.filter(i => i.category === category)
      : icons;

    res.json({ success: true, data: filteredIcons });
  } catch (error) {
    console.error("[Photobook] 아이콘 조회 오류:", error);
    res.status(500).json({ success: false, error: "아이콘 조회 실패" });
  }
});

export const photobookAdminRouter = Router();

photobookAdminRouter.get("/templates", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    const [templates, countResult] = await Promise.all([
      db.query.photobookTemplates.findMany({
        orderBy: [desc(photobookTemplates.sortOrder), desc(photobookTemplates.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` })
        .from(photobookTemplates),
    ]);

    const total = countResult[0]?.count || 0;

    res.json({
      success: true,
      data: templates,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Admin Photobook] 템플릿 목록 조회 오류:", error);
    res.status(500).json({ success: false, error: "템플릿 목록 조회 실패" });
  }
});

photobookAdminRouter.post("/templates", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const validated = templateCreateSchema.parse(req.body);

    const [newTemplate] = await db.insert(photobookTemplates).values(validated).returning();

    res.status(201).json({ success: true, data: newTemplate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Admin Photobook] 템플릿 생성 오류:", error);
    res.status(500).json({ success: false, error: "템플릿 생성 실패" });
  }
});

photobookAdminRouter.patch("/templates/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 템플릿 ID" });
    }

    const validated = templateUpdateSchema.parse(req.body);

    const existing = await db.query.photobookTemplates.findFirst({
      where: eq(photobookTemplates.id, templateId),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "템플릿을 찾을 수 없습니다" });
    }

    const [updated] = await db.update(photobookTemplates)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(photobookTemplates.id, templateId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Admin Photobook] 템플릿 업데이트 오류:", error);
    res.status(500).json({ success: false, error: "템플릿 업데이트 실패" });
  }
});

photobookAdminRouter.delete("/templates/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 템플릿 ID" });
    }

    const existing = await db.query.photobookTemplates.findFirst({
      where: eq(photobookTemplates.id, templateId),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "템플릿을 찾을 수 없습니다" });
    }

    await db.delete(photobookTemplates).where(eq(photobookTemplates.id, templateId));

    res.json({ success: true, message: "템플릿이 삭제되었습니다" });
  } catch (error) {
    console.error("[Admin Photobook] 템플릿 삭제 오류:", error);
    res.status(500).json({ success: false, error: "템플릿 삭제 실패" });
  }
});

photobookAdminRouter.get("/backgrounds", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    const [backgrounds, countResult] = await Promise.all([
      db.query.photobookBackgrounds.findMany({
        orderBy: [desc(photobookBackgrounds.sortOrder), desc(photobookBackgrounds.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` })
        .from(photobookBackgrounds),
    ]);

    const total = countResult[0]?.count || 0;

    res.json({
      success: true,
      data: backgrounds,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Admin Photobook] 배경 목록 조회 오류:", error);
    res.status(500).json({ success: false, error: "배경 목록 조회 실패" });
  }
});

photobookAdminRouter.post("/backgrounds", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const validated = backgroundCreateSchema.parse(req.body);

    const [newBackground] = await db.insert(photobookBackgrounds).values(validated).returning();

    res.status(201).json({ success: true, data: newBackground });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Admin Photobook] 배경 생성 오류:", error);
    res.status(500).json({ success: false, error: "배경 생성 실패" });
  }
});

photobookAdminRouter.patch("/backgrounds/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const backgroundId = parseInt(req.params.id);
    if (isNaN(backgroundId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 배경 ID" });
    }

    const validated = backgroundUpdateSchema.parse(req.body);

    const existing = await db.query.photobookBackgrounds.findFirst({
      where: eq(photobookBackgrounds.id, backgroundId),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "배경을 찾을 수 없습니다" });
    }

    const [updated] = await db.update(photobookBackgrounds)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(photobookBackgrounds.id, backgroundId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Admin Photobook] 배경 업데이트 오류:", error);
    res.status(500).json({ success: false, error: "배경 업데이트 실패" });
  }
});

photobookAdminRouter.delete("/backgrounds/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const backgroundId = parseInt(req.params.id);
    if (isNaN(backgroundId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 배경 ID" });
    }

    const existing = await db.query.photobookBackgrounds.findFirst({
      where: eq(photobookBackgrounds.id, backgroundId),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "배경을 찾을 수 없습니다" });
    }

    await db.delete(photobookBackgrounds).where(eq(photobookBackgrounds.id, backgroundId));

    res.json({ success: true, message: "배경이 삭제되었습니다" });
  } catch (error) {
    console.error("[Admin Photobook] 배경 삭제 오류:", error);
    res.status(500).json({ success: false, error: "배경 삭제 실패" });
  }
});

photobookAdminRouter.get("/icons", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    const [icons, countResult] = await Promise.all([
      db.query.photobookIcons.findMany({
        orderBy: [desc(photobookIcons.sortOrder), desc(photobookIcons.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` })
        .from(photobookIcons),
    ]);

    const total = countResult[0]?.count || 0;

    res.json({
      success: true,
      data: icons,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Admin Photobook] 아이콘 목록 조회 오류:", error);
    res.status(500).json({ success: false, error: "아이콘 목록 조회 실패" });
  }
});

photobookAdminRouter.post("/icons", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const validated = iconCreateSchema.parse(req.body);

    const [newIcon] = await db.insert(photobookIcons).values(validated).returning();

    res.status(201).json({ success: true, data: newIcon });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Admin Photobook] 아이콘 생성 오류:", error);
    res.status(500).json({ success: false, error: "아이콘 생성 실패" });
  }
});

photobookAdminRouter.patch("/icons/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const iconId = parseInt(req.params.id);
    if (isNaN(iconId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 아이콘 ID" });
    }

    const validated = iconUpdateSchema.parse(req.body);

    const existing = await db.query.photobookIcons.findFirst({
      where: eq(photobookIcons.id, iconId),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "아이콘을 찾을 수 없습니다" });
    }

    const [updated] = await db.update(photobookIcons)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(photobookIcons.id, iconId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("[Admin Photobook] 아이콘 업데이트 오류:", error);
    res.status(500).json({ success: false, error: "아이콘 업데이트 실패" });
  }
});

photobookAdminRouter.delete("/icons/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const iconId = parseInt(req.params.id);
    if (isNaN(iconId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 아이콘 ID" });
    }

    const existing = await db.query.photobookIcons.findFirst({
      where: eq(photobookIcons.id, iconId),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "아이콘을 찾을 수 없습니다" });
    }

    await db.delete(photobookIcons).where(eq(photobookIcons.id, iconId));

    res.json({ success: true, message: "아이콘이 삭제되었습니다" });
  } catch (error) {
    console.error("[Admin Photobook] 아이콘 삭제 오류:", error);
    res.status(500).json({ success: false, error: "아이콘 삭제 실패" });
  }
});
