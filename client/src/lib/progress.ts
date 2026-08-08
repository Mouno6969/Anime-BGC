/**
 * Watch-progress storage (localStorage) — powers resume playback and,
 * later, the Continue Watching row. Keyed by `animeId:episodeNumber`.
 */

const STORAGE_KEY = "anime-bgc:progress:v1";
const MIN_RESUME_SECONDS = 30; // ignore positions < 30s (basically unwatched)
const FINISHED_RATIO = 0.95; // >= 95% watched counts as finished

export interface ProgressEntry {
  t: number; // seconds watched
  d: number; // duration seconds
  updatedAt: number;
  title?: string; // anime title (for history cards)
  poster?: string; // anime poster URL (for history cards)
}

type ProgressMap = Record<string, ProgressEntry>;

function read(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as ProgressMap;
  } catch {
    return {};
  }
}

function write(map: ProgressMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage full/blocked — non-fatal */
  }
}

export function progressKey(animeId: number, episodeNumber: number): string {
  return `${animeId}:${episodeNumber}`;
}

/** Save (or clear, when finished/barely started) the watch position. */
export function saveProgress(
  animeId: number,
  episodeNumber: number,
  t: number,
  d: number,
  meta?: { title?: string; poster?: string },
) {
  if (!animeId || !Number.isFinite(t) || !Number.isFinite(d) || d <= 0) return;
  const map = read();
  const key = progressKey(animeId, episodeNumber);
  if (t >= MIN_RESUME_SECONDS && t / d < FINISHED_RATIO) {
    const prev = map[key];
    map[key] = {
      t,
      d,
      updatedAt: Date.now(),
      title: meta?.title ?? prev?.title,
      poster: meta?.poster ?? prev?.poster,
    };
  } else {
    delete map[key];
  }
  write(map);
}

/** Returns a resumable position or null when nothing worth resuming. */
export function getProgress(animeId: number, episodeNumber: number): ProgressEntry | null {
  if (!animeId) return null;
  const entry = read()[progressKey(animeId, episodeNumber)];
  if (!entry) return null;
  if (entry.t < MIN_RESUME_SECONDS || entry.t / entry.d >= FINISHED_RATIO) return null;
  return entry;
}

export function clearProgress(animeId: number, episodeNumber: number) {
  const map = read();
  delete map[progressKey(animeId, episodeNumber)];
  write(map);
}

export interface HistoryItem extends ProgressEntry {
  animeId: number;
  episodeNumber: number;
}

/**
 * In-progress entries for the History page: one card per anime (its most
 * recently touched episode), most recent first. Finished/barely-started
 * entries are never stored, so everything here is resumable.
 */
export function listHistory(limit = 30): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const [key, entry] of Object.entries(read())) {
    const [aid, ep] = key.split(":");
    const animeId = Number(aid);
    const episodeNumber = Number(ep);
    if (!animeId || !episodeNumber) continue;
    if (entry.t < MIN_RESUME_SECONDS || entry.t / entry.d >= FINISHED_RATIO) continue;
    items.push({ animeId, episodeNumber, ...entry });
  }
  items.sort((a, b) => b.updatedAt - a.updatedAt);
  const seen = new Set<number>();
  const deduped: HistoryItem[] = [];
  for (const item of items) {
    if (seen.has(item.animeId)) continue;
    seen.add(item.animeId);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

/** Wipe the whole watch history. */
export function clearHistory() {
  write({});
}
