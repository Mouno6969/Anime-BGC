/**
 * Miruro streaming client (Node/TypeScript).
 *
 * Miruro's frontend talks to its backend through a `secure/pipe` tunnel:
 *   request  -> JSON payload, base64url-encoded, passed as `?e=...`
 *   response -> base64url string -> gzip-decompress -> JSON
 * Episode IDs inside the response are themselves base64url-encoded.
 *
 * This module replicates that protocol with zero external dependencies
 * (Node's built-in `zlib` + `Buffer`).
 */
import { gunzipSync } from "node:zlib";
import type {
  Episode,
  EpisodesResult,
  ProviderEpisodes,
  SourcesResult,
  StreamSource,
  SubtitleTrack,
} from "../../shared/anime.js";

const PIPE_URL = "https://www.miruro.tv/api/secure/pipe";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Referer: "https://www.miruro.tv/",
};

/**
 * Provider priority (best first). Ordered by streams that reliably fetch +
 * proxy as playable HLS in testing (ally/pewe/bee/kiwi/bonk), with the rest
 * after as fallbacks.
 */
const PROVIDER_PRIORITY = ["ally", "pewe", "bee", "kiwi", "bonk", "moo", "hop", "zoro"];

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64url");
}

function b64urlDecodeToBuffer(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function encodePipeRequest(payload: unknown): string {
  return b64urlEncode(JSON.stringify(payload));
}

function decodePipeResponse(encoded: string): any {
  const compressed = b64urlDecodeToBuffer(encoded.trim());
  const json = gunzipSync(compressed).toString("utf-8");
  return JSON.parse(json);
}

/** Decode a base64url-encoded episode id back to plain text (if it looks encoded). */
function translateId(eid: string): string {
  try {
    const decoded = Buffer.from(eid, "base64url").toString("utf-8");
    return decoded.includes(":") ? decoded : eid;
  } catch {
    return eid;
  }
}

/** Recursively decode any base64url `id` fields inside a JSON tree. */
function deepTranslate(obj: any): void {
  if (Array.isArray(obj)) {
    for (const item of obj) deepTranslate(item);
  } else if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (key === "id" && typeof value === "string") {
        obj[key] = translateId(value);
      } else if (value && typeof value === "object") {
        deepTranslate(value);
      }
    }
  }
}

async function pipeGet(payload: unknown): Promise<any> {
  const e = encodePipeRequest(payload);
  const res = await fetch(`${PIPE_URL}?e=${e}`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Miruro pipe request failed (${res.status})`);
  }
  const text = await res.text();
  return decodePipeResponse(text);
}

interface RawEpisode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  airDate?: string;
  duration?: number;
  description?: string;
  filler?: boolean;
}

async function fetchRawEpisodes(anilistId: number): Promise<any> {
  const payload = {
    path: "episodes",
    method: "GET",
    query: { anilistId },
    body: null,
    version: "0.1.0",
  };
  const data = await pipeGet(payload);
  deepTranslate(data);
  return data;
}

function pickProvider(providers: Record<string, any>): string | null {
  const names = Object.keys(providers);
  if (names.length === 0) return null;
  for (const p of PROVIDER_PRIORITY) {
    const pd = providers[p];
    const sub = pd?.episodes?.sub;
    if (Array.isArray(sub) && sub.length > 0) return p;
  }
  // fall back to the first provider that has any sub episodes
  for (const p of names) {
    const sub = providers[p]?.episodes?.sub;
    if (Array.isArray(sub) && sub.length > 0) return p;
  }
  return names[0];
}

function normaliseEpisode(e: RawEpisode): Episode {
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
  const data = await fetchRawEpisodes(anilistId);
  const providers: Record<string, any> = data?.providers ?? {};
  const provider = pickProvider(providers);
  if (!provider) {
    return {
      anilistId,
      provider: "",
      providers: [],
      hasDub: false,
      episodes: [],
      dubEpisodes: [],
      byProvider: [],
    };
  }

  // Build a per-provider map, ordered by our quality priority.
  const orderedNames = [
    ...PROVIDER_PRIORITY.filter((p) => providers[p]),
    ...Object.keys(providers).filter((p) => !PROVIDER_PRIORITY.includes(p)),
  ];
  const byProvider: ProviderEpisodes[] = orderedNames.map((name) => {
    const eps = providers[name]?.episodes ?? {};
    const sub: RawEpisode[] = Array.isArray(eps.sub) ? eps.sub : [];
    const dub: RawEpisode[] = Array.isArray(eps.dub) ? eps.dub : [];
    return {
      provider: name,
      sub: sub.map(normaliseEpisode),
      dub: dub.map(normaliseEpisode),
    };
  });

  const chosen = byProvider.find((p) => p.provider === provider) ?? byProvider[0];
  return {
    anilistId,
    provider: chosen.provider,
    providers: orderedNames,
    hasDub: chosen.dub.length > 0,
    episodes: chosen.sub,
    dubEpisodes: chosen.dub,
    byProvider,
  };
}

export async function getSources(
  episodeId: string,
  provider: string,
  anilistId: number,
  category: "sub" | "dub" = "sub",
): Promise<SourcesResult> {
  const encId = b64urlEncode(episodeId);
  const payload = {
    path: "sources",
    method: "GET",
    query: { episodeId: encId, provider, category, anilistId },
    body: null,
    version: "0.1.0",
  };
  const data = await pipeGet(payload);
  const streams: StreamSource[] = Array.isArray(data?.streams)
    ? data.streams.map((s: any) => ({
        url: s.url,
        type: s.type ?? "hls",
        quality: s.quality,
        server: s.server,
        referer: s.referer,
      }))
    : [];
  const subtitles: SubtitleTrack[] = Array.isArray(data?.subtitles)
    ? data.subtitles.map((s: any) => ({ file: s.file ?? s.url, label: s.label, kind: s.kind }))
    : [];
  return {
    streams,
    subtitles,
    intro: data?.intro,
    outro: data?.outro,
  };
}
