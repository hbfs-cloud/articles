import React from 'react';
import {theme} from '../../../theme/Theme';
import {Motion, Badge, Text, Caption, GlassBox, TrendIcon} from '../atoms/Atoms';

/**
 * 1. Metric Display
 */
export const Metric: React.FC<{label: string; value: string; color?: string; delay?: number; trend?: boolean}> = ({label, value, color = theme.colors.slate[50], delay = 0, trend}) => (
  <Motion delay={delay} type="slide" style={{flex: 1}}>
    <GlassBox padding="20px" style={{textAlign: 'center'}}>
      <Caption style={{marginBottom: '10px'}}>{label}</Caption>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px'}}>
        {trend !== undefined && <TrendIcon isUp={trend} size={24} />}
        <div style={{color, fontSize: '48px', fontWeight: 800}}>{value}</div>
      </div>
    </GlassBox>
  </Motion>
);

/**
 * 2. Specialized Info Boxes
 */
export const TradeLevel: React.FC<{label: string; value: string; color: string; delay?: number}> = ({label, value, color, delay = 0}) => (
  <Motion delay={delay} type="slide-right">
    <GlassBox padding="25px" style={{borderLeft: `10px solid ${color}`}}>
      <Caption>{label}</Caption>
      <div style={{color: theme.colors.slate[50], fontSize: '38px', fontWeight: 800, marginTop: '5px'}}>{value}</div>
    </GlassBox>
  </Motion>
);

export const DidacticBox: React.FC<{title: string; icon?: React.ReactNode; children: React.ReactNode; delay?: number}> = ({title, icon, children, delay = 0}) => (
  <Motion delay={delay} type="scale">
    <div style={{
      background: 'rgba(59, 130, 246, 0.05)', padding: '40px', borderRadius: '30px', 
      border: `1px solid ${theme.colors.primary}33`, position: 'relative'
    }}>
      <h4 style={{color: theme.colors.primary, fontSize: '32px', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '15px'}}>
        {icon} {title}
      </h4>
      <Text style={{fontSize: '32px'}}>{children}</Text>
    </div>
  </Motion>
);

export const RiskAlert: React.FC<{title: string; children: React.ReactNode; delay?: number}> = ({title, children, delay = 0}) => (
  <Motion delay={delay} type="blur">
    <div style={{
      background: 'rgba(239, 68, 68, 0.05)', padding: '40px', borderRadius: '30px', 
      border: `1px solid ${theme.colors.danger}33`
    }}>
      <h4 style={{color: theme.colors.danger, fontSize: '32px', margin: '0 0 20px 0'}}>⚠️ {title}</h4>
      <Text style={{fontSize: '32px'}}>{children}</Text>
    </div>
  </Motion>
);

/**
 * 3. Lists & Tables Rows
 */
export const ListItem: React.FC<{label: string; value: string; delay?: number; isUp?: boolean}> = ({label, value, delay = 0, isUp}) => (
  <Motion delay={delay} type="slide-right" style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
    padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)'
  }}>
    <Text style={{fontWeight: 600}}>{label}</Text>
    <div style={{
      fontSize: '32px', fontWeight: 800, 
      color: isUp === undefined ? theme.colors.slate[100] : isUp ? theme.colors.success : theme.colors.danger
    }}>{value}</div>
  </Motion>
);

export const EventItem: React.FC<{time: string; event: string; impact: 'High' | 'Medium' | 'Low'; delay?: number}> = ({time, event, impact, delay = 0}) => (
  <Motion delay={delay} type="slide-left" style={{display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px'}}>
    <Caption style={{width: '120px', color: theme.colors.slate[400]}}>{time}</Caption>
    <div style={{flex: 1, color: theme.colors.slate[100], fontSize: '26px', fontWeight: 600}}>{event}</div>
    <Badge label={impact} color={impact === 'High' ? theme.colors.danger : impact === 'Medium' ? theme.colors.warning : theme.colors.success} style={{padding: '4px 12px', fontSize: '18px'}} />
  </Motion>
);

export const PerformanceRow: React.FC<{ticker: string; perf: string; isUp: boolean; delay?: number}> = ({ticker, perf, isUp, delay = 0}) => (
  <Motion delay={delay} type="slide" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', marginBottom: '10px'}}>
    <Text style={{fontWeight: 800}}>{ticker}</Text>
    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
      <TrendIcon isUp={isUp} size={20} />
      <Text style={{color: isUp ? theme.colors.success : theme.colors.danger, fontWeight: 700}}>{perf}</Text>
    </div>
  </Motion>
);

/**
 * 4. Social & Sentiment
 */
export const SocialMetric: React.FC<{platform: string; score: number; delay?: number}> = ({platform, score, delay = 0}) => (
  <Motion delay={delay} type="pop" style={{flex: 1}}>
    <GlassBox padding="15px" style={{textAlign: 'center', background: 'rgba(0,0,0,0.2)'}}>
      <Caption style={{fontSize: '16px'}}>{platform}</Caption>
      <div style={{fontSize: '32px', fontWeight: 800, color: score > 50 ? theme.colors.success : theme.colors.danger}}>{score}%</div>
    </GlassBox>
  </Motion>
);

/**
 * 5. Tag Group
 */
export const TagGroup: React.FC<{tags: string[]; delay?: number}> = ({tags, delay = 0}) => (
  <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
    {tags.map((tag, i) => (
      <Motion key={tag} delay={delay + (i * 5)} type="pop">
        <Badge label={tag} color={i === 0 ? theme.colors.primary : i === 1 ? theme.colors.warning : theme.colors.info} />
      </Motion>
    ))}
  </div>
);

export const AnalystBadge: React.FC<{action: string; delay?: number}> = ({action, delay = 0}) => {
  const isUp = ['Buy', 'Overweight', 'Upgrade'].some(s => action.includes(s));
  return <Badge label={action} color={isUp ? theme.colors.success : theme.colors.danger} style={{padding: '4px 12px', fontSize: '18px'}} />;
};
