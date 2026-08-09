/**
 * Miruro streaming client (Node/TypeScript) backed by the local Python
 * Miruro-API service. The Python service uses curl_cffi Chrome TLS
 * fingerprinting, which is required for Miruro's Cloudflare-protected pipe.
 *
 * Set MIRURO_API_URL to override the local extractor base URL.
 */
import type {
  Episode,
  EpisodesResult,
  ProviderEpisodes,
  RaceAttempt,
  RacedSourcesResult,
  SourcesResult,
  StreamSource,
  SubtitleTrack,
} from "../../shared/anime.js";

const MIRURO_API_URL = (process.env.MIRURO_API_URL || "http://127.0.0.1:8788").replace(/\/$/, "");

/* ------------------------- upstream response cache -------------------------
 * The extractor's /episodes/<id> mapping call is the single most expensive
 * upstream request (hundreds of episodes, several provider round-trips) — it
 * is what made first-time One Piece/Bleach page loads stall for ~20s on real
 * networks. Episode mappings change rarely, so we cache them aggressively
 * with stale-while-revalidate: serve the cached copy instantly and refresh
 * in the background. This drops repeat page loads to near-instant and cuts
 * upstream load (and 429 risk) dramatically.
 */
interface UpstreamEntry {
  data: unknown;
  expires: number;
  refreshing?: boolean;
}
const upstreamCache = new Map<string, UpstreamEntry>();
const UPSTREAM_TTL_MS = 6 * 3600_000; // 6h fresh, then stale-while-revalidate

async function cachedUpstream<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = upstreamCache.get(key);
  if (hit) {
    if (hit.expires > now) return hit.data as T;
    // stale: serve immediately, refresh in background once
    if (!hit.refreshing) {
      hit.refreshing = true;
      fetcher()
        .then((data) => upstreamCache.set(key, { data, expires: Date.now() + UPSTREAM_TTL_MS }))
        .catch(() => undefined)
        .finally(() => { const e = upstreamCache.get(key); if (e) e.refreshing = false; });
    }
    return hit.data as T;
  }
  const data = await fetcher();
  upstreamCache.set(key, { data, expires: now + UPSTREAM_TTL_MS });
  if (upstreamCache.size > 300) {
    upstreamCache.forEach((v, k) => { if (v.expires < now - UPSTREAM_TTL_MS) upstreamCache.delete(k); });
  }
  return data;
}

/** Provider priority (best first), matching the frontend fallback order. */
const PROVIDER_PRIORITY = ["ally", "pewe", "bee", "kiwi", "bonk", "moo", "hop", "zoro"];

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${MIRURO_API_URL}${path}`);
  if (!res.ok) {
    let detail = "";
    try {
      const data: any = await res.json();
      detail = typeof data?.detail === "string" ? data.detail : data?.error || "";
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail || `Miruro API request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

function normaliseEpisode(e: any): Episode {
  // Keep only what the episode grid actually renders. Descriptions, images,
  // air dates and AniSkip blobs made long-running shows (One Piece: 1173
  // episodes x 7 providers) return ~8.5 MB of JSON — many seconds of download
  // on mobile and the real cause of the long initial "loading" stall.
  return {
    id: e.id,
    number: e.number,
    title: e.title,
  };
}

export async function getEpisodes(anilistId: number): Promise<EpisodesResult> {
  const data = await cachedUpstream<any>(`episodes:${anilistId}`, () => getJson<any>(`/episodes/${anilistId}`));
  const providers = data?.providers ?? {};
  const orderedNames = [
    ...PROVIDER_PRIORITY.filter((p) => providers[p]),
    ...Object.keys(providers).filter((p) => !PROVIDER_PRIORITY.includes(p)),
  ];

  const byProvider: ProviderEpisodes[] = orderedNames.map((name) => {
    const eps = providers[name]?.episodes ?? {};
    const sub: any[] = Array.isArray(eps.sub) ? eps.sub : [];
    const dub: any[] = Array.isArray(eps.dub) ? eps.dub : [];
    // byProvider copies exist only for server-switching/fallback lookups
    // (matched by episode number to get an id) — titles are not rendered from
    // these, so keep them minimal to keep the payload small on long shows.
    const slim = (e: any) => ({ id: e.id, number: e.number });
    return { provider: name, sub: sub.map(slim), dub: dub.map(slim) };
  });

  const chosen =
    PROVIDER_PRIORITY.map((name) => byProvider.find((p) => p.provider === name)).find(
      (p) => p && p.sub.length > 0,
    ) ??
    byProvider.find((p) => p.sub.length > 0) ??
    byProvider[0];

  return {
    anilistId,
    provider: chosen?.provider ?? "",
    providers: byProvider.map((p) => p.provider),
    hasDub: (chosen?.dub.length ?? 0) > 0,
    episodes: chosen?.sub ?? [],
    dubEpisodes: chosen?.dub ?? [],
    byProvider,
  };
}

