import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { adminFetch, timeAgo } from "../Admin";
import { cn } from "@/lib/utils";

interface Broadcast {
  id: string;
  key: string;
  category: string;
  priority: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  createdAt: number;
  expiresAt: number | null;
  enabled: boolean;
}

const EMPTY = { title: "", body: "", category: "system", priority: "info", actionLabel: "", actionUrl: "", expiresInHours: "" };

export default function NotificationsAdmin() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    adminFetch<{ items: Broadcast[] }>("/api/admin/notifications")
      .then((d) => setItems(d.items))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async () => {
    setCreating(true);
    try {
      await adminFetch("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          expiresInHours: form.expiresInHours ? Number(form.expiresInHours) : undefined,
          actionLabel: form.actionLabel || undefined,
          actionUrl: form.actionUrl || undefined,
        }),
      });
      setForm(EMPTY);
      load();
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (b: Broadcast) => {
    await adminFetch(`/api/admin/notifications/${b.id}/${b.enabled ? "disable" : "enable"}`, { method: "POST" });
    load();
  };

  const remove = async (b: Broadcast) => {
    if (!confirm(`Delete "${b.title}"?`)) return;
    await adminFetch(`/api/admin/notifications/${b.id}/delete`, { method: "POST" });
    load();
  };

  const inputCls = "w-full rounded-xl border border-border/60 bg-background/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary/60";

  return (
    <div>
      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-extrabold">
          <Plus className="h-4 w-4 text-primary" /> New broadcast
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="flex gap-2">
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["system", "feature", "playback", "episode", "community", "maintenance"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {["info", "important", "warning", "critical"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <textarea className={cn(inputCls, "sm:col-span-2")} rows={2} placeholder="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <input className={inputCls} placeholder="Action label (optional)" value={form.actionLabel} onChange={(e) => setForm({ ...form, actionLabel: e.target.value })} />
          <input className={inputCls} placeholder="Action URL e.g. /history (optional)" value={form.actionUrl} onChange={(e) => setForm({ ...form, actionUrl: e.target.value })} />
          <input className={inputCls} placeholder="Expires in hours (optional)" value={form.expiresInHours} onChange={(e) => setForm({ ...form, expiresInHours: e.target.value.replace(/[^0-9]/g, "") })} />
          <button
            type="button"
            disabled={creating || !form.title.trim() || !form.body.trim()}
            onClick={() => void create()}
            className="rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
          >
            {creating ? "Publishing…" : "Publish broadcast"}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <Loader2 className="mx-auto mt-10 h-8 w-8 animate-spin text-primary" />
        ) : (
          items.map((b) => (
            <div key={b.id} className={cn("rounded-2xl border p-4", b.enabled ? "border-border/50 bg-card/60" : "border-border/30 bg-card/30 opacity-60")}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{b.category}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", b.priority === "info" ? "bg-muted text-muted-foreground" : "bg-amber-400/15 text-amber-300")}>{b.priority}</span>
                <span className="text-muted-foreground">{timeAgo(b.createdAt)}</span>
                {b.expiresAt && <span className="text-muted-foreground">· expires {new Date(b.expiresAt).toLocaleDateString()}</span>}
              </div>
              <p className="mt-1.5 text-sm font-bold">{b.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{b.body}</p>
              <div className="mt-3 flex gap-1.5">
                <button type="button" onClick={() => void toggle(b)} className="rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition hover:text-foreground">
                  {b.enabled ? "Disable" : "Enable"}
                </button>
                <button type="button" onClick={() => void remove(b)} className="inline-flex items-center gap-1 rounded-full border border-red-400/40 px-3 py-1.5 text-[11px] font-bold text-red-300 transition hover:bg-red-400/10">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
