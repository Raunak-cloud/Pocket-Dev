/**
 * MCP Client for communicating with UI Libraries MCP Server
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface UIComponent {
  name: string;
  library: string;
  description: string;
  installation: string;
  dependencies: Record<string, string>;
  usage: string;
  examples: string[];
}

export interface UILibrary {
  id: string;
  name: string;
  package: string;
  description: string;
  componentCount: number;
  components: string[];
}

class MCPUILibrariesClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Path to the MCP server
      const serverPath = path.join(__dirname, "..", "mcp", "ui-libraries-server.ts");

      // Spawn the server process using tsx
      const serverProcess = spawn("npx", ["tsx", serverPath], {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      // Create transport
      this.transport = new StdioClientTransport({
        command: "npx",
        args: ["tsx", serverPath],
      });

      // Create client
      this.client = new Client(
        {
          name: "ui-libraries-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // Connect
      await this.client.connect(this.transport);
      this.isConnected = true;

      console.log("✅ Connected to UI Libraries MCP Server");
    } catch (error) {
      console.error("❌ Failed to connect to MCP server:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      this.client = null;
      this.transport = null;
    }
  }

  async listLibraries(): Promise<UILibrary[]> {
    if (!this.client || !this.isConnected) {
      throw new Error("MCP client not connected. Call connect() first.");
    }

    try {
      const result = await this.client.callTool({
        name: "list_ui_libraries",
        arguments: {},
      });

      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const firstContent = result.content[0] as any;
        if (firstContent && firstContent.type === "text") {
          return JSON.parse(firstContent.text);
        }
      }

      return [];
    } catch (error) {
      console.error("Error listing libraries:", error);
      return [];
    }
  }

  async getComponent(
    library: string,
    componentName: string
  ): Promise<UIComponent | null> {
    if (!this.client || !this.isConnected) {
      throw new Error("MCP client not connected. Call connect() first.");
    }

    try {
      const result = await this.client.callTool({
        name: "get_component",
        arguments: { library, componentName },
      });

      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const firstContent = result.content[0] as any;
        if (firstContent && firstContent.type === "text") {
          return JSON.parse(firstContent.text);
        }
      }

      return null;
    } catch (error) {
      console.error(`Error getting component ${componentName}:`, error);
      return null;
    }
  }

  async searchComponents(query: string): Promise<any[]> {
    if (!this.client || !this.isConnected) {
      throw new Error("MCP client not connected. Call connect() first.");
    }

    try {
      const result = await this.client.callTool({
        name: "search_components",
        arguments: { query },
      });

      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const firstContent = result.content[0] as any;
        if (firstContent && firstContent.type === "text") {
          const data = JSON.parse(firstContent.text);
          return data.results || [];
        }
      }

      return [];
    } catch (error) {
      console.error(`Error searching components with query "${query}":`, error);
      return [];
    }
  }

  async getLibraryInfo(library: string): Promise<any | null> {
    if (!this.client || !this.isConnected) {
      throw new Error("MCP client not connected. Call connect() first.");
    }

    try {
      const result = await this.client.callTool({
        name: "get_library_info",
        arguments: { library },
      });

      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const firstContent = result.content[0] as any;
        if (firstContent && firstContent.type === "text") {
          return JSON.parse(firstContent.text);
        }
      }

      return null;
    } catch (error) {
      console.error(`Error getting library info for ${library}:`, error);
      return null;
    }
  }
}

// Singleton instance
let mcpClient: MCPUILibrariesClient | null = null;

export async function getMCPClient(): Promise<MCPUILibrariesClient> {
  if (!mcpClient) {
    mcpClient = new MCPUILibrariesClient();
    await mcpClient.connect();
  }
  return mcpClient;
}

export async function closeMCPClient(): Promise<void> {
  if (mcpClient) {
    await mcpClient.disconnect();
    mcpClient = null;
  }
}

/**
 * Helper function to get UI library context for AI prompt
 */
