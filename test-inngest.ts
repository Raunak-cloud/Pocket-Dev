/**
 * Quick Test Script for Inngest Integration
 *
 * Run this to manually test if Inngest is working:
 * npx tsx test-inngest.ts
 */

import { inngest } from "./lib/inngest-client";

async function testInngest() {
  console.log("🚀 Sending test event to Inngest...\n");

  try {
    const result = await inngest.send({
      name: "app/generate.code",
      data: {
        prompt: "Create a simple hello world page",
        userId: "test-user-123",
        projectId: "test-proj-456",
      },
    });

    console.log("✅ Event sent successfully!");
    console.log("📊 Result:", result);
    console.log("\n🔍 Check the Inngest UI at http://localhost:8288");
    console.log("   You should see a new run in the 'Runs' tab!");
  } catch (error) {
    console.error("❌ Error sending event:", error);
  }
}

testInngest();
