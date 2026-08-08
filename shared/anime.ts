/**
 * Shared anime types — used by both the Node/TS backend and the React frontend.
 * The backend normalises live AniList data into the `Anime` shape the UI already
 * consumes, so components only swap their data *source*, not their markup.
 */

export type MediaType = "TV" | "MOVIE" | "ONA" | "TV_SHORT" | "OVA" | "SPECIAL";

/** Card / list / hero shape consumed across the frontend. */
export interface Anime {
  id: number;
  title: string;
  poster: string;
  banner: string;
  type: MediaType;
  year: number;
  episodes: number;
  totalEpisodes?: number;
  score: number; // 0-100 (AniList averageScore)
  duration: string;
  genres: string[];
  studio: string;
  synopsis: string;
  airingLabel?: string;
}

/** A single episode entry returned by the watch page. */
export interface Episode {
  id: string; // plain-text provider id, e.g. "allmanga:xxxx:1"
  number: number;
  title?: string;
  image?: string;
  airDate?: string;
  duration?: number;
  description?: string;
  filler?: boolean;
}

/** Sub + dub lists for a single provider. */
export interface ProviderEpisodes {
  provider: string;
  sub: Episode[];
  dub: Episode[];
}

/** Episodes grouped by provider + audio category. */
export interface EpisodesResult {
  anilistId: number;
  provider: string; // the provider chosen as default
  providers: string[]; // all available providers
  hasDub: boolean;
  episodes: Episode[]; // sub episodes for the chosen provider
  dubEpisodes: Episode[]; // dub episodes for the chosen provider (may be empty)
  byProvider: ProviderEpisodes[]; // full per-provider lists for fallback / switching
}

/** A playable stream source. */
export interface StreamSource {
  url: string;
  type: string; // "hls" | "mp4" | ...
  quality?: string;
  server?: string;
  referer?: string;
}

export interface SubtitleTrack {
  file: string;
  label?: string;
  kind?: string;
}

export interface SourcesResult {
  streams: StreamSource[];
  subtitles: SubtitleTrack[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}

/** Per-provider outcome of a parallel source race. */
export interface RaceAttempt {
  provider: string;
  ms: number;
  ok: boolean;
}

/** Winner of a multi-provider race plus diagnostics. */
export interface RacedSourcesResult extends SourcesResult {
  provider: string;
  raced: RaceAttempt[];
}

export interface PagedResult<T> {
  page: number;
  hasNextPage: boolean;
  results: T[];
}
