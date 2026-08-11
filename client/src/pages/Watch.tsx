/**
 * ANIME BGC — Watch / detail page (live).
 * Loads anime info (AniList) + episode list (Miruro), lets the viewer pick an
 * episode, provider and sub/dub, fetches streaming sources on demand (with
 * automatic provider fallback), and plays them via the HLS VideoPlayer.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Play, Star, Tv, Clock, Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VideoPlayer from "@/components/VideoPlayer";
import Comments from "@/components/Comments";
import { ErrorState } from "@/components/Skeletons";
import { api, useAsync } from "@/lib/api";
import { useWatchlist } from "@/lib/watchlist";
import type { Episode, ProviderEpisodes, SourcesResult } from "@shared/anime";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Watch() {
  const [, params] = useRoute("/watch/:id");
  const id = Number(params?.id);

  const { data: anime, loading: infoLoading, error: infoError } = useAsync(
    (signal) => api.info(id, signal),
    [id],
  );
  const { data: eps, loading: epsLoading } = useAsync(
    (signal) => api.episodes(id, signal),
    [id],
  );

  const [category, setCategory] = useState<"sub" | "dub">("sub");
  const [provider, setProvider] = useState<string>("auto");
  // Deep-link support: /watch/:id?ep=N opens episode N directly (used by the
  // History page's continue-watching cards). Falls back to episode 1.
  const [epNumber, setEpNumber] = useState<number | null>(() => {
    try {
      const ep = Number(new URLSearchParams(window.location.search).get("ep"));
      return Number.isFinite(ep) && ep > 0 ? ep : null;
    } catch {
      return null;
    }
  });
  const [sources, setSources] = useState<SourcesResult | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  // Failover state, keyed by episode so it resets on episode/category change.
  const [failState, setFailState] = useState<{ key: string; excluded: string[]; count: number }>({
    key: "",
    excluded: [],
    count: 0,
  });
  const activeProviderRef = useRef("");
  activeProviderRef.current = activeProvider;

  const { has, toggle } = useWatchlist();
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);

  // Continuously track the user's scroll position. The browser scrolls to
  // reveal a tapped episode button BEFORE the pointer/click handlers fire, so
  // by the time we can react, window.scrollY is already wrong. Tracking it
  // live gives us the true pre-tap position to restore.
  useEffect(() => {
    const track = () => {
      lastScrollYRef.current = window.scrollY;
    };
    track();
    window.addEventListener("scroll", track, { passive: true });
    return () => window.removeEventListener("scroll", track);
  }, []);
  const scrollLockRef = useRef<{ y: number; until: number } | null>(null);

  // Pin the viewport while a new episode source is fetched. Chrome's native
  // scroll anchoring otherwise drags the page down into the comments when the
  // player remounts mid-fetch (no programmatic scroll call is involved, so it
  // cannot be intercepted — we pin scrollY directly instead).
  const lockScrollFor = (ms: number) => {
    scrollLockRef.current = { y: window.scrollY, until: Date.now() + ms };
    const pin = () => {
      const lock = scrollLockRef.current;
      if (!lock || Date.now() > lock.until) {
        scrollLockRef.current = null;
        return;
      }
      if (Math.abs(window.scrollY - lock.y) > 6) window.scrollTo(0, lock.y);
      requestAnimationFrame(pin);
    };
    requestAnimationFrame(pin);
  };

  const providerData: ProviderEpisodes | undefined = useMemo(
    () =>
      eps?.byProvider.find(
        (p) => p.provider === (provider === "auto" ? eps.provider : provider),
      ),
    [eps, provider],
  );

  const hasDub = (providerData?.dub.length ?? 0) > 0;

  // Display servers as "BGC 1", "BGC 2", ... while the real provider ids
  // keep being used internally for API calls.
  const serverLabel = (p: string) => {
    const i = eps?.providers.indexOf(p) ?? -1;
    return i >= 0 ? `BGC ${i + 1}` : p;
  };

  const episodeList: Episode[] = useMemo(() => {
    if (!providerData) return [];
    return category === "dub" && providerData.dub.length ? providerData.dub : providerData.sub;
  }, [providerData, category]);

  const selected: Episode | null = useMemo(
    () => episodeList.find((e) => e.number === epNumber) ?? episodeList[0] ?? null,
    [episodeList, epNumber],
  );

  const nextEpisode: Episode | null = useMemo(() => {
    if (!selected) return null;
    const i = episodeList.findIndex((e) => e.number === selected.number);
    return i >= 0 ? (episodeList[i + 1] ?? null) : null;
  }, [episodeList, selected]);

  // default the selected episode number once the list loads
  useEffect(() => {
    if (episodeList.length && epNumber == null) setEpNumber(episodeList[0].number);
  }, [episodeList, epNumber]);

  // Freeze the player wrapper's height while a new stream loads. When the
  // player unmounts to swap sources mid-fetch, the layout would otherwise
  // collapse and the browser's scroll anchoring drags the viewport down into
  // the comments section. Pinning the measured height keeps everything put.
  useEffect(() => {
    const el = playerWrapRef.current;
    if (!el) return;
    if (sourceLoading) {
      el.style.height = `${el.getBoundingClientRect().height}px`;
      el.style.overflow = "hidden";
    } else {
      el.style.height = "";
      el.style.overflow = "";
    }
  }, [sourceLoading]);

  // reset to sub if the current provider has no dub
  useEffect(() => {
    if (category === "dub" && !hasDub) setCategory("sub");
  }, [category, hasDub]);

  // Fetch sources for the selected episode, with provider fallback.
  useEffect(() => {
    if (!selected || !eps || !provider) {
      setSources(null);
      return;
    }
    const controller = new AbortController();
    setSourceLoading(true);
    setSourceError(null);
    setSources(null);
    setActiveProvider("");

    const num0 = selected.number;
    const failKey = `${id}:${num0}:${category}`;
    const excluded = failState.key === failKey ? failState.excluded : [];

    // Try providers one at a time; resolves true when one yields streams.
    const tryInOrder = async (order: string[]): Promise<boolean> => {
      for (const prov of order) {
        const pd = eps.byProvider.find((p) => p.provider === prov);
        if (!pd) continue;
        const list = category === "dub" && pd.dub.length ? pd.dub : pd.sub;
        const match = list.find((e) => e.number === num0);
        if (!match) continue;
        try {
          const res = await api.sources(match.id, prov, id, category, controller.signal);
          if (res.streams.length > 0) {
            if (controller.signal.aborted) return true;
            setSources(res);
            setActiveProvider(prov);
            setSourceLoading(false);
            return true;
          }
        } catch {
          if (controller.signal.aborted) return true;
          // try the next provider
        }
      }
      return false;
    };

    const showError = () => {
      if (controller.signal.aborted) return;
      setSourceError("No playable source found for this episode across providers.");
      setSourceLoading(false);
    };

    // Auto mode: race every provider in parallel — first valid stream wins,
    // losers are aborted server-side automatically. If the race itself fails
    // for any reason, fall back to sequential probing so Auto still works
    // whenever ANY single server would have.
    if (provider === "auto") {
      api
        .raceSources(id, num0, category, excluded, controller.signal)
        .then((res) => {
          if (controller.signal.aborted) return;
          setSources(res);
          setActiveProvider(res.provider);
          setSourceLoading(false);
        })
        .catch(async () => {
          if (controller.signal.aborted) return;
          const order = eps.providers.filter((p) => !excluded.includes(p));
          if (!(await tryInOrder(order))) showError();
        });
      return () => controller.abort();
    }

    const order = [provider, ...eps.providers.filter((p) => p !== provider)];
    void (async () => {
      if (!(await tryInOrder(order))) showError();
    })();

    return () => controller.abort();
  }, [selected, eps, provider, category, id, failState]);

  // Mid-playback failover: the player reports a fatal stream error -> re-race
  // without the failed provider; playback resumes from the saved position.
  const handleFatalError = () => {
    if (provider !== "auto" || !selected) return;
    const failed = activeProviderRef.current;
    if (!failed) return;
    const key = `${id}:${selected.number}:${category}`;
    const cur = failState.key === key ? failState : { key, excluded: [], count: 0 };
    if (cur.count >= 2 || cur.excluded.includes(failed)) return; // loop guard
    setFailState({ key, excluded: [...cur.excluded, failed], count: cur.count + 1 });
  };

  // prefer an HLS stream when present, else the first available
  const bestSource = useMemo(() => {
    if (!sources?.streams?.length) return null;
    return sources.streams.find((s) => s.type === "hls" || s.url.includes(".m3u8")) ?? sources.streams[0];
  }, [sources]);

  const saved = anime ? has(anime.id) : false;

  if (infoError) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pt-28">
          <div className="container">
            <ErrorState message={infoError} />
            <div className="mt-6 text-center">
              <Link href="/" className="text-sm font-semibold text-primary hover:underline">
                ← Back to home
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* banner */}
        <section className="relative h-[52vh] min-h-[380px] w-full overflow-hidden">
          {anime ? (
            <img src={anime.banner} alt={anime.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full animate-pulse bg-card/60" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/55 to-[#0a0a0c]/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c]/85 to-transparent" />

          <div className="container relative z-10 flex h-full flex-col justify-end pb-10">
            <Link
              href="/"
              className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-black/40 px-3 py-1.5 text-sm text-white/85 backdrop-blur-md transition-colors hover:border-primary/40 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              {anime?.title ?? (infoLoading ? "Loading…" : "Unknown title")}
            </h1>
            {anime && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/80">
                <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold">
                  <Tv className="h-3.5 w-3.5" /> {anime.type}
                </span>
                {/* Episode count promoted to a lavender badge so it stays easy to
                    spot even next to the watchlist control on small screens. */}
                <span className="flex items-center gap-1.5 rounded-md bg-primary/20 px-2 py-1 text-xs font-bold text-primary">
                  <Play className="h-3.5 w-3.5 fill-current" /> {anime.episodes} eps
                </span>
                {anime.score > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Star className="h-3.5 w-3.5 fill-amber-300" /> {(anime.score / 10).toFixed(1)}
                  </span>
                )}
                <span className="hidden items-center gap-1.5 sm:flex">
                  <Clock className="h-3.5 w-3.5" /> {anime.duration}
                </span>
                {anime.year > 0 && <span className="hidden sm:inline">{anime.year}</span>}
                {/* Compact icon-first bookmark: full label on sm+ screens, short
                    "Save"/"Saved" on mobile so the row never crowds. */}
                <button
                  onClick={() => {
                    if (!anime) return;
                    const added = toggle(anime);
                    toast(added ? "Added to Watchlist" : "Removed from Watchlist", {
                      description: anime.title,
                    });
                  }}
                  aria-label={saved ? "Remove from Watchlist" : "Add to Watchlist"}
                  className={cn(
                    "ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur-md transition-all active:scale-95 sm:ml-1",
                    saved
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "border-primary/60 bg-black/50 text-primary hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                  <span className="hidden sm:inline">{saved ? "In Watchlist" : "Add to Watchlist"}</span>
                  <span className="sm:hidden">{saved ? "Saved" : "Save"}</span>
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="container grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {/* player — wrapper ref lets us hold the user's scroll position
                steady while a new episode's stream is being fetched */}
            <div ref={playerWrapRef} className="min-h-[56.25vw] sm:min-h-[400px] lg:min-h-[480px]">
            {sourceError ? (
              <ErrorState message={sourceError} />
            ) : bestSource ? (
              <VideoPlayer
                source={bestSource}
                subtitles={sources?.subtitles ?? []}
                poster={anime?.banner}
                animeId={id}
                episodeNumber={selected?.number ?? 1}
                animeTitle={anime?.title}
                animePoster={anime?.poster}
                nextEpisode={nextEpisode ? { number: nextEpisode.number, title: nextEpisode.title } : null}
                onNextEpisode={nextEpisode ? () => setEpNumber(nextEpisode.number) : undefined}
                onFatalError={handleFatalError}
                providerLabel={activeProvider ? serverLabel(activeProvider) : undefined}
                hasAltServers={(eps?.providers.length ?? 0) > 1}
                onChangeServer={() => setProvider("auto")}
              />
            ) : (
              <div className="grid aspect-video w-full place-items-center rounded-2xl border border-border bg-card/60">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">
                    Fetching stream…
                  </p>
                </div>
              </div>
            )}
            </div>

            {/* now playing + controls */}
            {selected && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-lg font-bold">
                  Episode {selected.number}
                  {selected.title ? (
                    <span className="text-muted-foreground"> — {selected.title}</span>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {hasDub && (
                    <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1">
                      {(["sub", "dub"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => setCategory(c)}
                          className={cn(
                            "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all",
                            category === c
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  {eps && eps.providers.length > 1 && (
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/80 outline-none transition-colors hover:border-primary/40"
                      aria-label="Streaming server"
                    >
                      <option value="auto" className="bg-[#0d0d10]">
                        Auto
                      </option>
                      {eps.providers.map((p) => (
                        <option key={p} value={p} className="bg-[#0d0d10]">
                          {serverLabel(p)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {provider === "auto" && activeProvider && (
              <p className="mt-2 text-xs text-muted-foreground">
                Auto picked <span className="font-semibold text-primary">{serverLabel(activeProvider)}</span>
                {failState.excluded.length > 0 &&
                  failState.key === `${id}:${selected?.number}:${category}` &&
                  ` after ${failState.excluded.map(serverLabel).join(", ")} failed`}
                .
              </p>
            )}
            {provider !== "auto" && activeProvider && activeProvider !== provider && (
              <p className="mt-2 text-xs text-muted-foreground">
                Server “{serverLabel(provider)}” was unavailable — now playing from “
                {serverLabel(activeProvider)}”.
              </p>
            )}

            <h2 className="mt-8 font-display text-xl font-bold">Synopsis</h2>
            <p className="mt-2 max-w-3xl whitespace-pre-line leading-relaxed text-muted-foreground">
              {anime?.synopsis || "Synopsis unavailable."}
            </p>

            {anime?.genres?.length ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {anime.genres.map((g) => (
                  <Link
                    key={g}
                    href={`/search?q=${encodeURIComponent(g)}`}
                    className="rounded-full border border-border bg-white/[0.04] px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            ) : null}

            {selected && (
              <Comments contentKey={`${id}:${selected.number}`} />
            )}
          </div>

          {/* episodes list */}
          <aside className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Episodes</h3>
              {eps?.provider && (
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {episodeList.length} eps
                </span>
              )}
            </div>

            {epsLoading ? (
              <div className="grid grid-cols-5 gap-2 lg:grid-cols-4">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className="h-10 animate-pulse rounded-lg bg-card/60" />
                ))}
              </div>
            ) : episodeList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No streamable episodes found for this title yet.
              </p>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-5 gap-2 lg:grid-cols-4">
                  {episodeList.map((ep) => (
                    <button
                      key={`${ep.id}-${ep.number}`}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setEpNumber(ep.number);
                        // The browser scrolled the window to reveal this button
                        // BEFORE our handlers fired — snap back to the tracked
                        // pre-tap position and hold it while the browser retries.
                        const y = lastScrollYRef.current;
                        const until = Date.now() + 2600;
                        const snap = () => {
                          if (Date.now() <= until && Math.abs(window.scrollY - y) > 4) {
                            window.scrollTo(0, y);
                          }
                        };
                        window.addEventListener("scroll", snap, { passive: true });
                        setTimeout(() => window.removeEventListener("scroll", snap), 2700);
                        snap();
                      }}
                      title={ep.title || `Episode ${ep.number}`}
                      className={cn(
                        "grid h-10 place-items-center rounded-lg border text-sm font-medium transition-colors",
                        selected?.number === ep.number
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border bg-card/60 text-foreground/70 hover:border-primary/40 hover:text-primary",
                      )}
                    >
                      {ep.number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
