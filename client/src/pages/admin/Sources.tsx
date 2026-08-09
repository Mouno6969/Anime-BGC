import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { adminFetch } from "../Admin";
import { cn } from "@/lib/utils";

interface ProviderHealth {
  wins: number;
  fails: number;
  lastLatency: number;
  lastOk: number;
  lastFail: number;
  score: number;
}

const LABELS: Record<string, string> = {
  ally: "BGC 1", pewe: "BGC 2", bee: "BGC 3", kiwi: "BGC 4",
  bonk: "BGC 5", moo: "BGC 6", hop: "BGC 7",
};

function stateOf(h: ProviderHealth): { label: string; cls: string } {
  if (h.wins + h.fails === 0) return { label: "UNKNOWN", cls: "text-muted-foreground border-border" };
  if (h.score >= 0.7) return { label: "HEALTHY", cls: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" };
  if (h.score >= 0.4) return { label: "DEGRADED", cls: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  return { label: "DOWN", cls: "text-red-400 border-red-400/40 bg-red-400/10" };
}

export default function Sources() {
  const [data, setData] = useState<Record<string, ProviderHealth> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminFetch<{ providers: Record<string, ProviderHealth> }>("/api/admin/sources")
      .then((d) => setData(d.providers))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading && !data) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-primary" />;
  const entries = Object.entries(data ?? {});

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Live provider racing scoreboard (wins, failures, latency).</p>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No races recorded yet — stats appear as users watch episodes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/50">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Server</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Wins</th>
                <th className="px-4 py-3">Fails</th>
                <th className="px-4 py-3">Latency</th>
                <th className="px-4 py-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([id, h]) => {
                const st = stateOf(h);
                return (
                  <tr key={id} className="border-t border-border/40">
                    <td className="px-4 py-3 font-bold">{LABELS[id] ?? id}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-extrabold", st.cls)}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-emerald-400">{h.wins}</td>
                    <td className="px-4 py-3 tabular-nums text-red-400">{h.fails}</td>
                    <td className="px-4 py-3 tabular-nums">{h.lastLatency ? `${h.lastLatency}ms` : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{h.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}