/**
 * Test file for snapshotPromptService
 * 
 * This file demonstrates the usage of the service and can be used for manual testing.
 * To run: tsx server/tests/snapshotPromptService.test.ts
 */

import { 
  getRandomSnapshotPrompt, 
  SnapshotPromptNotFoundError,
  type GetRandomSnapshotPromptInput 
} from "../services/snapshotPromptService";

async function testService() {
  console.log("🧪 Testing Snapshot Prompt Service\n");

  // Test 1: Valid request with all parameters
  console.log("Test 1: Valid request (mode=individual, style=mix, gender=female)");
  try {
    const result = await getRandomSnapshotPrompt({
      mode: "individual",
      style: "mix",
      gender: "female",
    });
    console.log("✅ Success:", result);
  } catch (error) {
    if (error instanceof SnapshotPromptNotFoundError) {
      console.log("⚠️  No prompts found (expected if database is empty):", error.message);
    } else {
      console.error("❌ Error:", error);
    }
  }
  console.log();

  // Test 2: Valid request without gender
  console.log("Test 2: Valid request without gender (mode=couple, style=daily)");
  try {
    const result = await getRandomSnapshotPrompt({
      mode: "couple",
      style: "daily",
    });
    console.log("✅ Success:", result);
  } catch (error) {
    if (error instanceof SnapshotPromptNotFoundError) {
      console.log("⚠️  No prompts found (expected if database is empty):", error.message);
    } else {
      console.error("❌ Error:", error);
    }
  }
  console.log();

  // Test 3: Invalid mode (should fail validation)
  console.log("Test 3: Invalid mode (should fail validation)");
  try {
    const result = await getRandomSnapshotPrompt({
      mode: "invalid" as any,
      style: "mix",
    });
    console.log("❌ Should have failed validation:", result);
  } catch (error: any) {
    if (error.name === "ZodError") {
      console.log("✅ Validation error (expected):", error.errors[0].message);
    } else {
      console.error("❌ Unexpected error:", error);
    }
  }
  console.log();

  // Test 4: Invalid style (should fail validation)
  console.log("Test 4: Invalid style (should fail validation)");
  try {
    const result = await getRandomSnapshotPrompt({
      mode: "family",
      style: "invalid" as any,
    });
    console.log("❌ Should have failed validation:", result);
  } catch (error: any) {
    if (error.name === "ZodError") {
      console.log("✅ Validation error (expected):", error.errors[0].message);
    } else {
      console.error("❌ Unexpected error:", error);
    }
  }
  console.log();

  // Test 5: Multiple calls to test weighted selection (if data exists)
  console.log("Test 5: Multiple calls to test weighted selection");
  try {
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = await getRandomSnapshotPrompt({
        mode: "individual",
        style: "travel",
      });
      results.push(result.id);
      console.log(`  Call ${i + 1}: Prompt ID ${result.id}`);
    }
    console.log("✅ Successfully made multiple calls");
    console.log("  Note: Lower usage count prompts should appear more frequently");
  } catch (error) {
    if (error instanceof SnapshotPromptNotFoundError) {
      console.log("⚠️  No prompts found (expected if database is empty):", error.message);
    } else {
      console.error("❌ Error:", error);
    }
  }
  console.log();

  console.log("🎉 Test suite completed\n");
  console.log("Note: Some tests may show 'No prompts found' if the database is empty.");
  console.log("Add prompts via the admin API to see the weighted selection in action.");
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testService()
    .then(() => {
      console.log("\n✅ All tests completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Test suite failed:", error);
      process.exit(1);
    });
}
