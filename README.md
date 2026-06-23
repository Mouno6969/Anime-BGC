# Anime BGC

A dark, cinematic **anime streaming website frontend**, with a design inspired by [miruro.tv](https://www.miruro.tv). This repository currently contains the **frontend only** — the API and backend are planned for a later stage.

> Status: Frontend / UI complete. Content shown is mock data. Streaming, search, accounts, and notifications are placeholders until the backend is connected.

## Features

- **Hero carousel** — auto-rotating featured anime with airing badge, meta chips, genres, synopsis and call-to-action buttons.
- **Genre bar** — horizontally scrollable genre pills.
- **Tabbed grid** — Newest / Popular / Top Rated with pagination.
- **Top Airing sidebar** — ranked list with thumbnails and scores.
- **Trending & Movies rows** — horizontal poster carousels.
- **Watch / detail page** — banner, episode list and player placeholder.
- **Browse pages** — Trending, Schedule (day picker), Search (live filter) and Watchlist.
- **Responsive** layout with a mobile drawer, sticky blurred navbar and tasteful motion.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** build tooling
- **Tailwind CSS 4** with a custom dark theme (lavender accent `#b5a8ff`)
- **wouter** for client-side routing
- **shadcn/ui**, **lucide-react** icons, **sonner** toasts

## Project Structure

```
client/
  src/
    components/   <- Header, HeroCarousel, AnimeCard, CarouselRow, TopAiring, AnimeGrid, GenreBar, PromoStrip, Footer
    pages/        <- Home, Watch, Browse (Trending/Search/Schedule/Watchlist), NotFound
    lib/          <- animeData.ts (mock data, replace with API later)
    index.css     <- global dark theme tokens
server/           <- placeholder (no backend yet)
```

## Getting Started

```bash
# install dependencies (uses pnpm)
pnpm install

# start the dev server
pnpm dev

# type-check
pnpm check

# production build
pnpm build
```

The app runs at `http://localhost:3000`.

## Roadmap

- [ ] Connect a real anime data API (catalog, episodes, search)
- [ ] Build the backend (accounts, watchlist persistence, notifications)
- [ ] Integrate a video player and streaming sources
- [ ] Real airing schedule data

## Notes

All anime titles, posters and synopses in `client/src/lib/animeData.ts` are **placeholder/demo content** for design purposes only.
