import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-3-flash-preview";

type IntentResult = {
  hasAuthIntent: boolean;
  hasDatabaseIntent: boolean;
};

function keywordIntentCheck(prompt: string): IntentResult {
  const text = prompt.toLowerCase();

  const authPatterns = [
    /\bauth\b/,
    /\bauthn\b/,
    /\bauthentication\b/,
    /\bauthorization\b/,
    /\bauthori[sz]ation\b/,
    /\blog[\s-]?in\b/,
    /\blog[\s-]?out\b/,
    /\bsign[\s-]?in\b/,
    /\bsign[\s-]?up\b/,
    /\bregister\b/,
    /\bregistration\b/,
    /\bpassword\b/,
    /\bforgot password\b/,
    /\breset password\b/,
    /\boauth\b/,
    /\bsso\b/,
    /\bsocial login\b/,
    /\bgoogle login\b/,
    /\buser account\b/,
    /\buser accounts\b/,
    /\bprotected route\b/,
    /\bprotected page\b/,
    /\bsession\b/,
    /\bjwt\b/,
    /\btoken auth\b/,
  ];

  const databasePatterns = [
    /\bdatabase\b/,
    /\bdb\b/,
    /\bsql\b/,
    /\bnosql\b/,
    /\bpostgres\b/,
    /\bpostgresql\b/,
    /\bmysql\b/,
    /\bmongodb\b/,
    /\bredis\b/,
    /\bsupabase\b/,
    /\bneon\b/,
    /\bprisma\b/,
    /\bschema\b/,
    /\btable\b/,
    /\btables\b/,
    /\bcollection\b/,
    /\bcollections\b/,
    /\bquery\b/,
    /\bqueries\b/,
    /\bcrud\b/,
    /\bpersist\b/,
    /\bpersistence\b/,
    /\bstorage layer\b/,
    /\bdata model\b/,
    /\borm\b/,
  ];

  const hasAuthIntent = authPatterns.some((re) => re.test(text));
  const hasDatabaseIntent = databasePatterns.some((re) => re.test(text));
  return { hasAuthIntent, hasDatabaseIntent };
}

function parseGeminiIntent(text: string): IntentResult | null {
  const normalized = text.trim();

  try {
    const parsed = JSON.parse(normalized) as Partial<IntentResult>;
    if (
      typeof parsed.hasAuthIntent === "boolean" &&
      typeof parsed.hasDatabaseIntent === "boolean"
    ) {
      return {
        hasAuthIntent: parsed.hasAuthIntent,
        hasDatabaseIntent: parsed.hasDatabaseIntent,
      };
    }
  } catch {
    // Continue to regex extraction.
  }

  const authMatch = normalized.match(/hasAuthIntent["\s:]+(true|false)/i);
  const dbMatch = normalized.match(/hasDatabaseIntent["\s:]+(true|false)/i);
  if (authMatch && dbMatch) {
    return {
      hasAuthIntent: authMatch[1].toLowerCase() === "true",
      hasDatabaseIntent: dbMatch[1].toLowerCase() === "true",
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  let keywordResult: IntentResult = {
    hasAuthIntent: false,
    hasDatabaseIntent: false,
  };

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({
        hasAuthIntent: false,
        hasDatabaseIntent: false,
      });
    }

    keywordResult = keywordIntentCheck(prompt);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(keywordResult);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        maxOutputTokens: 60,
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(
      `Classify this user prompt.

Return JSON only:
{
  "hasAuthIntent": boolean,
  "hasDatabaseIntent": boolean
}

Set hasAuthIntent=true if prompt asks for any authentication/account/login/signup/session/protected route/OAuth style feature (including synonyms or close wording).
Set hasDatabaseIntent=true if prompt asks for any database/data persistence/schema/query/storage backend feature (including synonyms or close wording).

Prompt:
"${prompt.replace(/"/g, '\\"').slice(0, 1200)}"`,
    );

    const parsed = parseGeminiIntent(result.response.text());
    if (!parsed) {
      return NextResponse.json(keywordResult);
    }

    return NextResponse.json({
      hasAuthIntent: parsed.hasAuthIntent || keywordResult.hasAuthIntent,
      hasDatabaseIntent:
        parsed.hasDatabaseIntent || keywordResult.hasDatabaseIntent,
    });
  } catch {
    return NextResponse.json(keywordResult);
  }
}
