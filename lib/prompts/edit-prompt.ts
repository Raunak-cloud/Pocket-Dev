/**
 * Edit prompt builders.
 * Used by page.tsx when constructing the full edit prompt for modifying existing projects.
 */

interface UploadedFileInfo {
  name: string;
  downloadUrl?: string;
  dataUrl?: string;
}

export function buildEditPrompt(args: {
  currentFiles: string;
  userRequest: string;
}): string {
  const { currentFiles, userRequest } = args;

  return `You are a senior full-stack developer. A user has an existing React/Next.js app and is asking you to make a SPECIFIC change. Your job is to make the MINIMUM changes needed to achieve their goal — nothing more.

Here are the current project files:

${currentFiles}

USER'S REQUEST:
${userRequest}

CRITICAL — MINIMAL CHANGES ONLY:
- ONLY modify files that are directly needed to fulfill the user's request. Do NOT refactor, restyle, or "improve" unrelated code.
- Do NOT add features the user did not ask for. Do NOT reorganize or restructure code beyond what the request requires.
- Do NOT change existing styling, layout, colors, fonts, spacing, or design unless the user explicitly asked for those changes.
- Do NOT rename variables, refactor components, or clean up code that is not part of the request.
- Do NOT add, remove, or reorder navigation links unless the user explicitly asked for nav changes.
- Keep existing image src URLs unchanged unless the user explicitly requests image changes.
- Do NOT change any page other than the one(s) directly mentioned in the user's request.

HOW TO APPROACH THIS:
1. Read the user's request carefully. Identify the EXACT component or section that needs to change.
2. Make the smallest possible code change that achieves the user's goal. Prefer changing 5 lines over 50.
3. If the request involves conditional rendering (show/hide based on auth state): use the existing Supabase client to call supabase.auth.getUser() or useEffect + supabase.auth.onAuthStateChange(). Do NOT use placeholder booleans.
4. If the request involves backend/database work: create or update ONLY the tables/columns needed. Only reference tables that exist in supabase/schema.sql.
5. If the request involves UI changes: update only the relevant component. Do not touch unrelated pages or sections.
6. For database queries with joins (e.g. .select('*, other_table(*)')), ONLY join tables that have a real foreign key relationship defined in supabase/schema.sql.
7. Install npm packages ONLY if they are required for the specific change.

TAILWIND CSS RULES (CRITICAL - VIOLATIONS CAUSE BUILD ERRORS):
- NEVER use @apply with custom class names like bg-primary, text-secondary, bg-accent — these WILL crash the build
- ONLY use @apply with built-in Tailwind utilities: @apply px-4 py-2 bg-blue-600 text-white rounded-lg
- Use standard Tailwind color classes (blue-600, gray-900, emerald-500, etc.) instead of custom names
- Keep globals.css simple — just @tailwind base/components/utilities. Put styles in className attributes.`;
}

export function buildImageUploadSection(imageFiles: UploadedFileInfo[]): string {
  const imageUrlList = imageFiles
    .map(
      (f, i) =>
        `IMAGE ${i + 1} (${f.name}): ${f.downloadUrl || f.dataUrl}`,
    )
    .join("\n");

  return `\n\n📷 CRITICAL - User has uploaded ${imageFiles.length} image(s) that MUST be displayed in the website:

${imageUrlList}

 YOU MUST:
1. Use these EXACT image URLs in your img src attributes
2. Example: <img src="${imageFiles[0]?.downloadUrl || ""}" alt="User uploaded image" className="..." />
3. Replace existing placeholder images with these actual images
4. Embed these images prominently in the relevant sections
5. DO NOT use placeholder images or third-party stock URLs - use ONLY the URLs listed above

The user expects to see their ACTUAL uploaded images in the updated website.`;
}

export function buildPdfUploadSection(pdfFiles: UploadedFileInfo[]): string {
  const pdfUrlList = pdfFiles
    .map(
      (f, i) => `PDF ${i + 1} (${f.name}): ${f.downloadUrl || f.dataUrl}`,
    )
    .join("\n");

  return `\n\n📄 CRITICAL - User has uploaded ${pdfFiles.length} PDF file(s):

${pdfUrlList}

🚨 YOU MUST:
1. The PDFs are uploaded for reference/context - analyze their content if shown visually
2. If the user wants to link to the PDFs, use these EXACT URLs: <a href="${pdfFiles[0]?.downloadUrl || ""}" download>Download PDF</a>
3. If the PDF contains design references, use them to inform the visual design changes
4. The user has uploaded these PDFs to provide context for the edit request`;
}

export function buildSchemaContextSection(schemaContext: string): string {
  return `\n\n📊 CURRENT DATABASE SCHEMA (this is the ONLY source of truth for what tables exist):
${schemaContext}
STRICT DATABASE RULES:
- ONLY use tables that are defined above or that you explicitly CREATE in supabase/schema.sql.
- Do NOT assume a "profiles" table exists unless it is listed above. If you need user info, use auth.users via supabase.auth.getUser() — do NOT invent a profiles table.
- For .select() joins like .select('*, other_table(*)'), the other_table MUST exist in the schema AND have a foreign key relationship. Never join to a table that doesn't exist.
- CRITICAL PostgREST FK rule: PostgREST resolves joins ONLY via direct foreign keys. If code does .from("comments").select("*, profiles(...)"), then comments.user_id MUST have a FOREIGN KEY to profiles(id), NOT to auth.users(id). If a profiles table exists and other tables join to it, their user_id must reference profiles(id).
- Extend the existing schema — do NOT drop or recreate existing tables.
- Use CREATE TABLE IF NOT EXISTS for new tables.
- Every supabase.from("table_name") in code must have a matching CREATE TABLE in supabase/schema.sql.
- Preserve existing RLS policies. Add new ones for new tables.
- Column types must match what the code inserts/selects.`;
}

export function buildCriticalRequirementSection(existingFilePaths: string): string {
  return `\n\n🚨 CRITICAL REQUIREMENT:
You MUST return ALL of these exact files in your response: ${existingFilePaths}

Even if you only modify 1-2 files, you must include ALL files in the output JSON.
Do not skip any files. Keep unmodified files exactly as they are.`;
}
