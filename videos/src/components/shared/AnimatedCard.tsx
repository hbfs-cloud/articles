import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({children, delay = 0, className, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const spr = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
    },
  });

  const opacity = interpolate(spr, [0, 1], [0, 1]);
  const translateY = interpolate(spr, [0, 1], [40, 0]);
  const scale = interpolate(spr, [0, 1], [0.95, 1]);

  return (
    <div 
      className={className}
      style={{
        ...style,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
};
