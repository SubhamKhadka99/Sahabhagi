// ─── API CLIENT ────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}` : "/api";

function getToken(): string | null {
  return localStorage.getItem("sb_token");
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message: string }).message ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────
export type ReportStatus = "Reported" | "Acknowledged" | "Dispatched" | "Resolved";
export type UserRole = "citizen" | "officer" | "admin";

export interface WardProfile {
  nidNumber?: string;
  hasDisability?: boolean;
  disabilityNote?: string;
  occupation?: string;
  hasChronicIllness?: boolean;
  illnessNote?: string;
  householdSize?: number;
  notes?: string;
  updatedAt?: number;
}

export interface User {
  id: string;
  name: string;
  displayName: string;
  email?: string;
  authProvider: "google" | "demo" | "password";
  isAnonymous: boolean;
  civicScore: number;
  reportCount: number;
  role: UserRole;
  ward: number;
  wardProfile?: WardProfile;
  wardProfileComplete?: boolean;
}

export interface ReportComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole?: UserRole;
  text: string;
  timestamp: number;
}

export interface ProgressEntry {
  id: string;
  note: string;
  status: ReportStatus;
  timestamp: number;
  officerName: string;
}

export interface ReportVerification {
  id: string;
  userId: string;
  userName: string;
  photoUrl: string;
  note?: string;
  timestamp: number;
}

export interface Report {
  id: string;
  offlineId?: string | null;
  type: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  description?: string;
  status: ReportStatus;
  isAnonymous: boolean;
  reporterName: string;
  reporterId: string;
  timestamp: number;
  officerNote?: string;
  estimatedResolutionDate?: string;
  upvoterIds: string[];
  downvoterIds: string[];
  upvoteCount: number;
  downvoteCount: number;
  voteScore: number;
  comments: ReportComment[];
  progressLog: ProgressEntry[];
  verification?: ReportVerification | null;
}

export interface FeedPage {
  reports: Report[];
  nextCursor: number | null;
  hasMore: boolean;
  total: number;
}

export interface FeedQuery {
  cursor?: number | null;
  limit?: number;
  type?: string | null;
  status?: ReportStatus | null;
  sort?: "date_desc" | "date_asc";
}

export interface CategoryStats {
  type: string;
  total: number;
  byStatus: Record<ReportStatus, number>;
  resolutionRatePercent: number;
  avgResolutionHours: number | null;
  avgVoteScore: number;
  topReport: { id: string; description?: string; voteScore: number; reporterName: string; status: ReportStatus } | null;
}

export interface ChatbotQuestion {
  id: string;
  label: string;
}

export interface ChatbotAnswer {
  questionId: string;
  question: string;
  answer: string;
  source: "ai" | "computed";
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  reportCount: number;
  civicScore: number;
  isCurrentUser: boolean;
}

export type NotificationType = "status_change" | "resolved_ack" | "progress_note";

export interface AppNotification {
  id: string;
  userId: string;
  reportId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  timestamp: number;
}

export interface NearbyMatch {
  report: Report;
  distanceMeters: number;
}

// ── API calls ──────────────────────────────────────────────────────────────
export const api = {
  auth: {
    /** Step 1 of signup — sends a 6-digit code to the email, no account created yet. */
    registerStart: (email: string, name: string, password: string, anonymous: boolean) =>
      req<{ message: string }>("POST", "/auth/register/start", { email, name, password, anonymous }),
    /** Step 2 — verifying the code actually creates the account and returns a token. */
    registerVerify: (email: string, otp: string) =>
      req<{ token: string; user: User }>("POST", "/auth/register/verify", { email, otp }),
    registerResend: (email: string) =>
      req<{ message: string }>("POST", "/auth/register/resend", { email }),
    login: (email: string, password: string) =>
      req<{ token: string; user: User }>("POST", "/auth/login", { email, password }),
    /** Real Google Sign-In — idToken comes from Google Identity Services and is verified server-side. */
    loginGoogle: (idToken: string, anonymous: boolean) =>
      req<{ token: string; user: User }>("POST", "/auth/login/google", { idToken, anonymous }),
    me: () => req<User>("GET", "/auth/me"),
    updateProfile: (wardProfile: WardProfile) =>
      req<User>("PATCH", "/auth/me/ward-profile", { wardProfile }),
  },

  reports: {
    list: () => req<Report[]>("GET", "/reports"),
    get: (id: string) => req<Report>("GET", `/reports/${id}`),
    /** Cursor-paginated, filterable, sortable feed — used by the infinite-scroll Home tab. */
    feed: (q: FeedQuery = {}) => {
      const params = new URLSearchParams();
      if (q.cursor != null) params.set("cursor", String(q.cursor));
      params.set("limit", String(q.limit ?? 10));
      if (q.type) params.set("type", q.type);
      if (q.status) params.set("status", q.status);
      if (q.sort) params.set("sort", q.sort);
      return req<FeedPage>("GET", `/reports/feed?${params.toString()}`);
    },
    /** Ward-wide stats, or scoped to one issue type when `type` is passed. */
    stats: (type?: string | null) =>
      req<CategoryStats>("GET", `/reports/stats${type ? `?type=${encodeURIComponent(type)}` : ""}`),
    findNearby: (lat: number, lng: number, type: string) =>
      req<NearbyMatch[]>("GET", `/reports/nearby?lat=${lat}&lng=${lng}&type=${encodeURIComponent(type)}`),
    submit: async (data: FormData): Promise<Report> => {
      const token = getToken();
      const res = await fetch(`${BASE}/reports`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: data,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error((err as { message: string }).message ?? "Submit failed");
      }
      return res.json() as Promise<Report>;
    },
    vote: (id: string, direction: "up" | "down") =>
      req<Report>("POST", `/reports/${id}/vote`, { direction }),
    comment: (id: string, text: string) =>
      req<Report>("POST", `/reports/${id}/comments`, { text }),
    updateStatus: (id: string, status: ReportStatus, note?: string, estimatedResolutionDate?: string) =>
      req<Report>("PATCH", `/reports/${id}/status`, { status, note, estimatedResolutionDate }),
    addProgressNote: (id: string, note: string) =>
      req<Report>("POST", `/reports/${id}/note`, { note }),
    /** Citizen "closing loop" verification — one photo, first verifier only. */
    verify: async (id: string, photo: File, note?: string): Promise<Report> => {
      const token = getToken();
      const fd = new FormData();
      fd.append("photo", photo);
      if (note) fd.append("note", note);
      const res = await fetch(`${BASE}/reports/${id}/verify`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error((err as { message: string }).message ?? "Verification failed");
      }
      return res.json() as Promise<Report>;
    },
  },

  chatbot: {
    questions: () => req<ChatbotQuestion[]>("GET", "/chatbot/questions"),
    ask: (questionId: string) => req<ChatbotAnswer>("POST", "/chatbot/ask", { questionId }),
  },

  leaderboard: {
    get: () => req<LeaderboardEntry[]>("GET", "/leaderboard"),
  },

  notifications: {
    list: () => req<AppNotification[]>("GET", "/notifications"),
    markRead: (id: string) => req<AppNotification>("PATCH", `/notifications/${id}/read`),
    markAllRead: () => req<{ ok: boolean }>("POST", "/notifications/read-all"),
  },
};
