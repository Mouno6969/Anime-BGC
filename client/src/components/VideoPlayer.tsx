/**
 * ANIME BGC — custom premium player (Netflix-style).
 *
 * Engine: hls.js (MSE) with native HLS / direct-mp4 fallback; streams that
 * require a Referer are routed through /api/proxy (Range-aware).
 * UI: fully custom controls — tap/double-tap gestures, keyboard shortcuts,
 * resume playback, speed/quality/subtitle menus, PiP, theater, fullscreen,
 * next-episode autoplay. Native browser controls are not used.
 */
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertTriangle, Loader2, Play, Pause } from "lucide-react";
import { api } from "@/lib/api";
import type { StreamSource, SubtitleTrack } from "@shared/anime";
import { cn } from "@/lib/utils";
import ControlsBar, { type PlayerMenu } from "./player/ControlsBar";
import { usePlayerHotkeys } from "./player/useHotkeys";
import { formatTime, type QualityLevel } from "./player/utils";
import { getProgress, saveProgress, clearProgress } from "@/lib/progress";

export interface NextEpisodeInfo {
  number: number;
  title?: string | null;
}

const RATE_KEY = "anime-bgc:rate";
const VOL_KEY = "anime-bgc:volume";
const CC_KEY = "anime-bgc:cc-label";
const HIDE_DELAY = 3000;

