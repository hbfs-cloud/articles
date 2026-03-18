import React from 'react';
import {theme} from '../../../theme/Theme';
import {Divider, Motion} from '../atoms/Atoms';
import {CodeBlock, TechNode, StepItem, ProTip} from '../molecules/TechMolecules';

/**
 * 1. Code Comparison (Old vs New / Error vs Fix)
 */
export const CodeComparison: React.FC<{oldCode: string; newCode: string; delay?: number}> = ({oldCode, newCode, delay = 0}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
    <CodeBlock code={oldCode} language="BEFORE" delay={delay} />
    <CodeBlock code={newCode} language="AFTER" delay={delay + 10} />
  </div>
);

/**
 * 2. Training Curriculum List
 */
export const CurriculumList: React.FC<{steps: any[]; delay?: number}> = ({steps, delay = 0}) => (
  <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
    {steps.map((step, i) => (
      <StepItem key={i} number={i + 1} title={step.title} delay={delay + (i * 10)}>
        {step.description}
      </StepItem>
    ))}
  </div>
);

/**
 * 3. System Architecture Diagram
 */
export const ArchitectureDiagram: React.FC<{nodes: any[]; delay?: number}> = ({nodes, delay = 0}) => (
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', padding: '40px 0'}}>
    <div style={{display: 'flex', gap: '40px'}}>
      {nodes.slice(0, 3).map((n, i) => <TechNode key={i} {...n} delay={delay + (i * 10)} />)}
    </div>
    <Motion type="fade" delay={delay + 30}><div style={{width: '2px', height: '60px', background: 'rgba(255,255,255,0.2)'}} /></Motion>
    <TechNode label="MarketWatch Gateway" sublabel="Central Hub" color={theme.colors.info} delay={delay + 40} />
    <Motion type="fade" delay={delay + 50}><div style={{width: '2px', height: '60px', background: 'rgba(255,255,255,0.2)'}} /></Motion>
    <div style={{display: 'flex', gap: '40px'}}>
      {nodes.slice(3).map((n, i) => <TechNode key={i} {...n} delay={delay + 60 + (i * 10)} />)}
    </div>
  </div>
);

/**
 * 4. Technical Summary Slide
 */
export const TechSummary: React.FC<{points: string[]; delay?: number}> = ({points, delay = 0}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px'}}>
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
      {points.map((p, i) => (
        <Motion key={i} delay={delay + (i * 10)} type="slide-right" style={{display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px'}}>
          <div style={{width: '12px', height: '12px', borderRadius: '50%', background: theme.colors.success}} />
          <span style={{fontSize: '26px', color: '#fff'}}>{p}</span>
        </Motion>
      ))}
    </div>
    <ProTip delay={delay + 40}>
      Performance optimized for high-frequency data streams using WebSockets and LRU caching.
    </ProTip>
  </div>
);
