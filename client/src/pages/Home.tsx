/**
 * ANIME BGC — Home page (clone of miruro.tv layout).
 * Dark cinematic theme, lavender accent (#b5a8ff). Live data from the backend.
 */
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroCarousel from "@/components/HeroCarousel";
import GenreBar from "@/components/GenreBar";
import PromoStrip from "@/components/PromoStrip";
import AnimeGrid from "@/components/AnimeGrid";
import TopAiring from "@/components/TopAiring";
import CarouselRow from "@/components/CarouselRow";
import { RowSkeleton } from "@/components/Skeletons";
import { api, useAsync } from "@/lib/api";

function LiveRow({
  title,
  href,
  fetcher,
}: {
  title: string;
  href: string;
  fetcher: (signal: AbortSignal) => Promise<{ results: import("@shared/anime").Anime[] }>;
}) {
  const { data, loading } = useAsync(fetcher, []);
  const items = data?.results ?? [];
  if (loading) {
    return (
      <section className="py-2">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="h-6 w-1.5 rounded-full bg-primary" />
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        </div>
        <RowSkeleton />
      </section>
    );
  }
  if (!items.length) return null;
  return <CarouselRow title={title} items={items} href={href} />;
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        <HeroCarousel />

        <div className="container py-8">
          <GenreBar />
        </div>

        {/* main two-column area */}
        <div className="container grid gap-8 pb-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <PromoStrip />
            <AnimeGrid />
          </div>
          <TopAiring />
        </div>

        {/* horizontal carousels */}
        <div className="container space-y-6 pb-10">
          <LiveRow
            title="Trending Now"
            href="/trending"
            fetcher={(signal) => api.trending(1, 18, signal)}
          />
          <LiveRow
            title="Popular Movies"
            href="/trending"
            fetcher={(signal) => api.movies(1, 18, signal)}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
