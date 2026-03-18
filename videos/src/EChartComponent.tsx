import React, {useMemo} from 'react';
import ReactECharts from 'echarts-for-react';
import {useCurrentFrame, useVideoConfig, interpolate} from 'remotion';

interface EChartProps {
  option: any;
  style?: React.CSSProperties;
}

export const EChartComponent: React.FC<EChartProps> = ({option, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Simple animation: interpolate data from 0 to target over 30 frames
  const animatedOption = useMemo(() => {
    if (!option.series) return option;
    
    const progress = interpolate(frame, [10, 40], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    
    const newSeries = option.series.map((s: any) => {
      if (s.type === 'gauge') {
        return {
          ...s,
          data: s.data.map((d: any) => ({...d, value: d.value * progress}))
        };
      }
      if (s.type === 'radar') {
        return {
          ...s,
          data: s.data.map((d: any) => ({...d, value: d.value.map((v: number) => v * progress)}))
        };
      }
      return s;
    });

    return {
      ...option,
      animation: false, // Disable ECharts native animation to use Remotion's
      series: newSeries
    };
  }, [option, frame]);

  return (
    <div style={style}>
      <ReactECharts
        option={animatedOption}
        style={{height: '100%', width: '100%'}}
        notMerge={true}
      />
    </div>
  );
};
