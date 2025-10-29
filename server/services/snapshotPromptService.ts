import { z } from "zod";
import { db } from "@db";
import { snapshotPrompts } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

/**
 * Custom error class for when no snapshot prompts match the given filters
 */
export class SnapshotPromptNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotPromptNotFoundError";
  }
}

/**
 * Input validation schema for getRandomSnapshotPrompt
 */
const getRandomSnapshotPromptSchema = z.object({
  mode: z.enum(["individual", "couple", "family"], {
    errorMap: () => ({ message: "Mode must be one of: individual, couple, family" }),
  }),
  style: z.enum(["mix", "daily", "travel", "film"], {
    errorMap: () => ({ message: "Style must be one of: mix, daily, travel, film" }),
  }),
  gender: z.enum(["female", "male", "unisex"]).optional(),
});

export type GetRandomSnapshotPromptInput = z.infer<typeof getRandomSnapshotPromptSchema>;

export type SnapshotPromptResult = {
  id: number;
  text: string;
  type: string;
  category: string;
};

/**
 * Weighted random selection algorithm
 * Selects a prompt based on inverse usage count (lower usage = higher probability)
 * 
 * @param prompts Array of prompts with usageCount
 * @returns Selected prompt
 */
function selectWeightedRandom<T extends { usageCount: number }>(prompts: T[]): T {
  if (prompts.length === 0) {
    throw new Error("Cannot select from empty array");
  }

  if (prompts.length === 1) {
    return prompts[0];
  }

  // Calculate weights: weight = 1 / (usageCount + 1)
  const weights = prompts.map(prompt => 1 / (prompt.usageCount + 1));
  
  // Calculate cumulative weights
  const cumulativeWeights: number[] = [];
  let totalWeight = 0;
  
  for (let i = 0; i < weights.length; i++) {
    totalWeight += weights[i];
    cumulativeWeights[i] = totalWeight;
  }
  
  // Generate random number between 0 and totalWeight
  const random = Math.random() * totalWeight;
  
  // Find the selected prompt using linear scan
  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (random <= cumulativeWeights[i]) {
      return prompts[i];
    }
  }
  
  // Fallback to last item (should never reach here due to floating point)
  return prompts[prompts.length - 1];
}

/**
 * Get a random snapshot prompt using weighted selection based on usage count
 * 
 * This function:
 * 1. Validates input parameters
 * 2. Queries active prompts matching filters
 * 3. Uses weighted random selection (lower usage count = higher probability)
 * 4. Atomically increments usage count using database transaction with row locking
 * 
 * @param params - Filter parameters (mode, style, gender)
 * @returns Selected prompt with id, text, type, and category
 * @throws {SnapshotPromptNotFoundError} When no prompts match the filters
 * @throws {z.ZodError} When input validation fails
 */
export async function getRandomSnapshotPrompt(
  params: GetRandomSnapshotPromptInput
): Promise<SnapshotPromptResult> {
  // Validate input
  const validatedParams = getRandomSnapshotPromptSchema.parse(params);
  const { mode, style, gender } = validatedParams;

  console.log(`🎯 Getting random snapshot prompt: mode=${mode}, style=${style}, gender=${gender || 'any'}`);

  // Build filter conditions
  const baseConditions = [
    eq(snapshotPrompts.isActive, true),
    eq(snapshotPrompts.type, mode),
    eq(snapshotPrompts.category, style),
  ];

  // Add gender filter if specified
  const genderConditions = gender 
    ? [...baseConditions, inArray(snapshotPrompts.gender, [gender, "unisex"])]
    : baseConditions;

  // Query matching prompts
  let matchingPrompts = await db.query.snapshotPrompts.findMany({
    where: and(...genderConditions),
    columns: {
      id: true,
      text: true,
      type: true,
      category: true,
      usageCount: true,
    },
  });

  // Fallback: If no prompts found and gender was specified, try with only unisex
  if (matchingPrompts.length === 0 && gender) {
    console.warn(`⚠️ No prompts found for gender=${gender}, falling back to unisex only`);
    
    const fallbackConditions = [
      ...baseConditions,
      eq(snapshotPrompts.gender, "unisex"),
    ];

    matchingPrompts = await db.query.snapshotPrompts.findMany({
      where: and(...fallbackConditions),
      columns: {
        id: true,
        text: true,
        type: true,
        category: true,
        usageCount: true,
      },
    });
  }

  // If still no prompts found, throw error
  if (matchingPrompts.length === 0) {
    throw new SnapshotPromptNotFoundError(
      `No active prompts found for mode=${mode}, style=${style}, gender=${gender || 'any'}`
    );
  }

  console.log(`✅ Found ${matchingPrompts.length} matching prompts`);

  // Select prompt using weighted random algorithm
  const selectedPrompt = selectWeightedRandom(matchingPrompts);

  console.log(`🎲 Selected prompt ID ${selectedPrompt.id} (usageCount: ${selectedPrompt.usageCount})`);

  // Use transaction to atomically increment usage count with row locking
  const result = await db.transaction(async (tx) => {
    // Lock the selected row with FOR UPDATE to prevent race conditions
    const lockResult = await tx.execute<{
      id: number;
      text: string;
      type: string;
      category: string;
      usage_count: number;
    }>(sql`
      SELECT id, text, type, category, usage_count
      FROM snapshot_prompts
      WHERE id = ${selectedPrompt.id}
      FOR UPDATE
    `);

    const lockedPrompt = lockResult.rows[0];

    if (!lockedPrompt) {
      throw new Error(`Failed to lock prompt with ID ${selectedPrompt.id}`);
    }

    // Increment usage count
    await tx.execute(sql`
      UPDATE snapshot_prompts
      SET 
        usage_count = usage_count + 1,
        updated_at = NOW()
      WHERE id = ${selectedPrompt.id}
    `);

    return {
      id: lockedPrompt.id,
      text: lockedPrompt.text,
      type: lockedPrompt.type,
      category: lockedPrompt.category,
    };
  });

  console.log(`✅ Successfully selected and updated prompt ID ${result.id}`);

  return result;
}
