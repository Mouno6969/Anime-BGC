/**
 * ANIME BGC — small "Love the Site?" promo strip with social icons.
 * Style ref: miruro.tv promo card above the grid.
 */
import { toast } from "sonner";
import { Heart } from "lucide-react";

function Pill({ label }: { label: string }) {
  return (
    <button
      onClick={() => toast(`${label} — coming soon`)}
      className="grid h-9 w-9 place-items-center rounded-full border border-border bg-white/[0.04] text-xs font-bold text-foreground/70 transition-colors hover:border-primary/50 hover:text-primary"
      aria-label={label}
    >
      {label[0]}
    </button>
  );
}

export default function PromoStrip() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-gradient-to-r from-primary/12 via-card/60 to-card/60 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/20 text-primary">
          <Heart className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold leading-tight">Love the site?</p>
          <p className="text-sm text-muted-foreground">Join the community and share it with your friends.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Pill label="Discord" />
        <Pill label="Reddit" />
        <Pill label="X" />
      </div>
    </div>
  );
}
