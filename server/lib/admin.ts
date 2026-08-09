/**
 * Admin foundation — single gate for every /api/admin/* route.
 *
 * Auth model: the site has no user accounts, so admin access is the
 * ADMIN_TOKEN env secret presented as the `x-admin-token` header (constant-
 * time compared). There is one role: full admin. Every sensitive mutation is
 * written to an append-only audit log (data/audit.json).
 */
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const AUDIT_FILE = path.join(DATA_DIR, "audit.json");
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");
const FLAGS_FILE = path.join(DATA_DIR, "feature-flags.json");

export class AdminError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function requireAdmin(token: unknown): void {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || typeof token !== "string" || token.length !== expected.length) {
    throw new AdminError(403, "Admin access required.");
  }
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (!timingSafeEqual(a, b)) throw new AdminError(403, "Admin access required.");
}

/* ------------------------------- audit log --------------------------------- */

export interface AuditEvent {
  id: string;
  action: string;
  target: string;
  detail: string;
  at: number;
}

let auditCache: AuditEvent[] | null = null;

export function audit(action: string, target: string, detail = ""): void {
  try {
    if (!auditCache) auditCache = readJson<AuditEvent[]>(AUDIT_FILE, []);
    auditCache.push({ id: randomUUID(), action, target, detail: detail.slice(0, 300), at: Date.now() });
    if (auditCache.length > 2000) auditCache = auditCache.slice(-2000);
    writeJson(AUDIT_FILE, auditCache);
  } catch {
    /* audit must never break the action */
  }
}

export function auditLog(page: number): { total: number; pages: number; events: AuditEvent[] } {
  const list = [...readJson<AuditEvent[]>(AUDIT_FILE, [])].sort((a, b) => b.at - a.at);
  const per = 40;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const p = Math.min(Math.max(1, page), pages);
  return { total: list.length, pages, events: list.slice((p - 1) * per, p * per) };
}

/* ------------------------------ generic store ------------------------------ */

function readJson<T>(file: string, fallback: T): T {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    /* fall through */
  }
  return fallback;
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 1));
  renameSync(tmp, file);
}

export function hashId(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 12);
}

/* ------------------------------ report center ------------------------------ */

export type ReportStatus = "new" | "triaged" | "in_progress" | "resolved" | "closed";

export interface Report {
  id: string;
  type: string; // comment | playback | technical | other
  targetId: string;
  summary: string;
  status: ReportStatus;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export function listReports(status: string, page: number): { total: number; pages: number; reports: Report[] } {
  let list = readJson<Report[]>(REPORTS_FILE, []);
  if (status && status !== "all") list = list.filter((r) => r.status === status);
  list = [...list].sort((a, b) => b.createdAt - a.createdAt);
  const per = 30;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const p = Math.min(Math.max(1, page), pages);
  return { total: list.length, pages, reports: list.slice((p - 1) * per, p * per) };
}

export function upsertReport(input: Partial<Report> & { type: string; targetId: string; summary: string }): Report {
  const list = readJson<Report[]>(REPORTS_FILE, []);
  // one report per target (dedupe)
  const existing = list.find((r) => r.targetId === input.targetId && r.type === input.type);
  const now = Date.now();
  if (existing) {
    existing.summary = input.summary;
    existing.updatedAt = now;
    if (existing.status === "resolved" || existing.status === "closed") existing.status = "new";
    writeJson(REPORTS_FILE, list);
    return existing;
  }
  const report: Report = {
    id: randomUUID(),
    type: input.type.slice(0, 20),
    targetId: input.targetId.slice(0, 80),
    summary: input.summary.slice(0, 300),
    status: "new",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
  list.push(report);
  if (list.length > 1000) list.splice(0, list.length - 1000);
  writeJson(REPORTS_FILE, list);
  return report;
}

export function updateReport(id: string, status: ReportStatus | undefined, notes: string | undefined): Report {
  const list = readJson<Report[]>(REPORTS_FILE, []);
  const r = list.find((x) => x.id === id);
  if (!r) throw new AdminError(404, "Report not found.");
  if (status) r.status = status;
  if (typeof notes === "string") r.notes = notes.slice(0, 1000);
  r.updatedAt = Date.now();
  writeJson(REPORTS_FILE, list);
  return r;
}

/* ------------------------------ feature flags ------------------------------ */

const DEFAULT_FLAGS: Record<string, boolean> = {
  comments: true,
  notifications: true,
  onboarding: true,
  auto_source: true,
  watchlist: true,
  history: true,
};

export function getFlags(): Record<string, boolean> {
  return { ...DEFAULT_FLAGS, ...readJson<Record<string, boolean>>(FLAGS_FILE, {}) };
}

export function flagEnabled(name: string): boolean {
  return getFlags()[name] !== false;
}

export function setFlag(name: string, enabled: boolean): Record<string, boolean> {
  if (!/^[a-z_]{3,30}$/.test(name)) throw new AdminError(400, "Invalid flag name.");
  const stored = readJson<Record<string, boolean>>(FLAGS_FILE, {});
  stored[name] = enabled;
  writeJson(FLAGS_FILE, stored);
  return getFlags();
}
