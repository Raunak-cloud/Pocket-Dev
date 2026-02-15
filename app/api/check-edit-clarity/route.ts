import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-3-flash-preview";

type ClarityResult = {
  needsClarification: boolean;
  question: string;
};

function fallbackResult(): ClarityResult {
  return { needsClarification: false, question: "" };
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, filePaths } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(fallbackResult());
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(fallbackResult());
    }

    const safePrompt = prompt.replace(/"/g, '\\"').slice(0, 2000);
    const filesSummary = Array.isArray(filePaths)
      ? filePaths.slice(0, 120).join(", ")
      : "";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(`
You are checking if a user edit request is clear enough to implement immediately.
Given the prompt and project file list, return JSON only:
{
  "needsClarification": boolean,
  "question": string
}

Rules:
- needsClarification=true only when required details are missing or ambiguous enough to risk wrong edits.
- Ask only one concise question when clarification is needed.
- If the prompt is clear enough, set needsClarification=false and question="".
- Do not ask for unnecessary details.

Prompt: "${safePrompt}"
Project files: "${filesSummary}"
`);

    const text = result.response.text().trim();
    const parsed = JSON.parse(text) as Partial<ClarityResult>;

    return NextResponse.json({
      needsClarification: parsed.needsClarification === true,
      question:
        typeof parsed.question === "string" ? parsed.question.slice(0, 300) : "",
    });
  } catch {
    // Fail open so edits are not blocked by classifier errors.
    return NextResponse.json(fallbackResult());
  }
}