export async function getUILibraryContext(prompt: string): Promise<string> {
  try {
    const client = await getMCPClient();

    // Get all available libraries
    const libraries = await client.listLibraries();

    // Search for relevant components based on prompt keywords
    const keywords = extractKeywords(prompt);
    let relevantComponents: any[] = [];

    for (const keyword of keywords) {
      const results = await client.searchComponents(keyword);
      relevantComponents = [...relevantComponents, ...results];
    }

    // Remove duplicates
    relevantComponents = Array.from(
      new Map(relevantComponents.map(c => [c.name, c])).values()
    );

    // Limit to top 10 most relevant
    relevantComponents = relevantComponents.slice(0, 10);

    // Build context string
    let context = "\n\n═══════════════════════════════════════════════════════════════\n";
    context += "🎨 AVAILABLE MODERN UI LIBRARIES & COMPONENTS (via MCP)\n";
    context += "═══════════════════════════════════════════════════════════════\n\n";

    context += "You have access to these modern UI libraries via MCP:\n\n";

    for (const lib of libraries) {
      context += `📦 ${lib.name} (${lib.package})\n`;
      context += `   ${lib.description}\n`;
      context += `   Components: ${lib.components.join(", ")}\n\n`;
    }

    if (relevantComponents.length > 0) {
      context += "\n🎯 RELEVANT COMPONENTS FOR THIS REQUEST:\n\n";

      for (const comp of relevantComponents) {
        context += `\n🔹 ${comp.name} (${comp.library})\n`;
        context += `   ${comp.description}\n`;
        context += `   Usage preview:\n${comp.usage}\n`;
      }

      context += "\n\n💡 HOW TO USE THESE COMPONENTS:\n";
      context += "1. When relevant to the request, USE these modern components\n";
      context += "2. Add the required dependencies to package.json\n";
      context += "3. Import and use the components as shown in the usage examples\n";
      context += "4. Combine multiple components for rich, modern UIs\n";
      context += "5. Framer Motion is excellent for animations - use it liberally!\n\n";

      context += "🚨 REQUIREMENTS:\n";
      context += "- Prefer using these modern components over basic HTML/CSS\n";
      context += "- Add ALL required dependencies to package.json\n";
      context += "- Follow the exact usage patterns shown above\n";
      context += "- Create smooth, professional animations with Framer Motion\n";
      context += "- Use Shadcn/UI for accessible, beautiful base components\n";
      context += "- Combine Aceternity/Magic UI for unique, eye-catching effects\n\n";
    }

    context += "═══════════════════════════════════════════════════════════════\n\n";

    return context;
  } catch (error) {
    console.error("Error getting UI library context:", error);
    return "";
  }
}

/**
 * Extract keywords from prompt for component search
 */
function extractKeywords(prompt: string): string[] {
  const keywords = new Set<string>();

  // Animation-related keywords
  if (/animat|motion|fade|slide|scale|parallax|scroll|transition/i.test(prompt)) {
    keywords.add("animation");
    keywords.add("motion");
  }

  // UI component keywords
  if (/button|btn|cta|click/i.test(prompt)) {
    keywords.add("button");
  }

  if (/card|box|container/i.test(prompt)) {
    keywords.add("card");
  }

  if (/grid|layout|bento/i.test(prompt)) {
    keywords.add("grid");
  }

  if (/text|heading|title|type/i.test(prompt)) {
    keywords.add("text");
  }

  if (/gradient|shimmer|glow|effect/i.test(prompt)) {
    keywords.add("gradient");
    keywords.add("shimmer");
  }

  // Default searches
  if (keywords.size === 0) {
    keywords.add("animation");
    keywords.add("button");
    keywords.add("card");
  }

  return Array.from(keywords);
}

/**
 * Merge MCP-discovered dependencies with existing dependencies
 */
export function mergeDependencies(
  existing: Record<string, string>,
  components: UIComponent[]
): Record<string, string> {
  const merged = { ...existing };

  for (const component of components) {
    Object.entries(component.dependencies).forEach(([pkg, version]) => {
      if (!merged[pkg]) {
        merged[pkg] = version;
      }
    });
  }

  return merged;
}
