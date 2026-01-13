import { Router } from "express";
import { db } from "@db";
import { productCategories, productVariants, productProjects, productProjectsInsertSchema, eq, and, desc, asc } from "@shared/schema";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const canvasObjectSchema = z.object({
  id: z.string(),
  type: z.enum(["image", "text"]),
  src: z.string().optional(),
  text: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  isFlippedX: z.boolean().optional(),
  contentX: z.number().optional(),
  contentY: z.number().optional(),
  contentWidth: z.number().optional(),
  contentHeight: z.number().optional(),
  zIndex: z.number(),
  opacity: z.number()
});

const postcardDesignSchema = z.object({
  id: z.string(),
  objects: z.array(canvasObjectSchema),
  background: z.string(),
  quantity: z.number().min(1)
});

const assetItemSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number()
});

const variantConfigSchema = z.object({
  widthMm: z.number(),
  heightMm: z.number(),
  bleedMm: z.number(),
  dpi: z.number()
});

const designsDataSchema = z.object({
  designs: z.array(postcardDesignSchema),
  assets: z.array(assetItemSchema),
  variantConfig: variantConfigSchema.optional()
}).optional();

const createProjectSchema = z.object({
  categorySlug: z.string().min(1, "카테고리는 필수입니다"),
  variantId: z.number().nullable().optional(),
  title: z.string().min(1, "제목은 필수입니다").default("새 프로젝트"),
  designsData: designsDataSchema,
  thumbnailUrl: z.string().nullable().optional(),
  status: z.enum(["draft", "completed", "ordered"]).default("draft")
});

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  variantId: z.number().nullable().optional(),
  designsData: designsDataSchema,
  thumbnailUrl: z.string().nullable().optional(),
  status: z.enum(["draft", "completed", "ordered"]).optional()
});

router.get("/categories", async (req, res) => {
  try {
    const categories = await db.query.productCategories.findMany({
      where: eq(productCategories.isActive, true),
      orderBy: asc(productCategories.sortOrder)
    });
    res.json({ data: categories });
  } catch (error) {
    console.error("Error fetching product categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/categories/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await db.query.productCategories.findFirst({
      where: and(
        eq(productCategories.slug, slug),
        eq(productCategories.isActive, true)
      )
    });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({ data: category });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

router.get("/categories/:slug/variants", async (req, res) => {
  try {
    const { slug } = req.params;
    
    const category = await db.query.productCategories.findFirst({
      where: and(
        eq(productCategories.slug, slug),
        eq(productCategories.isActive, true)
      )
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const variants = await db.query.productVariants.findMany({
      where: and(
        eq(productVariants.categoryId, category.id),
        eq(productVariants.isActive, true)
      ),
      orderBy: asc(productVariants.sortOrder)
    });

    res.json({ data: variants });
  } catch (error) {
    console.error("Error fetching variants:", error);
    res.status(500).json({ error: "Failed to fetch variants" });
  }
});

router.get("/projects", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { categorySlug, status } = req.query;
    
    let categoryId: number | undefined;
    if (categorySlug) {
      const category = await db.query.productCategories.findFirst({
        where: eq(productCategories.slug, categorySlug as string)
      });
      if (category) {
        categoryId = category.id;
      }
    }

    const conditions = [eq(productProjects.userId, userId)];
    if (categoryId) {
      conditions.push(eq(productProjects.categoryId, categoryId));
    }
    if (status) {
      conditions.push(eq(productProjects.status, status as string));
    }

    const projects = await db.query.productProjects.findMany({
      where: and(...conditions),
      orderBy: desc(productProjects.updatedAt),
      with: {
        category: true,
        variant: true
      }
    });

    res.json({ data: projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/projects/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const projectId = parseInt(req.params.id, 10);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await db.query.productProjects.findFirst({
      where: and(
        eq(productProjects.id, projectId),
        eq(productProjects.userId, userId)
      ),
      with: {
        category: true,
        variant: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ data: project });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.post("/projects", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validation = createProjectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const { categorySlug, variantId, title, designsData, thumbnailUrl, status } = validation.data;

    const category = await db.query.productCategories.findFirst({
      where: eq(productCategories.slug, categorySlug)
    });

    if (!category) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const [project] = await db.insert(productProjects).values({
      userId,
      categoryId: category.id,
      variantId: variantId || null,
      title: title || "새 프로젝트",
      designsData,
      thumbnailUrl,
      status: status || "draft"
    }).returning();

    res.json({ data: project });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/projects/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const projectId = parseInt(req.params.id, 10);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validation = updateProjectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const existingProject = await db.query.productProjects.findFirst({
      where: and(
        eq(productProjects.id, projectId),
        eq(productProjects.userId, userId)
      )
    });

    if (!existingProject) {
      return res.status(404).json({ error: "Project not found" });
    }

    const { title, variantId, designsData, thumbnailUrl, status } = validation.data;

    const [updated] = await db.update(productProjects)
      .set({
        title: title !== undefined ? title : existingProject.title,
        variantId: variantId !== undefined ? variantId : existingProject.variantId,
        designsData: designsData !== undefined ? designsData : existingProject.designsData,
        thumbnailUrl: thumbnailUrl !== undefined ? thumbnailUrl : existingProject.thumbnailUrl,
        status: status !== undefined ? status : existingProject.status,
        updatedAt: new Date()
      })
      .where(eq(productProjects.id, projectId))
      .returning();

    res.json({ data: updated });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const projectId = parseInt(req.params.id, 10);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const existingProject = await db.query.productProjects.findFirst({
      where: and(
        eq(productProjects.id, projectId),
        eq(productProjects.userId, userId)
      )
    });

    if (!existingProject) {
      return res.status(404).json({ error: "Project not found" });
    }

    await db.delete(productProjects).where(eq(productProjects.id, projectId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
