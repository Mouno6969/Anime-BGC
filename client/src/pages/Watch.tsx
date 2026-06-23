/**
 * ANIME BGC — Watch / detail placeholder page.
 * Shows the anime hero + a "player coming soon" notice (no backend yet).
 */
import { useRoute, Link } from "wouter";
import { ArrowLeft, Play, Star, Tv, Clock } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  featured,
  newest,
  popular,
  topRated,
  trending,
  movies,
  topAiring,
  type Anime,
} from "@/lib/animeData";

const ALL: Anime[] = [
  ...featured,
  ...newest,
  ...popular,
  ...topRated,
  ...trending,
  ...movies,
  ...topAiring,
];

export default function Watch() {
  const [, params] = useRoute("/watch/:id");
  const id = Number(params?.id);
  const anime = ALL.find((a) => a.id === id) ?? featured[0];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* banner */}
        <section className="relative h-[52vh] min-h-[380px] w-full overflow-hidden">
          <img src={anime.banner} alt={anime.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/55 to-[#0a0a0c]/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c]/85 to-transparent" />

          <div className="container relative z-10 flex h-full flex-col justify-end pb-10">
            <Link
              href="/"
              className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-black/40 px-3 py-1.5 text-sm text-white/85 backdrop-blur-md transition-colors hover:border-primary/40 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              {anime.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/80">
              <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold">
                <Tv className="h-3.5 w-3.5" /> {anime.type}
              </span>
              <span className="flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 fill-current" /> {anime.episodes} eps
              </span>
              <span className="flex items-center gap-1.5 text-amber-300">
                <Star className="h-3.5 w-3.5 fill-amber-300" /> {(anime.score / 10).toFixed(1)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {anime.duration}
              </span>
              <span>{anime.year}</span>
            </div>
          </div>
        </section>

        <div className="container grid gap-8 py-10 lg:grid-cols-[1fr_300px]">
          <div>
            {/* player placeholder */}
            <div className="grid aspect-video w-full place-items-center rounded-2xl border border-border bg-card/60">
              <div className="text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/20 text-primary">
                  <Play className="h-7 w-7 translate-x-0.5 fill-current" />
                </span>
                <p className="mt-4 font-display text-lg font-bold">Player coming soon</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Streaming sources require the API & backend, which are next on the roadmap.
                </p>
              </div>
            </div>

            <h2 className="mt-8 font-display text-xl font-bold">Synopsis</h2>
            <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">
              {anime.synopsis ||
                "A new story is about to unfold. Full synopsis, episodes, and streaming will be available once the backend is connected."}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {anime.genres.map((g) => (
                <Link
                  key={g}
                  href="/search"
                  className="rounded-full border border-border bg-white/[0.04] px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {g}
                </Link>
              ))}
            </div>
          </div>

          {/* episodes placeholder */}
          <aside>
            <h3 className="mb-3 font-display text-lg font-bold">Episodes</h3>
            <div className="grid grid-cols-5 gap-2 lg:grid-cols-4">
              {Array.from({ length: Math.min(anime.episodes, 24) }).map((_, i) => (
                <span
                  key={i}
                  className="grid h-10 place-items-center rounded-lg border border-border bg-card/60 text-sm font-medium text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {i + 1}
                </span>
              ))}
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
