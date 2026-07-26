# Sahabhagi (सहभागी) — Civic Hazard Reporting Platform

A Progressive Web App connecting citizens reporting urban hazards (blocked drains, potholes, waste dumping) to KMC Ward officials via a live density-weighted heatmap and dispatch dashboard.

**Live demo:** https://sahabaghi.org

---

## What's in this build

- **Real password authentication** — bcrypt-hashed (cost 12) email/password sign-up & sign-in, plus a "Continue with Google" demo option and one-tap demo logins. See [Security](#security) below.
- **Clickable reports everywhere** — every report card in the Community Feed, every pin on the map, and every row in the officer dashboard opens a full **Report Detail** view: photo, description, a visual status tracker, the complete officer progress-note history, and a comment thread.
- **Upvote / downvote validation** — every report can be upvoted or downvoted by any citizen (except its own reporter). `voteScore = upvotes − downvotes` and directly drives both the heatmap intensity and the officer's Report Management ranking — a downvoted report visibly de-prioritizes, an upvoted one rises to the top.
- **Comments** — citizens (and officers) can leave comments on any report for extra context, visible to everyone viewing that report.
- **Notifications** — anyone who filed or upvoted a report gets notified when its status changes, when an officer logs a progress note, and gets a distinct "thanks for validating" acknowledgement once it's resolved. Bell icon with unread badge in the citizen header.
- **Resolved reports are closed to voting** — enforced server-side, not just in the UI. Upvoters see a thank-you acknowledgement instead of vote buttons once a report they backed is resolved.
- **Officer Progress Notes** — ward officers keep a running, timestamped log of what's being done on a report (materials ordered, crew scheduled, etc.), separate from just changing status. Every entry is permanent and visible to the citizen in their report's tracking timeline.
- **Dark mode** — toggle from Settings (citizen Profile tab) or the sidebar (officer dashboard). Persists across sessions.
- **Restructured officer dashboard** — Overview (clickable stat cards that open the exact reports behind each number, a Top Reports panel ranked by vote score, and a full-size live map), Report Management (was "Dispatch Queue" — filterable, sorted by community validation + urgency), Live Map, a dedicated Stats & Data section (category breakdowns, resolution rate, charts), and Leaderboard.
- **Ward Eligibility Profile** — an optional section under the citizen's Profile tab where they can add their NID number, occupation, household size, disability/illness flags. Entirely optional, never required to use the app, visible only to Ward admins, and used to confirm Good Citizen Certificate eligibility.
- **Express + Firebase Admin backend** — auth and writes go through the server (not client-side Firestore), with automatic in-memory fallback so the demo works with zero setup
- **Density-weighted heatmap** — weight per report is `max(1 + voteScore, 0.2)`, so community votes directly reshape hotspots. Resolved reports fade to 10% weight.
- **Full PWA support** — installable on Android/iOS/desktop, offline tile caching, auto-appearing "Install App" button
- **Real Sahabhagi logo** throughout — login screen, app header, PWA icons, favicon

---

## Security

- Passwords are hashed with **bcrypt** (cost factor 12) — never stored or logged in plain text, never returned by any API response (`passwordHash` is stripped server-side before every response).
- Auth uses signed, expiring **JWTs** (7-day expiry). Sessions can't be forged without the server's `JWT_SECRET`.
- A stricter **rate limiter** (20 requests / 15 min) applies to all `/auth/*` routes to slow down brute-force or credential-stuffing attempts, separate from the general 300 req/15 min API limit.
- Security response headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security` in production, restrictive `Permissions-Policy`) are set on every response.
- CORS is restricted to `FRONTEND_URL` in production (set this env var on your backend host) rather than left open to `*`.
- Login error messages are intentionally generic ("Invalid email or password") so the API never reveals whether an email is registered.

---

## Demo accounts

All seeded accounts share the password **`Demo@1234`**. Use the one-tap demo buttons on the login screen, or sign in manually:

| Role | Email | Password | Notes |
|---|---|---|---|
| Citizen | `ramila.tamang@example.com` | `Demo@1234` | Pre-seeded, 62 civic score, ward profile already complete |
| Officer | `officer.ward10@example.com` | `Demo@1234` | Redirects straight to `/admin` dashboard |

Use **"Create Account"** on the login screen to register a brand-new citizen with your own email + password — useful for demoing the "first-time user" flow, including the ward-profile-incomplete banner. "Continue with Google" is still available as a demo-mode shortcut (see [Wiring up real Google OAuth](#wiring-up-real-google-oauth-post-demo)).

**Other seeded citizens** you can log in as to see varied leaderboard positions and ward-profile states: `nabin.shrestha@example.com`, `sita.karki@example.com` (no ward profile — tests the "incomplete" banner), `ramesh.gurung@example.com`, `maya.lama@example.com` (has a disability flag set), `bikash.rai@example.com`, `sunita.poudel@example.com`, `anita.shah@example.com`.

---

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   React PWA          │ HTTPS   │  Express Backend       │
│   (Vercel)            │ ──────► │  (Railway/Render)      │
│                        │         │                        │
│  react-leaflet         │         │  Firebase Admin SDK ──┼──► Firestore (DB)
│  leaflet.heat          │         │  Cloudinary SDK     ──┼──► Cloudinary (photos)
│  vite-plugin-pwa       │         │  JWT auth              │
└─────────────────────┘         └──────────────────────┘
```

Everything writes through Express using the Firebase **Admin SDK**, which bypasses Firestore security rules entirely. That's deliberate — client-side Firestore rules are fragile and easy to misconfigure, which is almost certainly why the old direct-Firestore version broke. One backend, one auth system, one place to debug.

---

## Project structure

```
sahabaghi/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx              # Password auth (sign in / create account) + Google demo + anonymous toggle
│   │   │   ├── CitizenApp.tsx          # Mobile-first citizen view, 4 tabs + report FAB + Settings
│   │   │   └── AdminDashboard.tsx      # Officer view: Overview / Report Management / Live Map / Stats & Data / Leaderboard
│   │   ├── components/
│   │   │   ├── MapView.tsx             # Heatmap + markers + vote button + "View Details" in popups
│   │   │   ├── ReportModal.tsx         # Report submission form with duplicate-detection flow
│   │   │   ├── ReportDetailModal.tsx   # Clickable report detail: tracking timeline, votes, comments, officer notes
│   │   │   ├── NotificationsBell.tsx   # Status-change / resolution notifications dropdown
│   │   │   ├── WardProfileForm.tsx     # Optional NID/disability/illness profile
│   │   │   └── Layout.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx        # Dark mode, persisted to localStorage
│   │   └── lib/api.ts                  # All backend calls
│   ├── public/icons/                   # Real Sahabhagi logo, generated at all PWA sizes
│   ├── index.html
│   ├── vite.config.ts
│   ├── vercel.json                     # Set Vercel's "Root Directory" to frontend/
│   └── package.json
├── backend/
│   ├── server.js                       # Password auth (bcrypt), reports, votes, comments, notifications, progress notes, heatmap, leaderboard
│   └── package.json
└── package.json                        # Root convenience scripts — `npm run install:all`, `npm run dev` (runs both at once)
```

---

## Local development

**Option A — one command from the project root** (installs `concurrently`, runs both servers with labeled, colored output):
```bash
npm run install:all   # installs frontend/ and backend/ dependencies
npm run dev            # runs both dev servers together
```

**Option B — two terminals, if you prefer to see each server's output separately:**

**Terminal 1 — Backend:**
```bash
cd backend
npm install
npm run dev
```
You'll see:
```
🚀 Sahabhagi API running at http://localhost:3001
   DB mode : In-memory (dev)
   Demo logins (password: Demo@1234):
   Citizen → ramila.tamang@example.com
   Officer → officer.ward10@example.com
```

**Terminal 2 — Frontend** (new terminal):
```bash
cd frontend
npm install
npm run dev
```
Opens on `http://localhost:5173`. Vite proxies `/api/*` to port 3001 automatically — no `.env` needed for local dev.

**Try it:**
1. Go to `/login` → tap the "Citizen demo" quick-login button (or sign in manually with `ramila.tamang@example.com` / `Demo@1234`)
2. Submit a report near an existing seeded cluster (e.g. New Baneshwor area) — you should see the "Already Reported Nearby" screen with an upvote option
3. Tap any report card in the Community Feed or a map pin's "View Details" button — see the full tracking timeline, vote, and leave a comment
4. Log out, log back in as the "Officer demo" → open **Report Management**, click into a report, write an Officer Progress Note, and advance its status → log back in as the citizen and see the update appear in that report's timeline
5. In the officer Overview, click any stat card (e.g. "Awaiting Response") to see exactly which reports make up that number
6. Toggle dark mode from Settings (citizen Profile tab) or the sidebar (officer dashboard)

---

## Wiring up real Google OAuth (post-demo)

Right now, the "Continue with Google" button shows a form asking for name + email and trusts whatever's typed in — there's no actual Google verification. To make it real:

1. **Google Cloud Console** → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)
2. Add your Vercel domain to Authorized JavaScript origins
3. **Frontend:** install `@react-oauth/google`, wrap the app in `<GoogleOAuthProvider clientId="...">`, replace the demo form in `src/pages/Login.tsx` with the real `<GoogleLogin>` button, which returns a Google ID token
4. **Backend:** install `google-auth-library`, and in `backend/server.js` replace the body of `POST /auth/login/google` — instead of trusting `req.body.email`/`req.body.name` directly, call `client.verifyIdToken({ idToken })` and extract the verified `email`/`name` from the payload. This is a single function swap; the rest of the route (user lookup/creation, JWT issuance) stays identical.

