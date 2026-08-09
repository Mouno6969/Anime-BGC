/**
 * Notification store — two layers:
 *
 *  1. Broadcasts: admin-created (or built-in seeded) announcements shared by
 *     everyone, persisted in data/notifications.json.
 *  2. Per-guest state: read/dismissed flags keyed by the visitor's stable
 *     guest id (same identity as comments/avatars), persisted in
 *     data/notification-state.json.
 *
 * No accounts exist on this site, so "users" are guest ids. Admin operations
 * require the ADMIN_TOKEN env (same convention as comment moderation).
 * Broadcasts expire, dedupe by key, and never expose per-guest data.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const BROADCAST_FILE = path.join(DATA_DIR, "notifications.json");
const STATE_FILE = path.join(DATA_DIR, "notification-state.json");

export type NotificationCategory =
  | "welcome" | "feature" | "playback" | "episode" | "system"
  | "account" | "maintenance" | "security" | "community";
export type NotificationPriority = "info" | "important" | "warning" | "critical";

export interface Broadcast {
  id: string;
  key: string; // dedupe key
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  createdAt: number;
  expiresAt: number | null;
  enabled: boolean;
}

interface GuestState {
  read: Record<string, number>;
  dismissed: Record<string, number>;
}

let broadcasts: Broadcast[] = [];
let states: Record<string, GuestState> = {};
let loaded = false;
let writeTimer: NodeJS.Timeout | null = null;

/* ------------------------------ persistence ------------------------------- */

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (existsSync(BROADCAST_FILE)) {
      const raw = JSON.parse(readFileSync(BROADCAST_FILE, "utf8"));
      broadcasts = Array.isArray(raw.broadcasts) ? raw.broadcasts : [];
    }
  } catch { broadcasts = []; }
  try {
    if (existsSync(STATE_FILE)) {
      states = JSON.parse(readFileSync(STATE_FILE, "utf8")) ?? {};
    }
  } catch { states = {}; }
  seed();
}

function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      const t1 = `${BROADCAST_FILE}.tmp`;
      writeFileSync(t1, JSON.stringify({ broadcasts }));
      renameSync(t1, BROADCAST_FILE);
      const t2 = `${STATE_FILE}.tmp`;
      writeFileSync(t2, JSON.stringify(states));
      renameSync(t2, STATE_FILE);
    } catch { /* retry next change */ }
  }, 400);
}

/** First-run welcome + feature-education broadcasts (deduped by key). */
function seed() {
  const seeds: Array<Omit<Broadcast, "id" | "createdAt" | "enabled">> = [
    {
      key: "welcome-v1",
      category: "welcome",
      priority: "info",
      title: "Welcome to AnimeBGC",
      body: "Here's how to get the most out of AnimeBGC — discover, watch, and keep track of the anime you love.",
      actionLabel: "Browse trending",
      actionUrl: "/",
      expiresAt: null,
    },
    {
      key: "feature-history-v1",
      category: "feature",
      priority: "info",
      title: "Pick up where you left off",
      body: "Your history remembers unfinished episodes so you can continue watching quickly.",
      actionLabel: "Open history",
      actionUrl: "/history",
      expiresAt: null,
    },
    {
      key: "feature-watchlist-v1",
      category: "feature",
      priority: "info",
      title: "Keep a watchlist",
      body: "Save anime you want to watch later and find them quickly from your personal list.",
      actionLabel: "Open watchlist",
      actionUrl: "/watchlist",
      expiresAt: null,
    },
    {
      key: "feature-comments-v1",
      category: "feature",
      priority: "info",
      title: "Join the discussion",
      body: "Comments let you share your thoughts and discuss episodes with other viewers.",
      expiresAt: null,
    },
    {
      key: "playback-tip-v1",
      category: "playback",
      priority: "info",
      title: "Playback tip",
      body: "Having trouble playing an episode? Auto mode finds a working server for you — and if a stream fails, the player offers quick fixes.",
      expiresAt: null,
    },
  ];
  let changed = false;
  for (const s of seeds) {
    if (!broadcasts.some((b) => b.key === s.key)) {
      broadcasts.push({ ...s, id: randomUUID(), createdAt: Date.now(), enabled: true });
      changed = true;
    }
  }
  if (changed) persist();
}

/* -------------------------------- API ------------------------------------ */

export class NotificationError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function validGuestId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9:._-]{8,90}$/.test(id);
}

function isAdmin(token: unknown): boolean {
  const expected = process.env.ADMIN_TOKEN;
  return !!expected && typeof token === "string" && token === expected;
}

function stateFor(guestId: string): GuestState {
  if (!states[guestId]) states[guestId] = { read: {}, dismissed: {} };
  return states[guestId];
}

export interface PublicNotification {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  createdAt: number;
  read: boolean;
}

