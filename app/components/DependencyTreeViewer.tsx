"use client";

import { useState, useMemo } from "react";
import type { ProjectDependencyTree } from "@/lib/dependency-tree";

interface DependencyTreeViewerProps {
  files: Array<{ path: string; content: string }>;
  tree: ProjectDependencyTree;
  onClose: () => void;
}

interface TreeNode {
  name: string;
  fullPath: string;
  children: TreeNode[];
  isFile: boolean;
  deps: string[];
  importedBy: string[];
}

function buildUITree(files: Array<{ path: string }>, tree: ProjectDependencyTree): TreeNode {
  const root: TreeNode = {
    name: "root",
    fullPath: "",
    children: [],
    isFile: false,
    deps: [],
    importedBy: [],
  };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const existingChild = current.children.find((c) => c.name === part);

      if (existingChild) {
        current = existingChild;
      } else {
        const newNode: TreeNode = {
          name: part,
          fullPath: parts.slice(0, i + 1).join("/"),
          children: [],
          isFile: isLast,
          deps: isLast ? (tree.forward[file.path] ?? []) : [],
          importedBy: isLast ? (tree.reverse[file.path] ?? []) : [],
        };
        current.children.push(newNode);
        current = newNode;
      }
    }
  }

  return root;
}

function getFileColor(name: string): string {
  if (name.endsWith(".tsx") || name.endsWith(".jsx")) return "text-blue-400 dark:text-blue-300";
  if (name.endsWith(".ts") || name.endsWith(".js")) return "text-yellow-400 dark:text-yellow-300";
  if (name.endsWith(".css")) return "text-pink-400 dark:text-pink-300";
  if (name.endsWith(".json") || name.endsWith(".sql")) return "text-orange-400 dark:text-orange-300";
  return "text-text-secondary";
}

function getFolderColor(name: string): string {
  if (name === "app") return "text-violet-400";
  if (name === "components") return "text-blue-400";
  if (name === "lib") return "text-emerald-400";
  if (name === "hooks") return "text-amber-400";
  if (name === "types") return "text-cyan-400";
  return "text-text-tertiary";
}

function TreeNodeRow({
  node,
  depth,
  selectedFile,
  onSelect,
  expandedFolders,
  onToggleFolder,
}: {
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
}) {
  const isExpanded = expandedFolders.has(node.fullPath);
  const isSelected = selectedFile === node.fullPath;

  return (
    <div>
      <button
        onClick={() =>
          node.isFile ? onSelect(node.fullPath) : onToggleFolder(node.fullPath)
        }
        className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-left text-xs transition-colors ${
          isSelected
            ? "bg-blue-500/15 text-blue-300"
            : "hover:bg-bg-tertiary/60 text-text-secondary"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {node.isFile ? (
          <svg className={`w-3.5 h-3.5 shrink-0 ${getFileColor(node.name)}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        ) : (
          <svg
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""} ${getFolderColor(node.name)}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
        <span className={node.isFile ? getFileColor(node.name) : `font-medium ${getFolderColor(node.name)}`}>
          {node.name}
        </span>
        {node.isFile && node.deps.length > 0 && (
          <span className="ml-auto text-[10px] text-text-muted shrink-0">
            {node.deps.length} dep{node.deps.length !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {!node.isFile && isExpanded && (
        <div>
          {node.children
            .sort((a, b) => {
              if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <TreeNodeRow
                key={child.fullPath}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelect={onSelect}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default function DependencyTreeViewer({
  files,
  tree,
  onClose,
}: DependencyTreeViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(["app", "components", "lib"]),
  );

  const uiTree = useMemo(() => buildUITree(files, tree), [files, tree]);

  const selectedDeps = selectedFile ? (tree.forward[selectedFile] ?? []) : [];
  const selectedImportedBy = selectedFile ? (tree.reverse[selectedFile] ?? []) : [];

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-bg-secondary border border-border-primary rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Dependency Tree</h3>
              <p className="text-xs text-text-tertiary">{files.length} files · click a file to see its connections</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* File tree */}
          <div className="w-64 shrink-0 border-r border-border-primary overflow-y-auto py-2">
            {uiTree.children
              .sort((a, b) => {
                if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
                return a.name.localeCompare(b.name);
              })
              .map((node) => (
                <TreeNodeRow
                  key={node.fullPath}
                  node={node}
                  depth={0}
                  selectedFile={selectedFile}
                  onSelect={setSelectedFile}
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                />
              ))}
          </div>

          {/* Detail panel */}
          <div className="flex-1 overflow-y-auto p-5">
            {selectedFile ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-1">Selected file</p>
                  <p className={`text-sm font-mono font-medium ${getFileColor(selectedFile)}`}>{selectedFile}</p>
                </div>

                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">
                    Imports ({selectedDeps.length})
                  </p>
                  {selectedDeps.length > 0 ? (
                    <div className="space-y-1">
                      {selectedDeps.map((dep) => (
                        <button
                          key={dep}
                          onClick={() => setSelectedFile(dep)}
                          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg bg-bg-tertiary/50 hover:bg-bg-tertiary text-xs text-text-secondary hover:text-text-primary transition text-left"
                        >
                          <svg className="w-3 h-3 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                          <span className="font-mono">{dep}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted italic">No local imports</p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">
                    Imported by ({selectedImportedBy.length})
                  </p>
                  {selectedImportedBy.length > 0 ? (
                    <div className="space-y-1">
                      {selectedImportedBy.map((imp) => (
                        <button
                          key={imp}
                          onClick={() => setSelectedFile(imp)}
                          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg bg-bg-tertiary/50 hover:bg-bg-tertiary text-xs text-text-secondary hover:text-text-primary transition text-left"
                        >
                          <svg className="w-3 h-3 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                          </svg>
                          <span className="font-mono">{imp}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted italic">Not imported by any file (entry point)</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-bg-tertiary/60 flex items-center justify-center">
                  <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <p className="text-sm text-text-tertiary">Select a file to see its dependencies and importers</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