The file has a comment block at the top marking exactly where this goes.

---

## How the vote system works

Every report can be upvoted ("I'm facing this too" / confirming it's real) or downvoted (disputing it) by any citizen other than its own reporter — one vote per user, and voting the same direction again removes it (toggle).

**Flow:**
1. Citizen picks a category and fills the report form
2. On submit, the backend checks `/reports/nearby?lat=X&lng=Y&type=Category` — any unresolved report of the same category within **60 meters**, excluding the citizen's own reports
3. If matches exist, the citizen sees each one with distance and current vote count, plus an **"I'm facing this too"** button
4. Tapping it (or the vote buttons inside the Report Detail view) calls `POST /reports/:id/vote` with `{ direction: "up" | "down" }` — this updates `upvoterIds[]` / `downvoterIds[]` server-side (one vote per user, enforced) and recomputes `voteScore = upvoteCount − downvoteCount`
5. **No new database row is created for an upvote co-sign.** The existing report just gets heavier — or lighter, if disputed.

**1 upvote = +1, 1 downvote = −1.** `voteScore` is the single number that drives both prioritization surfaces:

```js
// Heatmap weight (per report, summed per grid cell, then normalized 0–1)
weight = statusFactor * max(1 + voteScore, 0.2)

// Officer Report Management queue ranking
urgency = (1 + voteScore) * 10 + ageInHours
```

A heavily-upvoted report jumps to the top of Report Management and turns the map redder even if filed more recently than other tickets. A heavily-downvoted report sinks toward the bottom and is flagged as "disputed" in Stats & Data once `voteScore <= -2`.

You can verify this directly: `GET /reports/heatmap` returns the raw `{lat, lng, weight}` points before rendering, and `GET /reports/:id` shows `upvoteCount`, `downvoteCount`, `voteScore`, `comments[]`, and `progressLog[]` on every report.

**Resolved reports are closed to voting**, enforced server-side: `POST /reports/:id/vote` returns `400` once `status === "Resolved"`, not just hidden in the UI. The Report Detail view shows a lock icon with "Resolved reports are closed to voting," and swaps in an acknowledgement banner instead — "🙏 Thanks for helping validate this" for upvoters, "✅ Resolved — thanks for reporting this" for the original reporter.

---

## Notifications

Anyone with a stake in a report — the person who filed it, and everyone who upvoted it — gets notified whenever something changes on it. No polling required on your end to test this; the bell icon in the citizen header polls `GET /notifications` every 20 seconds and shows an unread-count badge.

| Trigger | Reporter gets | Upvoters get |
|---|---|---|
| Officer changes status (Reported → Acknowledged → Dispatched) | "Your report status changed" | "A report you upvoted was updated" |
| Officer logs a progress note without changing status | "A report you upvoted was updated" (same message — anyone following it gets pinged) | same |
| Officer marks it **Resolved** | "✅ Your report was resolved" | "🙏 Thanks for helping validate this — your vote helped it get prioritized" |

Tapping a notification opens that report's detail view and marks it read. Backend routes: `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` — all `requireAuth`, all scoped to the calling user's own notifications.

---

## The Ward Eligibility Profile

Lives under the citizen's **Profile tab → "Ward Eligibility Profile"** button. Everything in it is optional:

- **NID number** — the only field that actually gates anything: setting it flips `wardProfileComplete: true`, which is what the Ward would check before issuing a Good Citizen Certificate
- **Occupation, household size** — context for the Ward, no functional effect
- **Disability / chronic illness toggles** (with optional free-text notes) — intended so the Ward can plan accessibility access or prioritize monsoon-season outreach to vulnerable households, not for anything punitive or public
- **Free-text notes** — anything else the citizen wants the Ward to know

This data is **never shown publicly, never on the leaderboard, never in report popups** — it only round-trips through `PATCH /auth/me/ward-profile` and sits on the user record for admin reference. If you build a real admin-side viewer for this later, make sure it stays officer-only and audit-logged, since NID + disability/illness data is sensitive even within a civic-tech context.

---

## Deployment

This is a two-workspace repo (`frontend/` + `backend/`) — deploy them as two separate services.

### Frontend → Vercel

1. Import the repo in Vercel, then set **Project Settings → General → Root Directory** to `frontend`
2. Build command and output directory are already configured via `frontend/vercel.json` / Vite defaults — no changes needed
3. Add these environment variables in Vercel project settings, then redeploy:
   ```
   VITE_API_URL = https://your-backend-url.up.railway.app
   VITE_CLOUDINARY_CLOUD_NAME = your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET = sahabaghi_unsigned
   ```

### Backend → Railway or Render

1. Import the same repo, then set the service's **Root Directory** to `backend` (Railway: Settings → Root Directory; Render: Root Directory field when creating the Web Service)
2. Add environment variables:
   ```
   JWT_SECRET=<node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
   FIREBASE_SERVICE_ACCOUNT_JSON=<paste full service account JSON as one line>
   FIREBASE_PROJECT_ID=your-firebase-project-id
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend.vercel.app
   ```
   `FRONTEND_URL` locks CORS down to your real domain (comma-separate multiple origins if needed). Leaving it unset falls back to `*`, which is fine for a quick demo but not for the real pilot.
3. Build command: `npm install`. Start command: `npm start`.
4. Copy the deployed URL into Vercel's `VITE_API_URL`

---

## Firebase setup (for persistence beyond a demo session)

Works with zero Firebase config out of the box (in-memory fallback, resets on restart — fine for live demos). For the real Ward 10 pilot:

1. Firebase Console → Project Settings → Service Accounts → Generate new private key
2. **Never commit this JSON file.** Paste its full contents as one line into `FIREBASE_SERVICE_ACCOUNT_JSON` on Railway/Render, or save locally as `backend/firebase-service-account.json` (gitignored) and set `GOOGLE_APPLICATION_CREDENTIALS` in `backend/.env`
3. `users` and `reports` collections are created automatically on first write — no manual schema setup

**Firestore Security Rules** (lock down direct client access, since the Admin SDK bypasses these anyway):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Cloudinary setup

1. [cloudinary.com](https://cloudinary.com) free account → copy Cloud Name, API Key, API Secret
2. Create an **unsigned upload preset** named `sahabaghi_unsigned` (Settings → Upload → Add upload preset → Signing Mode: Unsigned)
3. Add cloud name + preset to frontend env vars, all three values to backend env vars

---

## PWA install

- **Android / Desktop Chrome/Edge:** "Install App" button appears automatically in the citizen app header once the browser confirms the manifest + service worker are valid
- **iOS Safari:** no automatic prompt (Apple platform limitation) — users tap Share → Add to Home Screen manually
- Verify after deploying: DevTools → Application → Manifest (no errors) and → Service Workers (shows "activated and running")

---

## What's still demo/placeholder logic (intentional)

- **Google OAuth is mocked** — see "Wiring up real Google OAuth" above for the exact swap
- **In-memory fallback resets on backend restart** — set `FIREBASE_SERVICE_ACCOUNT_JSON` for persistence
- **Trust scoring / anomaly detection (false-report defense) is not implemented** — explicitly scoped as Phase 2 in the original strategy doc. The upvote system and login requirement are the only anti-abuse layers right now.
- **60-meter duplicate radius is a flat constant** (`NEARBY_RADIUS_METERS` in `backend/server.js`) — fine for a pilot, but a real production version might vary this by issue category (a "Waste Dumping" pile and a "Pothole" probably shouldn't use the same radius)

---

## Next steps toward the real pilot build

1. Swap Firestore → PostgreSQL + PostGIS (Neon.tech free tier) for proper geospatial clustering (`ST_ClusterDBSCAN`) instead of the grid-approximation used here
2. Wire up real Google OAuth (see above)
3. Add Phase 2 features: trust scoring, two-way officer/citizen threads, community validation of resolved reports, certificate PDF generation referencing the Ward Eligibility Profile data
4. Build an officer-only, audit-logged view for Ward Eligibility Profile data (currently stored but not surfaced anywhere in the admin dashboard — intentionally left out of this build since it's sensitive data that needs proper access control before it's displayed anywhere)
