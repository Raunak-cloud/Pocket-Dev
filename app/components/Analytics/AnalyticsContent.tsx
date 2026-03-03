"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AreaChart,
  Area,
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
} from "recharts";

// ── Types ────────────────────────────────────────────────────────

interface OverviewData {
  totalPageviews: number;
  totalVisitors: number;
  publishedProjects: number;
  projects: ProjectSummary[];
  daily: DailyPoint[];
  tokenUsage: TokenPoint[];
  revenue: RevenueOverview;
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

interface RevenueOverview {
  selectedYear: number;
  availableYears: number[];
  yearlyTotal: number;
  lifetimeTotal: number;
  monthly: RevenueMonthPoint[];
}

interface RevenueMonthPoint {
  month: string;
  tokenRevenue: number;
  premiumRevenue: number;
  revenue: number;
}

type Range = "7d" | "30d" | "90d";

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#4f46e5"];
const CHART_GRID_COLOR = "rgba(148, 163, 184, 0.08)";

const TOOLTIP_STYLE = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-secondary)",
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
};

// ── Helpers ──────────────────────────────────────────────────────

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function calcDelta(daily: DailyPoint[], key: "pageviews" | "visitors"): number | null {
  if (daily.length < 2) return null;
  const mid = Math.floor(daily.length / 2);
  const first = daily.slice(0, mid).reduce((s, d) => s + d[key], 0);
  const second = daily.slice(mid).reduce((s, d) => s + d[key], 0);
  if (first === 0) return second > 0 ? 100 : 0;
  return Math.round(((second - first) / first) * 100);
}

// ── Component ────────────────────────────────────────────────────

