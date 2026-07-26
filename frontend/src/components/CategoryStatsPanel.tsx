import { useEffect, useState } from "react";
import { api, type CategoryStats } from "../lib/api";

export default function CategoryStatsPanel({ type }: { type: string }) {
  const [stats, setStats] = useState<CategoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.reports.stats(type).then(s => { if (!cancelled) { setStats(s); setLoading(false); } }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [type]);

  if (loading) {
    return <div className="rounded-2xl surface p-4 shadow-sm animate-pulse h-24" aria-hidden />;
  }
  if (!stats) return null;

  return (
    <article className="rounded-2xl surface p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest muted-2 mb-2">{stats.type} · Stats</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center">
          <p className="text-lg font-bold heading">{stats.total}</p>
          <p className="text-[10px] muted">Total</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.resolutionRatePercent}%</p>
          <p className="text-[10px] muted">Resolved</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[#00B4D8]">{stats.avgResolutionHours != null ? `${stats.avgResolutionHours}h` : "—"}</p>
          <p className="text-[10px] muted">Avg. fix time</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(stats.byStatus) as [string, number][]).map(([s, c]) => (
          <span key={s} className="text-[10px] font-medium rounded-full surface-subtle px-2 py-0.5 muted">{s}: {c}</span>
        ))}
      </div>
      {stats.topReport && (
        <p className="text-[11px] muted-2 mt-2 truncate">
          Most upvoted: “{stats.topReport.description || stats.topReport.status}” by {stats.topReport.reporterName} (+{stats.topReport.voteScore})
        </p>
      )}
    </article>
  );
}
