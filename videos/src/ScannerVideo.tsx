import React from 'react';
import {Sequence, useCurrentFrame, useVideoConfig, Audio, staticFile, Img, interpolate, spring} from 'remotion';
import {Slide, SetupHeader, AnalysisDashboard} from './components/library/organisms/Organisms';
import {TechnicalSetupSlide, RiskCapitalDashboard} from './components/library/organisms/AnalysisOrganisms';
import {TitleSlide} from './TitleSlide';
import {theme} from './theme/Theme';
import {Motion, GlassBox, Caption, Heading, Subheading, Text, BrandLogo, TickerLogo} from './components/library/atoms/Atoms';
import {RiskAlert, DidacticBox, Metric, TradeLevel} from './components/library/molecules/Molecules';
import {ScoreGauge, RadarMap, SentimentDonut} from './components/library/charts/Charts';
import {TechnicalChart, OwnershipChart, SocialTrendChart} from './components/library/charts/AdvancedCharts';
import audioDurations from '../public/audio-durations.json';

interface Setup {
  ticker: string;
  name: string;
  price: string;
  change: string;
  score: number;
  badges: string[];
  description: string;
  thesis: string;
  levels: {
    entry: string;
    stop: string;
    target1: string;
    target2: string;
    'r/r': string;
    horizon?: string;
  };
  scoreFactors: number[];
  chartData: any[];
  sma20: number[];
  sma50: number[];
  ownership: { insiders: number; institutions: number; retail: number };
  sentiment: { pos: number; neu: number; neg: number; st: number; rd: number };
  socialTrend: number[];
  risk: { risk: string; category: string };
}

interface VideoProps {
  date: string;
  regime: string;
  setups: Setup[];
}

/** Get audio duration in frames (with 1.5s padding for breathing room) */
function getAudioFrames(ticker: string, slideNum: number, fps: number): number {
  const key = `${ticker}_s${slideNum}`;
  const seconds = (audioDurations as any)[key] || 12;
  return Math.ceil((seconds + 1.5) * fps);
}

/**
 * Transition slide between tickers — quick 1.5s bump card
 */
const TransitionSlide: React.FC<{
  nextTicker: string;
  nextName: string;
  nextScore: number;
  index: number;
  total: number;
}> = ({nextTicker, nextName, nextScore, index, total}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({frame, fps, config: {damping: 15, stiffness: 120}});
  const scaleOut = interpolate(frame, [30, 45], [1, 0.8], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const opacityOut = interpolate(frame, [30, 45], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <Slide style={{background: theme.colors.background}}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        opacity: opacityOut,
        transform: `scale(${interpolate(progress, [0, 1], [0.5, 1]) * scaleOut})`,
      }}>
        <div style={{
          fontSize: '20px', fontWeight: 600, color: theme.colors.slate[500],
          letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '20px',
          opacity: progress,
        }}>
          Setup {index + 1} of {total}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '30px',
          opacity: progress,
          transform: `translateY(${interpolate(progress, [0, 1], [30, 0])}px)`,
        }}>
          <TickerLogo symbol={nextTicker} size={120} />
          <div style={{textAlign: 'left'}}>
            <div style={{fontSize: '72px', fontWeight: 800, color: theme.colors.slate[50]}}>{nextTicker}</div>
            <div style={{fontSize: '28px', color: theme.colors.slate[400]}}>{nextName}</div>
          </div>
        </div>
        <div style={{
          marginTop: '30px', display: 'flex', gap: '20px', alignItems: 'center',
          opacity: spring({frame: frame - 10, fps, config: {damping: 12}}),
        }}>
          <div style={{
            background: `${theme.colors.primary}11`, border: `1px solid ${theme.colors.primary}33`,
            borderRadius: '16px', padding: '12px 30px',
          }}>
            <span style={{fontSize: '36px', fontWeight: 800, color: theme.colors.primary}}>Score {nextScore}/100</span>
          </div>
          <div style={{
            background: nextScore >= 90 ? `${theme.colors.success}11` : `${theme.colors.warning}11`,
            border: `1px solid ${nextScore >= 90 ? theme.colors.success : theme.colors.warning}33`,
            borderRadius: '16px', padding: '12px 30px',
          }}>
            <span style={{fontSize: '36px', fontWeight: 800, color: nextScore >= 90 ? theme.colors.success : theme.colors.warning}}>
              {nextScore >= 90 ? 'A+' : nextScore >= 85 ? 'A' : 'B+'}
            </span>
          </div>
        </div>
      </div>
    </Slide>
  );
};

/**
 * Slide 1: Investment Thesis & Score Dashboard
 */
