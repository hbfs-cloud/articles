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
}

// ── Constants ────────────────────────────────────────────────────────

const FONT = "'Inter', -apple-system, sans-serif";
const W = 1920;
const H = 1080;
const BOTTOM_BAR_H = 60;
const CONTENT_H = H - BOTTOM_BAR_H;
const MARGIN = 100;
const TRANSITION_FRAMES = 8;

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

// ── Grid Background ──────────────────────────────────────────────────

const GridBackground: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: '#ffffff',
      backgroundImage:
        'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
      backgroundSize: '60px 60px',
    }}
  />
);

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
        gap: 32,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 18,
          color: '#fff',
        }}
      >
        MW
      </div>
      <span style={{color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: 2}}>
        {config.ticker || ''}
      </span>
      <span style={{color: 'rgba(255,255,255,0.7)', fontSize: 20}}>|</span>
      <span style={{color: 'rgba(255,255,255,0.9)', fontSize: 20, fontWeight: 500}}>
        {config.tickerName || ''}
      </span>
      <span style={{color: 'rgba(255,255,255,0.7)', fontSize: 20}}>|</span>
      <span style={{color: '#fff', fontSize: 22, fontWeight: 700}}>
        {config.tickerPrice || ''}
      </span>
      {config.tickerChange && (
        <>
          <span style={{color: 'rgba(255,255,255,0.7)', fontSize: 20}}>|</span>
          <span
            style={{
              color: changeColor,
              fontSize: 22,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.15)',
              padding: '2px 12px',
              borderRadius: 6,
            }}
          >
            {config.tickerChange}
          </span>
        </>
      )}
      <div style={{flex: 1}} />
      <span style={{color: 'rgba(255,255,255,0.6)', fontSize: 16}}>
        {config.date}
      </span>
    </div>
  );
};

// ── Slide Renderers ──────────────────────────────────────────────────

const ChapterIntroSlide: React.FC<{slide: TickerSlide; config: TickerConfig}> = ({
  slide,
  config,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const chapter = slide.chapter;

  const circleScale = spring({frame, fps, config: {damping: 14}});
  const titleAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.3));
  const subtitleAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.5));

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
      }}
    >
      <GridBackground />
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 52,
          fontWeight: 800,
          transform: `scale(${circleScale})`,
          marginBottom: 40,
        }}
      >
        {chapter?.partNumber || ''}
      </div>
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: '#0f172a',
          textAlign: 'center',
          maxWidth: W - MARGIN * 2,
          lineHeight: 1.2,
          ...titleAnim,
        }}
      >
        {chapter?.title || ''}
      </div>
      <div
        style={{
          fontSize: 28,
          color: '#64748b',
          marginTop: 24,
          fontWeight: 500,
          ...subtitleAnim,
        }}
      >
        Part {chapter?.partNumber || 1} of {chapter?.totalParts || config.totalChapters}
      </div>
    </div>
  );
};

const MetricSlide: React.FC<{slide: TickerSlide; config: TickerConfig}> = ({
  slide,
  config,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const titleAnim = fadeSlideUp(frame, fps, 0);
  const labelAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.6));

  // Progress ring
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
      }}
    >
      <GridBackground />
      <div
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: 60,
          textAlign: 'center',
          maxWidth: W - MARGIN * 2,
          ...titleAnim,
        }}
      >
        {slide.title || ''}
      </div>

      <div style={{position: 'relative', width: 320, height: 320}}>
        <svg
          width={320}
          height={320}
          style={{position: 'absolute', top: 0, left: 0}}
        >
          <circle
            cx={160}
            cy={160}
            r={140}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={12}
          />
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
            style={{
              fontSize: 120,
              fontWeight: 800,
              color: '#0f172a',
            }}
          />
        </div>
      </div>

      <div
        style={{
          fontSize: 32,
          color: '#64748b',
          fontWeight: 600,
          marginTop: 32,
          ...labelAnim,
        }}
      >
        {slide.metricLabel || ''}
      </div>
    </div>
  );
};

