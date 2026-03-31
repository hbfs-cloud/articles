import React from 'react';
import {Sequence, useCurrentFrame, useVideoConfig, Audio, staticFile, interpolate, spring, Img} from 'remotion';
import {AnimatedCounter} from './components/shared/AnimatedCounter';

/**
 * EducationalVideo — Cinematic Remotion component for educational series
 *
 * Premium visual effects: morphing blobs, Ken Burns backgrounds, animated SVG grids,
 * typewriter reveals, glitch transitions, light streaks, animated borders, shimmer text,
 * 3D perspective, floating particles, confetti, spotlight tracking, wave distortion.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface Chapter {
  title: string;
  subtitle?: string;
  partNumber?: number;
  totalParts?: number;
}

export interface ContentSlide {
  type: 'title' | 'bullets' | 'concept' | 'table' | 'quote' | 'steps' | 'chart' | 'comparison' | 'warning' | 'tip' | 'summary' | 'chapter-intro' | 'quiz' | 'metric' | 'highlight';
  title?: string;
  subtitle?: string;
  icon?: string;
  items?: string[];
  text?: string;
  source?: string;
  headers?: string[];
  rows?: string[][];
  steps?: {number: number; title: string; description: string}[];
  chartType?: 'bar' | 'radar' | 'gauge' | 'line';
  chartData?: any;
  left?: {label: string; items: string[]};
  right?: {label: string; items: string[]};
  chapter?: Chapter;
  question?: string;
  choices?: string[];
  correctIndex?: number;
  explanation?: string;
  audioFile?: string;
  metricValue?: number;
  metricSuffix?: string;
  metricPrefix?: string;
  metricLabel?: string;
}

export interface SeriesConfig {
  seriesTitle: string;
  seriesSubtitle?: string;
  date: string;
  language: string;
  accentColor?: string;
  totalChapters: number;
}

// ── Design Constants ─────────────────────────────────────────────────

const FONT = "'Inter', -apple-system, sans-serif";
const W = 1920;
const H = 1080;

const CHAPTER_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4',
  '#ec4899', '#f97316', '#14b8a6', '#a855f7', '#eab308', '#6366f1',
];

const CHAPTER_ICONS = ['📊', '🎯', '💼', '🔥', '⚡', '🧠', '🌍', '🤖', '📈', '💡', '🔬', '🏗️'];

// ── Background Images (Unsplash) ─────────────────────────────────────

// Local images (pre-downloaded to public/images/)
function getChapterBg(_title: string): string | null {
  // Images disabled for render performance — return null to skip
  return null;
}

// ── Chapter Tracking ─────────────────────────────────────────────────

function buildChapterMap(slides: ContentSlide[]) {
  const map: Record<number, {idx: number; color: string; title: string; icon: string; total: number}> = {};
  let ci = -1, cc = CHAPTER_COLORS[0], ct = '', cicon = CHAPTER_ICONS[0];
  const total = slides.filter(s => s.type === 'chapter-intro').length;
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].type === 'chapter-intro') {
      ci++;
      cc = CHAPTER_COLORS[ci % CHAPTER_COLORS.length];
      ct = slides[i].chapter?.title || '';
      cicon = CHAPTER_ICONS[ci % CHAPTER_ICONS.length];
    }
    map[i] = {idx: ci, color: cc, title: ct, icon: cicon, total};
  }
  return map;
}

// ── Concept Variant Detection ────────────────────────────────────────

function detectConceptVariant(slide: ContentSlide): 'stat' | 'story' | 'icon' | 'split' | 'definition' | 'fullscreen' | 'default' {
  const text = slide.text || '', title = slide.title || '';
  const combined = title + ' ' + text;
  if (/cas |exemple|histoire|janvier|2008|2010|2021|GameStop|Porsche|Flash Crash|Lehman/i.test(combined)) return 'story';
  if (/\d+[,.]?\d*\s*(%|milliard|million|billion|trillion|\$|€)/i.test(text)) return 'stat';
  if (/^(qu.est.ce|d[ée]finition|on appelle|c.est |le |la |les |un |une )/i.test(text) && text.length < 400) return 'definition';
  if (/vs |contre |diff[ée]rence|compar/i.test(combined) && text.length > 100 && text.length < 500) return 'split';
  if (text.length < 150) return 'fullscreen';
  if (text.length < 280) return 'icon';
  return 'default';
}

function extractStat(text: string): {value: number; suffix: string} | null {
  const m = text.match(/(\d+[,.]?\d*)\s*(%|milliard|million|billion|trillion|\$|€)/i);
  if (m) return {value: parseFloat(m[1].replace(',', '.')), suffix: m[2]};
  return null;
}

function pickIcon(title: string): string {
  const emojiMatch = title.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u);
  if (emojiMatch) return emojiMatch[0];
  const t = title.toLowerCase();
  if (/vix|volatil|peur/.test(t)) return '🌡️';
  if (/market maker|liquidit/.test(t)) return '🏛️';
  if (/dark pool|ombre/.test(t)) return '🌑';
  if (/gamestop|reddit/.test(t)) return '🎮';
  if (/flash crash|krach/.test(t)) return '💥';
  if (/manipul|fraude|wash/.test(t)) return '🚨';
  if (/pump|dump/.test(t)) return '📢';
  if (/ia\b|ai\b|algo/.test(t)) return '🤖';
  if (/crypto|bitcoin/.test(t)) return '₿';
  if (/or\b|gold/.test(t)) return '🥇';
  if (/dividende|rendement/.test(t)) return '💰';
  if (/risque|danger|pi[èe]ge/.test(t)) return '⚠️';
  if (/etf|indice/.test(t)) return '📦';
  if (/portefeuille|portfolio/.test(t)) return '💼';
  if (/psycho|[ée]motion|perte/.test(t)) return '🧠';
  if (/banque|central|fed/.test(t)) return '🏦';
  if (/r[ée]gulat|sec|amf/.test(t)) return '📋';
  if (/momentum|tendance/.test(t)) return '📈';
  if (/value|valeur/.test(t)) return '🔍';
  if (/option|call|put/.test(t)) return '🎲';
  if (/stop|protect/.test(t)) return '🛡️';
  if (/bienvenue|formation/.test(t)) return '🎓';
  if (/signal|bruit/.test(t)) return '📡';
  if (/cash/.test(t)) return '💵';
  if (/paper trad/.test(t)) return '📝';
  if (/short|baiss/.test(t)) return '📉';
  if (/dca|r[ée]gulier/.test(t)) return '🔄';
  if (/levier|leverage/.test(t)) return '⚡';
  if (/rendement|performance/.test(t)) return '📊';
  if (/analyse|technique/.test(t)) return '📐';
  if (/fondamental/.test(t)) return '🏗️';
  if (/diversif/.test(t)) return '🎯';
  return '💡';
}

// ══════════════════════════════════════════════════════════════════════
// ── CINEMATIC VISUAL EFFECTS ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

// ── Morphing Blob ────────────────────────────────────────────────────

const MorphBlob: React.FC<{
  x: number; y: number; size: number; color: string; speed?: number; blur?: number;
}> = ({x, y, size, color, speed = 0.005, blur = 80}) => {
  const frame = useCurrentFrame();
  const r1 = 40 + Math.sin(frame * speed) * 15;
  const r2 = 55 + Math.cos(frame * speed * 1.3) * 12;
  const r3 = 45 + Math.sin(frame * speed * 0.7 + 2) * 18;
  const r4 = 50 + Math.cos(frame * speed * 0.9 + 1) * 10;
  const cx = x + Math.sin(frame * speed * 0.4) * 30;
  const cy = y + Math.cos(frame * speed * 0.3) * 20;

  return (
    <div style={{
      position: 'absolute', left: cx, top: cy,
      width: size, height: size,
      borderRadius: `${r1}% ${r2}% ${r3}% ${r4}%`,
      background: `radial-gradient(ellipse, ${color}18 0%, ${color}08 50%, transparent 75%)`,
      opacity: 0.6,
      pointerEvents: 'none',
    }} />
  );
};

// ── Animated SVG Grid ────────────────────────────────────────────────

const AnimatedGrid: React.FC<{color: string; opacity?: number}> = ({color, opacity = 0.03}) => {
  const frame = useCurrentFrame();
  const pulseOpacity = opacity + Math.sin(frame * 0.02) * 0.008;

  // Use CSS grid pattern instead of SVG for better perf
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: pulseOpacity,
      backgroundImage: `linear-gradient(${color}12 1px, transparent 1px), linear-gradient(90deg, ${color}08 1px, transparent 1px)`,
      backgroundSize: '80px 80px',
    }} />
  );
};

// ── Light Streak ─────────────────────────────────────────────────────

const LightStreak: React.FC<{color: string; delay?: number; angle?: number}> = ({color, delay = 0, angle = -25}) => {
  const frame = useCurrentFrame();
  const f = frame - delay;
  if (f < 0 || f > 45) return null;
  const progress = f / 45;
  const x = interpolate(progress, [0, 1], [-400, W + 400]);
  const opacity = progress < 0.3 ? progress / 0.3 : progress > 0.7 ? (1 - progress) / 0.3 : 1;

  return (
    <div style={{
      position: 'absolute', zIndex: 3, pointerEvents: 'none',
      left: x, top: '0%', width: '3px', height: '200%',
      transform: `rotate(${angle}deg)`,
      background: `linear-gradient(180deg, transparent, ${color}30, ${color}60, ${color}30, transparent)`,
      opacity: opacity * 0.4,
      opacity: 0.5,
    }} />
  );
};

// ── Floating Particles ───────────────────────────────────────────────

const PARTICLES = Array.from({length: 10}, (_, i) => ({
  x: (i * 137.5) % W, y: (i * 89.3) % H,
  size: 2 + (i % 4) * 1.5,
  sx: 0.003 + (i % 5) * 0.0015,
  sy: 0.002 + (i % 3) * 0.0012,
  op: 0.03 + (i % 5) * 0.015,
  phase: i * 0.7,
}));

const FloatingParticles: React.FC<{color?: string}> = ({color = 'rgba(255,255,255,0.6)'}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden'}}>
      {PARTICLES.map((p, i) => {
        const cx = ((p.x + Math.sin(frame * p.sx + p.phase) * 150) % W + W) % W;
        const cy = ((p.y + Math.cos(frame * p.sy + p.phase) * 100) % H + H) % H;
        const op = p.op + Math.sin(frame * 0.015 + p.phase) * 0.02;
        return (
          <div key={i} style={{
            position: 'absolute', left: cx, top: cy,
            width: p.size, height: p.size, borderRadius: '50%',
            background: color, opacity: Math.max(0.02, Math.min(0.12, op)),
            boxShadow: `0 0 ${p.size * 4}px ${color}`,
          }} />
        );
      })}
    </div>
  );
};

// ── Spotlight Effect ─────────────────────────────────────────────────

const Spotlight: React.FC<{x?: number; y?: number; size?: number; color?: string}> = ({
  x = 50, y = 40, size = 800, color = 'rgba(255,255,255,0.03)',
}) => {
  const frame = useCurrentFrame();
  const sx = x + Math.sin(frame * 0.004) * 8;
  const sy = y + Math.cos(frame * 0.003) * 5;

  return (
    <div style={{
      position: 'absolute', zIndex: 1, pointerEvents: 'none',
      left: `${sx}%`, top: `${sy}%`,
      width: size, height: size,
      transform: 'translate(-50%, -50%)',
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    }} />
  );
};

// ── Typewriter Text (word-by-word reveal) ────────────────────────────

const TypewriterText: React.FC<{
  text: string; startFrame?: number; framesPerWord?: number;
  style?: React.CSSProperties;
}> = ({text, startFrame = 12, framesPerWord = 2, style}) => {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/);
  const f = frame - startFrame;

  return (
    <span style={{...style, display: 'inline'}}>
      {words.map((word, i) => {
        const ws = i * framesPerWord;
        const p = Math.min(1, Math.max(0, (f - ws) / 5));
        return (
          <span key={i} style={{
            display: 'inline-block', opacity: p,
            transform: `translateY(${(1-p) * 10}px)`,
            marginRight: '0.3em',
          }}>{word}</span>
        );
      })}
    </span>
  );
};

// ── Shimmer Text (gradient that moves) ───────────────────────────────

const ShimmerText: React.FC<{
  children: string; color: string; style?: React.CSSProperties;
}> = ({children, color, style}) => {
  const frame = useCurrentFrame();
  const pos = (frame * 2) % 400 - 100;

  return (
    <span style={{
      ...style,
      background: `linear-gradient(90deg, ${color} 0%, #f8fafc ${pos}%, ${color} ${pos + 30}%, ${color} 100%)`,
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      backgroundSize: '200% 100%',
    }}>{children}</span>
  );
};

// ── Animated Border Card ─────────────────────────────────────────────

const AnimatedBorderCard: React.FC<{
  children: React.ReactNode; color: string; delay?: number;
  padding?: string; style?: React.CSSProperties;
}> = ({children, color, delay = 0, padding = '40px 48px', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const drawP = spring({frame: frame - delay, fps, config: {damping: 25, stiffness: 60}});
  const perimeter = 2 * (1776 + 920); // approx card perimeter
  const dashLen = perimeter * drawP;

  return (
    <div style={{
      position: 'relative', padding,
      background: 'rgba(255,255,255,0.03)',
      /* backdropFilter removed for render perf */
      borderRadius: '24px',
      boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`,
      ...style,
    }}>
      {/* Animated SVG border */}
      <svg style={{position: 'absolute', inset: -1, width: 'calc(100% + 2px)', height: 'calc(100% + 2px)', pointerEvents: 'none', zIndex: 2}}>
        <rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="24" ry="24"
          fill="none" stroke={`${color}40`} strokeWidth="1.5"
          strokeDasharray={`${dashLen} ${perimeter}`}
        />
      </svg>
      {children}
    </div>
  );
};

// ── Confetti Burst ───────────────────────────────────────────────────

const CONFETTI_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];

const ConfettiBurst: React.FC<{active: boolean; startFrame: number}> = ({active, startFrame}) => {
  const frame = useCurrentFrame();
  if (!active) return null;
  const f = frame - startFrame;
  if (f < 0 || f > 60) return null;

  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden'}}>
      {Array.from({length: 20}, (_, i) => {
        const angle = (i / 40) * Math.PI * 2 + i * 0.3;
        const speed = 3 + (i % 6) * 2;
        const x = W / 2 + Math.cos(angle) * speed * f * 1.5;
        const y = H / 2 + Math.sin(angle) * speed * f * 1.1 + f * f * 0.04;
        const opacity = Math.max(0, 1 - f / 50);
        const size = 5 + (i % 4) * 3;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y,
            width: size, height: size * 0.6, borderRadius: '1px',
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            opacity, transform: `rotate(${f * (5 + i * 2)}deg)`,
          }} />
        );
      })}
    </div>
  );
};

// ── Cinematic Letterbox ──────────────────────────────────────────────

const Letterbox: React.FC<{open?: boolean}> = ({open = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame, fps, config: {damping: 20, stiffness: 50}});
  const barH = open ? interpolate(p, [0, 1], [120, 0]) : 120;

  return (
    <>
      <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: barH, background: '#000', zIndex: 90}} />
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: barH, background: '#000', zIndex: 90}} />
    </>
  );
};

// ── Glitch Effect ────────────────────────────────────────────────────

const GlitchOverlay: React.FC<{active: boolean}> = ({active}) => {
  const frame = useCurrentFrame();
  if (!active || frame > 8) return null;

  const slices = Array.from({length: 5}, (_, i) => {
    const y = (i * 216) + (Math.sin(frame * 3 + i) * 30);
    const xOff = (Math.sin(frame * 7 + i * 2) * 15);
    const h = 30 + Math.random() * 60;
    return (
      <div key={i} style={{
        position: 'absolute', left: xOff, top: y, width: W, height: h,
        background: `rgba(${i % 2 === 0 ? '59,130,246' : '239,68,68'},0.08)`,
        transform: `translateX(${xOff}px)`,
      }} />
    );
  });

  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 80, pointerEvents: 'none', mixBlendMode: 'screen'}}>
      {slices}
      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 2,
        top: (frame * 80) % H,
        background: 'rgba(255,255,255,0.1)',
      }} />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// ── PREMIUM BACKGROUND ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

const PremiumBg: React.FC<{color: string; variant?: string; chapterTitle?: string}> = ({color, variant = 'default', chapterTitle}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame * 0.008) * 5;
  const drift2 = Math.cos(frame * 0.006) * 5;
  const bgUrl = chapterTitle ? getChapterBg(chapterTitle) : null;

  // Ken Burns
  const kbScale = 1.08 + Math.sin(frame * 0.002) * 0.04;
  const kbX = Math.sin(frame * 0.003) * 20;
  const kbY = Math.cos(frame * 0.0025) * 12;

  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden'}}>
      {/* Background image with Ken Burns */}
      {bgUrl && (
        <div style={{position: 'absolute', inset: '-8%', transform: `scale(${kbScale}) translate(${kbX}px, ${kbY}px)`}}>
          <Img src={bgUrl} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          {/* Heavy dark overlay */}
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(6,8,15,0.92) 0%, rgba(12,18,32,0.88) 50%, rgba(10,14,26,0.94) 100%)'}} />
        </div>
      )}

      {/* Base gradient (visible when no image or through overlay) */}
      <div style={{position: 'absolute', inset: 0, background: bgUrl ? 'none' : 'linear-gradient(160deg, #06080f 0%, #0c1220 35%, #111827 70%, #0a0e1a 100%)'}} />

      {/* Gradient orbs (no filter:blur for perf) */}
      <div style={{
        position: 'absolute', top: `${-15 + drift * 3}%`, right: `${-10 + drift2 * 2}%`,
        width: 900, height: 900, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}0c 0%, ${color}04 35%, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: `${-20 - drift * 3}%`, left: `${-15 - drift2 * 2}%`,
        width: 700, height: 700, borderRadius: '50%',
        background: `radial-gradient(circle, ${
          variant === 'warning' ? 'rgba(239,68,68,0.05)' : variant === 'quiz' ? 'rgba(245,158,11,0.04)' : `${color}05`
        } 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />

      {/* Animated grid */}
      <AnimatedGrid color={color} opacity={0.025} />

      {/* Top edge glow */}
      <div style={{
        position: 'absolute', top: 0, left: '5%', right: '5%', height: '2px',
        background: `linear-gradient(90deg, transparent, ${color}30, transparent)`,
        boxShadow: `0 0 30px ${color}15`,
      }} />

      {/* Bottom edge glow */}
      <div style={{
        position: 'absolute', bottom: 60, left: '15%', right: '15%', height: '1px',
        background: `linear-gradient(90deg, transparent, ${color}15, transparent)`,
      }} />

      {/* Subtle vignette */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.4,
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)',
      }} />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// ── GLASS CARD ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

