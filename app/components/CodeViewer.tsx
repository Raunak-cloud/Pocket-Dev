"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface GeneratedFile {
  path: string;
  content: string;
}

interface CodeViewerProps {
  files: GeneratedFile[];
  onClose: () => void;
}

export default function CodeViewer({ files, onClose }: CodeViewerProps) {
  const [selectedFile, setSelectedFile] = useState(files[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

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

  // Group files by directory
  const filesByDirectory = filteredFiles.reduce(
    (acc, file) => {
      const dir = file.path.includes("/") ? file.path.split("/")[0] : "root";
      if (!acc[dir]) acc[dir] = [];
      acc[dir].push(file);
      return acc;
    },
    {} as Record<string, GeneratedFile[]>
  );

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
              {Object.entries(filesByDirectory).map(([dir, dirFiles]) => (
                <div key={dir} className="mb-3">
                  <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {dir}
                  </div>
                  {dirFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedFile?.path === file.path
                          ? "bg-blue-600 text-white"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate">{file.path.split("/").pop()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
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
