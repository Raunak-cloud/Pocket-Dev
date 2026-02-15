import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ hasAuthIntent: false });
    }

    const response = await fetch(new URL("/api/check-integration-intent", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      return NextResponse.json({ hasAuthIntent: false });
    }

    const data = (await response.json()) as { hasAuthIntent?: boolean };
    return NextResponse.json({ hasAuthIntent: data.hasAuthIntent === true });
  } catch {
    return NextResponse.json({ hasAuthIntent: false });
  }
}
