import { ArrowDownWideNarrow, ArrowUpWideNarrow, Filter } from "lucide-react";
import type { ReportStatus } from "../lib/api";

const STATUSES: ReportStatus[] = ["Reported", "Acknowledged", "Dispatched", "Resolved"];

interface Props {
  types: string[];
  typeFilter: string | null;
  onTypeChange: (t: string | null) => void;
  statusFilter: ReportStatus | null;
  onStatusChange: (s: ReportStatus | null) => void;
  sort: "date_desc" | "date_asc";
  onSortChange: (s: "date_desc" | "date_asc") => void;
}

export default function FilterSortBar({
  types, typeFilter, onTypeChange, statusFilter, onStatusChange, sort, onSortChange,
}: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest muted-2 flex-shrink-0">
        <Filter size={11} /> Filter
      </span>
      <select
        value={typeFilter ?? ""}
        onChange={e => onTypeChange(e.target.value || null)}
        className="flex-shrink-0 text-xs font-medium rounded-full border border-subtle surface-subtle px-2.5 py-1.5 muted focus:outline-none focus:ring-1 focus:ring-[#00B4D8]"
        aria-label="Filter by issue type"
      >
        <option value="">All Types</option>
        {types.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select
        value={statusFilter ?? ""}
        onChange={e => onStatusChange((e.target.value || null) as ReportStatus | null)}
        className="flex-shrink-0 text-xs font-medium rounded-full border border-subtle surface-subtle px-2.5 py-1.5 muted focus:outline-none focus:ring-1 focus:ring-[#00B4D8]"
        aria-label="Filter by status"
      >
        <option value="">All Statuses</option>
        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <button
        onClick={() => onSortChange(sort === "date_desc" ? "date_asc" : "date_desc")}
        className="flex-shrink-0 flex items-center gap-1 text-xs font-medium rounded-full border border-subtle surface-subtle px-2.5 py-1.5 muted hover:opacity-80 transition"
        aria-label="Toggle sort order"
      >
        {sort === "date_desc" ? <ArrowDownWideNarrow size={12} /> : <ArrowUpWideNarrow size={12} />}
        {sort === "date_desc" ? "Newest" : "Oldest"}
      </button>
    </div>
  );
}
