/**
 * ANIME BGC — footer with wordmark, nav links, social icons and disclaimer.
 */
import { Link } from "wouter";
import { toast } from "sonner";
import { LOGO } from "@/lib/animeData";

const columns = [
  {
    title: "Browse",
    links: [
      { label: "Home", href: "/" },
      { label: "Trending", href: "/trending" },
      { label: "Schedule", href: "/schedule" },
      { label: "Watchlist", href: "/watchlist" },
    ],
  },
  {
    title: "Genres",
    links: [
      { label: "Action", href: "/search" },
      { label: "Fantasy", href: "/search" },
      { label: "Romance", href: "/search" },
      { label: "Sci-Fi", href: "/search" },
    ],
  },
];

function SocialDot({ label }: { label: string }) {
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

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-[#08080a]">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <img src={LOGO} alt="Anime BGC" className="h-8 w-8" />
            <span className="font-display text-xl font-extrabold tracking-tight">
              ANIME<span className="text-primary">BGC</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Your home for subbed and dubbed anime in HD. Track what's airing,
            build your watchlist, and never miss a new episode.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <SocialDot label="Discord" />
            <SocialDot label="Reddit" />
            <SocialDot label="X" />
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/90">
              {col.title}
            </h3>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/90">
            About
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Anime BGC is a free anime streaming platform. Watch subbed and
            dubbed episodes in HD, track your progress, and never miss a
            new release.
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Anime BGC. All rights reserved.</p>
          <p>Stream anime in HD — free, fast, and always updating.</p>
        </div>
      </div>
    </footer>
  );
}
