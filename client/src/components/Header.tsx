/**
 * ANIME BGC — sticky blurred navbar.
 * Style ref: miruro.tv — hamburger + wordmark (left), large pill search (center),
 * icon cluster (right). Near-black translucent surface with subtle border.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Search, Shuffle, Bell, X } from "lucide-react";
import { toast } from "sonner";
import { LOGO, featured } from "@/lib/animeData";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Trending", href: "/trending" },
  { label: "Schedule", href: "/schedule" },
  { label: "Watchlist", href: "/watchlist" },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <img src={LOGO} alt="Anime BGC" className="h-8 w-8" />
      <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
        ANIME<span className="text-primary">BGC</span>
      </span>
    </Link>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [, navigate] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const soon = (label: string) =>
    toast(`${label} — coming soon`, {
      description: "Backend & API are on the way.",
    });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const shuffle = async () => {
    try {
      const page = Math.floor(Math.random() * 5) + 1;
      const res = await api.trending(page, 24);
      const pool = res.results.length ? res.results : featured;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      navigate(`/watch/${pick.id}`);
    } catch {
      const pick = featured[Math.floor(Math.random() * featured.length)];
      navigate(`/watch/${pick.id}`);
    }
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-border bg-[#0a0a0c]/85 backdrop-blur-xl"
          : "bg-gradient-to-b from-black/70 to-transparent",
      )}
    >
      <div className="container flex h-16 items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-lg text-foreground/80 transition-colors hover:bg-white/10 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Wordmark />

        {/* center search */}
        <form
          onSubmit={onSearch}
          className="relative ml-2 hidden flex-1 items-center md:flex lg:mx-6"
        >
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search anime, studios, genres…"
            className="h-10 w-full rounded-full border border-border bg-white/5 pl-10 pr-16 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-primary/25"
          />
          <kbd className="absolute right-3 hidden items-center gap-0.5 rounded-md border border-border bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:flex">
            ⌘K
          </kbd>
        </form>

        {/* desktop nav */}
        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-white/8 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* icon cluster */}
        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <button
            onClick={() => navigate("/search")}
            className="grid h-9 w-9 place-items-center rounded-lg text-foreground/80 transition-colors hover:bg-white/10 md:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            onClick={shuffle}
            className="grid h-9 w-9 place-items-center rounded-lg text-foreground/80 transition-colors hover:bg-white/10 hover:text-primary"
            aria-label="Random anime"
          >
            <Shuffle className="h-5 w-5" />
          </button>
          <button
            onClick={() => soon("Notifications")}
            className="grid h-9 w-9 place-items-center rounded-lg text-foreground/80 transition-colors hover:bg-white/10"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            onClick={() => soon("Profile")}
            className="ml-1 h-9 w-9 overflow-hidden rounded-full ring-2 ring-primary/40 transition-all hover:ring-primary"
            aria-label="Profile"
          >
            <span className="grid h-full w-full place-items-center bg-gradient-to-br from-primary to-[#7d6cff] text-sm font-bold text-primary-foreground">
              B
            </span>
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] animate-fade-up border-r border-border bg-[#0d0d10] p-5">
            <div className="flex items-center justify-between">
              <Wordmark />
              <button
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-8 flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-foreground/80 transition-colors hover:bg-white/8 hover:text-primary"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
