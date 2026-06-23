/**
 * ANIME BGC — horizontal scrolling row of poster cards with section header
 * and left/right scroll controls. Style ref: miruro.tv trending rows.
 */
import { useRef } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Anime } from "@shared/anime";
import AnimeCard from "./AnimeCard";

export default function CarouselRow({
  title,
  items,
  href = "/trending",
}: {
  title: string;
  items: Anime[];
  href?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) =>
    ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: "smooth" });

  return (
    <section className="py-2">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight sm:text-2xl">
          <span className="h-6 w-1.5 rounded-full bg-primary" />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href={href}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary"
          >
            View All
          </Link>
          <button
            onClick={() => scroll(-1)}
            className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="no-scrollbar fade-x flex gap-4 overflow-x-auto scroll-smooth pb-2"
      >
        {items.map((a, i) => (
          <AnimeCard
            key={a.id}
            anime={a}
            index={i}
            className="w-[44vw] shrink-0 sm:w-[28vw] md:w-[22vw] lg:w-[15.5%]"
          />
        ))}
      </div>
    </section>
  );
}
