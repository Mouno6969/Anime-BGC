/**
 * Commenter display names — localStorage only, editable from the profile card.
 * Default is derived from the guest id so everyone gets a stable, unique-ish
 * name without an account.
 */
const KEY = "bgc:profile-name";

const ADJ = [
  "Shadow", "Crimson", "Silent", "Cosmic", "Neon", "Golden", "Frozen",
  "Scarlet", "Midnight", "Thunder", "Lunar", "Solar", "Mystic", "Rapid",
  "Azure", "Obsidian",
];
const NOUN = [
  "Otaku", "Ronin", "Senpai", "Samurai", "Ninja", "Kitsune", "Titan",
  "Dragon", "Phoenix", "Reaper", "Wanderer", "Shinobi", "Voyager", "Hunter",
  "Sensei", "Oni",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function defaultProfileName(guestId: string): string {
  const h = hash(guestId);
  const name = `${ADJ[h % ADJ.length]}${NOUN[Math.floor(h / ADJ.length) % NOUN.length]}`;
  return `${name}${(h % 97) + 2}`;
}

export function getProfileName(guestId?: string): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && saved.trim()) return saved.trim().slice(0, 24);
  } catch {
    /* ignore */
  }
  return guestId ? defaultProfileName(guestId) : "Guest";
}

export function setProfileName(name: string): string {
  const cleaned = name.replace(/[<>]/g, "").trim().slice(0, 24);
  try {
    if (cleaned) localStorage.setItem(KEY, cleaned);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return cleaned;
}