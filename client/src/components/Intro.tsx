/**
 * ANIME BGC — original brand intro (Canvas 2D + DOM text, zero dependencies).
 *
 * Visual language: dark obsidian stage, deep crimson energy with subtle gold
 * accents — elegant particles converge into a refined circular portal while
 * flowing ink-energy strokes orbit it; the BGC letters then reveal
 * cinematically under soft volumetric light. Fully original artwork.
 *
 * Engineering: rAF-driven canvas (DPR ≤ 2, particle count scales with
 * viewport), DOM letters for crisp accessible text, skip button + Esc,
 * scroll lock, no layout shift (fixed overlay; the app loads behind it).
 */
import { useEffect, useRef, useState } from "react";
import { INTRO_CONFIG, markIntroShown } from "@/lib/intro";

const CRIMSON = { r: 208, g: 34, b: 62 };
const GOLD = { r: 217, g: 178, b: 106 };
const WARM = { r: 246, g: 238, b: 222 };
const OBSIDIAN = "#060608";

const EXIT_MS = 700; // exit fade length (end of timeline)
const LETTERS_AT = 3000; // when BGC letters start revealing

type RGB = { r: number; g: number; b: number };
const rgba = (c: RGB, a: number) => `rgba(${c.r},${c.g},${c.b},${a})`;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

interface Particle {
  angle: number;
  radius: number;
  orbit: number;
  angVel: number;
  size: number;
  color: RGB;
  tw: number;
  drift: number;
}

interface Stroke {
  seed: number;
  head: number;
  len: number;
  speed: number;
  width: number;
  tip: RGB;
  dir: 1 | -1;
  radiusF: number;
}

