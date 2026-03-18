import React, {useMemo} from 'react';
import ReactECharts from 'echarts-for-react';
import {useCurrentFrame, interpolate} from 'remotion';
import {theme} from '../../../theme/Theme';

interface BaseChartProps {
  option: any;
  delay?: number;
  duration?: number;
  style?: React.CSSProperties;
}

/**
 * 1. Animated ECharts Engine
 */
export const Chart: React.FC<BaseChartProps> = ({option, delay = 10, duration = 30, style}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const animatedOption = useMemo(() => {
    if (!option.series) return option;
    const newSeries = option.series.map((s: any) => {
      if (s.type === 'gauge') return {...s, data: s.data.map((d: any) => ({...d, value: d.value * progress}))};
      if (s.type === 'radar') return {...s, data: s.data.map((d: any) => ({...d, value: d.value.map((v: number) => v * progress)}))};
      if (s.type === 'pie') return {...s, data: s.data.map((d: any) => ({...d, value: d.value * progress}))};
      if (s.type === 'bar') return {...s, data: s.data.map((d: any) => ({...d, value: d.value * progress}))};
      if (s.type === 'line') return {...s, data: s.data.map((d: any) => d * progress)};
      if (s.type === 'heatmap') return {...s, data: s.data.map((d: any) => [d[0], d[1], d[2] * progress])};
      return s;
    });
    return {...option, animation: false, series: newSeries};
  }, [option, progress]);

  return <div style={{width: '100%', height: '100%', ...style}}><ReactECharts option={animatedOption} style={{height: '100%', width: '100%'}} notMerge={true} /></div>;
};

/**
 * 2. Specialty Charts
 */
export const ScoreGauge: React.FC<{score: number; delay?: number; color?: string}> = ({score, delay, color = theme.colors.primary}) => (
  <Chart delay={delay} option={{
    series: [{
      type: 'gauge', startAngle: 220, endAngle: -40, min: 0, max: 100, pointer: { show: false },
      progress: { show: true, overlap: false, roundCap: true, itemStyle: { color } },
      axisLine: { lineStyle: { width: 30, color: [[1, 'rgba(255,255,255,0.05)']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { fontSize: 100, fontWeight: 800, color: theme.colors.slate[50], offsetCenter: [0, '10%'], formatter: '{value}' },
      data: [{ value: score }]
    }]
  }} />
);

export const RadarMap: React.FC<{values: number[]; indicators: string[]; delay?: number; color?: string}> = ({values, indicators, delay, color = theme.colors.primary}) => (
  <Chart delay={delay} option={{
    radar: {
      indicator: indicators.map(name => ({name, max: 100})),
      shape: 'polygon', splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)'] } },
      axisName: { fontSize: 18, color: theme.colors.slate[400], fontWeight: 600 }
    },
    series: [{
      type: 'radar', data: [{
        value: values, areaStyle: { color: `${color}44` }, lineStyle: { color, width: 4 }, itemStyle: { color }
      }]
    }]
  }} />
);

export const AllocationTreemap: React.FC<{data: any[]; delay?: number}> = ({data, delay}) => (
  <Chart delay={delay} option={{
    series: [{
      type: 'treemap', roam: false, breadcrumb: { show: false },
      label: { fontSize: 18, fontWeight: 800, color: '#fff' },
      data: data.map(item => ({...item, label: { show: true, formatter: '{b}\n{c}%' }}))
    }]
  }} />
);

export const ComparisonBar: React.FC<{data: number[]; labels: string[]; delay?: number; color?: string}> = ({data, labels, delay, color = theme.colors.primary}) => (
  <Chart delay={delay} option={{
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: labels, axisLabel: { color: theme.colors.slate[400] } },
    yAxis: { type: 'value', axisLabel: { color: theme.colors.slate[400] }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
    series: [{ type: 'bar', data, itemStyle: { color, borderRadius: [8, 8, 0, 0] }, barWidth: '40%' }]
  }} />
);

export const MacroLine: React.FC<{data: number[]; labels: string[]; delay?: number; color?: string}> = ({data, labels, delay, color = theme.colors.primary}) => (
  <Chart delay={delay} option={{
    xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
    series: [{ type: 'line', data, smooth: true, lineStyle: { width: 5, color }, areaStyle: { color: `${color}22` }, itemStyle: { color } }]
  }} />
);

export const SentimentDonut: React.FC<{positive: number; neutral: number; negative: number; delay?: number}> = ({positive, neutral, negative, delay}) => (
  <Chart delay={delay} option={{
    series: [{
      type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: theme.colors.slate[900], borderWidth: 5 },
      label: { show: false },
      data: [
        { value: positive, name: 'Bullish', itemStyle: { color: theme.colors.success } },
        { value: neutral, name: 'Neutral', itemStyle: { color: theme.colors.slate[600] } },
        { value: negative, name: 'Bearish', itemStyle: { color: theme.colors.danger } }
      ]
    }]
  }} />
);

export const RiskMatrix: React.FC<{data: any[]; delay?: number}> = ({data, delay}) => (
  <Chart delay={delay} option={{
    visualMap: { min: 0, max: 10, orient: 'horizontal', left: 'center', bottom: '0%', show: false, inRange: { color: [theme.colors.success, theme.colors.warning, theme.colors.danger] } },
    xAxis: { type: 'category', data: ['Impact', 'Prob.', 'Time'], axisLabel: { color: theme.colors.slate[400] } },
    yAxis: { type: 'category', data: ['Geopolitics', 'Inflation', 'Liquidity', 'Regul.'], axisLabel: { color: theme.colors.slate[400] } },
    series: [{ type: 'heatmap', data, label: { show: true, fontSize: 20, fontWeight: 800 } }]
  }} />
);
