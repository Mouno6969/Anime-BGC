/**
 * Notification center — opens from the header bell. Broadcast announcements
 * come from the server (seeded welcome/feature tips + admin-created), read /
 * dismissed state is per-guest and persisted server-side.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, Info, Loader2, Megaphone, Play, Sparkles, X } from "lucide-react";
import { useLocation } from "wouter";
import {
  dismissNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from "@/lib/api";
import { cn } from "@/lib/utils";

function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 2) return "Yesterday";
  return `${Math.floor(s / 86400)}d ago`;
}

const CATEGORY_ICON: Record<string, typeof Info> = {
  welcome: Sparkles,
  feature: Sparkles,
  playback: Play,
  system: Megaphone,
  community: Megaphone,
};

export default function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchNotifications();
      setItems(res.items);
      window.dispatchEvent(new CustomEvent("bgc:notifications", { detail: res.unread }));
    } catch {
      /* badge simply stays */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);

  if (!open) return null;

  const shown = tab === "unread" ? items.filter((i) => !i.read) : items;
  const today: ApiNotification[] = [];
  const earlier: ApiNotification[] = [];
  const dayAgo = Date.now() - 86400_000;
  for (const i of shown) (i.createdAt > dayAgo ? today : earlier).push(i);

  const openItem = (n: ApiNotification) => {
    void markNotificationRead(n.id);
    setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: true } : p)));
    window.dispatchEvent(
      new CustomEvent("bgc:notifications", { detail: items.filter((i) => !i.read && i.id !== n.id).length }),
    );
    if (n.actionUrl) {
      onClose();
      if (n.actionUrl.includes("tour=1")) {
        // Special action: launch the onboarding tour instead of navigating.
        window.dispatchEvent(new Event("bgc:start-tour"));
      } else {
        setLocation(n.actionUrl);
      }
    }
  };

  const dismiss = (e: React.MouseEvent, n: ApiNotification) => {
    e.stopPropagation();
    void dismissNotification(n.id);
    setItems((prev) => prev.filter((p) => p.id !== n.id));
  };

  const renderItem = (n: ApiNotification) => {
    const Icon = CATEGORY_ICON[n.category] ?? Info;
    return (
      <div
        key={n.id}
        role="button"
        tabIndex={0}
        onClick={() => openItem(n)}
        onKeyDown={(e) => e.key === "Enter" && openItem(n)}
        className={cn(
          "group relative w-full cursor-pointer rounded-2xl border p-3.5 text-left transition",
          n.read ? "border-border/40 bg-card/40" : "border-primary/25 bg-primary/[0.06] hover:bg-primary/[0.1]",
        )}
      >
        <div className="flex gap-3">
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
              n.priority === "important" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <p className={cn("flex-1 text-sm leading-snug", n.read ? "font-semibold text-foreground/80" : "font-bold text-foreground")}>
                {n.title}
              </p>
              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</span>
              {n.actionLabel && n.actionUrl && (
                <span className="text-[11px] font-bold text-primary">{n.actionLabel} →</span>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={(e) => dismiss(e, n)}
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground/50 opacity-0 transition hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      className="fixed right-3 top-16 z-[80] flex max-h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-[#0c0c0f] shadow-2xl shadow-black/70 animate-fade-up"
    >
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
        <Bell className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-extrabold tracking-tight">Notifications</h2>
        <div className="ml-auto flex items-center gap-1">
          {(["all", "unread"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-bold capitalize transition",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            aria-label="Mark all read"
            title="Mark all read"
            onClick={() => {
              void markAllNotificationsRead();
              setItems((prev) => prev.map((p) => ({ ...p, read: true })));
              window.dispatchEvent(new CustomEvent("bgc:notifications", { detail: 0 }));
            }}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <CheckCheck className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : shown.length === 0 ? (
          <div className="py-10 text-center">
            <Check className="mx-auto h-7 w-7 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-semibold text-foreground">All caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No {tab === "unread" ? "unread " : ""}notifications right now.
            </p>
          </div>
        ) : (
          <>
            {today.length > 0 && (
              <>
                <p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Today
                </p>
                {today.map(renderItem)}
              </>
            )}
            {earlier.length > 0 && (
              <>
                <p className="px-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Earlier
                </p>
                {earlier.map(renderItem)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Keeps the header bell badge in sync (fetched once, updated via events). */
export function useUnreadCount(): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchNotifications()
      .then((res) => alive && setUnread(res.unread))
      .catch(() => undefined);
    const onSync = (e: Event) => setUnread((e as CustomEvent<number>).detail);
    window.addEventListener("bgc:notifications", onSync);
    return () => {
      alive = false;
      window.removeEventListener("bgc:notifications", onSync);
    };
  }, []);
  return unread;
}
