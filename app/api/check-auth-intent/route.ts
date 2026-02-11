import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-3-flash-preview";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ hasAuthIntent: false });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ hasAuthIntent: false });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        maxOutputTokens: 10,
        temperature: 0,
      },
    });

    const result = await model.generateContent(
      `You are a prompt classifier. Analyze this user prompt and determine if they are asking for ANY kind of authentication, login, signup, user accounts, registration, session management, user profiles with login, protected/private routes, OAuth, or password system.

Reply with ONLY "yes" or "no".

Prompt: "${prompt.replace(/"/g, '\\"').slice(0, 500)}"`
    );

    const answer = result.response.text().trim().toLowerCase();
    const hasAuthIntent = answer.startsWith("yes");

    return NextResponse.json({ hasAuthIntent });
  } catch {
    // On error, don't block — let them proceed
    return NextResponse.json({ hasAuthIntent: false });
  }
}
