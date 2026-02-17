import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-3-flash-preview";

type ClarityResult = {
  needsClarification: boolean;
  question: string;
  suggestedInterpretation: string;
};

function fallbackResult(): ClarityResult {
  return {
    needsClarification: false,
    question: "",
    suggestedInterpretation: "",
  };
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, filePaths, clarificationHistory } = await req.json();

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
    const safeHistory =
      Array.isArray(clarificationHistory) && clarificationHistory.length > 0
        ? clarificationHistory
            .slice(0, 8)
            .map((entry) => {
              if (
                entry &&
                typeof entry === "object" &&
                typeof entry.question === "string" &&
                typeof entry.answer === "string"
              ) {
                return `Q: ${entry.question.slice(0, 220)} | A: ${entry.answer.slice(0, 220)}`;
              }
              return "";
            })
            .filter(Boolean)
            .join("\n")
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
  "question": string,
  "suggestedInterpretation": string
}

Rules:
- needsClarification=true only when required details are missing or ambiguous enough to risk wrong edits.
- Ask only one concise question when clarification is needed.
- When needsClarification=true, provide a concrete "did you mean" style suggestion in suggestedInterpretation.
- If the prompt is clear enough, set needsClarification=false and question="" and suggestedInterpretation="".
- Do not ask for unnecessary details.

Prompt: "${safePrompt}"
Project files: "${filesSummary}"
Previous clarification history:
${safeHistory || "(none)"}
`);

    const text = result.response.text().trim();
    const parsed = JSON.parse(text) as Partial<ClarityResult>;

    return NextResponse.json({
      needsClarification: parsed.needsClarification === true,
      question:
        typeof parsed.question === "string" ? parsed.question.slice(0, 300) : "",
      suggestedInterpretation:
        typeof parsed.suggestedInterpretation === "string"
          ? parsed.suggestedInterpretation.slice(0, 280)
          : "",
    });
  } catch {
    // Fail open so edits are not blocked by classifier errors.
    return NextResponse.json(fallbackResult());
  }
}
