import React from 'react';
import {useCurrentFrame, interpolate, spring, useVideoConfig} from 'remotion';
import {theme} from './theme/Theme';
import {Heading, Subheading, Motion, BrandLogo, Caption, Text, GlassBox} from './components/library/atoms/Atoms';

interface TitleSlideProps {
  date: string;
  regime: string;
  stats?: {
    totalScans: number;
    totalSetups: number;
    hitRate: number;
    bestPick: string;
    bestPickGain: string;
    grade: string;
  };
}

const StatBox: React.FC<{label: string; value: string; color: string; delay: number}> = ({label, value, color, delay}) => (
  <Motion type="pop" delay={delay}>
    <div style={{
      background: `${color}11`,
      border: `1px solid ${color}33`,
      borderRadius: '20px',
      padding: '20px 24px',
      textAlign: 'center',
      minWidth: '180px',
    }}>
      <div style={{fontSize: '42px', fontWeight: 800, color, marginBottom: '6px'}}>{value}</div>
      <div style={{fontSize: '16px', fontWeight: 600, color: theme.colors.slate[400], textTransform: 'uppercase', letterSpacing: '2px'}}>{label}</div>
    </div>
  </Motion>
);

export const TitleSlide: React.FC<TitleSlideProps> = ({date, regime, stats}) => {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: '10px',
    }}>
      <Motion type="pop" delay={0}>
        <BrandLogo size={80} />
      </Motion>
      <Motion type="slide" delay={10}>
        <Subheading style={{textTransform: 'uppercase', letterSpacing: '8px', marginTop: '30px'}}>Daily Market Scan</Subheading>
      </Motion>
      <Motion type="scale" delay={20}>
        <Heading level={1} style={{margin: '10px 0'}}>{date}</Heading>
      </Motion>
      <Motion type="pop" delay={30}>
        <div style={{
          background: `${theme.colors.primary}11`,
          padding: '16px 50px',
          borderRadius: '20px',
          border: `1px solid ${theme.colors.primary}33`,
        }}>
           <span style={{fontSize: '42px', fontWeight: 700, color: theme.colors.primary}}>Regime: {regime}</span>
        </div>
      </Motion>

      {/* Scanner Performance Stats */}
      {stats && (
        <Motion type="slide" delay={40}>
          <div style={{
            display: 'flex',
            gap: '20px',
            marginTop: '20px',
            alignItems: 'center',
          }}>
            <StatBox label="Scans" value={`${stats.totalScans}`} color={theme.colors.primary} delay={45} />
            <StatBox label="Setups" value={`${stats.totalSetups}`} color={theme.colors.info} delay={50} />
            <StatBox label="Hit Rate" value={`${stats.hitRate}%`} color={stats.hitRate >= 40 ? theme.colors.success : theme.colors.warning} delay={55} />
            <StatBox label="Best Pick" value={stats.bestPickGain} color={theme.colors.success} delay={60} />
            <StatBox label="Grade" value={stats.grade} color={theme.colors.warning} delay={65} />
          </div>
          <Motion type="fade" delay={70}>
            <div style={{marginTop: '12px', fontSize: '18px', color: theme.colors.slate[500], fontWeight: 600}}>
              22 scans · 280 setups · Feb 10 – Mar 13, 2026 · Best: {stats.bestPick}
            </div>
          </Motion>
        </Motion>
      )}
    </div>
  );
};
