import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig, staticFile, Img} from 'remotion';
import {theme} from '../../../theme/Theme';

/**
 * 1. Base Animated Element (Motion)
 */
export const Motion: React.FC<{
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  type?: 'fade' | 'slide' | 'scale' | 'pop' | 'slide-right' | 'blur' | 'slide-left';
  style?: React.CSSProperties;
}> = ({children, delay = 0, duration = 30, type = 'fade', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({frame: frame - delay, fps, config: theme.animations.spring});
  
  let animationStyle: React.CSSProperties = {};
  if (type === 'fade') animationStyle = {opacity: progress};
  if (type === 'slide') animationStyle = {opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [50, 0])}px)`};
  if (type === 'slide-right') animationStyle = {opacity: progress, transform: `translateX(${interpolate(progress, [0, 1], [-50, 0])}px)`};
  if (type === 'slide-left') animationStyle = {opacity: progress, transform: `translateX(${interpolate(progress, [0, 1], [50, 0])}px)`};
  if (type === 'scale') animationStyle = {opacity: progress, transform: `scale(${interpolate(progress, [0, 1], [0.8, 1])})`};
  if (type === 'pop') animationStyle = {opacity: progress, transform: `scale(${interpolate(progress, [0, 1], [0, 1])})`};
  if (type === 'blur') animationStyle = {opacity: progress, filter: `blur(${interpolate(progress, [0, 1], [20, 0])}px)`};

  return <div style={{...style, ...animationStyle}}>{children}</div>;
};

/**
 * 2. Typography
 */
export const Heading: React.FC<{children: React.ReactNode; level?: 1|2|3; style?: React.CSSProperties}> = ({children, level=1, style}) => {
  const fontSize = level === 1 ? '120px' : level === 2 ? '84px' : '48px';
  return <h1 style={{fontSize, fontWeight: 800, margin: 0, color: theme.colors.slate[50], letterSpacing: '-2px', ...style}}>{children}</h1>;
};

export const Subheading: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <h3 style={{fontSize: '32px', color: theme.colors.slate[400], fontWeight: 600, letterSpacing: '4px', ...style}}>{children}</h3>
);

export const Text: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <p style={{fontSize: '28px', color: theme.colors.slate[300], lineHeight: 1.5, margin: 0, ...style}}>{children}</p>
);

export const Caption: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <span style={{fontSize: '20px', color: theme.colors.slate[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', ...style}}>{children}</span>
);

/**
 * 3. Containers
 */
export const GlassBox: React.FC<{children: React.ReactNode; style?: React.CSSProperties; padding?: string}> = ({children, style, padding = '40px'}) => (
  <div style={{
    background: theme.colors.glass,
    backdropFilter: 'blur(20px)',
    borderRadius: '30px',
    border: `1px solid ${theme.colors.border}`,
    padding,
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
    position: 'relative',
    ...style
  }}>{children}</div>
);

/**
 * 4. Data Atoms
 */
export const Badge: React.FC<{label: string; color?: string; style?: React.CSSProperties}> = ({label, color = theme.colors.primary, style}) => (
  <span style={{
    background: `${color}22`,
    color: color,
    padding: '8px 24px',
    borderRadius: '16px',
    border: `1px solid ${color}44`,
    fontSize: '24px',
    fontWeight: 600,
    display: 'inline-block',
    marginRight: '12px',
    ...style
  }}>{label}</span>
);

export const TickerLogo: React.FC<{symbol: string; size?: number; color?: string}> = ({symbol, size = 140, color = theme.colors.primary}) => (
  <div style={{
    width: size, height: size, borderRadius: size/4,
    background: `linear-gradient(135deg, ${color}, ${theme.colors.slate[900]})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size/3, fontWeight: 800, color: 'white',
    boxShadow: `0 10px 30px ${color}44`
  }}>{symbol}</div>
);

export const Avatar: React.FC<{src: string; size?: number}> = ({src, size = 60}) => (
  <img src={src} style={{width: size, height: size, borderRadius: size/2, border: '2px solid rgba(255,255,255,0.1)'}} alt="Avatar" />
);

export const TrendIcon: React.FC<{isUp: boolean; size?: number}> = ({isUp, size = 32}) => (
  <div style={{color: isUp ? theme.colors.success : theme.colors.danger, fontSize: size, fontWeight: 800}}>
    {isUp ? '▲' : '▼'}
  </div>
);

export const BrandLogo: React.FC<{size?: number}> = ({size = 60}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: Math.round(size * 0.25) + 'px'}}>
    <Img src={staticFile('logo.png')} style={{width: size, height: size}} />
    <span style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: Math.round(size * 0.4),
      fontWeight: 600,
      color: '#f8fafc',
      letterSpacing: '0.02em',
    }}>market-watch<span style={{color: '#50b4ee'}}>.xyz</span></span>
  </div>
);

export const ProgressCircle: React.FC<{progress: number; color?: string; size?: number}> = ({progress, color = theme.colors.primary, size = 60}) => {
  const frame = useCurrentFrame();
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const p = spring({frame, fps: 30, config: theme.animations.spring});
  const offset = circumference - (progress * p) * circumference;

  return (
    <svg width={size} height={size} style={{transform: 'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="5" fill="none" />
      <circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth="5" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
};

/**
 * 5. Layout Elements
 */
export const Divider: React.FC<{vertical?: boolean; size?: string}> = ({vertical, size = '100%'}) => (
  <div style={{
    width: vertical ? '4px' : size,
    height: vertical ? size : '4px',
    background: 'rgba(255,255,255,0.1)',
    margin: vertical ? '0 20px' : '20px 0'
  }} />
);
