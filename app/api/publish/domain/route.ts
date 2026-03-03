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

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "";
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "";

function vercelHeaders() {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function teamQuery() {
  return VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";
}

type VercelErrorResponse = {
  error?: {
    message?: string;
    code?: string;
  };
};

type VercelDomainResponse = {
  name?: string;
  verified?: boolean;
  verification?: Array<{
    type?: string;
    domain?: string;
    value?: string;
    reason?: string;
  }>;
};

export async function POST(request: NextRequest) {
  try {
    if (!VERCEL_TOKEN) {
      return NextResponse.json(
        { error: "VERCEL_TOKEN is not configured" },
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

    const connectRes = await fetch(
      `https://api.vercel.com/v10/projects/${encodeURIComponent(projectName)}/domains${teamQuery()}`,
      {
        method: "POST",
        headers: vercelHeaders(),
        body: JSON.stringify({ name: domain }),
        cache: "no-store",
      },
    );

    const connectData = (await connectRes.json().catch(() => ({}))) as
      | VercelDomainResponse
      | VercelErrorResponse;

    if (!connectRes.ok) {
      const message =
        (connectData as VercelErrorResponse)?.error?.message ||
        "Vercel rejected the domain connection request.";
      const alreadyExists =
        connectRes.status === 409 || /already/i.test(message);

      if (!alreadyExists) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const detailsRes = await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(domain)}${teamQuery()}`,
      {
        headers: vercelHeaders(),
        cache: "no-store",
      },
    );

    const details = detailsRes.ok
      ? ((await detailsRes.json()) as VercelDomainResponse)
      : null;

    return NextResponse.json({
      success: true,
      domain,
      projectName,
      cnameTarget: "cname.vercel-dns.com",
      status: details?.verified ? "verified" : "pending_verification",
      verification: details?.verification || [],
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
