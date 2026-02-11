/**
 * AI client using Gemini Flash 3 exclusively
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  onProgress?: (text: string) => void;
}

const MODEL = "gemini-3-flash-preview";

/**
 * Generate text using Gemini Flash 3
 */
export async function generateWithClaude(
  options: GenerateOptions
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY not found in environment variables. " +
      "Please add it to your .env.local file. " +
      "Get your API key from https://aistudio.google.com/app/apikey"
    );
  }

  const client = new GoogleGenerativeAI(apiKey);
  const { systemPrompt, userPrompt, maxTokens = 64000, onProgress } = options;

  console.log(`✅ Using Gemini Flash 3 for generation`);

  // Gemini combines system and user prompts
  const combinedPrompt = `${systemPrompt}\n\nUser Request: ${userPrompt}`;

  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  });

  const result = await model.generateContentStream({
    contents: [{ role: "user", parts: [{ text: combinedPrompt }] }],
  });

  let fullText = "";
  for await (const chunk of result.stream) {
    const text = chunk.text();
    fullText += text;
    if (onProgress) {
      onProgress(text);
    }
  }

  console.log("✅ Generation completed successfully");
  return fullText;
}
