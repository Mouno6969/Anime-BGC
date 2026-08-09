/**
 * Comment store for Anime BGC — dependency-free JSON persistence.
 *
 * The site has no database/accounts, so comments are owned by the visitor's
 * stable guest id (the same first-party id that drives avatars). Data lives in
 * data/comments.json with debounced atomic writes (tmp + rename). In-memory
 * maps serve reads; volume at this site's scale is small.
 *
 * Enforced here (never trust the client):
 *  - ownership for edit/delete (guest id match)
 *  - admin token for pin/hide (ADMIN_TOKEN env)
 *  - rate limits + duplicate detection (per guest id AND per IP)
 *  - body sanitization/limits, name limits, spoiler flag
 *  - auto-hide when a comment crosses the report threshold
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "comments.json");

const MAX_BODY = 1000;
const MAX_NAME = 24;
const PAGE_SIZE = 10;
const REPLY_CAP = 50;
const REPORT_AUTOHIDE = 5;
const MIN_INTERVAL_MS = 8_000; // between comments per identity
const HOURLY_CAP = 30; // comments per hour per identity

export interface Comment {
  id: string;
  content: string; // `${anilistId}:${episodeNumber}`
  guestId: string;
  name: string;
  body: string;
  parentId: string | null;
  isSpoiler: boolean;
  isPinned: boolean;
  isHidden: boolean;
  isDeleted: boolean;
  likedBy: string[];
  reportedBy: string[];
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------- storage --------------------------------- */

let comments: Comment[] = [];
let loaded = false;
let writeTimer: NodeJS.Timeout | null = null;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (existsSync(DATA_FILE)) {
      const raw = JSON.parse(readFileSync(DATA_FILE, "utf8"));
      comments = Array.isArray(raw.comments) ? raw.comments : [];
    }
  } catch {
    comments = [];
  }
}

