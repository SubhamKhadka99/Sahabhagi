/**
 * pendingRegistrations.js — holds signup attempts between "OTP sent" and
 * "OTP verified". No user account exists until verify() succeeds.
 *
 * In-memory, matching the rest of this backend's dev-fallback pattern —
 * fine at pilot scale on a single instance. If you later run multiple
 * backend instances behind a load balancer, move this to Redis (already
 * wired up via cache.js/REDIS_URL) using SET key value EX 600 instead —
 * the shape of create/verify/resend below wouldn't need to change, just
 * the storage underneath them.
 */
"use strict";

const crypto = require("crypto");

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const pending = new Map(); // email -> { name, passwordHash, otpHash, expiresAt, attempts, anonymous }

function generateOtp() {
  return String(crypto.randomInt(100000, 999999)); // 6 digits
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/** Starts (or restarts) a pending signup and returns the plaintext OTP to email. */
function create(email, { name, passwordHash, anonymous }) {
  const otp = generateOtp();
  pending.set(email, {
    name,
    passwordHash,
    anonymous,
    otpHash: hashOtp(otp),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  return otp;
}

/** Verifies a code. On success, deletes the pending record and returns it — the caller creates the real user. */
function verify(email, otp) {
  const record = pending.get(email);
  if (!record) return { ok: false, reason: "No pending signup for this email — request a new code." };
  if (Date.now() > record.expiresAt) {
    pending.delete(email);
    return { ok: false, reason: "Code expired — request a new one." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    pending.delete(email);
    return { ok: false, reason: "Too many attempts — request a new code." };
  }
  if (hashOtp(otp) !== record.otpHash) {
    record.attempts += 1;
    return { ok: false, reason: "Incorrect code." };
  }
  pending.delete(email);
  return { ok: true, record };
}

/** Generates a fresh OTP for an existing pending signup (used by "resend code"). */
function resend(email) {
  const record = pending.get(email);
  if (!record) return null;
  const otp = generateOtp();
  record.otpHash = hashOtp(otp);
  record.expiresAt = Date.now() + OTP_TTL_MS;
  record.attempts = 0;
  return otp;
}

module.exports = { create, verify, resend };
