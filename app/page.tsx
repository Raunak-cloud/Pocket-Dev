// app/page.tsx
"use client";

import { useState } from "react";
import { searchVectorDB, generateWebsiteTemplate, type SearchResult } from "./actions";

export default function VectorSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [viewMode, setViewMode] = useState<"search" | "template">("search");
  const [templateResult, setTemplateResult] = useState<SearchResult | null>(null);

  const isTemplateQuery = (text: string): boolean => {
    const templateRegex = /\b(generate|create|build)\b.*\b(website|site|template)\b/i;
    return templateRegex.test(text);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setStatus("loading");
    setError("");
    setViewMode("search");

    // Check if this is a template query
    if (isTemplateQuery(query)) {
      const response = await generateWebsiteTemplate(query);
      if (response.success && response.data && response.data.length > 0) {
        setTemplateResult(response.data[0]);
        setViewMode("template");
        setStatus("idle");
      } else {
        setError(response.error || "Unknown error");
        setStatus("error");
      }
    } else {
      const response = await searchVectorDB(query);
      if (response.success && response.data) {
        setResults(response.data);
        setStatus("idle");
      } else {
        setError(response.error || "Unknown error");
        setStatus("error");
      }
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return "text-green-600 bg-green-50";
    if (score >= 0.4) return "text-yellow-600 bg-yellow-50";
    return "text-gray-600 bg-gray-50";
  };

  const downloadTemplate = (htmlContent: string, templateType: string) => {
    const element = document.createElement("a");
    const file = new Blob([htmlContent], { type: "text/html" });
    element.href = URL.createObjectURL(file);
    element.download = `${templateType}-template.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const resetToSearch = () => {
    setViewMode("search");
    setTemplateResult(null);
    setResults([]);
    setQuery("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Vector Search
          </h1>
          <p className="text-slate-600">
            Search your knowledge base using semantic similarity
          </p>
        </header>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents or generate a website template (e.g., 'create ecommerce site')..."
              className="w-full p-4 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black text-lg"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {status === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Searching...
                </span>
              ) : (
                "Search"
              )}
            </button>
          </div>
        </form>

        {status === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
            <p className="text-red-700 font-medium">Error: {error}</p>
          </div>
        )}

        {viewMode === "template" && templateResult && templateResult.htmlContent && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {templateResult.templateType === "business"
                      ? "Business Website Template"
                      : "Ecommerce Store Template"}
                  </h2>
                  <p className="text-slate-600 text-lg">
                    {templateResult.text}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(templateResult.score)}`}
                >
                  {(templateResult.score * 100).toFixed(1)}% match
                </span>
              </div>

              {templateResult.features && (
                <div className="mb-6">
                  <h3 className="font-semibold text-slate-900 mb-3">
                    Features:
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {templateResult.features.split(",").map((feature, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                      >
                        {feature.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-semibold text-slate-900 mb-3">Preview:</h3>
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
                  <iframe
                    srcDoc={templateResult.htmlContent}
                    className="w-full h-96 border-0"
                    sandbox="allow-same-origin"
                    title="Template Preview"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    downloadTemplate(
                      templateResult.htmlContent!,
                      templateResult.templateType || "website"
                    )
                  }
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-xl transition-all"
                >
                  Download Template
                </button>
                <button
                  onClick={resetToSearch}
                  className="bg-slate-300 hover:bg-slate-400 text-slate-900 font-semibold py-2 px-6 rounded-xl transition-all"
                >
                  New Search
                </button>
              </div>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">
              Results ({results.length})
            </h2>
            {results.map((result, index) => (
              <div
                key={result.id}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-slate-300">
                      {index + 1}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(result.score)}`}
                    >
                      {(result.score * 100).toFixed(1)}% match
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {result.id}
                  </span>
                </div>

                <p className="text-slate-800 text-lg mb-4 leading-relaxed">
                  {result.text}
                </p>

                <div className="flex gap-4 text-sm">
                  {result.category && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Category:</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                        {result.category}
                      </span>
                    </div>
                  )}
                  {result.author && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Author:</span>
                      <span className="text-slate-700 font-medium">
                        {result.author}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {status === "idle" && results.length === 0 && query === "" && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-slate-300 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-slate-500 text-lg">
              Enter a search query to find relevant documents
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
