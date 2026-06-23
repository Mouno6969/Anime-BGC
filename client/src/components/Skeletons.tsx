/**
 * ANIME BGC — shared loading / error / empty states for live data.
 * Keeps the dark theme + lavender accent consistent across pages.
 */
import { AlertTriangle } from "lucide-react";

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="aspect-[2/3] w-full animate-pulse rounded-xl border border-border bg-card/70" />
      <div className="mt-2 h-3.5 w-3/4 animate-pulse rounded bg-card/70" />
    </div>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="no-scrollbar flex gap-4 overflow-hidden pb-2">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton
          key={i}
          className="w-[44vw] shrink-0 sm:w-[28vw] md:w-[22vw] lg:w-[15.5%]"
        />
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={
        "grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center " +
        className
      }
    >
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <p className="mt-3 font-display text-base font-bold">Couldn’t load content</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {message || "The data source is unavailable right now. Please try again shortly."}
      </p>
    </div>
  );
}
