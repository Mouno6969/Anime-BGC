/**
 * ANIME BGC — History page ("Continue Watching").
 * Reads in-progress entries saved by the player (localStorage) and shows one
 * card per anime in a horizontal snap-scroll row; clicking a card deep-links
 * to /watch/:id?ep=N where the player resumes from the saved position.
 */
import { useState } from "react";
import { Link } from "wouter";
import { History as HistoryIcon, Play, Trash2, X, Compass } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { clearHistory, clearProgress, listHistory, type HistoryItem } from "@/lib/progress";

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function remainingLabel(t: number, d: number): string {
  const left = Math.max(0, Math.round((d - t) / 60));
  return left <= 1 ? "<1 min left" : `${left} min left`;
}

function HistoryCard({ item, onRemove }: { item: HistoryItem; onRemove: () => void }) {
  const pct = Math.min(100, Math.max(0, (item.t / item.d) * 100));
  return (
    <div className="group relative w-40 shrink-0 snap-start sm:w-48">
      <Link href={`/watch/${item.animeId}?ep=${item.episodeNumber}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:glow-accent">
          {item.poster ? (
            <img
              src={item.poster}
              alt={item.title ?? `Anime ${item.animeId}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/25 via-card to-card">
              <HistoryIcon className="h-10 w-10 text-primary/60" />
            </div>
          )}

          {/* bottom info overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-10">
            <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">
              {item.title ?? `Anime #${item.animeId}`}
            </p>
            <p className="mt-1 text-[11px] font-medium text-white/75">
              EP {item.episodeNumber} • {remainingLabel(item.t, item.d)}
            </p>
            {/* progress bar */}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* hover play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40">
              <Play className="h-5 w-5 translate-x-0.5 fill-current" />
            </span>
          </div>
        </div>
      </Link>

      {/* remove from history */}
      <button
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white/80 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/90 hover:text-white focus:opacity-100 group-hover:opacity-100"
        aria-label="Remove from history"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <p className="mt-1.5 text-[11px] text-muted-foreground">{timeAgo(item.updatedAt)}</p>
    </div>
  );
}

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>(() => listHistory());

  const removeOne = (item: HistoryItem) => {
    clearProgress(item.animeId, item.episodeNumber);
    setItems(listHistory());
  };

  const removeAll = () => {
    if (!window.confirm("Clear your entire watch history?")) return;
    clearHistory();
    setItems([]);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-24">
        <div className="container">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                <HistoryIcon className="h-8 w-8 text-primary" />
                History
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick up right where you left off.
              </p>
            </div>
            {items.length > 0 && (
              <button
                onClick={removeAll}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
              <HistoryIcon className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-lg font-semibold">Nothing in progress yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Episodes you start watching will show up here so you can resume them anytime.
                </p>
              </div>
              <Link
                href="/trending"
                className="mt-2 flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
              >
                <Compass className="h-4 w-4" />
                Browse trending
              </Link>
            </div>
          ) : (
            <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
              {items.map((item) => (
                <HistoryCard
                  key={`${item.animeId}:${item.episodeNumber}`}
                  item={item}
                  onRemove={() => removeOne(item)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
