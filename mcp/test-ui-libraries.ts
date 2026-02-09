/**
 * Test script for UI Libraries MCP Server
 */

import { getMCPClient, closeMCPClient, getUILibraryContext } from "../lib/mcp-client";

async function test() {
  console.log("🧪 Testing UI Libraries MCP Server...\n");

  try {
    // Get MCP client
    const client = await getMCPClient();
    console.log("✅ Connected to MCP server\n");

    // Test 1: List all libraries
    console.log("📚 Test 1: Listing all UI libraries...");
    const libraries = await client.listLibraries();
    console.log(`Found ${libraries.length} libraries:\n`);
    libraries.forEach(lib => {
      console.log(`  📦 ${lib.name}`);
      console.log(`     Package: ${lib.package}`);
      console.log(`     Components: ${lib.componentCount}`);
      console.log(`     Available: ${lib.components.join(", ")}\n`);
    });

    // Test 2: Get specific component
    console.log("\n🔍 Test 2: Getting FadeIn component from Framer Motion...");
    const fadeIn = await client.getComponent("framerMotion", "FadeIn");
    if (fadeIn) {
      console.log(`  ✅ ${fadeIn.name}`);
      console.log(`     Library: ${fadeIn.library}`);
      console.log(`     Description: ${fadeIn.description}`);
      console.log(`     Installation: ${fadeIn.installation}`);
      console.log(`     Dependencies:`, fadeIn.dependencies);
      console.log(`     Examples:`, fadeIn.examples);
    }

    // Test 3: Search components
    console.log("\n🔎 Test 3: Searching for 'animation' components...");
    const animationComponents = await client.searchComponents("animation");
    console.log(`Found ${animationComponents.length} results:\n`);
    animationComponents.forEach(comp => {
      console.log(`  🎨 ${comp.name} (${comp.library})`);
      console.log(`     ${comp.description}\n`);
    });

    // Test 4: Get library info
    console.log("\n📖 Test 4: Getting Framer Motion library info...");
    const libInfo = await client.getLibraryInfo("framerMotion");
    if (libInfo) {
      console.log(`  ✅ ${libInfo.name}`);
      console.log(`     Package: ${libInfo.package}`);
      console.log(`     Description: ${libInfo.description}`);
      console.log(`     Total components: ${libInfo.componentCount}`);
    }

    // Test 5: Get UI library context for a prompt
    console.log("\n🎯 Test 5: Getting UI library context for a prompt...");
    const prompt = "Create a modern landing page with smooth animations and gradient effects";
    const context = await getUILibraryContext(prompt);
    console.log("Context length:", context.length, "characters");
    console.log("\nContext preview:\n", context.substring(0, 500) + "...");

    console.log("\n\n✅ All tests passed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    // Clean up
    await closeMCPClient();
    console.log("\n🔌 Disconnected from MCP server");
  }
}

test().catch(console.error);
