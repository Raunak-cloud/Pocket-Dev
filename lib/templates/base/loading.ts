import type { WebsiteConfig } from "../types";

export function renderLoading(config: WebsiteConfig): string {
  const isDark = config.theme.background === "dark";
  const p = config.theme.primary;

  return `export default function Loading() {
  return (
    <>
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-1 ${isDark ? "bg-gray-900" : "bg-gray-100"}">
        <div className="h-full bg-${p}-600 loading-bar rounded-r-full" />
      </div>

      {/* Center spinner */}
      <div className="min-h-screen flex items-center justify-center ${isDark ? "bg-gray-950" : "bg-white"}">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-${p}-200 border-t-${p}-600 rounded-full animate-spin" />
          <p className="${isDark ? "text-gray-400" : "text-gray-500"} text-sm">Loading...</p>
        </div>
      </div>
    </>
  );
}
`;
}
