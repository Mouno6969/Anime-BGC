/**
 * ANIME BGC — generic browse page used for Trending / Search / Watchlist / Schedule.
 * Live data from the backend (AniList). Search syncs to the URL `?q=` param.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { Search as SearchIcon, CalendarDays } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimeCard from "@/components/AnimeCard";
import { GridSkeleton, ErrorState } from "@/components/Skeletons";
import { scheduleDays } from "@/lib/animeData";
import { api, useAsync } from "@/lib/api";
import { useWatchlist } from "@/lib/watchlist";
import type { Anime } from "@shared/anime";

type Variant = "trending" | "search" | "watchlist" | "schedule";

const TITLES: Record<Variant, string> = {
  trending: "Trending Now",
  search: "Search",
  watchlist: "Your Watchlist",
  schedule: "Airing Schedule",
};

export default function Browse({ variant }: { variant: Variant }) {
  if (variant === "search") return <SearchView />;
  if (variant === "watchlist") return <WatchlistView />;
  if (variant === "schedule") return <ScheduleView />;
  return <TrendingView />;
}

function Shell({
  title,
  children,
  toolbar,
}: {
  title: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-24">
        <div className="container">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {toolbar}
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Grid({ items }: { items: Anime[] }) {
  return (
    <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((a, i) => (
        <AnimeCard key={`${a.id}-${i}`} anime={a} index={i} className="animate-fade-up" />
      ))}
    </div>
  );
}

/* ----------------------------- Trending ---------------------------------- */
function TrendingView() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Anime[]>([]);
  const { data, loading, error } = useAsync((signal) => api.trending(page, 24, signal), [page]);

  useEffect(() => {
    if (data?.results) {
      setItems((prev) => (page === 1 ? data.results : [...prev, ...data.results]));
    }
  }, [data, page]);

  return (
    <Shell title={TITLES.trending}>
      {error && items.length === 0 ? (
        <ErrorState message={error} />
      ) : items.length === 0 && loading ? (
        <GridSkeleton count={18} />
      ) : (
        <>
          <Grid items={items} />
          <div className="mt-10 flex justify-center">
            {data?.hasNextPage && (
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

/* ------------------------------ Search ----------------------------------- */
function SearchView() {
  const search = useSearch();
  const initial = useMemo(() => new URLSearchParams(search).get("q") ?? "", [search]);
  const [query, setQuery] = useState(initial);
  const [debounced, setDebounced] = useState(initial);

  useEffect(() => {
    setQuery(initial);
  }, [initial]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data, loading, error } = useAsync(
    (signal) => (debounced ? api.search(debounced, 1, 30, signal) : Promise.resolve({ page: 1, hasNextPage: false, results: [] })),
    [debounced],
  );
  const items = data?.results ?? [];

  return (
    <Shell
      title={TITLES.search}
      toolbar={
        <div className="relative mt-5 max-w-xl">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anime by title…"
            className="h-12 w-full rounded-full border border-border bg-white/5 pl-12 pr-4 text-base text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
          />
        </div>
      }
    >
      {!debounced ? (
        <p className="mt-10 text-center text-muted-foreground">
          Start typing to search thousands of titles.
        </p>
      ) : loading ? (
        <GridSkeleton count={12} />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">
          No titles match “{debounced}”. Try another search.
        </p>
      ) : (
        <Grid items={items} />
      )}
    </Shell>
  );
}

/* ----------------------------- Schedule ---------------------------------- */
function ScheduleView() {
  const [day, setDay] = useState(new Date().getDay());
  const { data, loading, error } = useAsync((signal) => api.newest(1, 48, signal), []);

  // Distribute releasing titles across weekday columns deterministically by id.
  const items = (data?.results ?? []).filter((a) => a.id % 7 === day);

  return (
    <Shell
      title={TITLES.schedule}
      toolbar={
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto">
          {scheduleDays.map((d, i) => (
            <button
              key={d}
              onClick={() => setDay(i)}
              className={
                "flex shrink-0 flex-col items-center rounded-xl border px-5 py-2.5 transition-all " +
                (day === i
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-card/60 text-foreground/70 hover:border-primary/30")
              }
            >
              <CalendarDays className="mb-1 h-4 w-4" />
              <span className="text-sm font-semibold">{d}</span>
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <GridSkeleton count={12} />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">
          No titles scheduled for {scheduleDays[day]}.
        </p>
      ) : (
        <Grid items={items} />
      )}
    </Shell>
  );
}

/* ----------------------------- Watchlist --------------------------------- */
function WatchlistView() {
  const { list } = useWatchlist();
  return (
    <Shell title={TITLES.watchlist}>
      {list.length === 0 ? (
        <div className="mt-10 grid place-items-center rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="font-display text-lg font-bold">Your watchlist is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the bookmark on any title to save it here.
          </p>
          <Link
            href="/"
            className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Browse anime
          </Link>
        </div>
      ) : (
        <Grid items={list} />
      )}
    </Shell>
  );
}
