/**
 * Intro animation gating — decides whether the BGC brand intro should play.
 *
 * Configurable via INTRO_CONFIG.frequency:
 *   "session" → once per browser session (default)
 *   "once"    → once ever (localStorage)
 *   "always"  → every full page load
 *   "off"     → never
 * Append ?intro=1 to the URL to force a replay (demo/testing).
 * Users with prefers-reduced-motion never see the intro.
 */

export const INTRO_CONFIG = {
  frequency: "session" as "session" | "once" | "always" | "off",
  durationMs: 7200, // total intro length (6–8s window)
};

const SESSION_KEY = "anime-bgc:intro:session";
const ONCE_KEY = "anime-bgc:intro:seen";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function forcedByUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("intro") === "1";
  } catch {
    return false;
  }
}

export function shouldShowIntro(): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;
  if (forcedByUrl()) return true;
  switch (INTRO_CONFIG.frequency) {
    case "off":
      return false;
    case "always":
      return true;
    case "once":
      try {
        return !localStorage.getItem(ONCE_KEY);
      } catch {
        return true;
      }
    case "session":
    default:
      try {
        return !sessionStorage.getItem(SESSION_KEY);
      } catch {
        return true;
      }
  }
}

export function markIntroShown() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(ONCE_KEY, "1");
  } catch {
    /* ignore */
  }
}
