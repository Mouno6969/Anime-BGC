/**
 * ANIME BGC — HLS video player.
 *
 * Uses hls.js where MSE is available and falls back to native HLS (Safari/iOS).
 * Streams that require a `Referer` are routed through the backend `/api/proxy`
 * so the browser can play them without CORS/hotlink rejection.
 */
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import type { StreamSource, SubtitleTrack } from "@shared/anime";

export default function VideoPlayer({
  source,
  subtitles = [],
  poster,
}: {
  source: StreamSource | null;
  subtitles?: SubtitleTrack[];
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;

    setLoading(true);
    setError(null);

    // Route through the proxy so the required Referer is applied server-side.
    const playUrl =
      source.type === "hls" || source.url.includes(".m3u8")
        ? api.proxyUrl(source.url, source.referer)
        : source.referer
          ? api.proxyUrl(source.url, source.referer)
          : source.url;

    let hls: Hls | null = null;

    const onReady = () => setLoading(false);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);

    const isHls = source.type === "hls" || source.url.includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30, enableWorker: true });
      hls.loadSource(playUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              setError("This stream could not be played. Try another episode or source.");
              break;
          }
        }
      });
    } else {
      // Native HLS (Safari) or direct mp4
      video.src = playUrl;
      video.play().catch(() => {});
    }

    return () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [source]);

  if (!source) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-2xl border border-border bg-card/60">
        <div className="text-center text-muted-foreground">
          <AlertTriangle className="mx-auto h-8 w-8 opacity-60" />
          <p className="mt-3 text-sm">No playable source for this episode.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
      <video
        ref={videoRef}
        poster={poster}
        controls
        playsInline
        crossOrigin="anonymous"
        className="h-full w-full"
      >
        {subtitles.map((s, i) => (
          <track
            key={i}
            kind="subtitles"
            src={api.proxyUrl(s.file)}
            label={s.label || `Track ${i + 1}`}
            default={i === 0}
          />
        ))}
      </video>

      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 text-center">
          <div>
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-3 max-w-sm px-6 text-sm text-white/80">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
