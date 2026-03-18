import React from 'react';
import {theme} from '../../../theme/Theme';
import {Motion, Heading, Subheading, TickerLogo, Divider, GlassBox, Text, Caption, BrandLogo, ProgressCircle} from '../atoms/Atoms';
import {TagGroup, TradeLevel, Metric, DidacticBox, EventItem, PerformanceRow, SocialMetric, RiskAlert} from '../molecules/Molecules';
import {ScoreGauge, RadarMap, AllocationTreemap, ComparisonBar, MacroLine, SentimentDonut, RiskMatrix} from '../charts/Charts';

/**
 * 1. Slide Wrapper & Footer
 */
export const Slide: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{
    width: 1920, height: 1080, display: 'flex', flexDirection: 'column',
    padding: '60px', boxSizing: 'border-box', overflow: 'hidden',
    position: 'relative', zIndex: 1, ...style
  }}>
    {children}
    <div style={{position: 'absolute', bottom: '40px', left: '60px', right: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
       <BrandLogo size={40} />
       <Caption style={{fontSize: '18px'}}>© 2026 MarketWatch Articles. Not Financial Advice.</Caption>
    </div>
  </div>
);

/**
 * 2. Headers
 */
export const ArticleHeader: React.FC<{title: string; subtitle: string; date: string}> = ({title, subtitle, date}) => (
  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '60px'}}>
    <div>
      <Motion type="slide"><Subheading style={{color: theme.colors.primary, fontSize: '24px'}}>{subtitle}</Subheading></Motion>
      <Motion type="slide" delay={10}><Heading level={1} style={{fontSize: '100px'}}>{title}</Heading></Motion>
    </div>
    <Motion type="fade" delay={20}><Caption style={{fontSize: '32px'}}>{date}</Caption></Motion>
  </div>
);

/**
 * 3. Daily Briefing Organism
 */
export const MacroOverview: React.FC<{metrics: any[]; news: string[]; delay?: number}> = ({metrics, news, delay = 0}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px'}}>
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
      {metrics.map((m, i) => <Metric key={m.label} label={m.label} value={m.value} color={m.color} delay={delay + (i * 5)} trend={m.trend} />)}
    </div>
    <GlassBox>
      <Caption style={{marginBottom: '30px'}}>Macro Drivers & News</Caption>
      {news.map((item, i) => (
        <Motion key={i} delay={delay + 20 + (i * 10)} type="slide-right" style={{marginBottom: '25px', display: 'flex', gap: '15px'}}>
          <div style={{width: '8px', height: '40px', background: theme.colors.primary, borderRadius: '4px'}} />
          <Text style={{fontSize: '26px'}}>{item}</Text>
        </Motion>
      ))}
    </GlassBox>
  </div>
);

/**
 * 4. Weekly Outlook Organism
 */
export const MarketMap: React.FC<{data: any[]; topPicks: any[]; delay?: number}> = ({data, topPicks, delay = 0}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '40px', flex: 1}}>
    <Motion type="scale" delay={delay} style={{background: 'rgba(255,255,255,0.01)', border: `1px solid ${theme.colors.border}`, borderRadius: '30px', padding: '30px'}}>
      <Caption style={{marginBottom: '20px', textAlign: 'center'}}>Global Asset Allocation</Caption>
      <AllocationTreemap data={data} delay={delay + 10} />
    </Motion>
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
      <Caption>Top Weekly Setups</Caption>
      {topPicks.map((p, i) => <PerformanceRow key={p.ticker} ticker={p.ticker} perf={p.perf} isUp={p.isUp} delay={delay + 20 + (i * 5)} />)}
      <DidacticBox title="Weekly Sentiment" delay={delay + 40}>Broad accumulation in energy hedges while Nasdaq consolidates ATH levels.</DidacticBox>
    </div>
  </div>
);

/**
 * 5. Economic Calendar Organism
 */
export const EconomicTimeline: React.FC<{events: any[]; delay?: number}> = ({events, delay = 0}) => (
  <GlassBox>
    <Caption style={{marginBottom: '30px', textAlign: 'center'}}>Economic Calendar & Catalysts</Caption>
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px'}}>
      <div>{events.slice(0, 4).map((e, i) => <EventItem key={i} {...e} delay={delay + (i * 10)} />)}</div>
      <div>{events.slice(4, 8).map((e, i) => <EventItem key={i} {...e} delay={delay + 40 + (i * 10)} />)}</div>
    </div>
  </GlassBox>
);

/**
 * 6. Analysis Deep Dive Organism
 */