function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${DATA_FILE}.tmp`;
      writeFileSync(tmp, JSON.stringify({ comments }, null, 1));
      renameSync(tmp, DATA_FILE);
    } catch {
      /* non-fatal: next change retries */
    }
  }, 400);
}

/* ------------------------------ sanitizing -------------------------------- */

/** Plain-text only: strip control chars, collapse runs of blank lines. HTML
 *  is never interpreted — the client renders with escaping. */
function sanitizeBody(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_BODY)
    .trim();
  return cleaned.length ? cleaned : null;
}

function sanitizeName(input: unknown): string {
  if (typeof input !== "string") return "Guest";
  const cleaned = input.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, MAX_NAME).trim();
  return cleaned || "Guest";
}

function validGuestId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9:._-]{8,90}$/.test(id);
}

function validContentKey(key: unknown): key is string {
  return typeof key === "string" && /^\d{1,9}:\d{1,5}(\.\d)?$/.test(key);
}

function fingerprint(body: string): string {
  return createHash("sha256").update(body.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);
}

/* ----------------------------- rate limiting ------------------------------ */

const lastPostAt = new Map<string, number>();
const hourlyCounts = new Map<string, { reset: number; count: number }>();
const recentHashes = new Map<string, number>(); // `${id}:${hash}` -> expiry

export class CommentError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function checkRateLimit(identity: string, bodyHash: string) {
  const now = Date.now();
  const last = lastPostAt.get(identity) ?? 0;
  if (now - last < MIN_INTERVAL_MS) {
    throw new CommentError(429, "You're posting too fast — wait a few seconds.");
  }
  const h = hourlyCounts.get(identity);
  if (h && now < h.reset && h.count >= HOURLY_CAP) {
    throw new CommentError(429, "Hourly comment limit reached. Try again later.");
  }
  const dupKey = `${identity}:${bodyHash}`;
  const dupExp = recentHashes.get(dupKey) ?? 0;
  if (now < dupExp) {
    throw new CommentError(409, "You already posted that comment.");
  }
}

function recordPost(identity: string, bodyHash: string) {
  const now = Date.now();
  lastPostAt.set(identity, now);
  const h = hourlyCounts.get(identity);
  if (!h || now >= h.reset) hourlyCounts.set(identity, { reset: now + 3_600_000, count: 1 });
  else h.count += 1;
  recentHashes.set(`${identity}:${bodyHash}`, now + 5 * 60_000);
  // light GC
  if (recentHashes.size > 5000) {
    recentHashes.forEach((exp, k) => { if (exp < now) recentHashes.delete(k); });
  }
}

/* -------------------------------- CRUD ----------------------------------- */

export interface PublicComment {
  id: string;
  content: string;
  guestId: string;
  name: string;
  body: string;
  parentId: string | null;
  isSpoiler: boolean;
  isPinned: boolean;
  likeCount: number;
  replyCount: number;
  replies?: PublicComment[];
  createdAt: number;
  updatedAt: number;
  likedByMe: boolean;
  reportedByMe: boolean;
  mine: boolean;
}

function toPublic(c: Comment, viewer: string, replyCount = 0): PublicComment {
  return {
    id: c.id,
    content: c.content,
    guestId: c.guestId,
    name: c.name,
    body: c.isDeleted ? "" : c.body,
    parentId: c.parentId,
    isSpoiler: c.isSpoiler,
    isPinned: c.isPinned,
    likeCount: c.likedBy.length,
    replyCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    likedByMe: c.likedBy.includes(viewer),
    reportedByMe: c.reportedBy.includes(viewer),
    mine: c.guestId === viewer,
  };
}

function isAdmin(token: unknown): boolean {
  const expected = process.env.ADMIN_TOKEN;
  return !!expected && typeof token === "string" && token === expected;
}

export type SortMode = "top" | "newest" | "oldest" | "replies";

export function getComments(
  content: string,
  sort: SortMode,
  page: number,
  viewer: string,
): { total: number; page: number; pages: number; comments: PublicComment[] } {
  load();
  if (!validContentKey(content)) throw new CommentError(400, "Invalid content id.");
  const all = comments.filter((c) => c.content === content && !c.isHidden);
  const topLevel = all.filter((c) => !c.parentId);
  const repliesOf = (id: string) =>
    all.filter((c) => c.parentId === id).sort((a, b) => a.createdAt - b.createdAt);

  const sorters: Record<SortMode, (a: Comment, b: Comment) => number> = {
    top: (a, b) => b.likedBy.length - a.likedBy.length || b.createdAt - a.createdAt,
    newest: (a, b) => b.createdAt - a.createdAt,
    oldest: (a, b) => a.createdAt - b.createdAt,
    replies: (a, b) => repliesOf(b.id).length - repliesOf(a.id).length || b.createdAt - a.createdAt,
  };
  const sorted = [...topLevel].sort(sorters[sort] ?? sorters.newest);
  const pinned = sorted.filter((c) => c.isPinned);
  const rest = sorted.filter((c) => !c.isPinned);

  const pages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  const pageItems = rest.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  const withPinned = p === 1 ? [...pinned, ...pageItems] : pageItems;

  return {
    total: topLevel.length,
    page: p,
    pages,
    comments: withPinned.map((c) => {
      const reps = repliesOf(c.id).slice(0, REPLY_CAP);
      const pub = toPublic(c, viewer, repliesOf(c.id).length);
      pub.replies = reps.map((r) => toPublic(r, viewer));
      return pub;
    }),
  };
}

export function getCount(content: string): number {
  load();
  return comments.filter((c) => c.content === content && !c.isHidden && !c.isDeleted).length;
}

export function addComment(input: {
  content: string;
  guestId: string;
  ip: string;
  name: unknown;
  body: unknown;
  parentId?: unknown;
  isSpoiler?: unknown;
}): PublicComment {
  load();
  if (!validContentKey(input.content)) throw new CommentError(400, "Invalid content id.");
  if (!validGuestId(input.guestId)) {
    console.warn("[comments] rejected guest id:", JSON.stringify(input.guestId));
    throw new CommentError(401, "Missing guest identity.");
  }
  const body = sanitizeBody(input.body);
  if (!body) throw new CommentError(400, "Comment cannot be empty.");

  let parent: Comment | undefined;
  if (input.parentId != null) {
    parent = comments.find(
      (c) => c.id === input.parentId && c.content === input.content && !c.parentId,
    );
    if (!parent) throw new CommentError(404, "Parent comment not found.");
    if (parent.isHidden || parent.isDeleted) throw new CommentError(410, "Cannot reply to that comment.");
  }

  const identity = `${input.guestId}|${input.ip}`;
  const hash = fingerprint(body);
  checkRateLimit(identity, hash);

  const now = Date.now();
  const comment: Comment = {
    id: randomUUID(),
    content: input.content,
    guestId: input.guestId,
    name: sanitizeName(input.name),
    body,
    parentId: parent ? parent.id : null,
    isSpoiler: input.isSpoiler === true,
    isPinned: false,
    isHidden: false,
    isDeleted: false,
    likedBy: [],
    reportedBy: [],
    createdAt: now,
    updatedAt: now,
  };
  comments.push(comment);
  recordPost(identity, hash);
  persist();
  return toPublic(comment, input.guestId);
}

function findOwned(id: string, guestId: string, adminToken: unknown): Comment {
  load();
  const c = comments.find((x) => x.id === id);
  if (!c) throw new CommentError(404, "Comment not found.");
  return c;
}

function requireOwner(c: Comment, guestId: string) {
  if (!validGuestId(guestId) || c.guestId !== guestId) {
    throw new CommentError(403, "You can only modify your own comments.");
  }
}

export function editComment(id: string, guestId: string, body: unknown): PublicComment {
  const c = findOwned(id, guestId, undefined);
  requireOwner(c, guestId);
  if (c.isDeleted || c.isHidden) throw new CommentError(410, "Comment is no longer editable.");
  const cleaned = sanitizeBody(body);
  if (!cleaned) throw new CommentError(400, "Comment cannot be empty.");
  c.body = cleaned;
  c.updatedAt = Date.now();
  persist();
  return toPublic(c, guestId);
}

export function deleteComment(id: string, guestId: string, adminToken: unknown) {
  const c = findOwned(id, guestId, adminToken);
  if (!isAdmin(adminToken)) requireOwner(c, guestId);
  c.isDeleted = true;
  c.body = "";
  c.updatedAt = Date.now();
  persist();
  return { ok: true };
}

export function toggleLike(id: string, guestId: string): { liked: boolean; likeCount: number } {
  if (!validGuestId(guestId)) throw new CommentError(401, "Missing guest identity.");
  const c = findOwned(id, guestId, undefined);
  if (c.isDeleted || c.isHidden) throw new CommentError(410, "Comment unavailable.");
  const i = c.likedBy.indexOf(guestId);
  if (i >= 0) c.likedBy.splice(i, 1);
  else c.likedBy.push(guestId);
  persist();
  return { liked: i < 0, likeCount: c.likedBy.length };
}

export function reportComment(id: string, guestId: string): { reported: boolean } {
  if (!validGuestId(guestId)) throw new CommentError(401, "Missing guest identity.");
  const c = findOwned(id, guestId, undefined);
  if (c.isDeleted) throw new CommentError(410, "Comment unavailable.");
  if (c.reportedBy.includes(guestId)) return { reported: true };
  c.reportedBy.push(guestId);
  if (c.reportedBy.length >= REPORT_AUTOHIDE) c.isHidden = true; // auto-hide threshold
  persist();
  return { reported: true };
}

export function setPinned(id: string, pinned: boolean, adminToken: unknown) {
  if (!isAdmin(adminToken)) throw new CommentError(403, "Moderation requires admin access.");
  const c = findOwned(id, "", adminToken);
  if (c.parentId) throw new CommentError(400, "Only top-level comments can be pinned.");
  c.isPinned = pinned;
  persist();
  return { ok: true, isPinned: c.isPinned };
}

export function setHidden(id: string, hidden: boolean, adminToken: unknown) {
  if (!isAdmin(adminToken)) throw new CommentError(403, "Moderation requires admin access.");
  const c = findOwned(id, "", adminToken);
  c.isHidden = hidden;
  persist();
  return { ok: true, isHidden: c.isHidden };
}

/* --------------------------- admin / moderation ---------------------------- */

export interface AdminCommentView {
  id: string;
  content: string;
  guestId: string;
  name: string;
  body: string;
  parentId: string | null;
  isSpoiler: boolean;
  isPinned: boolean;
  isHidden: boolean;
  isDeleted: boolean;
  likeCount: number;
  reportCount: number;
  createdAt: number;
  updatedAt: number;
}

export function adminList(filter: string, page: number): { total: number; pages: number; comments: AdminCommentView[] } {
  load();
  let list = [...comments];
  switch (filter) {
    case "reported":
      list = list.filter((c) => c.reportedBy.length > 0 && !c.isDeleted);
      break;
    case "hidden":
      list = list.filter((c) => c.isHidden);
      break;
    case "deleted":
      list = list.filter((c) => c.isDeleted);
      break;
    default:
      list = list.filter((c) => !c.isDeleted);
  }
  list.sort((a, b) => b.createdAt - a.createdAt);
  const per = 30;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const p = Math.min(Math.max(1, page), pages);
  return {
    total: list.length,
    pages,
    comments: list.slice((p - 1) * per, p * per).map((c) => ({
      id: c.id,
      content: c.content,
      guestId: c.guestId,
      name: c.name,
      body: c.body,
      parentId: c.parentId,
      isSpoiler: c.isSpoiler,
      isPinned: c.isPinned,
      isHidden: c.isHidden,
      isDeleted: c.isDeleted,
      likeCount: c.likedBy.length,
      reportCount: c.reportedBy.length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  };
}

export function adminStats(): { total: number; reported: number; hidden: number; deleted: number } {
  load();
  return {
    total: comments.filter((c) => !c.isDeleted).length,
    reported: comments.filter((c) => c.reportedBy.length > 0 && !c.isDeleted && !c.isHidden).length,
    hidden: comments.filter((c) => c.isHidden).length,
    deleted: comments.filter((c) => c.isDeleted).length,
  };
}

export function adminResolveReports(id: string, adminToken: unknown) {
  if (!isAdmin(adminToken)) throw new CommentError(403, "Moderation requires admin access.");
  const c = comments.find((x) => x.id === id);
  if (!c) throw new CommentError(404, "Comment not found.");
  c.reportedBy = [];
  persist();
  return { ok: true };
}

/** Admin bulk purge helper (used by tests/cleanup). */
export function adminPurgeContent(content: string, adminToken: unknown): { removed: number } {
  if (!isAdmin(adminToken)) throw new CommentError(403, "Moderation requires admin access.");
  const before = comments.length;
  comments = comments.filter((c) => c.content !== content);
  if (comments.length !== before) persist();
  return { removed: before - comments.length };
}
