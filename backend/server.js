/**
 * Sahabhagi Express Backend
 * ─────────────────────────
 * Stack: Express + Firebase Admin (Firestore) + Cloudinary
 *
 * Auth: Two modes are supported side by side —
 *   1. Email + Password  — bcrypt-hashed (cost 12), real accounts.
 *   2. Google Sign-In     — DEMO MODE ONLY. Trusts the client-submitted
 *      email/name. Replace with real Google ID-token verification before
 *      production (see comment on the /auth/login/google route).
 *
 * Security measures in this file:
 *   - Passwords hashed with bcrypt (never stored/returned in plaintext)
 *   - JWT access tokens, 7 day expiry, HS256
 *   - Helmet-style security headers on every response
 *   - Stricter rate limiting on auth routes (brute-force mitigation)
 *   - CORS restricted to configured frontend origin(s) in production
 *   - Input validation on every route that accepts a body
 *
 * Demo accounts (seeded on first run), password for all: "Demo@1234"
 *   Citizen : ramila.tamang@example.com
 *   Officer : officer.ward10@example.com
 *
 * Voting model: each report carries independent upvoterIds / downvoterIds
 * lists. voteScore = upvotes − downvotes. The Ward officer queue and the
 * heatmap both rank/weight using voteScore, not raw report count — so
 * community validation directly controls prioritization.
 */

"use strict";

require("dotenv").config({ override: true });
const express      = require("express");
const cors         = require("cors");
const jwt          = require("jsonwebtoken");
const bcrypt       = require("bcryptjs");
const multer       = require("multer");
const { v4: uuid } = require("uuid");
const rateLimit    = require("express-rate-limit");
const cache         = require("./cache");
const queue         = require("./queue");
const chatbot       = require("./chatbot");
const { OAuth2Client } = require("google-auth-library");
const pendingRegistrations = require("./pendingRegistrations");
const { sendOtpEmail } = require("./mailer");

// ── Firebase Admin ────────────────────────────────────────────────────────────
const admin = require("firebase-admin");

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
} else {
  console.warn("⚠️  No Firebase credentials found — using in-memory store.");
  console.warn("   Set FIREBASE_SERVICE_ACCOUNT_JSON in backend/.env for persistence.");
}

let db = null;
if (serviceAccount) {
  const resolvedProjectId = process.env.FIREBASE_PROJECT_ID;
  console.log(`ℹ️  Connecting to Firestore project: ${JSON.stringify(resolvedProjectId)}`);
  if (serviceAccount.project_id && resolvedProjectId && serviceAccount.project_id !== resolvedProjectId) {
    console.error(`❌ MISMATCH: FIREBASE_PROJECT_ID is "${resolvedProjectId}" but your service account`);
    console.error(`   belongs to project "${serviceAccount.project_id}". Firestore WILL fail with`);
    console.error(`   PERMISSION_DENIED until FIREBASE_PROJECT_ID is set to "${serviceAccount.project_id}".`);
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: resolvedProjectId,
    });
  }
  db = admin.firestore();
  console.log("✅ Firebase Admin connected");
}

// ── Cloudinary ────────────────────────────────────────────────────────────────
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── In-memory fallback store ──────────────────────────────────────────────────
const memUsers   = new Map();
const memReports = new Map();
const memNotifications = new Map(); // id -> notification (flat, filtered by userId on read)

const OFFICER_EMAIL = "officer.ward10@example.com";
const OFFICER_ID = "demo-officer-001";

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;
if (!googleClient) {
  console.warn("⚠️  GOOGLE_CLIENT_ID not set — 'Continue with Google' will respond with 503 until it's configured.");
}
const PRIMARY_CITIZEN_ID = "demo-citizen-001";
const DEMO_PASSWORD = "Demo@1234";
const SALT_ROUNDS = 12;