export function listForGuest(guestId: string): { unread: number; items: PublicNotification[] } {
  load();
  if (!validGuestId(guestId)) throw new NotificationError(401, "Missing guest identity.");
  const now = Date.now();
  const st = stateFor(guestId);
  const items = broadcasts
    .filter((b) => b.enabled && (!b.expiresAt || b.expiresAt > now) && !st.dismissed[b.id])
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50)
    .map((b) => ({
      id: b.id,
      category: b.category,
      priority: b.priority,
      title: b.title,
      body: b.body,
      actionLabel: b.actionLabel,
      actionUrl: b.actionUrl,
      createdAt: b.createdAt,
      read: !!st.read[b.id],
    }));
  return { unread: items.filter((i) => !i.read).length, items };
}

export function markRead(guestId: string, id: string) {
  load();
  if (!validGuestId(guestId)) throw new NotificationError(401, "Missing guest identity.");
  stateFor(guestId).read[id] = Date.now();
  persist();
  return { ok: true };
}

export function markAllRead(guestId: string) {
  load();
  if (!validGuestId(guestId)) throw new NotificationError(401, "Missing guest identity.");
  const st = stateFor(guestId);
  const now = Date.now();
  for (const b of broadcasts) st.read[b.id] = now;
  persist();
  return { ok: true };
}

export function dismiss(guestId: string, id: string) {
  load();
  if (!validGuestId(guestId)) throw new NotificationError(401, "Missing guest identity.");
  const st = stateFor(guestId);
  st.dismissed[id] = Date.now();
  st.read[id] = st.read[id] ?? Date.now();
  persist();
  return { ok: true };
}

/* ------------------------------ admin (CMS) -------------------------------- */

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const c = v.replace(/[<>]/g, "").trim().slice(0, max);
  return c || null;
}

export function adminCreate(input: Record<string, unknown>, token: unknown): Broadcast {
  load();
  if (!isAdmin(token)) throw new NotificationError(403, "Admin access required.");
  const title = cleanText(input.title, 120);
  const body = cleanText(input.body, 500);
  if (!title || !body) throw new NotificationError(400, "Title and body are required.");
  const key = cleanText(input.key, 80) ?? `admin-${Date.now()}`;
  if (broadcasts.some((b) => b.key === key)) throw new NotificationError(409, "A notification with that key exists.");
  const b: Broadcast = {
    id: randomUUID(),
    key,
    category: (cleanText(input.category, 20) as NotificationCategory) ?? "system",
    priority: (cleanText(input.priority, 10) as NotificationPriority) ?? "info",
    title,
    body,
    actionLabel: cleanText(input.actionLabel, 40) ?? undefined,
    actionUrl: typeof input.actionUrl === "string" && /^\/[A-Za-z0-9/?=&%-]*$/.test(input.actionUrl)
      ? input.actionUrl
      : undefined,
    createdAt: Date.now(),
    expiresAt: typeof input.expiresInHours === "number" ? Date.now() + input.expiresInHours * 3_600_000 : null,
    enabled: true,
  };
  broadcasts.push(b);
  persist();
  return b;
}

export function adminSetEnabled(id: string, enabled: boolean, token: unknown) {
  load();
  if (!isAdmin(token)) throw new NotificationError(403, "Admin access required.");
  const b = broadcasts.find((x) => x.id === id);
  if (!b) throw new NotificationError(404, "Notification not found.");
  b.enabled = enabled;
  persist();
  return { ok: true, enabled: b.enabled };
}

/* --------------------------- playback issue reports ------------------------ */

const REPORT_FILE = path.join(DATA_DIR, "playback-reports.json");
const reportThrottle = new Map<string, number>();

export function filePlaybackReport(input: Record<string, unknown>, guestId: string) {
  if (!validGuestId(guestId)) throw new NotificationError(401, "Missing guest identity.");
  const now = Date.now();
  const last = reportThrottle.get(guestId) ?? 0;
  if (now - last < 60_000) throw new NotificationError(429, "Report already sent recently.");
  reportThrottle.set(guestId, now);

  const report = {
    id: randomUUID(),
    guestId,
    animeId: typeof input.animeId === "number" ? input.animeId : null,
    episode: typeof input.episode === "number" ? input.episode : null,
    provider: cleanText(input.provider, 40),
    errorCode: cleanText(input.errorCode, 60),
    playerState: cleanText(input.playerState, 200),
    browser: cleanText(input.browser, 80),
    createdAt: now,
  };
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    let list: unknown[] = [];
    if (existsSync(REPORT_FILE)) {
      const raw = JSON.parse(readFileSync(REPORT_FILE, "utf8"));
      list = Array.isArray(raw.reports) ? raw.reports : [];
    }
    list.push(report);
    if (list.length > 500) list = list.slice(-500);
    const tmp = `${REPORT_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify({ reports: list }, null, 1));
    renameSync(tmp, REPORT_FILE);
  } catch { /* best effort */ }
  return { ok: true };
}
