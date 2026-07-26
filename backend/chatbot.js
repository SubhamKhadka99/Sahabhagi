/**
 * chatbot.js — Ward officer AI assistant.
 *
 * Deliberately restricted to a fixed list of questions for now (per product
 * decision) rather than free-text chat — this keeps answers predictable and
 * makes it trivial to guarantee the model only ever reasons over real,
 * computed Ward 10 numbers instead of inventing anything.
 *
 * Uses OpenRouter's free tier (set OPENROUTER_API_KEY). If no key is
 * configured, or the API call fails for any reason, every question still
 * gets answered — just via `deterministicFallback`, which computes the same
 * answer directly from the stats context without an LLM call at all.
 */
"use strict";

const FIXED_QUESTIONS = [
  { id: "summary",     label: "Give me a quick summary of the ward right now" },
  { id: "top_category", label: "Which issue category needs the most attention?" },
  { id: "resolution",  label: "What's our resolution rate and where are we falling behind?" },
  { id: "hotspots",    label: "Which categories are generating the most reports?" },
  { id: "disputed",    label: "Are there any disputed or contested reports?" },
  { id: "last_24h",    label: "What's changed in the last 24 hours?" },
];

const QUESTION_IDS = new Set(FIXED_QUESTIONS.map((q) => q.id));

/** Builds a compact, model-friendly stats object from the full reports list. */
function buildContext(reports) {
  const total = reports.length;
  const byStatus = reports.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, { Reported: 0, Acknowledged: 0, Dispatched: 0, Resolved: 0 });

  const byType = reports.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});

  const disputed = reports
    .filter((r) => (r.voteScore ?? 0) <= -2)
    .map((r) => ({ type: r.type, voteScore: r.voteScore, status: r.status }));

  const last24h = reports.filter((r) => Date.now() - r.timestamp < 86_400_000);
  const topTypesByVolume = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const resolvedCount = byStatus.Resolved ?? 0;

  return {
    total,
    byStatus,
    topTypesByVolume,
    disputedCount: disputed.length,
    disputedSample: disputed.slice(0, 5),
    last24hCount: last24h.length,
    resolutionRatePercent: total ? Math.round((resolvedCount / total) * 100) : 0,
  };
}

/** Returns the model's text answer, or null if no API key is configured. */
async function askOpenRouter(questionLabel, context) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
  const system =
    "You are a data assistant for a ward officer using the Sahabhagi civic-reporting " +
    "platform in Kathmandu Ward 10. Answer ONLY using the JSON stats context provided — " +
    "never invent numbers or reports that aren't in it. Reply in 3-5 short plain-language " +
    "sentences, no markdown headers or bullet lists. If the context doesn't contain enough " +
    "to answer well, say so plainly instead of guessing.";
  const userMessage = `Question: ${questionLabel}\n\nWard 10 data (JSON):\n${JSON.stringify(context)}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.FRONTEND_URL || "https://sahabhagi.app",
      "X-Title": "Sahabhagi Ward Officer Assistant",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

/** No-AI-required answer, computed straight from the context. Always available. */
function deterministicFallback(questionId, context) {
  switch (questionId) {
    case "summary":
      return `Ward 10 has ${context.total} reports on file, ${context.resolutionRatePercent}% resolved. ` +
        `Status breakdown — Reported: ${context.byStatus.Reported}, Acknowledged: ${context.byStatus.Acknowledged}, ` +
        `Dispatched: ${context.byStatus.Dispatched}, Resolved: ${context.byStatus.Resolved}.`;
    case "top_category": {
      const top = context.topTypesByVolume[0];
      return top
        ? `"${top[0]}" needs the most attention — it has ${top[1]} of the ward's ${context.total} reports.`
        : "There isn't enough report data yet to identify a top category.";
    }
    case "resolution":
      return `Resolution rate is ${context.resolutionRatePercent}% (${context.byStatus.Resolved} of ${context.total} resolved). ` +
        `${context.byStatus.Reported} report(s) are still awaiting a first response.`;
    case "hotspots":
      return context.topTypesByVolume.length
        ? `By volume: ${context.topTypesByVolume.map(([t, c]) => `${t} (${c})`).join(", ")}.`
        : "No reports yet to rank by category.";
    case "disputed":
      return context.disputedCount
        ? `${context.disputedCount} report(s) are net downvoted (contested): ${context.disputedSample.map((d) => d.type).join(", ")}.`
        : "No disputed reports right now — nothing net-downvoted.";
    case "last_24h":
      return `${context.last24hCount} new report(s) came in over the last 24 hours.`;
    default:
      return "I don't have a canned answer for that question yet.";
  }
}

module.exports = { FIXED_QUESTIONS, QUESTION_IDS, buildContext, askOpenRouter, deterministicFallback };