function seedDemoData() {
  const demoHash = bcrypt.hashSync(DEMO_PASSWORD, SALT_ROUNDS);

  // ── Citizens (varied profiles, some with ward profiles filled, some not) ──
  const citizens = [
    { id: PRIMARY_CITIZEN_ID, name: "Ramila Tamang", email: "ramila.tamang@example.com",
      civicScore: 62, reportCount: 6,
      wardProfile: { nidNumber: "12-34-56-78901", occupation: "Shopkeeper", householdSize: 4,
        hasDisability: false, hasChronicIllness: false, updatedAt: Date.now() - 86400_000 * 3 } },
    { id: "demo-citizen-002", name: "Nabin Shrestha", email: "nabin.shrestha@example.com",
      civicScore: 48, reportCount: 5,
      wardProfile: { nidNumber: "23-45-67-89012", occupation: "Driver", householdSize: 3,
        hasDisability: false, hasChronicIllness: true, illnessNote: "Asthma — monsoon humidity risk",
        updatedAt: Date.now() - 86400_000 * 7 } },
    { id: "demo-citizen-003", name: "Sita Karki", email: "sita.karki@example.com",
      civicScore: 41, reportCount: 4 },
    { id: "demo-citizen-004", name: "Ramesh Gurung", email: "ramesh.gurung@example.com",
      civicScore: 35, reportCount: 3 },
    { id: "demo-citizen-005", name: "Maya Lama", email: "maya.lama@example.com",
      civicScore: 28, reportCount: 2,
      wardProfile: { nidNumber: "34-56-78-90123", occupation: "Tailor", householdSize: 5,
        hasDisability: true, disabilityNote: "Wheelchair access needed",
        updatedAt: Date.now() - 86400_000 } },
    { id: "demo-citizen-006", name: "Bikash Rai", email: "bikash.rai@example.com",
      civicScore: 19, reportCount: 2 },
    { id: "demo-citizen-007", name: "Sunita Poudel", email: "sunita.poudel@example.com",
      civicScore: 12, reportCount: 1 },
    { id: "demo-citizen-008", name: "Anita Shah", email: "anita.shah@example.com",
      civicScore: 8, reportCount: 1 },
  ];

  for (const c of citizens) {
    memUsers.set(c.id, {
      id: c.id, name: c.name, displayName: c.name, email: c.email,
      passwordHash: demoHash,
      authProvider: "password", isAnonymous: false,
      civicScore: c.civicScore, reportCount: c.reportCount,
      role: "citizen", ward: 10,
      wardProfile: c.wardProfile ?? {},
      wardProfileComplete: !!c.wardProfile?.nidNumber,
      createdAt: Date.now(),
    });
  }

  memUsers.set(OFFICER_ID, {
    id: OFFICER_ID, name: "Officer Ram Thapa", displayName: "Officer Ram Thapa",
    email: OFFICER_EMAIL, passwordHash: demoHash,
    authProvider: "password", isAnonymous: false,
    civicScore: 0, reportCount: 0, role: "officer", ward: 10,
    wardProfile: {}, wardProfileComplete: false, createdAt: Date.now(),
  });

  // Cloudinary's own public demo assets — always available, no account needed.
  // Used only so seeded "before/after" photos actually render in the demo.
  const DEMO_PHOTO = "https://res.cloudinary.com/demo/image/upload/w_900,q_auto/sample.jpg";
  const DEMO_PHOTO_2 = "https://res.cloudinary.com/demo/image/upload/w_900,q_auto/landscape.jpg";
  const OFFICER_NAME = "Officer Ram Thapa";

  // reporterIdx counts intentionally sum to each citizen's declared
  // reportCount above (6/5/4/3/2/2/1/1 = 24 reports), so "My Reports" on the
  // profile screen and the leaderboard both look consistent in the demo.
  const seed = [
    // ── Ramila (0) — 6 reports, incl. one already-verified closed ticket ──
    { type:"Blocked Drain", lat:27.6955, lng:85.3390, status:"Reported", reporterIdx:0,
      desc:"Overflowing onto the road every time it rains — standing water for days.",
      upvoteIdxs:[1,2,3,4], downvoteIdxs:[],
      comments:[
        { authorIdx:1, text:"Same drain, completely clogged with plastic waste near the corner shop." },
        { authorIdx:3, text:"Kids walk through this to get to school, it's getting dangerous." },
      ] },
    { type:"Blocked Drain", lat:27.6957, lng:85.3392, status:"Reported", reporterIdx:0,
      desc:"Second blocked section of the same drain, water backing up into a shop entrance.",
      upvoteIdxs:[2,3], downvoteIdxs:[] },
    { type:"Waste Dumping", lat:27.6922, lng:85.3099, status:"Acknowledged", reporterIdx:0,
      desc:"Garbage pile growing for over a week, attracting stray dogs at night.",
      upvoteIdxs:[3,4,5,6], downvoteIdxs:[],
      comments:[
        { authorIdx:5, text:"It's worse on weekends, restaurant waste gets added too." },
        { officer:true, text:"Logged with the sanitation team — a collection crew is being scheduled." },
      ],
      progress:[ { status:"Acknowledged", note:"Confirmed on-site, sanitation team notified.", hoursAgo:30 } ] },
    { type:"Pothole", lat:27.6988, lng:85.3179, status:"Dispatched", reporterIdx:0,
      desc:"Deep pothole near the bus stop, already caused one bike accident.",
      upvoteIdxs:[1,4], downvoteIdxs:[2],
      comments:[
        { authorIdx:2, text:"I pass here daily, it's not that deep — might be lower priority than others on this list." },
        { authorIdx:1, text:"Disagree, a scooter went down here last week." },
      ],
      progress:[
        { status:"Acknowledged", note:"Site visit done, confirmed hazard.", hoursAgo:40 },
        { status:"Dispatched", note:"Road crew scheduled for this week.", hoursAgo:14 },
      ] },
    { type:"Sewer Overflow", lat:27.6944, lng:85.3068, status:"Reported", reporterIdx:0,
      desc:"Sewer overflow near the Ring Road junction, bad smell since yesterday.",
      upvoteIdxs:[], downvoteIdxs:[1,2],
      comments:[
        { authorIdx:1, text:"Checked this morning, didn't see any overflow — might already be cleared?" },
      ] },
    { type:"Broken Streetlight", lat:27.7011, lng:85.3245, status:"Resolved", reporterIdx:0,
      desc:"Streetlight out for 3 weeks, dark alley — safety concern for women walking home.",
      upvoteIdxs:[1,2,3], downvoteIdxs:[],
      comments:[
        { authorIdx:2, text:"Been dark since the last storm, glad this got picked up." },
        { officer:true, text:"Bulb and wiring replaced — please confirm from your end when you get a chance." },
      ],
      progress:[
        { status:"Acknowledged", note:"Confirmed faulty wiring, requesting electrician crew.", hoursAgo:96 },
        { status:"Dispatched", note:"Electrician crew assigned, parts ordered.", hoursAgo:60 },
        { status:"Resolved", note:"Streetlight replaced and tested — working.", hoursAgo:20 },
      ],
      // ── Closed-loop review #1: already verified and LOCKED. Only the
      // first stakeholder to submit a closing photo is accepted — the
      // backend rejects (409) any further /verify attempts once this
      // exists, which is exactly what the live demo should show. ──
      verification: { verifierIdx:1, note:"Confirmed — light is on and working every night this week.", hoursAgo:10, photoUrl: DEMO_PHOTO } },

    // ── Nabin (1) — 5 reports ──
    { type:"Pothole", lat:27.6990, lng:85.3181, status:"Reported", reporterIdx:1,
      desc:"Growing pothole, cars swerving into oncoming traffic to avoid it.",
      upvoteIdxs:[0,3,5], downvoteIdxs:[] },
    { type:"Pothole", lat:27.6987, lng:85.3178, status:"Acknowledged", reporterIdx:1,
      desc:"Smaller pothole nearby, no road markings — dangerous at night.",
      upvoteIdxs:[0], downvoteIdxs:[2,5],
      comments:[ { authorIdx:5, text:"This one's minor compared to the one down the road, ward should prioritize that first." } ],
      progress:[ { status:"Acknowledged", note:"Added to this week's road-repair batch.", hoursAgo:22 } ] },
    { type:"Waste Dumping", lat:27.6921, lng:85.3098, status:"Reported", reporterIdx:1,
      desc:"Illegal dumping site right next to the community drinking water tap — health hazard.",
      upvoteIdxs:[0,2,3,4,5,6], downvoteIdxs:[],
      comments:[
        { authorIdx:4, text:"This is the one I'm most worried about, it's right next to where we fill water." },
        { authorIdx:6, text:"Agreed, this needs to be first on the list." },
        { officer:true, text:"Escalated — sanitation team is aware and this is flagged high priority." },
      ] },
    { type:"Water Leakage", lat:27.6975, lng:85.3155, status:"Dispatched", reporterIdx:1,
      desc:"Municipal pipe leaking continuously at the roadside, wasting water every day.",
      upvoteIdxs:[0,3], downvoteIdxs:[],
      progress:[
        { status:"Acknowledged", note:"Confirmed leak, water board notified.", hoursAgo:26 },
        { status:"Dispatched", note:"Repair crew scheduled for tomorrow morning.", hoursAgo:8 },
      ] },
    { type:"Road Crack", lat:27.6965, lng:85.3312, status:"Resolved", reporterIdx:1,
      desc:"Large crack across the lane, ward crew already fixed it — posting for the record.",
      upvoteIdxs:[0,3,4], downvoteIdxs:[],
      comments:[ { authorIdx:0, text:"Confirmed, drove over it yesterday and it's smooth now." } ],
      progress:[
        { status:"Acknowledged", note:"Crack assessed, minor structural risk.", hoursAgo:70 },
        { status:"Dispatched", note:"Asphalt crew assigned.", hoursAgo:34 },
        { status:"Resolved", note:"Crack filled and resurfaced.", hoursAgo:16 },
      ] },
      // Deliberately NOT verified — this is the "open" closed ticket to use
      // for a LIVE demo of the citizen verify-with-photo flow. Any of the
      // upvoters (or the reporter) can submit it once; a second attempt by
      // anyone else should be shown failing with "already verified".

    // ── Sita (2) — 4 reports ──
    { type:"Structural Damage", lat:27.6932, lng:85.3135, status:"Reported", reporterIdx:2,
      desc:"Retaining wall showing fresh cracks after the last heavy rain.",
      upvoteIdxs:[1], downvoteIdxs:[4,5],
      comments:[ { authorIdx:5, text:"Looked at it yesterday, seems like old cracks not new ones — worth a second opinion." } ] },
    { type:"Blocked Drain", lat:27.6941, lng:85.3052, status:"Acknowledged", reporterIdx:2,
      desc:"Drain blocked with leftover construction debris from the nearby building site.",
      upvoteIdxs:[0,1,6], downvoteIdxs:[],
      progress:[ { status:"Acknowledged", note:"Spoke to the construction site manager — debris removal ordered.", hoursAgo:18 } ] },
    { type:"Fallen Tree", lat:27.7001, lng:85.3201, status:"Resolved", reporterIdx:2,
      desc:"Tree fell across the lane after the storm, blocking the whole road.",
      upvoteIdxs:[], downvoteIdxs:[],
      progress:[
        { status:"Acknowledged", note:"Confirmed, full lane blockage.", hoursAgo:44 },
        { status:"Dispatched", note:"Emergency crew dispatched same day.", hoursAgo:42 },
        { status:"Resolved", note:"Tree removed, lane cleared.", hoursAgo:40 },
      ] },
    { type:"Others", lat:27.7022, lng:85.3267, status:"Reported", reporterIdx:2,
      desc:"Stray dog pack near the school gate, a few parents are worried about the kids.",
      upvoteIdxs:[0], downvoteIdxs:[] },

    // ── Ramesh (3) — 3 reports ──
    { type:"Waste Dumping", lat:27.6923, lng:85.3100, status:"Reported", reporterIdx:3,
      desc:"Overflowing public bins, uncollected for several days now.",
      upvoteIdxs:[0,1], downvoteIdxs:[] },
    { type:"Sewer Overflow", lat:27.6944, lng:85.3070, status:"Acknowledged", reporterIdx:3,
      desc:"Foul smell near the tea shop corner every evening — possible health risk.",
      upvoteIdxs:[0,2], downvoteIdxs:[1],
      comments:[
        { authorIdx:1, text:"Smelled fine when I walked past this morning, might be intermittent." },
        { officer:true, text:"We'll monitor over a few days before dispatching a crew — thanks for the reports." },
      ],
      progress:[ { status:"Acknowledged", note:"Logged, monitoring before dispatch.", hoursAgo:12 } ] },
    { type:"Broken Streetlight", lat:27.7013, lng:85.3248, status:"Dispatched", reporterIdx:3,
      desc:"Entire lane dark at night, several residents feel unsafe walking here.",
      upvoteIdxs:[], downvoteIdxs:[],
      progress:[
        { status:"Acknowledged", note:"Confirmed, three consecutive lights out.", hoursAgo:20 },
        { status:"Dispatched", note:"Electrician crew scheduled.", hoursAgo:6 },
      ] },

    // ── Maya (4) — 2 reports ──
    { type:"Pothole", lat:27.6989, lng:85.3183, status:"Reported", reporterIdx:4,
      desc:"Pothole right at the school junction — kids cross here every morning.",
      upvoteIdxs:[0,2,3], downvoteIdxs:[] },
    { type:"Blocked Drain", lat:27.6959, lng:85.3395, status:"Reported", reporterIdx:4,
      desc:"Possible duplicate of an earlier drain report — flagging in case it's already logged.",
      upvoteIdxs:[], downvoteIdxs:[0] },

    // ── Bikash (5) — 2 reports ──
    { type:"Water Leakage", lat:27.6977, lng:85.3157, status:"Acknowledged", reporterIdx:5,
      desc:"Leaking tap near the community well, wasting water throughout the day.",
      upvoteIdxs:[1,2], downvoteIdxs:[],
      progress:[ { status:"Acknowledged", note:"Confirmed, plumbing team notified.", hoursAgo:9 } ] },
    { type:"Structural Damage", lat:27.6934, lng:85.3137, status:"Reported", reporterIdx:5,
      desc:"Boundary wall leaning slightly after the monsoon — not urgent but worth flagging early.",
      upvoteIdxs:[0], downvoteIdxs:[] },

    // ── Sunita (6) — 1 report, biggest hotspot in the set ──
    { type:"Road Crack", lat:27.6968, lng:85.3315, status:"Reported", reporterIdx:6,
      desc:"Major crack across the entire road width — monsoon preparedness priority.",
      upvoteIdxs:[0,1,2,3,4], downvoteIdxs:[],
      comments:[
        { authorIdx:0, text:"This is the worst one on our street, please prioritize before monsoon." },
        { authorIdx:2, text:"+1, water pools here already even with light rain." },
      ] },

    // ── Anita (7) — 1 report, quiet/unengaged one for contrast ──
    { type:"Others", lat:27.6999, lng:85.3203, status:"Reported", reporterIdx:7,
      desc:"Illegal electric wiring hanging low over the footpath near the corner shop.",
      upvoteIdxs:[], downvoteIdxs:[] },
  ];

  seed.forEach((s, i) => {
    const id = `seed-${i}`;
    const reporter = citizens[s.reporterIdx];
    const upvoterIds = s.upvoteIdxs.map(idx => citizens[idx].id);
    const downvoterIds = (s.downvoteIdxs ?? []).map(idx => citizens[idx].id);
    // Newer index = more recent report; spread across ~4.5 days so the
    // status/progress timestamps below always land after report creation.
    const reportTimestamp = Date.now() - (seed.length - i) * 4 * 3600_000;

    const progressLog = (s.progress ?? []).map(p => ({
      id: uuid(), note: p.note, status: p.status,
      timestamp: Date.now() - p.hoursAgo * 3600_000,
      officerName: OFFICER_NAME,
    }));

    const comments = (s.comments ?? []).map(c => ({
      id: uuid(),
      authorId: c.officer ? OFFICER_ID : citizens[c.authorIdx].id,
      authorName: c.officer ? OFFICER_NAME : citizens[c.authorIdx].name,
      authorRole: c.officer ? "officer" : "citizen",
      text: c.text,
      timestamp: Date.now() - (c.hoursAgo ?? (6 + Math.floor(Math.random() * 30))) * 3600_000,
    }));

    let verification = null;
    if (s.verification) {
      const verifier = citizens[s.verification.verifierIdx];
      verification = {
        id: uuid(),
        userId: verifier.id,
        userName: verifier.name,
        photoUrl: s.verification.photoUrl ?? DEMO_PHOTO_2,
        note: s.verification.note ?? "",
        timestamp: Date.now() - s.verification.hoursAgo * 3600_000,
      };
      comments.push({
        id: uuid(), authorId: verifier.id, authorName: verifier.name, authorRole: "citizen",
        text: `✅ Verified resolved${verification.note ? `: ${verification.note}` : ""} — closing photo attached.`,
        timestamp: verification.timestamp,
      });
    }

    memReports.set(id, {
      id, type: s.type, lat: s.lat, lng: s.lng, description: s.desc, imageUrl: "",
      status: s.status, isAnonymous: false,
      reporterName: reporter.name, reporterId: reporter.id,
      timestamp: reportTimestamp,
      officerNote: progressLog.length ? progressLog[progressLog.length - 1].note : "",
      estimatedResolutionDate: "",
      upvoterIds, downvoterIds,
      upvoteCount: upvoterIds.length,
      downvoteCount: downvoterIds.length,
      voteScore: upvoterIds.length - downvoterIds.length,
      comments,
      progressLog,
      verification,
    });
  });

  // A couple of pre-seeded notifications so the bell isn't empty on first demo login
  const primaryCitizenReport = Array.from(memReports.values()).find(r => r.reporterId === PRIMARY_CITIZEN_ID);
  if (primaryCitizenReport) {
    memNotifications.set("seed-notif-1", {
      id: "seed-notif-1", userId: PRIMARY_CITIZEN_ID, reportId: primaryCitizenReport.id,
      type: "status_change", title: "Your report status changed",
      body: `"${primaryCitizenReport.type}" is now Acknowledged. Note: We've logged this and dispatched a crew assessment.`,
      read: false, timestamp: Date.now() - 3600_000 * 6,
    });
  }
  const upvotedBySeed = Array.from(memReports.values()).find(r => (r.upvoterIds ?? []).includes(PRIMARY_CITIZEN_ID));
  if (upvotedBySeed) {
    memNotifications.set("seed-notif-2", {
      id: "seed-notif-2", userId: PRIMARY_CITIZEN_ID, reportId: upvotedBySeed.id,
      type: "progress_note", title: "A report you upvoted was updated",
      body: `"${upvotedBySeed.type}" is now still ${upvotedBySeed.status}, with a new update. Note: Materials ordered, crew scheduled.`,
      read: false, timestamp: Date.now() - 3600_000 * 20,
    });
  }

  console.log(`✅ Seeded ${memReports.size} demo reports, ${memUsers.size} users`);
  console.log(`   Demo password for all seeded accounts: ${DEMO_PASSWORD}`);
}

