/**
 * Deterministic anime-inspired avatar generator (avatar-v1).
 *
 * Every visitor gets a stable guest id (localStorage); the avatar is derived
 * from hash(guestId + version) with a seeded PRNG, so the same user always
 * gets the same avatar — never re-generated on refresh. Output is a layered
 * original SVG (background → clothing → face → eyes → mouth → hair →
 * accessory), tiny in size and crisp at any size from 40px navbar to 256px.
 * All artwork is original and procedural — no copyrighted characters.
 */

const VERSION = "avatar-v1";
const GUEST_KEY = "anime-bgc:guest-id:v1";

/* ---------------------------------- seed --------------------------------- */

export function getGuestId(): string {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return "guest-fallback";
  }
}

/** cyrb53 — small, fast, good-enough distribution for visual derivation. */
function hashSeed(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) * 4294967296 + (h1 >>> 0);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------- palettes -------------------------------- */

const BG_PAIRS = [
  ["#2a2140", "#171226"], ["#1f1b33", "#141021"], ["#33245c", "#1a1030"],
  ["#3b2a4a", "#191324"], ["#25304d", "#12172a"], ["#40232e", "#1d1017"],
  ["#1e3038", "#0f1a20"], ["#2c2350", "#120e22"],
];
const SKIN = ["#f6d7c3", "#efc9ae", "#e2b390", "#c98f6b", "#a06a48", "#7d4f33"];
const HAIR = ["#2b2733", "#4a3b2f", "#8a8fa3", "#b5a8ff", "#7d6cff", "#7e3b4d", "#2f6f6a", "#c9a86a", "#5a4a7a", "#38405f"];
const EYES = ["#5b4b8a", "#3a6ea5", "#3f7a5a", "#8a5a3a", "#9c8cf0", "#444a5a"];
const CLOTH = ["#3a3350", "#4a3b6b", "#2e3a55", "#573a4a", "#33424a", "#46355e"];

const HAIR_STYLES = ["spiky", "sidesweep", "bob", "buns", "long", "curtain", "crop", "hood"] as const;
const EXPRESSIONS = ["calm", "happy", "confident", "curious", "sleepy", "serious", "playful"] as const;
const ACCESSORIES = ["none", "none", "glasses", "roundGlasses", "headphones"] as const;

/* --------------------------------- traits --------------------------------- */

interface Traits {
  bg: [string, string];
  bgDeco: number; // 0 none, 1 rings, 2 sparkles, 3 beams
  skin: string;
  hair: string;
  hairStyle: (typeof HAIR_STYLES)[number];
  eyeColor: string;
  expression: (typeof EXPRESSIONS)[number];
  cloth: string;
  accessory: (typeof ACCESSORIES)[number];
  blush: boolean;
}

export function deriveTraits(seedInput: string): Traits {
  const rnd = mulberry32(hashSeed(seedInput + VERSION));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
  return {
    bg: pick(BG_PAIRS) as [string, string],
    bgDeco: Math.floor(rnd() * 4),
    skin: pick(SKIN),
    hair: pick(HAIR),
    hairStyle: pick(HAIR_STYLES),
    eyeColor: pick(EYES),
    expression: pick(EXPRESSIONS),
    cloth: pick(CLOTH),
    accessory: pick(ACCESSORIES),
    blush: rnd() < 0.45,
  };
}

/* ------------------------------ svg builder ------------------------------- */

function eyeOpen(cx: number, cy: number, r: number, iris: string, squash = 1): string {
  const ry = r * squash;
  return (
    `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry}" fill="#ffffff"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="${iris}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="#171019"/>` +
    `<circle cx="${cx - r * 0.22}" cy="${cy - ry * 0.25}" r="${r * 0.16}" fill="#ffffff"/>`
  );
}

