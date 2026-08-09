/**
 * Frontend API layer — talks to the Node/TS backend (`/api/*`) which proxies
 * AniList (metadata) and Miruro (episodes + streams). Includes tiny React
 * hooks with loading/error state so components can swap mock data for live
 * data with minimal change.
 */
import { useEffect, useRef, useState } from "react";
import { getGuestId } from "./avatar";
import type {
  Anime,
  EpisodesResult,
  PagedResult,
  RacedSourcesResult,
  SourcesResult,
} from "@shared/anime";

async function getJson<T>(url: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { signal, ...init });
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
  raceSources: (
    anilistId: number,
    number: number,
    category: "sub" | "dub" = "sub",
    exclude: string[] = [],
    signal?: AbortSignal,
  ) =>
    getJson<RacedSourcesResult>(
      `/api/sources/race?anilistId=${anilistId}&number=${number}&category=${category}${
        exclude.length ? `&exclude=${encodeURIComponent(exclude.join(","))}` : ""
      }`,
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

/* ------------------------------- comments --------------------------------- */

export interface ApiComment {
  id: string;
  content: string;
  guestId: string;
  name: string;
  body: string;
  parentId: string | null;
  isSpoiler: boolean;
  isPinned: boolean;
  likeCount: number;
  replyCount: number;
  replies?: ApiComment[];
  createdAt: number;
  updatedAt: number;
  likedByMe: boolean;
  reportedByMe: boolean;
  mine: boolean;
}

export interface CommentPage {
  total: number;
  page: number;
  pages: number;
  comments: ApiComment[];
}

export type CommentSort = "top" | "newest" | "oldest" | "replies";

function guestHeaders(): Record<string, string> {
  return { "x-guest-id": getGuestId() };
}

export async function fetchComments(
  content: string,
  sort: CommentSort,
  page: number,
): Promise<CommentPage> {
  const params = new URLSearchParams({ content, sort, page: String(page) });
  return getJson<CommentPage>(`/api/comments?${params}`, undefined, { headers: guestHeaders() });
}

export async function postComment(input: {
  content: string;
  name: string;
  body: string;
  parentId?: string | null;
  isSpoiler?: boolean;
}): Promise<ApiComment> {
  return getJson<ApiComment>("/api/comments", undefined, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...guestHeaders() },
    body: JSON.stringify(input),
  });
}

export async function editComment(id: string, body: string): Promise<ApiComment> {
  return getJson<ApiComment>(`/api/comments/${id}`, undefined, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...guestHeaders() },
    body: JSON.stringify({ body }),
  });
}

export async function deleteComment(id: string): Promise<{ ok: boolean }> {
  return getJson<{ ok: boolean }>(`/api/comments/${id}`, undefined, { method: "DELETE", headers: guestHeaders() });
}

export async function toggleLike(id: string): Promise<{ liked: boolean; likeCount: number }> {
  return getJson<{ liked: boolean; likeCount: number }>(`/api/comments/${id}/like`, undefined, { method: "POST", headers: guestHeaders() });
}

export async function reportComment(id: string): Promise<{ reported: boolean }> {
  return getJson<{ reported: boolean }>(`/api/comments/${id}/report`, undefined, { method: "POST", headers: guestHeaders() });
}

export async function moderateComment(
  id: string,
  action: "pin" | "hide",
  value: boolean,
  adminToken: string,
): Promise<unknown> {
  return getJson<unknown>(`/api/comments/${id}/${action}`, undefined, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
    body: JSON.stringify(action === "pin" ? { pinned: value } : { hidden: value }),
  });
}

/* ----------------------------- notifications ------------------------------ */

export interface ApiNotification {
  id: string;
  category: string;
  priority: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  createdAt: number;
  read: boolean;
}

export async function fetchNotifications(): Promise<{ unread: number; items: ApiNotification[] }> {
  return getJson("/api/notifications", undefined, { headers: guestHeaders() });
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return getJson(`/api/notifications/${id}/read`, undefined, { method: "POST", headers: guestHeaders() });
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  return getJson("/api/notifications/read-all", undefined, { method: "POST", headers: guestHeaders() });
}

export async function dismissNotification(id: string): Promise<{ ok: boolean }> {
  return getJson(`/api/notifications/${id}/dismiss`, undefined, { method: "POST", headers: guestHeaders() });
}

export async function reportPlaybackIssue(input: {
  animeId?: number;
  episode?: number;
  provider?: string;
  errorCode?: string;
  playerState?: string;
  browser?: string;
}): Promise<{ ok: boolean }> {
  return getJson("/api/playback/report", undefined, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...guestHeaders() },
    body: JSON.stringify(input),
  });
}
