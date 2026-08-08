/**
 * Framework-agnostic JSON API for Anime BGC.
 *
 * Exposes a single `handleApi(method, url)` function that resolves an
 * `/api/...` request into a JSON-serialisable result (or null when the route
 * is unmatched). It is consumed by:
 *   - the Vite dev middleware (development)
 *   - the Express server in `server/index.ts` (production)
 */
import * as anilist from "./lib/anilist.js";
import * as miruro from "./lib/miruro.js";
import { proxyStream, type ProxyResult } from "./lib/proxy.js";

export interface ApiResponse {
  status: number;
  body: unknown;
}

const num = (v: string | null, d: number): number => {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : d;
};

/**
 * Route an API request. Returns `null` if the path is not an API route so the
 * caller can fall through to static file / SPA handling.
 */
export async function handleApi(
  method: string,
  rawUrl: string,
): Promise<ApiResponse | null> {
  const url = new URL(rawUrl, "http://localhost");
  const path = url.pathname;
  if (!path.startsWith("/api/")) return null;
  const q = url.searchParams;

  try {
    // ---- Discovery / lists --------------------------------------------------
    if (path === "/api/trending") {
      return ok(await anilist.getTrending(num(q.get("page"), 1), num(q.get("perPage"), 24)));
    }
    if (path === "/api/popular") {
      return ok(await anilist.getPopular(num(q.get("page"), 1), num(q.get("perPage"), 24)));
    }
    if (path === "/api/top-rated") {
      return ok(await anilist.getTopRated(num(q.get("page"), 1), num(q.get("perPage"), 24)));
    }
    if (path === "/api/newest") {
      return ok(await anilist.getNewest(num(q.get("page"), 1), num(q.get("perPage"), 24)));
    }
    if (path === "/api/movies") {
      return ok(await anilist.getMoviesList(num(q.get("page"), 1), num(q.get("perPage"), 24)));
    }
    if (path === "/api/search") {
      const query = q.get("q") ?? q.get("query") ?? "";
      if (!query.trim()) return ok({ page: 1, hasNextPage: false, results: [] });
      return ok(await anilist.search(query, num(q.get("page"), 1), num(q.get("perPage"), 24)));
    }

    // ---- Detail / streaming -------------------------------------------------
    const infoMatch = path.match(/^\/api\/info\/(\d+)$/);
    if (infoMatch) {
      return ok(await anilist.getInfo(parseInt(infoMatch[1], 10)));
    }

    const epMatch = path.match(/^\/api\/episodes\/(\d+)$/);
    if (epMatch) {
      return ok(await miruro.getEpisodes(parseInt(epMatch[1], 10)));
    }

    if (path === "/api/sources") {
      const episodeId = q.get("episodeId") ?? "";
      const provider = q.get("provider") ?? "";
      const anilistId = num(q.get("anilistId"), 0);
      const category = (q.get("category") as "sub" | "dub") ?? "sub";
      if (!episodeId || !provider || !anilistId) {
        return { status: 400, body: { error: "episodeId, provider and anilistId are required" } };
      }
      return ok(await miruro.getSources(episodeId, provider, anilistId, category));
    }

    // Race every provider that carries this episode; first valid stream wins.
    if (path === "/api/sources/race") {
      const anilistId = num(q.get("anilistId"), 0);
      const number = num(q.get("number"), 0);
      const category = (q.get("category") as "sub" | "dub") ?? "sub";
      const exclude = (q.get("exclude") ?? "").split(",").filter(Boolean);
      if (!anilistId || !number) {
        return { status: 400, body: { error: "anilistId and number are required" } };
      }
      const eps = await miruro.getEpisodes(anilistId);
      const candidates: miruro.RaceCandidate[] = [];
      for (const pd of eps.byProvider) {
        const list = category === "dub" && pd.dub.length ? pd.dub : pd.sub;
        const match = list.find((e) => e.number === number);
        if (match) candidates.push({ episodeId: match.id, provider: pd.provider });
      }
      if (!candidates.length) {
        return { status: 404, body: { error: "No provider carries this episode." } };
      }
      return ok(await miruro.raceSources(candidates, anilistId, category, exclude));
    }

    // Provider health scoreboard (diagnostics).
    if (path === "/api/providers/health") {
      return ok(miruro.providerHealth());
    }

    return { status: 404, body: { error: `Unknown API route: ${path}` } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 502, body: { error: message } };
  }
}

function ok(body: unknown): ApiResponse {
  return { status: 200, body };
}

/**
 * Binary stream proxy handler (separate from the JSON `handleApi` because it
 * returns raw bytes + custom headers). Returns null if not a proxy request.
 */
export async function handleProxy(
  rawUrl: string,
  rangeHeader?: string,
): Promise<ProxyResult | null> {
  const url = new URL(rawUrl, "http://localhost");
  if (url.pathname !== "/api/proxy") return null;
  const target = url.searchParams.get("url");
  const referer = url.searchParams.get("referer") ?? undefined;
  if (!target) {
    return {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify({ error: "url is required" })),
    };
  }
  try {
    return await proxyStream(target, referer, rangeHeader);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 502,
      headers: { "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify({ error: message })),
    };
  }
}