const eyeClosed = (cx: number, cy: number, r: number) =>
  `<path d="M${cx - r},${cy} Q${cx},${cy - r * 1.1} ${cx + r},${cy}" stroke="#241a20" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

function eyesFor(t: Traits): string {
  const y = 64;
  const L = 52;
  const R = 76;
  switch (t.expression) {
    case "happy":
      return eyeClosed(L, y + 1, 6) + eyeClosed(R, y + 1, 6);
    case "playful":
      return eyeOpen(L, y, 6, t.eyeColor) + eyeClosed(R, y + 1, 6);
    case "curious":
      return eyeOpen(L, y, 7, t.eyeColor) + eyeOpen(R, y, 7, t.eyeColor);
    case "confident":
      return eyeOpen(L, y, 6, t.eyeColor, 0.75) + eyeOpen(R, y, 6, t.eyeColor, 0.75);
    case "serious":
      return (
        eyeOpen(L, y + 1, 5.5, t.eyeColor, 0.55) +
        eyeOpen(R, y + 1, 5.5, t.eyeColor, 0.55) +
        `<path d="M45,53 L58,56" stroke="#241a20" stroke-width="2.2" stroke-linecap="round"/>` +
        `<path d="M83,53 L70,56" stroke="#241a20" stroke-width="2.2" stroke-linecap="round"/>`
      );
    case "sleepy":
      return (
        eyeOpen(L, y, 6, t.eyeColor, 0.5) +
        eyeOpen(R, y, 6, t.eyeColor, 0.5) +
        `<path d="M46,58 L58,58" stroke="#241a20" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M70,58 L82,58" stroke="#241a20" stroke-width="2" stroke-linecap="round"/>`
      );
    case "calm":
    default:
      return eyeOpen(L, y, 6, t.eyeColor, 0.9) + eyeOpen(R, y, 6, t.eyeColor, 0.9);
  }
}

