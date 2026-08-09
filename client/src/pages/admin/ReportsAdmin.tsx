import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminFetch, timeAgo } from "../Admin";
import { cn } from "@/lib/utils";

interface Report {
  id: string;
  type: string;
  targetId: string;
  summary: string;
  status: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

const STATUSES = ["new", "triaged", "in_progress", "resolved", "closed"] as const;

export default function ReportsAdmin() {
  const [status, setStatus] = useState("all");
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const load = (s = status) => {
    setLoading(true);
    adminFetch<{ reports: Report[] }>(`/api/admin/reports?status=${s}`)
      .then((d) => setItems(d.reports))
      .finally(() => setLoading(false));
  };
  useEffect(() => load(status), [status]);

  const setStatusFor = async (id: string, s: string) => {
    await adminFetch(`/api/admin/reports/${id}`, { method: "POST", body: JSON.stringify({ status: s }) });
    load(status);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition",
              status === s ? "bg-primary text-primary-foreground" : "border border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="mx-auto mt-16 h-8 w-8 animate-spin text-primary" />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No reports here. Reported comments and playback issues land in this queue.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border/50 bg-card/60 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{r.type}</span>
                <span className="text-muted-foreground">{timeAgo(r.createdAt)}</span>
                <span className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
                  r.status === "new" ? "bg-red-400/15 text-red-300"
                    : r.status === "resolved" || r.status === "closed" ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-amber-400/15 text-amber-300",
                )}>
                  {r.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm text-foreground/90">{r.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {STATUSES.filter((s) => s !== r.status).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void setStatusFor(r.id, s)}
                    className="rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-bold capitalize text-muted-foreground transition hover:text-foreground"
                  >
                    Mark {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}