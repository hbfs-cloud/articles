import {Composition, getInputProps} from 'remotion';
import {ScannerVideo, calculateTotalDuration} from './ScannerVideo';
import {EducationalVideo, calculateEducationalDuration} from './EducationalVideo';
import {TickerAnalysisVideo, calculateTickerDuration} from './TickerAnalysis';
import type {TickerSlide, TickerConfig} from './TickerAnalysis';
import data from '../public/data.json';
import './style.css';

// Try loading educational data (may not exist for scanner-only renders)
let eduSlides: any[] = [];
let eduConfig: any = {};
let eduAudioDurations: Record<string, number> = {};
try {
  const eduData = require('../public/edu-data.json');
  eduSlides = eduData.slides || [];
  eduConfig = eduData.config || {};
  eduAudioDurations = eduData.audioDurations || {};
} catch {}

// Ticker analysis data (reuses edu-data.json with ticker-specific config fields)
let tickerSlides: TickerSlide[] = [];
let tickerConfig: TickerConfig = {} as TickerConfig;
let tickerAudioDurations: Record<string, number> = {};
try {
  const tickerData = require('../public/edu-data.json');
  tickerSlides = tickerData.slides || [];
  tickerConfig = tickerData.config || {};
  tickerAudioDurations = tickerData.audioDurations || {};
} catch {}

export const Root: React.FC = () => {
  const inputProps = getInputProps() as any;

  // Scanner props
  const setups = inputProps.setups || data.setups || [];
  const date = inputProps.date || data.date || "March 17, 2026";
  const regime = inputProps.regime || data.regime || "Early Risk-Off";

  // Educational props (can be overridden via --props)
  const slides = inputProps.slides || eduSlides;
  const config = inputProps.config || eduConfig;
  const audioDurs = inputProps.audioDurations || eduAudioDurations;

  // Ticker analysis props
  const tSlides = inputProps.slides || tickerSlides;
  const tConfig = inputProps.config || tickerConfig;
  const tAudioDurs = inputProps.audioDurations || tickerAudioDurations;

  const scannerFps = 30;
  const eduFps = 15; // Educational videos are mostly static slides — 15fps is sufficient
  const tickerFps = 30;
  const scannerDuration = calculateTotalDuration(setups, scannerFps);
  const eduDuration = slides.length > 0 ? calculateEducationalDuration(slides, audioDurs, eduFps) : 150;
  const tickerDuration = tSlides.length > 0 ? calculateTickerDuration(tSlides, tAudioDurs, tickerFps) : 300;

  return (
    <>
      <Composition
        id="DailyTickersScanner"
        component={ScannerVideo as any}
        durationInFrames={Math.max(scannerDuration, 30)}
        fps={scannerFps}
        width={1920}
        height={1080}
        defaultProps={{
          date,
          regime,
          setups
        }}
      />
      <Composition
        id="EducationalVideo"
        component={EducationalVideo as any}
        durationInFrames={Math.max(eduDuration, 15)}
        fps={eduFps}
        width={1920}
        height={1080}
        defaultProps={{
          config,
          slides,
          audioDurations: audioDurs,
        }}
      />
      <Composition
        id="TickerAnalysis"
        component={TickerAnalysisVideo as any}
        durationInFrames={Math.max(tickerDuration, 30)}
        fps={tickerFps}
        width={1920}
        height={1080}
        defaultProps={{
          config: tConfig,
          slides: tSlides,
          audioDurations: tAudioDurs,
        }}
      />
    </>
  );
};
