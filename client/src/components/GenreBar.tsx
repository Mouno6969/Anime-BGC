/**
 * ANIME BGC — horizontally scrollable genre pill bar with left/right arrows.
 * Style ref: miruro.tv genre row.
 */
import { useRef } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { genres } from "@/lib/animeData";

export default function GenreBar() {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) =>
    ref.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={() => scroll(-1)}
        className="z-10 hidden h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary sm:grid"
        aria-label="Scroll genres left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div ref={ref} className="no-scrollbar fade-x flex gap-2 overflow-x-auto scroll-smooth py-1">
        {genres.map((g) => (
          <Link
            key={g}
            href="/search"
            className="shrink-0 rounded-full border border-border bg-white/[0.04] px-4 py-2 text-sm font-medium text-foreground/80 transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
          >
            {g}
          </Link>
        ))}
      </div>

      <button
        onClick={() => scroll(1)}
        className="z-10 hidden h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary sm:grid"
        aria-label="Scroll genres right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
