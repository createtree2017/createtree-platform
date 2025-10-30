import { db } from '@db';
import { snapshotPrompts, type SnapshotPrompt } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Custom error class for snapshot prompt selection errors
 */
export class SnapshotPromptSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotPromptSelectionError';
  }
}

/**
 * Parameters for selecting weighted prompts
 */
export interface PromptSelectionParams {
  category: 'individual' | 'couple' | 'family';
  type: 'mix' | 'daily' | 'travel' | 'film';
  gender?: 'male' | 'female' | null;
  count?: number; // Number of prompts to select (default: 5)
}

/**
 * Select prompts using weighted random selection based on usage count
 * Algorithm: weight = 1 / (usageCount + 1)
 * Lower usage count = higher probability of selection
 * 
 * @param params - Selection parameters
 * @returns Array of selected prompts
 */
export async function selectWeightedPrompts(
  params: PromptSelectionParams
): Promise<SnapshotPrompt[]> {
  const { category, type, gender, count = 5 } = params;

  return await db.transaction(async (tx) => {
    // Build where conditions
    let whereConditions = and(
      eq(snapshotPrompts.category, category),
      eq(snapshotPrompts.type, type),
      eq(snapshotPrompts.isActive, true)
    );

    // Add gender filter if provided
    if (gender) {
      whereConditions = and(
        whereConditions,
        eq(snapshotPrompts.gender, gender)
      );
    }

    // Query prompts with FOR UPDATE lock to prevent race conditions
    let prompts = await tx
      .select()
      .from(snapshotPrompts)
      .where(whereConditions)
      .for('update');

    // Fallback: If no prompts found with gender filter, try without gender
    if (prompts.length === 0 && gender) {
      console.log(`No prompts found for gender=${gender}, falling back to all genders`);
      
      const fallbackConditions = and(
        eq(snapshotPrompts.category, category),
        eq(snapshotPrompts.type, type),
        eq(snapshotPrompts.isActive, true)
      );

      prompts = await tx
        .select()
        .from(snapshotPrompts)
        .where(fallbackConditions)
        .for('update');
    }

    // Error if no prompts available
    if (prompts.length === 0) {
      throw new SnapshotPromptSelectionError(
        `No active prompts found for category=${category}, type=${type}${gender ? `, gender=${gender}` : ''}`
      );
    }

    // Error if not enough prompts for requested count
    if (prompts.length < count) {
      throw new SnapshotPromptSelectionError(
        `Not enough prompts available. Requested: ${count}, Available: ${prompts.length}`
      );
    }

    // Calculate weights: weight = 1 / (usageCount + 1)
    const weights = prompts.map(p => 1 / (p.usageCount + 1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Select multiple unique prompts using weighted random selection
    const selectedPrompts: SnapshotPrompt[] = [];
    const selectedIndices = new Set<number>();

    for (let i = 0; i < count; i++) {
      // Calculate available weights (excluding already selected)
      const availableWeights = weights.map((w, idx) => 
        selectedIndices.has(idx) ? 0 : w
      );
      const availableTotalWeight = availableWeights.reduce((sum, w) => sum + w, 0);

      // Weighted random selection
      let random = Math.random() * availableTotalWeight;
      let selectedIndex = 0;

      for (let j = 0; j < prompts.length; j++) {
        if (selectedIndices.has(j)) continue;
        
        random -= availableWeights[j];
        if (random <= 0) {
          selectedIndex = j;
          break;
        }
      }

      selectedIndices.add(selectedIndex);
      selectedPrompts.push(prompts[selectedIndex]);

      // Increment usage count for selected prompt
      await tx
        .update(snapshotPrompts)
        .set({
          usageCount: sql`${snapshotPrompts.usageCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(snapshotPrompts.id, prompts[selectedIndex].id));
    }

    return selectedPrompts;
  });
}

/**
 * Get prompt statistics by category and type
 */
export async function getPromptStats(
  category?: 'individual' | 'couple' | 'family',
  type?: 'mix' | 'daily' | 'travel' | 'film'
) {
  const conditions = [eq(snapshotPrompts.isActive, true)];

  if (category) {
    conditions.push(eq(snapshotPrompts.category, category));
  }

  if (type) {
    conditions.push(eq(snapshotPrompts.type, type));
  }

  const prompts = await db
    .select()
    .from(snapshotPrompts)
    .where(and(...conditions));

  const totalUsage = prompts.reduce((sum, p) => sum + p.usageCount, 0);
  const avgUsage = prompts.length > 0 ? totalUsage / prompts.length : 0;

  return {
    totalPrompts: prompts.length,
    totalUsage,
    avgUsage: Math.round(avgUsage * 100) / 100,
    prompts: prompts.map(p => ({
      id: p.id,
      category: p.category,
      type: p.type,
      gender: p.gender,
      usageCount: p.usageCount,
      prompt: p.prompt.substring(0, 50) + '...'
    }))
  };
}
