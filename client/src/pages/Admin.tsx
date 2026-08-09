/**
 * AnimeBGC Admin Control Center — /admin.
 * Token gate is convenience; /api/admin/* re-verifies server-side per request.
 */
import { useEffect, useState } from "react";
import {
  Activity, Bell, Database, Flag, LayoutDashboard, Loader2, Lock, LogOut,
  MessageSquare, Play, ScrollText, Server, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Overview from "./admin/Overview";
import Sources from "./admin/Sources";
import CommentsAdmin from "./admin/CommentsAdmin";
import ReportsAdmin from "./admin/ReportsAdmin";
import NotificationsAdmin from "./admin/NotificationsAdmin";
import PlaybackReports from "./admin/PlaybackReports";
import FlagsAdmin from "./admin/FlagsAdmin";
import AuditLog from "./admin/AuditLog";
import SystemHealth from "./admin/SystemHealth";
import Backups from "./admin/Backups";

export const TOKEN_KEY = "bgc:admin-token";

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": sessionStorage.getItem(TOKEN_KEY) ?? "",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "sources", label: "Sources", icon: Server },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "reports", label: "Reports", icon: ShieldAlert },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "playback", label: "Playback", icon: Play },
  { id: "flags", label: "Feature Flags", icon: Flag },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "system", label: "System", icon: Activity },
  { id: "backups", label: "Backups", icon: Database },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState<SectionId>("overview");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");

  useEffect(() => {
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      setChecking(false);
      return;
    }
    adminFetch("/api/admin/overview")
      .then(() => setAuthed(true))
      .catch(() => sessionStorage.removeItem(TOKEN_KEY))
      .finally(() => setChecking(false));
  }, []);

  const login = async () => {
    setLoginError(null);
    sessionStorage.setItem(TOKEN_KEY, tokenInput.trim());
    try {
      await adminFetch("/api/admin/overview");
      setAuthed(true);
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      setLoginError("Invalid admin token.");
    }
  };

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080808]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080808] p-4">
        <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-[#0c0c0f] p-8 text-center shadow-2xl">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Lock className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">Admin Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your admin token to continue.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void login()}
            placeholder="Admin token"
            aria-label="Admin token"
            className="mt-5 w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/25"
          />
          {loginError && <p className="mt-2 text-xs font-semibold text-destructive">{loginError}</p>}
          <button
            type="button"
            onClick={() => void login()}
            className="mt-4 w-full rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const Active: Record<SectionId, React.ComponentType> = {
    overview: Overview, sources: Sources, comments: CommentsAdmin, reports: ReportsAdmin,
    notifications: NotificationsAdmin, playback: PlaybackReports, flags: FlagsAdmin,
    audit: AuditLog, system: SystemHealth, backups: Backups,
  };
  const ActiveSection = Active[section];

  return (
    <div className="min-h-screen bg-[#080808] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-[#0a0a0c]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <LayoutDashboard className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight">BGC Control Center</h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin</p>
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(TOKEN_KEY);
              setAuthed(false);
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3.5 py-1.5 text-xs font-bold text-muted-foreground transition hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition",
                section === s.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <ActiveSection />
      </main>
    </div>
  );
}