export default function Intro({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [exiting, setExiting] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    markIntroShown();
    const total = INTRO_CONFIG.durationMs;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // ---- scene setup ------------------------------------------------------
    const count = Math.round(Math.min(150, Math.max(70, (w * h) / 16000)));
    const particles: Particle[] = Array.from({ length: count }, (_, i) => {
      const pick = i % 10;
      const color = pick < 6 ? WARM : pick < 9 ? CRIMSON : GOLD;
      return {
        angle: Math.random() * Math.PI * 2,
        radius: 0.55 + Math.random() * 0.75,
        orbit: 0.92 + Math.random() * 0.32,
        angVel: (Math.random() * 0.5 + 0.15) * (Math.random() < 0.5 ? -1 : 1),
        size: 0.6 + Math.random() * 1.7,
        color,
        tw: Math.random() * Math.PI * 2,
        drift: 0.35 + Math.random() * 0.5,
      };
    });

    const strokes: Stroke[] = Array.from({ length: 5 }, (_, i) => ({
      seed: Math.random() * 100,
      head: Math.random() * Math.PI * 2,
      len: Math.PI * (0.55 + Math.random() * 0.5),
      speed: 0.9 + Math.random() * 0.7,
      width: 1.4 + Math.random() * 2.2,
      tip: i % 3 === 2 ? GOLD : CRIMSON,
      dir: i % 2 === 0 ? 1 : -1,
      radiusF: [1.0, 1.12, 1.24, 1.36, 1.05][i],
    }));

    // ---- timing -----------------------------------------------------------
    const start = performance.now();
    let pausedAt = 0;
    let pausedTotal = 0;
    const onVis = () => {
      if (document.hidden) pausedAt = performance.now();
      else if (pausedAt) {
        pausedTotal += performance.now() - pausedAt;
        pausedAt = 0;
      }
    };
    document.addEventListener("visibilitychange", onVis);

    let raf = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setExiting(true);
      window.setTimeout(() => doneRef.current(), EXIT_MS);
    };
    finishRef.current = finish;

    const draw = (now: number) => {
      if (finished) return;
      const t = now - start - pausedTotal;
      if (t >= total) {
        finish();
        return;
      }

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(Math.min(w, h) * 0.3, 300);
      const maxDim = Math.hypot(w, h) / 2;

      const pIn = smooth(0, 900, t);
      const pStrokes = smooth(900, 2400, t);
      const pPortal = smooth(1100, 3000, t);
      const pGlow = smooth(1400, 3400, t);
      const pLetters = smooth(LETTERS_AT, LETTERS_AT + 900, t);
      const pulse = 1 + Math.sin(t * 0.0022) * 0.05 * pLetters;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = OBSIDIAN;
      ctx.fillRect(0, 0, w, h);

      const vig = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, maxDim);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";

      // soft volumetric light behind the portal
      if (pGlow > 0) {
        const glowA = (0.16 + 0.1 * pLetters) * pulse * pIn;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.4);
        glow.addColorStop(0, rgba(CRIMSON, glowA * pGlow));
        glow.addColorStop(0.45, rgba(CRIMSON, glowA * 0.45 * pGlow));
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(cx - R * 2.4, cy - R * 2.4, R * 4.8, R * 4.8);
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
        core.addColorStop(0, rgba(GOLD, 0.1 * pLetters * pGlow));
        core.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = core;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      // particles — drift inward, then orbit the portal
      for (const p of particles) {
        const target = pStrokes > 0.6 ? (R * p.orbit) / maxDim : p.radius;
        p.radius += (target - p.radius) * 0.02 * p.drift;
        p.angle += (p.angVel * (pStrokes > 0.6 ? 0.9 : 0.35) * Math.PI) / 180;
        const x = cx + Math.cos(p.angle) * p.radius * maxDim;
        const y = cy + Math.sin(p.angle) * p.radius * maxDim * 0.96;
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.0016 + p.tw));
        ctx.beginPath();
        ctx.fillStyle = rgba(p.color, twinkle * 0.8 * pIn);
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // flowing ink-energy strokes orbiting the portal
      if (pStrokes > 0) {
        for (const s of strokes) {
          s.head += ((s.speed * Math.PI) / 180) * s.dir;
          const base = R * s.radiusF;
          for (let i = 0; i < 42; i++) {
            const f = i / 42;
            const ang = s.head - s.dir * s.len * f;
            const wob =
              Math.sin(ang * 3 + t * 0.0012 + s.seed) * 16 +
              Math.sin(ang * 7 - t * 0.0009 + s.seed * 2) * 7;
            const rr = base + wob;
            const x = cx + Math.cos(ang) * rr;
            const y = cy + Math.sin(ang) * rr * 0.985;
            const taper = 1 - f;
            ctx.beginPath();
            ctx.fillStyle = rgba(s.tip, taper * 0.5 * pStrokes * pIn);
            ctx.arc(x, y, Math.max(0.4, s.width * taper), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // circular portal — crimson arc draws itself, gold dashed orbit ring
      if (pPortal > 0) {
        ctx.save();
        ctx.shadowColor = rgba(CRIMSON, 0.85 * pPortal);
        ctx.shadowBlur = 26 * pPortal;
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = rgba(CRIMSON, 0.9 * pPortal * pIn);
        ctx.beginPath();
        ctx.arc(cx, cy, R * pulse, -Math.PI / 2, -Math.PI / 2 + pPortal * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(WARM, 0.35 * pPortal * pIn);
        ctx.beginPath();
        ctx.arc(cx, cy, R * pulse - 3, -Math.PI / 2, -Math.PI / 2 + pPortal * Math.PI * 2);
        ctx.stroke();
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.00012);
        ctx.setLineDash([1.5, 9]);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = rgba(GOLD, 0.55 * pPortal * pIn);
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.18 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-label="Anime BGC intro"
      className={`fixed inset-0 z-[100] select-none bg-[#060608] transition-all duration-700 ease-out ${
        exiting ? "pointer-events-none scale-[1.04] opacity-0" : "opacity-100"
      }`}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0" />

      {/* BGC wordmark — DOM text stays crisp, centered and readable */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="bgc-caption text-[11px] font-semibold uppercase tracking-[0.55em] text-[#d9b26a]/90 sm:text-xs">
          Anime
        </span>
        <h1 className="mt-3 flex items-baseline font-display text-[clamp(4.5rem,20vw,10rem)] font-extrabold leading-none tracking-tight">
          <span className="sr-only">BGC</span>
          {["B", "G", "C"].map((ch, i) => (
            <span
              key={ch}
              aria-hidden="true"
              className="bgc-letter inline-block"
              style={{ "--d": `${LETTERS_AT + i * 220}ms` } as React.CSSProperties}
            >
              <span className="bgc-glyph">{ch}</span>
            </span>
          ))}
        </h1>
        <span className="bgc-rule mt-6 block h-px w-40 bg-gradient-to-r from-transparent via-[#d9b26a]/80 to-transparent" />
      </div>

      <button
        type="button"
        onClick={() => finishRef.current()}
        className="bgc-skip absolute bottom-6 right-6 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur-md transition-colors hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        Skip intro
      </button>
    </div>
  );
}