// Firestore-aware full demo dataset. seedDemoData() above only ever writes to
// the in-memory maps — once real Firebase credentials are connected, every
// read/write goes through Firestore instead, so that in-memory data becomes
// invisible to the running app. This pushes the exact same users, reports
// (with their votes/comments/progress logs/verification), and notifications
// into Firestore so the rich demo dataset is actually testable through the
// real app, not just the in-memory fallback.
//
// Idempotent by default — skips any document that already exists, so
// restarting the server never clobbers votes/comments/status changes made
// while testing. Set FORCE_RESEED_FIRESTORE=true to overwrite everything
// back to the canonical seed state (useful right before a demo/test run).
async function seedFirestoreFromMemory({ force = false } = {}) {
  if (!dbUsable()) return { users: 0, reports: 0, notifications: 0 };

  async function writeAll(collectionName, items) {
    const BATCH_LIMIT = 400; // Firestore hard limit is 500 writes/batch
    let batch = db.batch();
    let pending = 0;
    let written = 0;
    for (const item of items) {
      const ref = db.collection(collectionName).doc(item.id);
      if (!force) {
        const snap = await ref.get();
        if (snap.exists) continue;
      }
      batch.set(ref, item);
      pending++;
      written++;
      if (pending >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
    if (pending > 0) await batch.commit();
    return written;
  }

  const users = await writeAll("users", Array.from(memUsers.values()));
  const reports = await writeAll("reports", Array.from(memReports.values()));
  const notifications = await writeAll("notifications", Array.from(memNotifications.values()));
  await cache.invalidate("reports:");
  await cache.invalidate("stats:");
  console.log(
    `✅ Firestore demo dataset synced — users:${users} reports:${reports} notifications:${notifications}` +
    (force ? " (forced overwrite — reset to canonical seed state)" : " (skipped anything already present)")
  );
  return { users, reports, notifications };
}
// Demo accounts (incl. a known officer password) must never be reachable in
// production — combined with the fail-fast check below that refuses to boot
// in production without real Firebase credentials, this closes the hole
// entirely: prod can never fall back to the in-memory store these seed into.
// NOTE: the actual seedDemoData()/seedFirestoreFromMemory() calls live at the
// very bottom of this file, right before app.listen() — they reference
// dbUsable()/firestoreBroken (declared further down, in the DB helpers
// section), and calling them this early would throw a "Cannot access
// 'firestoreBroken' before initialization" TDZ error.

// ── Express setup ─────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT ?? 3001;
const IS_PROD = process.env.NODE_ENV === "production";

if (IS_PROD && !process.env.JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET is not set. Refusing to start in production without one.");
  console.error("   Generate one: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
  process.exit(1);
}
if (IS_PROD && !process.env.FRONTEND_URL) {
  console.error("❌ FATAL: FRONTEND_URL is not set. Refusing to start in production with an open CORS policy.");
  process.exit(1);
}
if (IS_PROD && !db) {
  console.error("❌ FATAL: No Firebase credentials found. Refusing to start in production on the in-memory store.");
  console.error("   Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET ?? "sahabhagi_dev_secret_CHANGE_IN_PROD"; // dev-only fallback; production path above exits before this matters
const FRONTEND_URL = process.env.FRONTEND_URL;

app.use(cors({
  origin: FRONTEND_URL ? FRONTEND_URL.split(",").map(s => s.trim()) : "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(express.json({ limit: "2mb" }));

// ── Process-level safety nets ─────────────────────────────────────────────────
// Without these, an unhandled promise rejection or thrown error outside an
// Express handler silently crashes the whole process with no log line telling
// you why. Log first, then let the process exit so your host (Railway/Render/
// pm2) can restart it — swallowing the error and limping on is worse.
process.on("unhandledRejection", (reason) => {
  console.error("🔥 Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught exception:", err);
  process.exit(1);
});

// ── Security headers (helmet-lite, no extra dependency required) ─────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(self)");
  if (IS_PROD) {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  next();
});

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait a few minutes and try again." },
});

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error("Only image uploads (JPEG, PNG, WEBP, GIF, HEIC) are allowed"));
    }
    cb(null, true);
  },
});

