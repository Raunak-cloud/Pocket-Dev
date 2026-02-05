import Anthropic from "@anthropic-ai/sdk";
import { lintCode, type LintMessage } from "./eslint-lint";
import { injectImages, stripImagesForEdit } from "./image-generator";

const MAX_LINT_RETRIES = 3;
const MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 16000; // Increased for complete, detailed websites

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/** Pull the text out of a Claude response (first TextBlock). */
function getText(msg: Anthropic.Message): string {
  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}

const SYSTEM_PROMPT = `🚨🚨🚨 ABSOLUTE MANDATORY REQUIREMENTS - NO EXCEPTIONS 🚨🚨🚨

═══════════════════════════════════════════════════════════════
BEFORE YOU START WRITING HTML - READ THIS ENTIRE SECTION
═══════════════════════════════════════════════════════════════

YOU MUST INCLUDE EVERY SINGLE ONE OF THESE SECTIONS (ALL ARE REQUIRED):

1. ✅ NAVIGATION BAR - Sticky header with brand name, 4-5 nav links, CTA button, mobile hamburger menu
2. ✅ HERO SECTION - Full-viewport with headline (10-15 words) + subtitle (2-3 sentences) + CTA button
3. ✅ MAIN CONTENT - Minimum 3-4 sections based on website type (see requirements below)
4. ✅ FOOTER - ALWAYS REQUIRED - 3-4 columns with company info, links, contact, copyright

IF YOU SKIP ANY OF THESE SECTIONS, THE WEBSITE IS REJECTED.

═══════════════════════════════════════════════════════════════
CONTENT COMPLETENESS REQUIREMENTS - ALL MUST BE MET
═══════════════════════════════════════════════════════════════

⛔ ZERO BLANK CONTENT - EVERY SECTION MUST HAVE COMPLETE TEXT ⛔

FOR RESTAURANTS (like Italian restaurant):
  ✓ Create restaurant name (e.g., "Bella Vita", "Trattoria Luna")
  ✓ Menu with MINIMUM 15-20 items grouped by course (Antipasti, Pasta, Secondi, Dolci)
  ✓ Each menu item: Italian name + 2-3 sentence description + ingredients + price
  ✓ About section: 3-4 paragraphs about restaurant story, chef, ingredients, philosophy
  ✓ Testimonials: 3+ customer reviews with full names + detailed quotes (20+ words)
  ✓ Reservations section with phone, email, hours, location
  ✓ FOOTER with restaurant info, hours, contact, social links

FOR E-COMMERCE (like fashion boutique):
  ✓ Create brand name
  ✓ Products: MINIMUM 10-12 complete products with unique names + 2-3 sentence descriptions + prices
  ✓ About section: 3-4 paragraphs about brand story and values
  ✓ Benefits/Why shop: 4-6 reasons with descriptions
  ✓ Testimonials: 3+ with full names + companies
  ✓ FOOTER with company info, links, contact, newsletter

FOR PORTFOLIOS (like photographer):
  ✓ Create photographer/designer name
  ✓ Gallery: MINIMUM 8-12 images with detailed captions
  ✓ About section: 3-4 FULL paragraphs about background, style, experience, philosophy
  ✓ Optional: Services with packages and prices, client testimonials
  ✓ Contact form or contact information
  ✓ FOOTER with bio line, email, social links

FOR SAAS/TECH:
  ✓ Product name
  ✓ Features: MINIMUM 5-6 features with icons + titles + 3-4 sentence descriptions
  ✓ Pricing: 3 tiers with feature lists and prices
  ✓ Testimonials: 3+ with names, titles, companies
  ✓ About/How it works: 3-4 paragraphs
  ✓ FOOTER with company info, links, contact

═══════════════════════════════════════════════════════════════
FORBIDDEN - YOU MUST NEVER DO THESE THINGS
═══════════════════════════════════════════════════════════════

❌ NEVER write empty tags: <p></p>, <h2></h2>, <div class="description"></div>
❌ NEVER use placeholder text: "Lorem ipsum", "[text]", "Description here", "Coming soon"
❌ NEVER use generic headings: "Heading", "Title", "Name"
❌ NEVER write 1-sentence descriptions - MINIMUM 2-3 sentences always
❌ NEVER skip the FOOTER - it is ALWAYS REQUIRED
❌ NEVER create fewer items than the minimum (10+ products, 15+ menu items, 8+ gallery, 5+ features)

═══════════════════════════════════════════════════════════════

━━━ HOW TO CREATE COMPLETE CONTENT ━━━

CREATE brand/restaurant/person name if not provided.
WRITE 2-3 sentence descriptions minimum for EVERY item/product/service.
WRITE 3-4 full paragraphs for About sections (not 1-2 sentences).
CREATE detailed testimonials with full names + titles + 20+ word quotes.

CONTENT EXAMPLES:

Italian Restaurant Menu Item:
"Tagliatelle al Tartufo - Fresh hand-rolled egg pasta tossed with butter, Parmigiano-Reggiano, and shaved black truffle from Umbria. This elegant dish showcases the pure, earthy flavors of premium Italian ingredients. Finished with a drizzle of white truffle oil. €28"

Product Description:
"Midnight Essence Handbag - Crafted from supple Italian leather with 24k gold hardware, this versatile bag transitions seamlessly from office to evening. Features three interior compartments, adjustable chain strap, and signature quilted design. $445"

Testimonial:
"Maria Gonzalez - Food Blogger, Taste Italia - The carbonara at Bella Vita transported me straight to Rome. The pasta was perfectly al dente, the guanciale crispy and flavorful, and the sauce incredibly creamy without being heavy. Chef Marco's attention to traditional techniques is evident in every bite. Best Italian food outside of Italy!"

About Section (minimum 3-4 paragraphs):
Write compelling narrative covering origin story, mission, what makes you unique, philosophy/approach.


🚨 FINAL VALIDATION BEFORE RETURNING HTML 🚨

STOP and verify these MANDATORY requirements:

1. ✅ Does the website have a FOOTER with all columns? (About, Links, Contact, Social icons, Copyright)
2. ✅ Does EVERY heading have real text? (not "Heading", "Title", or empty)
3. ✅ Does EVERY paragraph have 2-3 complete sentences?
4. ✅ Does EVERY product/menu item/service have name + description + price?
5. ✅ Does the About section have 3-4 FULL paragraphs?
6. ✅ Are there MINIMUM items? (10+ products, 15+ menu items, 8+ gallery, 5+ features)
7. ✅ Do testimonials have full names + titles + detailed quotes?
8. ✅ Does the footer have real SVG social media icons? (not emoji, not placeholder)
9. ✅ Is there ANY placeholder text? ("Lorem ipsum", "[text]", "Description here", "Coming soon")

If you answered NO to questions 1-8 or YES to #9, DO NOT return the HTML.
GO BACK and fix it first.

━━━ DESIGN BASICS ━━━
- Fonts: Load 2 Google Fonts (e.g. Inter + Playfair Display). h1: 3.5-4.5rem, body: 1-1.15rem
- Colors: High contrast. Light text on dark backgrounds, dark text on light backgrounds
- Layout: Max-width 1200px, responsive grid/flexbox, cards stack on mobile
- Spacing: Consistent padding/margins (multiples of 8px)

━━━ REQUIRED SECTIONS - ALL WEBSITES MUST HAVE THESE ━━━

1. NAVIGATION - Sticky header with brand name, 4-5 nav links, CTA button, mobile hamburger menu

2. HERO - Full-viewport with headline (10-15 words) + subtitle (2-3 sentences) + CTA buttons

3. MAIN CONTENT (based on website type):

   E-COMMERCE: Products grid (10-12 items) + About + Benefits + Testimonials
   RESTAURANT: Menu (15-20 items grouped by course) + About + Gallery + Testimonials + Reservations
   SAAS: Features (5-6) + Pricing (3 tiers) + Testimonials + How It Works
   PORTFOLIO: Gallery (8-12 items) + About (3-4 paragraphs) + Skills + Contact
   BUSINESS: Services (5-6) + About (3-4 paragraphs) + Team + Testimonials + Contact

4. FOOTER - ALWAYS REQUIRED - 3-4 columns with:
   - About/Company info (2-3 sentences)
   - Quick Links (5-7 navigation links)
   - Contact info (email, phone, address)
   - Social media icons - MUST use real SVG icons:
     Facebook: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
     Instagram: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
     Twitter/X: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
     LinkedIn: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
     YouTube: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
   - Style icons: width 20px, opacity 0.7, hover opacity 1, gap 16px
   - Copyright text with year and company name

━━━ IMAGES ━━━
- Include 3–5 images in the site: a large hero image, section illustrations, feature visuals, or card images — choose what fits.
- Every <img> MUST use this exact src format: src="POLLINATIONS_IMG_1"  Number them sequentially (POLLINATIONS_IMG_1, POLLINATIONS_IMG_2, …).  Do NOT use any placeholder URLs, stock-photo URLs, or icon fonts in place of real images.
- The alt attribute of every <img> MUST be a detailed 20–40 word description of exactly what the image should depict — subject, style, lighting, colors, mood, setting.  This text is used to AI-generate the actual image, so be specific.
  Example: <img src="POLLINATIONS_IMG_1" alt="A sleek modern open-plan kitchen with white marble countertops, warm brass pendant lights, floor-to-ceiling windows overlooking a lush garden, fresh flowers on the island bench" class="hero-img">

━━━ ANIMATIONS & JAVASCRIPT ━━━
- Hover effects on cards (lift, shadow), scroll reveals with IntersectionObserver, smooth scrolling
- Mobile menu toggle, working navigation links with href="#section-id"
- Use const/let (never var), === (never ==), semicolons, no unused variables

━━━ CODE LAYOUT ━━━
- CSS in <style> block in <head>, JS in <script> at end of <body>, vanilla JS only
- Implement smooth scroll, mobile menu toggle, working navigation

═══════════════════════════════════════════════════════════════
🚨🚨🚨 MANDATORY PRE-RETURN VALIDATION - DO NOT SKIP 🚨🚨🚨
═══════════════════════════════════════════════════════════════

Before returning the HTML, you MUST perform this validation:

1. SCROLL THROUGH THE ENTIRE HTML YOU GENERATED (every line, every section)
2. COUNT the number of products/services/menu items - is it 8-12+ with FULL descriptions?
3. READ each heading - does it have 2-3 paragraphs of content below it?
4. FIND all <p> tags - does each have 2-3 complete sentences?
5. CHECK all product/service cards - does each have name + description + price?
6. VERIFY all testimonials - does each have full name + detailed quote + title/company?
7. SCAN for these FORBIDDEN phrases: "Lorem ipsum", "[text]", "Coming soon", "Description here", "Content goes here", "TBD", "Add description", "Your text", "Click here"
8. LOOK for empty elements: <p></p>, <h2></h2>, <div class="description"></div>

If you find ANYTHING blank, empty, or incomplete:
→ STOP IMMEDIATELY
→ GO BACK and write complete content for it
→ RE-CHECK everything again
→ ONLY THEN return the HTML

REMEMBER: The user gave you a detailed prompt (luxury fashion boutique, restaurant, SaaS, photographer, etc.)
- You have ALL the context you need to create realistic content
- DO NOT leave anything for "later" or "to be filled in"
- INVENT realistic details that fit the prompt
- Every section that exists must be 100% complete

SPECIFIC VALIDATIONS BY WEBSITE TYPE:

If e-commerce: VERIFY you have 8-12+ complete products (each with name, 2-3 sentence description, price)
If restaurant: VERIFY you have 12-20+ complete menu items (each with name, ingredients description, price)
If SaaS/tech: VERIFY you have 4-6+ complete features AND 3 pricing tiers with feature lists
If portfolio/photographer: VERIFY you have:
  → 8-12+ gallery items with detailed image alt text (20-40 words each)
  → About section with 3-4 FULL paragraphs (not 1-2 sentences)
  → Each gallery item has a caption or category name
  → Optional: Services section with photography packages and prices
  → Optional: 3+ client testimonials with full names
If business/corporate: VERIFY you have 4-6+ complete service descriptions

═══════════════════════════════════════════════════════════════

This is a real website for a real business. Make it professional, complete, and ready to use.

Return ONLY the raw HTML document. No markdown fences, no explanations.`;

