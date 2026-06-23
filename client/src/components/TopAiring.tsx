/**
 * ANIME BGC — "Top Airing" sticky sidebar list.
 * Style ref: miruro.tv ranked vertical list with thumbnail + meta.
 */
import { Link } from "wouter";
import { Flame, Star } from "lucide-react";
import { topAiring } from "@/lib/animeData";

export default function TopAiring() {
  return (
    <aside className="lg:sticky lg:top-20">
      <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-sm">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <Flame className="h-5 w-5 text-primary" />
          Top Airing
        </h2>
        <ol className="space-y-1">
          {topAiring.map((a, i) => (
            <li key={a.id}>
              <Link
                href={`/watch/${a.id}`}
                className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5"
              >
                <span className="w-5 shrink-0 text-center font-display text-lg font-bold text-muted-foreground group-hover:text-primary">
                  {i + 1}
                </span>
                <img
                  src={a.poster}
                  alt={a.title}
                  loading="lazy"
                  className="h-16 w-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground/90 transition-colors group-hover:text-primary">
                    {a.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-medium uppercase tracking-wide">
                      {a.type.replace("_", " ")}
                    </span>
                    <span>{a.episodes} eps</span>
                    <span className="flex items-center gap-0.5 text-amber-300">
                      <Star className="h-3 w-3 fill-amber-300" />
                      {(a.score / 10).toFixed(1)}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
