"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

interface DashboardSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  onBuyTokens?: () => void;
  unreadTicketCount?: number;
}

export default function DashboardSidebar({
  activeSection,
  onSectionChange,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
  onBuyTokens,
  unreadTicketCount,
}: DashboardSidebarProps) {
  const router = useRouter();
  const { user, userData, signOut } = useAuth();
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isCollapsed =
    externalIsCollapsed !== undefined
      ? externalIsCollapsed
      : internalIsCollapsed;
  const toggleCollapse = () => {
    const newValue = !isCollapsed;
    if (onToggleCollapse) {
      onToggleCollapse(newValue);
    } else {
      setInternalIsCollapsed(newValue);
    }
  };

  if (!user) return null;

  const appTokens = userData?.appTokens || 0;
  const projectCount = userData?.projectCount || 0;

  return (
    <div
      className={`flex flex-col h-full bg-bg-primary/80 backdrop-blur-xl border-r border-border-primary/60 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-72"
      }`}
    >
      {/* Header / Brand */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border-primary/60">
        <button
          onClick={() => onSectionChange("create")}
          className={`flex items-center gap-3 hover:opacity-80 transition ${isCollapsed ? "justify-center w-full" : ""}`}
        >
          <Logo size={30} />
          {!isCollapsed && (
            <div>
              <span className="font-bold text-text-primary text-base tracking-tight">
                Pocket Dev
              </span>
              <span className="block text-[10px] text-text-muted font-medium -mt-0.5">
                Build apps with AI
              </span>
            </div>
          )}
        </button>
        <button
          onClick={toggleCollapse}
          className={`p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition ${
            isCollapsed ? "hidden" : ""
          }`}
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
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <button
          onClick={toggleCollapse}
          className="mx-auto mt-3 p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition"
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
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-5 pb-3 space-y-1.5 overflow-y-auto">
        {!isCollapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-faint">
            Menu
          </p>
        )}

        {/* Create App */}
        <button
          onClick={() => onSectionChange("create")}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
            activeSection === "create"
              ? "bg-gradient-to-r from-blue-600/20 to-violet-600/10 text-blue-400 border border-blue-500/25 shadow-lg shadow-blue-500/5"
              : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/60"
          } ${isCollapsed ? "justify-center" : ""}`}
          title={isCollapsed ? "Create App" : undefined}
        >
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition ${
              activeSection === "create"
                ? "bg-blue-500/15"
                : "bg-bg-tertiary/80 group-hover:bg-border-secondary/80"
            }`}
          >
            <svg
              className="w-4.5 h-4.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </div>
          {!isCollapsed && (
            <span className="text-sm font-medium">Create App</span>
          )}
        </button>

        {/* My Projects */}
        <button
          onClick={() => onSectionChange("projects")}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
            activeSection === "projects"
              ? "bg-gradient-to-r from-blue-600/20 to-violet-600/10 text-blue-400 border border-blue-500/25 shadow-lg shadow-blue-500/5"
              : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/60"
          } ${isCollapsed ? "justify-center" : ""}`}
          title={isCollapsed ? "My Projects" : undefined}
        >
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition ${
              activeSection === "projects"
                ? "bg-blue-500/15"
                : "bg-bg-tertiary/80 group-hover:bg-border-secondary/80"
            }`}
          >
            <svg
              className="w-4.5 h-4.5"
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
          {!isCollapsed && (
            <>
              <span className="text-sm font-medium flex-1 text-left">
                My Projects
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">
                {projectCount}
              </span>
            </>
          )}
        </button>

        {/* Support */}
        <button
          onClick={() => onSectionChange("support")}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
            activeSection === "support"
              ? "bg-gradient-to-r from-blue-600/20 to-violet-600/10 text-blue-400 border border-blue-500/25 shadow-lg shadow-blue-500/5"
              : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/60"
          } ${isCollapsed ? "justify-center" : ""}`}
          title={isCollapsed ? "Support" : undefined}
        >
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition ${
              activeSection === "support"
                ? "bg-blue-500/15"
                : "bg-bg-tertiary/80 group-hover:bg-border-secondary/80"
            }`}
          >
            <svg
              className="w-4.5 h-4.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9.014 9.014 0 00-9.424 0M19.67 7.288l-4.138 3.448m4.138-3.448a9.014 9.014 0 010 9.424m-4.138-5.976a3.736 3.736 0 00-.88-1.388 3.737 3.737 0 00-1.388-.88m2.268 2.268a3.765 3.765 0 010 2.528m-2.268-4.796a3.765 3.765 0 00-2.528 0m4.796 4.796c-.181.506-.475.982-.88 1.388a3.736 3.736 0 01-1.388.88m2.268-2.268l4.138 3.448m0 0a9.027 9.027 0 01-1.306 1.652c-.51.51-1.064.944-1.652 1.306m0 0l-3.448-4.138m3.448 4.138a9.014 9.014 0 01-9.424 0m5.976-4.138a3.765 3.765 0 01-2.528 0m0 0a3.736 3.736 0 01-1.388-.88 3.737 3.737 0 01-.88-1.388m0 0a3.765 3.765 0 010-2.528m2.268 4.796l-4.138 3.448m0 0a9.027 9.027 0 01-1.652-1.306 9.027 9.027 0 01-1.306-1.652m0 0l4.138-3.448M4.33 16.712a9.014 9.014 0 010-9.424m4.138 5.976a3.765 3.765 0 010-2.528m0 0c.181-.506.475-.982.88-1.388a3.736 3.736 0 011.388-.88m-2.268 2.268L4.33 7.288m6.406 1.18L7.288 4.33m0 0a9.027 9.027 0 00-1.652 1.306A9.027 9.027 0 004.33 7.288"
              />
            </svg>
          </div>
          {!isCollapsed && (
            <>
              <span className="text-sm font-medium flex-1 text-left">Support</span>
              {unreadTicketCount && unreadTicketCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                  {unreadTicketCount}
                </span>
              )}
            </>
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => onSectionChange("settings")}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
            activeSection === "settings"
              ? "bg-gradient-to-r from-blue-600/20 to-violet-600/10 text-blue-400 border border-blue-500/25 shadow-lg shadow-blue-500/5"
              : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/60"
          } ${isCollapsed ? "justify-center" : ""}`}
          title={isCollapsed ? "Settings" : undefined}
        >
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition ${
              activeSection === "settings"
                ? "bg-blue-500/15"
                : "bg-bg-tertiary/80 group-hover:bg-border-secondary/80"
            }`}
          >
            <svg
              className="w-4.5 h-4.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          {!isCollapsed && (
            <span className="text-sm font-medium">Settings</span>
          )}
        </button>

        {/* Admin (only for admin user) */}
        {user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
          <button
            onClick={() => onSectionChange("admin")}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
              activeSection === "admin"
                ? "bg-gradient-to-r from-amber-600/20 to-orange-600/10 text-amber-400 border border-amber-500/25 shadow-lg shadow-amber-500/5"
                : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/60"
            } ${isCollapsed ? "justify-center" : ""}`}
            title={isCollapsed ? "Admin" : undefined}
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition ${
                activeSection === "admin"
                  ? "bg-amber-500/15"
                  : "bg-bg-tertiary/80 group-hover:bg-border-secondary/80"
              }`}
            >
              <svg
                className="w-4.5 h-4.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            {!isCollapsed && (
              <span className="text-sm font-medium">Admin</span>
            )}
          </button>
        )}
      </nav>

      {/* Theme Toggle */}
      {!isCollapsed ? (
        <div className="px-4 pb-2">
          <ThemeToggle className="w-full justify-center" size={16} />
        </div>
      ) : (
        <div className="flex justify-center pb-2">
          <ThemeToggle size={16} />
        </div>
      )}

      {/* Token Balances Card */}
      {!isCollapsed && (
        <div className="px-4 pb-4">
          <div className="p-4 bg-gradient-to-br from-bg-tertiary/80 to-bg-secondary/60 rounded-2xl border border-border-secondary/40 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Token Balance
              </p>
            </div>

            {/* App Tokens */}
            <div className="group relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <svg
                      className="w-3.5 h-3.5 text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary leading-none">
                      App Tokens
                    </p>
                    <p className="text-[10px] text-text-faint mt-0.5">
                      2 per project
                    </p>
                  </div>
                </div>
                <span
                  className={`text-lg font-bold tabular-nums ${appTokens > 0 ? "text-blue-400" : "text-red-400"}`}
                >
                  {appTokens}
                </span>
              </div>
            </div>

            {/* Buy Tokens Button */}
            <button
              onClick={() => onBuyTokens?.()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Buy Tokens
            </button>
          </div>
        </div>
      )}

      {/* User Profile */}
      <div className="relative px-3 pb-4 pt-3 border-t border-border-primary/60">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-bg-tertiary/50 transition ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "User"}
              className="w-9 h-9 rounded-full ring-2 ring-border-secondary/50"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <span className="text-sm font-bold text-white">
                {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
              </span>
            </div>
          )}
          {!isCollapsed && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {user.displayName || "User"}
              </p>
              <p className="text-[11px] text-text-muted truncate">
                {user.email}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <svg
              className={`w-4 h-4 text-text-muted transition-transform ${showUserMenu ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </button>

        {/* User Dropdown Menu */}
        {showUserMenu && (
          <div
            className={`absolute bottom-full mb-2 bg-bg-tertiary border border-border-secondary/60 rounded-xl shadow-2xl shadow-black/40 overflow-hidden ${
              isCollapsed ? "left-full ml-2" : "left-3 right-3"
            }`}
          >
            <div className="p-1.5">
              <button
                onClick={() => {
                  onSectionChange("settings");
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-border-secondary/60 rounded-lg transition"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
                Profile
              </button>
              <div className="mx-2 my-1 border-t border-border-secondary/40" />
              <button
                onClick={async () => {
                  await signOut();
                  setShowUserMenu(false);
                  window.location.href = "/";
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                  />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
