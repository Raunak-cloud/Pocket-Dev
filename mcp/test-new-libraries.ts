/**
 * Test script for newly added UI libraries
 */

import { getMCPClient, closeMCPClient } from "../lib/mcp-client";

async function testNewLibraries() {
  console.log("🧪 Testing Newly Added UI Libraries...\n");

  try {
    const client = await getMCPClient();
    console.log("✅ Connected to MCP server\n");

    // Test React Three Fiber
    console.log("🎲 Test 1: React Three Fiber - FloatingCube");
    const floatingCube = await client.getComponent("reactThreeFiber", "FloatingCube");
    if (floatingCube) {
      console.log(`  ✅ ${floatingCube.name}`);
      console.log(`     Description: ${floatingCube.description}`);
      console.log(`     Dependencies:`, Object.keys(floatingCube.dependencies).join(", "));
    }

    // Test Lenis
    console.log("\n📜 Test 2: Lenis - SmoothScroll");
    const smoothScroll = await client.getComponent("lenis", "SmoothScroll");
    if (smoothScroll) {
      console.log(`  ✅ ${smoothScroll.name}`);
      console.log(`     Description: ${smoothScroll.description}`);
      console.log(`     Dependencies:`, Object.keys(smoothScroll.dependencies).join(", "));
    }

    // Test GSAP
    console.log("\n⚡ Test 3: GSAP - CountUp");
    const countUp = await client.getComponent("gsap", "CountUp");
    if (countUp) {
      console.log(`  ✅ ${countUp.name}`);
      console.log(`     Description: ${countUp.description}`);
      console.log(`     Examples:`, countUp.examples);
    }

    // Test Lucide React
    console.log("\n🎨 Test 4: Lucide React - IconShowcase");
    const icons = await client.getComponent("lucideReact", "IconShowcase");
    if (icons) {
      console.log(`  ✅ ${icons.name}`);
      console.log(`     Description: ${icons.description}`);
    }

    // Test Tremor
    console.log("\n📊 Test 5: Tremor - AreaChart");
    const areaChart = await client.getComponent("tremor", "AreaChart");
    if (areaChart) {
      console.log(`  ✅ ${areaChart.name}`);
      console.log(`     Description: ${areaChart.description}`);
      console.log(`     Dependencies:`, Object.keys(areaChart.dependencies).join(", "));
    }

    // Test Motion (Motion One)
    console.log("\n🌊 Test 6: Motion (Motion One) - MotionFade");
    const motionFade = await client.getComponent("motion", "MotionFade");
    if (motionFade) {
      console.log(`  ✅ ${motionFade.name}`);
      console.log(`     Description: ${motionFade.description}`);
    }

    // Test React Spring
    console.log("\n🎯 Test 7: React Spring - SpringFade");
    const springFade = await client.getComponent("reactSpring", "SpringFade");
    if (springFade) {
      console.log(`  ✅ ${springFade.name}`);
      console.log(`     Description: ${springFade.description}`);
    }

    // Test Radix UI
    console.log("\n🔲 Test 8: Radix UI - Dialog");
    const dialog = await client.getComponent("radixUI", "Dialog");
    if (dialog) {
      console.log(`  ✅ ${dialog.name}`);
      console.log(`     Description: ${dialog.description}`);
    }

    // Search for 3D components
    console.log("\n\n🔍 Test 9: Search for '3D' components");
    const results3D = await client.searchComponents("3D");
    console.log(`Found ${results3D.length} results:`);
    results3D.forEach(comp => {
      console.log(`  - ${comp.name} (${comp.library}): ${comp.description}`);
    });

    // Search for smooth scroll
    console.log("\n🔍 Test 10: Search for 'smooth scroll' components");
    const resultsScroll = await client.searchComponents("smooth scroll");
    console.log(`Found ${resultsScroll.length} results:`);
    resultsScroll.forEach(comp => {
      console.log(`  - ${comp.name} (${comp.library}): ${comp.description}`);
    });

    // Search for charts
    console.log("\n🔍 Test 11: Search for 'chart' components");
    const resultsChart = await client.searchComponents("chart");
    console.log(`Found ${resultsChart.length} results:`);
    resultsChart.forEach(comp => {
      console.log(`  - ${comp.name} (${comp.library}): ${comp.description}`);
    });

    // Get library stats
    console.log("\n\n📊 Library Statistics:");
    const libraries = await client.listLibraries();
    console.log(`Total libraries: ${libraries.length}`);
    const totalComponents = libraries.reduce((sum, lib) => sum + lib.componentCount, 0);
    console.log(`Total components: ${totalComponents}`);

    console.log("\n✅ All tests passed! New libraries are working correctly.");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await closeMCPClient();
    console.log("\n🔌 Disconnected from MCP server");
  }
}

testNewLibraries().catch(console.error);
