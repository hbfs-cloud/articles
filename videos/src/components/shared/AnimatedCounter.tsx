import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  delay?: number;
  decimals?: number;
  style?: React.CSSProperties;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value, 
  suffix = '', 
  prefix = '', 
  delay = 20, 
  decimals = 0,
  style
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 20,
    },
  });

  const displayValue = (value * progress).toFixed(decimals);

  return (
    <span style={{...style, display: 'inline-block'}}>
      {prefix}{displayValue}{suffix}
    </span>
  );
};
