import {
  Activity, BarChart3, Bot, CheckCircle2, ClipboardList, Clock, LayoutDashboard,
  Loader2, LogOut, MapPinned, Menu, Moon, Send, Siren, Sparkles, Sun, ThumbsDown, ThumbsUp, Trophy, Users, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CategoryStatsPanel from "../components/CategoryStatsPanel";
import Layout from "../components/Layout";
import MapView from "../components/MapView";
import ReportDetailModal from "../components/ReportDetailModal";
import { SponsorBanner } from "../components/SponsorAd";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api, type ChatbotQuestion, type Report, type ReportStatus } from "../lib/api";

type Section = "overview" | "reports" | "map" | "stats" | "assistant" | "leaderboard";

const STATUS_BADGE: Record<ReportStatus, string> = {
  Reported:     "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  Acknowledged: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  Dispatched:   "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Resolved:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
};

const STATUS_DOT: Record<ReportStatus, string> = {
  Reported:     "bg-red-500",
  Acknowledged: "bg-cyan-500",
  Dispatched:   "bg-amber-500",
  Resolved:     "bg-emerald-500",
};

type StatFilterKey = "all" | "reported" | "acknowledged" | "dispatched" | "resolved";

// ── Small reusable report row, used by Report Management + stat drilldowns ──
function ReportRow({ report, onOpen }: { report: Report; onOpen: (id: string) => void }) {
  const age = Math.floor((Date.now() - report.timestamp) / 3_600_000);
  return (
    <button
      onClick={() => onOpen(report.id)}
      className="w-full flex items-center gap-3 rounded-xl surface-subtle px-3 py-2.5 text-left hover:opacity-80 transition"
    >
      <div className="h-10 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-white/10">
        {report.imageUrl
          ? <img src={report.imageUrl} alt="" className="h-full w-full object-cover" />
          : <div className="h-full flex items-center justify-center muted-2"><MapPinned size={14} /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium heading truncate">{report.type}</p>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[report.status]}`} />
        </div>
        <p className="text-xs muted-2 truncate">
          {report.reporterName} · {age < 1 ? "just now" : `${age}h ago`}
          {report.voteScore !== 0 && <span className={report.voteScore > 0 ? " text-[#00B4D8]" : " text-red-500"}> · {report.voteScore > 0 ? `+${report.voteScore}` : report.voteScore} votes</span>}
        </p>
      </div>
      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[report.status]}`}>
        {report.status}
      </span>
    </button>
  );
}

// ── Modal listing exactly the reports behind a clicked stat card ────────────
function StatListModal({
  title, reports, onClose, onOpenReport,
}: { title: string; reports: Report[]; onClose: () => void; onOpenReport: (id: string) => void }) {
  return (
    <div className="fixed inset-0 z-[2500] overflow-y-auto">
      <div className="absolute inset-0 bg-[#0A192F]/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative w-full sm:max-w-md surface rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-subtle flex-shrink-0">
            <h2 className="heading font-semibold text-sm">{title} <span className="muted font-normal">({reports.length})</span></h2>
            <button onClick={onClose} className="muted hover:text-heading p-1 rounded-lg transition"><X size={18} /></button>
          </div>
          <div className="overflow-y-auto p-3 space-y-2">
            {reports.length === 0 && <p className="muted text-sm text-center py-8">No reports in this category.</p>}
            {reports.map(r => <ReportRow key={r.id} report={r} onOpen={onOpenReport} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal for "tap a category, see its stats" ───────────────────────────────
function CategoryDrilldownModal({
  type, reports, onClose, onOpenReport,
}: { type: string; reports: Report[]; onClose: () => void; onOpenReport: (id: string) => void }) {
  const scoped = reports.filter(r => r.type === type).sort((a, b) => b.timestamp - a.timestamp);
  return (
    <div className="fixed inset-0 z-[2500] overflow-y-auto">
      <div className="absolute inset-0 bg-[#0A192F]/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative w-full sm:max-w-md surface rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-subtle flex-shrink-0">
            <h2 className="heading font-semibold text-sm">{type}</h2>
            <button onClick={onClose} className="muted hover:text-heading p-1 rounded-lg transition"><X size={18} /></button>
          </div>
          <div className="overflow-y-auto p-3 space-y-3">
            <CategoryStatsPanel type={type} />
            {scoped.length === 0 && <p className="muted text-sm text-center py-8">No reports in this category.</p>}
            {scoped.map(r => <ReportRow key={r.id} report={r} onOpen={onOpenReport} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [statFilter, setStatFilter] = useState<StatFilterKey | null>(null);
  const [reportTypeFilter, setReportTypeFilter] = useState<"active" | ReportStatus>("active");
  const [categoryDrilldown, setCategoryDrilldown] = useState<string | null>(null);
  const [mgmtTypeFilter, setMgmtTypeFilter] = useState<string | null>(null);
  const [mgmtSort, setMgmtSort] = useState<"date_desc" | "date_asc">("date_desc");

  // ── AI Assistant ─────────────────────────────────────────────────────────
  const [chatQuestions, setChatQuestions] = useState<ChatbotQuestion[]>([]);
  const [chatLog, setChatLog] = useState<{ question: string; answer: string; source: "ai" | "computed" }[]>([]);
  const [askingId, setAskingId] = useState<string | null>(null);

  useEffect(() => {
    api.chatbot.questions().then(setChatQuestions).catch(() => {});
  }, []);

  async function handleAsk(q: ChatbotQuestion) {
    setAskingId(q.id);
    try {
      const res = await api.chatbot.ask(q.id);
      setChatLog(prev => [...prev, { question: res.question, answer: res.answer, source: res.source }]);
    } catch (e) {
      setChatLog(prev => [...prev, { question: q.label, answer: e instanceof Error ? e.message : "Something went wrong.", source: "computed" }]);
    } finally {
      setAskingId(null);
    }
  }

  useEffect(() => {
    api.reports.list().then(d => { setReports(d); setLoading(false); }).catch(() => setLoading(false));
    const iv = setInterval(() => { api.reports.list().then(setReports).catch(() => {}); }, 10_000);
    return () => clearInterval(iv);
  }, []);

  function handleReportChanged(updated: Report) {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
  }

  const total      = reports.length;
  const reported   = reports.filter(r => r.status === "Reported").length;
  const acked      = reports.filter(r => r.status === "Acknowledged").length;
  const dispatched = reports.filter(r => r.status === "Dispatched").length;
  const resolved   = reports.filter(r => r.status === "Resolved").length;
  const resRate    = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const avgAgeHrs  = total > 0 ? Math.round(reports.reduce((s, r) => s + (Date.now() - r.timestamp) / 3_600_000, 0) / total) : 0;
  const disputed   = reports.filter(r => r.voteScore <= -2).length;

  const pieData = [
    { name: "Reported",     value: reported,   color: "#ef4444" },
    { name: "Acknowledged", value: acked,       color: "#00B4D8" },
    { name: "Dispatched",   value: dispatched,  color: "#f59e0b" },
    { name: "Resolved",     value: resolved,    color: "#10b981" },
  ];

  // Queue ordering — voteScore is the community-validation signal (1 upvote
  // = +1, 1 downvote = −1) combined with age, matching the heatmap logic.
  const rankedActive = useMemo(() => reports
    .filter(r => r.status !== "Resolved")
    .sort((a, b) => {
      const ageHoursA = (Date.now() - a.timestamp) / 3_600_000;
      const ageHoursB = (Date.now() - b.timestamp) / 3_600_000;
      const urgencyA = (1 + a.voteScore) * 10 + ageHoursA;
      const urgencyB = (1 + b.voteScore) * 10 + ageHoursB;
      return urgencyB - urgencyA;
    }), [reports]);

  const topReports = useMemo(() => reports
    .filter(r => r.status !== "Resolved")
    .sort((a, b) => b.voteScore - a.voteScore || b.timestamp - a.timestamp)
    .slice(0, 5), [reports]);

  let filteredManagementList = reportTypeFilter === "active"
    ? rankedActive
    : reports.filter(r => r.status === reportTypeFilter).sort((a, b) => b.timestamp - a.timestamp);
  if (mgmtTypeFilter) filteredManagementList = filteredManagementList.filter(r => r.type === mgmtTypeFilter);
  if (reportTypeFilter !== "active") {
    filteredManagementList = [...filteredManagementList].sort((a, b) =>
      mgmtSort === "date_asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
    );
  }

  const typeCounts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});
  const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const typeChartData = topTypes.map(([type, count]) => ({ type, count }));

  const lbCounts = new Map<string, { name: string; count: number }>();
  for (const r of reports) {
    if (r.isAnonymous) continue;
    const prev = lbCounts.get(r.reporterId) ?? { name: r.reporterName, count: 0 };
    prev.count += 1;
    lbCounts.set(r.reporterId, prev);
  }
  const lb = Array.from(lbCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10);

  const statModalReports: Record<StatFilterKey, Report[]> = {
    all: reports,
    reported: reports.filter(r => r.status === "Reported"),
    acknowledged: reports.filter(r => r.status === "Acknowledged"),
    dispatched: reports.filter(r => r.status === "Dispatched"),
    resolved: reports.filter(r => r.status === "Resolved"),
  };
  const statModalTitles: Record<StatFilterKey, string> = {
    all: "All Reports",
    reported: "Awaiting Response",
    acknowledged: "Acknowledged",
    dispatched: "In Field",
    resolved: "Resolved",
  };

  const navItems: { id: Section; icon: React.ReactNode; label: string }[] = [
    { id: "overview",    icon: <LayoutDashboard size={16} />, label: "Overview" },
    { id: "reports",     icon: <ClipboardList size={16} />,   label: `Report Management${rankedActive.length > 0 ? ` (${rankedActive.length})` : ""}` },
    { id: "map",         icon: <MapPinned size={16} />,       label: "Live Map" },
    { id: "stats",       icon: <BarChart3 size={16} />,       label: "Stats & Data" },
    { id: "assistant",   icon: <Bot size={16} />,              label: "AI Assistant" },
    { id: "leaderboard", icon: <Trophy size={16} />,          label: "Leaderboard" },
  ];

  return (
    <Layout mode="admin">
      {/* ── Sidebar (desktop) ────────────────────────────── */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col border-r border-subtle surface-flat">
        <div className="px-4 py-4 border-b border-subtle">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#00B4D8] font-medium mb-0.5">सहभागी</p>
          <h2 className="text-sm font-bold heading">Ward 10 Dashboard</h2>
          <p className="text-xs muted mt-0.5 truncate">{user?.name}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Live · Auto-refresh 10s</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                section === item.id
                  ? "bg-[#0A192F] text-white font-medium shadow-sm"
                  : "muted nav-hover"
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
              {item.id === "reports" && rankedActive.length > 0 && section !== "reports" && (
                <span className="ml-auto bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                  {rankedActive.length > 9 ? "9+" : rankedActive.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-subtle space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm muted nav-hover transition"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />} {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile nav drawer ────────────────────────────── */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-[2000]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[80vw] flex flex-col surface-flat shadow-2xl animate-slide-in-left">
            <div className="px-4 py-4 border-b border-subtle flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#00B4D8] font-medium mb-0.5">सहभागी</p>
                <h2 className="text-sm font-bold heading">Ward 10 Dashboard</h2>
                <p className="text-xs muted mt-0.5 truncate">{user?.name}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Live · Auto-refresh 10s</span>
                </div>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="muted p-1 rounded-lg flex-shrink-0" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setSection(item.id); setMobileNavOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                    section === item.id
                      ? "bg-[#0A192F] text-white font-medium shadow-sm"
                      : "muted nav-hover"
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                  {item.id === "reports" && rankedActive.length > 0 && section !== "reports" && (
                    <span className="ml-auto bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                      {rankedActive.length > 9 ? "9+" : rankedActive.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-subtle space-y-1">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm muted nav-hover transition"
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />} {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              <button
                onClick={() => { logout(); navigate("/login"); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Right column: mobile topbar + main content ──── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-subtle surface-flat flex-shrink-0">
          <button onClick={() => setMobileNavOpen(true)} className="muted p-1.5 -ml-1.5 rounded-lg" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <h2 className="text-sm font-bold heading">Ward 10 Dashboard</h2>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
        </div>

        <main className="flex-1 overflow-y-auto page-bg">

        {/* ── OVERVIEW ───────────────────────────────────── */}
        {section === "overview" && (
          <div className="p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold heading">Ward 10 Overview</h3>
              <span className="text-xs muted-2">{new Date().toLocaleString()}</span>
            </div>

            {/* Stat cards — click to see the exact reports behind each number */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {([
                { key: "all" as StatFilterKey,          label: "Total Reports",     value: total,      icon: <Activity size={16} />,    color: "text-[#0A192F] dark:text-white", bg: "bg-slate-50 dark:bg-white/5" },
                { key: "reported" as StatFilterKey,     label: "Awaiting Response", value: reported,   icon: <Clock size={16} />,        color: "text-red-600 dark:text-red-400",   bg: "bg-red-50 dark:bg-red-500/10" },
                { key: "dispatched" as StatFilterKey,   label: "In Field",          value: dispatched, icon: <Siren size={16} />,        color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10" },
                { key: "resolved" as StatFilterKey,     label: "Resolved",          value: resolved,   icon: <CheckCircle2 size={16} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
              ]).map(s => (
                <button
                  key={s.label}
                  onClick={() => setStatFilter(s.key)}
                  className={`text-left rounded-2xl border border-subtle ${s.bg} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}
                >
                  <div className={`flex items-center gap-2 mb-1 ${s.color}`}>{s.icon}<p className="text-xs muted">{s.label}</p></div>
                  <p className={`text-3xl font-bold ${s.color}`}>{loading ? "…" : s.value}</p>
                  <p className="text-[10px] muted-2 mt-1">Tap to view reports →</p>
                </button>
              ))}
            </div>

            <SponsorBanner />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Pie chart */}
              <article className="rounded-2xl surface p-4 shadow-sm">
                <h4 className="text-sm font-semibold heading mb-3">Status Breakdown</h4>
                <div className="flex items-center gap-6">
                  <div className="h-40 w-40 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={32} outerRadius={58} paddingAngle={2}>
                          {pieData.map(e => <Cell key={e.name} fill={e.color} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 flex-1">
                    {pieData.map(e => (
                      <div key={e.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
                          <span className="text-xs body-text">{e.name}</span>
                        </div>
                        <span className="text-xs font-bold heading">{e.value}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-subtle mt-2">
                      <p className="text-xs muted">Resolution rate</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{resRate}%</p>
                    </div>
                  </div>
                </div>
              </article>

              {/* Top Reports of the Ward */}
              <article className="rounded-2xl surface p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp size={15} className="text-[#00B4D8]" />
                  <h4 className="text-sm font-semibold heading">Top Reports — Ward 10</h4>
                </div>
                <p className="text-xs muted mb-3">Ranked by community upvotes — most liked first</p>
                {topReports.length === 0
                  ? <p className="text-xs muted-2">No active reports</p>
                  : (
                    <div className="space-y-2">
                      {topReports.map((r, i) => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedReportId(r.id)}
                          className="w-full flex items-center gap-2.5 rounded-xl surface-subtle px-2.5 py-2 text-left hover:opacity-80 transition"
                        >
                          <span className="w-5 h-5 rounded-full bg-[#0A192F] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold heading truncate">{r.type}</p>
                            <p className="text-[10px] muted-2 truncate">{r.reporterName}</p>
                          </div>
                          <span className={`flex-shrink-0 text-xs font-bold ${r.voteScore > 0 ? "text-[#00B4D8]" : r.voteScore < 0 ? "text-red-500" : "muted"}`}>
                            {r.voteScore > 0 ? `+${r.voteScore}` : r.voteScore}
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                }
              </article>
            </div>

            {/* Bigger live map */}
            <article className="rounded-2xl surface shadow-sm overflow-hidden" style={{ height: 480 }}>
              <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
                <h4 className="text-sm font-semibold heading">Live Heatmap — Ward 10</h4>
                <button onClick={() => setSection("map")} className="text-xs text-[#00B4D8] font-medium hover:underline">Open full map →</button>
              </div>
              <div style={{ height: "calc(100% - 45px)" }}>
                <MapView reports={reports} showHeatmap className="h-full w-full" onSelectReport={id => setSelectedReportId(id)} />
              </div>
            </article>
          </div>
        )}

        {/* ── REPORT MANAGEMENT (was Dispatch Queue) ────────── */}
        {section === "reports" && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-bold heading">Report Management</h3>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${rankedActive.length > 0 ? "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400" : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"}`}>
                {rankedActive.length > 0 ? `${rankedActive.length} active` : "All clear"}
              </span>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {([
                ["active", "Active Queue"], ["Reported", "Reported"], ["Acknowledged", "Acknowledged"],
                ["Dispatched", "Dispatched"], ["Resolved", "Resolved"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setReportTypeFilter(key)}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    reportTypeFilter === key ? "bg-[#0A192F] text-white" : "surface-subtle muted hover:opacity-80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Issue-type filter + date sort */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <select
                value={mgmtTypeFilter ?? ""}
                onChange={e => setMgmtTypeFilter(e.target.value || null)}
                className="flex-shrink-0 text-xs font-medium rounded-full border border-subtle surface-subtle px-2.5 py-1.5 muted focus:outline-none focus:ring-1 focus:ring-[#00B4D8]"
                aria-label="Filter by issue type"
              >
                <option value="">All Categories</option>
                {Object.keys(typeCounts).sort().map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {reportTypeFilter !== "active" && (
                <button
                  onClick={() => setMgmtSort(s => s === "date_desc" ? "date_asc" : "date_desc")}
                  className="flex-shrink-0 text-xs font-medium rounded-full border border-subtle surface-subtle px-2.5 py-1.5 muted hover:opacity-80 transition"
                >
                  Sort: {mgmtSort === "date_desc" ? "Newest first" : "Oldest first"}
                </button>
              )}
            </div>

            <p className="text-xs muted">
              Sorted by community vote score and age — click any report to open its full detail, write an{" "}
              <strong className="body-text">Officer Progress Note</strong>, and advance its status.
              {disputed > 0 && <span className="text-red-500 font-medium"> · {disputed} report{disputed > 1 ? "s" : ""} disputed (net downvoted)</span>}
            </p>

            {loading && (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-[#00B4D8]" size={28} />
              </div>
            )}

            {!loading && filteredManagementList.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/15 p-10 text-center">
                <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium body-text">Nothing here</p>
                <p className="text-xs muted-2 mt-1">Try a different filter</p>
              </div>
            )}

            <div className="space-y-2">
              {filteredManagementList.map(report => {
                const age = Math.floor((Date.now() - report.timestamp) / 3_600_000);
                return (
                  <article
                    key={report.id}
                    onClick={() => setSelectedReportId(report.id)}
                    className="rounded-2xl surface p-4 shadow-sm cursor-pointer hover:shadow-md hover:border-[#00B4D8]/30 transition-all"
                  >
                    <div className="flex gap-4">
                      {report.imageUrl && (
                        <img
                          src={report.imageUrl}
                          alt={report.type}
                          className="h-24 w-28 flex-shrink-0 rounded-xl object-cover border border-subtle"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <p className="font-semibold heading">{report.type}</p>
                            <p className="text-xs muted">
                              by {report.reporterName} · {new Date(report.timestamp).toLocaleString()}
                              {age >= 1 && <span className={`ml-1 font-semibold ${age >= 24 ? "text-red-500" : "text-amber-500"}`}> · {age}h old</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="flex items-center gap-1 rounded-full surface-subtle px-2 py-0.5 text-[10px] font-semibold">
                              <ThumbsUp size={10} className="text-[#00B4D8]" /> {report.upvoteCount}
                              <ThumbsDown size={10} className="text-red-400 ml-1" /> {report.downvoteCount}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[report.status]}`}>
                              {report.status}
                            </span>
                          </div>
                        </div>

                        {report.description && (
                          <p className="text-sm body-text mb-2">{report.description}</p>
                        )}

                        {report.officerNote && (
                          <div className="rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 px-2 py-1.5 mb-1">
                            <p className="text-xs text-cyan-700 dark:text-cyan-400">📋 Latest note: {report.officerNote}</p>
                          </div>
                        )}

                        <p className="text-xs text-[#00B4D8] font-medium mt-1">Click to open · write progress note · advance status →</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* ── LIVE MAP ───────────────────────────────────── */}
        {section === "map" && (
          <div className="h-full flex flex-col">
            <div className="px-5 py-3 border-b border-subtle surface-flat flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold heading">Live Heatmap — Ward 10</h3>
              <div className="flex items-center gap-3 text-xs muted">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Low</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Medium</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Hotspot</span>
              </div>
            </div>
            <div className="flex-1">
              <MapView reports={reports} showHeatmap className="h-full w-full" zoom={15} onSelectReport={id => setSelectedReportId(id)} />
            </div>
          </div>
        )}

        {/* ── STATS & DATA ───────────────────────────────── */}
        {section === "stats" && (
          <div className="p-4 sm:p-6 space-y-5">
            <h3 className="text-lg font-bold heading">Stats & Data</h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Resolution Rate", value: `${resRate}%`, sub: `${resolved}/${total} resolved` },
                { label: "Avg. Report Age", value: `${avgAgeHrs}h`, sub: "across all open + closed" },
                { label: "Disputed Reports", value: disputed, sub: "net downvoted ≤ −2" },
                { label: "Issue Categories", value: Object.keys(typeCounts).length, sub: "distinct types reported" },
              ].map(s => (
                <article key={s.label} className="rounded-2xl surface p-4 shadow-sm">
                  <p className="text-xs muted mb-1">{s.label}</p>
                  <p className="text-2xl font-bold heading">{s.value}</p>
                  <p className="text-[10px] muted-2 mt-0.5">{s.sub}</p>
                </article>
              ))}
            </div>

            <article className="rounded-2xl surface p-4 shadow-sm">
              <h4 className="text-sm font-semibold heading mb-3">Reports by Category</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === "dark" ? "#1f2937" : "#e2e8f0"} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: theme === "dark" ? "#94a3b8" : "#64748b" }} />
                    <YAxis type="category" dataKey="type" width={110} tick={{ fontSize: 11, fill: theme === "dark" ? "#94a3b8" : "#64748b" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, background: theme === "dark" ? "#111d33" : "#fff", border: "none" }} />
                    <Bar dataKey="count" fill="#00B4D8" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-2xl surface p-4 shadow-sm">
              <h4 className="text-sm font-semibold heading mb-3">Full Category Breakdown</h4>
              <div className="divide-y divide-subtle">
                {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                  const typeResolved = reports.filter(r => r.type === type && r.status === "Resolved").length;
                  return (
                    <button
                      key={type}
                      onClick={() => setCategoryDrilldown(type)}
                      className="w-full flex items-center justify-between py-2.5 text-left hover:opacity-70 transition"
                    >
                      <div>
                        <p className="text-sm body-text font-medium">{type}</p>
                        <p className="text-[10px] muted-2">{typeResolved}/{count} resolved · tap for stats</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold heading">{count}</p>
                        <p className="text-[10px] muted-2">{Math.round((count / (total || 1)) * 100)}%</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </article>
          </div>
        )}

        {/* ── AI ASSISTANT ───────────────────────────────── */}
        {section === "assistant" && (
          <div className="p-4 sm:p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#00B4D8]" />
              <h3 className="text-lg font-bold heading">Ward AI Assistant</h3>
            </div>
            <p className="text-xs muted -mt-3">
              Ask about the ward's live data. Answers are grounded in real report numbers — pick a question below.
            </p>

            <article className="rounded-2xl surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest muted-2 mb-2.5">Ask a question</p>
              <div className="flex flex-wrap gap-2">
                {chatQuestions.map(q => (
                  <button
                    key={q.id}
                    onClick={() => void handleAsk(q)}
                    disabled={askingId !== null}
                    className="flex items-center gap-1.5 rounded-full border border-[#00B4D8]/30 bg-[#00B4D8]/5 text-[#00B4D8] text-xs font-medium px-3 py-1.5 hover:bg-[#00B4D8]/10 disabled:opacity-50 transition"
                  >
                    {askingId === q.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                    {q.label}
                  </button>
                ))}
                {chatQuestions.length === 0 && <p className="text-xs muted-2">Loading questions…</p>}
              </div>
            </article>

            <div className="space-y-3">
              {chatLog.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/15 p-8 text-center">
                  <Bot size={26} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm muted">Ask a question above to get started.</p>
                </div>
              )}
              {chatLog.map((entry, i) => (
                <article key={i} className="rounded-2xl surface p-4 shadow-sm space-y-2">
                  <p className="text-sm font-semibold heading flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#0A192F] text-white text-[10px] flex items-center justify-center flex-shrink-0">Q</span>
                    {entry.question}
                  </p>
                  <p className="text-sm body-text flex gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#00B4D8]/15 text-[#00B4D8] text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot size={11} />
                    </span>
                    <span>{entry.answer}</span>
                  </p>
                  <p className="text-[10px] muted-2 pl-6">
                    {entry.source === "ai" ? "AI-generated from live ward data" : "Computed directly from live ward data"}
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* ── LEADERBOARD ────────────────────────────────── */}
        {section === "leaderboard" && (
          <div className="p-4 sm:p-6 space-y-5">
            <h3 className="text-lg font-bold heading">Citizen Leaderboard</h3>
            <article className="rounded-2xl surface p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Users size={16} className="text-[#00B4D8]" />
                <h4 className="text-sm font-semibold heading">Top Reporters This Month</h4>
              </div>
              <p className="text-xs muted mb-4">Anonymous reporters are excluded. Top 3 receive Ward Chairman certificate.</p>
              {lb.length === 0
                ? <p className="text-sm muted-2">No data yet.</p>
                : lb.map((entry, i) => (
                  <div
                    key={entry.name}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 mb-2 ${
                      i === 0 ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20" :
                      i === 1 ? "surface-subtle border border-subtle" :
                      i === 2 ? "bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20" :
                      "surface-subtle"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold w-8 text-center">
                        {["🥇","🥈","🥉"][i] ?? `${i+1}.`}
                      </span>
                      <div>
                        <p className="font-semibold heading text-sm">{entry.name}</p>
                        <p className="text-xs muted-2">{entry.count} verified reports</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold heading">{entry.count}</p>
                      {i < 3 && <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Certificate eligible</p>}
                    </div>
                  </div>
                ))
              }
            </article>
          </div>
        )}
      </main>
      </div>

      {statFilter && (
        <StatListModal
          title={statModalTitles[statFilter]}
          reports={statModalReports[statFilter]}
          onClose={() => setStatFilter(null)}
          onOpenReport={id => { setStatFilter(null); setSelectedReportId(id); }}
        />
      )}

      {categoryDrilldown && (
        <CategoryDrilldownModal
          type={categoryDrilldown}
          reports={reports}
          onClose={() => setCategoryDrilldown(null)}
          onOpenReport={id => { setCategoryDrilldown(null); setSelectedReportId(id); }}
        />
      )}

      <ReportDetailModal
        reportId={selectedReportId}
        initialReport={reports.find(r => r.id === selectedReportId)}
        onClose={() => setSelectedReportId(null)}
        onChanged={handleReportChanged}
        officerMode
      />
    </Layout>
  );
}
