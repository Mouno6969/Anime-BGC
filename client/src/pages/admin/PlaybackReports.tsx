import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminFetch, timeAgo } from "../Admin";

interface PlaybackReport {
  id: string;
  guestId: string;
  animeId: number | null;
  episode: number | null;
  provider: string | null;
  errorCode: string | null;
  playerState: string | null;
  browser: string | null;
  createdAt: number;
}

export default function PlaybackReports() {
  const [items, setItems] = useState<PlaybackReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch<{ reports: PlaybackReport[] }>("/api/admin/playback-reports")
      .then((d) => setItems(d.reports))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-primary" />;
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center text-sm text-muted-foreground">
        No playback issues reported yet. Reports filed from the player error panel appear here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border/50 bg-card/60 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
              {r.errorCode ?? "unknown"}
            </span>
            {r.provider && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{r.provider}</span>}
            <span>{timeAgo(r.createdAt)}</span>
          </div>
          <p className="mt-2">
            Anime <span className="font-bold">{r.animeId ?? "?"}</span> · Episode{" "}
            <span className="font-bold">{r.episode ?? "?"}</span>
          </p>
          <p className="mt-1 break-all text-[11px] text-muted-foreground">
            {r.playerState} · {(r.browser ?? "").slice(0, 90)}
          </p>
        </div>
      ))}
    </div>
  );
}