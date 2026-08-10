/**
 * ANIME BGC — full-bleed hero carousel.
 * Style ref: miruro.tv hero — banner bg + dark gradient, airing badge (TL),
 * page counter + arrows (TR), bottom content block with meta chips, title,
 * genres, studio, synopsis, DETAILS + WATCH NOW.
 *
 * Live data: top trending anime from the backend (AniList). Falls back to a
 * curated `featured` list if the request fails.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Info, Play, Star, Clock, Tv } from "lucide-react";
import { featured } from "@/lib/animeData";
import { api, useAsync } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [, navigate] = useLocation();

  const { data, loading } = useAsync((signal) => api.trending(1, 6, signal), []);
  const slides = data?.results?.length ? data.results.slice(0, 5) : featured;
  const count = slides.length;

  const go = useCallback(
    (dir: number) => setActive((p) => (p + dir + count) % count),
    [count],
  );

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setActive((p) => (p + 1) % count), 7000);
    return () => clearInterval(t);
  }, [count]);

  // keep index valid if the dataset size changes
  useEffect(() => {
    setActive((p) => (p < count ? p : 0));
  }, [count]);

  const anime = slides[active] ?? slides[0];

  if (loading && !data) {
    return (
      <section className="relative h-[78vh] min-h-[520px] w-full animate-pulse overflow-hidden bg-card/50">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent" />
        <div className="container relative z-10 flex h-full flex-col justify-end pb-16">
          <div className="h-6 w-28 rounded bg-white/10" />
          <div className="mt-4 h-12 w-2/3 rounded bg-white/10" />
          <div className="mt-3 h-4 w-1/3 rounded bg-white/10" />
          <div className="mt-4 h-16 w-full max-w-xl rounded bg-white/10" />
        </div>
      </section>
    );
  }

  return (
    <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden">
      {/* slides */}
      {slides.map((a, i) => (
        <div
          key={a.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-[var(--ease-out-snappy)]",
            i === active ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={i !== active}
        >
          <img
            src={a.banner}
            alt={a.title}
            className={cn(
              "h-full w-full object-cover object-center",
              i === active && "animate-ken-burns",
            )}
          />
          {/* gradient overlays for contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c] via-[#0a0a0c]/65 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-[#0a0a0c]/55" />
        </div>
      ))}

      {/* airing badge */}
      {anime.airingLabel && (
        <div className="absolute left-4 top-20 z-10 sm:left-8">
          <span className="flex items-center gap-2 rounded-full border border-primary/30 bg-black/45 px-3 py-1.5 text-xs font-semibold text-primary backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {anime.airingLabel}
          </span>
        </div>
      )}

      {/* page counter + arrows */}
      <div className="absolute right-4 top-20 z-10 flex items-center gap-2 sm:right-8">
        <button
          onClick={() => go(-1)}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-black/40 text-white/90 backdrop-blur-md transition-colors hover:border-primary/50 hover:text-primary"
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="rounded-full border border-border bg-black/40 px-3 py-1.5 text-xs font-medium tabular-nums text-white/85 backdrop-blur-md">
          {active + 1} / {count}
        </span>
        <button
          onClick={() => go(1)}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-black/40 text-white/90 backdrop-blur-md transition-colors hover:border-primary/50 hover:text-primary"
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* content */}
      <div className="container relative z-10 flex h-full flex-col justify-end pb-16 sm:pb-20">
        <div key={anime.id} className="max-w-2xl animate-fade-up">
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/85">
            <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold backdrop-blur-sm">
              <Tv className="h-3.5 w-3.5" /> {anime.type}
            </span>
            <span className="flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5 fill-current" /> {anime.episodes}
              {anime.totalEpisodes ? ` / ${anime.totalEpisodes}` : ""}
            </span>
            {anime.score > 0 && (
              <span className="flex items-center gap-1.5 text-amber-300">
                <Star className="h-3.5 w-3.5 fill-amber-300" /> {(anime.score / 10).toFixed(1)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {anime.duration}
            </span>
          </div>

          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {anime.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
            {anime.genres.slice(0, 4).map((g, idx) => (
              <span key={g} className="flex items-center gap-3">
                {idx > 0 && <span className="h-1 w-1 rounded-full bg-primary/70" />}
                {g}
              </span>
            ))}
            {anime.studio && (
              <span className="ml-1 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">
                {anime.studio}
              </span>
            )}
          </div>

          <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            {anime.synopsis}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate(`/watch/${anime.id}`)}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-200 ease-[var(--ease-out-snappy)] hover:shadow-primary/50 hover:brightness-110"
            >
              <Play className="h-4 w-4 fill-current" /> Watch Now
            </button>
            <button
              onClick={() => navigate(`/watch/${anime.id}`)}
              className="flex items-center gap-2 rounded-full border border-border bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:border-primary/40 hover:bg-white/10"
            >
              <Info className="h-4 w-4" /> Details
            </button>
          </div>
        </div>

        {/* dots */}
        <div className="mt-8 flex items-center gap-2">
          {slides.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setActive(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === active ? "w-8 bg-primary" : "w-3 bg-white/30 hover:bg-white/50",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
