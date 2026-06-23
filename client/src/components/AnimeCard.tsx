/**
 * ANIME BGC — poster card. Dark, 2:3 portrait, lavender hover glow + play overlay.
 * Style ref: miruro.tv card (type pill top-left, score badge, title reveal on hover).
 */
import { Link } from "wouter";
import { Play, Star } from "lucide-react";
import type { Anime } from "@shared/anime";
import { cn } from "@/lib/utils";

const typeLabel: Record<string, string> = {
  TV: "TV",
  MOVIE: "Movie",
  ONA: "ONA",
  TV_SHORT: "Short",
  OVA: "OVA",
};

export default function AnimeCard({
  anime,
  className,
  index = 0,
}: {
  anime: Anime;
  className?: string;
  index?: number;
}) {
  return (
    <Link
      href={`/watch/${anime.id}`}
      className={cn("group block", className)}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 ease-[var(--ease-out-snappy)] group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:glow-accent">
        <img
          src={anime.poster}
          alt={anime.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out-snappy)] group-hover:scale-105"
        />

        {/* top-left type pill */}
        <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
          {typeLabel[anime.type] ?? anime.type}
        </span>

        {/* score badge */}
        {anime.score > 0 && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300 backdrop-blur-sm">
            <Star className="h-3 w-3 fill-amber-300" />
            {(anime.score / 10).toFixed(1)}
          </span>
        )}

        {/* hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition-transform duration-300 group-hover:scale-100 scale-90">
            <Play className="h-5 w-5 translate-x-0.5 fill-current" />
          </span>
        </div>

        {/* bottom meta strip */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2.5 pt-8">
          <div className="flex items-center gap-2 text-[11px] text-white/70">
            {anime.year > 0 && <span>{anime.year}</span>}
            {anime.year > 0 && <span className="h-1 w-1 rounded-full bg-white/40" />}
            <span>{anime.episodes} eps</span>
          </div>
        </div>
      </div>

      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-foreground/90 transition-colors group-hover:text-primary">
        {anime.title}
      </h3>
    </Link>
  );
}
