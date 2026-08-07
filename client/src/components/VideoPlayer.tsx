/**
 * ANIME BGC — HLS video player.
 *
 * Uses hls.js where MSE is available and falls back to native HLS (Safari/iOS).
 * Streams that require a `Referer` are routed through the backend `/api/proxy`
 * so the browser can play them without CORS/hotlink rejection.
 */
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader2, AlertTriangle, Maximize2, Minimize2, Expand, Gauge, Check } from "lucide-react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
  const [isLandscape, setIsLandscape] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideControlsTimer = useRef<number | null>(null);
  // HLS quality variants (resolution + bitrate) from the master playlist.
  const [qualityLevels, setQualityLevels] = useState<
    { index: number; height: number; bitrate: number }[]
  >([]);
  const [quality, setQuality] = useState(-1); // -1 = Auto (ABR)
  const [autoLevel, setAutoLevel] = useState(-1); // level currently played while Auto
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) setControlsVisible(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const updateOrientation = () => {
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
      if (!landscape) setControlsVisible(false);
    };
    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);
    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
      if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    };
  }, []);

  const showControls = () => {
    setControlsVisible(true);
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = window.setTimeout(() => setControlsVisible(false), 4000);
  };

  const revealControls = () => {
    if (!isLandscape && !isFullscreen) return;
    showControls();
  };

  // Close the quality menu whenever the control overlay hides.
  useEffect(() => {
    if (!controlsVisible) setQualityMenuOpen(false);
  }, [controlsVisible]);

  const formatBitrate = (bps: number) =>
    bps >= 1_000_000 ? `${(bps / 1_000_000).toFixed(1)} Mbps` : `${Math.round(bps / 1000)} kbps`;

  const selectQuality = (index: number) => {
    const hls = hlsRef.current;
    if (hls) hls.currentLevel = index; // -1 restores Auto (ABR)
    setQuality(index);
    setQualityMenuOpen(false);
    showControls();
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (container?.requestFullscreen) {
        await container.requestFullscreen();
        showControls();
        return;
      }
      if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else if (video?.webkitRequestFullscreen) await video.webkitRequestFullscreen();
      showControls();
    } catch {
      setError("Fullscreen is not available in this browser.");
    }
  };

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
      hlsRef.current = hls;
      setQualityLevels([]);
      setQuality(-1);
      setAutoLevel(-1);
      setQualityMenuOpen(false);
      hls.loadSource(playUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        const lvls = (data.levels ?? [])
          .map((l, index) => ({ index, height: l.height ?? 0, bitrate: l.bitrate ?? 0 }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.bitrate - a.bitrate);
        setQualityLevels(lvls);
        setLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setAutoLevel(data.level));
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
      if (hlsRef.current === hls) hlsRef.current = null;
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
    <div
      ref={containerRef}
      onPointerDown={revealControls}
      className={
        isFullscreen
          ? "relative h-screen w-screen overflow-hidden bg-black"
          : "relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black"
      }
    >
      {(isLandscape || isFullscreen) && controlsVisible && (
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {qualityLevels.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setQualityMenuOpen((o) => !o);
                showControls();
              }}
              className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur transition-colors hover:bg-black/80"
              aria-label="Select video quality"
              title="Select video quality"
            >
              <Gauge className="h-3.5 w-3.5" />
              {quality === -1
                ? "Auto"
                : `${qualityLevels.find((l) => l.index === quality)?.height ?? ""}p`}
            </button>
            {qualityMenuOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d10]/95 py-1 text-xs shadow-2xl backdrop-blur">
                <button
                  type="button"
                  onClick={() => selectQuality(-1)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-white/90 transition-colors hover:bg-white/10"
                >
                  <span className="font-semibold">Auto</span>
                  <span className="flex items-center gap-1.5 text-white/50">
                    {autoLevel >= 0 &&
                      (() => {
                        const cur = qualityLevels.find((l) => l.index === autoLevel);
                        return cur ? `${cur.height}p • ${formatBitrate(cur.bitrate)}` : null;
                      })()}
                    {quality === -1 && <Check className="h-3.5 w-3.5 text-primary" />}
                  </span>
                </button>
                {qualityLevels.map((l) => (
                  <button
                    key={l.index}
                    type="button"
                    onClick={() => selectQuality(l.index)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-white/90 transition-colors hover:bg-white/10"
                  >
                    <span className="font-semibold">{l.height}p</span>
                    <span className="flex items-center gap-1.5 text-white/50">
                      {formatBitrate(l.bitrate)}
                      {quality === l.index && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setFitMode((mode) => (mode === "contain" ? "cover" : "contain"))}
          className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur transition-colors hover:bg-black/80"
          aria-label="Toggle fit to screen"
          title="Toggle fit to screen"
        >
          <Expand className="h-3.5 w-3.5" />
          {fitMode === "contain" ? "Fit" : "Fill"}
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground backdrop-blur transition-colors hover:bg-primary"
          aria-label="Toggle fullscreen"
          title="Toggle fullscreen"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {isFullscreen ? "Exit" : "Full"}
        </button>
      </div>
      )}
      <video
        ref={videoRef}
        poster={poster}
        controls
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        playsInline
        crossOrigin="anonymous"
        className="h-full w-full"
        style={{ objectFit: fitMode }}
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
