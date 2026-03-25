import React from 'react';
import {
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
  interpolate,
  spring,
  Img,
} from 'remotion';
import {AnimatedCounter} from './components/shared/AnimatedCounter';

// ── Types ────────────────────────────────────────────────────────────

export interface TickerSlide {
  type: string;
  title?: string;
  text?: string;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  chapter?: {title: string; partNumber: number; totalParts: number};
  metricValue?: number;
  metricSuffix?: string;
  metricLabel?: string;
  audioFile?: string;
}

export interface TickerConfig {
  seriesTitle: string;
  seriesSubtitle?: string;
  date: string;
  language: string;
  accentColor?: string;
  totalChapters: number;
  ticker?: string;
  tickerName?: string;
  tickerPrice?: string;
  tickerChange?: string;
  finvizChart?: string;
  tickerLogo?: string;
  tickerMarketCap?: string;
  tickerDividend?: string;
  tickerGrade?: string;
}

// ── Constants ────────────────────────────────────────────────────────

const FONT = "'Inter', -apple-system, sans-serif";
const W = 1920;
const H = 1080;
const BOTTOM_BAR_H = 50;
const CONTENT_H = H - BOTTOM_BAR_H;
const MARGIN = 60;
const TRANSITION_FRAMES = 15;
const PROGRESS_BAR_H = 4;

const CHAPTER_BACKGROUNDS = [
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1920&q=80', // stock trading screens
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80', // corporate skyscraper
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=80', // data analytics dashboard
  'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1920&q=80', // stock market chart
  'https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=1920&q=80', // oil refinery
];

const CHAPTER_EMOJIS: Record<string, string> = {
  verdict: '\u{1F4CA}',
  business: '\u{1F4BC}',
  technical: '\u{1F4C8}',
  risk: '\u{26A0}\uFE0F',
  trade: '\u{1F3AF}',
  fundamental: '\u{1F4BC}',
  valuation: '\u{1F4CA}',
  overview: '\u{1F4CA}',
  catalyst: '\u{1F3AF}',
  default: '\u{1F4CA}',
};

// ── Duration Calculation ─────────────────────────────────────────────

export function calculateTickerDuration(
  slides: TickerSlide[],
  audioDurations: Record<string, number>,
  fps: number,
): number {
  let total = 0;
  slides.forEach((slide, i) => {
    const ak = slide.audioFile?.replace('.wav', '') || `slide_${i}`;
    total += Math.ceil(((audioDurations[ak] || 12) + 1.5) * fps);
  });
  return total;
}

// ── Helpers ──────────────────────────────────────────────────────────

