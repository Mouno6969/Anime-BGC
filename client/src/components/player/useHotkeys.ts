/**
 * Keyboard shortcuts for the custom player (desktop).
 * Space/K play-pause · ←/→ 5s · J/L 10s · ↑/↓ volume · M mute ·
 * F fullscreen · T theater · C captions · 0–9 seek to N×10%.
 * Ignores keypresses while typing in form fields.
 */
import { useEffect, useRef } from "react";

export interface PlayerHotkeyHandlers {
  playPause: () => void;
  seekBy: (delta: number) => void;
  seekToFraction: (f: number) => void;
  volumeBy: (delta: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  toggleTheater: () => void;
  cycleCaptions: () => void;
}

export function usePlayerHotkeys(handlers: PlayerHotkeyHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      ) {
        return;
      }
      const h = ref.current;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          h.playPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          h.seekBy(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          h.seekBy(5);
          break;
        case "j":
          h.seekBy(-10);
          break;
        case "l":
          h.seekBy(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          h.volumeBy(0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          h.volumeBy(-0.05);
          break;
        case "m":
          h.toggleMute();
          break;
        case "f":
          h.toggleFullscreen();
          break;
        case "t":
          h.toggleTheater();
          break;
        case "c":
          h.cycleCaptions();
          break;
        default:
          if (/^[0-9]$/.test(e.key)) h.seekToFraction(parseInt(e.key, 10) / 10);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
