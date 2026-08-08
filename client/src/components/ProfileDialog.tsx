/**
 * ANIME BGC — profile popover. Shows the guest's deterministic avatar large,
 * quick stats (watchlist/history counts) and shortcuts. Account-based avatar
 * customization is intentionally deferred until authentication exists.
 */
import { Link } from "wouter";
import { X, Bookmark, History, Sparkles } from "lucide-react";
import { useWatchlist } from "@/lib/watchlist";
import { listHistory } from "@/lib/progress";

export default function ProfileDialog({
  open,
  onClose,
  avatarUrl,
}: {
  open: boolean;
  onClose: () => void;
  avatarUrl: string;
}) {
  const { list } = useWatchlist();
  if (!open) return null;
  const historyCount = listHistory().length;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-24 sm:items-center sm:pt-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Profile"
        className="relative w-full max-w-xs animate-fade-up rounded-2xl border border-border bg-[#0d0d10] p-6 text-center shadow-2xl shadow-black/60"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-foreground/70 transition-colors hover:bg-white/10"
          aria-label="Close profile"
        >
          <X className="h-4 w-4" />
        </button>

        {/* large avatar with subtle brand glow */}
        <div className="avatar-glow mx-auto h-28 w-28 overflow-hidden rounded-full ring-4 ring-primary/30">
          <img src={avatarUrl} alt="Your avatar" className="h-full w-full" />
        </div>

        <h2 className="mt-4 font-display text-xl font-bold">Guest</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          You're using a default avatar.
        </p>
        <p className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Accounts &amp; avatar customization are coming soon.
        </p>

        {/* quick stats */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/watchlist"
            onClick={onClose}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/40 px-3 py-3 transition-colors hover:border-primary/40"
          >
            <Bookmark className="h-4 w-4 text-primary" />
            <span className="text-lg font-bold leading-none">{list.length}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Watchlist</span>
          </Link>
          <Link
            href="/history"
            onClick={onClose}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/40 px-3 py-3 transition-colors hover:border-primary/40"
          >
            <History className="h-4 w-4 text-primary" />
            <span className="text-lg font-bold leading-none">{historyCount}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">In progress</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
