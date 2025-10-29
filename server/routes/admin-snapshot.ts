import type { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAdminOrSuperAdmin } from "../middleware/admin-auth";
import { 
  snapshotPrompts,
  snapshotPromptsInsertSchema,
  type SnapshotPrompt,
} from "../../shared/schema";
import { db } from "@db";
import { eq, desc, and, asc, sql, like, or, count } from "drizzle-orm";

// Utility functions
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

// Schema for update (all fields optional except id)
const snapshotPromptsUpdateSchema = snapshotPromptsInsertSchema.partial();

/**
 * Register admin snapshot prompts routes
 */
export function registerAdminSnapshotRoutes(app: Express): void {
  
  // ========================================
  // GET /api/admin/snapshot-prompts
  // 프롬프트 목록 조회 (필터링, 페이지네이션, 검색)
  // ========================================
  app.get("/api/admin/snapshot-prompts", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { 
        page = "1", 
        limit = "20",
        category,
        type,
        gender,
        isActive,
        search,
        region,
        season,
        sortBy = "order",
        sortOrder = "asc"
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Build WHERE conditions
      const conditions: any[] = [];
      
      if (category) {
        conditions.push(eq(snapshotPrompts.category, category as string));
      }
      
      if (type) {
        conditions.push(eq(snapshotPrompts.type, type as string));
      }
      
      if (gender) {
        conditions.push(eq(snapshotPrompts.gender, gender as string));
      }
      
      if (isActive !== undefined) {
        conditions.push(eq(snapshotPrompts.isActive, isActive === "true"));
      }
      
      if (region) {
        conditions.push(eq(snapshotPrompts.region, region as string));
      }
      
      if (season) {
        conditions.push(eq(snapshotPrompts.season, season as string));
      }
      
      if (search) {
        conditions.push(
          or(
            like(snapshotPrompts.text, `%${search}%`),
            sql`${snapshotPrompts.tags}::text LIKE ${`%${search}%`}`
          )
        );
      }

      // Get total count
      const countQuery = db.select({ count: count() }).from(snapshotPrompts);
      const finalCountQuery = conditions.length > 0 
        ? countQuery.where(and(...conditions))
        : countQuery;
      const [totalResult] = await finalCountQuery;

      const total = totalResult?.count || 0;

      // Get prompts
      const orderColumn = sortBy === "order" ? snapshotPrompts.order :
                         sortBy === "usageCount" ? snapshotPrompts.usageCount :
                         sortBy === "createdAt" ? snapshotPrompts.createdAt :
                         snapshotPrompts.order;
      
      const orderFn = sortOrder === "desc" ? desc : asc;

      const queryOptions: any = {
        orderBy: orderFn(orderColumn),
        limit: limitNum,
        offset: offset,
      };
      
      if (conditions.length > 0) {
        queryOptions.where = and(...conditions);
      }

      const prompts = await db.query.snapshotPrompts.findMany(queryOptions);

      res.json({
        success: true,
        data: prompts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("❌ Error fetching snapshot prompts:", error);
      res.status(500).json({
        success: false,
        message: "프롬프트 목록을 가져오는 중 오류가 발생했습니다.",
        error: getErrorMessage(error),
      });
    }
  });

  // ========================================
  // GET /api/admin/snapshot-prompts/stats
  // 프롬프트 통계 정보
  // ========================================
  app.get("/api/admin/snapshot-prompts/stats", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      // Total counts
      const [totalResult] = await db.select({ count: count() }).from(snapshotPrompts);
      const total = totalResult?.count || 0;

      // Active counts
      const [activeResult] = await db
        .select({ count: count() })
        .from(snapshotPrompts)
        .where(eq(snapshotPrompts.isActive, true));
      const active = activeResult?.count || 0;

      // Category distribution
      const categoryStats = await db
        .select({
          category: snapshotPrompts.category,
          count: count(),
        })
        .from(snapshotPrompts)
        .groupBy(snapshotPrompts.category);

      // Type distribution
      const typeStats = await db
        .select({
          type: snapshotPrompts.type,
          count: count(),
        })
        .from(snapshotPrompts)
        .groupBy(snapshotPrompts.type);

      // Gender distribution
      const genderStats = await db
        .select({
          gender: snapshotPrompts.gender,
          count: count(),
        })
        .from(snapshotPrompts)
        .groupBy(snapshotPrompts.gender);

      // Most used prompts (top 10)
      const mostUsed = await db.query.snapshotPrompts.findMany({
        orderBy: desc(snapshotPrompts.usageCount),
        limit: 10,
      });

      res.json({
        success: true,
        data: {
          total,
          active,
          inactive: total - active,
          categoryDistribution: categoryStats,
          typeDistribution: typeStats,
          genderDistribution: genderStats,
          mostUsedPrompts: mostUsed,
        },
      });
    } catch (error) {
      console.error("❌ Error fetching snapshot prompts stats:", error);
      res.status(500).json({
        success: false,
        message: "통계 정보를 가져오는 중 오류가 발생했습니다.",
        error: getErrorMessage(error),
      });
    }
  });

  // ========================================
  // GET /api/admin/snapshot-prompts/:id
  // 특정 프롬프트 조회
  // ========================================
  app.get("/api/admin/snapshot-prompts/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const promptId = parseInt(id);

      if (isNaN(promptId)) {
        return res.status(400).json({
          success: false,
          message: "유효하지 않은 프롬프트 ID입니다.",
        });
      }

      const prompt = await db.query.snapshotPrompts.findFirst({
        where: eq(snapshotPrompts.id, promptId),
      });

      if (!prompt) {
        return res.status(404).json({
          success: false,
          message: "프롬프트를 찾을 수 없습니다.",
        });
      }

      res.json({
        success: true,
        data: prompt,
      });
    } catch (error) {
      console.error("❌ Error fetching snapshot prompt:", error);
      res.status(500).json({
        success: false,
        message: "프롬프트를 가져오는 중 오류가 발생했습니다.",
        error: getErrorMessage(error),
      });
    }
  });

  // ========================================
  // POST /api/admin/snapshot-prompts
  // 새 프롬프트 추가
  // ========================================
  app.post("/api/admin/snapshot-prompts", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = snapshotPromptsInsertSchema.parse(req.body);

      const [newPrompt] = await db
        .insert(snapshotPrompts)
        .values(validatedData)
        .returning();

      console.log(`✅ New snapshot prompt created: ID ${newPrompt.id}, Category: ${newPrompt.category}`);

      res.status(201).json({
        success: true,
        message: "프롬프트가 성공적으로 추가되었습니다.",
        data: newPrompt,
      });
    } catch (error) {
      console.error("❌ Error creating snapshot prompt:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "입력 데이터가 유효하지 않습니다.",
          errors: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        message: "프롬프트 추가 중 오류가 발생했습니다.",
        error: getErrorMessage(error),
      });
    }
  });

  // ========================================
  // PUT /api/admin/snapshot-prompts/:id
  // 프롬프트 수정
  // ========================================
  app.put("/api/admin/snapshot-prompts/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const promptId = parseInt(id);

      if (isNaN(promptId)) {
        return res.status(400).json({
          success: false,
          message: "유효하지 않은 프롬프트 ID입니다.",
        });
      }

      // Check if prompt exists
      const existingPrompt = await db.query.snapshotPrompts.findFirst({
        where: eq(snapshotPrompts.id, promptId),
      });

      if (!existingPrompt) {
        return res.status(404).json({
          success: false,
          message: "프롬프트를 찾을 수 없습니다.",
        });
      }

      const validatedData = snapshotPromptsUpdateSchema.parse(req.body);

      const [updatedPrompt] = await db
        .update(snapshotPrompts)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(snapshotPrompts.id, promptId))
        .returning();

      console.log(`✅ Snapshot prompt updated: ID ${promptId}`);

      res.json({
        success: true,
        message: "프롬프트가 성공적으로 수정되었습니다.",
        data: updatedPrompt,
      });
    } catch (error) {
      console.error("❌ Error updating snapshot prompt:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "입력 데이터가 유효하지 않습니다.",
          errors: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        message: "프롬프트 수정 중 오류가 발생했습니다.",
        error: getErrorMessage(error),
      });
    }
  });

  // ========================================
  // DELETE /api/admin/snapshot-prompts/:id
  // 프롬프트 삭제
  // ========================================
  app.delete("/api/admin/snapshot-prompts/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const promptId = parseInt(id);

      if (isNaN(promptId)) {
        return res.status(400).json({
          success: false,
          message: "유효하지 않은 프롬프트 ID입니다.",
        });
      }

      // Check if prompt exists
      const existingPrompt = await db.query.snapshotPrompts.findFirst({
        where: eq(snapshotPrompts.id, promptId),
      });

      if (!existingPrompt) {
        return res.status(404).json({
          success: false,
          message: "프롬프트를 찾을 수 없습니다.",
        });
      }

      await db.delete(snapshotPrompts).where(eq(snapshotPrompts.id, promptId));

      console.log(`✅ Snapshot prompt deleted: ID ${promptId}`);

      res.json({
        success: true,
        message: "프롬프트가 성공적으로 삭제되었습니다.",
      });
    } catch (error) {
      console.error("❌ Error deleting snapshot prompt:", error);
      res.status(500).json({
        success: false,
        message: "프롬프트 삭제 중 오류가 발생했습니다.",
        error: getErrorMessage(error),
      });
    }
  });

  // ========================================
  // PATCH /api/admin/snapshot-prompts/:id/toggle
  // 프롬프트 활성화 토글
  // ========================================
  app.patch("/api/admin/snapshot-prompts/:id/toggle", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const promptId = parseInt(id);

      if (isNaN(promptId)) {
        return res.status(400).json({
          success: false,
          message: "유효하지 않은 프롬프트 ID입니다.",
        });
      }

      // Check if prompt exists
      const existingPrompt = await db.query.snapshotPrompts.findFirst({
        where: eq(snapshotPrompts.id, promptId),
      });

      if (!existingPrompt) {
        return res.status(404).json({
          success: false,
          message: "프롬프트를 찾을 수 없습니다.",
        });
      }

      const newActiveState = !existingPrompt.isActive;

      const [updatedPrompt] = await db
        .update(snapshotPrompts)
        .set({
          isActive: newActiveState,
          updatedAt: new Date(),
        })
        .where(eq(snapshotPrompts.id, promptId))
        .returning();

      console.log(`✅ Snapshot prompt toggled: ID ${promptId}, Active: ${newActiveState}`);

      res.json({
        success: true,
        message: `프롬프트가 ${newActiveState ? "활성화" : "비활성화"}되었습니다.`,
        data: updatedPrompt,
      });
    } catch (error) {
      console.error("❌ Error toggling snapshot prompt:", error);
      res.status(500).json({
        success: false,
        message: "프롬프트 상태 변경 중 오류가 발생했습니다.",
        error: getErrorMessage(error),
      });
    }
  });

  console.log("✅ Admin snapshot prompts routes registered");
}
