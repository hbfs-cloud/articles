import React, {useMemo} from 'react';
import ReactECharts from 'echarts-for-react';
import {useCurrentFrame, interpolate} from 'remotion';
import {theme} from '../../../theme/Theme';
import {Chart} from './Charts';

/**
 * 1. Advanced Technical Chart (Finviz Style)
 * Shows Candlesticks, SMAs, and Volume with animation
 */
export const TechnicalChart: React.FC<{
  data: any[]; // [date, open, close, low, high, volume]
  sma20?: number[];
  sma50?: number[];
  sma200?: number[];
  annotations?: any[]; // {type: 'line', points: [...]}
  delay?: number;
}> = ({data, sma20, sma50, sma200, annotations, delay = 0}) => {
  if (!data || data.length === 0) {
    return <div style={{color: theme.colors.slate[400], textAlign: 'center', paddingTop: '100px'}}>No chart data available.</div>;
  }
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const option = {
    backgroundColor: 'transparent',
    grid: [
      { left: '8%', right: '8%', height: '65%' },
      { left: '8%', right: '8%', top: '75%', height: '15%' }
    ],
    xAxis: [
      { type: 'category', data: data.map(d => d[0]), axisLine: { lineStyle: { color: theme.colors.slate[700] } }, splitLine: { show: false } },
      { type: 'category', gridIndex: 1, data: data.map(d => d[0]), axisLabel: { show: false }, axisLine: { show: false } }
    ],
    yAxis: [
      { scale: true, axisLine: { lineStyle: { color: theme.colors.slate[700] } }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      { scale: true, gridIndex: 1, splitNumber: 2, axisLabel: { show: false }, axisLine: { show: false }, splitLine: { show: false } }
    ],
    series: [
      {
        type: 'candlestick',
        data: data.map(d => [d[1], d[2], d[3], d[4]]).slice(0, Math.floor(data.length * progress) + 1),
        itemStyle: {
          color: theme.colors.success,
          color0: theme.colors.danger,
          borderColor: theme.colors.success,
          borderColor0: theme.colors.danger
        }
      },
      {
        name: 'SMA20',
        type: 'line',
        data: (sma20 || []).slice(0, Math.floor(data.length * progress) + 1),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: theme.colors.primary }
      },
      {
        name: 'SMA50',
        type: 'line',
        data: (sma50 || []).slice(0, Math.floor(data.length * progress) + 1),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: theme.colors.warning }
      },
      {
        name: 'SMA200',
        type: 'line',
        data: (sma200 || []).slice(0, Math.floor(data.length * progress) + 1),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: theme.colors.info }
      },
      {
        name: 'Volume',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: data.map((d, i) => ({
          value: d[5],
          itemStyle: { color: d[2] >= d[1] ? theme.colors.success + '66' : theme.colors.danger + '66' }
        })).slice(0, Math.floor(data.length * progress) + 1)
      }
    ]
  };

  return <div style={{width: '100%', height: '100%'}}><ReactECharts option={option} style={{height: '100%', width: '100%'}} notMerge={true} /></div>;
};

/**
 * 2. Ownership / Capital Composition (Pie/Sunburst)
 */
export const OwnershipChart: React.FC<{insiders: number; institutions: number; retail: number; delay?: number}> = ({insiders, institutions, retail, delay = 0}) => (
  <Chart delay={delay} option={{
    series: [{
      type: 'pie', radius: ['40%', '75%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 15, borderColor: theme.colors.slate[900], borderWidth: 8 },
      label: { show: true, fontSize: 22, fontWeight: 800, color: '#fff', formatter: '{b}\n{d}%' },
      data: [
        { value: insiders, name: 'Insiders', itemStyle: { color: theme.colors.warning } },
        { value: institutions, name: 'Institutions', itemStyle: { color: theme.colors.primary } },
        { value: retail, name: 'Retail', itemStyle: { color: theme.colors.slate[500] } }
      ]
    }]
  }} />
);

/**
 * 3. Social Sentiment Flow (Area Chart)
 */
export const SocialTrendChart: React.FC<{data: number[]; labels: string[]; delay?: number}> = ({data, labels, delay = 0}) => (
  <Chart delay={delay} option={{
    grid: { left: '5%', right: '5%', bottom: '10%', top: '10%' },
    xAxis: { type: 'category', boundaryGap: false, data: labels, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
    series: [{
      type: 'line', data, smooth: true, symbol: 'none',
      lineStyle: { width: 6, color: theme.colors.info },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: theme.colors.info + '66' }, { offset: 1, color: theme.colors.info + '00' }]
        }
      }
    }]
  }} />
);
