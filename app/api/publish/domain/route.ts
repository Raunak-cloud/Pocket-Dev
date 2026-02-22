import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/supabase-auth/server";
import { prisma } from "@/lib/prisma";

function sanitizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.+$/, "");
}

type CloudflareApiError = {
  code?: number;
  message?: string;
};

export async function POST(request: NextRequest) {
  try {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!token || !accountId) {
      return NextResponse.json(
        { error: "Cloudflare credentials are not configured" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      projectId?: string;
      domain?: string;
    };

    const projectId = body.projectId?.trim();
    const rawDomain = body.domain?.trim();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    if (!rawDomain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const domain = sanitizeDomain(rawDomain);
    if (!domain || !domain.includes(".")) {
      return NextResponse.json(
        { error: "Please provide a valid domain" },
        { status: 400 },
      );
    }

    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!project.isPublished || !project.deploymentId) {
      return NextResponse.json(
        { error: "Publish the project before connecting a custom domain" },
        { status: 400 },
      );
    }

    const projectName = project.deploymentId;

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/domains`;
    const cfRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
      cache: "no-store",
    });

    const cfData = (await cfRes.json()) as {
      success?: boolean;
      errors?: CloudflareApiError[];
      messages?: Array<{ message?: string }>;
      result?: unknown;
    };

    if (!cfRes.ok || cfData.success !== true) {
      const errors = cfData.errors || [];
      const firstMessage =
        errors[0]?.message ||
        cfData.messages?.[0]?.message ||
        "Cloudflare rejected the domain connection request.";
      const alreadyExists = errors.some((e) =>
        String(e.message || "")
          .toLowerCase()
          .includes("already"),
      );

      if (!alreadyExists) {
        return NextResponse.json({ error: firstMessage }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      domain,
      projectName,
      cnameTarget: `${projectName}.pages.dev`,
      status: "initializing",
    });
  } catch (error) {
    console.error("[POST /api/publish/domain] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to connect domain",
      },
      { status: 500 },
    );
  }
}
