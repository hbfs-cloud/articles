import React from 'react';
import {theme} from '../../../theme/Theme';
import {Motion, GlassBox, Caption, Text, TickerLogo, Divider} from '../atoms/Atoms';
import {Metric, TradeLevel, TagGroup} from '../molecules/Molecules';
import {TechnicalChart, OwnershipChart, SocialTrendChart} from '../charts/AdvancedCharts';
import {RadarMap, ScoreGauge} from '../charts/Charts';

/**
 * 1. Complete Technical Setup Slide
 */
export const TechnicalSetupSlide: React.FC<{
  ticker: string; 
  chartData: any[];
  sma20?: number[];
  sma50?: number[];
  sma200?: number[];
  levels: any;
  delay?: number;
}> = ({ticker, chartData, sma20, sma50, sma200, levels, delay = 0}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '40px', flex: 1}}>
    <Motion delay={delay} type="scale" style={{background: 'rgba(0,0,0,0.2)', borderRadius: '30px', border: `1px solid ${theme.colors.border}`, overflow: 'hidden'}}>
      <TechnicalChart data={chartData} sma20={sma20} sma50={sma50} sma200={sma200} delay={delay + 10} />
    </Motion>
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
      <Caption>Technical Setup Levels</Caption>
      <TradeLevel label="Target 2" value={levels.target2} color={theme.colors.info} delay={delay + 20} />
      <TradeLevel label="Target 1" value={levels.target1} color={theme.colors.success} delay={delay + 30} />
      <TradeLevel label="Entry Zone" value={levels.entry} color={theme.colors.primary} delay={delay + 40} />
      <TradeLevel label="Stop Loss" value={levels.stop} color={theme.colors.danger} delay={delay + 50} />
    </div>
  </div>
);

/**
 * 2. Risk & Capital Slide
 */
export const RiskCapitalDashboard: React.FC<{
  ownership: any; // {insiders, institutions, retail}
  riskMatrix: any[];
  delay?: number;
}> = ({ownership, riskMatrix, delay = 0}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', flex: 1}}>
    <GlassBox>
      <Caption style={{marginBottom: '30px', textAlign: 'center'}}>Capital Composition</Caption>
      <div style={{height: '400px'}}>
        <OwnershipChart {...ownership} delay={delay + 10} />
      </div>
      <div style={{display: 'flex', justifyContent: 'space-around', marginTop: '20px'}}>
        <Metric label="Insider" value={`${ownership.insiders}%`} color={theme.colors.warning} delay={delay + 20} />
        <Metric label="Inst." value={`${ownership.institutions}%`} color={theme.colors.primary} delay={delay + 30} />
      </div>
    </GlassBox>
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
      <Caption>Social Trend & Sentiment</Caption>
      <GlassBox style={{flex: 1}}>
        <SocialTrendChart data={[40, 45, 30, 55, 70, 85, 80]} labels={['M', 'T', 'W', 'T', 'F', 'S', 'S']} delay={delay + 40} />
      </GlassBox>
      <div style={{display: 'flex', gap: '20px'}}>
        <Metric label="Reddit Score" value="A+" color={theme.colors.success} delay={delay + 50} />
        <Metric label="StockTwits" value="88%" color={theme.colors.info} delay={delay + 60} />
      </div>
    </div>
  </div>
);

/**
 * 3. Deep Analysis Header
 */
export const AnalysisHeader: React.FC<{
  ticker: string; name: string; sector: string; industry: string; score: number;
}> = ({ticker, name, sector, industry, score}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: '40px', marginBottom: '40px'}}>
    <TickerLogo symbol={ticker} color={score > 85 ? theme.colors.success : theme.colors.primary} />
    <div style={{flex: 1}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
        <h1 style={{fontSize: '100px', margin: 0, fontWeight: 900}}>{ticker}</h1>
        <Divider vertical size="80px" />
        <div>
          <h2 style={{fontSize: '48px', margin: 0, color: theme.colors.slate[100]}}>{name}</h2>
          <Caption>{sector} • {industry}</Caption>
        </div>
      </div>
    </div>
    <div style={{width: '250px', height: '250px'}}>
      <ScoreGauge score={score} />
    </div>
  </div>
);