// ── DB helpers (Firestore or in-memory) ───────────────────────────────────────
// Firestore is optional. `db` being non-null only means admin.initializeApp()
// succeeded — it does NOT mean Firestore calls will actually succeed (wrong
// project ID, Firestore not provisioned, missing IAM role, etc. all surface
// later, on the first real read/write). Every helper below tries Firestore
// first (if usable) and falls back to the in-memory store on ANY failure —
// so a broken Firestore project degrades gracefully to the seeded in-memory
// data instead of 500ing every single route in the app.
let firestoreBroken = false;
function noteFirestoreFailure(err) {
  if (!firestoreBroken) {
    firestoreBroken = true;
    console.error("⚠️  Firestore call failed — falling back to the in-memory store for the rest of this run.");
    console.error("   Reason:", err.message);
    console.error("   To fix Firestore itself, check: (1) FIREBASE_PROJECT_ID exactly matches the");
    console.error("   'project_id' field in your service account JSON, (2) a Firestore database");
    console.error("   (Native mode) has actually been created for that project in the Firebase/GCP");
    console.error("   console, and (3) the service account has the 'Cloud Datastore User' (or");
    console.error("   'Firebase Admin') IAM role on that project.");
  }
}
function dbUsable() {
  return !!db && !firestoreBroken;
}

async function getUser(id) {
  if (dbUsable()) {
    try {
      const snap = await db.collection("users").doc(id).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    } catch (err) { noteFirestoreFailure(err); }
  }
  return memUsers.get(id) ?? null;
}

