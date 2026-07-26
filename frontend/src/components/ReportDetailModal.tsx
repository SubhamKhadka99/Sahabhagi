import {
  CheckCheck, CheckCircle2, ChevronDown, Clock3, Camera, Loader2, Lock, MapPin, MessageCircle,
  Send, ThumbsDown, ThumbsUp, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, type Report, type ReportStatus } from "../lib/api";

const STEPS: ReportStatus[] = ["Reported", "Acknowledged", "Dispatched", "Resolved"];

const STATUS_BADGE: Record<ReportStatus, string> = {
  Reported:     "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  Acknowledged: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  Dispatched:   "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Resolved:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
};

const STATUS_NEXT: Partial<Record<ReportStatus, ReportStatus>> = {
  Reported: "Acknowledged",
  Acknowledged: "Dispatched",
  Dispatched: "Resolved",
};

interface Props {
  reportId: string | null;
  initialReport?: Report;
  onClose: () => void;
  onChanged?: (updated: Report) => void;
  /** Force officer tools even if role check is ambiguous — defaults to auth user's role */
  officerMode?: boolean;
}

export default function ReportDetailModal({ reportId, initialReport, onClose, onChanged, officerMode }: Props) {
  const { user } = useAuth();
  const [report, setReport] = useState<Report | null>(initialReport ?? null);
  const [loading, setLoading] = useState(!initialReport);
  const [voting, setVoting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [eta, setEta] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [verifyPhoto, setVerifyPhoto] = useState<File | null>(null);
  const [verifyNote, setVerifyNote] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const isOfficer = officerMode ?? (user?.role === "officer");

  useEffect(() => {
    if (!reportId) return;
    setReport(initialReport ?? null);
    setLoading(!initialReport);
    api.reports.get(reportId)
      .then(r => { setReport(r); setLoading(false); })
      .catch(() => setLoading(false));
    setCommentText("");
    setNoteText("");
    setShowAllComments(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  if (!reportId) return null;

  function applyUpdate(updated: Report) {
    setReport(updated);
    onChanged?.(updated);
  }

  async function handleVote(direction: "up" | "down") {
    if (!report || voting || report.status === "Resolved") return;
    setVoting(true);
    try {
      const updated = await api.reports.vote(report.id, direction);
      applyUpdate(updated);
    } catch {
      // silently ignore — e.g. own report, already handled by disabling button
    } finally {
      setVoting(false);
    }
  }

  async function handleComment() {
    if (!report || !commentText.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const updated = await api.reports.comment(report.id, commentText.trim());
      applyUpdate(updated);
      setCommentText("");
    } finally {
      setPostingComment(false);
    }
  }

  async function handleSaveNote() {
    if (!report || !noteText.trim() || savingNote) return;
    setSavingNote(true);
    try {
      const updated = await api.reports.addProgressNote(report.id, noteText.trim());
      applyUpdate(updated);
      setNoteText("");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleAdvance() {
    if (!report) return;
    const next = STATUS_NEXT[report.status];
    if (!next) return;
    setAdvancing(true);
    try {
      const updated = await api.reports.updateStatus(report.id, next, noteText.trim() || undefined, next === "Resolved" ? eta : undefined);
      applyUpdate(updated);
      setNoteText("");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleVerify() {
    if (!report || !verifyPhoto || verifying) return;
    setVerifying(true);
    setVerifyError("");
    try {
      const updated = await api.reports.verify(report.id, verifyPhoto, verifyNote.trim() || undefined);
      applyUpdate(updated);
      setVerifyPhoto(null);
      setVerifyNote("");
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  const alreadyUpvoted = report?.upvoterIds?.includes(user?.id ?? "");
  const alreadyDownvoted = report?.downvoterIds?.includes(user?.id ?? "");
  const isOwnReport = report?.reporterId === user?.id;
  const isResolved = report?.status === "Resolved";
  const votingDisabled = voting || isOwnReport || isResolved;
  const currentStepIdx = report ? STEPS.indexOf(report.status) : 0;
  const canVerify = !!report && isResolved && !report.verification && (isOwnReport || !!alreadyUpvoted);

  const comments = report?.comments ?? [];
  const visibleComments = showAllComments ? comments : comments.slice(-3);

  return (
    <div className="fixed inset-0 z-[3000] overflow-y-auto">
      <div className="absolute inset-0 bg-[#0A192F]/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          className="relative w-full sm:max-w-lg surface rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up max-h-[92dvh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-subtle flex-shrink-0">
            <h2 className="heading font-semibold text-sm">Report Details</h2>
            <button onClick={onClose} className="muted hover:text-heading p-1 rounded-lg transition">
              <X size={18} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-[#00B4D8]" size={26} />
              </div>
            )}

            {!loading && report && (
              <div className="p-4 space-y-4">
                {/* Image */}
                {report.imageUrl && (
                  <img src={report.imageUrl} alt={report.type} className="w-full h-48 object-cover rounded-2xl border border-subtle" />
                )}

                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="heading font-bold text-lg truncate">{report.type}</h3>
                    <p className="muted text-xs">
                      Reported by {report.reporterName} · {new Date(report.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[report.status]}`}>
                    {report.status}
                  </span>
                </div>

                {report.description && <p className="body-text text-sm">{report.description}</p>}

                <a
                  href={`https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}&zoom=17`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#00B4D8] hover:underline w-fit"
                >
                  <MapPin size={12} /> {report.lat.toFixed(5)}, {report.lng.toFixed(5)} · Open in OSM ↗
                </a>

                {/* Resolved acknowledgement banner for upvoters */}
                {isResolved && alreadyUpvoted && !isOwnReport && (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5">
                    <span className="text-lg flex-shrink-0">🙏</span>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">
                      <span className="font-semibold">Thanks for helping validate this.</span> Your upvote helped this report get prioritized and resolved.
                    </p>
                  </div>
                )}
                {isResolved && isOwnReport && (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5">
                    <span className="text-lg flex-shrink-0">✅</span>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">
                      <span className="font-semibold">Resolved.</span> Thanks for reporting this — the Ward has closed it out.
                    </p>
                  </div>
                )}

                {/* Vote row */}
                <div className="flex items-center gap-2 surface-subtle rounded-2xl p-2">
                  <button
                    onClick={() => void handleVote("up")}
                    disabled={votingDisabled}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition disabled:opacity-40 ${
                      alreadyUpvoted ? "bg-[#00B4D8] text-white" : "bg-white dark:bg-white/10 text-[#00B4D8] border border-[#00B4D8]/30 hover:bg-[#00B4D8]/10"
                    }`}
                  >
                    <ThumbsUp size={14} /> {report.upvoteCount}
                  </button>
                  <div className="text-center px-2">
                    <p className="heading font-bold text-sm">{report.voteScore > 0 ? `+${report.voteScore}` : report.voteScore}</p>
                    <p className="muted-2 text-[10px]">net score</p>
                  </div>
                  <button
                    onClick={() => void handleVote("down")}
                    disabled={votingDisabled}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition disabled:opacity-40 ${
                      alreadyDownvoted ? "bg-red-500 text-white" : "bg-white dark:bg-white/10 text-red-500 border border-red-300/40 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10"
                    }`}
                  >
                    <ThumbsDown size={14} /> {report.downvoteCount}
                  </button>
                </div>
                {isResolved ? (
                  <p className="muted-2 text-[11px] text-center -mt-2 flex items-center justify-center gap-1">
                    <Lock size={10} /> Resolved reports are closed to voting
                  </p>
                ) : isOwnReport ? (
                  <p className="muted-2 text-[11px] text-center -mt-2">You can't vote on your own report</p>
                ) : null}

                {/* Tracking timeline */}
                <div>
                  <p className="muted text-xs uppercase tracking-widest mb-2 font-semibold">Tracking</p>
                  <div className="flex items-center mb-3">
                    {STEPS.map((step, i) => (
                      <div key={step} className="flex items-center flex-1 last:flex-none">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          i <= currentStepIdx ? "bg-[#00B4D8] text-white" : "bg-slate-200 dark:bg-white/10 text-slate-400"
                        }`}>
                          {i < currentStepIdx ? <CheckCircle2 size={13} /> : i + 1}
                        </div>
                        {i < STEPS.length - 1 && (
                          <div className={`h-0.5 flex-1 mx-1 rounded ${i < currentStepIdx ? "bg-[#00B4D8]" : "bg-slate-200 dark:bg-white/10"}`} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] muted-2 px-0.5 mb-3">
                    {STEPS.map(s => <span key={s} className={s === report.status ? "font-semibold text-[#00B4D8]" : ""}>{s}</span>)}
                  </div>

                  {/* Progress log */}
                  {report.progressLog.length === 0 ? (
                    <p className="muted-2 text-xs italic">No officer updates yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {[...report.progressLog].reverse().map(entry => (
                        <div key={entry.id} className="flex gap-2.5 rounded-xl surface-subtle px-3 py-2">
                          <Clock3 size={13} className="text-[#00B4D8] flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="body-text text-xs">{entry.note}</p>
                            <p className="muted-2 text-[10px] mt-0.5">
                              {entry.officerName} · {entry.status} · {new Date(entry.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Citizen verification — closing loop */}
                {isResolved && (report.verification || canVerify) && (
                  <div className="rounded-2xl border border-emerald-300/50 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5 p-3 space-y-2.5">
                    <p className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCheck size={13} /> Citizen Verification
                    </p>
                    {report.verification ? (
                      <div className="space-y-2">
                        {report.verification.photoUrl && (
                          <img
                            src={report.verification.photoUrl}
                            alt="Closing verification"
                            className="w-full h-40 object-cover rounded-xl border border-emerald-300/40 dark:border-emerald-500/20"
                          />
                        )}
                        <p className="text-xs body-text">
                          ✅ Verified resolved by <span className="font-semibold">{report.verification.userName}</span>
                          {" · "}{new Date(report.verification.timestamp).toLocaleString()}
                        </p>
                        {report.verification.note && <p className="text-xs muted italic">“{report.verification.note}”</p>}
                        <p className="muted-2 text-[10px] flex items-center gap-1"><Lock size={10} /> Closing loop complete — no further verifications accepted</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs muted">
                          {isOwnReport ? "You reported this issue." : "You upvoted this issue."} Confirm it's actually fixed by uploading one photo — this closes the loop and can't be edited or replaced afterward.
                        </p>
                        <label className="flex items-center gap-2 rounded-xl border border-dashed border-emerald-400/50 px-3 py-2.5 cursor-pointer hover:bg-emerald-500/5 transition text-xs">
                          <Camera size={15} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                          <span className="truncate muted">{verifyPhoto ? verifyPhoto.name : "Choose a photo of the resolved issue"}</span>
                          <input
                            type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={e => setVerifyPhoto(e.target.files?.[0] ?? null)}
                          />
                        </label>
                        <input
                          value={verifyNote}
                          onChange={e => setVerifyNote(e.target.value)}
                          placeholder="Optional note (e.g. 'Drain is clear now')"
                          maxLength={300}
                          className="field text-xs"
                        />
                        {verifyError && <p className="text-red-500 text-[11px]">{verifyError}</p>}
                        <button
                          onClick={() => void handleVerify()}
                          disabled={!verifyPhoto || verifying}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold py-2 transition"
                        >
                          {verifying ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
                          Verify & Close the Loop
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Officer tools */}
                {isOfficer && (
                  <div className="rounded-2xl border border-[#00B4D8]/30 bg-[#00B4D8]/5 p-3 space-y-2.5">
                    <p className="text-[#00B4D8] text-xs font-semibold uppercase tracking-widest">Officer Progress Note</p>
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      rows={2}
                      placeholder='e.g. "Crew Alpha dispatched, materials ordered, expect completion Thursday"'
                      className="field text-sm resize-none"
                    />
                    {STEPS.indexOf(report.status) === 3 - 1 && (
                      <input
                        type="date"
                        value={eta}
                        onChange={e => setEta(e.target.value)}
                        className="field text-sm"
                        aria-label="Estimated resolution date"
                      />
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleSaveNote()}
                        disabled={!noteText.trim() || savingNote}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white dark:bg-white/10 border border-[#00B4D8]/40 text-[#00B4D8] text-xs font-semibold py-2 disabled:opacity-50 transition"
                      >
                        {savingNote ? <Loader2 size={13} className="animate-spin" /> : null}
                        Save Note Only
                      </button>
                      {STATUS_NEXT[report.status] && (
                        <button
                          onClick={() => void handleAdvance()}
                          disabled={advancing}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#0A192F] hover:bg-[#1a3a6b] text-white text-xs font-semibold py-2 disabled:opacity-60 transition"
                        >
                          {advancing ? <Loader2 size={13} className="animate-spin" /> : null}
                          Mark → {STATUS_NEXT[report.status]}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="muted text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
                      <MessageCircle size={13} /> Comments ({comments.length})
                    </p>
                    {comments.length > 3 && !showAllComments && (
                      <button onClick={() => setShowAllComments(true)} className="text-[#00B4D8] text-xs flex items-center gap-0.5 hover:underline">
                        Show all <ChevronDown size={12} />
                      </button>
                    )}
                  </div>
                  {comments.length === 0 ? (
                    <p className="muted-2 text-xs italic">No comments yet. Be the first to add context.</p>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {visibleComments.map(c => (
                        <div key={c.id} className="surface-subtle rounded-xl px-3 py-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="heading text-xs font-semibold">
                              {c.authorName} {c.authorRole === "officer" && <span className="text-[#00B4D8] font-normal">· Ward Officer</span>}
                            </p>
                            <p className="muted-2 text-[10px]">{new Date(c.timestamp).toLocaleDateString()}</p>
                          </div>
                          <p className="body-text text-xs">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") void handleComment(); }}
                      placeholder="Add a comment…"
                      maxLength={500}
                      className="field text-sm flex-1"
                    />
                    <button
                      onClick={() => void handleComment()}
                      disabled={!commentText.trim() || postingComment}
                      className="flex items-center justify-center rounded-xl bg-[#00B4D8] hover:bg-cyan-500 disabled:opacity-50 text-white px-3.5 transition"
                    >
                      {postingComment ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
