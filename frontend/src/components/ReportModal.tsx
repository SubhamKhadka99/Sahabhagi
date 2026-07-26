import { Camera, CheckCircle2, EyeOff, Loader2, MapPin, Send, ThumbsUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { api, type NearbyMatch } from "../lib/api";

export type IssueCategory =
  | "Blocked Drain" | "Pothole" | "Waste Dumping" | "Broken Streetlight"
  | "Road Crack" | "Water Leakage" | "Sewer Overflow"
  | "Fallen Tree" | "Structural Damage" | "Others";

const CATEGORIES: { label: IssueCategory; emoji: string }[] = [
  { label: "Blocked Drain",      emoji: "🌊" },
  { label: "Pothole",            emoji: "🕳️" },
  { label: "Waste Dumping",      emoji: "🗑️" },
  { label: "Broken Streetlight", emoji: "💡" },
  { label: "Road Crack",         emoji: "🛣️" },
  { label: "Water Leakage",      emoji: "💧" },
  { label: "Sewer Overflow",     emoji: "🔴" },
  { label: "Fallen Tree",        emoji: "🌳" },
  { label: "Structural Damage",  emoji: "🏗️" },
  { label: "Others",             emoji: "📌" },
];

export interface ReportInput {
  category: IssueCategory;
  imageFile: File | null;
  description: string;
  isAnonymous: boolean;
}

interface Props {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: ReportInput) => Promise<void>;
  onUpvoted: () => void;
}

type Phase = "form" | "checking" | "duplicate-found" | "upvoting";