function fadeSlideUp(frame: number, fps: number, delay = 0) {
  const opacity = interpolate(frame - delay, [0, fps * 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame - delay, [0, fps * 0.4], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return {opacity, transform: `translateY(${y}px)`};
}

function fadeIn(frame: number, fps: number, delay = 0) {
  const opacity = interpolate(frame - delay, [0, fps * 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return {opacity};
}

function slideFromLeft(frame: number, fps: number, delay = 0) {
  const progress = spring({frame: frame - delay, fps, config: {damping: 18, stiffness: 120}});
  return {
    opacity: progress,
    transform: `translateX(${interpolate(progress, [0, 1], [-80, 0])}px)`,
  };
}

function slideFromRight(frame: number, fps: number, delay = 0) {
  const progress = spring({frame: frame - delay, fps, config: {damping: 18, stiffness: 120}});
  return {
    opacity: progress,
    transform: `translateX(${interpolate(progress, [0, 1], [80, 0])}px)`,
  };
}

function scaleIn(frame: number, fps: number, delay = 0) {
  const progress = spring({frame: frame - delay, fps, config: {damping: 18}});
  return {
    opacity: progress,
    transform: `scale(${interpolate(progress, [0, 1], [0.85, 1])})`,
  };
}

function getAccent(config: TickerConfig): string {
  return config.accentColor || '#3b82f6';
}

function getBackgroundIndex(slideIndex: number): number {
  return slideIndex % CHAPTER_BACKGROUNDS.length;
}

function getChapterEmoji(title: string): string {
  const lower = title.toLowerCase();
  for (const [key, emoji] of Object.entries(CHAPTER_EMOJIS)) {
    if (key !== 'default' && lower.includes(key)) return emoji;
  }
  return CHAPTER_EMOJIS.default;
}

function getGradeColor(grade: string): string {
  const g = grade.toUpperCase();
  if (g.startsWith('A')) return '#22c55e';
  if (g.startsWith('B')) return '#3b82f6';
  if (g.startsWith('C')) return '#f59e0b';
  if (g.startsWith('D')) return '#ef4444';
  return '#64748b';
}

// ── Ken Burns Background ─────────────────────────────────────────────

const KenBurnsBackground: React.FC<{
  imageUrl: string;
  overlayOpacity?: number;
}> = ({imageUrl, overlayOpacity = 0.88}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.12], {
    extrapolateRight: 'clamp',
  });
  const translateX = interpolate(frame, [0, durationInFrames], [0, -15], {
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [0, durationInFrames], [0, -8], {
    extrapolateRight: 'clamp',
  });

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: -40,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(255,255,255,${overlayOpacity})`,
        }}
      />
    </>
  );
};

// ── Top Progress Bar ─────────────────────────────────────────────────

const TopProgressBar: React.FC<{
  currentAbsoluteFrame: number;
  totalFrames: number;
  accent: string;
}> = ({currentAbsoluteFrame, totalFrames, accent}) => {
  const progress = Math.min(currentAbsoluteFrame / Math.max(totalFrames, 1), 1);
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: W,
        height: PROGRESS_BAR_H,
        background: 'rgba(0,0,0,0.08)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: '100%',
          background: accent,
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
  );
};

// ── Bottom Bar ───────────────────────────────────────────────────────

const BottomBar: React.FC<{config: TickerConfig}> = ({config}) => {
  const accent = getAccent(config);
  const changeColor =
    config.tickerChange && config.tickerChange.startsWith('-')
      ? '#ef4444'
      : '#22c55e';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: W,
        height: BOTTOM_BAR_H,
        background: accent,
        display: 'flex',
        alignItems: 'center',
        padding: '0 40px',
        fontFamily: FONT,
        gap: 28,
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 15,
          color: '#fff',
        }}
      >
        MW
      </div>
      <span style={{color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: 2}}>
        {config.ticker || ''}
      </span>
      <span style={{color: 'rgba(255,255,255,0.7)', fontSize: 18}}>|</span>
      <span style={{color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: 500}}>
        {config.tickerName || ''}
      </span>
      <span style={{color: 'rgba(255,255,255,0.7)', fontSize: 18}}>|</span>
      <span style={{color: '#fff', fontSize: 20, fontWeight: 700}}>
        {config.tickerPrice || ''}
      </span>
      {config.tickerChange && (
        <>
          <span style={{color: 'rgba(255,255,255,0.7)', fontSize: 18}}>|</span>
          <span
            style={{
              color: changeColor,
              fontSize: 20,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.15)',
              padding: '2px 10px',
              borderRadius: 6,
            }}
          >
            {config.tickerChange}
          </span>
        </>
      )}
      <div style={{flex: 1}} />
      <span style={{color: 'rgba(255,255,255,0.6)', fontSize: 14}}>
        {config.date}
      </span>
    </div>
  );
};

// ── Floating Particles ───────────────────────────────────────────────

const FloatingParticles: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  const particles = [
    {x: 200, y: 300, size: 6, speed: 0.8, phase: 0},
    {x: 600, y: 150, size: 4, speed: 1.2, phase: 1.5},
    {x: 1200, y: 400, size: 5, speed: 0.6, phase: 3},
    {x: 1600, y: 200, size: 7, speed: 1.0, phase: 0.8},
    {x: 400, y: 700, size: 3, speed: 1.4, phase: 2.2},
    {x: 1000, y: 600, size: 5, speed: 0.9, phase: 4.0},
    {x: 1500, y: 800, size: 4, speed: 1.1, phase: 1.0},
  ];

  return (
    <>
      {particles.map((p, i) => {
        const yOffset = Math.sin((frame * p.speed * 0.02) + p.phase) * 30;
        const xOffset = Math.cos((frame * p.speed * 0.015) + p.phase) * 20;
        const opacity = interpolate(
          Math.sin((frame * 0.03) + p.phase),
          [-1, 1],
          [0.05, 0.15],
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x + xOffset,
              top: p.y + yOffset,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: accent,
              opacity,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
};

// ── Slide Renderers ──────────────────────────────────────────────────

// ── Title/Intro Slide ────────────────────────────────────────────────

const TitleSlide: React.FC<{slide: TickerSlide; config: TickerConfig; bgIndex: number}> = ({
  slide,
  config,
  bgIndex,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);

  const logoScale = spring({frame: frame - 5, fps, config: {damping: 14, stiffness: 100}});
  const nameAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.3));
  const statsAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.6));
  const badgeAnim = scaleIn(frame, fps, Math.floor(fps * 0.5));

  const changeColor =
    config.tickerChange && config.tickerChange.startsWith('-') ? '#ef4444' : '#22c55e';

  return (
    <div
      style={{
        width: W,
        height: CONTENT_H,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        overflow: 'hidden',
      }}
    >
      <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} overlayOpacity={0.82} />
      <FloatingParticles accent={accent} />

      {/* Ticker Badge */}
      <div
        style={{
          position: 'relative',
          marginBottom: 32,
          transform: `scale(${logoScale})`,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: accent,
            boxShadow: `0 12px 48px ${accent}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{color: '#fff', fontSize: 40, fontWeight: 800, letterSpacing: 2}}>
            {config.ticker || ''}
          </span>
        </div>
      </div>

      {/* Ticker Symbol */}
      <div
        style={{
          position: 'relative',
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: 6,
          color: accent,
          background: `${accent}15`,
          padding: '8px 32px',
          borderRadius: 12,
          marginBottom: 16,
          ...nameAnim,
        }}
      >
        {config.ticker || ''}
      </div>

      {/* Company Name */}
      <div
        style={{
          position: 'relative',
          fontSize: 72,
          fontWeight: 800,
          color: '#0f172a',
          textAlign: 'center',
          maxWidth: W - MARGIN * 4,
          lineHeight: 1.15,
          marginBottom: 16,
          ...nameAnim,
        }}
      >
        {config.tickerName || slide.title || ''}
      </div>

      {/* Subtitle */}
      {slide.text && (
        <div
          style={{
            position: 'relative',
            fontSize: 36,
            fontWeight: 500,
            color: '#64748b',
            textAlign: 'center',
            maxWidth: W - MARGIN * 4,
            marginBottom: 24,
            ...nameAnim,
          }}
        >
          {slide.text}
        </div>
      )}

      {/* Grade Badge */}
      {config.tickerGrade && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 40,
            ...badgeAnim,
          }}
        >
          <div
            style={{
              background: getGradeColor(config.tickerGrade),
              color: '#fff',
              fontSize: 28,
              fontWeight: 800,
              padding: '10px 28px',
              borderRadius: 14,
              letterSpacing: 2,
            }}
          >
            Grade {config.tickerGrade}
          </div>
        </div>
      )}

      {/* Key Stats Row */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          gap: 48,
          alignItems: 'center',
          ...statsAnim,
        }}
      >
        {config.tickerPrice && (
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: 44, fontWeight: 800, color: '#0f172a'}}>
              {config.tickerPrice}
            </div>
            <div style={{fontSize: 18, color: '#64748b', fontWeight: 600, marginTop: 4}}>
              Price
            </div>
          </div>
        )}
        {config.tickerChange && (
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: 44, fontWeight: 800, color: changeColor}}>
              {config.tickerChange}
            </div>
            <div style={{fontSize: 18, color: '#64748b', fontWeight: 600, marginTop: 4}}>
              Change
            </div>
          </div>
        )}
        {config.tickerMarketCap && (
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: 44, fontWeight: 800, color: '#0f172a'}}>
              {config.tickerMarketCap}
            </div>
            <div style={{fontSize: 18, color: '#64748b', fontWeight: 600, marginTop: 4}}>
              Market Cap
            </div>
          </div>
        )}
        {config.tickerDividend && (
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: 44, fontWeight: 800, color: '#0f172a'}}>
              {config.tickerDividend}
            </div>
            <div style={{fontSize: 18, color: '#64748b', fontWeight: 600, marginTop: 4}}>
              Div. Yield
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Chapter Intro Slide ──────────────────────────────────────────────