export default function AnalyticsContent() {
  const [range, setRange] = useState<Range>("7d");
  const [revenueYear, setRevenueYear] = useState<number | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (revenueYear !== null) params.set("year", String(revenueYear));
      const res = await fetch(`/api/analytics/overview?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const data = await res.json();
      setOverview(data);
      if (revenueYear === null && typeof data?.revenue?.selectedYear === "number") {
        setRevenueYear(data.revenue.selectedYear);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [range, revenueYear]);

  const fetchProjectDetail = useCallback(
    async (projectId: string) => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/analytics/${projectId}?range=${range}`);
        if (!res.ok) throw new Error("Failed to fetch project analytics");
        setProjectDetail(await res.json());
      } catch {
        setProjectDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [range],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (revenueYear !== null) params.set("year", String(revenueYear));
      const res = await fetch(`/api/analytics/overview?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const data = await res.json();
      setOverview(data);
      if (selectedProject) {
        const detailRes = await fetch(`/api/analytics/${selectedProject}?range=${range}`);
        if (detailRes.ok) setProjectDetail(await detailRes.json());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRefreshing(false);
    }
  }, [range, revenueYear, selectedProject]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => {
    if (selectedProject) fetchProjectDetail(selectedProject);
    else setProjectDetail(null);
  }, [selectedProject, fetchProjectDetail]);

  const visitorDelta = useMemo(
    () => overview ? calcDelta(overview.daily, "visitors") : null,
    [overview],
  );
  const pageviewDelta = useMemo(
    () => overview ? calcDelta(overview.daily, "pageviews") : null,
    [overview],
  );

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-indigo-500/20 rounded-full" />
            <div className="absolute inset-0 w-10 h-10 border-2 border-transparent border-t-indigo-500 rounded-full animate-spin" />
          </div>
          <p className="text-sm text-text-muted">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm text-text-muted">{error}</p>
          <button
            onClick={fetchOverview}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (!overview || overview.publishedProjects === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-5 max-w-md px-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/10 flex items-center justify-center">
            <svg className="w-9 h-9 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">No published projects yet</h3>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Publish a project to Vercel to start tracking analytics. Pageviews, visitors, and revenue will appear here automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalTokenUsage = overview.tokenUsage.reduce((sum, t) => sum + t.deductions, 0);
  const revenueData = overview.revenue;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Analytics</h1>
            <p className="text-sm text-text-muted mt-0.5">
              Track your published projects&apos; performance
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl border border-border-primary/30 bg-bg-tertiary/60 text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-all disabled:opacity-50"
              title="Refresh analytics"
            >
              <svg
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.656v4.992" />
              </svg>
            </button>
            <div className="flex gap-1 bg-bg-tertiary/60 rounded-xl p-1 border border-border-primary/30 overflow-x-auto">
              {(["7d", "30d", "90d"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    range === r
                      ? "bg-bg-secondary text-text-primary shadow-sm border border-border-primary/40"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Visitors"
            value={formatCompact(overview.totalVisitors)}
            delta={visitorDelta}
            icon={<IconUsers />}
            color="indigo"
            sparkData={overview.daily.map((d) => d.visitors)}
          />
          <MetricCard
            label="Pageviews"
            value={formatCompact(overview.totalPageviews)}
            delta={pageviewDelta}
            icon={<IconEye />}
            color="blue"
            sparkData={overview.daily.map((d) => d.pageviews)}
          />
          <MetricCard
            label="Published"
            value={String(overview.publishedProjects)}
            icon={<IconGlobe />}
            color="emerald"
          />
          <MetricCard
            label="Tokens Used"
            value={formatCompact(Math.round(totalTokenUsage))}
            icon={<IconZap />}
            color="amber"
          />
          <MetricCard
            label={`Revenue (${revenueData.selectedYear})`}
            value={formatCurrency(revenueData.yearlyTotal)}
            icon={<IconDollar />}
            color="green"
            sparkData={revenueData.monthly.map((m) => m.revenue)}
          />
        </div>

        {/* Traffic Chart */}
        {overview.daily.length > 0 && (
          <ChartCard title="Traffic Overview" subtitle="Visitors and pageviews over time">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={overview.daily}>
                <defs>
                  <linearGradient id="fillPageviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v + "T00:00:00");
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v: number) => formatCompact(v)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}
                  labelFormatter={(v) => {
                    const d = new Date(String(v) + "T00:00:00");
                    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pageviews"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#fillPageviews)"
                  name="Pageviews"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#fillVisitors)"
                  name="Visitors"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3 px-1">
              <LegendDot color="#6366f1" label="Pageviews" />
              <LegendDot color="#8b5cf6" label="Visitors" />
            </div>
          </ChartCard>
        )}

        {/* Revenue + Token Usage — side by side on large screens */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Revenue */}
          <ChartCard
            title="Revenue"
            subtitle="Monthly breakdown"
            headerRight={
              <select
                value={revenueData.selectedYear}
                onChange={(e) => setRevenueYear(Number.parseInt(e.target.value, 10))}
                className="bg-bg-tertiary/60 border border-border-primary/30 rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
              >
                {revenueData.availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueData.monthly} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}
                  formatter={(value) => formatCurrencyPrecise(Number(value))}
                />
                <Bar dataKey="tokenRevenue" fill="#6366f1" name="Token Revenue" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="premiumRevenue" fill="#10b981" name="Premium" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3 px-1">
              <LegendDot color="#6366f1" label="Token Revenue" />
              <LegendDot color="#10b981" label="Premium" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat label="Yearly" value={formatCurrencyPrecise(revenueData.yearlyTotal)} />
              <MiniStat label="Lifetime" value={formatCurrencyPrecise(revenueData.lifetimeTotal)} />
            </div>
          </ChartCard>

          {/* Token Usage */}
          {overview.tokenUsage.length > 0 && (
            <ChartCard title="Token Usage" subtitle="Credits earned vs tokens spent">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={overview.tokenUsage} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}
                  />
                  <Bar dataKey="credits" fill="#10b981" name="Credits" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="deductions" fill="#ef4444" name="Spent" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-5 mt-3 px-1">
                <LegendDot color="#10b981" label="Credits" />
                <LegendDot color="#ef4444" label="Spent" />
              </div>
            </ChartCard>
          )}
        </div>

        {/* Projects Table */}
        <ChartCard title="Projects" subtitle={`${overview.projects.length} published`}>
          {overview.projects.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">No published projects in this period</p>
          ) : (
            <div className="space-y-1">
              {overview.projects.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)}
                  className={`w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 rounded-xl text-left transition-all ${
                    selectedProject === p.id
                      ? "bg-indigo-500/8 ring-1 ring-indigo-500/20"
                      : "hover:bg-bg-tertiary/40"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-bg-tertiary/80 flex items-center justify-center text-xs font-semibold text-text-muted shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{p.prompt}</p>
                    {p.publishedUrl && (
                      <p className="text-xs text-text-muted truncate mt-0.5">{p.publishedUrl}</p>
                    )}
                  </div>
                  <div className="flex gap-4 sm:gap-6 text-right shrink-0 w-full sm:w-auto justify-end">
                    <div>
                      <p className="text-sm font-semibold text-text-primary tabular-nums">{p.visitors.toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">visitors</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary tabular-nums">{p.pageviews.toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">views</p>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-text-muted transition-transform duration-200 self-end sm:self-center ${selectedProject === p.id ? "rotate-180" : ""}`}
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
          )}
        </ChartCard>

        {/* Project Detail Panel */}
        {selectedProject && (
          <ProjectDetailPanel detail={projectDetail} loading={detailLoading} />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg-secondary/50 border border-border-primary/30 rounded-2xl p-3 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-5">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg-tertiary/40 border border-border-primary/20 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">{label}</p>
      <p className="text-base font-semibold text-text-primary mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  icon,
  color,
  sparkData,
}: {
  label: string;
  value: string;
  delta?: number | null;
  icon: React.ReactNode;
  color: string;
  sparkData?: number[];
}) {
  const colorMap: Record<string, { bg: string; text: string; spark: string }> = {
    indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", spark: "#6366f1" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-400", spark: "#3b82f6" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", spark: "#10b981" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", spark: "#f59e0b" },
    green: { bg: "bg-green-500/10", text: "text-green-400", spark: "#22c55e" },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div className="bg-bg-secondary/50 border border-border-primary/30 rounded-2xl p-3 sm:p-4 relative overflow-hidden">
      {/* Sparkline background */}
      {sparkData && sparkData.length > 2 && (
        <div className="absolute bottom-0 left-0 right-0 h-12 opacity-30">
          <Sparkline data={sparkData} color={c.spark} />
        </div>
      )}
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.text} flex items-center justify-center`}>
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold text-text-primary tabular-nums tracking-tight">{value}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-text-muted">{label}</p>
          {delta !== null && delta !== undefined && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
              delta >= 0
                ? "text-emerald-400 bg-emerald-500/10"
                : "text-red-400 bg-red-500/10"
            }`}>
              {delta >= 0 ? "+" : ""}{delta}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (v / max) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        points={points}
      />
      <polygon
        fill={`url(#spark-${color})`}
        points={`0,100 ${points} 100,100`}
      />
    </svg>
  );
}

function ProjectDetailPanel({ detail, loading }: { detail: ProjectDetail | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-bg-secondary/50 border border-border-primary/30 rounded-2xl p-5 flex items-center justify-center min-h-[200px]">
        <div className="relative">
          <div className="w-8 h-8 border-2 border-indigo-500/20 rounded-full" />
          <div className="absolute inset-0 w-8 h-8 border-2 border-transparent border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top Pages */}
      {detail.topPages.length > 0 && (
        <ChartCard title="Top Pages" subtitle="Most visited paths">
          <div className="space-y-2">
            {detail.topPages.map((page, i) => {
              const maxCount = detail.topPages[0]?.count || 1;
              const pct = (page.count / maxCount) * 100;
              return (
                <div key={page.pathname} className="flex items-center gap-3">
                  <span className="text-xs text-text-muted w-5 text-right tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary font-medium truncate">{page.pathname}</span>
                      <span className="text-xs text-text-muted tabular-nums ml-2 shrink-0">{page.count}</span>
                    </div>
                    <div className="h-1.5 bg-bg-tertiary/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500/60 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* Traffic Sources */}
      {detail.sources.length > 0 && (
        <ChartCard title="Traffic Sources" subtitle="Where visitors come from">
          <div className="space-y-2">
            {detail.sources.map((src, i) => {
              const maxCount = detail.sources[0]?.count || 1;
              const pct = (src.count / maxCount) * 100;
              return (
                <div key={src.name} className="flex items-center gap-3">
                  <span className="text-xs text-text-muted w-5 text-right tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary font-medium truncate">{src.name}</span>
                      <span className="text-xs text-text-muted tabular-nums ml-2 shrink-0">{src.count}</span>
                    </div>
                    <div className="h-1.5 bg-bg-tertiary/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500/60 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* Devices */}
      {detail.devices.length > 0 && (
        <ChartCard title="Devices" subtitle="Visitor device breakdown">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={detail.devices}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {detail.devices.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {detail.devices.map((d, i) => {
                const total = detail.devices.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                return (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-text-secondary capitalize flex-1">{d.name}</span>
                    <span className="text-xs font-semibold text-text-primary tabular-nums">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>
      )}

      {/* Browsers */}
      {detail.browsers.length > 0 && (
        <ChartCard title="Browsers" subtitle="Browser distribution">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={detail.browsers}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {detail.browsers.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {detail.browsers.map((b, i) => {
                const total = detail.browsers.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
                return (
                  <div key={b.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-text-secondary flex-1">{b.name}</span>
                    <span className="text-xs font-semibold text-text-primary tabular-nums">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>
      )}

      {/* Countries */}
      {detail.countries.length > 0 && (
        <div className="lg:col-span-2">
          <ChartCard title="Countries" subtitle="Top visitor locations">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {detail.countries.map((c, i) => {
                const maxCount = detail.countries[0]?.count || 1;
                const opacity = 0.3 + (c.count / maxCount) * 0.7;
                return (
                  <div
                    key={c.name}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-bg-tertiary/30 border border-border-primary/20 transition-colors hover:bg-bg-tertiary/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-text-muted w-4 text-right tabular-nums">{i + 1}</span>
                      <span className="text-xs text-text-secondary truncate">{c.name}</span>
                    </div>
                    <span
                      className="text-xs font-semibold text-indigo-400 tabular-nums ml-2 shrink-0"
                      style={{ opacity }}
                    >
                      {c.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────

function IconUsers() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
