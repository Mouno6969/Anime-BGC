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
  SourcesResult,
  StreamSource,
  SubtitleTrack,
} from "../../shared/anime.js";

const MIRURO_API_URL = (process.env.MIRURO_API_URL || "http://127.0.0.1:8788").replace(/\/$/, "");

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
  return {
    id: e.id,
    number: e.number,
    title: e.title,
    image: e.image,
    airDate: e.airDate,
    duration: e.duration,
    description: e.description,
    filler: e.filler,
  };
}

export async function getEpisodes(anilistId: number): Promise<EpisodesResult> {
  const data = await getJson<any>(`/episodes/${anilistId}`);
  const providers = data?.providers ?? {};
  const orderedNames = [
    ...PROVIDER_PRIORITY.filter((p) => providers[p]),
    ...Object.keys(providers).filter((p) => !PROVIDER_PRIORITY.includes(p)),
  ];

  const byProvider: ProviderEpisodes[] = orderedNames.map((name) => {
    const eps = providers[name]?.episodes ?? {};
    const sub: any[] = Array.isArray(eps.sub) ? eps.sub : [];
    const dub: any[] = Array.isArray(eps.dub) ? eps.dub : [];
    return { provider: name, sub: sub.map(normaliseEpisode), dub: dub.map(normaliseEpisode) };
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