const ChapterIntroSlide: React.FC<{
  slide: TickerSlide;
  config: TickerConfig;
  bgIndex: number;
}> = ({slide, config, bgIndex}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const chapter = slide.chapter;

  const circleScale = spring({frame, fps, config: {damping: 14}});
  const titleAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.3));
  const subtitleAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.5));
  const emoji = getChapterEmoji(chapter?.title || '');

  return (
    <div
      style={{
        width: W,
        height: CONTENT_H,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} />
      <FloatingParticles accent={accent} />

      {/* Ticker Badge small */}
      {config.ticker && (
        <div
          style={{
            position: 'relative',
            marginBottom: 24,
            transform: `scale(${circleScale})`,
            opacity: circleScale,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{color: '#fff', fontSize: 18, fontWeight: 800}}>
              {config.ticker}
            </span>
          </div>
        </div>
      )}

      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 48,
          fontWeight: 800,
          transform: `scale(${circleScale})`,
          marginBottom: 36,
          position: 'relative',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        {chapter?.partNumber || ''}
      </div>
      <div
        style={{
          fontSize: 68,
          fontWeight: 800,
          color: '#0f172a',
          textAlign: 'center',
          maxWidth: W - MARGIN * 2,
          lineHeight: 1.2,
          position: 'relative',
          ...titleAnim,
        }}
      >
        {emoji} {chapter?.title || ''}
      </div>
      <div
        style={{
          fontSize: 26,
          color: '#64748b',
          marginTop: 20,
          fontWeight: 500,
          position: 'relative',
          ...subtitleAnim,
        }}
      >
        Part {chapter?.partNumber || 1} of {chapter?.totalParts || config.totalChapters}
      </div>
    </div>
  );
};

// ── Metric Slide ─────────────────────────────────────────────────────

const MetricSlide: React.FC<{slide: TickerSlide; config: TickerConfig; bgIndex: number}> = ({
  slide,
  config,
  bgIndex,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const titleAnim = fadeSlideUp(frame, fps, 0);
  const labelAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.6));

  const ringProgress = spring({frame: frame - 5, fps, config: {damping: 22}});
  const circumference = 2 * Math.PI * 140;
  const percent = (slide.metricValue || 0) / 100;
  const strokeDashoffset = circumference * (1 - percent * ringProgress);

  return (
    <div
      style={{
        width: W,
        height: CONTENT_H,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} />
      <FloatingParticles accent={accent} />

      <div
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: 60,
          textAlign: 'center',
          maxWidth: W - MARGIN * 2,
          position: 'relative',
          ...titleAnim,
        }}
      >
        {'\u{1F3C6}'} {slide.title || ''}
      </div>

      <div style={{position: 'relative', width: 320, height: 320}}>
        <svg
          width={320}
          height={320}
          style={{position: 'absolute', top: 0, left: 0}}
        >
          <circle cx={160} cy={160} r={140} fill="none" stroke="#e2e8f0" strokeWidth={12} />
          <circle
            cx={160}
            cy={160}
            r={140}
            fill="none"
            stroke={accent}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 160 160)"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AnimatedCounter
            value={slide.metricValue || 0}
            suffix={slide.metricSuffix || ''}
            delay={5}
            style={{fontSize: 120, fontWeight: 800, color: '#0f172a'}}
          />
        </div>
      </div>

      <div
        style={{
          fontSize: 32,
          color: '#64748b',
          fontWeight: 600,
          marginTop: 32,
          position: 'relative',
          ...labelAnim,
        }}
      >
        {slide.metricLabel || ''}
      </div>
    </div>
  );
};