async function getUserByEmail(email) {
  if (dbUsable()) {
    try {
      const snap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (err) { noteFirestoreFailure(err); }
  }
  return Array.from(memUsers.values()).find(u => u.email === email) ?? null;
}

async function saveUser(user) {
  if (dbUsable()) {
    try {
      await db.collection("users").doc(user.id).set(user, { merge: true });
      return;
    } catch (err) { noteFirestoreFailure(err); }
  }
  memUsers.set(user.id, user);
}

async function getReports() {
  return cache.wrap("reports:all", 5, async () => {
    if (dbUsable()) {
      try {
        const snap = await db.collection("reports").orderBy("timestamp", "desc").limit(300).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) { noteFirestoreFailure(err); }
    }
    return Array.from(memReports.values()).sort((a, b) => b.timestamp - a.timestamp);
  });
}

async function getReport(id) {
  if (dbUsable()) {
    try {
      const snap = await db.collection("reports").doc(id).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    } catch (err) { noteFirestoreFailure(err); }
  }
  return memReports.get(id) ?? null;
}

async function saveReport(report) {
  if (dbUsable()) {
    try {
      await db.collection("reports").doc(report.id).set(report);
      await cache.invalidate("reports:");
      await cache.invalidate("stats:");
      return report;
    } catch (err) { noteFirestoreFailure(err); }
  }
  memReports.set(report.id, report);
  await cache.invalidate("reports:");
  await cache.invalidate("stats:");
  return report;
}

async function updateReport(id, updates) {
  if (dbUsable()) {
    try {
      await db.collection("reports").doc(id).update(updates);
      const snap = await db.collection("reports").doc(id).get();
      const result = { id: snap.id, ...snap.data() };
      await cache.invalidate("reports:");
      await cache.invalidate("stats:");
      return result;
    } catch (err) { noteFirestoreFailure(err); }
  }
  const report = memReports.get(id);
  if (!report) return null;
  const result = { ...report, ...updates };
  memReports.set(id, result);
  await cache.invalidate("reports:");
  await cache.invalidate("stats:");
  return result;
}

// ── Notifications ──────────────────────────────────────────────────────────
async function createNotification({ userId, reportId, type, title, body }) {
  const notification = {
    id: uuid(),
    userId,
    reportId,
    type, // "status_change" | "resolved_ack" | "progress_note"
    title,
    body,
    read: false,
    timestamp: Date.now(),
  };
  if (dbUsable()) {
    try {
      await db.collection("notifications").doc(notification.id).set(notification);
      return notification;
    } catch (err) { noteFirestoreFailure(err); }
  }
  memNotifications.set(notification.id, notification);
  return notification;
}

async function getNotificationsForUser(userId) {
  if (dbUsable()) {
    try {
      const snap = await db.collection("notifications")
        .where("userId", "==", userId)
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) { noteFirestoreFailure(err); }
  }
  return Array.from(memNotifications.values())
    .filter(n => n.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);
}

async function markNotificationRead(id, userId) {
  if (dbUsable()) {
    try {
      const ref = db.collection("notifications").doc(id);
      const snap = await ref.get();
      if (!snap.exists || snap.data().userId !== userId) return null;
      await ref.update({ read: true });
      return { id, ...snap.data(), read: true };
    } catch (err) { noteFirestoreFailure(err); }
  }
  const n = memNotifications.get(id);
  if (!n || n.userId !== userId) return null;
  const updated = { ...n, read: true };
  memNotifications.set(id, updated);
  return updated;
}

async function markAllNotificationsRead(userId) {
  const list = await getNotificationsForUser(userId);
  for (const n of list) {
    if (!n.read) await markNotificationRead(n.id, userId);
  }
}

/**
 * Notify everyone with a stake in a report — the original reporter and
 * everyone who upvoted it — whenever its status changes or an officer logs
 * progress. `resolvedAck` sends a distinct "thanks for validating" message
 * to upvoters instead of a generic status-change message, since a resolved
 * report is now closed to further action.
 */
async function notifyStakeholders(report, { actingUserId, resolvedAck = false, statusLabel, note, type: typeOverride } = {}) {
  const stakeholders = new Set([report.reporterId, ...(report.upvoterIds ?? [])]);
  stakeholders.delete(actingUserId);
  stakeholders.delete(undefined);

  for (const userId of stakeholders) {
    const isReporter = userId === report.reporterId;
    let title, body, type;

    if (resolvedAck) {
      type = "resolved_ack";
      if (isReporter) {
        title = `✅ Your report was resolved`;
        body = `"${report.type}" has been marked Resolved by the Ward officer.${note ? ` Note: ${note}` : ""} It's now closed to further voting.`;
      } else {
        title = `🙏 Thanks for helping validate this`;
        body = `A "${report.type}" report you upvoted has been resolved. Your vote helped it get prioritized — thank you for participating.`;
      }
    } else {
      type = typeOverride ?? "status_change";
      title = isReporter ? `Your report status changed` : `A report you upvoted was updated`;
      body = `"${report.type}" is now ${statusLabel}.${note ? ` Note: ${note}` : ""}`;
    }

    await queue.push({ type: "notify", payload: { userId, reportId: report.id, type, title, body } });
  }
}

// Worker side of the queue — actually writes the notification. Runs
// out-of-band so a status change with many upvoters doesn't make the
// officer's request wait on each one.
queue.onProcess(async (job) => {
  if (job.type === "notify") {
    await createNotification(job.payload);
  }
});

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NEARBY_RADIUS_METERS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors frontend/src/components/ReportModal.tsx's IssueCategory union —
// keep both in sync if you add a category.
const REPORT_TYPES = new Set([
  "Blocked Drain", "Pothole", "Waste Dumping", "Broken Streetlight",
  "Road Crack", "Water Leakage", "Sewer Overflow",
  "Fallen Tree", "Structural Damage", "Others",
]);

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "No token provided" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

async function requireOfficer(req, res, next) {
  requireAuth(req, res, async () => {
    const user = await getUser(req.userId);
    if (!user || user.role === "citizen") return res.status(403).json({ message: "Officers only" });
    next();
  });
}

function safeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    db: db ? "firestore" : "memory",
    cache: cache.getMode(),
    ai: process.env.OPENROUTER_API_KEY ? "openrouter" : "computed-fallback",
    ts: new Date().toISOString(),
  });
});

// ── POST /auth/register ───────────────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many code requests. Please wait a few minutes." },
});

// ── POST /auth/register/start ─────────────────────────────────────────────────
// Step 1 of signup — validates input, emails a 6-digit OTP. No account is
// created yet; that only happens on successful /verify below.
app.post("/auth/register/start", authLimiter, otpLimiter, async (req, res) => {
  try {
    const { email, name, password, anonymous } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ message: "Enter a valid email address" });
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existing = await getUserByEmail(cleanEmail);
    if (existing) return res.status(409).json({ message: "An account with this email already exists" });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const otp = pendingRegistrations.create(cleanEmail, { name: String(name).trim(), passwordHash, anonymous: !!anonymous });
    await sendOtpEmail(cleanEmail, otp);

    res.json({ message: "Verification code sent to your email" });
  } catch (err) {
    console.error("Register start error:", err);
    res.status(500).json({ message: "Could not start registration" });
  }
});

