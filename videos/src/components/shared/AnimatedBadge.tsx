import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

interface AnimatedBadgeProps {
  label: string;
  delay?: number;
  color?: string;
  style?: React.CSSProperties;
}

export const AnimatedBadge: React.FC<AnimatedBadgeProps> = ({
  label, 
  delay = 0, 
  color = '#3b82f6',
  style
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const spr = spring({
    frame: frame - delay,
    fps,
    config: { damping: 10, stiffness: 200 }
  });

  const scale = interpolate(spr, [0, 1], [0, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  return (
    <span style={{
      ...style,
      display: 'inline-block',
      background: `${color}22`,
      color: color,
      padding: '8px 24px',
      borderRadius: '16px',
      border: `1px solid ${color}44`,
      fontSize: '24px',
      fontWeight: 600,
      marginRight: '12px',
      marginBottom: '12px',
      transform: `scale(${scale})`,
      opacity
    }}>
      {label}
    </span>
  );
};
