/**
 * Local watchlist persistence (no backend account system yet).
 * Stores a compact list of anime cards in localStorage so the Watchlist page
 * and the "add to list" button on the Watch page share state.
 */
import { useCallback, useEffect, useState } from "react";
import type { Anime } from "@shared/anime";

const KEY = "anime-bgc:watchlist";

function read(): Anime[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Anime[]) : [];
  } catch {
    return [];
  }
}

function write(list: Anime[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("watchlist-change"));
  } catch {
    /* ignore quota errors */
  }
}

export function useWatchlist() {
  const [list, setList] = useState<Anime[]>([]);

  useEffect(() => {
    setList(read());
    const onChange = () => setList(read());
    window.addEventListener("watchlist-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("watchlist-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const has = useCallback((id: number) => list.some((a) => a.id === id), [list]);

  const toggle = useCallback(
    (anime: Anime) => {
      const current = read();
      const exists = current.some((a) => a.id === anime.id);
      const next = exists
        ? current.filter((a) => a.id !== anime.id)
        : [{ ...anime }, ...current];
      write(next);
      setList(next);
      return !exists;
    },
    [],
  );

  return { list, has, toggle };
}