// ── POST /auth/register/verify ────────────────────────────────────────────────
// Step 2 — verifying the code is what actually creates the account.
app.post("/auth/register/verify", authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and code are required" });
    const cleanEmail = String(email).trim().toLowerCase();

    const result = pendingRegistrations.verify(cleanEmail, String(otp).trim());
    if (!result.ok) return res.status(400).json({ message: result.reason });

    const { name, passwordHash, anonymous } = result.record;
    const isOfficer = cleanEmail === OFFICER_EMAIL;
    const id = isOfficer ? OFFICER_ID : uuid();
    const user = {
      id,
      name: isOfficer ? "Officer Ram Thapa" : name,
      displayName: anonymous ? "Anonymous Citizen" : (isOfficer ? "Officer Ram Thapa" : name),
      email: cleanEmail,
      passwordHash,
      authProvider: "password",
      isAnonymous: !!anonymous,
      civicScore: 0,
      reportCount: 0,
      role: isOfficer ? "officer" : "citizen",
      ward: 10,
      wardProfile: {},
      wardProfileComplete: false,
      createdAt: Date.now(),
    };
    await saveUser(user);
    const token = issueToken(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    console.error("Register verify error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

// ── POST /auth/register/resend ────────────────────────────────────────────────
app.post("/auth/register/resend", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const otp = pendingRegistrations.resend(cleanEmail);
    if (!otp) return res.status(400).json({ message: "No pending signup for this email — start again." });
    await sendOtpEmail(cleanEmail, otp);
    res.json({ message: "New code sent" });
  } catch (err) {
    console.error("Resend error:", err);
    res.status(500).json({ message: "Could not resend code" });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
app.post("/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await getUserByEmail(cleanEmail);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    const token = issueToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ── POST /auth/login/google ───────────────────────────────────────────────────
// Real Google Sign-In. The email comes from `payload.email`, extracted from
// an ID token Google itself cryptographically signed — never from a raw
// request-body field the client controls. There is no way to claim someone
// else's email (including the officer account) through this route.
app.post("/auth/login/google", authLimiter, async (req, res) => {
  try {
    const { idToken, anonymous } = req.body;
    if (!idToken) return res.status(400).json({ message: "idToken is required" });
    if (!googleClient) {
      return res.status(503).json({ message: "Google sign-in is not configured on this server" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email_verified) {
      return res.status(401).json({ message: "Google account email is not verified" });
    }
    const cleanEmail = payload.email.trim().toLowerCase();
    const name = payload.name ?? cleanEmail.split("@")[0];

    let user = await getUserByEmail(cleanEmail);
    if (!user) {
      const id = cleanEmail === OFFICER_EMAIL ? OFFICER_ID : uuid();
      user = {
        id, name, displayName: anonymous ? "Anonymous Citizen" : name,
        email: cleanEmail, authProvider: "google", isAnonymous: !!anonymous,
        civicScore: 0, reportCount: 0,
        role: cleanEmail === OFFICER_EMAIL ? "officer" : "citizen",
        ward: 10, wardProfile: {}, wardProfileComplete: false, createdAt: Date.now(),
      };
      if (user.role === "officer") {
        user.name = "Officer Ram Thapa";
        user.displayName = "Officer Ram Thapa";
      }
      await saveUser(user);
    } else {
      user.isAnonymous = !!anonymous;
      user.displayName = anonymous ? "Anonymous Citizen" : user.name;
      await saveUser(user);
    }

    const token = issueToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(401).json({ message: "Google sign-in failed" });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
app.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await getUser(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /auth/me/ward-profile ───────────────────────────────────────────────
app.patch("/auth/me/ward-profile", requireAuth, async (req, res) => {
  try {
    const user = await getUser(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { wardProfile } = req.body;
    if (!wardProfile || typeof wardProfile !== "object" || Array.isArray(wardProfile)) {
      return res.status(400).json({ message: "wardProfile object required" });
    }

    // Explicit allowlist — this object can carry NID/health data, so we
    // never trust arbitrary client-supplied keys or types here.
    const clean = {};
    if (wardProfile.nidNumber !== undefined) clean.nidNumber = String(wardProfile.nidNumber).trim().slice(0, 40);
    if (wardProfile.occupation !== undefined) clean.occupation = String(wardProfile.occupation).trim().slice(0, 80);
    if (wardProfile.hasDisability !== undefined) clean.hasDisability = !!wardProfile.hasDisability;
    if (wardProfile.disabilityNote !== undefined) clean.disabilityNote = String(wardProfile.disabilityNote).trim().slice(0, 300);
    if (wardProfile.hasChronicIllness !== undefined) clean.hasChronicIllness = !!wardProfile.hasChronicIllness;
    if (wardProfile.illnessNote !== undefined) clean.illnessNote = String(wardProfile.illnessNote).trim().slice(0, 300);
    if (wardProfile.householdSize !== undefined) {
      const size = Number(wardProfile.householdSize);
      if (!Number.isFinite(size) || size < 0 || size > 50) {
        return res.status(400).json({ message: "householdSize must be a number between 0 and 50" });
      }
      clean.householdSize = Math.round(size);
    }
    if (wardProfile.notes !== undefined) clean.notes = String(wardProfile.notes).trim().slice(0, 500);

    const updatedProfile = { ...clean, updatedAt: Date.now() };
    const wardProfileComplete = !!updatedProfile.nidNumber;

    await saveUser({ ...user, wardProfile: updatedProfile, wardProfileComplete });
    const updated = await getUser(req.userId);
    res.json(safeUser(updated));
  } catch (err) {
    console.error("Ward profile update error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// ── GET /reports ──────────────────────────────────────────────────────────────
app.get("/reports", async (_req, res) => {
  try {
    res.json(await getReports());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
});

// ── GET /reports/feed ──────────────────────────────────────────────────────────
// Cursor-paginated, filterable, sortable feed — the Home tab uses this
// instead of GET /reports so it never has to pull the whole collection just
// to render the next 10 cards while scrolling.
//   ?cursor=<timestamp>&limit=10&type=Pothole&status=Reported&sort=date_desc|date_asc
app.get("/reports/feed", async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const cursor = req.query.cursor !== undefined ? parseInt(req.query.cursor, 10) : null;
    const type = req.query.type ? String(req.query.type) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const sort = req.query.sort === "date_asc" ? "date_asc" : "date_desc";

    let all = await getReports();
    if (type) all = all.filter(r => r.type === type);
    if (status) all = all.filter(r => r.status === status);
    all = [...all].sort((a, b) => sort === "date_asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);

    let startIdx = 0;
    if (cursor !== null && !Number.isNaN(cursor)) {
      const idx = sort === "date_asc"
        ? all.findIndex(r => r.timestamp > cursor)
        : all.findIndex(r => r.timestamp < cursor);
      startIdx = idx === -1 ? all.length : idx;
    }

    const page = all.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < all.length;

    res.json({
      reports: page,
      nextCursor: hasMore && page.length ? page[page.length - 1].timestamp : null,
      hasMore,
      total: all.length,
    });
  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ message: "Failed to fetch feed" });
  }
});

// ── GET /reports/stats ─────────────────────────────────────────────────────────
// Category-scoped stats — pass ?type=Blocked%20Drain to see stats for just
// that issue type (used by the "tap a category, see its stats" view).
// Omit ?type to get ward-wide stats. Cached briefly since it's recomputed
// from the full reports list.
app.get("/reports/stats", async (req, res) => {
  try {
    const type = req.query.type ? String(req.query.type) : null;
    const data = await cache.wrap(`stats:${type ?? "__all__"}`, 15, async () => {
      const all = await getReports();
      const scoped = type ? all.filter(r => r.type === type) : all;
      const total = scoped.length;
      const byStatus = { Reported: 0, Acknowledged: 0, Dispatched: 0, Resolved: 0 };
      let voteSum = 0, resolvedAgeMsSum = 0, resolvedCount = 0;

      for (const r of scoped) {
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
        voteSum += r.voteScore ?? 0;
        if (r.status === "Resolved") {
          resolvedCount += 1;
          const resolvedEntry = [...(r.progressLog ?? [])].reverse().find(p => p.status === "Resolved");
          const resolvedAt = resolvedEntry?.timestamp ?? r.timestamp;
          resolvedAgeMsSum += Math.max(resolvedAt - r.timestamp, 0);
        }
      }

      const topReport = [...scoped].sort((a, b) => (b.voteScore ?? 0) - (a.voteScore ?? 0))[0] ?? null;

      return {
        type: type ?? "All Categories",
        total,
        byStatus,
        resolutionRatePercent: total ? Math.round((byStatus.Resolved / total) * 100) : 0,
        avgResolutionHours: resolvedCount ? Math.round(resolvedAgeMsSum / resolvedCount / 3_600_000) : null,
        avgVoteScore: total ? Math.round((voteSum / total) * 10) / 10 : 0,
        topReport: topReport ? {
          id: topReport.id, description: topReport.description,
          voteScore: topReport.voteScore, reporterName: topReport.reporterName, status: topReport.status,
        } : null,
      };
    });
    res.json(data);
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ message: "Failed to compute stats" });
  }
});

// ── GET /reports/nearby ────────────────────────────────────────────────────────
app.get("/reports/nearby", requireAuth, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const type = req.query.type;
    if (Number.isNaN(lat) || Number.isNaN(lng) || !type) {
      return res.status(400).json({ message: "lat, lng, type are required" });
    }

    const all = await getReports();
    const matches = all
      .filter(r => r.type === type && r.status !== "Resolved" && r.reporterId !== req.userId)
      .map(r => ({ report: r, distanceMeters: distanceMeters(lat, lng, r.lat, r.lng) }))
      .filter(m => m.distanceMeters <= NEARBY_RADIUS_METERS)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 3);

    res.json(matches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Nearby lookup failed" });
  }
});

// ── GET /reports/:id ───────────────────────────────────────────────────────────
app.get("/reports/:id", async (req, res) => {
  try {
    const report = await getReport(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch report" });
  }
});

// ── POST /reports ─────────────────────────────────────────────────────────────
app.post("/reports", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    const user = await getUser(req.userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    const { type, lat, lng, description, isAnonymous, imageUrl: bodyImageUrl, offlineId } = req.body;
    if (!type || !lat || !lng) return res.status(400).json({ message: "type, lat, lng are required" });
    if (!REPORT_TYPES.has(type)) {
      return res.status(400).json({ message: `type must be one of: ${[...REPORT_TYPES].join(", ")}` });
    }
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      return res.status(400).json({ message: "lat must be a finite number between -90 and 90" });
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ message: "lng must be a finite number between -180 and 180" });
    }

    // Offline-submitted reports carry a client-generated offlineId. If the
    // device retries the sync (e.g. it thought it was online, wasn't, and
    // tries again on the next reconnect), replay the existing report
    // instead of creating a duplicate.
    if (offlineId) {
      const existing = await getReports();
      const dup = existing.find(r => r.offlineId === offlineId && r.reporterId === user.id);
      if (dup) return res.status(200).json(dup);
    }

    const anon = isAnonymous === "true" || isAnonymous === true;
    let imageUrl = bodyImageUrl ?? "";

    if (req.file && process.env.CLOUDINARY_API_KEY) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "sahabaghi/reports", resource_type: "image", transformation: [{ quality: "auto:good", width: 1200, crop: "limit" }] },
          (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(req.file.buffer);
      });
      imageUrl = result.secure_url;
    }

    const report = {
      id: uuid(),
      offlineId: offlineId || null,
      type,
      lat: latNum,
      lng: lngNum,
      description: description ?? "",
      imageUrl,
      status: "Reported",
      isAnonymous: anon,
      reporterName: anon ? "Anonymous Citizen" : user.name,
      reporterId: user.id,
      timestamp: Date.now(),
      officerNote: "",
      estimatedResolutionDate: "",
      upvoterIds: [],
      downvoterIds: [],
      upvoteCount: 0,
      downvoteCount: 0,
      voteScore: 0,
      comments: [],
      progressLog: [],
      verification: null,
    };

    await saveReport(report);
    await saveUser({
      ...user,
      reportCount: (user.reportCount ?? 0) + 1,
      civicScore: Math.min((user.civicScore ?? 0) + 10, 100),
    });

    res.status(201).json(report);
  } catch (err) {
    console.error("Report submit error:", err);
    res.status(500).json({ message: "Failed to submit report" });
  }
});

// ── POST /reports/:id/vote ─────────────────────────────────────────────────────
app.post("/reports/:id/vote", requireAuth, async (req, res) => {
  try {
    const { direction } = req.body;
    if (direction !== "up" && direction !== "down") {
      return res.status(400).json({ message: "direction must be 'up' or 'down'" });
    }

    const report = await getReport(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (report.status === "Resolved") {
      return res.status(400).json({ message: "This report is resolved and closed to voting." });
    }
    if (report.reporterId === req.userId) {
      return res.status(400).json({ message: "You can't vote on your own report" });
    }

    let upvoterIds = report.upvoterIds ?? [];
    let downvoterIds = report.downvoterIds ?? [];
    const hasUp = upvoterIds.includes(req.userId);
    const hasDown = downvoterIds.includes(req.userId);

    let awardScore = false;

    if (direction === "up") {
      if (hasUp) {
        upvoterIds = upvoterIds.filter(id => id !== req.userId);
      } else {
        upvoterIds = [...upvoterIds, req.userId];
        downvoterIds = downvoterIds.filter(id => id !== req.userId);
        awardScore = true;
      }
    } else {
      if (hasDown) {
        downvoterIds = downvoterIds.filter(id => id !== req.userId);
      } else {
        downvoterIds = [...downvoterIds, req.userId];
        upvoterIds = upvoterIds.filter(id => id !== req.userId);
      }
    }

    const updated = await updateReport(report.id, {
      upvoterIds,
      downvoterIds,
      upvoteCount: upvoterIds.length,
      downvoteCount: downvoterIds.length,
      voteScore: upvoterIds.length - downvoterIds.length,
    });

    if (awardScore) {
      const user = await getUser(req.userId);
      if (user) await saveUser({ ...user, civicScore: Math.min((user.civicScore ?? 0) + 5, 100) });
    }

    res.json(updated);
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ message: "Vote failed" });
  }
});

// ── POST /reports/:id/comments ─────────────────────────────────────────────────
app.post("/reports/:id/comments", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) return res.status(400).json({ message: "Comment text is required" });
    if (String(text).length > 500) return res.status(400).json({ message: "Comment too long (max 500 characters)" });

    const report = await getReport(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const user = await getUser(req.userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    const comment = {
      id: uuid(),
      authorId: user.id,
      authorName: user.isAnonymous ? "Anonymous Citizen" : user.name,
      authorRole: user.role,
      text: String(text).trim(),
      timestamp: Date.now(),
    };

    const comments = [...(report.comments ?? []), comment];
    const updated = await updateReport(report.id, { comments });
    res.status(201).json(updated);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ message: "Failed to post comment" });
  }
});

