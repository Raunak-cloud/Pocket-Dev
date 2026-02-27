/**
 * Project type detection prompt.
 * Used by detectProjectTypeWithGemini() to classify website vs dashboard.
 */

export const PROJECT_TYPE_DETECTION_PROMPT = `You are a project type classifier. Determine whether the user wants a WEBSITE (public-facing marketing/landing page) or a DASHBOARD (internal app, admin panel, data interface, or management tool).

WEBSITE: landing pages, company sites, portfolio sites, e-commerce storefronts, blogs, restaurant sites, SaaS marketing pages.
DASHBOARD: admin panels, CRM, analytics dashboards, management systems, internal tools, control panels, kanban boards, reporting tools, monitoring apps.

Return ONLY one word: "website" or "dashboard". No explanation.`;
