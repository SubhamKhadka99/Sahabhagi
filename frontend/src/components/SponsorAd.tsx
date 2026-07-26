/**
 * Sponsor ad placements — DEMO / SALES MOCKUP ONLY.
 *
 * These are not wired to any ad-serving logic. They exist so the ward
 * team can show potential local sponsors exactly what a purchased
 * placement will look like and where it will sit, before any backend
 * work is done to make it dynamic. The sponsor here — "Everest Hardware
 * & Paints" — is a fictional stand-in with an original logo mark (not
 * a real brand's trademark). Swap the name, copy, and logo for a real
 * sponsor's details once a deal is signed, or wire it up to an API.
 */

// Original logo mark for the fictional sponsor: a mountain peak (nods to
// "Everest") with a paint drip, in the app's own navy/teal/amber palette.
// Not based on, or a copy of, any real company's trademark.
function EverestLogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Everest Hardware & Paints logo">
      <defs>
        <linearGradient id="ehp-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00B4D8" />
          <stop offset="1" stopColor="#0A192F" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="url(#ehp-bg)" />
      {/* back peak */}
      <path d="M8 31L17 15L23 25.5L8 31Z" fill="#ffffff" fillOpacity="0.35" />
      {/* front peak */}
      <path d="M15 32L26 12L37 32H15Z" fill="#ffffff" />
      {/* snow cap */}
      <path d="M26 12L29.5 18.3L26.6 17.6L23.7 19.2L26 12Z" fill="#F5C542" />
      {/* paint drip off the peak */}
      <path d="M31.5 22c1.4 1.6 2.1 2.9 2.1 4.1a2.1 2.1 0 1 1-4.2 0c0-1.2.7-2.5 2.1-4.1Z" fill="#F5C542" />
    </svg>
  );
}

// ── Citizen app: slim banner pinned right under the header, visible on
// every tab without scrolling — the "premium" top-of-app placement ──
export function SponsorTopBanner() {
  return (
    <div className="relative flex-shrink-0 flex items-center gap-3 border-b border-subtle bg-amber-50/80 dark:bg-amber-500/[0.06] px-4 py-3">
      <span className="absolute top-2 right-2 flex-shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[9px] font-semibold px-2 py-0.5 uppercase tracking-wide">
        Sponsored
      </span>
      <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
        <EverestLogoMark size={44} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold heading truncate">Everest Hardware &amp; Paints</p>
        <p className="text-xs muted truncate">Ward 10's trusted hardware store — 10% off for Sahabhagi users this month</p>
      </div>
      <button className="flex-shrink-0 rounded-full bg-[#00B4D8] text-white text-xs font-semibold px-3 py-1.5 hover:bg-cyan-500 active:scale-95 transition-all shadow-sm">
        Visit
      </button>
    </div>
  );
}

// ── Citizen app: native card that sits inline in the community feed ──
export function SponsorFeedCard() {
  return (
    <article className="relative rounded-2xl surface p-3 shadow-sm border-dashed">
      <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[9px] font-semibold px-2 py-0.5 uppercase tracking-wide">
        Sponsored
      </span>
      <div className="flex gap-3">
        <div className="h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden shadow-sm">
          <EverestLogoMark size={64} />
        </div>
        <div className="flex-1 min-w-0 pr-14">
          <p className="text-sm font-semibold heading truncate">Everest Hardware &amp; Paints</p>
          <p className="text-xs muted">Ward 10's trusted hardware store since 1998 — 10% off for Sahabhagi users this month.</p>
        </div>
      </div>
      <button className="mt-3 w-full rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] text-xs font-semibold py-2 hover:bg-[#00B4D8]/20 transition">
        Visit Store →
      </button>
      <p className="mt-2 text-[9px] muted-2 text-center">Ad space · reserved for local sponsors</p>
    </article>
  );
}

// ── Ward dashboard: wide banner shown to officers/officials on Overview ──
export function SponsorBanner() {
  return (
    <article className="relative rounded-2xl border border-dashed border-amber-300 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
            <EverestLogoMark size={44} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold heading">Sponsor Spotlight</p>
              <span className="rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[9px] font-semibold px-2 py-0.5 uppercase tracking-wide">
                Ad Space
              </span>
            </div>
            <p className="text-xs muted truncate">Example: "Everest Hardware &amp; Paints — proud supporter of Ward 10 civic action"</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs muted">Available placement</p>
          <p className="text-sm font-bold heading">Overview banner</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] muted-2">
        This banner shows every ward officer who opens the dashboard. Reserved for local businesses and civic sponsors — contact the ward office to book this space.
      </p>
    </article>
  );
}
