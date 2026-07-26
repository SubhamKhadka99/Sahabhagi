import {
  Bell, CircleUserRound, ClipboardList, Download, Home,
  IdCard, LogOut, MapPinned, Moon, Plus, Settings as SettingsIcon,
  ShieldCheck, Siren, Sun, ThumbsDown, ThumbsUp, Trophy, WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CategoryStatsPanel from "../components/CategoryStatsPanel";
import FilterSortBar from "../components/FilterSortBar";
import Layout from "../components/Layout";
import MapView from "../components/MapView";
import NotificationsBell from "../components/NotificationsBell";
import ReportCardSkeleton from "../components/ReportCardSkeleton";
import ReportDetailModal from "../components/ReportDetailModal";
import ReportModal, { type ReportInput } from "../components/ReportModal";
import { SponsorTopBanner } from "../components/SponsorAd";
import WardProfileForm from "../components/WardProfileForm";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api, type LeaderboardEntry, type Report, type ReportStatus } from "../lib/api";
import { getPendingReports, queueOfflineReport, syncPendingReports } from "../lib/offlineQueue";

type Tab = "home" | "map" | "leaderboard" | "profile";

const STATUS_BADGE: Record<Report["status"], string> = {
  Reported:     "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  Acknowledged: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  Dispatched:   "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Resolved:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
};

type BeforeInstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function CitizenApp() {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [reports, setReports] = useState<Report[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tab, setTab] = useState<Tab>("home");
  const [modalOpen, setModalOpen] = useState(false);
  const [profileFormOpen, setProfileFormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  // ── Infinite-scroll feed (Home tab) ────────────────────────────────────
  const [feedItems, setFeedItems] = useState<Report[]>([]);
  const [feedCursor, setFeedCursor] = useState<number | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedLoadingInitial, setFeedLoadingInitial] = useState(true);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | null>(null);
  const [sort, setSort] = useState<"date_desc" | "date_asc">("date_desc");
  const scrollSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  // ── Offline reporting ───────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const allTypes = useMemo(
    () => Array.from(new Set(reports.map(r => r.type))).sort(),
    [reports]
  );

  async function loadFeed(reset: boolean) {
    if (reset) {
      setFeedLoadingInitial(true);
      setFeedItems([]);
      setFeedCursor(null);
      setFeedHasMore(true);
    } else {
      if (loadingMoreRef.current || !feedHasMore) return;
      loadingMoreRef.current = true;
      setFeedLoadingMore(true);
    }
    try {
      const page = await api.reports.feed({
        cursor: reset ? null : feedCursor,
        limit: 10,
        type: typeFilter,
        status: statusFilter,
        sort,
      });
      setFeedItems(prev => reset ? page.reports : [...prev, ...page.reports]);
      setFeedCursor(page.nextCursor);
      setFeedHasMore(page.hasMore);
    } catch {
      // leave whatever's already loaded in place
    } finally {
      setFeedLoadingInitial(false);
      setFeedLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }

  // Reset + reload the feed whenever filters/sort change
  useEffect(() => {
    void loadFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, sort]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = scrollSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) void loadFeed(false);
    }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollSentinelRef.current, feedHasMore, feedCursor, typeFilter, statusFilter, sort]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") setShowInstall(false);
    deferredPrompt.current = null;
  }

  function refreshReports() {
    return api.reports.list().then(r => { setReports(r); setLoadError(""); }).catch(e => {
      setLoadError(e instanceof Error ? e.message : "Couldn't load reports — check your connection.");
    });
  }

  async function trySyncOffline() {
    const pending = await getPendingReports();
    if (!pending.length) { setPendingCount(0); return; }
    if (!navigator.onLine) { setPendingCount(pending.length); return; }
    const { synced, remaining } = await syncPendingReports();
    setPendingCount(remaining);
    if (synced > 0) {
      setToast(`✓ ${synced} offline report${synced > 1 ? "s" : ""} synced.`);
      void refreshReports();
      void loadFeed(true);
    }
  }

  useEffect(() => {
    refreshReports().then(() => setLoading(false));
    void loadFeed(true);
    void trySyncOffline();
    const iv = setInterval(() => { refreshReports(); void trySyncOffline(); }, 15_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const goOnline = () => { setIsOnline(true); void trySyncOffline(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (tab === "leaderboard") {
      api.leaderboard.get().then(setLeaderboard).catch(() => {});
    }
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("action") === "report") {
      setModalOpen(true);
    }
  }, []);

  async function handleSubmit(input: ReportInput) {
    setSubmitting(true);
    try {
      const position = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10_000 })
      );
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (!navigator.onLine) {
        await queueOfflineReport({
          type: input.category, lat, lng, description: input.description,
          isAnonymous: input.isAnonymous, imageFile: input.imageFile,
        });
        setPendingCount(c => c + 1);
        setModalOpen(false);
        setToast("📴 No connection — report saved on your device. It'll upload automatically once you're back online.");
        return;
      }

      try {
        const fd = new FormData();
        fd.append("type", input.category);
        fd.append("lat", String(lat));
        fd.append("lng", String(lng));
        fd.append("description", input.description);
        fd.append("isAnonymous", String(input.isAnonymous));
        if (input.imageFile) {
          fd.append("photo", input.imageFile);
        }

        const newReport = await api.reports.submit(fd);
        setReports(prev => [newReport, ...prev]);
        if (!typeFilter && !statusFilter) setFeedItems(prev => [newReport, ...prev]);
        updateUser({ reportCount: (user?.reportCount ?? 0) + 1, civicScore: Math.min((user?.civicScore ?? 0) + 10, 100) });
        setModalOpen(false);
        setTab("map");
        setToast("✓ Report submitted! The Ward team has been notified.");
      } catch (submitErr) {
        // Connection dropped mid-submit (or the request never reached the
        // server) — fall back to the offline queue instead of losing it.
        if (!navigator.onLine || submitErr instanceof TypeError) {
          await queueOfflineReport({
            type: input.category, lat, lng, description: input.description,
            isAnonymous: input.isAnonymous, imageFile: input.imageFile,
          });
          setPendingCount(c => c + 1);
          setModalOpen(false);
          setToast("📴 Connection lost mid-upload — report saved on your device and will retry automatically.");
          return;
        }
        throw submitErr;
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Submission failed. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(reportId: string, direction: "up" | "down") {
    try {
      const updated = await api.reports.vote(reportId, direction);
      setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
      setFeedItems(prev => prev.map(r => r.id === updated.id ? updated : r));
      if (direction === "up") setToast("👍 Added your upvote — this report just got more urgent.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not vote. Try again.");
    }
  }

  const myReports = reports.filter(r => r.reporterId === user?.id);
  const resolvedCount = myReports.filter(r => r.status === "Resolved").length;
  const profileComplete = !!user?.wardProfile?.nidNumber;

  return (
    <Layout mode="citizen">
      <div className="relative flex h-full flex-col overflow-hidden page-bg">

        {/* Header */}
        <header className="flex items-center justify-between border-b border-subtle surface-flat px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="" className="w-7 h-7 rounded-lg" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#00B4D8] font-medium">Sahabhagi</p>
              <h1 className="text-base font-bold heading leading-tight">
                {tab === "map" ? "Live Ward Map" : tab === "profile" ? "My Profile" : tab === "leaderboard" ? "Ward Leaderboard" : "Community Feed"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="flex items-center gap-1 bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-medium px-2 py-1 rounded-full border border-red-500/20">
                <WifiOff size={10} /> Offline
              </span>
            )}
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium px-2 py-1 rounded-full border border-amber-500/20">
                {pendingCount} pending
              </span>
            )}
            {showInstall && (
              <button
                onClick={() => void handleInstall()}
                className="flex items-center gap-1.5 bg-[#00B4D8]/10 border border-[#00B4D8]/30 text-[#00B4D8] text-xs font-medium px-2.5 py-1.5 rounded-full hover:bg-[#00B4D8]/20 transition"
              >
                <Download size={12} />
                Install App
              </button>
            )}
            {user?.isAnonymous && (
              <span className="flex items-center gap-1 bg-[#00B4D8]/10 text-[#00B4D8] text-[10px] font-medium px-2 py-1 rounded-full border border-[#00B4D8]/20">
                <ShieldCheck size={10} /> Anon
              </span>
            )}
            <button onClick={toggleTheme} className="p-2 muted hover:text-heading rounded-lg transition" aria-label="Toggle dark mode">
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <NotificationsBell onOpenReport={id => setSelectedReportId(id)} />
          </div>
        </header>

        <SponsorTopBanner />

        {/* Body */}
        <div className="flex-1 overflow-hidden relative">

          {/* HOME */}
          {tab === "home" && (
            <section className="h-full overflow-y-auto px-3 py-3 pb-24 space-y-3">
              <article className="rounded-2xl bg-gradient-to-br from-[#0A192F] to-[#1a3a6b] p-4 text-white shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 mb-1">Quick Action</p>
                <h2 className="text-sm font-semibold mb-3">Spotted an issue? Report it in under 10 seconds.</h2>
                <button
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-2 bg-[#00B4D8] text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-cyan-500 active:scale-95 transition-all shadow-lg"
                >
                  <Plus size={16} /> Report Now
                </button>
              </article>

              {!profileComplete && (
                <button
                  onClick={() => { setTab("profile"); setProfileFormOpen(true); }}
                  className="w-full flex items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-left hover:bg-amber-100 dark:hover:bg-amber-500/20 transition"
                >
                  <IdCard size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-300">Complete your Ward profile</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400/80">Required for Good Citizen Certificate eligibility</p>
                  </div>
                  <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold">→</span>
                </button>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Total", value: reports.length, icon: <ClipboardList size={14} />, color: "text-[#0A192F] dark:text-white" },
                  { label: "Urgent", value: reports.filter(r => r.status === "Reported").length, icon: <Siren size={14} />, color: "text-red-500" },
                  { label: "Resolved", value: reports.filter(r => r.status === "Resolved").length, icon: <ShieldCheck size={14} />, color: "text-emerald-600 dark:text-emerald-400" },
                ].map(s => (
                  <article key={s.label} className="rounded-xl surface p-2.5 shadow-sm text-center">
                    <div className={`flex justify-center mb-0.5 ${s.color}`}>{s.icon}</div>
                    <p className={`text-lg font-bold ${s.color}`}>{loading ? "…" : s.value}</p>
                    <p className="text-[10px] muted">{s.label}</p>
                  </article>
                ))}
              </div>

              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase tracking-widest muted-2">
                  Latest Reports · Ward 10 · Tap a report for details
                </p>
              </div>

              {loadError && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm">
                  <span className="text-red-600 dark:text-red-400">{loadError}</span>
                  <button
                    onClick={() => void refreshReports()}
                    className="flex-shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              <FilterSortBar
                types={allTypes}
                typeFilter={typeFilter}
                onTypeChange={setTypeFilter}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                sort={sort}
                onSortChange={setSort}
              />

              {typeFilter && <CategoryStatsPanel type={typeFilter} />}

              {feedLoadingInitial && (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <ReportCardSkeleton key={i} />)}
                </div>
              )}
              {!feedLoadingInitial && feedItems.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/15 p-6 text-center text-sm muted">
                  {typeFilter || statusFilter ? "No reports match these filters." : "No reports yet. Be the first to report an issue in Ward 10."}
                </div>
              )}
              {feedItems.map(r => {
                const alreadyUpvoted = r.upvoterIds?.includes(user?.id ?? "");
                return (
                  <article
                    key={r.id}
                    onClick={() => setSelectedReportId(r.id)}
                    className="flex gap-3 rounded-2xl surface p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-[#00B4D8]/30 transition-all active:scale-[0.99]"
                  >
                    <div className="h-16 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
                      {r.imageUrl
                        ? <img src={r.imageUrl} alt={r.type} className="h-full w-full object-cover" />
                        : <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600"><MapPinned size={20} /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1 mb-0.5">
                        <p className="text-sm font-semibold heading truncate">{r.type}</p>
                        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                      </div>
                      <p className="text-xs muted truncate">by {r.reporterName}</p>
                      <p className="text-xs muted-2">{new Date(r.timestamp).toLocaleString()}</p>
                      {r.officerNote && <p className="text-xs text-[#00B4D8] mt-0.5 truncate">📋 {r.officerNote}</p>}
                      {r.verification && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">✅ Verified resolved by {r.verification.userName}</p>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] muted flex items-center gap-2">
                          <span className="flex items-center gap-0.5"><ThumbsUp size={10} /> {r.upvoteCount}</span>
                          <span className="flex items-center gap-0.5"><ThumbsDown size={10} /> {r.downvoteCount}</span>
                          {r.comments.length > 0 && <span>· {r.comments.length} comment{r.comments.length > 1 ? "s" : ""}</span>}
                        </span>
                        {r.status !== "Resolved" && !alreadyUpvoted && r.reporterId !== user?.id && (
                          <button
                            onClick={e => { e.stopPropagation(); void handleVote(r.id, "up"); }}
                            className="text-[10px] font-semibold text-[#00B4D8] border border-[#00B4D8]/30 rounded-full px-2 py-0.5 hover:bg-[#00B4D8]/10 transition flex-shrink-0"
                          >
                            + Me too
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}

              {/* Infinite-scroll sentinel + trailing skeletons while the next page loads */}
              {!feedLoadingInitial && feedHasMore && (
                <>
                  <div ref={scrollSentinelRef} className="h-1" />
                  {feedLoadingMore && (
                    <div className="space-y-3">
                      {Array.from({ length: 2 }).map((_, i) => <ReportCardSkeleton key={`more-${i}`} />)}
                    </div>
                  )}
                </>
              )}
              {!feedLoadingInitial && !feedHasMore && feedItems.length > 0 && (
                <p className="text-center text-[11px] muted-2 py-2">You're all caught up 🎉</p>
              )}
            </section>
          )}

          {/* MAP */}
          {tab === "map" && (
            <section className="h-full">
              <MapView
                reports={reports}
                showHeatmap
                className="h-full w-full"
                onUpvote={id => void handleVote(id, "up")}
                onSelectReport={id => setSelectedReportId(id)}
                currentUserId={user?.id}
              />
              <div className="absolute bottom-20 left-3 z-[500] rounded-xl surface-flat backdrop-blur border border-subtle px-3 py-2 shadow text-xs">
                <p className="font-semibold heading mb-1">Heatmap intensity</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-14 h-2 rounded-full" style={{ background: "linear-gradient(to right, #3b82f6, #eab308, #ef4444)" }} />
                  <span className="muted">Low → High</span>
                </div>
              </div>
            </section>
          )}

          {/* LEADERBOARD */}
          {tab === "leaderboard" && (
            <section className="h-full overflow-y-auto px-3 py-3 pb-24 space-y-3">
              <article className="rounded-2xl surface p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={16} className="text-amber-500" />
                  <h3 className="font-semibold heading text-sm">Top Citizen Reporters</h3>
                </div>
                <p className="text-xs muted mb-4">Resets every Monday. Top 3 earn Ward Chairman certificate.</p>
                {leaderboard.length === 0
                  ? <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />)}</div>
                  : leaderboard.map(e => (
                    <div key={e.rank} className={`flex items-center justify-between rounded-xl px-3 py-2.5 mb-2 ${e.isCurrentUser ? "border border-[#00B4D8]/40 bg-[#00B4D8]/10" : e.rank <= 3 ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20" : "surface-subtle"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{["🥇","🥈","🥉"][e.rank-1] ?? `${e.rank}.`}</span>
                        <div>
                          <p className={`text-sm ${e.isCurrentUser ? "font-bold heading" : "body-text"}`}>
                            {e.name}{e.isCurrentUser && <span className="text-[10px] text-[#00B4D8] ml-1">(you)</span>}
                          </p>
                          <p className="text-[10px] muted-2">Civic score: {e.civicScore}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold heading">{e.reportCount}</span>
                    </div>
                  ))
                }
              </article>
            </section>
          )}

          {/* PROFILE */}
          {tab === "profile" && user && (
            <section className="h-full overflow-y-auto px-3 py-3 pb-24 space-y-3">
              <article className="rounded-2xl surface p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#0A192F] flex items-center justify-center text-white flex-shrink-0">
                    <CircleUserRound size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold heading truncate">{user.name}</p>
                    <p className="text-xs muted-2 truncate">{user.email}</p>
                    <p className="text-xs text-[#00B4D8] font-medium">Civic Score: {user.civicScore}</p>
                    {user.isAnonymous && <p className="text-[10px] muted-2">Anonymous mode active</p>}
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-xs muted mb-1">
                    <span>Progress to certificate</span>
                    <span>{user.civicScore}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10">
                    <div className="h-2 rounded-full bg-[#00B4D8] transition-all duration-500" style={{ width: `${user.civicScore}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Submitted", value: user.reportCount },
                    { label: "Resolved", value: resolvedCount },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl surface-subtle p-3 text-center">
                      <p className="text-xl font-bold heading">{s.value}</p>
                      <p className="text-xs muted">{s.label}</p>
                    </div>
                  ))}
                </div>
              </article>

              {/* Ward profile CTA card */}
              <button
                onClick={() => setProfileFormOpen(true)}
                className="w-full flex items-center gap-3 rounded-2xl surface p-4 shadow-sm text-left hover:border-[#00B4D8]/40 transition"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${profileComplete ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-amber-50 dark:bg-amber-500/10"}`}>
                  <IdCard size={18} className={profileComplete ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold heading">Ward Eligibility Profile</p>
                  <p className="text-xs muted">
                    {profileComplete ? "NID on file — certificate eligible" : "Add NID & household info for certificate eligibility"}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${profileComplete ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                  {profileComplete ? "Complete" : "Optional"}
                </span>
              </button>

              {/* Settings CTA card */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-full flex items-center gap-3 rounded-2xl surface p-4 shadow-sm text-left hover:border-[#00B4D8]/40 transition"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 surface-subtle">
                  <SettingsIcon size={18} className="muted" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold heading">Settings</p>
                  <p className="text-xs muted">Dark mode, notifications, language</p>
                </div>
                <span className="muted-2 text-xs">→</span>
              </button>

              <article className="rounded-2xl surface p-4 shadow-sm">
                <h3 className="text-sm font-semibold heading mb-3">My Reports</h3>
                {myReports.length === 0
                  ? <p className="text-xs muted">No reports yet. Tap + to submit one.</p>
                  : myReports.map(r => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedReportId(r.id)}
                      className="flex items-center justify-between rounded-xl surface-subtle px-3 py-2 mb-2 cursor-pointer hover:opacity-80 transition"
                    >
                      <div>
                        <p className="text-sm font-medium heading">{r.type}</p>
                        <p className="text-xs muted-2">{new Date(r.timestamp).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                        {r.voteScore !== 0 && (
                          <p className={`text-[10px] mt-0.5 ${r.voteScore > 0 ? "text-[#00B4D8]" : "text-red-500"}`}>
                            {r.voteScore > 0 ? `+${r.voteScore}` : r.voteScore} net votes
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                }
              </article>

              <button
                onClick={() => { logout(); navigate("/login"); }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all"
              >
                <LogOut size={15} /> Sign Out
              </button>
            </section>
          )}
        </div>

        {/* Bottom nav */}
        <nav className="flex-shrink-0 border-t border-subtle surface-flat px-4 pb-safe pt-2">
          <div className="flex items-end justify-between max-w-sm mx-auto">
            {([
              ["home", <Home size={18} />, "Home"],
              ["map", <MapPinned size={18} />, "Map"],
              null,
              ["leaderboard", <Trophy size={18} />, "Ranks"],
              ["profile", <CircleUserRound size={18} />, "Profile"],
            ] as const).map((item) => {
              if (item === null) {
                return (
                  <button
                    key="fab"
                    onClick={() => setModalOpen(true)}
                    className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#00B4D8] text-white shadow-xl hover:bg-cyan-500 active:scale-95 transition-all"
                    aria-label="Report issue"
                  >
                    <Plus size={26} strokeWidth={2.5} />
                  </button>
                );
              }
              const [id, icon, label] = item;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id as Tab)}
                  className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition ${tab === id ? "text-[#00B4D8]" : "muted-2 hover:text-slate-600 dark:hover:text-slate-300"}`}
                >
                  {icon}
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <ReportModal
        open={modalOpen}
        submitting={submitting}
        onClose={() => setModalOpen(false)}
        onSubmit={async input => { await handleSubmit(input); }}
        onUpvoted={refreshReports}
      />

      {profileFormOpen && <WardProfileForm onClose={() => setProfileFormOpen(false)} />}

      {settingsOpen && (
        <div className="fixed inset-0 z-[3000] overflow-y-auto">
          <div className="absolute inset-0 bg-[#0A192F]/70 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <div className="relative min-h-full flex items-end sm:items-center justify-center">
            <div className="relative w-full sm:max-w-sm surface rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="heading font-bold text-lg">Settings</h2>
                <button onClick={() => setSettingsOpen(false)} className="muted hover:text-heading">✕</button>
              </div>

              <div className="flex items-center justify-between surface-subtle rounded-2xl p-3.5 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0A192F] flex items-center justify-center text-white flex-shrink-0">
                    {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                  </div>
                  <div>
                    <p className="heading text-sm font-semibold">Dark Mode</p>
                    <p className="muted text-xs">{theme === "dark" ? "Enabled" : "Disabled"}</p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${theme === "dark" ? "bg-[#00B4D8]" : "bg-slate-300"}`}
                  aria-label="Toggle dark mode"
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${theme === "dark" ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="flex items-center justify-between surface-subtle rounded-2xl p-3.5 mb-3 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-400 flex items-center justify-center text-white flex-shrink-0">
                    <Bell size={16} />
                  </div>
                  <div>
                    <p className="heading text-sm font-semibold">Push Notifications</p>
                    <p className="muted text-xs">Coming soon</p>
                  </div>
                </div>
              </div>

              <p className="muted-2 text-[11px] text-center mt-2">Sahabhagi · Ward 10 Pilot</p>
            </div>
          </div>
        </div>
      )}

      <ReportDetailModal
        reportId={selectedReportId}
        initialReport={reports.find(r => r.id === selectedReportId)}
        onClose={() => setSelectedReportId(null)}
        onChanged={updated => {
          setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
          setFeedItems(prev => prev.map(r => r.id === updated.id ? updated : r));
        }}
      />

      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] rounded-full bg-[#0A192F] border border-white/10 px-4 py-2 text-sm text-white shadow-xl animate-fade-in max-w-[90%] text-center">
          {toast}
        </div>
      )}
    </Layout>
  );
}