const Glass: React.FC<{
  children: React.ReactNode;
  color?: string;
  accent?: 'left' | 'top' | 'none';
  padding?: string;
  style?: React.CSSProperties;
  scanLine?: boolean;
  scanColor?: string;
  glow?: boolean;
}> = ({children, color = 'rgba(255,255,255,0.06)', accent = 'none', padding = '40px 48px', style, scanLine, scanColor, glow}) => {
  const frame = useCurrentFrame();
  const scanPos = scanLine ? ((frame * 0.008) % 1.6) - 0.3 : 0;

  return (
    <div style={{
      position: 'relative',
      background: 'rgba(15,23,42,0.75)',
      /* backdropFilter removed for render perf */
      borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: accent === 'left' ? `5px solid ${color}` : undefined,
      borderTop: accent === 'top' ? `3px solid ${color}` : undefined,
      padding,
      boxShadow: glow
        ? `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 60px ${color}10`
        : '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
      ...style,
    }}>
      {/* Scan line effect */}
      {scanLine && (
        <div style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2, borderRadius: 'inherit',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: `${scanPos * 100}%`,
            width: 200, height: '100%',
            background: `linear-gradient(90deg, transparent, ${scanColor || color}08, ${scanColor || color}12, ${scanColor || color}08, transparent)`,
            transform: 'skewX(-15deg)',
          }} />
        </div>
      )}
      {children}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// ── ANIMATION WRAPPERS ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

