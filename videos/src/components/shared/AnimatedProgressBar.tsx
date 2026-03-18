import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

interface AnimatedProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  height?: number;
  delay?: number;
  label?: string;
  style?: React.CSSProperties;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  progress, 
  color = '#3b82f6', 
  height = 10, 
  delay = 30,
  label,
  style
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const width = interpolate(frame, [delay, delay + 30], [0, progress * 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{...style, width: '100%', marginBottom: '20px'}}>
      {label && <div style={{color: '#94a3b8', fontSize: '20px', marginBottom: '8px', textTransform: 'uppercase'}}>{label}</div>}
      <div style={{
        height, 
        width: '100%', 
        background: 'rgba(255,255,255,0.05)', 
        borderRadius: height / 2, 
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%', 
          width: `${width}%`, 
          background: color, 
          borderRadius: height / 2,
          boxShadow: `0 0 15px ${color}66`
        }} />
      </div>
    </div>
  );
};
