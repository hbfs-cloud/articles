import React from 'react';
import {theme} from '../../../theme/Theme';
import {Motion, GlassBox, Text, Caption} from '../atoms/Atoms';

/**
 * 1. Code Block Component
 */
export const CodeBlock: React.FC<{code: string; language: string; delay?: number}> = ({code, language, delay = 0}) => (
  <Motion delay={delay} type="blur">
    <GlassBox padding="30px" style={{background: '#010409', border: '1px solid #30363d'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #30363d', paddingBottom: '10px'}}>
        <Caption style={{color: '#8b949e', fontSize: '14px'}}>{language}</Caption>
        <div style={{display: 'flex', gap: '8px'}}>
          <div style={{width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56'}} />
          <div style={{width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e'}} />
          <div style={{width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f'}} />
        </div>
      </div>
      <pre style={{margin: 0, overflow: 'hidden'}}>
        <code style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '24px',
          color: '#e6edf3',
          lineHeight: 1.4
        }}>
          {code}
        </code>
      </pre>
    </GlassBox>
  </Motion>
);

/**
 * 2. Step / Course Item
 */
export const StepItem: React.FC<{number: number; title: string; children: React.ReactNode; delay?: number}> = ({number, title, children, delay = 0}) => (
  <Motion delay={delay} type="slide-right" style={{display: 'flex', gap: '30px', marginBottom: '40px'}}>
    <div style={{
      width: '80px', height: '80px', borderRadius: '20px', 
      background: theme.colors.primary, display: 'flex', alignItems: 'center', 
      justifyContent: 'center', fontSize: '40px', fontWeight: 900, color: 'white',
      flexShrink: 0, boxShadow: `0 10px 20px ${theme.colors.primary}44`
    }}>{number}</div>
    <div>
      <h4 style={{fontSize: '36px', fontWeight: 800, color: theme.colors.slate[50], margin: '0 0 10px 0'}}>{title}</h4>
      <Text style={{fontSize: '28px'}}>{children}</Text>
    </div>
  </Motion>
);

/**
 * 3. Pro Tip / Note
 */
export const ProTip: React.FC<{children: React.ReactNode; delay?: number}> = ({children, delay = 0}) => (
  <Motion delay={delay} type="pop">
    <div style={{
      background: `linear-gradient(135deg, ${theme.colors.info}22, ${theme.colors.primary}22)`,
      padding: '30px', borderRadius: '20px', borderLeft: `8px solid ${theme.colors.info}`,
      display: 'flex', gap: '20px', alignItems: 'center'
    }}>
      <div style={{fontSize: '40px'}}>💡</div>
      <Text style={{fontWeight: 600, color: theme.colors.slate[100]}}>{children}</Text>
    </div>
  </Motion>
);

/**
 * 4. Architecture Node (for Tech articles)
 */
export const TechNode: React.FC<{label: string; sublabel: string; color?: string; delay?: number}> = ({label, sublabel, color = theme.colors.primary, delay = 0}) => (
  <Motion delay={delay} type="scale">
    <div style={{
      width: '300px', padding: '20px', borderRadius: '20px', 
      background: `${color}11`, border: `2px solid ${color}44`,
      textAlign: 'center'
    }}>
      <div style={{fontSize: '28px', fontWeight: 800, color: '#fff'}}>{label}</div>
      <div style={{fontSize: '18px', fontWeight: 600, color: color, marginTop: '5px'}}>{sublabel}</div>
    </div>
  </Motion>
);