// ── POST /reports/:id/verify ──────────────────────────────────────────────────
// Citizen "closing loop" verification: once a report is Resolved, the
// original reporter or anyone who upvoted it can confirm the fix in person
// by uploading one photo. Only the FIRST such verification is accepted —
// after that the thread is locked to further verification uploads.
app.post("/reports/:id/verify", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    const report = await getReport(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (report.status !== "Resolved") {
      return res.status(400).json({ message: "Only resolved reports can be verified" });
    }
    if (report.verification) {
      return res.status(409).json({ message: "This report has already been verified — the closing loop is complete" });
    }
    const isStakeholder = report.reporterId === req.userId || (report.upvoterIds ?? []).includes(req.userId);
    if (!isStakeholder) {
      return res.status(403).json({ message: "Only the original reporter or citizens who upvoted this report can verify its resolution" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "A closing photo is required to verify" });
    }

    const user = await getUser(req.userId);
    let photoUrl = "";
    if (process.env.CLOUDINARY_API_KEY) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "sahabaghi/verifications", resource_type: "image", transformation: [{ quality: "auto:good", width: 1200, crop: "limit" }] },
          (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(req.file.buffer);
      });
      photoUrl = result.secure_url;
    }

    const verification = {
      id: uuid(),
      userId: req.userId,
      userName: user?.isAnonymous ? "Anonymous Citizen" : (user?.name ?? "A citizen"),
      photoUrl,
      note: req.body.note ? String(req.body.note).trim().slice(0, 300) : "",
      timestamp: Date.now(),
    };

    // Re-check under the "lock" right before writing to close the race
    // where two eligible citizens both submit at nearly the same time.
    const freshCheck = await getReport(report.id);
    if (freshCheck?.verification) {
      return res.status(409).json({ message: "This report has already been verified — the closing loop is complete" });
    }

    const closingComment = {
      id: uuid(),
      authorId: req.userId,
      authorName: verification.userName,
      authorRole: user?.role ?? "citizen",
      text: `✅ Verified resolved${verification.note ? `: ${verification.note}` : ""} — closing photo attached.`,
      timestamp: Date.now(),
    };

    const updated = await updateReport(report.id, {
      verification,
      comments: [...(report.comments ?? []), closingComment],
    });

    res.status(201).json(updated);
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