const ThesisSlide: React.FC<{setup: Setup}> = ({setup}) => (
  <Slide>
    <SetupHeader
      ticker={setup.ticker}
      name={setup.name}
      price={setup.price}
      change={setup.change}
      badges={setup.badges}
    />
    <AnalysisDashboard
      score={setup.score}
      factors={setup.scoreFactors}
      levels={setup.levels}
      description={setup.thesis || setup.description}
      sentiment={setup.sentiment || {pos: 60, neu: 25, neg: 15, st: 70, rd: 55}}
      delay={10}
    />
  </Slide>
);

/**
 * Slide 2: Technical Chart & Trade Levels
 */
const ChartSlide: React.FC<{setup: Setup}> = ({setup}) => (
  <Slide>
    <SetupHeader
      ticker={setup.ticker}
      name={setup.name}
      price={setup.price}
      change={setup.change}
      badges={setup.badges}
    />
    <TechnicalSetupSlide
      ticker={setup.ticker}
      chartData={setup.chartData}
      sma20={setup.sma20}
      sma50={setup.sma50}
      levels={setup.levels}
      delay={5}
    />
  </Slide>
);

/**
 * Slide 3: Capital Composition, Social Sentiment & Risk Alerts
 */
const RiskSlide: React.FC<{setup: Setup}> = ({setup}) => {
  const ownership = setup.ownership || {insiders: 10, institutions: 65, retail: 25};
  const socialTrend = setup.socialTrend || [40, 45, 50, 55, 60, 65, 70];
  const risk = setup.risk || {risk: 'Standard market risk.', category: 'Market Risk'};
  const sentiment = setup.sentiment || {st: 60, rd: 50};

  return (
    <Slide>
      <SetupHeader
        ticker={setup.ticker}
        name={setup.name}
        price={setup.price}
        change={setup.change}
        badges={setup.badges}
      />
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', flex: 1}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <GlassBox style={{flex: 1}}>
            <Caption style={{marginBottom: '20px', textAlign: 'center'}}>Capital Composition</Caption>
            <div style={{height: '280px'}}>
              <OwnershipChart
                insiders={ownership.insiders}
                institutions={ownership.institutions}
                retail={ownership.retail}
                delay={10}
              />
            </div>
            <div style={{display: 'flex', justifyContent: 'space-around', marginTop: '10px'}}>
              <Metric label="Insider" value={`${ownership.insiders}%`} color={theme.colors.warning} delay={20} />
              <Metric label="Inst." value={`${ownership.institutions}%`} color={theme.colors.primary} delay={25} />
              <Metric label="Retail" value={`${ownership.retail}%`} color={theme.colors.slate[400]} delay={30} />
            </div>
          </GlassBox>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <GlassBox>
            <Caption style={{marginBottom: '15px'}}>Social Trend (7 days)</Caption>
            <div style={{height: '180px'}}>
              <SocialTrendChart
                data={socialTrend}
                labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                delay={15}
              />
            </div>
            <div style={{display: 'flex', gap: '15px', marginTop: '10px'}}>
              <Motion delay={35} type="pop" style={{flex: 1}}>
                <GlassBox padding="12px" style={{textAlign: 'center', background: 'rgba(0,0,0,0.2)'}}>
                  <Caption style={{fontSize: '14px'}}>StockTwits</Caption>
                  <div style={{fontSize: '28px', fontWeight: 800, color: sentiment.st > 50 ? theme.colors.success : theme.colors.danger}}>{sentiment.st}%</div>
                </GlassBox>
              </Motion>
              <Motion delay={40} type="pop" style={{flex: 1}}>
                <GlassBox padding="12px" style={{textAlign: 'center', background: 'rgba(0,0,0,0.2)'}}>
                  <Caption style={{fontSize: '14px'}}>Reddit</Caption>
                  <div style={{fontSize: '28px', fontWeight: 800, color: sentiment.rd > 50 ? theme.colors.success : theme.colors.danger}}>{sentiment.rd}%</div>
                </GlassBox>
              </Motion>
            </div>
          </GlassBox>
          <RiskAlert title={risk.category} delay={45}>
            {risk.risk}
          </RiskAlert>
        </div>
      </div>
    </Slide>
  );
};

/**
 * Outro Slide
 */
