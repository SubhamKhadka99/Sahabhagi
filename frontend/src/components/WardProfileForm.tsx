import { CheckCircle2, IdCard, Loader2, Lock, Save } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, type WardProfile } from "../lib/api";

interface Props {
  onClose: () => void;
}

/**
 * Optional data citizens can provide so Ward 10 can verify certificate
 * eligibility and plan accessibility/welfare outreach. Nothing here is
 * required to use the app or to submit reports — it only affects whether
 * the Ward can issue an official Good Citizen Certificate and whether the
 * Ward can flag a household for targeted support (disability access,
 * chronic illness monsoon risk, etc).
 */
export default function WardProfileForm({ onClose }: Props) {
  const { user, updateUser } = useAuth();
  const existing = user?.wardProfile ?? {};

  const [nidNumber, setNidNumber] = useState(existing.nidNumber ?? "");
  const [hasDisability, setHasDisability] = useState(existing.hasDisability ?? false);
  const [disabilityNote, setDisabilityNote] = useState(existing.disabilityNote ?? "");
  const [occupation, setOccupation] = useState(existing.occupation ?? "");
  const [hasChronicIllness, setHasChronicIllness] = useState(existing.hasChronicIllness ?? false);
  const [illnessNote, setIllnessNote] = useState(existing.illnessNote ?? "");
  const [householdSize, setHouseholdSize] = useState(existing.householdSize?.toString() ?? "");
  const [notes, setNotes] = useState(existing.notes ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const wardProfile: WardProfile = {
      nidNumber: nidNumber.trim() || undefined,
      hasDisability,
      disabilityNote: hasDisability ? disabilityNote.trim() || undefined : undefined,
      occupation: occupation.trim() || undefined,
      hasChronicIllness,
      illnessNote: hasChronicIllness ? illnessNote.trim() || undefined : undefined,
      householdSize: householdSize ? parseInt(householdSize, 10) : undefined,
      notes: notes.trim() || undefined,
      updatedAt: Date.now(),
    };
    try {
      const updated = await api.auth.updateProfile(wardProfile);
      updateUser({ wardProfile: updated.wardProfile, wardProfileComplete: updated.wardProfileComplete });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[1000] overflow-y-auto bg-[#0A192F]/95 backdrop-blur-sm">
      <div className="m-3 rounded-2xl border border-white/10 bg-[#0d1f3c] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <IdCard size={18} className="text-[#00B4D8]" />
            <h2 className="text-white font-semibold">Ward Eligibility Profile</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded-lg transition">
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Privacy notice */}
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
            <Lock size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              Everything below is <strong>optional</strong> and only visible to Ward 10 administrators —
              never shown publicly or on the leaderboard. It's used solely to confirm certificate
              eligibility and to help the Ward plan accessibility support during monsoon season.
            </p>
          </div>

          {/* NID */}
          <label className="block">
            <span className="text-slate-300 text-sm font-medium mb-1 block">
              National ID (NID) Number <span className="text-slate-500 font-normal">— required for certificate issuance</span>
            </span>
            <input
              type="text"
              value={nidNumber}
              onChange={e => setNidNumber(e.target.value)}
              placeholder="e.g. 12-34-56-78901"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] transition"
            />
          </label>

          {/* Occupation */}
          <label className="block">
            <span className="text-slate-300 text-sm font-medium mb-1 block">
              Occupation <span className="text-slate-500 font-normal">(optional)</span>
            </span>
            <input
              type="text"
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
              placeholder="e.g. Shopkeeper, Student, Driver"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] transition"
            />
          </label>

          {/* Household size */}
          <label className="block">
            <span className="text-slate-300 text-sm font-medium mb-1 block">
              Household size <span className="text-slate-500 font-normal">(optional)</span>
            </span>
            <input
              type="number"
              min={1}
              max={30}
              value={householdSize}
              onChange={e => setHouseholdSize(e.target.value)}
              placeholder="e.g. 4"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] transition"
            />
          </label>

          {/* Disability toggle */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <button
              type="button"
              onClick={() => setHasDisability(v => !v)}
              className="w-full flex items-center justify-between"
            >
              <span className="text-sm font-medium text-white">Person in household has a disability</span>
              <div className={`w-10 h-5.5 rounded-full p-0.5 transition-colors ${hasDisability ? "bg-[#00B4D8]" : "bg-white/15"}`}>
                <div className={`w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${hasDisability ? "translate-x-4" : ""}`} />
              </div>
            </button>
            {hasDisability && (
              <input
                type="text"
                value={disabilityNote}
                onChange={e => setDisabilityNote(e.target.value)}
                placeholder="Type of support needed (optional)"
                className="mt-3 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]"
              />
            )}
          </div>

          {/* Chronic illness toggle */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <button
              type="button"
              onClick={() => setHasChronicIllness(v => !v)}
              className="w-full flex items-center justify-between"
            >
              <span className="text-sm font-medium text-white">Person in household has a chronic illness</span>
              <div className={`w-10 h-5.5 rounded-full p-0.5 transition-colors ${hasChronicIllness ? "bg-[#00B4D8]" : "bg-white/15"}`}>
                <div className={`w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${hasChronicIllness ? "translate-x-4" : ""}`} />
              </div>
            </button>
            {hasChronicIllness && (
              <input
                type="text"
                value={illnessNote}
                onChange={e => setIllnessNote(e.target.value)}
                placeholder="Condition or relevant detail (optional)"
                className="mt-3 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]"
              />
            )}
          </div>

          {/* Free notes */}
          <label className="block">
            <span className="text-slate-300 text-sm font-medium mb-1 block">
              Anything else the Ward should know? <span className="text-slate-500 font-normal">(optional)</span>
            </span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Elderly resident living alone, needs ground-floor access…"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] resize-none transition"
            />
          </label>

          {/* Save */}
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00B4D8] hover:bg-cyan-500 disabled:opacity-60 py-3 text-white font-semibold transition active:scale-95"
          >
            {saved
              ? <><CheckCircle2 size={18} /> Saved</>
              : saving
                ? <><Loader2 size={18} className="animate-spin" /> Saving…</>
                : <><Save size={18} /> Save Profile</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
