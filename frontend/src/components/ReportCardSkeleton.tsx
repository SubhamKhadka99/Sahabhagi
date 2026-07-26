export default function ReportCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl surface p-3 shadow-sm animate-pulse" aria-hidden>
      <div className="h-16 w-20 flex-shrink-0 rounded-xl bg-slate-200 dark:bg-white/10" />
      <div className="flex-1 min-w-0 space-y-2 py-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="h-3.5 w-28 rounded bg-slate-200 dark:bg-white/10" />
          <div className="h-4 w-16 rounded-full bg-slate-200 dark:bg-white/10" />
        </div>
        <div className="h-2.5 w-20 rounded bg-slate-200 dark:bg-white/10" />
        <div className="h-2.5 w-32 rounded bg-slate-200 dark:bg-white/10" />
        <div className="h-2.5 w-24 rounded bg-slate-200 dark:bg-white/10" />
      </div>
    </div>
  );
}
