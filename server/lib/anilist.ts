/**
 * AniList GraphQL client (Node/TypeScript).
 * Fetches anime metadata and normalises it into the shared `Anime` shape that
 * the frontend already consumes. No API key required.
 */
import type { Anime, MediaType, PagedResult } from "../../shared/anime.js";

const ANILIST_URL = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { large extraLarge }
  bannerImage
  description(asHtml: false)
  format
  seasonYear
  episodes
  duration
  averageScore
  genres
  status
  studios(isMain: true) { nodes { name } }
  nextAiringEpisode { episode }
`;

interface AniListMedia {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: { large?: string; extraLarge?: string };
  bannerImage?: string | null;
  description?: string | null;
  format?: string | null;
  seasonYear?: number | null;
  episodes?: number | null;
  duration?: number | null;
  averageScore?: number | null;
  genres?: string[];
  status?: string | null;
  studios?: { nodes?: { name: string }[] };
  nextAiringEpisode?: { episode: number } | null;
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AniList request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`AniList GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("AniList returned no data");
  return json.data;
}

const FALLBACK_COVER =
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg";

function stripHtml(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>(\n)?/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function normaliseType(format?: string | null): MediaType {
  switch (format) {
    case "TV":
    case "MOVIE":
    case "ONA":
    case "OVA":
    case "SPECIAL":
      return format;
    case "TV_SHORT":
      return "TV_SHORT";
    default:
      return "TV";
  }
}

export function mapMedia(m: AniListMedia): Anime {
  const title = m.title.english || m.title.romaji || m.title.native || "Untitled";
  const poster = m.coverImage?.extraLarge || m.coverImage?.large || FALLBACK_COVER;
  const banner = m.bannerImage || poster;
  const totalEpisodes = m.episodes ?? undefined;
  const airing = m.nextAiringEpisode?.episode;
  const episodes = airing ? Math.max(airing - 1, 0) : (m.episodes ?? 0);
  return {
    id: m.id,
    title,
    poster,
    banner,
    type: normaliseType(m.format),
    year: m.seasonYear ?? 0,
    episodes: episodes || (m.episodes ?? 0),
    totalEpisodes,
    score: m.averageScore ?? 0,
    duration: m.duration ? `${m.duration} mins` : "—",
    genres: m.genres ?? [],
    studio: m.studios?.nodes?.[0]?.name ?? "",
    synopsis: stripHtml(m.description),
    airingLabel: airing ? `EP ${airing} Airing` : undefined,
  };
}

async function pagedList(
  sort: string,
  page: number,
  perPage: number,
  extra: Record<string, unknown> = {},
): Promise<PagedResult<Anime>> {
  const filterDecls = Object.keys(extra)
    .map((k) => {
      if (k === "status") return "$status: MediaStatus";
      if (k === "season") return "$season: MediaSeason";
      if (k === "seasonYear") return "$seasonYear: Int";
      if (k === "genre") return "$genre: String";
      return "";
    })
    .filter(Boolean)
    .join(", ");
  const filterArgs = Object.keys(extra)
    .map((k) => `${k}: $${k}`)
    .join(", ");
  const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort]${filterDecls ? ", " + filterDecls : ""}) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(type: ANIME, sort: $sort, isAdult: false${filterArgs ? ", " + filterArgs : ""}) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] } }>(
    query,
    { page, perPage, sort: [sort], ...extra },
  );
  return {
    page,
    hasNextPage: data.Page.pageInfo.hasNextPage,
    results: data.Page.media.map(mapMedia),
  };
}

export const getTrending = (page = 1, perPage = 24) =>
  pagedList("TRENDING_DESC", page, perPage);

export const getPopular = (page = 1, perPage = 24) =>
  pagedList("POPULARITY_DESC", page, perPage);

export const getTopRated = (page = 1, perPage = 24) =>
  pagedList("SCORE_DESC", page, perPage);

export const getNewest = (page = 1, perPage = 24) =>
  pagedList("START_DATE_DESC", page, perPage, { status: "RELEASING" });

export const getMovies = (page = 1, perPage = 24) =>
  pagedList("POPULARITY_DESC", page, perPage, { format: "MOVIE" } as Record<string, unknown>);

export async function search(query: string, page = 1, perPage = 24): Promise<PagedResult<Anime>> {
  const gqlQuery = `
    query ($page: Int, $perPage: Int, $search: String) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(type: ANIME, search: $search, sort: SEARCH_MATCH, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] } }>(
    gqlQuery,
    { page, perPage, search: query },
  );
  return {
    page,
    hasNextPage: data.Page.pageInfo.hasNextPage,
    results: data.Page.media.map(mapMedia),
  };
}

export async function getInfo(id: number): Promise<Anime> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS}
      }
    }
  `;
  const data = await gql<{ Media: AniListMedia }>(query, { id });
  return mapMedia(data.Media);
}

/** Movies use the MOVIE format filter; expose a typed helper used by the router. */
export async function getMoviesList(page = 1, perPage = 24): Promise<PagedResult<Anime>> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(type: ANIME, format: MOVIE, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] } }>(
    query,
    { page, perPage },
  );
  return {
    page,
    hasNextPage: data.Page.pageInfo.hasNextPage,
    results: data.Page.media.map(mapMedia),
  };
}
