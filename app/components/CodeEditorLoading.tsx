"use client";

interface CodeEditorLoadingProps {
  message?: string;
}

export default function CodeEditorLoading({
  message = "Installing dependencies...",
}: CodeEditorLoadingProps) {
  const codeLines = [
    "$ npm install",
    `# ${message}`,
    "",
    "⠋ reify:framer-motion: timing reifyNode:node_modules/framer-motion",
    "⠙ reify:react-scroll-parallax: timing reifyNode:node_modules/react",
    "⠹ reify:lucide-react: timing reifyNode:node_modules/lucide-react",
    "⠸ reify:tailwindcss: timing reifyNode:node_modules/tailwindcss",
    "",
    "added 324 packages, and audited 325 packages in 45s",
    "",
    "89 packages are looking for funding",
    "  run `npm fund` for details",
    "",
    "found 0 vulnerabilities",
  ];

  return (
    <div className="w-full border-t border-border-secondary bg-bg-secondary/95 backdrop-blur-xl rounded-lg">
      <div className="px-4 py-4">
        {/* Code editor simulation - always dark themed */}
        <div className="bg-[#0d1117] rounded-lg p-4 font-mono text-xs md:text-sm border border-slate-800 max-h-56 overflow-y-auto">
          {codeLines.length === 0 && (
            <div className="text-slate-500">No output...</div>
          )}
          {codeLines.map((line, i) => {
            const isCommand = line.startsWith("$");
            const isEmpty = line.trim() === "";
            const isSpinner =
              line.startsWith("⠋") ||
              line.startsWith("⠙") ||
              line.startsWith("⠹") ||
              line.startsWith("⠸");
            const isSuccess =
              line.includes("added") || line.includes("audited");
            const isFunding =
              line.includes("funding") || line.includes("npm fund");
            const isVulnerability = line.includes("vulnerabilities");

            return (
              <div
                key={i}
                className="py-0.5"
                style={{
                  animation: `fadeIn 0.6s ease-out forwards`,
                  animationDelay: `${i * 0.3}s`,
                  opacity: 0,
                }}
              >
                {isEmpty ? (
                  <div className="h-3" />
                ) : isCommand ? (
                  <div className="flex items-start gap-2">
                    <span className="text-slate-600 select-none">$</span>
                    <span className="text-emerald-400">
                      {line.substring(2)}
                    </span>
                  </div>
                ) : isSpinner ? (
                  <div className="flex items-start gap-2 text-blue-400">
                    <span className="animate-spin">{line.charAt(0)}</span>
                    <span className="text-slate-400">{line.substring(2)}</span>
                  </div>
                ) : (
                  <div
                    className={`${
                      isSuccess
                        ? "text-cyan-400 font-semibold"
                        : isFunding
                          ? "text-yellow-400/80"
                          : isVulnerability
                            ? "text-emerald-400 font-semibold"
                            : "text-slate-400"
                    }`}
                  >
                    {line}
                    {i === codeLines.length - 1 && (
                      <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse ml-1" />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Progress bar */}
          <div className="mt-3 pt-3 border-t border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500 rounded-full animate-progress"
                  style={{
                    animation: "progress 2s ease-in-out infinite",
                  }}
                />
              </div>
              <span className="text-xs text-slate-500 font-sans">
                This may take 1-2 minutes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes progress {
          0% {
            width: 0%;
          }
          50% {
            width: 60%;
          }
          100% {
            width: 90%;
          }
        }
      `}</style>
    </div>
  );
}