const Anim: React.FC<{
  children: React.ReactNode;
  type?: 'fade' | 'slide' | 'scale' | 'pop' | 'slideR' | 'slideL' | 'zoom' | 'blur';
  delay?: number;
  style?: React.CSSProperties;
}> = ({children, type = 'fade', delay = 0, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 14, stiffness: 90}});

  let anim: React.CSSProperties = {opacity: p};
  if (type === 'slide') anim = {opacity: p, transform: `translateY(${(1-p)*50}px)`};
  if (type === 'scale') anim = {opacity: p, transform: `scale(${0.8 + p*0.2})`};
  if (type === 'pop') anim = {opacity: p, transform: `scale(${p * (1 + (1-p)*0.15)})`};
  if (type === 'slideR') anim = {opacity: p, transform: `translateX(${(1-p)*-60}px)`};
  if (type === 'slideL') anim = {opacity: p, transform: `translateX(${(1-p)*60}px)`};
  if (type === 'zoom') anim = {opacity: p, transform: `scale(${0.5 + p*0.5}) rotate(${(1-p)*-2}deg)`};
  if (type === 'blur') anim = {opacity: p, transform: `scale(${0.95 + p*0.05})`};

  return <div style={{...style, ...anim}}>{children}</div>;
};

// ── Breathing Zoom (subtle alive feeling) ────────────────────────────

const BreathingZoom: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const s = 1 + Math.sin(frame * 0.004) * 0.006;

  return (
    <div style={{transform: `scale(${s})`, transformOrigin: 'center center', width: '100%', height: '100%'}}>
      {children}
    </div>
  );
};

// ── CrossFade Wrapper ────────────────────────────────────────────────

const CrossfadeSlide: React.FC<{children: React.ReactNode; durationInFrames: number}> = ({children, durationInFrames}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});

  return <div style={{opacity: fadeIn * fadeOut, width: W, height: H}}>{children}</div>;
};

// ══════════════════════════════════════════════════════════════════════
// ── HUD (persistent overlay) ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

const HUD: React.FC<{
  progress: number; chapterIdx: number; chapterTitle: string;
  chapterColor: string; totalCh: number; cfg: SeriesConfig; slideIdx: number; totalSlides: number;
}> = ({progress, chapterIdx, chapterTitle, chapterColor, totalCh, cfg, slideIdx, totalSlides}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const o = interpolate(frame, [0, fps * 1.5], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100, opacity: o}}>
      {/* Top-left: logo + course */}
      <div style={{position: 'absolute', top: '30px', left: '56px', display: 'flex', alignItems: 'center', gap: '14px'}}>
        <Img src={staticFile('logo.png')} style={{width: 32, height: 32, opacity: 0.6}} />
        <span style={{fontFamily: FONT, fontSize: '17px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3px'}}>
          {cfg.seriesTitle}
        </span>
      </div>

      {/* Top-right: chapter badge */}
      {chapterIdx >= 0 && (
        <div style={{position: 'absolute', top: '26px', right: '56px'}}>
          <div style={{
            background: `${chapterColor}10`, border: `1px solid ${chapterColor}25`,
            borderRadius: '14px', padding: '9px 22px',
            display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: `0 4px 20px ${chapterColor}08`,
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: chapterColor,
              boxShadow: `0 0 8px ${chapterColor}, 0 0 16px ${chapterColor}60`,
            }} />
            <span style={{fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: chapterColor, letterSpacing: '1.5px', textTransform: 'uppercase'}}>
              {cfg.language === 'fr' ? 'Chapitre' : 'Chapter'} {chapterIdx + 1}/{totalCh}
            </span>
          </div>
        </div>
      )}

      {/* Top-right secondary: slide counter */}
      {chapterIdx >= 0 && (
        <div style={{position: 'absolute', top: '70px', right: '56px'}}>
          <span style={{fontFamily: FONT, fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.15)'}}>
            {slideIdx + 1} / {totalSlides}
          </span>
        </div>
      )}

      {/* Bottom: progress bar + brand */}
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0}}>
        {/* Progress bar */}
        <div style={{height: '4px', background: 'rgba(255,255,255,0.03)'}}>
          <div style={{
            height: '100%', width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${chapterColor}aa, ${chapterColor})`,
            boxShadow: `0 0 20px ${chapterColor}40, 0 -2px 10px ${chapterColor}20`,
            position: 'relative',
          }}>
            {/* Glowing dot at progress tip */}
            <div style={{
              position: 'absolute', right: -4, top: -3,
              width: 10, height: 10, borderRadius: '50%',
              background: chapterColor,
              boxShadow: `0 0 12px ${chapterColor}, 0 0 24px ${chapterColor}80`,
            }} />
          </div>
        </div>
        {/* Brand strip */}
        <div style={{display: 'flex', justifyContent: 'space-between', padding: '11px 56px', background: 'rgba(0,0,0,0.35)'}}>
          <span style={{fontFamily: FONT, fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.2)'}}>
            dailytickers<span style={{color: 'rgba(80,180,238,0.35)'}}>.xyz</span>
          </span>
          <span style={{fontFamily: FONT, fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.14)'}}>
            {cfg.language === 'fr' ? 'Pas un conseil financier' : 'Not financial advice'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// ── SLIDE WRAPPER ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

const Slide: React.FC<{
  children: React.ReactNode; color: string; variant?: string;
  chapterTitle?: string; style?: React.CSSProperties; noBreathing?: boolean;
}> = ({children, color, variant, chapterTitle, style, noBreathing}) => {
  const inner = (
    <div style={{position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '88px 72px 64px', boxSizing: 'border-box'}}>
      {children}
    </div>
  );

  return (
    <div style={{width: W, height: H, position: 'relative', fontFamily: FONT, overflow: 'hidden', ...style}}>
      <PremiumBg color={color} variant={variant} chapterTitle={chapterTitle} />
      <FloatingParticles color={`${color}60`} />
      <Spotlight color={`${color}04`} />
      {noBreathing ? inner : <BreathingZoom>{inner}</BreathingZoom>}
    </div>
  );
};

/** Title with accent bar + optional animated underline */
const SlideTitle: React.FC<{children: string; color: string; icon?: string; sub?: string}> = ({children, color, icon, sub}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lineW = spring({frame: frame - 8, fps, config: {damping: 20, stiffness: 60}});

  return (
    <Anim type="slide" delay={0}>
      <div style={{display: 'flex', alignItems: 'center', gap: '18px', marginBottom: sub ? '8px' : '28px'}}>
        {icon && (
          <div style={{
            width: '58px', height: '58px', borderRadius: '18px',
            background: `${color}12`, border: `1px solid ${color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px',
            boxShadow: `0 4px 20px ${color}15, 0 0 40px ${color}08`,
          }}>{icon}</div>
        )}
        {!icon && <div style={{width: '6px', height: '48px', borderRadius: '3px', background: color, boxShadow: `0 0 16px ${color}50`}} />}
        <div>
          <h3 style={{fontSize: '48px', fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.5px', lineHeight: 1.15}}>
            {children}
          </h3>
          {/* Animated underline */}
          <div style={{
            width: `${lineW * 100}%`, maxWidth: '300px', height: '3px', borderRadius: '2px',
            marginTop: '8px',
            background: `linear-gradient(90deg, ${color}, ${color}40)`,
            boxShadow: `0 0 10px ${color}30`,
          }} />
        </div>
      </div>
      {sub && <p style={{fontSize: '24px', color: '#94a3b8', margin: '0 0 24px 76px', fontWeight: 500}}>{sub}</p>}
    </Anim>
  );
};

