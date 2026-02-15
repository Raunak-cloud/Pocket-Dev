/**
 * Inngest Status API
 *
 * Allows clients to poll for Inngest workflow completion
 */

import { NextRequest, NextResponse } from "next/server";

const COMPLETION_TTL_MS = 30 * 60 * 1000;
const PROGRESS_TTL_MS = 60 * 60 * 1000;

type TimedValue<T> = {
  value: T;
  expiresAt: number;
};

// In-memory store for completed events (in production, use Redis or database)
const completedEvents = new Map<string, TimedValue<any>>();
const progressEvents = new Map<string, TimedValue<string[]>>();
const cancelledJobs = new Set<string>(); // Track cancelled project IDs

function now() {
  return Date.now();
}

function cleanupExpired() {
  const t = now();
  for (const [k, v] of completedEvents) {
    if (v.expiresAt <= t) completedEvents.delete(k);
  }
  for (const [k, v] of progressEvents) {
    if (v.expiresAt <= t) progressEvents.delete(k);
  }
}

export async function GET(request: NextRequest) {
  cleanupExpired();

  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get("projectId");
  const event = searchParams.get("event");

  if (!projectId || !event) {
    return NextResponse.json(
      { error: "Missing projectId or event" },
      { status: 400 }
    );
  }

  // Check if job was cancelled
  if (cancelledJobs.has(projectId)) {
    cancelledJobs.delete(projectId);
    completedEvents.delete(`${projectId}:${event}`);
    progressEvents.delete(`${projectId}:progress`);
    return NextResponse.json({ cancelled: true }, { status: 200 });
  }

  const key = `${projectId}:${event}`;
  const result = completedEvents.get(key);

  if (result) {
    // Keep completion available for a short TTL to avoid read race conditions.
    return NextResponse.json(result.value);
  }

  // Check for progress updates
  const progressKey = `${projectId}:progress`;
  const progress = progressEvents.get(progressKey);
  if (progress && progress.value.length > 0) {
    return NextResponse.json({
      completed: false,
      progress: progress.value
    }, { status: 202 });
  }

  return NextResponse.json({ completed: false }, { status: 202 });
}

export async function POST(request: NextRequest) {
  cleanupExpired();

  const body = await request.json();
  const { projectId, event, data, progress, cancel } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId" },
      { status: 400 }
    );
  }

  // Handle cancellation
  if (cancel) {
    cancelledJobs.add(projectId);
    console.log(`[Inngest] Job cancelled: ${projectId}`);
    return NextResponse.json({ success: true, cancelled: true });
  }

  if (!event) {
    return NextResponse.json(
      { error: "Missing event" },
      { status: 400 }
    );
  }

  // Handle progress updates
  if (progress) {
    const progressKey = `${projectId}:progress`;
    const existing = progressEvents.get(progressKey)?.value || [];
    progressEvents.set(progressKey, {
      value: [...existing, progress],
      expiresAt: now() + PROGRESS_TTL_MS,
    });
    return NextResponse.json({ success: true });
  }

  // Handle completion
  if (data) {
    const key = `${projectId}:${event}`;
    completedEvents.set(key, {
      value: data,
      expiresAt: now() + COMPLETION_TTL_MS,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: "Missing data or progress" },
    { status: 400 }
  );
}

// Helper function to check if a job is cancelled (for use in Inngest functions)
export function isJobCancelled(projectId: string): boolean {
  return cancelledJobs.has(projectId);
}
