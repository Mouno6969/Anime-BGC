/**
 * ANIME BGC — tabbed poster grid (Newest / Popular / Top Rated) with pagination.
 * Style ref: miruro.tv main grid + tab row. Live data from the backend (AniList).
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AnimeCard from "./AnimeCard";
import { GridSkeleton, ErrorState } from "./Skeletons";
import { api, useAsync } from "@/lib/api";
import { cn } from "@/lib/utils";

const PER_PAGE = 12;

const TABS = [
  { key: "popular", label: "Popular", fetch: api.popular },
  { key: "newest", label: "Newest", fetch: api.newest },
  { key: "top", label: "Top Rated", fetch: api.topRated },
] as const;

export default function AnimeGrid() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);

  const fetcher = TABS[tab].fetch;
  const { data, loading, error } = useAsync(
    (signal) => fetcher(page, PER_PAGE, signal),
    [tab, page],
  );

  const items = data?.results ?? [];
  const hasNext = data?.hasNextPage ?? false;

  const changeTab = (i: number) => {
    setTab(i);
    setPage(1);
  };

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur-sm">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              onClick={() => changeTab(i)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200",
                tab === i
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground/70"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-14 text-center text-sm tabular-nums text-muted-foreground">
            Page {page}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext || loading}
            className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground/70"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <GridSkeleton count={PER_PAGE} />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((a, i) => (
            <AnimeCard key={`${tab}-${a.id}`} anime={a} index={i} className="animate-fade-up" />
          ))}
        </div>
      )}
    </section>
  );
}
