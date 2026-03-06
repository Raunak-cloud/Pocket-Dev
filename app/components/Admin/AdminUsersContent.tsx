"use client";

import { useState, useEffect, useCallback } from "react";
import CodeViewer from "@/app/components/CodeViewer";

interface AdminUser {
  id: string;
  authUserId: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  lastLoginAt: string;
  projectCount: number;
  appTokens: number;
  integrationTokens: number;
  banned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  _count: { projects: number };
}

interface AdminProject {
  id: string;
  userId: string;
  prompt: string;
  files: Array<{ path: string; content: string }>;
  dependencies: Record<string, string>;
  lintReport: { passed: boolean; errors: number; warnings: number };
  config: unknown;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  publishedUrl: string | null;
  deploymentId: string | null;
  publishedAt: string | null;
  customDomain: string | null;
  tier: string | null;
  paidAt: string | null;
}

interface Props {
  onEditProject: (project: AdminProject) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function getInitials(name: string | null, email: string | null) {
  if (name) return name.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function BanModal({
  user,
  onConfirm,
  onClose,
}: {
  user: AdminUser;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md bg-bg-secondary border border-border-primary rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-text-primary mb-1">Ban User</h3>
        <p className="text-sm text-text-muted mb-4">
          {user.displayName || user.email} will lose access immediately.
        </p>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Reason (optional)
        </label>
        <textarea
          className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-red-500/50"
          rows={3}
          placeholder="Violation reason..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-bg-tertiary text-text-secondary text-sm font-medium rounded-xl hover:bg-border-secondary transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition"
          >
            Ban User
          </button>
        </div>
      </div>
    </div>
  );
}

function UserProjectsPanel({
  user,
  onClose,
  onEditProject,
}: {
  user: AdminUser;
  onClose: () => void;
  onEditProject: (project: AdminProject) => void;
}) {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingCode, setViewingCode] = useState<AdminProject | null>(null);

  useEffect(() => {
    fetch(`/api/admin/users/${user.id}/projects`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .finally(() => setLoading(false));
  }, [user.id]);

  if (viewingCode) {
    return (
      <CodeViewer
        files={viewingCode.files}
        onClose={() => setViewingCode(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-3xl bg-bg-secondary border border-border-primary rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-primary flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              getInitials(user.displayName, user.email)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">
              {user.displayName || "Anonymous"}
            </p>
            <p className="text-xs text-text-muted truncate">{user.email}</p>
          </div>
          <span className="text-xs text-text-muted">{projects.length} projects</span>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-text-muted text-sm">No projects yet.</p>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="bg-bg-primary/50 border border-border-primary rounded-xl p-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary line-clamp-2 font-medium mb-1.5">
                    {project.prompt.replace(/\n\n[🔷🔸📷📄🖼️][\s\S]*/, "").slice(0, 120)}
                  </p>
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs text-text-muted">{formatRelative(project.createdAt)}</span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-muted">
                      {Array.isArray(project.files) ? project.files.length : 0} files
                    </span>
                    {project.isPublished && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-medium text-emerald-400">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                        Published
                      </span>
                    )}
                    {project.tier === "premium" && (
                      <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-medium text-amber-400">
                        Premium
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setViewingCode(project)}
                    className="px-3 py-1.5 bg-bg-tertiary hover:bg-border-secondary text-text-secondary text-xs font-medium rounded-lg transition flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                    Code
                  </button>
                  <button
                    onClick={() => {
                      onEditProject(project);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersContent({ onEditProject }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "banned" | "restricted">("all");
  const [expandedUser, setExpandedUser] = useState<AdminUser | null>(null);
  const [banModalUser, setBanModalUser] = useState<AdminUser | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const patchUser = useCallback(async (userId: string, patch: Record<string, unknown>) => {
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, ...data.user } : u))
        );
      }
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const handleBanConfirm = useCallback(async (reason: string) => {
    if (!banModalUser) return;
    await patchUser(banModalUser.id, { banned: true, bannedReason: reason });
    setBanModalUser(null);
  }, [banModalUser, patchUser]);

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "banned" && u.banned);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0 flex-wrap">
        <div className="flex-1 min-w-[180px] relative">
          <svg className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-border-secondary"
          />
        </div>
        <div className="flex rounded-xl overflow-hidden border border-border-primary text-xs font-medium">
          {(["all", "banned"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 capitalize transition ${filter === f ? "bg-blue-600 text-white" : "bg-bg-tertiary text-text-muted hover:text-text-secondary"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={loadUsers}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-xl border border-border-primary transition"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4 flex-shrink-0">
        {[
          { label: "Total Users", value: users.length, color: "text-blue-400" },
          { label: "Banned", value: users.filter((u) => u.banned).length, color: "text-red-400" },
          { label: "Active", value: users.filter((u) => !u.banned).length, color: "text-emerald-400" },
          { label: "Total Projects", value: users.reduce((s, u) => s + u._count.projects, 0), color: "text-violet-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg-secondary/50 border border-border-primary rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-text-muted mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* User table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-text-muted text-sm">No users found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((user) => {
              const isUpdating = updatingId === user.id;
              return (
                <div
                  key={user.id}
                  className={`bg-bg-secondary/50 border rounded-xl overflow-hidden transition ${user.banned ? "border-red-500/30" : "border-border-primary"}`}
                >
                  {/* User row */}
                  <div className="flex items-center gap-3 p-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                        {user.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.photoURL} alt="" className="w-9 h-9 object-cover" />
                        ) : (
                          getInitials(user.displayName, user.email)
                        )}
                      </div>
                      {user.banned && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-bg-secondary" />
                      )}
                    </div>

                    {/* Identity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {user.displayName || "Anonymous"}
                        </span>
                        {user.banned && (
                          <span className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] font-semibold text-red-400 uppercase tracking-wide">
                            Banned
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted truncate">{user.email}</p>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-5 text-center flex-shrink-0">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{user._count.projects}</p>
                        <p className="text-[10px] text-text-muted">Projects</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{user.appTokens.toFixed(1)}</p>
                        <p className="text-[10px] text-text-muted">Tokens</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">{formatDate(user.createdAt)}</p>
                        <p className="text-[10px] text-text-muted">Joined</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setExpandedUser(user)}
                        className="px-3 py-1.5 bg-bg-tertiary hover:bg-border-secondary text-text-secondary text-xs font-medium rounded-lg transition flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                        </svg>
                        Projects
                      </button>

                      {/* Ban / Unban */}
                      {user.banned ? (
                        <button
                          disabled={isUpdating}
                          onClick={() => patchUser(user.id, { banned: false })}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          disabled={isUpdating}
                          onClick={() => setBanModalUser(user)}
                          className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ban reason */}
                  {user.banned && user.bannedReason && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                        <span className="font-medium">Ban reason:</span> {user.bannedReason}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* User projects panel */}
      {expandedUser && (
        <UserProjectsPanel
          user={expandedUser}
          onClose={() => setExpandedUser(null)}
          onEditProject={onEditProject}
        />
      )}

      {/* Ban confirmation modal */}
      {banModalUser && (
        <BanModal
          user={banModalUser}
          onConfirm={handleBanConfirm}
          onClose={() => setBanModalUser(null)}
        />
      )}
    </div>
  );
}
