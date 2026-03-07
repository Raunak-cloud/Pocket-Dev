import type { SavedProject } from "@/app/types";

interface ProjectsContentProps {
  loadingProjects: boolean;
  savedProjects: SavedProject[];
  onSectionChange: (section: string) => void;
  onOpenProject: (project: SavedProject) => void;
  onDeleteProject: (projectId: string) => void;
}

export default function ProjectsContent({
  loadingProjects,
  savedProjects,
  onSectionChange,
  onOpenProject,
  onDeleteProject,
}: ProjectsContentProps) {
  const INITIAL_GENERATION_PROMPT_CONFIG_KEY = "__pocketInitialGenerationPrompt";

  const getProjectDisplayPrompt = (savedProject: SavedProject) => {
    const configRecord =
      savedProject.config && typeof savedProject.config === "object"
        ? (savedProject.config as unknown as Record<string, unknown>)
        : null;
    const initialPrompt =
      configRecord &&
      typeof configRecord[INITIAL_GENERATION_PROMPT_CONFIG_KEY] === "string"
        ? String(configRecord[INITIAL_GENERATION_PROMPT_CONFIG_KEY]).trim()
        : "";
    const stripInjection = (text: string) =>
      text
        // Match correctly-stored emoji (u flag for proper Unicode handling)
        .replace(/\n+[🔷🔸📷📄🖼️📊🚨][\s\S]*/u, "")
        // Match garbled/mojibake emoji followed by known injection keywords
        .replace(/\n+.{0,8}(?:CRITICAL\s*[-–]\s*User has uploaded|PDF CONTENT EXTRACTION|CURRENT DATABASE SCHEMA|CRITICAL REQUIREMENT)[\s\S]*/i, "")
        .trim();

    if (initialPrompt) return stripInjection(initialPrompt) || "Untitled project";

    const prompt = savedProject.prompt?.trim() || "";
    if (!prompt) return "Untitled project";
    if (prompt.startsWith("You are a senior full-stack developer.")) {
      return "Generated project";
    }
    return stripInjection(prompt) || "Untitled project";
  };

  const formatProjectDate = (value: Date | string | number) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loadingProjects) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-text-tertiary">Loading projects...</p>
      </div>
    );
  }

  if (savedProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
        <div className="w-16 h-16 mb-4 bg-bg-tertiary rounded-2xl flex items-center justify-center">
          <svg
            className="w-8 h-8 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">My Projects</h2>
        <p className="text-text-tertiary mb-6 max-w-sm">
          Your generated projects will appear here. Create your first app to
          get started!
        </p>
        <button
          onClick={() => onSectionChange("create")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
        >
          Create Your First App
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-text-primary">My Projects</h2>
        <button
          onClick={() => onSectionChange("create")}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          New App
        </button>
      </div>
      <div className="grid gap-4">
        {savedProjects.map((savedProject) => (
          <div
            key={savedProject.id}
            className="bg-bg-tertiary/50 border border-border-secondary rounded-xl p-3.5 sm:p-4 hover:border-text-faint transition cursor-pointer group"
            onClick={() => onOpenProject(savedProject)}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-text-primary font-medium mb-1 group-hover:text-blue-400 transition break-words [overflow-wrap:anywhere]">
                  {getProjectDisplayPrompt(savedProject)}
                </h3>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-text-muted">
                  <span>{savedProject.files.length} files</span>
                  <span>•</span>
                  <span>{formatProjectDate(savedProject.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0 sm:ml-4">
                {savedProject.isPublished && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-400 bg-teal-500/10 rounded-full">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                    Live
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(savedProject.id);
                  }}
                  className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  title="Delete project"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
                <svg
                  className="w-5 h-5 text-text-muted group-hover:text-blue-400 transition ml-auto sm:ml-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