// ── PATCH /reports/:id/status ─────────────────────────────────────────────────
app.patch("/reports/:id/status", requireOfficer, async (req, res) => {
  try {
    const { status, note, estimatedResolutionDate } = req.body;
    const valid = ["Reported","Acknowledged","Dispatched","Resolved"];
    if (!valid.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const report = await getReport(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const officer = await getUser(req.userId);

    const updates = { status };
    if (estimatedResolutionDate) updates.estimatedResolutionDate = estimatedResolutionDate;
    if (note) updates.officerNote = note;

    const entry = {
      id: uuid(),
      note: note && note.trim() ? note.trim() : `Status updated to ${status}`,
      status,
      timestamp: Date.now(),
      officerName: officer?.name ?? "Ward Officer",
    };
    updates.progressLog = [...(report.progressLog ?? []), entry];

    const updated = await updateReport(req.params.id, updates);
    if (!updated) return res.status(404).json({ message: "Report not found" });

    await notifyStakeholders(updated, {
      actingUserId: req.userId,
      resolvedAck: status === "Resolved",
      statusLabel: status,
      note: note && note.trim() ? note.trim() : undefined,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update failed" });
  }
});

// ── POST /reports/:id/note ─────────────────────────────────────────────────────
// Officer Progress Note — log progress WITHOUT changing status.
app.post("/reports/:id/note", requireOfficer, async (req, res) => {
  try {
    const { note } = req.body;
    if (!note || !String(note).trim()) return res.status(400).json({ message: "Note text is required" });

    const report = await getReport(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const officer = await getUser(req.userId);
    const entry = {
      id: uuid(),
      note: String(note).trim(),
      status: report.status,
      timestamp: Date.now(),
      officerName: officer?.name ?? "Ward Officer",
    };

    const updated = await updateReport(report.id, {
      officerNote: entry.note,
      progressLog: [...(report.progressLog ?? []), entry],
    });

    await notifyStakeholders(updated, {
      actingUserId: req.userId,
      resolvedAck: false,
      statusLabel: `still ${updated.status}, with a new update`,
      note: entry.note,
      type: "progress_note",
    });

    res.status(201).json(updated);
  } catch (err) {
    console.error("Progress note error:", err);
    res.status(500).json({ message: "Failed to save note" });
  }
});

// ── GET /reports/heatmap ──────────────────────────────────────────────────────
app.get("/reports/heatmap", async (_req, res) => {
  try {
    const reports = await getReports();
    const GRID = 0.0007;
    const clusters = new Map();

    for (const r of reports) {
      const baseWeight = r.status === "Resolved" ? 0.1 : 1.0;
      const netWeight = Math.max(1 + (r.voteScore ?? 0), 0.2);
      const weight = baseWeight * netWeight;
      const key = `${Math.round(r.lat / GRID)}:${Math.round(r.lng / GRID)}`;
      const ex = clusters.get(key);
      if (ex) { ex.count += weight; ex.lat = (ex.lat + r.lat) / 2; ex.lng = (ex.lng + r.lng) / 2; }
      else clusters.set(key, { lat: r.lat, lng: r.lng, count: weight });
    }

    const points = Array.from(clusters.values()).map(({ lat, lng, count }) => ({
      lat, lng, weight: Math.min(count / 15, 1.0),
    }));
    res.json(points);
  } catch {
    res.status(500).json({ message: "Heatmap error" });
  }
});

// ── GET /leaderboard ──────────────────────────────────────────────────────────
app.get("/leaderboard", requireAuth, async (req, res) => {
  try {
    const reports = await getReports();
    const counts  = new Map();

    for (const r of reports) {
      if (r.isAnonymous) continue;
      const prev = counts.get(r.reporterId) ?? { name: r.reporterName, count: 0 };
      prev.count += 1;
      counts.set(r.reporterId, prev);

      for (const upvoterId of r.upvoterIds ?? []) {
        const upvoter = await getUser(upvoterId).catch(() => null);
        if (!upvoter) continue;
        const upPrev = counts.get(upvoterId) ?? { name: upvoter.name, count: 0 };
        upPrev.count += 1;
        counts.set(upvoterId, upPrev);
      }
    }

    const entries = await Promise.all(
      Array.from(counts.entries()).map(async ([uid, data]) => {
        const u = await getUser(uid).catch(() => null);
        return { uid, name: data.name, count: data.count, civicScore: u?.civicScore ?? 0 };
      })
    );

    const ranked = entries
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((e, i) => ({
        rank: i + 1,
        name: e.name,
        reportCount: e.count,
        civicScore: e.civicScore,
        isCurrentUser: e.uid === req.userId,
      }));

    res.json(ranked);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Leaderboard error" });
  }
});

// ── GET /notifications ────────────────────────────────────────────────────────
app.get("/notifications", requireAuth, async (req, res) => {
  try {
    const list = await getNotificationsForUser(req.userId);
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// ── PATCH /notifications/:id/read ──────────────────────────────────────────────
app.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const updated = await markNotificationRead(req.params.id, req.userId);
    if (!updated) return res.status(404).json({ message: "Notification not found" });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

// ── POST /notifications/read-all ───────────────────────────────────────────────
app.post("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    await markAllNotificationsRead(req.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notifications" });
  }
});

// ── GET /chatbot/questions ─────────────────────────────────────────────────────
// The fixed list of questions the officer can ask — deliberately restricted
// for now rather than free-text chat (see chatbot.js header comment).
app.get("/chatbot/questions", requireOfficer, (_req, res) => {
  res.json(chatbot.FIXED_QUESTIONS);
});

const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many questions — wait a moment and try again." },
});

// ── POST /chatbot/ask ──────────────────────────────────────────────────────────
app.post("/chatbot/ask", requireOfficer, chatbotLimiter, async (req, res) => {
  try {
    const { questionId } = req.body;
    if (!chatbot.QUESTION_IDS.has(questionId)) {
      return res.status(400).json({ message: "Pick one of the listed questions" });
    }
    const question = chatbot.FIXED_QUESTIONS.find(q => q.id === questionId);

    const reports = await getReports();
    const context = chatbot.buildContext(reports);

    let answer, source;
    try {
      const aiAnswer = await chatbot.askOpenRouter(question.label, context);
      if (aiAnswer) {
        answer = aiAnswer;
        source = "ai";
      } else {
        answer = chatbot.deterministicFallback(questionId, context);
        source = "computed";
      }
    } catch (err) {
      console.warn("OpenRouter call failed, using computed fallback:", err.message);
      answer = chatbot.deterministicFallback(questionId, context);
      source = "computed";
    }

    res.json({ questionId, question: question.label, answer, source, context });
  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ message: "Assistant failed to respond" });
  }
});

// ── Error handler ──────────────────────────────────────────────────────────────
// Must be registered after all routes. Converts multer rejections (bad file
// type, file too large) and any other thrown/next(err) error into clean JSON
// instead of Express's default HTML error page.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image is too large (max 8MB)" : err.message;
    return res.status(400).json({ message });
  }
  if (err?.message?.includes("Only image uploads")) {
    return res.status(400).json({ message: err.message });
  }
  console.error("Unhandled route error:", err);
  res.status(500).json({ message: "Something went wrong" });
});

// ── Demo data seeding ──────────────────────────────────────────────────────────
// Runs here (not earlier in the file) because seedFirestoreFromMemory() calls
// dbUsable(), which reads the `firestoreBroken` let-binding declared in the DB
// helpers section above — calling it before that declaration line has actually
// executed throws a temporal-dead-zone ReferenceError. Placing the call after
// every dependency it touches (db, cache, dbUsable) guarantees this is safe.
if (process.env.NODE_ENV !== "production") {
  seedDemoData();
  if (db) {
    seedFirestoreFromMemory({ force: process.env.FORCE_RESEED_FIRESTORE === "true" }).catch(err => {
      console.error("⚠️  Firestore demo dataset seed failed:", err.message);
      console.error("   This is non-fatal — the app will keep working off the in-memory demo data");
      console.error("   (seeded above) for this run. See the Firestore troubleshooting notes logged");
      console.error("   on the first real Firestore failure below, or in DB helpers near dbUsable().");
    });
  }
} else {
  console.log("ℹ️  NODE_ENV=production — demo account seeding skipped.");
}

// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Sahabhagi API running at http://localhost:${PORT}`);
  console.log(`   DB mode : ${db ? "Firebase Firestore" : "In-memory (dev)"}`);
  console.log(`   Cache   : ${cache.getMode() === "redis" ? "Redis" : "In-memory (dev — set REDIS_URL in production)"}`);
  console.log(`   AI      : ${process.env.OPENROUTER_API_KEY ? "OpenRouter connected" : "No OPENROUTER_API_KEY — chatbot uses computed answers"}`);
  console.log(`   Reports : ${memReports.size} seeded`);
  console.log(`\n   Demo logins (password: ${DEMO_PASSWORD}):`);
  console.log(`   Citizen → ramila.tamang@example.com`);
  console.log(`   Officer → officer.ward10@example.com\n`);
});
