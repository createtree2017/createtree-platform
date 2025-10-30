import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdminOrSuperAdmin } from '../middleware/admin-auth';
import { db } from '@db';
import { snapshotPrompts, snapshotPromptsInsertSchema, snapshotPromptsUpdateSchema } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/admin/snapshot-prompts
 * Get all snapshot prompts with optional filters
 * 
 * Query params:
 * - category: 'individual' | 'couple' | 'family'
 * - type: 'mix' | 'daily' | 'travel' | 'film'
 * - gender: 'male' | 'female'
 * - isActive: 'true' | 'false'
 * - page: number (default: 1)
 * - limit: number (default: 50)
 */
router.get('/snapshot-prompts', requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { category, type, gender, isActive, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
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
      conditions.push(eq(snapshotPrompts.isActive, isActive === 'true'));
    }

    // Query prompts
    const prompts = await db.query.snapshotPrompts.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(snapshotPrompts.createdAt)],
      limit: limitNum,
      offset
    });

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(snapshotPrompts)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = totalResult[0]?.count || 0;

    return res.status(200).json({
      success: true,
      prompts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: offset + prompts.length < total
      }
    });

  } catch (error: any) {
    console.error('❌ Admin get prompts error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch prompts',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/snapshot-prompts
 * Create a new snapshot prompt
 * 
 * Body:
 * - category: 'individual' | 'couple' | 'family'
 * - type: 'mix' | 'daily' | 'travel' | 'film'
 * - gender: 'male' | 'female' | null
 * - prompt: string (required)
 * - isActive: boolean (default: true)
 */
router.post('/snapshot-prompts', requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    // Validate request body
    const validatedData = snapshotPromptsInsertSchema.parse(req.body);

    // Insert new prompt
    const [newPrompt] = await db
      .insert(snapshotPrompts)
      .values({
        ...validatedData,
        usageCount: 0
      })
      .returning();

    console.log(`✅ Admin created new prompt: ID ${newPrompt.id}`);

    return res.status(201).json({
      success: true,
      prompt: newPrompt,
      message: 'Prompt created successfully'
    });

  } catch (error: any) {
    console.error('❌ Admin create prompt error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to create prompt',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/snapshot-prompts/:id
 * Update an existing snapshot prompt
 * 
 * Params:
 * - id: number (prompt ID)
 * 
 * Body: Partial<SnapshotPrompt>
 */
router.put('/snapshot-prompts/:id', requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const promptId = parseInt(req.params.id);
    
    if (isNaN(promptId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prompt ID'
      });
    }

    // Check if prompt exists
    const existingPrompt = await db.query.snapshotPrompts.findFirst({
      where: eq(snapshotPrompts.id, promptId)
    });

    if (!existingPrompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found'
      });
    }

    // Validate update data
    const validatedData = snapshotPromptsUpdateSchema.parse(req.body);

    // Update prompt
    const [updatedPrompt] = await db
      .update(snapshotPrompts)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(snapshotPrompts.id, promptId))
      .returning();

    console.log(`✅ Admin updated prompt: ID ${promptId}`);

    return res.status(200).json({
      success: true,
      prompt: updatedPrompt,
      message: 'Prompt updated successfully'
    });

  } catch (error: any) {
    console.error('❌ Admin update prompt error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to update prompt',
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/snapshot-prompts/:id
 * Delete a snapshot prompt
 * 
 * Params:
 * - id: number (prompt ID)
 */
router.delete('/snapshot-prompts/:id', requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const promptId = parseInt(req.params.id);
    
    if (isNaN(promptId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prompt ID'
      });
    }

    // Check if prompt exists
    const existingPrompt = await db.query.snapshotPrompts.findFirst({
      where: eq(snapshotPrompts.id, promptId)
    });

    if (!existingPrompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found'
      });
    }

    // Delete prompt
    await db
      .delete(snapshotPrompts)
      .where(eq(snapshotPrompts.id, promptId));

    console.log(`✅ Admin deleted prompt: ID ${promptId}`);

    return res.status(200).json({
      success: true,
      message: 'Prompt deleted successfully'
    });

  } catch (error: any) {
    console.error('❌ Admin delete prompt error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to delete prompt',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/snapshot-prompts/:id/toggle-active
 * Toggle prompt active status
 * 
 * Params:
 * - id: number (prompt ID)
 */
router.post('/snapshot-prompts/:id/toggle-active', requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const promptId = parseInt(req.params.id);
    
    if (isNaN(promptId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prompt ID'
      });
    }

    // Check if prompt exists
    const existingPrompt = await db.query.snapshotPrompts.findFirst({
      where: eq(snapshotPrompts.id, promptId)
    });

    if (!existingPrompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found'
      });
    }

    // Toggle active status
    const [updatedPrompt] = await db
      .update(snapshotPrompts)
      .set({
        isActive: !existingPrompt.isActive,
        updatedAt: new Date()
      })
      .where(eq(snapshotPrompts.id, promptId))
      .returning();

    console.log(`✅ Admin toggled prompt active: ID ${promptId}, new status: ${updatedPrompt.isActive}`);

    return res.status(200).json({
      success: true,
      prompt: updatedPrompt,
      message: `Prompt ${updatedPrompt.isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error: any) {
    console.error('❌ Admin toggle prompt error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle prompt status',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/snapshot-prompts/stats
 * Get statistics about snapshot prompts
 */
router.get('/snapshot-prompts/stats', requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    // Total prompts
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(snapshotPrompts);
    const total = totalResult[0]?.count || 0;

    // Active prompts
    const activeResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(snapshotPrompts)
      .where(eq(snapshotPrompts.isActive, true));
    const active = activeResult[0]?.count || 0;

    // Prompts by category
    const byCategoryResult = await db
      .select({
        category: snapshotPrompts.category,
        count: sql<number>`count(*)::int`
      })
      .from(snapshotPrompts)
      .groupBy(snapshotPrompts.category);

    // Prompts by type
    const byTypeResult = await db
      .select({
        type: snapshotPrompts.type,
        count: sql<number>`count(*)::int`
      })
      .from(snapshotPrompts)
      .groupBy(snapshotPrompts.type);

    // Most used prompts
    const mostUsedResult = await db
      .select()
      .from(snapshotPrompts)
      .orderBy(desc(snapshotPrompts.usageCount))
      .limit(10);

    return res.status(200).json({
      success: true,
      stats: {
        total,
        active,
        inactive: total - active,
        byCategory: byCategoryResult,
        byType: byTypeResult,
        mostUsed: mostUsedResult
      }
    });

  } catch (error: any) {
    console.error('❌ Admin get stats error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

export default router;
