# Anime BGC

A dark, cinematic **full-stack anime streaming app**, with a design inspired by
[miruro.tv](https://www.miruro.tv). The frontend is wired to a lightweight
Node/TypeScript backend that pulls **live catalog data from AniList** and **live
episodes + streaming sources via the Miruro pipe API**, played in-browser with
an HLS video player.

> Status: **Live.** Home, search, browse and the watch/player flow all run on
> real data. Streams that require a hot-link `Referer` are routed through a
> built-in server-side proxy so they play directly in the browser.

## Features

- **Hero carousel** — live trending anime with airing badge, meta chips, genres, synopsis and CTAs.
- **Tabbed grid** — Newest / Popular / Top Rated (live AniList) with pagination.
- **Top Airing sidebar** — live currently-airing ranking.
- **Trending & Movies rows** — live horizontal poster carousels.
- **Search** — live AniList search synced to the URL (`/search?q=`), debounced.
- **Watch / detail page** — live banner + synopsis, full episode list (real titles),
  **sub/dub toggle**, **streaming-server selector**, and an **HLS player** with
  automatic provider fallback.
- **Watchlist** — add/remove, persisted in `localStorage`.
- **Responsive** layout with a mobile drawer, sticky blurred navbar and tasteful motion.

## Tech Stack

- **React 19** + **TypeScript**, **Vite** build tooling
- **Tailwind CSS 4** custom dark theme (lavender accent `#b5a8ff`)
- **wouter** routing, **lucide-react** icons, **sonner** toasts
- **hls.js** for adaptive HLS playback
- **Express** (production) / **Vite dev middleware** (development) exposing the same `/api/*` routes

## Data Sources

| Source | Used for |
|--------|----------|
| **AniList GraphQL** (`graphql.anilist.co`) | trending, popular, top-rated, newest, search, anime info |
| **Miruro secure pipe** (`miruro.tv/api/secure/pipe`) | episode lists (per provider) + streaming sources |

The Node server delegates Miruro extraction to a local Python Miruro-API service
(`MIRURO_API_URL`, default `http://127.0.0.1:8788`) because that service uses
`curl_cffi` Chrome TLS fingerprinting for Miruro's Cloudflare-protected pipe. See
`server/lib/miruro.ts`.

## API Endpoints

All served under `/api` by both the dev middleware and the production server:

| Endpoint | Description |
|----------|-------------|
| `GET /api/trending` | Trending anime (paged) |
| `GET /api/popular` | Most popular |
| `GET /api/top-rated` | Highest rated |
| `GET /api/recent` | Newest / recently added |
| `GET /api/airing` | Currently airing |
| `GET /api/search?q=` | Search by title/genre |
| `GET /api/info/:id` | Full anime details |
| `GET /api/episodes/:id` | Episode lists grouped by provider (sub + dub) |
| `GET /api/sources?episodeId=&provider=&anilistId=&category=` | Streaming sources for an episode |
| `GET /api/proxy?url=&referer=` | Server-side stream proxy (rewrites m3u8 + forwards Referer) |

## Project Structure

```
client/
  src/
    components/   <- Header, HeroCarousel, AnimeCard, CarouselRow, TopAiring,
                     AnimeGrid, GenreBar, Footer, Skeletons, VideoPlayer
    pages/        <- Home, Watch, Browse (Trending/Search/Schedule/Watchlist), NotFound
    lib/          <- api.ts (fetch layer + hooks), watchlist.ts, animeData.ts (UI constants)
server/
  lib/
    anilist.ts    <- AniList GraphQL client (mapped to the shared Anime shape)
    miruro.ts     <- Miruro extractor client (talks to local Python Miruro-API)
    proxy.ts      <- HLS/segment stream proxy
  api.ts          <- framework-agnostic request handler (JSON + binary proxy)
  index.ts        <- Express production server
shared/
  anime.ts        <- types shared by client + server (Anime, Episode, sources…)
```

## Getting Started

```bash
pnpm install      # install dependencies
cp .env.example .env  # optional; set PORT and MIRURO_API_URL
pnpm dev          # dev server (API included)
pnpm check        # type-check
pnpm build        # production build
PORT=3102 MIRURO_API_URL=http://127.0.0.1:8788 pnpm start
```

For reliable stream extraction, run the Python Miruro-API service separately and
point `MIRURO_API_URL` at it. On this VPS it is running on `127.0.0.1:8788`.

## How playback works

1. `GET /api/info/:id` and `GET /api/episodes/:id` load details + the per-provider
   episode map (providers are ordered by tested reliability).
2. Selecting an episode calls `GET /api/sources`; if a provider yields no playable
   stream the client automatically falls back to the next provider.
3. The chosen HLS URL is played through `GET /api/proxy`, which fetches the
   playlist server-side with the required `Referer`, rewrites every segment/variant
   URL back through the proxy, and streams it to `hls.js`.

## Notes / Disclaimer

This is a technical demo that aggregates publicly reachable third-party APIs.
Upstream providers may rate-limit, change, or block requests at any time, so
availability of any specific title or stream is not guaranteed. Intended for
educational and personal use.