// ── Bullets Slide (with Bull/Bear two-column + S/R ladder) ───────────

const BulletsSlide: React.FC<{slide: TickerSlide; config: TickerConfig; bgIndex: number}> = ({
  slide,
  config,
  bgIndex,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const items = slide.items || [];
  const titleAnim = fadeSlideUp(frame, fps, 0);

  // Detect bull/bear pattern
  const bulls = items.filter((item) => item.startsWith('\u{1F7E2}'));
  const bears = items.filter((item) => item.startsWith('\u{1F534}'));
  const hasBullBear = bulls.length > 0 && bears.length > 0;

  // Detect support/resistance pattern
  const isSR =
    slide.title !== undefined &&
    (slide.title.toLowerCase().includes('support') ||
      slide.title.toLowerCase().includes('resistance'));
  const srItems = isSR
    ? items.map((item) => {
        const isSupport =
          item.toLowerCase().includes('support') || item.startsWith('\u{1F7E2}');
        const priceMatch = item.match(/\$?([\d,.]+)/);
        const price = priceMatch ? priceMatch[1] : '';
        const label = item.replace(/^[\u{1F7E2}\u{1F534}]\s*/u, '').trim();
        return {isSupport, price, label};
      })
    : [];

  // ── S/R Price Ladder ──
  if (isSR && srItems.length > 0) {
    return (
      <div
        style={{
          width: W,
          height: CONTENT_H,
          fontFamily: FONT,
          position: 'relative',
          padding: `80px ${MARGIN}px`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} />
        <FloatingParticles accent={accent} />

        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: 48,
            position: 'relative',
            ...titleAnim,
          }}
        >
          {'\u{1F4C8}'} {slide.title || ''}
          <div
            style={{width: 60, height: 4, background: accent, borderRadius: 2, marginTop: 14}}
          />
        </div>

        <div
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 16,
            maxWidth: 1400,
          }}
        >
          {/* Current price marker */}
          {config.tickerPrice && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 8,
                ...fadeIn(frame, fps, Math.floor(fps * 0.3)),
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: accent,
                  border: '3px solid #fff',
                  boxShadow: `0 0 0 3px ${accent}`,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 3,
                  background: accent,
                  borderRadius: 2,
                }}
              />
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: accent,
                  minWidth: 140,
                  textAlign: 'right',
                }}
              >
                {config.tickerPrice} (Current)
              </span>
            </div>
          )}

          {srItems.map((sr, i) => {
            const barColor = sr.isSupport ? '#22c55e' : '#ef4444';
            const barBg = sr.isSupport ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
            const anim = fadeSlideUp(frame, fps, Math.floor(fps * 0.15 * (i + 1)));
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  ...anim,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: barColor,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    height: 44,
                    background: barBg,
                    borderLeft: `5px solid ${barColor}`,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 24px',
                  }}
                >
                  <span style={{fontSize: 26, color: '#334155', fontWeight: 500, flex: 1}}>
                    {sr.label}
                  </span>
                  {sr.price && (
                    <span style={{fontSize: 28, fontWeight: 700, color: barColor}}>
                      ${sr.price}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Bull vs Bear Two-Column ──
  if (hasBullBear) {
    return (
      <div
        style={{
          width: W,
          height: CONTENT_H,
          fontFamily: FONT,
          position: 'relative',
          padding: `80px ${MARGIN}px`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} />
        <FloatingParticles accent={accent} />

        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: 40,
            position: 'relative',
            ...titleAnim,
          }}
        >
          {slide.title || ''}
          <div
            style={{width: 60, height: 4, background: accent, borderRadius: 2, marginTop: 14}}
          />
        </div>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            gap: 32,
            flex: 1,
          }}
        >
          {/* Bulls Column */}
          <div
            style={{
              flex: 1,
              background: 'rgba(34,197,94,0.06)',
              borderLeft: '5px solid #22c55e',
              borderRadius: 16,
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              ...slideFromLeft(frame, fps, Math.floor(fps * 0.2)),
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: '#22c55e',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'inline-block',
                }}
              />
              Bull Case
            </div>
            {bulls.map((item, i) => {
              const clean = item.replace(/^[\u{1F7E2}]\s*/u, '');
              const anim = fadeSlideUp(frame, fps, Math.floor(fps * 0.15 * (i + 2)));
              return (
                <div key={i} style={{display: 'flex', alignItems: 'flex-start', gap: 14, ...anim}}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#22c55e',
                      marginTop: 10,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{fontSize: 28, color: '#334155', lineHeight: 1.45, fontWeight: 500}}>
                    {clean}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bears Column */}
          <div
            style={{
              flex: 1,
              background: 'rgba(239,68,68,0.06)',
              borderLeft: '5px solid #ef4444',
              borderRadius: 16,
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              ...slideFromRight(frame, fps, Math.floor(fps * 0.2)),
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: '#ef4444',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#ef4444',
                  display: 'inline-block',
                }}
              />
              Bear Case
            </div>
            {bears.map((item, i) => {
              const clean = item.replace(/^[\u{1F534}]\s*/u, '');
              const anim = fadeSlideUp(frame, fps, Math.floor(fps * 0.15 * (i + 2)));
              return (
                <div key={i} style={{display: 'flex', alignItems: 'flex-start', gap: 14, ...anim}}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#ef4444',
                      marginTop: 10,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{fontSize: 28, color: '#334155', lineHeight: 1.45, fontWeight: 500}}>
                    {clean}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Default Bullets ──
  return (
    <div
      style={{
        width: W,
        height: CONTENT_H,
        fontFamily: FONT,
        position: 'relative',
        padding: `80px ${MARGIN}px`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} />
      <FloatingParticles accent={accent} />

      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: 44,
          position: 'relative',
          ...titleAnim,
        }}
      >
        {slide.title || ''}
        <div
          style={{width: 60, height: 4, background: accent, borderRadius: 2, marginTop: 14}}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          position: 'relative',
        }}
      >
        {items.map((item, i) => {
          const itemAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.15 * (i + 1)));
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 18,
                ...itemAnim,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: accent,
                  marginTop: 10,
                  flexShrink: 0,
                }}
              />
              <span style={{fontSize: 32, color: '#334155', lineHeight: 1.5, fontWeight: 500}}>
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Concept Slide (with Finviz chart support) ────────────────────────

const ConceptSlide: React.FC<{slide: TickerSlide; config: TickerConfig; bgIndex: number}> = ({
  slide,
  config,
  bgIndex,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const titleAnim = fadeSlideUp(frame, fps, 0);
  const textAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.2));
  const hasChart =
    config.finvizChart &&
    slide.title &&
    slide.title.toLowerCase().includes('price action');

  return (
    <div
      style={{
        width: W,
        height: CONTENT_H,
        fontFamily: FONT,
        position: 'relative',
        padding: `80px ${MARGIN}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: hasChart ? 'flex-start' : 'center',
        overflow: 'hidden',
      }}
    >
      <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} />
      <FloatingParticles accent={accent} />

      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: 28,
          position: 'relative',
          ...titleAnim,
        }}
      >
        {slide.title || ''}
        <div
          style={{width: 60, height: 4, background: accent, borderRadius: 2, marginTop: 14}}
        />
      </div>

      {hasChart ? (
        <div
          style={{
            ...textAnim,
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <p
            style={{
              fontSize: 28,
              color: '#334155',
              lineHeight: 1.6,
              maxWidth: W - MARGIN * 2,
              margin: 0,
            }}
          >
            {slide.text || ''}
          </p>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '95%',
              maxHeight: 600,
              alignSelf: 'center',
              background: '#f8fafc',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              padding: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            }}
          >
            <Img
              src={staticFile(config.finvizChart!)}
              style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}}
            />
          </div>
        </div>
      ) : (
        <p
          style={{
            fontSize: 34,
            color: '#334155',
            lineHeight: 1.6,
            maxWidth: 1400,
            margin: 0,
            position: 'relative',
            ...textAnim,
          }}
        >
          {slide.text || ''}
        </p>
      )}
    </div>
  );
};

// ── Table Slide (Key Metrics with signal badges) ─────────────────────

const TableSlide: React.FC<{slide: TickerSlide; config: TickerConfig; bgIndex: number}> = ({
  slide,
  config,
  bgIndex,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const headers = slide.headers || [];
  const rows = slide.rows || [];
  const titleAnim = fadeSlideUp(frame, fps, 0);

  function signalStyle(val: string): {bg: string; color: string} {
    const lower = val.toLowerCase();
    if (
      lower.includes('strong') ||
      lower.includes('solid') ||
      lower.includes('good') ||
      lower.includes('lower vol') ||
      lower.includes('large cap') ||
      lower.includes('bullish') ||
      lower.includes('positive')
    )
      return {bg: 'rgba(34,197,94,0.15)', color: '#16a34a'};
    if (
      lower.includes('weak') ||
      lower.includes('poor') ||
      lower.includes('high') ||
      lower.includes('bearish') ||
      lower.includes('negative')
    )
      return {bg: 'rgba(239,68,68,0.15)', color: '#dc2626'};
    return {bg: 'rgba(100,116,139,0.12)', color: '#64748b'};
  }

  return (
    <div
      style={{
        width: W,
        height: CONTENT_H,
        fontFamily: FONT,
        position: 'relative',
        padding: `80px ${MARGIN}px`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} />
      <FloatingParticles accent={accent} />

      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: 44,
          position: 'relative',
          ...titleAnim,
        }}
      >
        {slide.title || ''}
      </div>
      <div
        style={{
          position: 'relative',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          ...scaleIn(frame, fps, Math.floor(fps * 0.15)),
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            borderBottom: `3px solid ${accent}`,
            background: '#f8fafc',
          }}
        >
          {headers.map((h, i) => (
            <div
              key={i}
              style={{
                flex: i === 0 ? 2 : 1,
                padding: '22px 28px',
                fontSize: 26,
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {h}
            </div>
          ))}
        </div>
        {/* Rows */}
        {rows.map((row, ri) => {
          const rowAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.12 * (ri + 1)));
          return (
            <div
              key={ri}
              style={{
                display: 'flex',
                background: ri % 2 === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(248,250,252,0.9)',
                borderBottom: ri < rows.length - 1 ? '1px solid #f1f5f9' : 'none',
                ...rowAnim,
              }}
            >
              {row.map((cell, ci) => {
                const isSignal =
                  ci === headers.length - 1 && headers[ci]?.toLowerCase() === 'signal';
                const isValue = ci === 1;
                if (isSignal) {
                  const ss = signalStyle(cell);
                  return (
                    <div
                      key={ci}
                      style={{
                        flex: 1,
                        padding: '20px 28px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          background: ss.bg,
                          color: ss.color,
                          fontSize: 22,
                          fontWeight: 700,
                          padding: '6px 18px',
                          borderRadius: 20,
                          display: 'inline-block',
                        }}
                      >
                        {cell}
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={ci}
                    style={{
                      flex: ci === 0 ? 2 : 1,
                      padding: '20px 28px',
                      fontSize: isValue ? 32 : 28,
                      color: '#334155',
                      fontWeight: isValue ? 700 : 400,
                    }}
                  >
                    {cell}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Tip Slide ────────────────────────────────────────────────────────

const TipSlide: React.FC<{slide: TickerSlide; bgIndex: number; config: TickerConfig}> = ({
  slide,
  bgIndex,
  config,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const anim = scaleIn(frame, fps, 0);

  return (
    <div
      style={{
        width: W,
        height: CONTENT_H,
        fontFamily: FONT,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `0 ${MARGIN}px`,
        overflow: 'hidden',
      }}
    >
      <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} />
      <FloatingParticles accent={getAccent(config)} />

      <div
        style={{
          background: 'rgba(240,253,244,0.95)',
          borderLeft: '6px solid #22c55e',
          borderRadius: 16,
          padding: '48px 52px',
          maxWidth: 1500,
          display: 'flex',
          gap: 28,
          alignItems: 'flex-start',
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
          position: 'relative',
          ...anim,
        }}
      >
        <div style={{fontSize: 48, flexShrink: 0, marginTop: -4}}>
          {'\u{1F4A1}'}
        </div>
        <p
          style={{
            fontSize: 36,
            color: '#334155',
            lineHeight: 1.6,
            margin: 0,
            fontWeight: 500,
          }}
        >
          {slide.text || ''}
        </p>
      </div>
    </div>
  );
};

// ── Warning Slide (Full amber/red gradient) ──────────────────────────

const WarningSlide: React.FC<{slide: TickerSlide; bgIndex: number; config: TickerConfig}> = ({
  slide,
  bgIndex,
  config,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const anim = scaleIn(frame, fps, 0);
  const iconPulse = interpolate(
    Math.sin(frame * 0.12),
    [-1, 1],
    [0.95, 1.08],
  );

  return (
    <div
      style={{
        width: W,
        height: CONTENT_H,
        fontFamily: FONT,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `0 ${MARGIN}px`,
        overflow: 'hidden',
      }}
    >
      <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} overlayOpacity={0.85} />

      <div
        style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 40%, #fecaca 100%)',
          borderRadius: 24,
          padding: '64px 72px',
          maxWidth: 1600,
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          boxShadow: '0 12px 48px rgba(245,158,11,0.2), 0 4px 16px rgba(0,0,0,0.06)',
          border: '2px solid rgba(245,158,11,0.3)',
          position: 'relative',
          ...anim,
        }}
      >
        <div
          style={{
            fontSize: 72,
            transform: `scale(${iconPulse})`,
          }}
        >
          {'\u{26A0}\uFE0F'}
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: '#92400e',
            textAlign: 'center',
          }}
        >
          Risk Warning
        </div>
        <p
          style={{
            fontSize: 36,
            color: '#78350f',
            lineHeight: 1.6,
            margin: 0,
            fontWeight: 600,
            textAlign: 'center',
            maxWidth: 1300,
          }}
        >
          {slide.text || ''}
        </p>
      </div>
    </div>
  );
};

// ── Highlight / Trade Idea Slide ─────────────────────────────────────

const HighlightSlide: React.FC<{slide: TickerSlide; config: TickerConfig; bgIndex: number}> = ({
  slide,
  config,
  bgIndex,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const titleAnim = fadeSlideUp(frame, fps, 0);
  const cardAnim = scaleIn(frame, fps, Math.floor(fps * 0.2));

  // Parse pipe-separated values
  const entries = (slide.text || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const colonIdx = s.indexOf(':');
      if (colonIdx > 0) {
        return {key: s.slice(0, colonIdx).trim(), value: s.slice(colonIdx + 1).trim()};
      }
      return {key: '', value: s};
    });

  // Detect special fields for color coding
  function getCardStyle(key: string): {bg: string; border: string; textColor: string} {
    const lower = key.toLowerCase();
    if (lower.includes('target') || lower.includes('tp'))
      return {bg: 'rgba(34,197,94,0.15)', border: '#22c55e', textColor: '#16a34a'};
    if (lower.includes('stop') || lower.includes('sl'))
      return {bg: 'rgba(239,68,68,0.15)', border: '#ef4444', textColor: '#dc2626'};
    if (lower.includes('r/r') || lower.includes('ratio') || lower.includes('reward'))
      return {bg: 'rgba(59,130,246,0.15)', border: '#3b82f6', textColor: '#2563eb'};
    return {bg: 'rgba(255,255,255,0.15)', border: 'rgba(255,255,255,0.3)', textColor: '#fff'};
  }

  // Find R/R entry for badge
  const rrEntry = entries.find(
    (e) =>
      e.key.toLowerCase().includes('r/r') ||
      e.key.toLowerCase().includes('ratio') ||
      e.key.toLowerCase().includes('reward'),
  );

  return (
    <div
      style={{
        width: W,
        height: CONTENT_H,
        fontFamily: FONT,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `0 ${MARGIN}px`,
        overflow: 'hidden',
      }}
    >
      <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} overlayOpacity={0.85} />
      <FloatingParticles accent={accent} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 40,
          position: 'relative',
          ...titleAnim,
        }}
      >
        <span style={{fontSize: 44}}>{'\u{1F3AF}'}</span>
        <div style={{fontSize: 48, fontWeight: 800, color: '#0f172a'}}>
          {slide.title || ''}
        </div>
        {rrEntry && (
          <div
            style={{
              background: '#3b82f6',
              color: '#fff',
              fontSize: 24,
              fontWeight: 800,
              padding: '8px 20px',
              borderRadius: 12,
              marginLeft: 16,
            }}
          >
            R/R {rrEntry.value}
          </div>
        )}
      </div>

      <div
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          borderRadius: 24,
          padding: '48px 56px',
          maxWidth: 1500,
          width: '100%',
          display: 'grid',
          gridTemplateColumns:
            entries.length > 4 ? 'repeat(3, 1fr)' : `repeat(${Math.min(entries.length, 3)}, 1fr)`,
          gap: '24px 32px',
          position: 'relative',
          boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
          ...cardAnim,
        }}
      >
        {entries.map((entry, i) => {
          const cs = entry.key ? getCardStyle(entry.key) : null;
          const isSpecial = cs && cs.textColor !== '#fff';
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: isSpecial ? cs!.bg : 'rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: '20px 24px',
                borderLeft: isSpecial ? `4px solid ${cs!.border}` : '4px solid rgba(255,255,255,0.2)',
              }}
            >
              {entry.key && (
                <span
                  style={{
                    fontSize: 18,
                    color: isSpecial ? cs!.textColor : 'rgba(255,255,255,0.7)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                  }}
                >
                  {entry.key}
                </span>
              )}
              <span
                style={{
                  fontSize: 32,
                  color: isSpecial ? cs!.textColor : '#fff',
                  fontWeight: 700,
                  lineHeight: 1.3,
                }}
              >
                {entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Summary Slide ────────────────────────────────────────────────────

const SummarySlide: React.FC<{slide: TickerSlide; config: TickerConfig; bgIndex: number}> = ({
  slide,
  config,
  bgIndex,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const items = slide.items || [];
  const titleAnim = fadeSlideUp(frame, fps, 0);

  return (
    <div
      style={{
        width: W,
        height: CONTENT_H,
        fontFamily: FONT,
        position: 'relative',
        padding: `80px ${MARGIN}px`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} />
      <FloatingParticles accent={accent} />

      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: 44,
          position: 'relative',
          ...titleAnim,
        }}
      >
        {'\u{1F4CA}'} {slide.title || ''}
      </div>
      <div
        style={{
          position: 'relative',
          background: 'rgba(248,250,252,0.95)',
          borderRadius: 20,
          padding: '44px 52px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
        }}
      >
        {items.map((item, i) => {
          const itemAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.2 * (i + 1)));
          return (
            <div
              key={i}
              style={{display: 'flex', alignItems: 'flex-start', gap: 22, ...itemAnim}}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: accent,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 800,
                  flexShrink: 0,
                  boxShadow: `0 4px 12px ${accent}40`,
                }}
              >
                {i + 1}
              </div>
              <span
                style={{
                  fontSize: 30,
                  color: '#334155',
                  lineHeight: 1.5,
                  fontWeight: 500,
                  paddingTop: 6,
                }}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Slide Router ─────────────────────────────────────────────────────

const SlideContent: React.FC<{
  slide: TickerSlide;
  config: TickerConfig;
  slideIndex: number;
}> = ({slide, config, slideIndex}) => {
  const bgIndex = getBackgroundIndex(slideIndex);

  switch (slide.type) {
    case 'title':
      return <TitleSlide slide={slide} config={config} bgIndex={bgIndex} />;
    case 'chapter-intro':
      return <ChapterIntroSlide slide={slide} config={config} bgIndex={bgIndex} />;
    case 'metric':
      return <MetricSlide slide={slide} config={config} bgIndex={bgIndex} />;
    case 'bullets':
      return <BulletsSlide slide={slide} config={config} bgIndex={bgIndex} />;
    case 'concept':
      return <ConceptSlide slide={slide} config={config} bgIndex={bgIndex} />;
    case 'table':
      return <TableSlide slide={slide} config={config} bgIndex={bgIndex} />;
    case 'tip':
      return <TipSlide slide={slide} bgIndex={bgIndex} config={config} />;
    case 'warning':
      return <WarningSlide slide={slide} bgIndex={bgIndex} config={config} />;
    case 'highlight':
      return <HighlightSlide slide={slide} config={config} bgIndex={bgIndex} />;
    case 'summary':
      return <SummarySlide slide={slide} config={config} bgIndex={bgIndex} />;
    default:
      return (
        <div
          style={{
            width: W,
            height: CONTENT_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT,
            fontSize: 36,
            color: '#64748b',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <KenBurnsBackground imageUrl={CHAPTER_BACKGROUNDS[bgIndex]} />
          <span style={{position: 'relative'}}>Unsupported slide type: {slide.type}</span>
        </div>
      );
  }
};

// ── Crossfade Wrapper ────────────────────────────────────────────────

const CrossfadeSlide: React.FC<{
  slide: TickerSlide;
  config: TickerConfig;
  slideIndex: number;
  durationInFrames: number;
}> = ({slide, config, slideIndex, durationInFrames}) => {
  const frame = useCurrentFrame();

  // Fade in over TRANSITION_FRAMES at start
  const fadeInOpacity = interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out over TRANSITION_FRAMES at end
  const fadeOutOpacity = interpolate(
    frame,
    [durationInFrames - TRANSITION_FRAMES, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);

  return (
    <div style={{opacity, width: W, height: H}}>
      <SlideContent slide={slide} config={config} slideIndex={slideIndex} />
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────

export const TickerAnalysisVideo: React.FC<{
  config: TickerConfig;
  slides: TickerSlide[];
  audioDurations: Record<string, number>;
}> = ({config, slides, audioDurations}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);

  const sequences: React.ReactNode[] = [];
  let offset = 0;
  const totalDuration = calculateTickerDuration(slides, audioDurations, fps);

  slides.forEach((slide, i) => {
    const audioKey = slide.audioFile?.replace('.wav', '') || `slide_${i}`;
    const audioDur = audioDurations[audioKey] || 12;
    const durationInFrames = Math.ceil((audioDur + 1.5) * fps);

    sequences.push(
      <Sequence key={i} from={offset} durationInFrames={durationInFrames}>
        <CrossfadeSlide
          slide={slide}
          config={config}
          slideIndex={i}
          durationInFrames={durationInFrames}
        />
        {slide.audioFile && (
          <Audio src={staticFile('audio/' + slide.audioFile)} volume={1} />
        )}
      </Sequence>,
    );

    offset += durationInFrames;
  });

  return (
    <div
      style={{
        position: 'relative',
        width: W,
        height: H,
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      {sequences}
      <BottomBar config={config} />
      <TopProgressBar currentAbsoluteFrame={frame} totalFrames={totalDuration} accent={accent} />
    </div>
  );
};