export default function ReportModal({ open, submitting, onClose, onSubmit, onUpvoted }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<IssueCategory>("Blocked Drain");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(user?.isAnonymous ?? false);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState("");

  const [phase, setPhase] = useState<Phase>("form");
  const [matches, setMatches] = useState<NearbyMatch[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [upvoteDone, setUpvoteDone] = useState(false);
  const [matchNotes, setMatchNotes] = useState<Record<string, string>>({});

  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : ""), [imageFile]);

  // Reset internal state whenever the modal is closed/reopened
  useEffect(() => {
    if (!open) {
      setPhase("form");
      setMatches([]);
      setCoords(null);
      setUpvoteDone(false);
      setLocErr("");
      setMatchNotes({});
    }
  }, [open]);

  async function checkForDuplicatesAndSubmit(e: FormEvent) {
    e.preventDefault();
    setLocErr("");
    setLocating(true);
    let position: GeolocationPosition;
    try {
      position = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, enableHighAccuracy: true })
      );
    } catch {
      setLocErr("Location access denied. Please enable GPS and try again.");
      setLocating(false);
      return;
    }
    setLocating(false);

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    setCoords({ lat, lng });

    // Check for nearby reports of the same category before letting them duplicate
    setPhase("checking");
    try {
      const nearby = await api.reports.findNearby(lat, lng, category);
      if (nearby.length > 0) {
        setMatches(nearby);
        setPhase("duplicate-found");
        return;
      }
    } catch {
      // If the lookup fails, fall through to a normal submission rather than blocking the user
    }

    await onSubmit({ category, imageFile, description, isAnonymous });
    setCategory("Blocked Drain");
    setImageFile(null);
    setDescription("");
    setPhase("form");
  }

  async function handleUpvote(reportId: string) {
    setPhase("upvoting");
    try {
      await api.reports.vote(reportId, "up");
      const note = matchNotes[reportId]?.trim();
      if (note) {
        await api.reports.comment(reportId, note).catch(() => {
          // Upvote already succeeded — a failed comment shouldn't block the flow.
        });
      }
      setUpvoteDone(true);
      onUpvoted();
      setTimeout(() => {
        setCategory("Blocked Drain");
        setImageFile(null);
        setDescription("");
        setPhase("form");
        setUpvoteDone(false);
        setMatchNotes({});
        onClose();
      }, 1100);
    } catch {
      setPhase("duplicate-found");
    }
  }

  async function handleSubmitAnywayInstead() {
    setPhase("form");
    await onSubmit({ category, imageFile, description, isAnonymous });
    setCategory("Blocked Drain");
    setImageFile(null);
    setDescription("");
    setPhase("form");
  }

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[1000] overflow-y-auto">
      <div className="absolute inset-0 bg-[#0A192F]/95 backdrop-blur-sm" onClick={phase === "form" ? onClose : undefined} />

      <div className="relative m-3 rounded-2xl border border-white/10 bg-[#0d1f3c] shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* ── PHASE: form ──────────────────────────────────────────── */}
        {phase === "form" && (
          <form onSubmit={e => void checkForDuplicatesAndSubmit(e)}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 className="text-white font-semibold">Report an Issue</h2>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Reporter identity */}
              <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div>
                  <p className="text-slate-400 text-xs">Reporting as</p>
                  <p className="text-white text-sm font-medium">
                    {isAnonymous ? "Anonymous Citizen" : (user?.name ?? "You")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAnonymous(v => !v)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isAnonymous
                      ? "bg-[#00B4D8]/20 text-[#00B4D8] border border-[#00B4D8]/40"
                      : "bg-white/10 text-slate-400 border border-white/10 hover:border-white/30"
                  }`}
                >
                  <EyeOff size={12} />
                  {isAnonymous ? "Anonymous ON" : "Post as yourself"}
                </button>
              </div>

              {/* Category grid */}
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Issue Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setCategory(c.label)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all ${
                        category === c.label
                          ? "bg-[#00B4D8] text-white font-semibold shadow-lg shadow-cyan-500/20"
                          : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <span>{c.emoji}</span>
                      <span className="truncate">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo */}
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Photo Evidence</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => setImageFile(e.target.files?.[0] ?? null)}
                />
                {previewUrl ? (
                  <div className="relative">
                    <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-white/10" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#00B4D8]/50 bg-[#00B4D8]/5 py-5 hover:bg-[#00B4D8]/10 transition"
                  >
                    <Camera size={22} className="text-[#00B4D8]" />
                    <span className="text-sm text-[#00B4D8] font-medium">Take Photo / Choose from Gallery</span>
                    <span className="text-xs text-slate-500">Reports with photos are 15% more likely to be resolved</span>
                  </button>
                )}
              </div>

              {/* Description */}
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">
                  Landmark / Description <span className="text-slate-600 normal-case">(optional)</span>
                </p>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="e.g. Near school gate on Ring Road, beside Ward 10 office…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] resize-none transition"
                />
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <MapPin size={14} className="text-[#00B4D8] flex-shrink-0" />
                <p className="text-xs text-slate-400">GPS location auto-attached on submit · we'll check if this is already reported nearby</p>
              </div>

              {locErr && <p className="text-red-400 text-xs">{locErr}</p>}
              {isAnonymous && (
                <p className="text-[#00B4D8] text-xs text-center">
                  This report will appear as "Anonymous Citizen" on the public map
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || locating}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00B4D8] hover:bg-cyan-500 active:scale-95 disabled:opacity-60 py-3 text-white font-semibold transition-all shadow-lg shadow-cyan-500/20"
              >
                {(submitting || locating) ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {locating ? "Getting location…" : submitting ? "Submitting…" : "Continue"}
              </button>
            </div>
          </form>
        )}

        {/* ── PHASE: checking ──────────────────────────────────────── */}
        {phase === "checking" && (
          <div className="p-10 flex flex-col items-center gap-3 text-center">
            <Loader2 size={28} className="text-[#00B4D8] animate-spin" />
            <p className="text-white text-sm font-medium">Checking nearby reports…</p>
            <p className="text-slate-500 text-xs">Making sure we're not duplicating an existing report</p>
          </div>
        )}

        {/* ── PHASE: duplicate found ───────────────────────────────── */}
        {phase === "duplicate-found" && (
          <div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 className="text-white font-semibold">Already Reported Nearby</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-300">
                Looks like someone already reported <strong className="text-white">{category}</strong> very close by.
                If this is the same problem, upvote it (and add a comment if you'd like) instead of creating a duplicate —
                it helps the Ward prioritize this faster and keeps the map clean.
              </p>

              {matches.map(m => (
                <div key={m.report.id} className="rounded-xl border border-[#00B4D8]/30 bg-[#00B4D8]/5 p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-white text-sm font-medium">{m.report.type}</p>
                    <span className="text-[#00B4D8] text-xs font-semibold flex-shrink-0">{Math.round(m.distanceMeters)}m away</span>
                  </div>
                  {m.report.description && <p className="text-slate-400 text-xs mb-2">{m.report.description}</p>}
                  <p className="text-xs text-slate-500 mb-2">
                    {m.report.upvoteCount > 0 ? `${m.report.upvoteCount} more facing this` : "Reported once so far"}
                  </p>
                  <textarea
                    value={matchNotes[m.report.id] ?? ""}
                    onChange={e => setMatchNotes(prev => ({ ...prev, [m.report.id]: e.target.value }))}
                    rows={1}
                    placeholder="Optional comment, e.g. 'Still blocked, worse after today's rain' (optional)"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00B4D8] resize-none transition mb-2"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => void handleUpvote(m.report.id)}
                      className="flex items-center gap-1.5 rounded-full bg-[#00B4D8] hover:bg-cyan-500 text-white text-xs font-semibold px-3 py-1.5 transition active:scale-95"
                    >
                      <ThumbsUp size={12} /> I'm facing this too
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => void handleSubmitAnywayInstead()}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 underline py-2 transition"
              >
                This is actually a different issue — submit a new report
              </button>
            </div>
          </div>
        )}

        {/* ── PHASE: upvoting / done ───────────────────────────────── */}
        {phase === "upvoting" && (
          <div className="p-10 flex flex-col items-center gap-3 text-center">
            {upvoteDone ? (
              <>
                <CheckCircle2 size={32} className="text-emerald-400" />
                <p className="text-white text-sm font-medium">Thanks! Your voice has been added.</p>
                <p className="text-slate-500 text-xs">This report just became more urgent on the Ward dashboard.</p>
              </>
            ) : (
              <>
                <Loader2 size={28} className="text-[#00B4D8] animate-spin" />
                <p className="text-white text-sm font-medium">Adding your upvote…</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
