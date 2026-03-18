import {Composition, getInputProps} from 'remotion';
import {ScannerVideo, calculateTotalDuration} from './ScannerVideo';
import data from '../public/data.json';
import './style.css';

export const Root: React.FC = () => {
  const inputProps = getInputProps() as any;
  const setups = inputProps.setups || data.setups || [];
  const date = inputProps.date || data.date || "March 17, 2026";
  const regime = inputProps.regime || data.regime || "Early Risk-Off";

  const fps = 30;
  const totalDuration = calculateTotalDuration(setups, fps);

  return (
    <>
      <Composition
        id="MarketWatchScanner"
        component={ScannerVideo as any}
        durationInFrames={Math.max(totalDuration, 30)}
        fps={fps}
        width={1920}
        height={1080}
        defaultProps={{
          date,
          regime,
          setups
        }}
      />
    </>
  );
};
