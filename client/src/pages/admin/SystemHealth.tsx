import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { adminFetch } from "../Admin";

interface SystemInfo {
  node: string;
  uptimeSec: number;
  processRssMb: number;
  system: { loadavg: number[]; totalMemMb: number; freeMemMb: number; cpus: number };
  miruroApi: string;
}

export default function SystemHealth() {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  const load = () => adminFetch<SystemInfo>("/api/admin/system").then(setInfo);
  useEffect(() => {
    void load();
  }, []);

  if (!info) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-primary" />;

  const memUsedPct = Math.round(((info.system.totalMemMb - info.system.freeMemMb) / info.system.totalMemMb) * 100);
  const rows = [
    ["Node", info.node],
    ["App uptime", `${Math.floor(info.uptimeSec / 3600)}h ${Math.floor((info.uptimeSec % 3600) / 60)}m`],
    ["App memory", `${info.processRssMb} MB`],
    ["System memory", `${memUsedPct}% used (${info.system.freeMemMb} MB free of ${info.system.totalMemMb} MB)`],
    ["Load average", info.system.loadavg.join(" / ")],
    ["CPUs", String(info.system.cpus)],
    ["Extractor API", info.miruroApi],
  ];

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold">System health</h3>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>
      <dl className="divide-y divide-border/40 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}