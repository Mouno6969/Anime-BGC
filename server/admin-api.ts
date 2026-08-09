/**
 * Admin API surface — every route is gated by requireAdmin() (constant-time
 * token check). Mounted from handleApi before the 404 fallthrough.
 */
import os from "node:os";
import { execSync } from "node:child_process";
import * as admin from "./lib/admin.js";
import * as comments from "./lib/comments.js";
import * as notifications from "./lib/notifications.js";
import * as miruro from "./lib/miruro.js";
import type { ApiResponse, ApiContext } from "./api.js";

const ok = (body: unknown): ApiResponse => ({ status: 200, body });
const bootTime = Date.now();

export function handleAdminApi(
  method: string,
  rawUrl: string,
  ctx?: ApiContext,
): ApiResponse | null {
  const url = new URL(rawUrl, "http://localhost");
  const path = url.pathname;
  if (!path.startsWith("/api/admin/")) return null;
  const q = url.searchParams;

  const tokenHdr = ctx?.headers?.["x-admin-token"];
  const token = Array.isArray(tokenHdr) ? tokenHdr[0] : tokenHdr;
  admin.requireAdmin(token); // single gate

  const body = (ctx?.body ?? {}) as Record<string, unknown>;
  const page = Math.max(1, parseInt(q.get("page") ?? "1", 10) || 1);

  if (path === "/api/admin/overview" && method === "GET") {
    const cStats = comments.adminStats();
    const health = miruro.providerHealth();
    const open =
      admin.listReports("new", 1).total +
      admin.listReports("triaged", 1).total +
      admin.listReports("in_progress", 1).total;
    return ok({
      comments: cStats,
      providers: Object.keys(health).length,
      openReports: open,
      totalReports: admin.listReports("all", 1).total,
      playbackReports: notifications.adminPlaybackReports(1, token).total,
      flags: admin.getFlags(),
      uptimeSec: Math.floor((Date.now() - bootTime) / 1000),
    });
  }

  if (path === "/api/admin/sources" && method === "GET") {
    return ok({ providers: miruro.providerHealth() });
  }

  if (path === "/api/admin/comments" && method === "GET") {
    return ok(comments.adminList(q.get("filter") ?? "newest", page));
  }
  const cMod = path.match(/^\/api\/admin\/comments\/([A-Za-z0-9-]+)\/(hide|unhide|pin|unpin|delete|resolve)$/);
  if (cMod && method === "POST") {
    const [, id, action] = cMod;
    let result: unknown;
    if (action === "hide") result = comments.setHidden(id, true, token);
    else if (action === "unhide") result = comments.setHidden(id, false, token);
    else if (action === "pin") result = comments.setPinned(id, true, token);
    else if (action === "unpin") result = comments.setPinned(id, false, token);
    else if (action === "delete") result = comments.deleteComment(id, "", token);
    else result = comments.adminResolveReports(id, token);
    admin.audit(`comment.${action}`, id);
    return ok(result);
  }

  if (path === "/api/admin/notifications" && method === "GET") {
    return ok({ items: notifications.adminListBroadcasts(token) });
  }
  if (path === "/api/admin/notifications" && method === "POST") {
    const created = notifications.adminCreate(body, token);
    admin.audit("notification.create", created.id, created.title);
    return { status: 201, body: created };
  }
  const nMod = path.match(/^\/api\/admin\/notifications\/([A-Za-z0-9-]+)(\/(enable|disable|delete))?$/);
  if (nMod && method === "POST") {
    const [, id, , action] = nMod;
    let result: unknown;
    if (action === "enable") result = notifications.adminSetEnabled(id, true, token);
    else if (action === "disable") result = notifications.adminSetEnabled(id, false, token);
    else if (action === "delete") result = notifications.adminDelete(id, token);
    else result = notifications.adminUpdate(id, body, token);
    admin.audit(`notification.${action ?? "update"}`, id);
    return ok(result);
  }

  if (path === "/api/admin/reports" && method === "GET") {
    return ok(admin.listReports(q.get("status") ?? "all", page));
  }
  const rMod = path.match(/^\/api\/admin\/reports\/([A-Za-z0-9-]+)$/);
  if (rMod && method === "POST") {
    const updated = admin.updateReport(
      rMod[1],
      typeof body.status === "string" ? (body.status as admin.ReportStatus) : undefined,
      typeof body.notes === "string" ? body.notes : undefined,
    );
    admin.audit("report.update", rMod[1], String(body.status ?? "notes"));
    return ok(updated);
  }

  if (path === "/api/admin/playback-reports" && method === "GET") {
    return ok(notifications.adminPlaybackReports(page, token));
  }

  if (path === "/api/admin/audit" && method === "GET") {
    return ok(admin.auditLog(page));
  }

  if (path === "/api/admin/flags" && method === "GET") {
    return ok({ flags: admin.getFlags() });
  }
  const fMod = path.match(/^\/api\/admin\/flags\/([a-z_]{3,30})$/);
  if (fMod && method === "POST") {
    const flags = admin.setFlag(fMod[1], body.enabled !== false);
    admin.audit("flag.set", fMod[1], String(body.enabled !== false));
    return ok({ flags });
  }

  if (path === "/api/admin/system" && method === "GET") {
    const mem = process.memoryUsage();
    return ok({
      node: process.version,
      uptimeSec: Math.floor((Date.now() - bootTime) / 1000),
      processRssMb: Math.round(mem.rss / 1048576),
      system: {
        loadavg: os.loadavg().map((n) => Math.round(n * 100) / 100),
        totalMemMb: Math.round(os.totalmem() / 1048576),
        freeMemMb: Math.round(os.freemem() / 1048576),
        cpus: os.cpus().length,
      },
      miruroApi: process.env.MIRURO_API_URL ?? "default",
    });
  }

  if (path === "/api/admin/backups" && method === "GET") {
    let files: string[] = [];
    try {
      files = execSync("ls -1t /root/backups/anime-bgc-data-*.tar.gz 2>/dev/null | head -20")
        .toString()
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch {
      files = [];
    }
    return ok({ files });
  }
  if (path === "/api/admin/backup" && method === "POST") {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dest = `/root/backups/anime-bgc-data-${stamp}.tar.gz`;
    execSync(`mkdir -p /root/backups && tar -czf ${dest} -C /root/Anime-BGC data`);
    admin.audit("backup.create", dest);
    return ok({ ok: true, file: dest });
  }

  return { status: 404, body: { error: `Unknown admin route: ${path}` } };
}
