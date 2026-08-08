/**
 * Player menus: settings (playback speed + quality with bitrates) and
 * subtitle track selection. Rendered as small panels above the controls bar.
 */
import { Check } from "lucide-react";
import { formatBitrate, type QualityLevel } from "./utils";
import { cn } from "@/lib/utils";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const panelClass =
  "absolute bottom-full right-0 z-30 mb-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-white/10 bg-[#0d0d10]/95 py-1.5 text-xs shadow-2xl backdrop-blur animate-bgc-fade";
const rowClass =
  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-white/90 transition-colors hover:bg-white/10";

export function SettingsMenu({
  rate,
  onRate,
  qualityLevels,
  quality,
  autoLevel,
  nativeHeight,
  onQuality,
}: {
  rate: number;
  onRate: (r: number) => void;
  qualityLevels: QualityLevel[];
  quality: number; // -1 = Auto
  autoLevel: number; // current level while Auto
  nativeHeight: number; // single-quality source resolution (0 = unknown)
  onQuality: (index: number) => void;
}) {
  return (
    <div className={panelClass} data-player-menu>
      <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        Playback speed
      </p>
      <div className="grid grid-cols-4 gap-1 px-3 pb-2">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onRate(s)}
            className={cn(
              "rounded-md px-1 py-1.5 text-center font-medium transition-colors",
              rate === s ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/80 hover:bg-white/15",
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      <p className="border-t border-white/10 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        Quality
      </p>
      {qualityLevels.length === 0 ? (
        <div className={cn(rowClass, "cursor-default hover:bg-transparent")}>
          <span className="font-semibold">{nativeHeight > 0 ? `${nativeHeight}p` : "Original"}</span>
          <span className="text-white/50">single quality source</span>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => onQuality(-1)} className={rowClass}>
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
            <button key={l.index} type="button" onClick={() => onQuality(l.index)} className={rowClass}>
              <span className="font-semibold">{l.height}p</span>
              <span className="flex items-center gap-1.5 text-white/50">
                {formatBitrate(l.bitrate)}
                {quality === l.index && <Check className="h-3.5 w-3.5 text-primary" />}
              </span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

export function SubtitleMenu({
  tracks,
  active,
  onSelect,
}: {
  tracks: { index: number; label: string }[];
  active: number; // -1 = Off
  onSelect: (index: number) => void;
}) {
  return (
    <div className={panelClass} data-player-menu>
      <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        Subtitles
      </p>
      <button type="button" onClick={() => onSelect(-1)} className={rowClass}>
        <span className="font-semibold">Off</span>
        {active === -1 && <Check className="h-3.5 w-3.5 text-primary" />}
      </button>
      {tracks.map((t) => (
        <button key={t.index} type="button" onClick={() => onSelect(t.index)} className={rowClass}>
          <span className="font-semibold">{t.label}</span>
          {active === t.index && <Check className="h-3.5 w-3.5 text-primary" />}
        </button>
      ))}
    </div>
  );
}