const OutroSlide: React.FC<{regime: string; setupCount: number}> = ({regime, setupCount}) => (
  <Slide>
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center'
    }}>
      <Motion type="pop" delay={0}>
        <BrandLogo size={100} />
      </Motion>
      <Motion type="slide" delay={10}>
        <Heading level={2} style={{marginBottom: '20px'}}>
          {setupCount} A+ Setups Identified
        </Heading>
      </Motion>
      <Motion type="fade" delay={20}>
        <Subheading style={{color: theme.colors.slate[400], marginBottom: '40px'}}>
          Regime: {regime} — Trade with discipline, manage your risk.
        </Subheading>
      </Motion>
      <Motion type="scale" delay={30}>
        <div style={{
          background: `${theme.colors.danger}11`, padding: '20px 40px', borderRadius: '16px',
          border: `1px solid ${theme.colors.danger}33`, marginBottom: '20px'
        }}>
          <Text style={{color: theme.colors.danger, fontSize: '24px', fontWeight: 600}}>
            Not financial advice. Past performance does not guarantee future results.
          </Text>
        </div>
      </Motion>
      <Motion type="fade" delay={50}>
        <Text style={{color: '#50b4ee', fontSize: '28px'}}>
          articles.dailytickers.com
        </Text>
      </Motion>
    </div>
  </Slide>
);

export const ScannerVideo: React.FC<VideoProps> = ({date, regime, setups}) => {
  const {fps} = useVideoConfig();
  const introDuration = 5 * fps;
  const transitionDuration = Math.round(1.5 * fps); // 1.5s transition between tickers
  const outroDuration = 5 * fps;

  // Build timeline with dynamic durations
  const sequences: React.ReactNode[] = [];
  let cursor = 0;

  // Intro
  sequences.push(
    <Sequence key="intro" from={cursor} durationInFrames={introDuration}>
      <Slide>
        <TitleSlide date={date} regime={regime} stats={{
          totalScans: 22,
          totalSetups: 280,
          hitRate: 41,
          bestPick: 'ACMR',
          bestPickGain: '+147%',
          grade: 'B',
        }} />
      </Slide>
    </Sequence>
  );
  cursor += introDuration;

  // Setups with dynamic durations + transitions
  setups.forEach((setup, index) => {
    // Transition card before each setup
    sequences.push(
      <Sequence key={`trans-${setup.ticker}`} from={cursor} durationInFrames={transitionDuration}>
        <TransitionSlide
          nextTicker={setup.ticker}
          nextName={setup.name}
          nextScore={setup.score}
          index={index}
          total={setups.length}
        />
      </Sequence>
    );
    cursor += transitionDuration;

    // Slide 1: Thesis — duration = audio + padding
    const s1Duration = getAudioFrames(setup.ticker, 1, fps);
    sequences.push(
      <Sequence key={`thesis-${setup.ticker}`} from={cursor} durationInFrames={s1Duration}>
        <ThesisSlide setup={setup} />
      </Sequence>,
      <Sequence key={`audio-s1-${setup.ticker}`} from={cursor} durationInFrames={s1Duration}>
        <Audio src={staticFile(`audio/${setup.ticker}_s1.wav`)} />
      </Sequence>
    );
    cursor += s1Duration;

    // Slide 2: Chart — duration = audio + padding
    const s2Duration = getAudioFrames(setup.ticker, 2, fps);
    sequences.push(
      <Sequence key={`chart-${setup.ticker}`} from={cursor} durationInFrames={s2Duration}>
        <ChartSlide setup={setup} />
      </Sequence>,
      <Sequence key={`audio-s2-${setup.ticker}`} from={cursor} durationInFrames={s2Duration}>
        <Audio src={staticFile(`audio/${setup.ticker}_s2.wav`)} />
      </Sequence>
    );
    cursor += s2Duration;

    // Slide 3: Risk — duration = audio + padding
    const s3Duration = getAudioFrames(setup.ticker, 3, fps);
    sequences.push(
      <Sequence key={`risk-${setup.ticker}`} from={cursor} durationInFrames={s3Duration}>
        <RiskSlide setup={setup} />
      </Sequence>,
      <Sequence key={`audio-s3-${setup.ticker}`} from={cursor} durationInFrames={s3Duration}>
        <Audio src={staticFile(`audio/${setup.ticker}_s3.wav`)} />
      </Sequence>
    );
    cursor += s3Duration;
  });

  // Outro
  sequences.push(
    <Sequence key="outro" from={cursor} durationInFrames={outroDuration}>
      <OutroSlide regime={regime} setupCount={setups.length} />
    </Sequence>
  );

  return <div className="video-container">{sequences}</div>;
};

// Export total duration calculator for Root.tsx
export function calculateTotalDuration(setups: {ticker: string}[], fps: number): number {
  const introDuration = 5 * fps;
  const transitionDuration = Math.round(1.5 * fps);
  const outroDuration = 5 * fps;
  let total = introDuration + outroDuration;

  for (const setup of setups) {
    total += transitionDuration; // transition card
    total += getAudioFrames(setup.ticker, 1, fps);
    total += getAudioFrames(setup.ticker, 2, fps);
    total += getAudioFrames(setup.ticker, 3, fps);
  }
  return total;
}