function mouthFor(t: Traits): string {
  switch (t.expression) {
    case "happy":
      return `<path d="M56,84 Q64,94 72,84 Q64,88 56,84 Z" fill="#7c3a44"/>`;
    case "playful":
      return `<path d="M57,85 Q64,93 71,85" stroke="#7c3a44" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
             `<circle cx="64" cy="88.5" r="1.6" fill="#e88f9a"/>`;
    case "confident":
      return `<path d="M58,87 Q66,90 71,84" stroke="#7c3a44" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    case "curious":
      return `<circle cx="64" cy="87" r="2.6" fill="#7c3a44"/>`;
    case "serious":
    case "sleepy":
      return `<path d="M58,87 L70,87" stroke="#7c3a44" stroke-width="2.2" stroke-linecap="round"/>`;
    case "calm":
    default:
      return `<path d="M57,85 Q64,91 71,85" stroke="#7c3a44" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  }
}

function hairFor(t: Traits): string {
  const c = t.hair;
  switch (t.hairStyle) {
    case "spiky":
      return `<path d="M36,60 L39,34 L48,45 L54,25 L62,41 L70,23 L78,41 L87,29 L91,48 L93,60 Q80,42 64,42 Q48,42 36,60 Z" fill="${c}"/>`;
    case "sidesweep":
      return `<path d="M34,64 Q29,24 64,22 Q99,24 94,64 Q91,46 76,43 Q58,40 46,49 Q38,55 34,64 Z" fill="${c}"/>`;
    case "bob":
      return `<path d="M34,66 Q29,20 64,20 Q99,20 94,66 L89,82 Q89,52 81,45 Q64,38 47,45 Q39,52 39,82 Z" fill="${c}"/>`;
    case "buns":
      return `<circle cx="31" cy="37" r="11" fill="${c}"/><circle cx="97" cy="37" r="11" fill="${c}"/>` +
             `<path d="M36,60 Q34,24 64,23 Q94,24 92,60 Q82,42 64,42 Q46,42 36,60 Z" fill="${c}"/>`;
    case "long":
      return `<path d="M32,66 Q27,18 64,18 Q101,18 96,66 Q92,48 82,44 Q64,36 46,44 Q36,48 32,66 Z" fill="${c}"/>` +
             `<path d="M33,58 L28,116 L45,116 L43,62 Z" fill="${c}"/>` +
             `<path d="M95,58 L100,116 L83,116 L85,62 Z" fill="${c}"/>`;
    case "curtain":
      return `<path d="M35,60 Q32,22 64,22 Q96,22 93,60 Q87,40 72,37 L64,46 L56,37 Q41,40 35,60 Z" fill="${c}"/>`;
    case "crop":
      return `<path d="M36,58 Q33,25 64,24 Q95,25 92,58 Q80,41 64,41 Q48,41 36,58 Z" fill="${c}"/>`;
    case "hood":
    default:
      return ""; // hood drawn instead of hair
  }
}

function accessoryFor(t: Traits): string {
  switch (t.accessory) {
    case "glasses":
      return `<g stroke="#1d1826" stroke-width="2.4" fill="none">` +
        `<rect x="43" y="57" width="18" height="14" rx="4"/>` +
        `<rect x="67" y="57" width="18" height="14" rx="4"/>` +
        `<path d="M61,63 L67,63"/></g>`;
    case "roundGlasses":
      return `<g stroke="#1d1826" stroke-width="2.2" fill="none">` +
        `<circle cx="52" cy="64" r="8.5"/><circle cx="76" cy="64" r="8.5"/>` +
        `<path d="M60.5,64 L67.5,64"/></g>`;
    case "headphones":
      return `<path d="M28,66 Q26,20 64,18 Q102,20 100,66" stroke="#241f33" stroke-width="6" fill="none" stroke-linecap="round"/>` +
        `<rect x="24" y="58" width="11" height="22" rx="5" fill="#241f33"/>` +
        `<rect x="93" y="58" width="11" height="22" rx="5" fill="#241f33"/>`;
    default:
      return "";
  }
}

function bgDecoFor(t: Traits): string {
  if (t.bgDeco === 1) {
    return `<circle cx="64" cy="64" r="46" stroke="#ffffff" stroke-opacity="0.07" fill="none" stroke-width="1.5"/>` +
           `<circle cx="64" cy="64" r="56" stroke="#ffffff" stroke-opacity="0.05" fill="none" stroke-width="1"/>`;
  }
  if (t.bgDeco === 2) {
    return `<circle cx="26" cy="30" r="1.8" fill="#ffffff" fill-opacity="0.35"/>` +
           `<circle cx="102" cy="24" r="1.4" fill="#ffffff" fill-opacity="0.3"/>` +
           `<circle cx="108" cy="96" r="2" fill="#ffffff" fill-opacity="0.25"/>` +
           `<circle cx="20" cy="100" r="1.5" fill="#ffffff" fill-opacity="0.3"/>`;
  }
  if (t.bgDeco === 3) {
    return `<path d="M-10,40 L138,-10 L138,10 L-10,60 Z" fill="#ffffff" fill-opacity="0.04"/>` +
           `<path d="M-10,80 L138,30 L138,42 L-10,92 Z" fill="#ffffff" fill-opacity="0.03"/>`;
  }
  return "";
}

/** Build the master 128x128 SVG string for a seed. */
export function buildAvatarSvg(seedInput: string): string {
  const t = deriveTraits(seedInput);
  const hood = t.hairStyle === "hood";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${t.bg[0]}"/><stop offset="1" stop-color="${t.bg[1]}"/>` +
    `</linearGradient></defs>` +
    `<rect width="128" height="128" fill="url(#bg)"/>` +
    bgDecoFor(t) +
    (hood
      ? `<ellipse cx="64" cy="60" rx="42" ry="44" fill="${t.cloth}"/>` +
        `<ellipse cx="64" cy="63" rx="33" ry="35" fill="#14101c"/>`
      : "") +
    // body / clothing
    `<path d="M26,128 C28,105 44,99 64,99 C84,99 100,105 102,128 Z" fill="${t.cloth}"/>` +
    `<path d="M56,100 L64,110 L72,100 L68,99 L60,99 Z" fill="#0f0c16" fill-opacity="0.55"/>` +
    // neck + face
    `<rect x="58" y="88" width="12" height="14" rx="4" fill="${t.skin}"/>` +
    `<ellipse cx="64" cy="64" rx="26" ry="28" fill="${t.skin}"/>` +
    `<ellipse cx="38" cy="66" rx="4" ry="6" fill="${t.skin}"/>` +
    `<ellipse cx="90" cy="66" rx="4" ry="6" fill="${t.skin}"/>` +
    (t.blush
      ? `<ellipse cx="46" cy="76" rx="4.5" ry="2.6" fill="#e89a90" fill-opacity="0.5"/>` +
        `<ellipse cx="82" cy="76" rx="4.5" ry="2.6" fill="#e89a90" fill-opacity="0.5"/>`
      : "") +
    eyesFor(t) +
    mouthFor(t) +
    hairFor(t) +
    accessoryFor(t) +
    `</svg>`
  );
}

/* ------------------------------ public API -------------------------------- */

let cache: string | null = null;

/** Stable data-URI avatar for the current visitor (computed once, cached). */
export function getAvatarDataUri(): string {
  if (cache) return cache;
  const svg = buildAvatarSvg(getGuestId());
  cache = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return cache;
}
