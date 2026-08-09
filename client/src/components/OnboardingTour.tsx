/**
 * New-user onboarding tour — progressive, skippable, resumable, versioned.
 * Shows once (per TOUR_VERSION) after the intro; completed users never see
 * it again. Bottom-sheet on mobile, centered card on desktop.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import {
  TOUR_STEPS,
  finishOnboarding,
  getOnboarding,
  setOnboardingStep,
  startOnboarding,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export default function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Never interrupt the admin panel with the user tour.
    if (window.location.pathname.startsWith("/admin")) return;
    const state = getOnboarding();
    if (state?.status === "in-progress") {
      setStep(state.step);
      setVisible(true);
      return;
    }
    if (!state) {
      // brand-new visitor: start after the intro has had its moment
      const t = setTimeout(() => {
        startOnboarding();
        setStep(0);
        setVisible(true);
      }, 900);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(TOUR_STEPS.length - 1, next));
    setStep(clamped);
    setOnboardingStep(clamped);
  };

  const close = (status: "completed" | "skipped") => {
    finishOnboarding(status);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Getting started tour"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={() => close("skipped")}
    >
      <div
        className="w-full max-w-md animate-fade-up rounded-t-3xl border border-border/70 bg-[#0c0c0f] p-6 shadow-2xl shadow-black/70 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {step + 1} of {TOUR_STEPS.length}
          </p>
          <button
            type="button"
            aria-label="Skip tour"
            onClick={() => close("skipped")}
            className="ml-auto rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-4 font-display text-xl font-extrabold tracking-tight text-foreground">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>

        {/* progress dots */}
        <div className="mt-5 flex gap-1.5">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all",
                i === step ? "w-6 bg-primary" : i < step ? "w-2.5 bg-primary/50" : "w-2.5 bg-muted",
              )}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-4 py-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          <button
            type="button"
            onClick={() => close("skipped")}
            className="rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground/80 transition hover:text-foreground"
          >
            {isFirst ? "Maybe later" : "Skip"}
          </button>
          <button
            type="button"
            onClick={() => (isLast ? close("completed") : go(step + 1))}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110"
          >
            {current.cta ?? (isLast ? "Done" : "Next")}
            {!isLast && !current.cta && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}