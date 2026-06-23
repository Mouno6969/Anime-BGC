/**
 * ANIME BGC — Home page (clone of miruro.tv layout).
 * Dark cinematic theme, lavender accent (#b5a8ff). Frontend only, mock data.
 */
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroCarousel from "@/components/HeroCarousel";
import GenreBar from "@/components/GenreBar";
import PromoStrip from "@/components/PromoStrip";
import AnimeGrid from "@/components/AnimeGrid";
import TopAiring from "@/components/TopAiring";
import CarouselRow from "@/components/CarouselRow";
import { trending, movies } from "@/lib/animeData";

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
          <CarouselRow title="Trending Now" items={trending} href="/trending" />
          <CarouselRow title="Popular Movies" items={movies} href="/trending" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
