import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Server, ShieldAlert, Play, Flag } from "lucide-react";
import { adminFetch } from "../Admin";

interface OverviewData {
  comments: { total: number; reported: number; hidden: number; deleted: number };
  providers: number;
  openReports: number;
  totalReports: number;
  playbackReports: number;
  flags: Record<string, boolean>;
  uptimeSec: number;
}

export default function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<OverviewData>("/api/admin/overview").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-primary" />;

  const cards = [
    { label: "Comments", value: data.comments.total, sub: `${data.comments.reported} reported · ${data.comments.hidden} hidden`, icon: MessageSquare },
    { label: "Stream servers", value: data.providers, sub: "tracked providers", icon: Server },
    { label: "Open reports", value: data.openReports, sub: `${data.totalReports} total`, icon: ShieldAlert },
    { label: "Playback reports", value: data.playbackReports, sub: "user-submitted issues", icon: Play },
    { label: "Flags enabled", value: Object.values(data.flags).filter(Boolean).length, sub: `of ${Object.keys(data.flags).length}`, icon: Flag },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/50 bg-card/60 p-4">
            <c.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 text-2xl font-extrabold tabular-nums">{c.value}</p>
            <p className="text-xs font-bold">{c.label}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Server uptime: {Math.floor(data.uptimeSec / 3600)}h {Math.floor((data.uptimeSec % 3600) / 60)}m
      </p>
    </div>
  );
}