// ══════════════════════════════════════════════════════════════════════
// ── INTRO SLIDE ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

const IntroSlide: React.FC<{cfg: SeriesConfig}> = ({cfg}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ac = cfg.accentColor || '#3b82f6';

  return (
    <div style={{width: W, height: H, position: 'relative', fontFamily: FONT, overflow: 'hidden'}}>
      <PremiumBg color={ac} variant="chapter" />

      {/* Light streaks on intro */}
      <LightStreak color={ac} delay={fps * 0.5} angle={-20} />
      <LightStreak color="#8b5cf6" delay={fps * 0.8} angle={-30} />
      <LightStreak color="#06b6d4" delay={fps * 1.2} angle={-15} />

      <FloatingParticles color={`${ac}50`} />
      <Letterbox open={true} />

      <div style={{position: 'relative', zIndex: 10, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '20px'}}>
        {/* Pulsing ring + logo */}
        <div style={{
          opacity: interpolate(frame, [0, fps * 0.8], [0, 1], {extrapolateRight: 'clamp'}),
          transform: `scale(${interpolate(frame, [0, fps * 0.8], [0.3, 1], {extrapolateRight: 'clamp'})})`,
        }}>
          <div style={{position: 'relative'}}>
            {/* Outer pulsing ring */}
            <div style={{
              position: 'absolute', inset: -20,
              borderRadius: '50%', border: `2px solid ${ac}${Math.floor(15 + Math.sin(frame * 0.05) * 10).toString(16).padStart(2, '0')}`,
              boxShadow: `0 0 ${40 + Math.sin(frame * 0.05) * 15}px ${ac}15`,
            }} />
            <div style={{
              width: '130px', height: '130px', borderRadius: '50%',
              border: `3px solid ${ac}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 60px ${ac}15, inset 0 0 40px ${ac}06`,
              background: `rgba(0,0,0,0.3)`,
            }}>
              <Img src={staticFile('logo.png')} style={{width: 72, height: 72}} />
            </div>
          </div>
        </div>

        {/* Series label */}
        <div style={{opacity: interpolate(frame, [fps*0.5, fps*1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
          <span style={{fontSize: '18px', fontWeight: 700, letterSpacing: '10px', textTransform: 'uppercase', color: ac}}>
            {cfg.language === 'fr' ? 'SÉRIE ÉDUCATIVE' : 'EDUCATIONAL SERIES'}
          </span>
        </div>

        {/* Title with shimmer */}
        <div style={{
          opacity: interpolate(frame, [fps*0.8, fps*1.5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          transform: `translateY(${interpolate(frame, [fps*0.8, fps*1.5], [30, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px)`,
        }}>
          <h1 style={{fontSize: '92px', fontWeight: 900, margin: '8px 0', letterSpacing: '-2px', lineHeight: 1.1, maxWidth: '1400px'}}>
            <ShimmerText color={ac} style={{fontSize: '92px', fontWeight: 900}}>{cfg.seriesTitle}</ShimmerText>
          </h1>
        </div>

        {/* Subtitle */}
        {cfg.seriesSubtitle && (
          <div style={{opacity: interpolate(frame, [fps*1.2, fps*2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
            <p style={{fontSize: '30px', color: '#94a3b8', maxWidth: '1000px', lineHeight: 1.5, margin: 0}}>{cfg.seriesSubtitle}</p>
          </div>
        )}

        {/* Badges */}
        <div style={{
          opacity: interpolate(frame, [fps*1.8, fps*2.5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          display: 'flex', gap: '14px', marginTop: '20px',
        }}>
          {[
            {label: `${cfg.totalChapters} ${cfg.language === 'fr' ? 'Chapitres' : 'Chapters'}`, c: ac},
            {label: cfg.date, c: '#64748b'},
            {label: cfg.language === 'fr' ? '🇫🇷 Français' : '🇬🇧 English', c: '#8b5cf6'},
          ].map((b, i) => (
            <span key={i} style={{
              background: `${b.c}12`, color: b.c, padding: '10px 26px',
              borderRadius: '14px', border: `1px solid ${b.c}25`,
              fontSize: '22px', fontWeight: 700,
            }}>{b.label}</span>
          ))}
        </div>

        {/* Gradient line */}
        <div style={{
          width: interpolate(frame, [fps*2.5, fps*3.5], [0, 300], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          height: '3px', borderRadius: '2px', marginTop: '16px',
          background: `linear-gradient(90deg, transparent, ${ac}, transparent)`,
          boxShadow: `0 0 20px ${ac}40`,
        }} />
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// ── CHAPTER INTRO ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

let globalConfig: SeriesConfig;

const ChapterSlide: React.FC<{ch: Chapter; idx: number; total: number; color: string}> = ({ch, idx, total, color}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const icon = CHAPTER_ICONS[idx % CHAPTER_ICONS.length];
  const fadeOut = interpolate(frame, [fps * 5, fps * 5.5], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const bgUrl = getChapterBg(ch.title);

  return (
    <div style={{width: W, height: H, position: 'relative', fontFamily: FONT, overflow: 'hidden'}}>
      {/* Full background image with heavy blur */}
      {bgUrl && <div style={{
        position: 'absolute', inset: '-10%',
        transform: `scale(${1.15 + Math.sin(frame * 0.003) * 0.05})`,
      }}>
        <Img src={bgUrl} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3}} />
        <div style={{position: 'absolute', inset: 0, background: `linear-gradient(160deg, rgba(6,8,15,0.88) 0%, ${color}15 50%, rgba(10,14,26,0.92) 100%)`}} />
      </div>}
      {!bgUrl && <div style={{position: 'absolute', inset: 0, background: `linear-gradient(160deg, rgba(6,8,15,1) 0%, ${color}25 50%, rgba(10,14,26,1) 100%)`}} />}

      <FloatingParticles color={`${color}40`} />
      <GlitchOverlay active={frame < 8} />
      <LightStreak color={color} delay={5} />
      <LightStreak color="#ffffff" delay={12} angle={-35} />

      {/* Content */}
      <div style={{position: 'relative', zIndex: 10, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fadeOut}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '24px'}}>
          {/* Icon with pulsing glow */}
          <Anim type="zoom" delay={3}>
            <div style={{position: 'relative'}}>
              <div style={{
                position: 'absolute', inset: -15, borderRadius: '40px',
                border: `2px solid ${color}${Math.floor(20 + Math.sin(frame * 0.06) * 12).toString(16).padStart(2,'0')}`,
                boxShadow: `0 0 ${30 + Math.sin(frame * 0.06) * 15}px ${color}20`,
              }} />
              <div style={{
                width: '120px', height: '120px', borderRadius: '36px',
                background: `linear-gradient(135deg, ${color}20, ${color}08)`,
                border: `2px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '60px',
                boxShadow: `0 8px 50px ${color}25, inset 0 0 30px ${color}08`,
              }}>{icon}</div>
            </div>
          </Anim>

          {/* Chapter label */}
          <Anim type="fade" delay={fps * 0.3}>
            <span style={{fontSize: '22px', fontWeight: 800, letterSpacing: '8px', color, textTransform: 'uppercase'}}>
              {globalConfig.language === 'fr' ? 'CHAPITRE' : 'CHAPTER'} {ch.partNumber || idx + 1}
            </span>
          </Anim>

          {/* Expanding line */}
          <div style={{
            width: interpolate(frame, [fps*0.4, fps*1.2], [0, 400], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            height: '4px', borderRadius: '2px',
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            boxShadow: `0 0 20px ${color}50`,
          }} />

          {/* Title */}
          <Anim type="scale" delay={fps * 0.6}>
            <h2 style={{
              fontSize: '84px', fontWeight: 900, color: '#f1f5f9',
              margin: 0, letterSpacing: '-1px', lineHeight: 1.12, maxWidth: '1400px',
              textShadow: `0 4px 30px rgba(0,0,0,0.5)`,
            }}>{ch.title}</h2>
          </Anim>

          {ch.subtitle && (
            <Anim type="blur" delay={fps * 1}>
              <p style={{fontSize: '28px', color: '#94a3b8', maxWidth: '950px', margin: 0, lineHeight: 1.5}}>{ch.subtitle}</p>
            </Anim>
          )}

          {/* Progress dots with glow */}
          <Anim type="fade" delay={fps * 1.5}>
            <div style={{display: 'flex', gap: '14px', marginTop: '20px'}}>
              {Array.from({length: total}).map((_, i) => (
                <div key={i} style={{
                  width: i === idx ? '52px' : '14px', height: '14px', borderRadius: '7px',
                  background: i <= idx ? color : 'rgba(255,255,255,0.08)',
                  boxShadow: i === idx ? `0 0 20px ${color}70, 0 0 40px ${color}30` : 'none',
                }} />
              ))}
            </div>
          </Anim>
        </div>
      </div>

      <Letterbox open={true} />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// ── CONTENT SLIDES ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

// ── BULLETS ──────────────────────────────────────────────────────────

const BulletsSlide: React.FC<{title?: string; items: string[]; color: string; chTitle: string}> = ({title, items, color, chTitle}) => {
  const twoCols = items.length > 4;
  return (
    <Slide color={color} chapterTitle={chTitle}>
      {title && <SlideTitle color={color}>{title}</SlideTitle>}
      <div style={{
        display: 'grid', gridTemplateColumns: twoCols ? '1fr 1fr' : '1fr',
        gap: twoCols ? '14px 32px' : '16px', flex: 1, alignContent: 'center',
      }}>
        {items.map((item, i) => (
          <Anim key={i} type="slideR" delay={6 + i * 5}>
            <Glass padding="22px 28px" color={color} accent="left" scanLine={i === 0} scanColor={color}
              style={{borderLeftWidth: '4px'}}>
              <div style={{display: 'flex', gap: '16px', alignItems: 'flex-start'}}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0,
                  background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                  border: `1px solid ${color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '17px', fontWeight: 900, color,
                  boxShadow: `0 2px 10px ${color}15`,
                }}>{i + 1}</div>
                <p style={{fontSize: '28px', lineHeight: 1.55, color: '#e2e8f0', margin: 0}}>{item}</p>
              </div>
            </Glass>
          </Anim>
        ))}
      </div>
    </Slide>
  );
};

// ── CONCEPT (6 variants) ─────────────────────────────────────────────

const ConceptSlideComp: React.FC<{slide: ContentSlide; color: string; chTitle: string}> = ({slide, color, chTitle}) => {
  const variant = detectConceptVariant(slide);
  const title = slide.title || '';
  const text = slide.text || '';
  const icon = pickIcon(title);
  const frame = useCurrentFrame();

  // ── STAT variant: big animated number + explanation
  if (variant === 'stat') {
    const stat = extractStat(text);
    return (
      <Slide color={color} chapterTitle={chTitle}>
        {title && <SlideTitle color={color} icon={icon}>{title}</SlideTitle>}
        <div style={{flex: 1, display: 'flex', gap: '40px', alignItems: 'center'}}>
          {stat && (
            <Anim type="zoom" delay={8} style={{flex: '0 0 auto'}}>
              <AnimatedBorderCard color={color} delay={8} padding="48px 56px" style={{textAlign: 'center', minWidth: '320px'}}>
                <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px'}}>
                  <AnimatedCounter value={stat.value} decimals={stat.value % 1 !== 0 ? 1 : 0} delay={15}
                    style={{fontSize: '110px', fontWeight: 900, color}} />
                  <span style={{fontSize: '50px', fontWeight: 800, color}}>{stat.suffix}</span>
                </div>
              </AnimatedBorderCard>
            </Anim>
          )}
          <Anim type="blur" delay={18} style={{flex: 1}}>
            <Glass padding="36px 40px" accent="left" color={color} glow>
              <TypewriterText text={text} startFrame={20}
                style={{fontSize: '29px', lineHeight: 1.75, color: '#cbd5e1'}} />
            </Glass>
          </Anim>
        </div>
      </Slide>
    );
  }

  // ── STORY variant: cinematic narrative card
  if (variant === 'story') {
    return (
      <Slide color={color} chapterTitle={chTitle}>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px'}}>
          <Anim type="slide" delay={0}>
            <div style={{display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px'}}>
              <span style={{fontSize: '40px'}}>{icon}</span>
              <span style={{fontSize: '16px', fontWeight: 800, letterSpacing: '5px', textTransform: 'uppercase', color}}>
                {/cas /i.test(title) ? 'ÉTUDE DE CAS' : 'HISTOIRE'}
              </span>
              <div style={{flex: 1, height: '1px', background: `linear-gradient(90deg, ${color}30, transparent)`, marginLeft: '16px'}} />
            </div>
          </Anim>
          <Anim type="slide" delay={6}>
            <h3 style={{fontSize: '54px', fontWeight: 900, color: '#f1f5f9', margin: '0 0 24px', lineHeight: 1.2,
              textShadow: '0 2px 20px rgba(0,0,0,0.3)'}}>
              {title}
            </h3>
          </Anim>
          <Anim type="blur" delay={12}>
            <Glass accent="left" color={color} padding="40px 48px" scanLine scanColor={color}
              style={{background: `linear-gradient(135deg, ${color}05, rgba(255,255,255,0.02))`}}>
              <TypewriterText text={text} startFrame={15}
                style={{fontSize: '29px', lineHeight: 1.75, color: '#cbd5e1'}} />
            </Glass>
          </Anim>
        </div>
      </Slide>
    );
  }

  // ── FULLSCREEN variant: dramatic centered text with large icon
  if (variant === 'fullscreen') {
    return (
      <Slide color={color} chapterTitle={chTitle}>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 100px'}}>
          <Anim type="zoom" delay={0}>
            <div style={{
              width: '130px', height: '130px', borderRadius: '40px',
              background: `linear-gradient(135deg, ${color}15, ${color}05)`,
              border: `2px solid ${color}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '70px', marginBottom: '36px',
              boxShadow: `0 12px 50px ${color}20, 0 0 80px ${color}08`,
            }}>{icon}</div>
          </Anim>
          {title && (
            <Anim type="slide" delay={8}>
              <h3 style={{fontSize: '56px', fontWeight: 900, color: '#f1f5f9', margin: '0 0 32px', lineHeight: 1.2, maxWidth: '1300px'}}>
                <ShimmerText color={color} style={{fontSize: '56px', fontWeight: 900}}>{title}</ShimmerText>
              </h3>
            </Anim>
          )}
          <Anim type="blur" delay={14}>
            <p style={{fontSize: '36px', lineHeight: 1.65, color: '#cbd5e1', margin: 0, maxWidth: '1100px'}}>
              <TypewriterText text={text} startFrame={16} framesPerWord={3}
                style={{fontSize: '36px', lineHeight: 1.65, color: '#cbd5e1'}} />
            </p>
          </Anim>
        </div>
      </Slide>
    );
  }

  // ── ICON variant: centered compact
  if (variant === 'icon') {
    return (
      <Slide color={color} chapterTitle={chTitle}>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 60px'}}>
          <Anim type="pop" delay={0}>
            <div style={{
              width: '100px', height: '100px', borderRadius: '30px',
              background: `${color}12`, border: `2px solid ${color}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '50px', marginBottom: '28px',
              boxShadow: `0 8px 40px ${color}15, 0 0 60px ${color}06`,
            }}>{icon}</div>
          </Anim>
          {title && (
            <Anim type="slide" delay={6}>
              <h3 style={{fontSize: '52px', fontWeight: 900, color: '#f1f5f9', margin: '0 0 28px', lineHeight: 1.2, maxWidth: '1300px'}}>{title}</h3>
            </Anim>
          )}
          <Anim type="blur" delay={12}>
            <Glass padding="44px 56px" glow style={{maxWidth: '1200px', borderTop: `3px solid ${color}25`}}>
              <TypewriterText text={text} startFrame={14}
                style={{fontSize: '32px', lineHeight: 1.7, color: '#cbd5e1', textAlign: 'center'}} />
            </Glass>
          </Anim>
        </div>
      </Slide>
    );
  }

  // ── DEFINITION variant: dictionary-style
  if (variant === 'definition') {
    return (
      <Slide color={color} chapterTitle={chTitle}>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px'}}>
          <Anim type="fade" delay={0}>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
              <div style={{width: '28px', height: '28px', borderRadius: '8px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <span style={{fontSize: '14px'}}>📖</span>
              </div>
              <span style={{fontSize: '14px', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', color: '#64748b'}}>DÉFINITION</span>
            </div>
          </Anim>

          <Anim type="slide" delay={4}>
            <h3 style={{fontSize: '64px', fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1}}>
              <ShimmerText color={color} style={{fontSize: '64px', fontWeight: 900}}>{title}</ShimmerText>
            </h3>
            <div style={{width: '120px', height: '4px', borderRadius: '2px', background: color, marginBottom: '32px', boxShadow: `0 0 15px ${color}40`}} />
          </Anim>

          <Anim type="blur" delay={10}>
            <AnimatedBorderCard color={color} delay={10} padding="40px 48px">
              <TypewriterText text={text} startFrame={14}
                style={{fontSize: '30px', lineHeight: 1.8, color: '#cbd5e1', fontStyle: 'italic'}} />
            </AnimatedBorderCard>
          </Anim>
        </div>
      </Slide>
    );
  }

  // ── SPLIT variant: left keyword + right explanation
  if (variant === 'split') {
    const keyword = title.split(/\s+/).slice(0, 3).join(' ');
    return (
      <Slide color={color} chapterTitle={chTitle}>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '40px', alignItems: 'center'}}>
          {/* Left: visual emphasis */}
          <Anim type="slideR" delay={4}>
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px'}}>
              <div style={{
                width: '120px', height: '120px', borderRadius: '36px',
                background: `linear-gradient(135deg, ${color}18, ${color}06)`,
                border: `2px solid ${color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '64px',
                boxShadow: `0 12px 50px ${color}20`,
              }}>{icon}</div>
              <h3 style={{fontSize: '44px', fontWeight: 900, color: '#f1f5f9', margin: 0, lineHeight: 1.2}}>{keyword}</h3>
              <div style={{width: '80px', height: '4px', borderRadius: '2px', background: color}} />
            </div>
          </Anim>

          {/* Right: explanation */}
          <Anim type="slideL" delay={10}>
            <Glass padding="40px 44px" accent="left" color={color} scanLine scanColor={color} glow>
              <h4 style={{fontSize: '32px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 16px'}}>{title}</h4>
              <TypewriterText text={text} startFrame={14}
                style={{fontSize: '28px', lineHeight: 1.7, color: '#cbd5e1'}} />
            </Glass>
          </Anim>
        </div>
      </Slide>
    );
  }

  // ── DEFAULT variant
  return (
    <Slide color={color} chapterTitle={chTitle}>
      {title && <SlideTitle color={color} icon={icon}>{title}</SlideTitle>}
      <Anim type="blur" delay={10} style={{flex: 1, display: 'flex', alignItems: 'center'}}>
        <Glass padding="44px 52px" accent="top" color={color} scanLine scanColor={color} glow>
          <TypewriterText text={text} startFrame={12}
            style={{fontSize: '30px', lineHeight: 1.8, color: '#cbd5e1'}} />
        </Glass>
      </Anim>
    </Slide>
  );
};

// ── TABLE ────────────────────────────────────────────────────────────

const TableSlideComp: React.FC<{title?: string; headers: string[]; rows: string[][]; color: string; chTitle: string}> = ({title, headers, rows, color, chTitle}) => (
  <Slide color={color} chapterTitle={chTitle}>
    {title && <SlideTitle color={color} icon="📊">{title}</SlideTitle>}
    <Anim type="scale" delay={8} style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
      <div style={{
        borderRadius: '20px', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: `0 12px 50px rgba(0,0,0,0.4), 0 0 60px ${color}05`,
      }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${headers.length}, 1fr)`,
          background: `linear-gradient(135deg, ${color}15, ${color}05)`,
          padding: '22px 32px', gap: '16px',
          borderBottom: `2px solid ${color}20`,
        }}>
          {headers.map((h, i) => (
            <span key={i} style={{fontSize: '20px', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '1.5px'}}>{h}</span>
          ))}
        </div>
        {/* Rows */}
        {rows.slice(0, 8).map((row, ri) => (
          <Anim key={ri} type="slideR" delay={12 + ri * 4}>
            <div style={{
              display: 'grid', gridTemplateColumns: `repeat(${headers.length}, 1fr)`,
              padding: '20px 32px', gap: '16px',
              borderTop: ri > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: ri % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            }}>
              {row.map((cell, ci) => (
                <span key={ci} style={{
                  fontSize: '25px', color: ci === 0 ? '#f1f5f9' : '#94a3b8',
                  fontWeight: ci === 0 ? 700 : 400,
                }}>{cell}</span>
              ))}
            </div>
          </Anim>
        ))}
      </div>
    </Anim>
  </Slide>
);

// ── QUOTE ────────────────────────────────────────────────────────────

const QuoteSlideComp: React.FC<{text: string; source?: string; color: string; chTitle: string}> = ({text, source, color, chTitle}) => {
  const frame = useCurrentFrame();
  return (
    <Slide color={color} chapterTitle={chTitle}>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 80px'}}>
        {/* Giant quotation mark */}
        <Anim type="zoom" delay={0}>
          <div style={{fontSize: '200px', fontWeight: 900, color: `${color}30`, lineHeight: 0.5, fontFamily: 'Georgia, serif', marginBottom: '-10px',
            textShadow: `0 0 60px ${color}15`}}>"</div>
        </Anim>
        <Anim type="blur" delay={8}>
          <p style={{fontSize: '44px', lineHeight: 1.55, textAlign: 'center', fontStyle: 'italic', color: '#f1f5f9', maxWidth: '1200px', margin: '0 0 36px', fontWeight: 500}}>
            <TypewriterText text={text} startFrame={10} framesPerWord={3}
              style={{fontSize: '44px', lineHeight: 1.55, fontStyle: 'italic', color: '#f1f5f9', fontWeight: 500}} />
          </p>
        </Anim>
        {source && (
          <Anim type="fade" delay={20}>
            <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
              <div style={{width: '60px', height: '3px', background: `linear-gradient(90deg, transparent, ${color})`, borderRadius: '2px', boxShadow: `0 0 10px ${color}40`}} />
              <span style={{fontSize: '24px', color: '#94a3b8', fontWeight: 600}}>{source}</span>
              <div style={{width: '60px', height: '3px', background: `linear-gradient(90deg, ${color}, transparent)`, borderRadius: '2px', boxShadow: `0 0 10px ${color}40`}} />
            </div>
          </Anim>
        )}
      </div>
    </Slide>
  );
};

// ── STEPS ────────────────────────────────────────────────────────────

const StepsSlideComp: React.FC<{title?: string; steps: {number: number; title: string; description: string}[]; color: string; chTitle: string}> = ({title, steps, color, chTitle}) => {
  const frame = useCurrentFrame();
  return (
    <Slide color={color} chapterTitle={chTitle}>
      {title && <SlideTitle color={color} icon="🔄">{title}</SlideTitle>}
      <div style={{
        display: 'grid',
        gridTemplateColumns: steps.length <= 3 ? `repeat(${steps.length}, 1fr)` : 'repeat(2, 1fr)',
        gap: '20px', flex: 1, alignContent: 'center',
      }}>
        {steps.slice(0, 6).map((step, i) => (
          <Anim key={i} type="pop" delay={8 + i * 7}>
            <AnimatedBorderCard color={color} delay={8 + i * 7} padding="32px" style={{position: 'relative', overflow: 'visible'}}>
              {/* Step number floating badge */}
              <div style={{
                position: 'absolute', top: '-18px', left: '28px',
                width: '50px', height: '50px', borderRadius: '16px',
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', fontWeight: 900, color: 'white',
                boxShadow: `0 6px 25px ${color}50, 0 0 40px ${color}20`,
              }}>{step.number}</div>
              {/* Connector line between steps */}
              {i < steps.length - 1 && i % 2 === 0 && steps.length > 1 && (
                <div style={{
                  position: 'absolute', right: -16, top: '50%',
                  width: '32px', height: '2px',
                  background: `linear-gradient(90deg, ${color}30, transparent)`,
                }} />
              )}
              <div style={{marginTop: '14px'}}>
                <h4 style={{fontSize: '28px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 10px'}}>{step.title}</h4>
                <p style={{fontSize: '23px', color: '#94a3b8', margin: 0, lineHeight: 1.5}}>{step.description}</p>
              </div>
            </AnimatedBorderCard>
          </Anim>
        ))}
      </div>
    </Slide>
  );
};

// ── WARNING ──────────────────────────────────────────────────────────

const WarningSlideComp: React.FC<{title?: string; text: string; color: string; chTitle: string}> = ({title, text, color, chTitle}) => {
  const frame = useCurrentFrame();
  const pulse = 0.3 + Math.sin(frame * 0.06) * 0.15;
  const glowSize = 60 + Math.sin(frame * 0.06) * 25;

  return (
    <Slide color={color} variant="warning" chapterTitle={chTitle}>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 40px'}}>
        <Anim type="scale" delay={0}>
          <div style={{
            background: 'rgba(239,68,68,0.03)',
            border: `2px solid rgba(239,68,68,${pulse})`,
            borderRadius: '28px', padding: '56px 64px', maxWidth: '1350px',
            boxShadow: `0 0 ${glowSize}px rgba(239,68,68,${pulse * 0.2}), inset 0 0 60px rgba(239,68,68,0.02)`,
            position: 'relative',
          }}>
            {/* Floating icon with pulse */}
            <div style={{
              position: 'absolute', top: '-32px', left: '50%', transform: 'translateX(-50%)',
            }}>
              <div style={{
                position: 'absolute', inset: -8, borderRadius: '24px',
                border: `1px solid rgba(239,68,68,${pulse * 0.5})`,
                boxShadow: `0 0 ${20 + Math.sin(frame * 0.06) * 10}px rgba(239,68,68,${pulse * 0.3})`,
              }} />
              <div style={{
                width: '64px', height: '64px', borderRadius: '20px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '32px', boxShadow: '0 8px 30px rgba(239,68,68,0.5)',
              }}>⚠️</div>
            </div>
            <h4 style={{color: '#ef4444', fontSize: '42px', fontWeight: 900, margin: '20px 0 24px', textAlign: 'center'}}>
              {title || 'Attention'}
            </h4>
            <TypewriterText text={text} startFrame={10}
              style={{fontSize: '30px', lineHeight: 1.7, color: '#cbd5e1', textAlign: 'center', display: 'block'}} />
          </div>
        </Anim>
      </div>
    </Slide>
  );
};

// ── TIP ──────────────────────────────────────────────────────────────

const TipSlideComp: React.FC<{title?: string; text: string; color: string; chTitle: string}> = ({title, text, color, chTitle}) => (
  <Slide color={color} chapterTitle={chTitle}>
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 60px'}}>
      <Anim type="pop" delay={0}>
        <Glass padding="52px 60px" scanLine scanColor={color} glow style={{
          maxWidth: '1400px',
          background: `linear-gradient(135deg, ${color}05, rgba(139,92,246,0.03))`,
          borderLeft: `6px solid ${color}`,
          position: 'relative', overflow: 'visible',
        }}>
          {/* Floating icon */}
          <div style={{
            position: 'absolute', top: '-26px', left: '44px',
          }}>
            <div style={{
              width: '54px', height: '54px', borderRadius: '18px',
              background: `linear-gradient(135deg, ${color}, #8b5cf6)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', boxShadow: `0 8px 30px ${color}50, 0 0 40px ${color}20`,
            }}>💡</div>
          </div>
          <div style={{marginTop: '10px'}}>
            <span style={{fontSize: '17px', fontWeight: 800, letterSpacing: '5px', textTransform: 'uppercase', color}}>PRO TIP</span>
            {title && <h4 style={{fontSize: '36px', fontWeight: 800, color: '#f1f5f9', margin: '14px 0 20px'}}>{title}</h4>}
            <TypewriterText text={text} startFrame={12}
              style={{fontSize: '30px', lineHeight: 1.7, color: '#cbd5e1'}} />
          </div>
        </Glass>
      </Anim>
    </div>
  </Slide>
);

// ── SUMMARY ──────────────────────────────────────────────────────────

const SummarySlideComp: React.FC<{title?: string; items: string[]; color: string; chTitle: string}> = ({title, items, color, chTitle}) => (
  <Slide color={color} chapterTitle={chTitle}>
    <SlideTitle color={color} icon="📌">{title || 'À Retenir'}</SlideTitle>
    <div style={{
      display: 'grid', gridTemplateColumns: items.length <= 3 ? '1fr' : '1fr 1fr',
      gap: '16px', flex: 1, alignContent: 'center',
    }}>
      {items.map((item, i) => (
        <Anim key={i} type="slideR" delay={8 + i * 6}>
          <Glass padding="22px 28px" glow style={{background: `${color}04`, borderColor: `${color}12`}}>
            <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                border: `1px solid ${color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: 900, color,
                boxShadow: `0 2px 10px ${color}15`,
              }}>✓</div>
              <p style={{fontSize: '26px', margin: 0, color: '#e2e8f0', lineHeight: 1.45}}>{item}</p>
            </div>
          </Glass>
        </Anim>
      ))}
    </div>
  </Slide>
);

// ── COMPARISON ───────────────────────────────────────────────────────

const ComparisonSlideComp: React.FC<{title?: string; left: {label: string; items: string[]}; right: {label: string; items: string[]}; color: string; chTitle: string}> = ({title, left, right, color, chTitle}) => (
  <Slide color={color} chapterTitle={chTitle}>
    {title && (
      <Anim type="slide" delay={0}>
        <h3 style={{fontSize: '48px', fontWeight: 900, color: '#f1f5f9', margin: '0 0 32px', textAlign: 'center'}}>{title}</h3>
      </Anim>
    )}
    <div style={{display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: '16px', flex: 1, alignContent: 'center'}}>
      {/* Left — positive */}
      <Anim type="slideR" delay={8}>
        <Glass padding="32px" scanLine scanColor="#22c55e" style={{background: 'rgba(34,197,94,0.03)', borderColor: 'rgba(34,197,94,0.12)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
            <div style={{width: '8px', height: '36px', borderRadius: '4px', background: '#22c55e', boxShadow: '0 0 15px rgba(34,197,94,0.5)'}} />
            <span style={{color: '#22c55e', fontSize: '24px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px'}}>{left.label}</span>
          </div>
          {left.items.map((item, i) => (
            <Anim key={i} type="slideR" delay={14 + i * 4}>
              <div style={{display: 'flex', gap: '14px', marginBottom: '16px', alignItems: 'flex-start'}}>
                <span style={{color: '#22c55e', fontSize: '22px', fontWeight: 900, flexShrink: 0}}>✓</span>
                <span style={{fontSize: '26px', color: '#e2e8f0', lineHeight: 1.4}}>{item}</span>
              </div>
            </Anim>
          ))}
        </Glass>
      </Anim>

      {/* VS badge */}
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Anim type="pop" delay={16}>
          <div style={{
            width: '68px', height: '68px', borderRadius: '22px',
            background: `${color}12`, border: `2px solid ${color}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 900, color,
            boxShadow: `0 4px 25px ${color}20, 0 0 40px ${color}08`,
          }}>VS</div>
        </Anim>
      </div>

      {/* Right — negative */}
      <Anim type="slideL" delay={10}>
        <Glass padding="32px" scanLine scanColor="#ef4444" style={{background: 'rgba(239,68,68,0.03)', borderColor: 'rgba(239,68,68,0.12)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
            <div style={{width: '8px', height: '36px', borderRadius: '4px', background: '#ef4444', boxShadow: '0 0 15px rgba(239,68,68,0.5)'}} />
            <span style={{color: '#ef4444', fontSize: '24px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px'}}>{right.label}</span>
          </div>
          {right.items.map((item, i) => (
            <Anim key={i} type="slideL" delay={16 + i * 4}>
              <div style={{display: 'flex', gap: '14px', marginBottom: '16px', alignItems: 'flex-start'}}>
                <span style={{color: '#ef4444', fontSize: '22px', fontWeight: 900, flexShrink: 0}}>✗</span>
                <span style={{fontSize: '26px', color: '#e2e8f0', lineHeight: 1.4}}>{item}</span>
              </div>
            </Anim>
          ))}
        </Glass>
      </Anim>
    </div>
  </Slide>
);

// ── QUIZ ─────────────────────────────────────────────────────────────

const QuizSlideComp: React.FC<{question: string; choices: string[]; correctIndex: number; explanation?: string; color: string; chTitle: string}> = ({question, choices, correctIndex, explanation, color, chTitle}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const revealF = fps * 5;
  const explainF = fps * 7;
  const isRevealed = frame >= revealF;
  const showExp = frame >= explainF;
  const rp = isRevealed ? spring({frame: frame - revealF, fps, config: {damping: 12}}) : 0;
  const ep = showExp ? spring({frame: frame - explainF, fps, config: {damping: 12}}) : 0;
  const countdown = Math.max(0, Math.ceil((revealF - frame) / fps));
  const timerProgress = Math.min(1, frame / revealF);

  // SVG timer arc
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - timerProgress);

  return (
    <Slide color={color} variant="quiz" chapterTitle={chTitle}>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 40px', gap: '28px'}}>
        {/* Quiz header with timer */}
        <Anim type="pop" delay={0}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
              {/* Pulsing quiz badge */}
              <div style={{position: 'relative'}}>
                <div style={{
                  position: 'absolute', inset: -6,
                  borderRadius: '20px',
                  border: `2px solid rgba(245,158,11,${0.15 + Math.sin(frame * 0.08) * 0.1})`,
                  boxShadow: `0 0 ${20 + Math.sin(frame * 0.08) * 10}px rgba(245,158,11,0.1)`,
                }} />
                <div style={{
                  background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.3)',
                  borderRadius: '16px', padding: '12px 30px',
                }}>
                  <span style={{color: '#f59e0b', fontSize: '24px', fontWeight: 900, letterSpacing: '6px'}}>🧠 QUIZ</span>
                </div>
              </div>
              {!isRevealed && <span style={{color: '#64748b', fontSize: '22px', fontWeight: 500}}>Prenez un moment pour réfléchir...</span>}
            </div>
            {/* Circular SVG timer */}
            {!isRevealed && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <svg width="56" height="56" style={{transform: 'rotate(-90deg)'}}>
                  <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <circle cx="28" cy="28" r={radius} fill="none"
                    stroke={timerProgress > 0.7 ? '#ef4444' : '#f59e0b'}
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <span style={{fontSize: '36px', fontWeight: 900, color: '#f59e0b', fontVariantNumeric: 'tabular-nums', width: '35px', textAlign: 'center'}}>
                  {countdown}
                </span>
              </div>
            )}
          </div>
        </Anim>

        {/* Question */}
        <Anim type="slide" delay={4}>
          <h3 style={{fontSize: '44px', fontWeight: 900, lineHeight: 1.35, maxWidth: '1500px', color: '#f1f5f9', margin: 0}}>{question}</h3>
        </Anim>

        {/* Choices */}
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '1650px'}}>
          {choices.map((choice, i) => {
            const isCorrect = i === correctIndex;
            const letter = String.fromCharCode(65 + i);
            let bg = 'rgba(255,255,255,0.03)';
            let bc = 'rgba(255,255,255,0.08)';
            let tc = '#e2e8f0';
            let shadow = 'none';

            if (isRevealed) {
              if (isCorrect) {
                bg = `rgba(34,197,94,${0.12*rp})`;
                bc = `rgba(34,197,94,${0.5*rp})`;
                tc = '#22c55e';
                shadow = `0 0 40px rgba(34,197,94,${0.25*rp}), 0 0 80px rgba(34,197,94,${0.1*rp})`;
              } else {
                bg = `rgba(239,68,68,${0.05*rp})`;
                bc = `rgba(239,68,68,${0.2*rp})`;
                tc = '#475569';
              }
            }

            return (
              <Anim key={i} type="pop" delay={8 + i * 4}>
                <div style={{
                  background: bg, border: `2px solid ${bc}`, borderRadius: '20px',
                  padding: '24px 30px', display: 'flex', gap: '18px', alignItems: 'center',
                  transform: isRevealed && isCorrect ? `scale(${1+0.03*rp})` : 'none',
                  boxShadow: shadow,
                }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '16px', flexShrink: 0,
                    background: isRevealed && isCorrect ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '24px', fontWeight: 900,
                    color: isRevealed && isCorrect ? 'white' : '#94a3b8',
                    border: `1px solid ${isRevealed && isCorrect ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: isRevealed && isCorrect ? '0 4px 15px rgba(34,197,94,0.4)' : 'none',
                  }}>{isRevealed && isCorrect ? '✓' : letter}</div>
                  <span style={{fontSize: '27px', color: tc, fontWeight: isRevealed && isCorrect ? 700 : 400}}>{choice}</span>
                </div>
              </Anim>
            );
          })}
        </div>

        {/* Confetti on reveal */}
        <ConfettiBurst active={isRevealed} startFrame={revealF} />

        {/* Explanation */}
        {explanation && showExp && (
          <div style={{opacity: ep, transform: `translateY(${(1-ep)*15}px)`}}>
            <Glass padding="24px 32px" accent="left" color="#22c55e" glow style={{background: 'rgba(34,197,94,0.04)'}}>
              <div style={{display: 'flex', gap: '14px', alignItems: 'flex-start'}}>
                <span style={{fontSize: '28px', flexShrink: 0}}>💡</span>
                <p style={{fontSize: '26px', lineHeight: 1.5, margin: 0, color: '#e2e8f0'}}>{explanation}</p>
              </div>
            </Glass>
          </div>
        )}
      </div>
    </Slide>
  );
};

// ── OUTRO ────────────────────────────────────────────────────────────

const OutroSlide: React.FC<{cfg: SeriesConfig}> = ({cfg}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ac = cfg.accentColor || '#3b82f6';

  return (
    <div style={{width: W, height: H, position: 'relative', fontFamily: FONT, overflow: 'hidden'}}>
      <PremiumBg color={ac} variant="chapter" />
      <FloatingParticles color={`${ac}40`} />
      <LightStreak color={ac} delay={fps * 0.3} />
      <LightStreak color="#8b5cf6" delay={fps * 1} angle={-30} />

      <div style={{position: 'relative', zIndex: 10, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
        <Anim type="zoom" delay={0}>
          <div style={{position: 'relative'}}>
            <div style={{
              position: 'absolute', inset: -15, borderRadius: '50%',
              border: `2px solid ${ac}20`,
              boxShadow: `0 0 40px ${ac}10`,
            }} />
            <div style={{
              width: '120px', height: '120px', borderRadius: '50%',
              border: `3px solid ${ac}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 60px ${ac}15`,
              background: 'rgba(0,0,0,0.3)',
            }}>
              <Img src={staticFile('logo.png')} style={{width: 68, height: 68}} />
            </div>
          </div>
        </Anim>
        <Anim type="slide" delay={fps * 0.5}>
          <h2 style={{fontSize: '56px', fontWeight: 900, color: '#f1f5f9', margin: '28px 0 16px', maxWidth: '1200px'}}>{cfg.seriesTitle}</h2>
        </Anim>
        <Anim type="blur" delay={fps * 1}>
          <p style={{color: '#94a3b8', fontSize: '30px', margin: '0 0 32px'}}>
            {cfg.language === 'fr' ? 'Merci d\'avoir regardé cette série.' : 'Thank you for watching.'}
          </p>
        </Anim>
        <Anim type="scale" delay={fps * 1.5}>
          <div style={{
            background: 'rgba(239,68,68,0.05)', padding: '18px 40px', borderRadius: '18px',
            border: '1px solid rgba(239,68,68,0.15)', marginBottom: '28px',
          }}>
            <span style={{color: '#ef4444', fontSize: '24px', fontWeight: 700}}>
              {cfg.language === 'fr' ? 'Ceci n\'est pas un conseil financier.' : 'This is not financial advice.'}
            </span>
          </div>
        </Anim>
        <Anim type="fade" delay={fps * 2}>
          <span style={{color: '#50b4ee', fontSize: '30px', fontWeight: 700}}>articles.dailytickers.com</span>
        </Anim>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// ── RENDER MAP ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

function renderSlide(slide: ContentSlide, color: string, chTitle: string): React.ReactNode {
  switch (slide.type) {
    case 'chapter-intro': return null;
    case 'bullets': return <BulletsSlide title={slide.title} items={slide.items!} color={color} chTitle={chTitle} />;
    case 'concept': return <ConceptSlideComp slide={slide} color={color} chTitle={chTitle} />;
    case 'table': return <TableSlideComp title={slide.title} headers={slide.headers!} rows={slide.rows!} color={color} chTitle={chTitle} />;
    case 'quote': return <QuoteSlideComp text={slide.text!} source={slide.source} color={color} chTitle={chTitle} />;
    case 'steps': return <StepsSlideComp title={slide.title} steps={slide.steps!} color={color} chTitle={chTitle} />;
    case 'warning': return <WarningSlideComp title={slide.title} text={slide.text!} color={color} chTitle={chTitle} />;
    case 'tip': return <TipSlideComp title={slide.title} text={slide.text!} color={color} chTitle={chTitle} />;
    case 'summary': return <SummarySlideComp title={slide.title} items={slide.items!} color={color} chTitle={chTitle} />;
    case 'comparison': return <ComparisonSlideComp title={slide.title} left={slide.left!} right={slide.right!} color={color} chTitle={chTitle} />;
    case 'quiz': return <QuizSlideComp question={slide.question!} choices={slide.choices!} correctIndex={slide.correctIndex!} explanation={slide.explanation} color={color} chTitle={chTitle} />;
    case 'metric': return <ConceptSlideComp slide={{...slide, type: 'concept'}} color={color} chTitle={chTitle} />;
    case 'highlight': return <ConceptSlideComp slide={{...slide, type: 'concept', text: slide.text || slide.title || ''}} color={color} chTitle={chTitle} />;
    default: return <ConceptSlideComp slide={slide} color={color} chTitle={chTitle} />;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ── MAIN COMPONENT ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

export interface EducationalVideoProps {
  config: SeriesConfig;
  slides: ContentSlide[];
  audioDurations: Record<string, number>;
}

export const EducationalVideo: React.FC<EducationalVideoProps> = (props) => {
  const {slides, audioDurations} = props;
  globalConfig = props.config;
  const {fps} = useVideoConfig();
  const introDuration = 6 * fps;
  const outroDuration = 6 * fps;
  const sequences: React.ReactNode[] = [];
  let cursor = 0;

  const chapterMap = buildChapterMap(slides);

  // Total frames for progress
  let totalFrames = introDuration + outroDuration;
  slides.forEach((slide, i) => {
    const ak = slide.audioFile?.replace('.wav', '') || `slide_${i}`;
    totalFrames += Math.ceil(((audioDurations[ak] || 12) + 1.5) * fps);
  });

  // Intro
  sequences.push(
    <Sequence key="intro" from={cursor} durationInFrames={introDuration}>
      <CrossfadeSlide durationInFrames={introDuration}>
        <IntroSlide cfg={globalConfig} />
      </CrossfadeSlide>
    </Sequence>
  );
  cursor += introDuration;

  // Slides
  slides.forEach((slide, i) => {
    const ak = slide.audioFile?.replace('.wav', '') || `slide_${i}`;
    const dur = Math.ceil(((audioDurations[ak] || 12) + 1.5) * fps);
    const ch = chapterMap[i] || {idx: 0, color: CHAPTER_COLORS[0], title: '', icon: CHAPTER_ICONS[0], total: globalConfig.totalChapters};
    const progress = cursor / totalFrames;

    if (slide.type === 'chapter-intro') {
      sequences.push(
        <Sequence key={`s${i}`} from={cursor} durationInFrames={dur}>
          <CrossfadeSlide durationInFrames={dur}>
            <ChapterSlide ch={slide.chapter!} idx={ch.idx} total={ch.total} color={ch.color} />
          </CrossfadeSlide>
          <HUD progress={progress} chapterIdx={ch.idx} chapterTitle={ch.title} chapterColor={ch.color} totalCh={ch.total} cfg={globalConfig} slideIdx={i} totalSlides={slides.length} />
        </Sequence>
      );
    } else {
      sequences.push(
        <Sequence key={`s${i}`} from={cursor} durationInFrames={dur}>
          <CrossfadeSlide durationInFrames={dur}>
            {renderSlide(slide, ch.color, ch.title)}
          </CrossfadeSlide>
          <HUD progress={progress} chapterIdx={ch.idx} chapterTitle={ch.title} chapterColor={ch.color} totalCh={ch.total} cfg={globalConfig} slideIdx={i} totalSlides={slides.length} />
        </Sequence>
      );
    }

    if (slide.audioFile && audioDurations[ak] && audioDurations[ak] > 0) {
      sequences.push(
        <Sequence key={`a${i}`} from={cursor} durationInFrames={dur}>
          <Audio src={staticFile(`audio/${slide.audioFile}`)} />
        </Sequence>
      );
    }

    cursor += dur;
  });

  // Outro
  sequences.push(
    <Sequence key="outro" from={cursor} durationInFrames={outroDuration}>
      <CrossfadeSlide durationInFrames={outroDuration}>
        <OutroSlide cfg={globalConfig} />
      </CrossfadeSlide>
    </Sequence>
  );

  return <div style={{position: 'relative', width: W, height: H, overflow: 'hidden', background: '#06080f'}}>{sequences}</div>;
};

export function calculateEducationalDuration(slides: ContentSlide[], audioDurations: Record<string, number>, fps: number): number {
  let total = 12 * fps; // intro + outro
  slides.forEach((slide, i) => {
    const ak = slide.audioFile?.replace('.wav', '') || `slide_${i}`;
    total += Math.ceil(((audioDurations[ak] || 12) + 1.5) * fps);
  });
  return total;
}
