import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminFetch, timeAgo } from "../Admin";

interface AuditEvent {
  id: string;
  action: string;
  target: string;
  detail: string;
  at: number;
}

export default function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch<{ events: AuditEvent[] }>("/api/admin/audit")
      .then((d) => setEvents(d.events))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-primary" />;
  if (events.length === 0) {
    return (
      <p className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center text-sm text-muted-foreground">
        No admin actions recorded yet. Every sensitive mutation is logged here immutably.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {events.map((e) => (
        <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 px-4 py-2.5 text-sm">
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{e.action}</span>
          <span className="truncate text-xs text-muted-foreground">{e.target.slice(0, 18)}{e.detail ? ` — ${e.detail}` : ""}</span>
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">{timeAgo(e.at)}</span>
        </div>
      ))}
    </div>
  );
}