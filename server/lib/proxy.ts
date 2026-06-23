/**
 * Streaming proxy.
 *
 * Many anime CDNs reject browser requests unless a specific `Referer`/`Origin`
 * header is present — headers the browser is not allowed to set on a media
 * request. This proxy fetches the upstream resource server-side with the
 * required headers, and (for HLS playlists) rewrites every segment / variant
 * URL so it is also routed back through the proxy.
 */

export interface ProxyResult {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

function buildHeaders(referer?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "*/*",
  };
  if (referer) {
    headers.Referer = referer;
    try {
      headers.Origin = new URL(referer).origin;
    } catch {
      /* ignore malformed referer */
    }
  }
  return headers;
}

/** Wrap an absolute URL into a proxied `/api/proxy?...` URL. */
function wrap(target: string, referer?: string): string {
  const params = new URLSearchParams({ url: target });
  if (referer) params.set("referer", referer);
  return `/api/proxy?${params.toString()}`;
}

function isPlaylist(url: string, contentType: string): boolean {
  return (
    url.includes(".m3u8") ||
    contentType.includes("mpegurl") ||
    contentType.includes("application/vnd.apple.mpegurl")
  );
}

/** Rewrite all URIs in an m3u8 playlist to flow back through the proxy. */
function rewritePlaylist(text: string, baseUrl: string, referer?: string): string {
  const base = new URL(baseUrl);
  const resolve = (uri: string): string => {
    try {
      return new URL(uri, base).toString();
    } catch {
      return uri;
    }
  };

  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Rewrite URI="..." attributes (keys, audio/subtitle media, maps)
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${wrap(resolve(uri), referer)}"`);
      }

      // A bare line that is a resource URI (segment or variant playlist)
      return wrap(resolve(trimmed), referer);
    })
    .join("\n");
}

export async function proxyStream(targetUrl: string, referer?: string): Promise<ProxyResult> {
  const upstream = await fetch(targetUrl, { headers: buildHeaders(referer) });
  const contentType = upstream.headers.get("content-type") ?? "";

  if (isPlaylist(targetUrl, contentType)) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, targetUrl, referer);
    return {
      status: upstream.status,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
      body: Buffer.from(rewritten, "utf-8"),
    };
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  return {
    status: upstream.status,
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
    body: buf,
  };
}
