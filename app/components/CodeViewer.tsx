"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";

interface GeneratedFile {
  path: string;
  content: string;
}

interface CodeViewerProps {
  files: GeneratedFile[];
  onClose: () => void;
}

type TreeNode =
  | {
      kind: "directory";
      name: string;
      path: string;
      children: TreeNode[];
      depth: number;
    }
  | {
      kind: "file";
      name: string;
      path: string;
      file: GeneratedFile;
      depth: number;
    };

type MutableTreeDirectory = {
  name: string;
  path: string;
  children: Map<string, MutableTreeDirectory | GeneratedFile>;
};

function getAncestorDirectoryPaths(filePath: string): string[] {
  const parts = filePath.split("/").filter(Boolean);
  const ancestors: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    ancestors.push(parts.slice(0, i + 1).join("/"));
  }
  return ancestors;
}

function buildTree(files: GeneratedFile[]): TreeNode[] {
  const root: MutableTreeDirectory = {
    name: "",
    path: "",
    children: new Map(),
  };

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      const dirPath = parts.slice(0, i + 1).join("/");
      const existing = current.children.get(dirName);
      if (
        !existing ||
        !(
          typeof existing === "object" &&
          "children" in existing &&
          existing.children instanceof Map
        )
      ) {
        const nextDir: MutableTreeDirectory = {
          name: dirName,
          path: dirPath,
          children: new Map(),
        };
        current.children.set(dirName, nextDir);
        current = nextDir;
      } else {
        current = existing as MutableTreeDirectory;
      }
    }

    const fileName = parts[parts.length - 1];
    current.children.set(fileName, file);
  }

  const toNodes = (dir: MutableTreeDirectory, depth: number): TreeNode[] => {
    const directories: TreeNode[] = [];
    const fileNodes: TreeNode[] = [];

    for (const [name, child] of dir.children) {
      if (
        typeof child === "object" &&
        "children" in child &&
        child.children instanceof Map
      ) {
        directories.push({
          kind: "directory",
          name: child.name || name,
          path: child.path,
          depth,
          children: toNodes(child as MutableTreeDirectory, depth + 1),
        });
      } else {
        const file = child as GeneratedFile;
        fileNodes.push({
          kind: "file",
          name,
          path: file.path,
          file,
          depth,
        });
      }
    }

    directories.sort((a, b) => a.name.localeCompare(b.name));
    fileNodes.sort((a, b) => a.name.localeCompare(b.name));
    return [...directories, ...fileNodes];
  };

  return toNodes(root, 0);
}

