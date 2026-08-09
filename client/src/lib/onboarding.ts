/**
 * New-user onboarding state — localStorage, versioned.
 * Completed users never see the tour again until TOUR_VERSION bumps.
 */

export const TOUR_VERSION = 1;
const KEY = "bgc:onboarding";

export interface OnboardingState {
  version: number;
  step: number;
  status: "in-progress" | "completed" | "skipped";
  startedAt: number;
  completedAt: number | null;
}

export interface TourStep {
  title: string;
  body: string;
  cta?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to AnimeBGC",
    body: "Your place to discover, watch, and keep track of the anime you love.",
    cta: "Show me around",
  },
  {
    title: "Discover what's worth watching",
    body: "Explore trending titles, new releases, genres, and your personalized watch options from one place.",
  },
  {
    title: "Choose how you watch",
    body: "Switch between available subtitle and dubbed audio options whenever they're available.",
  },
  {
    title: "Let AnimeBGC find a working source",
    body: "Auto mode races the available servers and plays the first one that responds — and auto-switches if a stream fails.",
  },
  {
    title: "Pick up where you left off",
    body: "Your watch history helps you return to unfinished episodes without searching again.",
  },
  {
    title: "Keep your favorites close",
    body: "Save anime you want to watch later and keep your personal watchlist organized.",
  },
  {
    title: "Stay updated",
    body: "Get useful updates about features and helpful playback information from the notification bell.",
  },
  {
    title: "Join the discussion",
    body: "Share your thoughts and join the conversation around episodes.",
  },
  {
    title: "You're ready.",
    body: "That's the quick tour. You can always find help and updates from your notifications.",
    cta: "Start watching",
  },
];

export function getOnboarding(): OnboardingState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as OnboardingState;
    return s.version === TOUR_VERSION ? s : null;
  } catch {
    return null;
  }
}

export function startOnboarding(): OnboardingState {
  const s: OnboardingState = {
    version: TOUR_VERSION,
    step: 0,
    status: "in-progress",
    startedAt: Date.now(),
    completedAt: null,
  };
  save(s);
  return s;
}

export function setOnboardingStep(step: number) {
  const s = getOnboarding();
  if (s) save({ ...s, step });
}

export function finishOnboarding(status: "completed" | "skipped") {
  const s = getOnboarding();
  save({
    version: TOUR_VERSION,
    step: s?.step ?? 0,
    status,
    startedAt: s?.startedAt ?? Date.now(),
    completedAt: Date.now(),
  });
}

function save(s: OnboardingState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}