export const AnalysisDashboard: React.FC<{score: number; factors: number[]; levels: any; description: string; sentiment: any; delay?: number}> = ({score, factors, levels, description, sentiment, delay = 0}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1, overflow: 'hidden'}}>
    {/* Left column: Score + Thesis */}
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
      <div style={{display: 'flex', gap: '20px', alignItems: 'center'}}>
        <Motion delay={delay} type="scale" style={{width: '180px', height: '180px', flexShrink: 0, background: 'rgba(255,255,255,0.01)', border: `1px solid ${theme.colors.border}`, borderRadius: '24px', padding: '15px'}}>
          <Caption style={{marginBottom: '5px', textAlign: 'center', fontSize: '16px'}}>Score</Caption>
          <ScoreGauge score={score} delay={delay + 10} />
        </Motion>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', flex: 1}}>
          <TradeLevel label="Entry" value={levels.entry} color={theme.colors.primary} delay={delay + 15} />
          <TradeLevel label="Stop" value={levels.stop} color={theme.colors.danger} delay={delay + 18} />
          <TradeLevel label="T1" value={levels.target1} color={theme.colors.success} delay={delay + 21} />
          <TradeLevel label="T2" value={levels.target2} color={theme.colors.info} delay={delay + 24} />
          <TradeLevel label="R/R" value={levels.rr || levels['r/r']} color={theme.colors.warning} delay={delay + 27} />
          <TradeLevel label="Time" value={levels.horizon || '7d'} color={theme.colors.slate[400]} delay={delay + 30} />
        </div>
      </div>
      <DidacticBox title="Investment Thesis" delay={delay + 5}>
        {typeof description === 'string' && description.length > 200 ? description.slice(0, 200) + '...' : description}
      </DidacticBox>
    </div>
    {/* Right column: Radar + Sentiment */}
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
      <Motion delay={delay + 35} type="scale" style={{flex: 1, background: 'rgba(255,255,255,0.01)', border: `1px solid ${theme.colors.border}`, borderRadius: '24px', padding: '15px', maxHeight: '300px'}}>
        <Caption style={{marginBottom: '5px', textAlign: 'center', fontSize: '16px'}}>Technical Profile</Caption>
        <div style={{height: '250px'}}>
          <RadarMap values={factors} indicators={['Tech', 'Vol', 'Mom', 'Risk', 'R/R', 'Conv']} delay={delay + 40} />
        </div>
      </Motion>
      <Motion delay={delay + 45} type="scale" style={{background: 'rgba(255,255,255,0.01)', border: `1px solid ${theme.colors.border}`, borderRadius: '24px', padding: '15px'}}>
        <Caption style={{marginBottom: '5px', textAlign: 'center', fontSize: '16px'}}>Sentiment</Caption>
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
          <div style={{width: '150px', height: '150px'}}>
            <SentimentDonut positive={sentiment.pos} neutral={sentiment.neu} negative={sentiment.neg} delay={delay + 50} />
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', flex: 1}}>
            <SocialMetric platform="StockTwits" score={sentiment.st} delay={delay + 55} />
            <SocialMetric platform="Reddit" score={sentiment.rd} delay={delay + 58} />
          </div>
        </div>
      </Motion>
    </div>
  </div>
);

/**
 * 7. Setup Header Organism
 */
export const SetupHeader: React.FC<{
  ticker: string; name: string; price: string; change: string; badges: string[];
}> = ({ticker, name, price, change, badges}) => {
  const isUp = change.startsWith('+');
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: '40px', marginBottom: '40px'}}>
      <Motion type="pop"><TickerLogo symbol={ticker} /></Motion>
      <div style={{flex: 1}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
          <Heading level={2}>{ticker}</Heading>
          <Divider vertical size="60px" />
          <Subheading style={{fontSize: '48px', color: theme.colors.slate[200]}}>{name}</Subheading>
        </div>
        <TagGroup tags={badges} delay={15} />
      </div>
      <div style={{textAlign: 'right'}}>
        <div style={{fontSize: '84px', fontWeight: 800, color: theme.colors.slate[50]}}>{price}</div>
        <div style={{
          fontSize: '36px', fontWeight: 700, padding: '8px 24px', borderRadius: '12px',
          background: isUp ? `${theme.colors.success}22` : `${theme.colors.danger}22`,
          color: isUp ? theme.colors.success : theme.colors.danger, display: 'inline-block'
        }}>{change}</div>
      </div>
    </div>
  );
};

/**
 * 8. Risk Matrix Organism
 */
export const RiskMatrixSlide: React.FC<{data: any[]; delay?: number}> = ({data, delay = 0}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px'}}>
    <GlassBox>
      <Caption style={{marginBottom: '20px', textAlign: 'center'}}>Risk Matrix Analysis</Caption>
      <RiskMatrix data={data} delay={delay + 10} />
    </GlassBox>
    <div style={{display: 'flex', flexDirection: 'column', gap: '30px'}}>
      <RiskAlert title="Critical Risk: Dilution" delay={delay + 20}>SEC Filing S-3 detected for $500M ATM offering. High probability of share issuance.</RiskAlert>
      <DidacticBox title="Risk Mitigation" delay={delay + 30}>Reduce position sizing to 0.5% and move stops to breakeven post TP1.</DidacticBox>
    </div>
  </div>
);

/**
 * 9. Retrospective Organism
 */
export const RetrospectiveDashboard: React.FC<{hitRate: number; totalTrades: number; bestPick: string; delay?: number}> = ({hitRate, totalTrades, bestPick, delay = 0}) => (
  <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px'}}>
    <Metric label="Cumulative Hit Rate" value={`${hitRate}%`} color={theme.colors.success} delay={delay} />
    <Metric label="Total Setups" value={totalTrades.toString()} color={theme.colors.primary} delay={delay + 10} />
    <Metric label="Best Performer" value={bestPick} color={theme.colors.warning} delay={delay + 20} />
  </div>
);
