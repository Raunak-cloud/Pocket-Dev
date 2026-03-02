/**
 * Tracking component source injected into deployed Vercel apps.
 * Sends pageview events to the Pocket Dev analytics endpoint.
 * No cookies — uses sessionStorage for session ID (no GDPR consent needed).
 */
export const POCKET_ANALYTICS_COMPONENT = `"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function getSessionId() {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("_pd_sid");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("_pd_sid", id);
  }
  return id;
}

function getBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Other";
}

export default function PocketAnalytics() {
  const pathname = usePathname();
  const lastPathRef = useRef("");

  useEffect(() => {
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    const endpoint = process.env.NEXT_PUBLIC_POCKET_DEV_URL;
    const projectId = process.env.NEXT_PUBLIC_POCKET_PROJECT_ID;
    if (!endpoint || !projectId) return;

    const payload = JSON.stringify({
      projectId,
      event: "pageview",
      pathname,
      referrer: document.referrer || null,
      screenWidth: window.innerWidth,
      language: navigator.language,
      browser: getBrowser(),
      sessionId: getSessionId(),
    });

    const url = endpoint.replace(/\\/$/, "") + "/api/analytics/track";

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
`;
