export const theme = {
  colors: {
    primary: '#3b82f6', // Blue
    success: '#22c55e', // Green
    warning: '#f59e0b', // Amber
    danger: '#ef4444', // Red
    info: '#8b5cf6', // Purple
    slate: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    glass: 'rgba(15, 23, 42, 0.6)',
    border: 'rgba(255, 255, 255, 0.1)',
  },
  fonts: {
    inter: "'Inter', sans-serif",
  },
  animations: {
    spring: {
      damping: 12,
      stiffness: 100,
    },
    heavy: {
      damping: 20,
      stiffness: 80,
    },
  }
};
