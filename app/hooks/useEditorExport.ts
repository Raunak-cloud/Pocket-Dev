"use client";

import { useState, useCallback } from "react";
import { prepareE2BFiles } from "@/lib/e2b-utils";
import type { ReactProject } from "@/app/types";
import JSZip from "jszip";

interface UseEditorExportProps {
  project: ReactProject | null;
  setError: (error: string) => void;
}

const GITIGNORE_CONTENT = `# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`;

export function useEditorExport({ project, setError }: UseEditorExportProps) {
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState("");

  const exportToEditor = useCallback(
    async (editor: "vscode" | "cursor") => {
      if (!project) return;

      setIsExporting(true);
      setShowExportDropdown(false);

      try {
        const files = prepareE2BFiles(project);
        files[".gitignore"] = GITIGNORE_CONTENT;

        // Try File System Access API to write files directly to a folder
        if ("showDirectoryPicker" in window) {
          try {
            const dirHandle = await (window as any).showDirectoryPicker({
              mode: "readwrite",
            });

            for (const [filePath, content] of Object.entries(files)) {
              const parts = filePath.split("/");
              let currentDir = dirHandle;

              for (let i = 0; i < parts.length - 1; i++) {
                currentDir = await currentDir.getDirectoryHandle(parts[i], {
                  create: true,
                });
              }

              const fileHandle = await currentDir.getFileHandle(
                parts[parts.length - 1],
                { create: true },
              );
              const writable = await fileHandle.createWritable();
              await writable.write(content);
              await writable.close();
            }

            const editorName = editor === "vscode" ? "VS Code" : "Cursor";
            setExportSuccessMessage(
              `Project exported! Open the folder in ${editorName} to start coding.`,
            );
            setTimeout(() => setExportSuccessMessage(""), 5000);
            return;
          } catch (fsError: any) {
            if (fsError.name === "AbortError") return;
            // Fall through to ZIP download
          }
        }

        // Fallback: ZIP download
        const zip = new JSZip();
        Object.entries(files).forEach(([path, content]) => {
          zip.file(path, content);
        });

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "nextjs-app.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const editorName = editor === "vscode" ? "VS Code" : "Cursor";
        setExportSuccessMessage(
          `Project downloaded! Extract the ZIP and open the folder in ${editorName}.`,
        );
        setTimeout(() => setExportSuccessMessage(""), 5000);
      } catch (error) {
        console.error(`${editor} export error:`, error);
        const editorName = editor === "vscode" ? "VS Code" : "Cursor";
        setError(`Failed to export to ${editorName}`);
      } finally {
        setIsExporting(false);
      }
    },
    [project, setError],
  );

  const exportToVSCode = useCallback(
    () => exportToEditor("vscode"),
    [exportToEditor],
  );

  const exportToCursor = useCallback(
    () => exportToEditor("cursor"),
    [exportToEditor],
  );

  return {
    // State
    showExportDropdown,
    isExporting,
    exportSuccessMessage,
    // Setters
    setShowExportDropdown,
    setIsExporting,
    setExportSuccessMessage,
    // Functions
    exportToVSCode,
    exportToCursor,
  };
}
