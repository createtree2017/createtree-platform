# Snapshot Prompt Service - Phase 1-2 Implementation

## Overview
This service provides weighted random selection of snapshot prompts with transaction safety and race condition prevention.

## File: `server/services/snapshotPromptService.ts`

### Features Implemented

#### 1. ✅ Custom Error Handling
- `SnapshotPromptNotFoundError` - Thrown when no prompts match the given filters

#### 2. ✅ Input Validation (Zod)
```typescript
{
  mode: "individual" | "couple" | "family",
  style: "mix" | "daily" | "travel" | "film",
  gender?: "female" | "male" | "unisex"
}
```

#### 3. ✅ Weighted Random Selection Algorithm
- Weight calculation: `weight = 1 / (usageCount + 1)`
- Lower usage count = higher selection probability
- Uses cumulative weights for fair distribution

#### 4. ✅ Database Transaction with Row Locking
- Uses `db.transaction()` for atomicity
- `FOR UPDATE` clause prevents race conditions
- Atomically increments `usageCount`

#### 5. ✅ Edge Case Handling
- Falls back to unisex-only when gender-specific prompts not found
- Logs warnings when fallback occurs
- Clear error messages when no prompts match

#### 6. ✅ Comprehensive Logging
- Logs filter parameters
- Logs number of matching prompts
- Logs selected prompt ID and usage count
- Logs fallback warnings

## Usage Example

```typescript
import { getRandomSnapshotPrompt, SnapshotPromptNotFoundError } from "./services/snapshotPromptService";

try {
  const prompt = await getRandomSnapshotPrompt({
    mode: "individual",
    style: "mix",
    gender: "female"
  });
  
  console.log(prompt);
  // { id: 123, text: "...", type: "individual", category: "mix" }
} catch (error) {
  if (error instanceof SnapshotPromptNotFoundError) {
    console.error("No prompts available:", error.message);
  } else {
    throw error;
  }
}
```

## Return Type

```typescript
{
  id: number;        // Prompt ID
  text: string;      // Prompt text
  type: string;      // individual/couple/family
  category: string;  // mix/daily/travel/film
}
```

## Database Filters Applied

1. `isActive = true` - Only active prompts
2. `type = mode` - Matches requested mode
3. `category = style` - Matches requested style
4. `gender IN [requested, 'unisex']` - Matches gender or unisex (optional)

## Concurrency Safety

The service uses database transactions with row-level locking to ensure:
- No race conditions when multiple requests select the same prompt
- Usage count is always incremented atomically
- One transaction waits for another to complete before accessing the same row

## Testing

Run the test file to verify functionality:
```bash
tsx server/tests/snapshotPromptService.test.ts
```

## Success Criteria Met

✅ Service function handles all valid mode/style/gender combinations  
✅ Weighted random selection works (lower usageCount = higher probability)  
✅ Transaction prevents race conditions under concurrent calls  
✅ Custom error thrown when no prompts match  
✅ Input validation rejects invalid parameters  
✅ Zero LSP errors  

## Integration Notes

- Compatible with existing admin API endpoints in `server/routes/admin-snapshot.ts`
- Uses standard Drizzle ORM patterns
- No modifications to `shared/schema.ts` required
- Ready for integration into snapshot generation workflow
