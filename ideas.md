# Anime BGC — Design Spec (Reference Clone of miruro.tv)

This is a **replication task**: the user explicitly asked to clone the design of miruro.tv.
Therefore miruro.tv is the **ground-truth spec**. Fidelity to the reference overrides
generic "avoid AI slop" guidance. Below is the captured spec we build against.

## Reference: miruro.tv (anime streaming homepage)

### Color Philosophy
Deep cinematic dark theme so anime artwork pops. Near-black canvas, layered dark
surfaces, single lavender/purple accent used sparingly for highlights and focus.

- `--background`: #080808 (near-black canvas)
- Surface 1 (cards/nav): #0e0e0e
- Surface 2 (raised): #141414
- Border: rgba(255,255,255,0.08)
- Text primary: #e8e8e8
- Text muted: #9a9a9a
- Accent (lavender): #b5a8ff — used for active tabs, focus rings, glows, hover tints (often at 0.1–0.25 opacity)
- Score/star highlight: warm gold #f5c518

### Typography
- Reference uses "Geist". We use **Geist** via Google Fonts (fallback Inter).
- Big bold display titles in hero (uppercase-ish, tight tracking).
- Clean sans body, small uppercase labels/badges with letter-spacing.

### Layout Paradigm (homepage, top to bottom)
1. **Sticky top navbar** with blur: left hamburger + MIRURO-style wordmark logo; center large pill search input with ⌘K hint; right cluster of icon buttons (shuffle, theme, notifications, profile avatar).
2. **Hero carousel**: full-bleed featured anime with banner background + dark gradient overlay. Top-left "EP 12 Airing Now" badge; top-right page counter (e.g. 2/12) with prev/next arrows. Bottom-left content: meta chips (type, episodes, score★, duration), large TITLE, genre dots, studio, synopsis (clamped), DETAILS + WATCH NOW buttons. Auto-advances.
3. **Genre pill bar**: horizontally scrollable row of pill chips (Action, Adventure, …) with left/right scroll arrows.
4. **Main two-column area**:
   - LEFT (wider): small "Love the Site?" promo strip with social icons; tab row NEWEST / POPULAR / TOP RATED with pagination; responsive grid of poster cards.
   - RIGHT (sidebar, sticky): "TOP AIRING" vertical list — ranked rows with thumbnail, title, type/year/eps/score.
5. **Horizontal carousels**: "Trending", "Popular Movies", "Recently Added" rows of poster cards that scroll horizontally.
6. **Footer**: logo, nav links, social icons, disclaimer.

### Card Design
- Poster cards: 2:3 portrait, ~10px radius, subtle border.
- Top-left type pill (TV/MOVIE/ONA). Bottom gradient with title. Score badge with star.
- Hover: lift + scale(1.03), lavender glow ring, play icon overlay, title reveal.

### Signature Elements
- Lavender focus glow on interactive elements.
- Pill-shaped chips and buttons; small uppercase mono-ish labels.
- Gold star score badges.
- Smooth horizontal scroll rows with edge fade masks.

### Interaction / Animation Philosophy
- Snappy ease-out transitions (<300ms). Buttons scale(0.97) on active.
- Hero crossfade between slides. Staggered card entrance (30–80ms).
- Genre/carousel rows scroll via arrow buttons and drag.
- Respect prefers-reduced-motion.

### Brand
- Wordmark: "ANIME BGC" stylized logotype with lavender accent dot/mark, plus a small graphic play/sparkle symbol logo.
- Voice: concise, fan-focused. CTAs like "Watch Now", "Details", "View All".

## Build Notes
- Frontend only, **mock data** (no real API/backend yet, per user request).
- React 19 + Wouter + Tailwind 4 + shadcn/ui (scaffold provided).
- Theme: dark. Edit index.css tokens to the palette above.
- Routes: `/` (Home). Add lightweight `/watch/:id` and `/search` placeholders showing "coming soon" toast/info so nav has no dead-ends.
- Use generated hero/banner images + anime-style placeholder posters (picsum/seeded) for covers since no API.

## Style Decisions
- Accent color is owned: lavender #b5a8ff. Never introduce competing accent hues.
- Backgrounds stay in the #080808–#141414 range; never pure flat gray panels.