export async function getSources(
  episodeId: string,
  provider: string,
  anilistId: number,
  category: "sub" | "dub" = "sub",
): Promise<SourcesResult> {
  // Episodes returned by the local Miruro API already contain a direct watch path
  // like watch/ally/20/sub/allmanga-1. Prefer that endpoint when present.
  const data = episodeId.startsWith("watch/")
    ? await getJson<any>(`/${episodeId}`)
    : await getJson<any>(
        `/sources?episodeId=${encodeURIComponent(episodeId)}&provider=${encodeURIComponent(
          provider,
        )}&anilistId=${anilistId}&category=${category}`,
      );

  const streams: StreamSource[] = Array.isArray(data?.streams)
    ? data.streams.map((s: any) => ({
        url: s.url,
        type: s.type ?? (String(s.url || "").includes(".m3u8") ? "hls" : "mp4"),
        quality: s.quality,
        server: s.server,
        referer: s.referer,
      }))
    : [];
  const subtitles: SubtitleTrack[] = Array.isArray(data?.subtitles)
    ? data.subtitles.map((s: any) => ({ file: s.file ?? s.url, label: s.label, kind: s.kind }))
    : [];

  return { streams, subtitles, intro: data?.intro, outro: data?.outro };
}

// ---------------------------------------------------------------------------
// Multi-provider racing (lightweight availability checks only; the full video
// is still delivered by exactly one winning provider).
// ---------------------------------------------------------------------------

interface ProviderHealth {
  wins: number;
  fails: number;
  totalWinMs: number;
}

/** In-memory health scoreboard, kept per server process. */
const health = new Map<string, ProviderHealth>();

function healthFor(p: string): ProviderHealth {
  return health.get(p) ?? { wins: 0, fails: 0, totalWinMs: 0 };
}

/** Higher score = race earlier. Wins and low latency raise it, fails lower it. */
function healthScore(p: string): number {
  const h = healthFor(p);
  const avgMs = h.wins > 0 ? h.totalWinMs / h.wins : 5000;
  const priorityBonus = (PROVIDER_PRIORITY.length - PROVIDER_PRIORITY.indexOf(p)) * 10;
  return h.wins * 100 - h.fails * 60 - avgMs / 50 + priorityBonus;
}

export interface RaceCandidate {
  episodeId: string;
  provider: string;
}

const RACE_TIMEOUT_MS = 25_000;

/* ------------------------- stream result cache -----------------------------
 * Winning race results are cached briefly so re-opening an episode (or
 * failover re-races with different excludes) does not re-hit the upstream
 * providers — the biggest driver of the HTTP 429 rate limiting that caused
 * long "Fetching stream…" stalls. Entries auto-expire; negative results are
 * cached very briefly to absorb request bursts without hammering upstreams.
 */
interface CacheEntry {
  result: RacedSourcesResult | null; // null = negative (failure) cache
  expires: number;
}
const raceCache = new Map<string, CacheEntry>();
const POS_TTL_MS = 30 * 60_000; // 30 min for a winning stream set
const NEG_TTL_MS = 45_000;      // 45s for "all providers failed"

function cacheKey(anilistId: number, category: string, exclude: string[]): string {
  return `${anilistId}:${category}:${[...exclude].sort().join(",")}`;
}

function cacheGet(key: string): RacedSourcesResult | null | undefined {
  const e = raceCache.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expires) {
    raceCache.delete(key);
    return undefined;
  }
  return e.result;
}

function cacheSet(key: string, result: RacedSourcesResult | null): void {
  raceCache.set(key, {
    result,
    expires: Date.now() + (result ? POS_TTL_MS : NEG_TTL_MS),
  });
  if (raceCache.size > 500) {
    const now = Date.now();
    raceCache.forEach((v, k) => { if (v.expires < now) raceCache.delete(k); });
  }
}

/**
 * Fire all candidate providers concurrently; the first one returning a
 * playable stream wins, all losers are aborted immediately. Health stats are
 * recorded so future races start with the most reliable providers first.
 */
