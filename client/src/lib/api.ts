/**
 * Frontend API layer — talks to the Node/TS backend (`/api/*`) which proxies
 * AniList (metadata) and Miruro (episodes + streams). Includes tiny React
 * hooks with loading/error state so components can swap mock data for live
 * data with minimal change.
 */
import { useEffect, useRef, useState } from "react";
import type {
  Anime,
  EpisodesResult,
  PagedResult,
  SourcesResult,
} from "@shared/anime";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = (j && (j.error || j.message)) || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// ---- Endpoint helpers -------------------------------------------------------
export const api = {
  trending: (page = 1, perPage = 24, signal?: AbortSignal) =>
    getJson<PagedResult<Anime>>(`/api/trending?page=${page}&perPage=${perPage}`, signal),
  popular: (page = 1, perPage = 24, signal?: AbortSignal) =>
    getJson<PagedResult<Anime>>(`/api/popular?page=${page}&perPage=${perPage}`, signal),
  topRated: (page = 1, perPage = 24, signal?: AbortSignal) =>
    getJson<PagedResult<Anime>>(`/api/top-rated?page=${page}&perPage=${perPage}`, signal),
  newest: (page = 1, perPage = 24, signal?: AbortSignal) =>
    getJson<PagedResult<Anime>>(`/api/newest?page=${page}&perPage=${perPage}`, signal),
  movies: (page = 1, perPage = 24, signal?: AbortSignal) =>
    getJson<PagedResult<Anime>>(`/api/movies?page=${page}&perPage=${perPage}`, signal),
  search: (q: string, page = 1, perPage = 24, signal?: AbortSignal) =>
    getJson<PagedResult<Anime>>(
      `/api/search?q=${encodeURIComponent(q)}&page=${page}&perPage=${perPage}`,
      signal,
    ),
  proxyUrl: (url: string, referer?: string) => {
    const params = new URLSearchParams({ url });
    if (referer) params.set("referer", referer);
    return `/api/proxy?${params.toString()}`;
  },
  info: (id: number, signal?: AbortSignal) =>
    getJson<Anime>(`/api/info/${id}`, signal),
  episodes: (id: number, signal?: AbortSignal) =>
    getJson<EpisodesResult>(`/api/episodes/${id}`, signal),
  sources: (
    episodeId: string,
    provider: string,
    anilistId: number,
    category: "sub" | "dub" = "sub",
    signal?: AbortSignal,
  ) =>
    getJson<SourcesResult>(
      `/api/sources?episodeId=${encodeURIComponent(episodeId)}&provider=${encodeURIComponent(
        provider,
      )}&anilistId=${anilistId}&category=${category}`,
      signal,
    ),
};

// ---- Generic async hook -----------------------------------------------------
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Run an async fetcher and track loading/error/data. Re-runs when any value in
 * `deps` changes. The fetcher receives an AbortSignal for cancellation.
 */
export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  // keep latest fetcher without forcing it into deps
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef.current(controller.signal).then(
      (data) => {
        if (active) setState({ data, loading: false, error: null });
      },
      (err) => {
        if (controller.signal.aborted) return;
        if (active)
          setState({ data: null, loading: false, error: err?.message || "Something went wrong" });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