function readNumber(key: string, fallback: number): number {
  try {
    const v = parseFloat(localStorage.getItem(key) ?? "");
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export default function VideoPlayer({
  source,
  subtitles = [],
  poster,
  animeId = 0,
  episodeNumber = 1,
  nextEpisode = null,
  onNextEpisode,
  onFatalError,
}: {
  source: StreamSource | null;
  subtitles?: SubtitleTrack[];
  poster?: string;
  animeId?: number;
  episodeNumber?: number;
  nextEpisode?: NextEpisodeInfo | null;
  onNextEpisode?: () => void;
  onFatalError?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const fatalRef = useRef(onFatalError);
  fatalRef.current = onFatalError;
  const progressCtx = useRef({ animeId, episode: episodeNumber });

  // transport state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => Math.min(1, Math.max(0, readNumber(VOL_KEY, 1))));
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(() => readNumber(RATE_KEY, 1));

  // stream state
  const [loading, setLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [quality, setQuality] = useState(-1); // -1 = Auto (ABR)
  const [autoLevel, setAutoLevel] = useState(-1);
  const [nativeHeight, setNativeHeight] = useState(0);
  const [activeSubtitle, setActiveSubtitle] = useState(-1);

  // ui state
  const [controlsVisible, setControlsVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState<PlayerMenu>("none");
  const [scrubbing, setScrubbing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
  const [ended, setEnded] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [notice, setNotice] = useState<string | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ dir: number; id: number } | null>(null);
  const [centerFlash, setCenterFlash] = useState<{ kind: "play" | "pause"; id: number } | null>(null);
  const [canPiP] = useState(
    () =>
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document &&
      document.pictureInPictureEnabled,
  );

  const hideTimer = useRef<number | null>(null);
  const tapTimer = useRef<number | null>(null);
  const lastTap = useRef({ time: 0, x: 0 });
  const flashTimer = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);

  // ---- controls visibility --------------------------------------------------
  const poke = () => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !scrubbing) {
        setControlsVisible(false);
        setMenuOpen("none");
      }
    }, HIDE_DELAY);
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2500);
  };

  const flashCenter = (kind: "play" | "pause") => {
    setCenterFlash({ kind, id: Date.now() });
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setCenterFlash(null);
      setSeekFlash(null);
    }, 600);
  };

  // ---- transport ------------------------------------------------------------
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      flashCenter("play");
    } else {
      v.pause();
      flashCenter("pause");
    }
    poke();
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.min(Math.max(0, t), v.duration);
    setCurrentTime(v.currentTime);
    poke();
  };

  const skip = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    seekTo(v.currentTime + delta);
    setSeekFlash({ dir: delta, id: Date.now() });
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setSeekFlash(null);
      setCenterFlash(null);
    }, 900);
  };

  const changeVolume = (v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolume(clamped);
    setMuted(clamped === 0);
    const vid = videoRef.current;
    if (vid) {
      vid.volume = clamped;
      vid.muted = clamped === 0;
    }
    try {
      localStorage.setItem(VOL_KEY, String(clamped));
    } catch {
      /* ignore */
    }
    poke();
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const next = !muted;
    setMuted(next);
    vid.muted = next;
    poke();
  };

  const changeRate = (r: number) => {
    setRate(r);
    const v = videoRef.current;
    if (v) v.playbackRate = r;
    try {
      localStorage.setItem(RATE_KEY, String(r));
    } catch {
      /* ignore */
    }
    showNotice(`Speed ${r}x`);
    poke();
  };

  const selectQuality = (index: number) => {
    const hls = hlsRef.current;
    if (hls) hls.currentLevel = index; // -1 restores Auto (ABR)
    setQuality(index);
    poke();
  };

  const applySubtitle = (idx: number) => {
    const v = videoRef.current;
    if (!v) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = i === idx ? "showing" : "disabled";
    }
    setActiveSubtitle(idx);
    try {
      localStorage.setItem(CC_KEY, idx >= 0 ? (subtitles[idx]?.label ?? "") : "off");
    } catch {
      /* ignore */
    }
    poke();
  };

  const cycleCaptions = () => {
    if (!subtitles.length) return;
    const next = activeSubtitle + 1 >= subtitles.length ? -1 : activeSubtitle + 1;
    applySubtitle(next);
    showNotice(next >= 0 ? `Subtitles: ${subtitles[next]?.label ?? `Track ${next + 1}`}` : "Subtitles off");
  };

  // ---- modes ----------------------------------------------------------------
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
        return;
      }
      if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else if (video?.webkitRequestFullscreen) await video.webkitRequestFullscreen();
    } catch {
      /* fullscreen unavailable */
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* PiP unavailable */
    }
    poke();
  };

  const toggleTheater = () => {
    setTheater((t) => !t);
    poke();
  };

  const handleNext = () => {
    setEnded(false);
    onNextEpisode?.();
  };

  // ---- gestures -------------------------------------------------------------
  // touch: single tap = toggle controls, double-tap left/right = -10s/+10s.
  // mouse: click = play/pause, double-click = fullscreen.
  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (ended) return;
    // tapping outside an open menu closes it first (no other action)
    if (menuOpen !== "none") {
      setMenuOpen("none");
      lastTap.current.time = 0;
      if (tapTimer.current) {
        window.clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      poke();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const xFrac = (e.clientX - rect.left) / Math.max(1, rect.width);
    const now = Date.now();
    const isTouch = e.pointerType === "touch";

    if (now - lastTap.current.time < 300) {
      // double tap / double click
      if (tapTimer.current) {
        window.clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      lastTap.current.time = 0;
      if (isTouch) {
        if (xFrac < 0.4) skip(-10);
        else if (xFrac > 0.6) skip(10);
        else poke();
      } else {
        toggleFullscreen();
      }
      return;
    }

    lastTap.current = { time: now, x: xFrac };
    tapTimer.current = window.setTimeout(
      () => {
        tapTimer.current = null;
        if (isTouch) {
          if (controlsVisible) {
            setControlsVisible(false);
            setMenuOpen("none");
          } else {
            poke();
          }
        } else {
          togglePlay();
        }
      },
      isTouch ? 280 : 250,
    );
  };

  // ---- keyboard -------------------------------------------------------------
  usePlayerHotkeys({
    playPause: togglePlay,
    seekBy: (d) => {
      const v = videoRef.current;
      if (v) seekTo(v.currentTime + d);
    },
    seekToFraction: (f) => {
      const v = videoRef.current;
      if (v && Number.isFinite(v.duration)) seekTo(v.duration * f);
    },
    volumeBy: (d) => changeVolume(volume + d),
    toggleMute,
    toggleFullscreen,
    toggleTheater,
    cycleCaptions,
  });

  // ---- fullscreen tracking --------------------------------------------------
  useEffect(() => {
    const onFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      poke();
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- playback engine (hls.js / native hls / mp4) ---------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!source || !video) return;

    progressCtx.current = { animeId, episode: episodeNumber };
    setLoading(true);
    setError(null);
    setEnded(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setQualityLevels([]);
    setQuality(-1);
    setAutoLevel(-1);
    setNativeHeight(0);
    setActiveSubtitle(-1);
    setControlsVisible(true);

    const isHls = source.type === "hls" || source.url.includes(".m3u8");
    const playUrl = source.referer ? api.proxyUrl(source.url, source.referer) : source.url;
    // Report a fatal error at most once per source (late timers/events from a
    // dead source must not blame the failover replacement).
    let fatalSent = false;
    const reportFatal = () => {
      if (fatalSent) return;
      fatalSent = true;
      setLoading(false);
      setBuffering(false);
      setError("This stream could not be loaded. Pick another server or episode.");
      fatalRef.current?.();
    };

    const saveNow = () => {
      const ctx = progressCtx.current;
      saveProgress(ctx.animeId, ctx.episode, video.currentTime, video.duration || 0);
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration || 0);
      if (video.videoHeight) setNativeHeight(video.videoHeight);
      video.volume = volume;
      video.muted = muted;
      video.playbackRate = rate;
      // resume playback
      const saved = getProgress(progressCtx.current.animeId, progressCtx.current.episode);
      if (saved && Number.isFinite(video.duration) && saved.t < video.duration - 10) {
        video.currentTime = saved.t;
        showNotice(`Resumed from ${formatTime(saved.t)}`);
      }
      // restore subtitle preference by track label
      let pref = "off";
      try {
        pref = localStorage.getItem(CC_KEY) ?? "off";
      } catch {
        /* ignore */
      }
      applySubtitle(subtitles.findIndex((s) => (s.label ?? "") === pref));
    };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onProgress = () => {
      try {
        if (video.buffered.length) setBuffered(video.buffered.end(video.buffered.length - 1));
      } catch {
        /* ignore */
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      saveNow();
    };
    // Mid-playback starvation watchdog: if the stream buffers for 15s with no
    // recovery, treat the source as dead so auto-failover can switch servers.
    let starveTimer = 0;
    const onWaiting = () => {
      setBuffering(true);
      window.clearTimeout(starveTimer);
      starveTimer = window.setTimeout(() => reportFatal(), 15_000);
    };
    const onPlaying = () => {
      setBuffering(false);
      setLoading(false);
      window.clearTimeout(stallTimer);
      window.clearTimeout(starveTimer);
    };
    const onEnded = () => {
      setPlaying(false);
      setEnded(true);
      setControlsVisible(true);
      const ctx = progressCtx.current;
      clearProgress(ctx.animeId, ctx.episode);
    };
    const onPageHide = () => saveNow();
    // Watchdog: a silently stalling stream (aborted/hanging first request can
    // leave native video stuck with no error event) is treated as fatal after
    // 20s so auto-failover can switch servers. Cleared once playback starts.
    const stallTimer = window.setTimeout(() => {
      if (video.readyState < 2) reportFatal();
    }, 20_000);
    // Native (mp4 / Safari HLS) fatal load error -> report for auto-failover.
    const onVideoError = () => {
      if (!video.error) return; // emptied src during cleanup also fires this
      reportFatal();
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("progress", onProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onPlaying);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onVideoError);
    window.addEventListener("pagehide", onPageHide);

    let hls: Hls | null = null;

    if (isHls && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30, enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(playUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        const lvls = (data.levels ?? [])
          .map((l, index) => ({ index, height: l.height ?? 0, bitrate: l.bitrate ?? 0 }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.bitrate - a.bitrate);
        setQualityLevels(lvls);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setAutoLevel(data.level));
      let netErrors = 0;
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // soft-retry a few times, then give up so auto-failover can switch servers
              netErrors += 1;
              if (netErrors >= 3) {
                hls?.destroy();
                reportFatal();
              } else {
                hls?.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              reportFatal();
          }
        }
      });
    } else {
      // Native HLS (Safari) or direct mp4
      video.src = playUrl;
      video.play().catch(() => {});
    }

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onPlaying);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onVideoError);
      window.removeEventListener("pagehide", onPageHide);
      if (hlsRef.current === hls) hlsRef.current = null;
      if (hls) hls.destroy();
      window.clearTimeout(stallTimer);
      window.clearTimeout(starveTimer);
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, retryTick]);

  // ---- periodic progress save (every 5s while playing) ----------------------
  useEffect(() => {
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused && Number.isFinite(v.duration)) {
        const ctx = progressCtx.current;
        saveProgress(ctx.animeId, ctx.episode, v.currentTime, v.duration);
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  // ---- next-episode autoplay countdown --------------------------------------
  useEffect(() => {
    if (!ended || !nextEpisode || !onNextEpisode) return;
    setCountdown(10);
    const id = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(id);
          handleNext();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  // ---- render ---------------------------------------------------------------
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

  const subtitleTracks = subtitles.map((s, i) => ({ index: i, label: s.label || `Track ${i + 1}` }));

  return (
    <div
      ref={containerRef}
      className={cn(
        isFullscreen
          ? "relative h-screen w-screen overflow-hidden bg-black"
          : theater
            ? "relative left-1/2 h-[78vh] w-screen -translate-x-1/2 overflow-hidden bg-black"
            : "relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black",
        !controlsVisible && playing && "cursor-none",
      )}
      onMouseMove={poke}
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        poster={poster}
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
          />
        ))}
      </video>

      {/* gesture layer (tap / double-tap / click) */}
      <div className="absolute inset-0 z-10 touch-manipulation" onPointerUp={handleTap} />

      {/* center play/pause flash */}
      {centerFlash && (
        <div key={centerFlash.id} className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="animate-bgc-pop rounded-full bg-black/60 p-5">
            {centerFlash.kind === "play" ? (
              <Play className="h-8 w-8 text-white" />
            ) : (
              <Pause className="h-8 w-8 text-white" />
            )}
          </div>
        </div>
      )}

      {/* double-tap seek indicator */}
      {seekFlash && (
        <div
          key={seekFlash.id}
          className={cn(
            "pointer-events-none absolute inset-y-0 z-10 flex w-1/3 items-center justify-center",
            seekFlash.dir < 0 ? "left-0" : "right-0",
          )}
        >
          <div className="animate-bgc-pop rounded-full bg-black/60 px-4 py-2.5 text-sm font-bold text-white">
            {seekFlash.dir > 0 ? "+10s" : "-10s"}
          </div>
        </div>
      )}

      {/* big play button when paused */}
      {!playing && !buffering && !loading && !ended && !error && controlsVisible && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="rounded-full bg-black/60 p-5 backdrop-blur">
            <Play className="h-9 w-9 text-white" />
          </div>
        </div>
      )}

      {/* buffering / loading spinner */}
      {(buffering || loading) && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/30">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {/* toast notice (resume / speed / captions) */}
      {notice && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 animate-bgc-fade whitespace-nowrap rounded-full bg-black/80 px-4 py-1.5 text-xs font-medium text-white">
          {notice}
        </div>
      )}

      {/* controls */}
      <ControlsBar
        visible={controlsVisible && !ended}
        playing={playing}
        current={currentTime}
        duration={duration}
        buffered={buffered}
        volume={volume}
        muted={muted}
        rate={rate}
        qualityLevels={qualityLevels}
        quality={quality}
        autoLevel={autoLevel}
        nativeHeight={nativeHeight}
        subtitleTracks={subtitleTracks}
        activeSubtitle={activeSubtitle}
        canPiP={canPiP}
        theater={theater}
        isFullscreen={isFullscreen}
        fitMode={fitMode}
        hasNext={Boolean(nextEpisode && onNextEpisode)}
        menuOpen={menuOpen}
        onMenuOpen={(m) => {
          setMenuOpen(m);
          poke();
        }}
        onPlayPause={togglePlay}
        onSkip={skip}
        onSeek={seekTo}
        onScrubChange={setScrubbing}
        onVolume={changeVolume}
        onToggleMute={toggleMute}
        onRate={(r) => {
          changeRate(r);
          setMenuOpen("none");
        }}
        onQuality={(i) => {
          selectQuality(i);
          setMenuOpen("none");
        }}
        onSubtitle={(i) => {
          applySubtitle(i);
          setMenuOpen("none");
        }}
        onTogglePiP={togglePiP}
        onToggleTheater={toggleTheater}
        onToggleFullscreen={toggleFullscreen}
        onToggleFit={() => setFitMode((m) => (m === "contain" ? "cover" : "contain"))}
        onNext={handleNext}
      />

      {/* next-episode overlay */}
      {ended &&
        (nextEpisode && onNextEpisode ? (
          <div className="absolute inset-0 z-30 grid animate-bgc-fade place-items-center bg-black/85">
            <div className="px-6 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                Up next in {countdown}s
              </p>
              <p className="mt-2 font-display text-lg font-bold text-white">
                Episode {nextEpisode.number}
                {nextEpisode.title ? ` — ${nextEpisode.title}` : ""}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Play now
                </button>
                <button
                  type="button"
                  onClick={() => setEnded(false)}
                  className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 z-30 grid animate-bgc-fade place-items-center bg-black/70">
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current;
                if (v) {
                  v.currentTime = 0;
                  v.play().catch(() => {});
                }
                setEnded(false);
              }}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Replay
            </button>
          </div>
        ))}

      {/* error overlay */}
      {error && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/80 text-center">
          <div>
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-3 max-w-sm px-6 text-sm text-white/80">{error}</p>
            <button
              type="button"
              onClick={() => setRetryTick((t) => t + 1)}
              className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
