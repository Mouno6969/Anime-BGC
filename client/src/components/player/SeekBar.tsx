/**
 * Custom seek bar: played/buffered bars, click + drag scrubbing (mouse &
 * touch via pointer events), hover time tooltip, grows on hover.
 */
import { useRef, useState } from "react";
import { formatTime } from "./utils";
import { cn } from "@/lib/utils";

export default function SeekBar({
  current,
  duration,
  buffered,
  onSeek,
  onScrubChange,
}: {
  current: number;
  duration: number;
  buffered: number;
  onSeek: (t: number) => void;
  onScrubChange?: (scrubbing: boolean) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);

  const timeAt = (clientX: number): number => {
    const el = barRef.current;
    if (!el || duration <= 0) return 0;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return frac * duration;
  };

  const fracAt = (clientX: number): number => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    barRef.current?.setPointerCapture?.(e.pointerId);
    setScrubbing(true);
    onScrubChange?.(true);
    const t = timeAt(e.clientX);
    setScrubTime(t);
    onSeek(t);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubbing) {
      const t = timeAt(e.clientX);
      setScrubTime(t);
      onSeek(t);
    }
    setHoverFrac(fracAt(e.clientX));
  };

  const endScrub = () => {
    if (!scrubbing) return;
    setScrubbing(false);
    onScrubChange?.(false);
  };

  const shown = scrubbing ? scrubTime : current;
  const playedPct = duration > 0 ? (shown / duration) * 100 : 0;
  const buffPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;
  const tooltipFrac = scrubbing ? (duration > 0 ? scrubTime / duration : 0) : hoverFrac;

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endScrub}
      onPointerCancel={endScrub}
      onPointerLeave={() => setHoverFrac(null)}
      className="group relative flex h-7 w-full cursor-pointer touch-none items-center outline-none"
    >
      {/* time tooltip */}
      {tooltipFrac != null && duration > 0 && (
        <div
          className="pointer-events-none absolute -top-1 -translate-x-1/2 rounded-md bg-black/90 px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ left: `${Math.min(97, Math.max(3, tooltipFrac * 100))}%` }}
        >
          {formatTime(tooltipFrac * duration)}
        </div>
      )}

      {/* track */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-all duration-150 group-hover:h-1.5">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/30"
          style={{ width: `${buffPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${playedPct}%` }}
        />
      </div>

      {/* thumb */}
      <div
        className={cn(
          "pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-primary shadow transition-opacity",
          scrubbing ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        style={{ left: `${playedPct}%` }}
      />
    </div>
  );
}
