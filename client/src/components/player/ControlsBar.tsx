/**
 * Bottom controls bar for the custom player: seek bar on top, transport
 * buttons below. Netflix-style gradient, auto-hide handled by the parent.
 */
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Settings,
  Captions,
  PictureInPicture2,
  RectangleHorizontal,
  Maximize,
  Minimize,
  SkipForward,
  Expand,
} from "lucide-react";
import SeekBar from "./SeekBar";
import { SettingsMenu, SubtitleMenu } from "./Menus";
import { formatTime, type QualityLevel } from "./utils";
import { cn } from "@/lib/utils";

export type PlayerMenu = "none" | "settings" | "cc";

const btn =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white";

export interface ControlsBarProps {
  visible: boolean;
  playing: boolean;
  current: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  rate: number;
  qualityLevels: QualityLevel[];
  quality: number;
  autoLevel: number;
  nativeHeight: number;
  subtitleTracks: { index: number; label: string }[];
  activeSubtitle: number;
  canPiP: boolean;
  theater: boolean;
  isFullscreen: boolean;
  fitMode: "contain" | "cover";
  hasNext: boolean;
  menuOpen: PlayerMenu;
  onMenuOpen: (m: PlayerMenu) => void;
  onPlayPause: () => void;
  onSkip: (delta: number) => void;
  onSeek: (t: number) => void;
  onScrubChange: (scrubbing: boolean) => void;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
  onRate: (r: number) => void;
  onQuality: (index: number) => void;
  onSubtitle: (index: number) => void;
  onTogglePiP: () => void;
  onToggleTheater: () => void;
  onToggleFullscreen: () => void;
  onToggleFit: () => void;
  onNext: () => void;
}

export default function ControlsBar(props: ControlsBarProps) {
  const {
    visible,
    playing,
    current,
    duration,
    buffered,
    volume,
    muted,
    rate,
    qualityLevels,
    quality,
    autoLevel,
    nativeHeight,
    subtitleTracks,
    activeSubtitle,
    canPiP,
    theater,
    isFullscreen,
    hasNext,
    menuOpen,
    onMenuOpen,
    onPlayPause,
    onSkip,
    onSeek,
    onScrubChange,
    onVolume,
    onToggleMute,
    onRate,
    onQuality,
    onSubtitle,
    onTogglePiP,
    onToggleTheater,
    onToggleFullscreen,
    onToggleFit,
    onNext,
  } = props;

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2 pb-1.5 transition-opacity duration-300 sm:px-3",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {/* menus (anchored above the bar, right side) */}
      <div className="relative">
        {menuOpen === "settings" && (
          <SettingsMenu
            rate={rate}
            onRate={onRate}
            qualityLevels={qualityLevels}
            quality={quality}
            autoLevel={autoLevel}
            nativeHeight={nativeHeight}
            onQuality={onQuality}
          />
        )}
        {menuOpen === "cc" && (
          <SubtitleMenu tracks={subtitleTracks} active={activeSubtitle} onSelect={onSubtitle} />
        )}
      </div>

      <SeekBar
        current={current}
        duration={duration}
        buffered={buffered}
        onSeek={onSeek}
        onScrubChange={onScrubChange}
      />

      <div className="flex items-center gap-0.5 sm:gap-1.5">
        <button type="button" onClick={onPlayPause} className={btn} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button type="button" onClick={() => onSkip(-10)} className={cn(btn, "hidden sm:grid")} aria-label="Back 10 seconds">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onSkip(10)} className={cn(btn, "hidden sm:grid")} aria-label="Forward 10 seconds">
          <RotateCw className="h-4 w-4" />
        </button>

        {/* volume (slider only where hover exists) */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onToggleMute}
            className={btn}
            aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => onVolume(parseFloat(e.target.value))}
            className="player-range hidden w-20 sm:block"
            aria-label="Volume"
          />
        </div>

        <span className="ml-1 whitespace-nowrap text-[11px] font-medium tabular-nums text-white/80 sm:text-xs">
          {formatTime(current)} / {formatTime(duration)}
        </span>

        <div className="flex-1" />

        {hasNext && (
          <button type="button" onClick={onNext} className={btn} aria-label="Next episode" title="Next episode">
            <SkipForward className="h-5 w-5" />
          </button>
        )}
        {subtitleTracks.length > 0 && (
          <button
            type="button"
            onClick={() => onMenuOpen(menuOpen === "cc" ? "none" : "cc")}
            className={cn(btn, activeSubtitle >= 0 && "text-primary")}
            aria-label="Subtitles"
            title="Subtitles"
          >
            <Captions className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onMenuOpen(menuOpen === "settings" ? "none" : "settings")}
          className={btn}
          aria-label="Settings"
          title="Settings (speed & quality)"
        >
          <Settings className="h-5 w-5" />
        </button>
        {canPiP && (
          <button type="button" onClick={onTogglePiP} className={cn(btn, "hidden sm:grid")} aria-label="Picture in picture" title="Picture in picture">
            <PictureInPicture2 className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleTheater}
          className={cn(btn, "hidden md:grid", theater && "text-primary")}
          aria-label="Theater mode"
          title="Theater mode"
        >
          <RectangleHorizontal className="h-5 w-5" />
        </button>
        {isFullscreen && (
          <button type="button" onClick={onToggleFit} className={btn} aria-label="Toggle fit to screen" title="Toggle fit to screen">
            <Expand className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={btn}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
