/**
 * cache.js — Redis-backed cache with an automatic in-memory fallback.
 *
 * Why this exists: GET /reports was fetching + sorting the *entire* reports
 * collection on every request (feed polling, map, leaderboard, stats all hit
 * it independently). This wraps that read behind a short-TTL cache so the
 * DB/collection is only actually read once per TTL window, no matter how
 * many endpoints or polling clients ask for it — and every write path
 * (saveReport/updateReport in server.js) actively invalidates it so nobody
 * ever sees stale data after a report is created, voted on, or updated.
 *
 * If REDIS_URL is set (and the `ioredis` package is installed), this uses a
 * real Redis instance so the cache is shared across multiple server
 * instances/dynos. If not, it transparently falls back to an in-process
 * Map — same interface, so nothing else in the app needs to know which mode
 * it's running in. This makes the app "Redis-ready": deploy with REDIS_URL
 * set (e.g. Upstash, Railway, Redis Cloud) and it upgrades itself with zero
 * code changes.
 */
"use strict";

let Redis = null;
try {
  Redis = require("ioredis");
} catch {
  Redis = null;
}

let client = null;
let ready = false;

if (process.env.REDIS_URL && Redis) {
  try {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      lazyConnect: true,
    });
    client.on("error", (err) => {
      if (ready) console.warn("⚠️  Redis error:", err.message);
      ready = false;
    });
    client.on("ready", () => {
      ready = true;
      console.log("✅ Redis connected — shared cache + queue active");
    });
    client.connect().catch((err) => {
      console.warn("⚠️  Redis connection failed, using in-memory cache instead:", err.message);
      client = null;
    });
  } catch (err) {
    console.warn("⚠️  Redis init failed, using in-memory cache instead:", err.message);
    client = null;
  }
} else {
  console.warn(
    "⚠️  REDIS_URL not set — using in-memory cache (fine for local dev). " +
    "Set REDIS_URL in production so caching + the notification queue are shared across instances."
  );
}

function isRedisActive() {
  return !!(client && ready);
}

// ── In-memory fallback (also used transparently if Redis errors mid-flight) ─
const memStore = new Map(); // key -> { value, expiresAt }

function memGet(key) {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key, value, ttlSeconds) {
  memStore.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
}

function memInvalidate(prefix) {
  for (const key of memStore.keys()) {
    if (key === prefix || key.startsWith(prefix)) memStore.delete(key);
  }
}

// ── Public API ────────────────────────────────────────────────────────────
async function get(key) {
  if (isRedisActive()) {
    try {
      const raw = await client.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn("Redis GET failed, falling back to memory:", err.message);
    }
  }
  return memGet(key);
}

async function set(key, value, ttlSeconds = 30) {
  if (isRedisActive()) {
    try {
      await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return;
    } catch (err) {
      console.warn("Redis SET failed, falling back to memory:", err.message);
    }
  }
  memSet(key, value, ttlSeconds);
}

/** Deletes every key starting with `prefix` (both Redis and memory paths). */
async function invalidate(prefix) {
  if (isRedisActive()) {
    try {
      const keys = await client.keys(`${prefix}*`);
      if (keys.length) await client.del(...keys);
    } catch (err) {
      console.warn("Redis invalidate failed:", err.message);
    }
  }
  memInvalidate(prefix);
}

/** Get-or-compute-and-cache. */
async function wrap(key, ttlSeconds, computeFn) {
  const cached = await get(key);
  if (cached !== null) return cached;
  const value = await computeFn();
  await set(key, value, ttlSeconds);
  return value;
}

function getMode() {
  return isRedisActive() ? "redis" : "memory";
}

/** Raw client access for modules that need real Redis primitives (queue.js). */
function getClient() {
  return isRedisActive() ? client : null;
}

module.exports = { get, set, invalidate, wrap, getMode, getClient };
