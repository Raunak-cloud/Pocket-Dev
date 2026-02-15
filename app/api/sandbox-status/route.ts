import { NextRequest, NextResponse } from "next/server";
import { getSandboxStartupStatus } from "@/lib/sandbox-startup-status";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const status = getSandboxStartupStatus(id);
  if (!status) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  return NextResponse.json({
    found: true,
    phase: status.phase,
    logs: status.logs,
    error: status.error,
    sandboxId: status.sandboxId,
    url: status.url,
    updatedAt: status.updatedAt,
  });
}
