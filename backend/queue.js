/**
 * queue.js — Lightweight job queue for background work (currently:
 * notification fan-out, which was previously an inline `await` loop over
 * every upvoter inside the request handler that changed a report's status).
 *
 * When REDIS_URL is set, this pushes jobs onto a real Redis list
 * (RPUSH/BLPOP) — a genuine message queue, so a report with 50 upvoters
 * doesn't make the officer's "mark resolved" request wait on 50 writes, and
 * multiple server instances can share one worker pool. Without Redis, jobs
 * run through an in-memory queue processed on the next tick — same code
 * path, same `push()` call site, just no cross-instance sharing. Either way
 * the HTTP response returns immediately; notifications land a beat later.
 */
"use strict";

const cache = require("./cache");

const QUEUE_KEY = "sahabhagi:queue:notify";
let handler = null;
let workerStarted = false;

// In-memory fallback queue
const memQueue = [];
let memProcessing = false;

function onProcess(fn) {
  handler = fn;
}

async function push(job) {
  const client = cache.getClient();
  if (client) {
    try {
      await client.rpush(QUEUE_KEY, JSON.stringify(job));
      ensureWorkerStarted(client);
      return;
    } catch (err) {
      console.warn("Queue push to Redis failed, using in-memory queue instead:", err.message);
    }
  }
  memQueue.push(job);
  void processMemoryQueue();
}

async function processMemoryQueue() {
  if (memProcessing || !handler) return;
  memProcessing = true;
  while (memQueue.length) {
    const job = memQueue.shift();
    try {
      await handler(job);
    } catch (err) {
      console.error("Queue job failed:", err);
    }
  }
  memProcessing = false;
}

function ensureWorkerStarted(client) {
  if (workerStarted) return;
  workerStarted = true;
  const worker = client.duplicate(); // BLPOP holds the connection, needs its own

  (async function loop() {
    for (;;) {
      try {
        const res = await worker.blpop(QUEUE_KEY, 5);
        if (res && handler) {
          const [, raw] = res;
          const job = JSON.parse(raw);
          await handler(job).catch((err) => console.error("Queue job failed:", err));
        }
      } catch (err) {
        console.warn("Queue worker error, retrying:", err.message);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();
}

module.exports = { push, onProcess };