export async function raceSources(
  candidates: RaceCandidate[],
  anilistId: number,
  category: "sub" | "dub",
  exclude: string[] = [],
): Promise<RacedSourcesResult> {
  const key = cacheKey(anilistId, category, exclude);
  const cached = cacheGet(key);
  if (cached !== undefined) {
    if (cached === null) throw new Error("No playable source found for this episode across providers. (cached)");
    return cached;
  }
  const pool = candidates
    .filter((c) => !exclude.includes(c.provider))
    .sort((a, b) => healthScore(b.provider) - healthScore(a.provider));

  if (!pool.length) throw new Error("No providers available to race.");

  const controllers = new Map<string, AbortController>();
  const attempts: RaceAttempt[] = [];

  const settled = await new Promise<RacedSourcesResult | null>((resolve) => {
    let remaining = pool.length;

    const finish = (winner: RacedSourcesResult | null) => {
      controllers.forEach((c) => c.abort());
      resolve(winner);
    };

    for (const cand of pool) {
      const controller = new AbortController();
      controllers.set(cand.provider, controller);
      const started = Date.now();
      const timer = setTimeout(() => controller.abort(), RACE_TIMEOUT_MS);

      fetchRace(cand, anilistId, category, controller.signal)
        .then(async (res) => {
          const chosen = pickPlayable(res.streams);
          const alive = res.streams.length > 0 && (await validateStream(chosen));
          clearTimeout(timer);
          const ms = Date.now() - started;
          attempts.push({ provider: cand.provider, ms, ok: alive });
          if (!alive) {
            recordFail(cand.provider);
            if (--remaining === 0) finish(null);
            return;
          }
          const h = healthFor(cand.provider);
          health.set(cand.provider, { wins: h.wins + 1, fails: h.fails, totalWinMs: h.totalWinMs + ms });
          finish({ ...res, provider: cand.provider, raced: attempts });
        })
        .catch(() => {
          clearTimeout(timer);
          if (controller.signal.aborted && attempts.some((a) => a.ok)) return; // lost the race
          attempts.push({ provider: cand.provider, ms: Date.now() - started, ok: false });
          recordFail(cand.provider);
          if (--remaining === 0) finish(null);
        });
    }
  });

  if (!settled) {
    cacheSet(key, null);
    throw new Error("No playable source found for this episode across providers.");
  }
  cacheSet(key, settled);
  return settled;
}

function recordFail(provider: string): void {
  const h = healthFor(provider);
  health.set(provider, { ...h, fails: h.fails + 1 });
}

/**
 * Lightweight liveness probe for the exact stream the player would pick.
 * Extraction alone is not enough: providers often return dead/zombie URLs
 * (hotlink-blocked CDNs returning 403 HTML dressed as playlists). We read only
 * the first bytes — never the full video.
 */
async function validateStream(s: StreamSource | undefined): Promise<boolean> {
  if (!s || !s.url || s.type === "embed") return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const headers: Record<string, string> = { Range: "bytes=0-2047" };
    if (s.referer) {
      headers.Referer = s.referer;
      try {
        headers.Origin = new URL(s.referer).origin;
      } catch {
        /* ignore bad referer */
      }
    }
    const res = await fetch(s.url, { headers, signal: controller.signal });
    if (!res.ok) return false;
    const isHls = s.type === "hls" || s.url.includes(".m3u8") || s.url.includes("/mp4");
    if (isHls) {
      let text = await res.text();
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
      return text.trimStart().startsWith("#EXTM3U");
    }
    return true; // mp4: a 2xx/206 on a ranged GET is alive enough
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** The stream the player's best-source logic would choose. */
function pickPlayable(streams: StreamSource[]): StreamSource | undefined {
  const playable = streams.filter((s) => s.type !== "embed");
  return playable.find((s) => s.type === "hls" || s.url.includes(".m3u8")) ?? playable[0];
}

/** One candidate's lightweight availability check with abort support. */
async function fetchRace(
  cand: RaceCandidate,
  anilistId: number,
  category: "sub" | "dub",
  signal: AbortSignal,
): Promise<SourcesResult> {
  const path = cand.episodeId.startsWith("watch/")
    ? `/${cand.episodeId}`
    : `/sources?episodeId=${encodeURIComponent(cand.episodeId)}&provider=${encodeURIComponent(
        cand.provider,
      )}&anilistId=${anilistId}&category=${category}`;
  const res = await fetch(`${MIRURO_API_URL}${path}`, { signal });
  if (!res.ok) throw new Error(`Miruro API request failed (${res.status})`);
  const data: any = await res.json();

  const streams: StreamSource[] = Array.isArray(data?.streams)
    ? data.streams.map((s: any) => ({
        url: s.url,
        type: s.type ?? (String(s.url || "").includes(".m3u8") ? "hls" : "mp4"),
        quality: s.quality,
        server: s.server,
        referer: s.referer,
      }))
    : [];
  const subtitles: SubtitleTrack[] = Array.isArray(data?.subtitles)
    ? data.subtitles.map((s: any) => ({ file: s.file ?? s.url, label: s.label, kind: s.kind }))
    : [];
  return { streams, subtitles, intro: data?.intro, outro: data?.outro };
}

/** Current provider health snapshot (diagnostics endpoint). */
export function providerHealth(): Record<string, ProviderHealth & { score: number }> {
  const out: Record<string, ProviderHealth & { score: number }> = {};
  for (const p of PROVIDER_PRIORITY) {
    const h = health.get(p);
    if (h) out[p] = { ...h, score: Math.round(healthScore(p) * 100) / 100 };
  }
  return out;
}
