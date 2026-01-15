import { Router } from "express";
import { db } from "@db";
import { productCategories, productVariants, productProjects, productProjectsInsertSchema, eq, and, desc, asc } from "@shared/schema";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { bucket, bucketName } from "../utils/gcs-image-storage";

const router = Router();

function extractGCSPath(url: string): string | null {
  if (!url) return null;
  
  let cleanUrl = url.split('?')[0];
  
  const gcsPrefix = `https://storage.googleapis.com/${bucketName}/`;
  if (cleanUrl.startsWith(gcsPrefix)) {
    return cleanUrl.substring(gcsPrefix.length);
  }
  
  const gsPrefix = `gs://${bucketName}/`;
  if (cleanUrl.startsWith(gsPrefix)) {
    return cleanUrl.substring(gsPrefix.length);
  }
  
  const encodedPattern = new RegExp(`https://storage\\.googleapis\\.com/.*?/o/(.+)`);
  const match = cleanUrl.match(encodedPattern);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  
  return null;
}

async function deleteGCSFile(url: string): Promise<boolean> {
  const path = extractGCSPath(url);
  if (!path) return false;
  
  try {
    const file = bucket.file(path);
    const [exists] = await file.exists();
    
    if (exists) {
      await file.delete();
      console.log(`[GCS Cleanup] 삭제 완료: ${path}`);
      return true;
    } else {
      console.log(`[GCS Cleanup] 파일 없음 (스킵): ${path}`);
    }
  } catch (error) {
    console.error(`[GCS Cleanup] 삭제 실패: ${path}`, error);
  }
  return false;
}

function extractAllGCSUrls(designsData: any): string[] {
  const urls: Set<string> = new Set();
  
  if (!designsData) return [];
  
  if (designsData.assets && Array.isArray(designsData.assets)) {
    for (const asset of designsData.assets) {
      if (asset.url) urls.add(asset.url);
      if (asset.fullUrl) urls.add(asset.fullUrl);
      if (asset.originalUrl) urls.add(asset.originalUrl);
    }
  }
  
  if (designsData.designs && Array.isArray(designsData.designs)) {
    for (const design of designsData.designs) {
      if (design.objects && Array.isArray(design.objects)) {
        for (const obj of design.objects) {
          if (obj.type === 'image') {
            if (obj.src) urls.add(obj.src);
            if (obj.fullSrc) urls.add(obj.fullSrc);
          }
        }
      }
    }
  }
  
  return Array.from(urls).filter(url => url && typeof url === 'string');
}

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

    const { categorySlug, status, lightweight } = req.query;
    
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

    if (lightweight === 'true') {
      const projects = await db.select({
        id: productProjects.id,
        userId: productProjects.userId,
        categoryId: productProjects.categoryId,
        variantId: productProjects.variantId,
        title: productProjects.title,
        thumbnailUrl: productProjects.thumbnailUrl,
        status: productProjects.status,
        createdAt: productProjects.createdAt,
        updatedAt: productProjects.updatedAt
      })
      .from(productProjects)
      .where(and(...conditions))
      .orderBy(desc(productProjects.updatedAt));
      
      res.json({ data: projects });
      return;
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

    const designsData = existingProject.designsData as any;
    const allUrls = extractAllGCSUrls(designsData);
    
    console.log(`[Project Delete] 프로젝트 ${projectId} 삭제 시작, GCS 이미지 ${allUrls.length}개 발견`);
    
    const deletePromises = allUrls.map(url => deleteGCSFile(url));
    Promise.all(deletePromises)
      .then(results => {
        const deletedCount = results.filter(r => r).length;
        console.log(`[Project Delete] GCS 이미지 삭제 완료: ${deletedCount}/${allUrls.length}개`);
      })
      .catch(error => {
        console.error(`[Project Delete] GCS 이미지 삭제 중 오류:`, error);
      });

    await db.delete(productProjects).where(eq(productProjects.id, projectId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
