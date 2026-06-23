/**
 * ANIME BGC — generic browse page used for Trending / Search / Watchlist / Schedule.
 * Frontend only: renders mock data grids. Real filtering arrives with the API.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Search as SearchIcon, CalendarDays } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimeCard from "@/components/AnimeCard";
import {
  trending,
  popular,
  topRated,
  newest,
  scheduleDays,
  topAiring,
  type Anime,
} from "@/lib/animeData";

type Variant = "trending" | "search" | "watchlist" | "schedule";

const TITLES: Record<Variant, string> = {
  trending: "Trending Now",
  search: "Search",
  watchlist: "Your Watchlist",
  schedule: "Airing Schedule",
};

const DATA: Record<Variant, Anime[]> = {
  trending: [...trending, ...popular],
  search: [...newest, ...topRated],
  watchlist: topAiring,
  schedule: [...newest, ...trending],
};

export default function Browse({ variant }: { variant: Variant }) {
  const [query, setQuery] = useState("");
  const [day, setDay] = useState(new Date().getDay());

  const all = DATA[variant];
  const items =
    variant === "search" && query.trim()
      ? all.filter((a) => a.title.toLowerCase().includes(query.trim().toLowerCase()))
      : all;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-24">
        <div className="container">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {TITLES[variant]}
          </h1>

          {variant === "search" && (
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
          )}

          {variant === "schedule" && (
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
          )}

          {variant === "watchlist" && items.length === 0 ? (
            <div className="mt-10 grid place-items-center rounded-2xl border border-dashed border-border py-20 text-center">
              <p className="font-display text-lg font-bold">Your watchlist is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add titles once accounts go live.
              </p>
              <Link
                href="/"
                className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Browse anime
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {items.map((a, i) => (
                <AnimeCard key={`${a.id}-${i}`} anime={a} index={i} className="animate-fade-up" />
              ))}
            </div>
          )}

          {variant === "search" && query.trim() && items.length === 0 && (
            <p className="mt-10 text-center text-muted-foreground">
              No titles match “{query}”. Try another search.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
