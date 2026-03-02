"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────

interface OverviewData {
  totalPageviews: number;
  totalVisitors: number;
  publishedProjects: number;
  projects: ProjectSummary[];
  daily: DailyPoint[];
  tokenUsage: TokenPoint[];
}

interface ProjectSummary {
  id: string;
  prompt: string;
  publishedUrl: string | null;
  publishedAt: string | null;
  pageviews: number;
  visitors: number;
}

interface ProjectDetail {
  totalPageviews: number;
  totalVisitors: number;
  daily: DailyPoint[];
  topPages: { pathname: string; count: number }[];
  devices: NameCount[];
  sources: NameCount[];
  browsers: NameCount[];
  countries: NameCount[];
}

interface DailyPoint {
  date: string;
  pageviews: number;
  visitors: number;
}

interface TokenPoint {
  date: string;
  credits: number;
  deductions: number;
}

interface NameCount {
  name: string;
  count: number;
}

type Range = "7d" | "30d" | "90d";

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6366f1"];

// ── Component ────────────────────────────────────────────────────

export default function AnalyticsContent() {
  const [range, setRange] = useState<Range>("7d");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/overview?range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const data = await res.json();
      setOverview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [range]);

  const fetchProjectDetail = useCallback(
    async (projectId: string) => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/analytics/${projectId}?range=${range}`);
        if (!res.ok) throw new Error("Failed to fetch project analytics");
        const data = await res.json();
        setProjectDetail(data);
      } catch {
        setProjectDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectDetail(selectedProject);
    } else {
      setProjectDetail(null);
    }
  }, [selectedProject, fetchProjectDetail]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchOverview}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (!overview || overview.publishedProjects === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-bg-tertiary flex items-center justify-center">
            <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text-primary">No published projects yet</h3>
          <p className="text-sm text-text-muted">
            Publish a project to Vercel to start tracking analytics. Pageviews, visitors, and more will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  const totalTokenUsage = overview.tokenUsage.reduce((sum, t) => sum + t.deductions, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
          {(["7d", "30d", "90d"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                range === r
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Visitors" value={overview.totalVisitors} icon="users" />
        <StatCard label="Total Pageviews" value={overview.totalPageviews} icon="eye" />
        <StatCard label="Published Projects" value={overview.publishedProjects} icon="globe" />
        <StatCard label="Tokens Used" value={Number(totalTokenUsage.toFixed(2))} icon="zap" />
      </div>

      {/* Visitors Over Time */}
      {overview.daily.length > 0 && (
        <div className="bg-bg-tertiary/50 border border-border-secondary/40 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Visitors Over Time</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={overview.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#aaa" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="pageviews" stroke="#3b82f6" strokeWidth={2} dot={false} name="Pageviews" />
              <Line type="monotone" dataKey="visitors" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Visitors" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Project Table */}
      <div className="bg-bg-tertiary/50 border border-border-secondary/40 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Projects</h2>
        <div className="space-y-2">
          {overview.projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl text-left transition ${
                selectedProject === p.id
                  ? "bg-blue-600/10 border border-blue-500/25"
                  : "hover:bg-bg-tertiary border border-transparent"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {p.prompt}
                </p>
                {p.publishedUrl && (
                  <p className="text-xs text-text-muted truncate mt-0.5">{p.publishedUrl}</p>
                )}
              </div>
              <div className="flex gap-4 text-right shrink-0">
                <div>
                  <p className="text-sm font-semibold text-text-primary tabular-nums">{p.visitors}</p>
                  <p className="text-[10px] text-text-muted">visitors</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary tabular-nums">{p.pageviews}</p>
                  <p className="text-[10px] text-text-muted">views</p>
                </div>
              </div>
              <svg
                className={`w-4 h-4 text-text-muted transition-transform ${selectedProject === p.id ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Project Detail Panel */}
      {selectedProject && (
        <ProjectDetailPanel detail={projectDetail} loading={detailLoading} />
      )}

      {/* Token Usage */}
      {overview.tokenUsage.length > 0 && (
        <div className="bg-bg-tertiary/50 border border-border-secondary/40 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Token Usage</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={overview.tokenUsage}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#aaa" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="credits" fill="#10b981" name="Credits" radius={[4, 4, 0, 0]} />
              <Bar dataKey="deductions" fill="#ef4444" name="Deductions" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    users: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    eye: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    globe: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    zap: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  };

  return (
    <div className="bg-bg-tertiary/50 border border-border-secondary/40 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2 text-text-muted">{icons[icon]}<span className="text-xs">{label}</span></div>
      <p className="text-2xl font-bold text-text-primary tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function ProjectDetailPanel({ detail, loading }: { detail: ProjectDetail | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-bg-tertiary/50 border border-border-secondary/40 rounded-2xl p-5 flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top Pages */}
      {detail.topPages.length > 0 && (
        <div className="bg-bg-tertiary/50 border border-border-secondary/40 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Top Pages</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={detail.topPages} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fill: "#888", fontSize: 11 }} />
              <YAxis dataKey="pathname" type="category" tick={{ fill: "#888", fontSize: 11 }} width={120} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Traffic Sources */}
      {detail.sources.length > 0 && (
        <div className="bg-bg-tertiary/50 border border-border-secondary/40 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Traffic Sources</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={detail.sources} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fill: "#888", fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: "#888", fontSize: 11 }} width={120} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Device Breakdown */}
      {detail.devices.length > 0 && (
        <div className="bg-bg-tertiary/50 border border-border-secondary/40 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Devices</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={detail.devices} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {detail.devices.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Browser Breakdown */}
      {detail.browsers.length > 0 && (
        <div className="bg-bg-tertiary/50 border border-border-secondary/40 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Browsers</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={detail.browsers} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {detail.browsers.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Countries */}
      {detail.countries.length > 0 && (
        <div className="bg-bg-tertiary/50 border border-border-secondary/40 rounded-2xl p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Countries</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {detail.countries.map((c) => (
              <div key={c.name} className="flex items-center justify-between px-3 py-2 bg-bg-primary/50 rounded-lg">
                <span className="text-xs text-text-secondary">{c.name}</span>
                <span className="text-xs font-semibold text-text-primary tabular-nums">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