// ── helpers ──────────────────────────────────────────────────

function stripFences(text: string): string {
  return text
    .replace(/^```html\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim();
}

/** Pull the text inside every <script>…</script> that has content. */
function extractScripts(html: string): string[] {
  const re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const out: string[] = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

// ── public types ─────────────────────────────────────────────

export interface WebsiteLintReport {
  passed: boolean;
  errors: number;
  warnings: number;
  messages: LintMessage[];
}

export interface GeneratedWebsite {
  html: string;
  lintReport: WebsiteLintReport;
  attempts: number;
}

// ── lint all <script> blocks in one HTML string ─────────────

async function lintHtml(html: string): Promise<WebsiteLintReport> {
  const scripts = extractScripts(html);
  if (scripts.length === 0) {
    return { passed: true, errors: 0, warnings: 0, messages: [] };
  }

  let messages: LintMessage[] = [];
  let errors = 0;
  let warnings = 0;

  for (const src of scripts) {
    const r = await lintCode(src);
    messages = messages.concat(r.messages);
    errors += r.errorCount;
    warnings += r.warningCount;
  }

  return { passed: errors === 0, errors, warnings, messages };
}

// ── section detection for progress messages ─────────────────

interface SectionMarker {
  pattern: RegExp;
  message: string;
  announced: boolean;
}

function createSectionMarkers(): SectionMarker[] {
  return [
    { pattern: /<nav/i, message: "Setting up your navigation bar", announced: false },
    { pattern: /hero|<header/i, message: "Designing a stunning hero section", announced: false },
    { pattern: /<section[^>]*features/i, message: "Building your feature highlights", announced: false },
    { pattern: /<section[^>]*about/i, message: "Creating the about section", announced: false },
    { pattern: /<section[^>]*services/i, message: "Adding your services showcase", announced: false },
    { pattern: /<section[^>]*pricing/i, message: "Crafting the pricing table", announced: false },
    { pattern: /<section[^>]*testimonial/i, message: "Adding customer stories", announced: false },
    { pattern: /<section[^>]*gallery/i, message: "Setting up the image gallery", announced: false },
    { pattern: /<section[^>]*contact/i, message: "Creating the contact section", announced: false },
    { pattern: /<section[^>]*product/i, message: "Building your product showcase", announced: false },
    { pattern: /<section[^>]*menu/i, message: "Designing the menu section", announced: false },
    { pattern: /<section[^>]*team/i, message: "Adding your team section", announced: false },
    { pattern: /<footer/i, message: "Finishing with the footer", announced: false },
    { pattern: /POLLINATIONS_IMG/i, message: "Preparing custom images", announced: false },
  ];
}

function checkForNewSections(
  html: string,
  markers: SectionMarker[],
  onProgress: (msg: string) => void
): void {
  for (const marker of markers) {
    if (!marker.announced && marker.pattern.test(html)) {
      marker.announced = true;
      onProgress(marker.message);
    }
  }
}

// ── shared lint → fix loop ───────────────────────────────────

async function runLintFixLoop(
  client: Anthropic,
  initialHtml: string,
  contextPrompt: string,
  onProgress?: (msg: string) => void
): Promise<{ html: string; report: WebsiteLintReport; attempts: number }> {
  let html = initialHtml;
  let attempts = 1;
  let report = await lintHtml(html);

  while (!report.passed && attempts < MAX_LINT_RETRIES) {
    onProgress?.("Polishing the code quality");

    const errorLines = report.messages
      .filter((m) => m.severity === "error")
      .map((m) => `Line ${m.line}: [${m.rule}] ${m.message}`)
      .join("\n");

    const fix = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: contextPrompt },
        { role: "assistant", content: html },
        {
          role: "user",
          content:
            "The JavaScript in the website above has ESLint errors. " +
            "Fix every error listed below and return the COMPLETE corrected HTML.\n\n" +
            errorLines +
            "\n\nRemember: const/let only, === only, no unused variables, semicolons everywhere. " +
            "Return ONLY raw HTML.",
        },
      ],
    });

    html = stripFences(getText(fix) || html);
    attempts++;
    report = await lintHtml(html);
  }

  return { html, report, attempts };
}

// ── generate with streaming progress ─────────────────────────

export async function generateWebsite(
  prompt: string,
  onProgress?: (message: string) => void
): Promise<GeneratedWebsite> {
  const client = getClient();
  const markers = createSectionMarkers();
  let fullHtml = "";

  // Initial progress
  onProgress?.("Starting to build your website");

  // Stream the generation to get real-time progress
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  // Process chunks as they arrive
  stream.on("text", (text) => {
    fullHtml += text;
    checkForNewSections(fullHtml, markers, onProgress!);
  });

  // Wait for completion
  await stream.finalMessage();

  const initialHtml = stripFences(fullHtml);

  // Lint fix loop
  const { html, report, attempts } = await runLintFixLoop(
    client,
    initialHtml,
    prompt,
    onProgress
  );

  // Image injection
  onProgress?.("Generating custom AI images");
  const finalHtml = await injectImages(html);

  onProgress?.("Your website is ready!");

  return { html: finalHtml, lintReport: report, attempts };
}

// ── edit (iterative) ─────────────────────────────────────────

export async function editWebsite(
  currentHtml: string,
  editPrompt: string
): Promise<GeneratedWebsite> {
  const client = getClient();
  const strippedHtml = stripImagesForEdit(currentHtml);
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.5,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          "Here is the current website HTML:\n\n" +
          strippedHtml +
          "\n\nEdit request: " +
          editPrompt +
          "\n\nApply the requested changes and return the COMPLETE modified HTML document. " +
          "Keep all existing sections unless explicitly asked to remove them. " +
          "Return ONLY raw HTML. No markdown fences, no explanations.",
      },
    ],
  });

  const editedHtml = stripFences(getText(res) || strippedHtml);
  const { html, report, attempts } = await runLintFixLoop(client, editedHtml, editPrompt);
  const finalHtml = await injectImages(html);
  return { html: finalHtml, lintReport: report, attempts };
}