export default function CodeViewer({ files, onClose }: CodeViewerProps) {
  const [selectedFilePath, setSelectedFilePath] = useState<string>(
    files[0]?.path || "",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
    const topLevel = new Set<string>();
    for (const file of files) {
      const parts = file.path.split("/").filter(Boolean);
      if (parts.length > 1) {
        topLevel.add(parts[0]);
      }
    }
    return topLevel;
  });

  const handleClose = useCallback(() => onClose(), [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleClose]);

  const copyToClipboard = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get color class for different token types (basic syntax highlighting)
  const highlightLine = (line: string) => {
    // Simple keyword-based highlighting for readability
    return line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Strings
      .replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, '<span style="color:#a5d6ff">$&</span>')
      // Comments
      .replace(/(\/\/.*$)/gm, '<span style="color:#8b949e">$&</span>')
      // Keywords
      .replace(
        /\b(import|export|from|const|let|var|function|return|if|else|for|while|class|extends|interface|type|async|await|default|new|this|true|false|null|undefined|typeof|instanceof)\b/g,
        '<span style="color:#ff7b72">$&</span>'
      )
      // Numbers
      .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#79c0ff">$&</span>');
  };

  // Filter files
  const filteredFiles = files.filter((file) =>
    file.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fileTree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);
  const selectedFile =
    files.find((f) => f.path === selectedFilePath) || files[0];

  const autoExpandedFromSearch = useMemo(() => {
    if (!searchQuery) return new Set<string>();
    const dirs = new Set<string>();
    for (const file of filteredFiles) {
      for (const ancestor of getAncestorDirectoryPaths(file.path)) {
        dirs.add(ancestor);
      }
    }
    return dirs;
  }, [filteredFiles, searchQuery]);

  const effectiveExpandedDirs = new Set(expandedDirs);
  for (const dir of autoExpandedFromSearch) effectiveExpandedDirs.add(dir);
  if (selectedFile?.path) {
    for (const ancestor of getAncestorDirectoryPaths(selectedFile.path)) {
      effectiveExpandedDirs.add(ancestor);
    }
  }

  const isDirectoryExpanded = (dirPath: string) =>
    effectiveExpandedDirs.has(dirPath);

  const toggleDirectory = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  const renderTreeNodes = (nodes: TreeNode[]): JSX.Element[] => {
    return nodes.flatMap((node) => {
      if (node.kind === "directory") {
        const expanded = isDirectoryExpanded(node.path);
        const dirRow = (
          <button
            key={`dir:${node.path}`}
            onClick={() => toggleDirectory(node.path)}
            className="w-full text-left px-2 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            style={{ paddingLeft: `${8 + node.depth * 14}px` }}
          >
            <div className="flex items-center gap-2">
              <svg
                className={`w-3 h-3 text-slate-500 transition-transform ${expanded ? "rotate-90" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M6.293 4.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L11.586 11 6.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              <svg className="w-4 h-4 text-amber-300/80 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <span className="truncate">{node.name}</span>
            </div>
          </button>
        );

        if (!expanded) return [dirRow];
        return [dirRow, ...renderTreeNodes(node.children)];
      }

      return [
        <button
          key={`file:${node.path}`}
          onClick={() => setSelectedFilePath(node.path)}
          className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
            selectedFile?.path === node.path
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
          style={{ paddingLeft: `${24 + node.depth * 14}px` }}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate">{node.name}</span>
          </div>
        </button>,
      ];
    });
  };

  const lines = selectedFile?.content.split("\n") || [];

  // Code viewer is always dark-themed (industry standard for code editors)
  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 99999 }}
      className="bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-7xl h-[90vh] bg-[#0f172a] rounded-2xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={handleClose} />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <h2 className="text-lg font-semibold text-white">Project Code</h2>
            <span className="text-sm text-slate-400">
              {files.length} files
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Copy button */}
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            {/* Close button */}
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-64 border-r border-slate-700 bg-[#020617]/50 flex flex-col">
            <div className="p-3 border-b border-slate-700">
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {fileTree.length > 0 ? (
                <div className="space-y-0.5">{renderTreeNodes(fileTree)}</div>
              ) : (
                <div className="px-3 py-3 text-sm text-slate-500">
                  No files found
                </div>
              )}
            </div>
          </div>

          {/* Code Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* File Tab */}
            {selectedFile && (
              <div className="px-4 py-3 border-b border-slate-700 bg-[#0f172a]/50 flex-shrink-0">
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-white font-medium">{selectedFile.path}</span>
                  <span className="text-slate-500 text-xs">{lines.length} lines</span>
                </div>
              </div>
            )}

            {/* Code Display */}
            <div className="flex-1 overflow-auto bg-[#0d1117]">
              {selectedFile ? (
                <table className="w-full border-collapse" style={{ fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace", fontSize: 13, lineHeight: "20px" }}>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="hover:bg-slate-800/50">
                        <td
                          className="select-none text-right pr-4 pl-4 text-slate-600 align-top"
                          style={{ width: 1, whiteSpace: "nowrap", userSelect: "none" }}
                        >
                          {i + 1}
                        </td>
                        <td className="pr-4">
                          <pre className="m-0 text-slate-300 whitespace-pre" style={{ tabSize: 2 }}>
                            <code dangerouslySetInnerHTML={{ __html: highlightLine(line) || " " }} />
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  Select a file to view
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