const BulletsSlide: React.FC<{slide: TickerSlide; config: TickerConfig}> = ({
  slide,
  config,
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
      }}
    >
      <GridBackground />
      <div
        style={{
          fontSize: 52,
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: 48,
          position: 'relative',
          ...titleAnim,
        }}
      >
        {slide.title || ''}
        <div
          style={{
            width: 60,
            height: 4,
            background: accent,
            borderRadius: 2,
            marginTop: 16,
          }}
        />
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 20, position: 'relative'}}>
        {items.map((item, i) => {
          const itemAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.15 * (i + 1)));
          const isBull = item.startsWith('\u{1F7E2}');
          const isBear = item.startsWith('\u{1F534}');
          const dotColor = isBull ? '#22c55e' : isBear ? '#ef4444' : accent;
          const cleanText = item.replace(/^[\u{1F7E2}\u{1F534}]\s*/u, '');

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 20,
                ...itemAnim,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: dotColor,
                  marginTop: 10,
                  flexShrink: 0,
                }}
              />
              <span style={{fontSize: 34, color: '#334155', lineHeight: 1.5, fontWeight: 500}}>
                {cleanText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ConceptSlide: React.FC<{slide: TickerSlide; config: TickerConfig}> = ({
  slide,
  config,
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
      }}
    >
      <GridBackground />
      <div
        style={{
          fontSize: 52,
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: 32,
          position: 'relative',
          ...titleAnim,
        }}
      >
        {slide.title || ''}
        <div
          style={{
            width: 60,
            height: 4,
            background: accent,
            borderRadius: 2,
            marginTop: 16,
          }}
        />
      </div>

      {hasChart ? (
        <div style={{...textAnim, position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 24}}>
          <p
            style={{
              fontSize: 30,
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
              background: '#f8fafc',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              padding: 20,
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
            fontSize: 36,
            color: '#334155',
            lineHeight: 1.6,
            maxWidth: 1200,
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

const TableSlide: React.FC<{slide: TickerSlide; config: TickerConfig}> = ({
  slide,
  config,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const headers = slide.headers || [];
  const rows = slide.rows || [];
  const titleAnim = fadeSlideUp(frame, fps, 0);

  function signalColor(val: string): string | undefined {
    const lower = val.toLowerCase();
    if (
      lower.includes('strong') ||
      lower.includes('solid') ||
      lower.includes('good') ||
      lower.includes('lower vol') ||
      lower.includes('large cap')
    )
      return '#22c55e';
    if (lower.includes('weak') || lower.includes('poor') || lower.includes('high'))
      return '#ef4444';
    return '#64748b';
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
      }}
    >
      <GridBackground />
      <div
        style={{
          fontSize: 52,
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: 48,
          position: 'relative',
          ...titleAnim,
        }}
      >
        {slide.title || ''}
      </div>
      <div
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
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
                padding: '24px 32px',
                fontSize: 28,
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
          const rowAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.15 * (ri + 1)));
          return (
            <div
              key={ri}
              style={{
                display: 'flex',
                background: ri % 2 === 0 ? '#ffffff' : '#f8fafc',
                borderBottom: ri < rows.length - 1 ? '1px solid #f1f5f9' : 'none',
                ...rowAnim,
              }}
            >
              {row.map((cell, ci) => {
                const isSignal = ci === headers.length - 1 && headers[ci]?.toLowerCase() === 'signal';
                return (
                  <div
                    key={ci}
                    style={{
                      flex: ci === 0 ? 2 : 1,
                      padding: '22px 32px',
                      fontSize: 30,
                      color: isSignal ? signalColor(cell) : '#334155',
                      fontWeight: isSignal ? 600 : 400,
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

const TipSlide: React.FC<{slide: TickerSlide}> = ({slide}) => {
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
      }}
    >
      <GridBackground />
      <div
        style={{
          background: '#f0fdf4',
          borderLeft: '6px solid #22c55e',
          borderRadius: 16,
          padding: '48px 56px',
          maxWidth: 1400,
          display: 'flex',
          gap: 32,
          alignItems: 'flex-start',
          boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          position: 'relative',
          ...anim,
        }}
      >
        <div style={{fontSize: 48, flexShrink: 0, marginTop: -4}}>💡</div>
        <p
          style={{
            fontSize: 32,
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

const WarningSlide: React.FC<{slide: TickerSlide}> = ({slide}) => {
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
      }}
    >
      <GridBackground />
      <div
        style={{
          background: '#fef3c7',
          borderLeft: '6px solid #f59e0b',
          borderRadius: 16,
          padding: '48px 56px',
          maxWidth: 1400,
          display: 'flex',
          gap: 32,
          alignItems: 'flex-start',
          boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          position: 'relative',
          ...anim,
        }}
      >
        <div style={{fontSize: 48, flexShrink: 0, marginTop: -4}}>⚠️</div>
        <p
          style={{
            fontSize: 32,
            color: '#92400e',
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

const HighlightSlide: React.FC<{slide: TickerSlide; config: TickerConfig}> = ({
  slide,
  config,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = getAccent(config);
  const titleAnim = fadeSlideUp(frame, fps, 0);
  const cardAnim = scaleIn(frame, fps, Math.floor(fps * 0.2));

  // Parse pipe-separated values into key/value pairs
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
      }}
    >
      <GridBackground />
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
        {slide.title || ''}
      </div>
      <div
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          borderRadius: 24,
          padding: '56px 64px',
          maxWidth: 1400,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: entries.length > 3 ? 'repeat(3, 1fr)' : `repeat(${entries.length}, 1fr)`,
          gap: '32px 48px',
          position: 'relative',
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
          ...cardAnim,
        }}
      >
        {entries.map((entry, i) => (
          <div key={i} style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {entry.key && (
              <span
                style={{
                  fontSize: 20,
                  color: 'rgba(255,255,255,0.7)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                }}
              >
                {entry.key}
              </span>
            )}
            <span style={{fontSize: 36, color: '#fff', fontWeight: 700, lineHeight: 1.3}}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SummarySlide: React.FC<{slide: TickerSlide; config: TickerConfig}> = ({
  slide,
  config,
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
      }}
    >
      <GridBackground />
      <div
        style={{
          fontSize: 52,
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: 48,
          position: 'relative',
          ...titleAnim,
        }}
      >
        {slide.title || ''}
      </div>
      <div
        style={{
          position: 'relative',
          background: '#f8fafc',
          borderRadius: 20,
          padding: '48px 56px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {items.map((item, i) => {
          const itemAnim = fadeSlideUp(frame, fps, Math.floor(fps * 0.2 * (i + 1)));
          return (
            <div
              key={i}
              style={{display: 'flex', alignItems: 'flex-start', gap: 24, ...itemAnim}}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: accent,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <span
                style={{
                  fontSize: 32,
                  color: '#334155',
                  lineHeight: 1.5,
                  fontWeight: 500,
                  paddingTop: 4,
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

const SlideContent: React.FC<{slide: TickerSlide; config: TickerConfig}> = ({
  slide,
  config,
}) => {
  switch (slide.type) {
    case 'chapter-intro':
      return <ChapterIntroSlide slide={slide} config={config} />;
    case 'metric':
      return <MetricSlide slide={slide} config={config} />;
    case 'bullets':
      return <BulletsSlide slide={slide} config={config} />;
    case 'concept':
      return <ConceptSlide slide={slide} config={config} />;
    case 'table':
      return <TableSlide slide={slide} config={config} />;
    case 'tip':
      return <TipSlide slide={slide} />;
    case 'warning':
      return <WarningSlide slide={slide} />;
    case 'highlight':
      return <HighlightSlide slide={slide} config={config} />;
    case 'summary':
      return <SummarySlide slide={slide} config={config} />;
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
          }}
        >
          <GridBackground />
          <span style={{position: 'relative'}}>Unsupported slide type: {slide.type}</span>
        </div>
      );
  }
};

// ── Main Component ───────────────────────────────────────────────────

export const TickerAnalysisVideo: React.FC<{
  config: TickerConfig;
  slides: TickerSlide[];
  audioDurations: Record<string, number>;
}> = ({config, slides, audioDurations}) => {
  const {fps} = useVideoConfig();
  const sequences: React.ReactNode[] = [];
  let offset = 0;

  slides.forEach((slide, i) => {
    const audioKey = slide.audioFile?.replace('.wav', '') || `slide_${i}`;
    const audioDur = audioDurations[audioKey] || 12;
    const durationInFrames = Math.ceil((audioDur + 1.5) * fps);

    sequences.push(
      <Sequence key={i} from={offset} durationInFrames={durationInFrames}>
        <SlideContent slide={slide} config={config} />
        {slide.audioFile && (
          <Audio src={staticFile('audio/' + slide.audioFile)} volume={1} />
        )}
      </Sequence>,
    );

    offset += durationInFrames;
  });

  return (
    <div style={{position: 'relative', width: W, height: H, overflow: 'hidden', background: '#ffffff'}}>
      {sequences}
      <BottomBar config={config} />
    </div>
  );
};
