// app/actions.ts
"use server";

import "server-only";

import { pinecone } from "@/lib/pinecone";
import { generateEmbedding } from "@/lib/embedder";

export interface SearchResult {
  id: string;
  score: number;
  text: string;
  category?: string;
  author?: string;
  templateType?: "business" | "ecommerce";
  htmlContent?: string;
  features?: string;
}

export async function searchVectorDB(query: string, topK: number = 5) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Query Pinecone
    const index = pinecone.index("documents");
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    // Format results
    const results: SearchResult[] = queryResponse.matches.map((match) => ({
      id: match.id,
      score: match.score || 0,
      text: (match.metadata?.text as string) || "",
      category: match.metadata?.category as string,
      author: match.metadata?.author as string,
      templateType: match.metadata?.templateType as "business" | "ecommerce",
      htmlContent: match.metadata?.htmlContent as string,
      features: match.metadata?.features as string,
    }));

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error("Search Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to search vector database",
    };
  }
}

export async function generateWebsiteTemplate(query: string) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Query Pinecone with template filter
    const index = pinecone.index("documents");
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 1,
      includeMetadata: true,
      filter: {
        category: "template",
      },
    });

    // Check if we have a match
    const bestMatch = queryResponse.matches[0];
    if (!bestMatch || !bestMatch.score || bestMatch.score < 0.5) {
      return {
        success: false,
        error:
          "No matching website template found. Try: 'generate business website' or 'create ecommerce store'",
      };
    }

    // Return the template data
    const result: SearchResult = {
      id: bestMatch.id,
      score: bestMatch.score,
      text: (bestMatch.metadata?.text as string) || "",
      category: bestMatch.metadata?.category as string,
      author: bestMatch.metadata?.author as string,
      templateType: bestMatch.metadata?.templateType as "business" | "ecommerce",
      htmlContent: bestMatch.metadata?.htmlContent as string,
      features: bestMatch.metadata?.features as string,
    };

    return {
      success: true,
      data: [result],
    };
  } catch (error) {
    console.error("Template Generation Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate website template",
    };
  }
}
