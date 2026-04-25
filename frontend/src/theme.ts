// GRC Tool Light Theme with gradient accents
export const theme = {
  colors: {
    // Primary palette - purple/blue gradient tones
    primary: '#6366F1',
    primaryHover: '#4F46E5',
    primaryLight: '#EEF2FF',

    // Backgrounds
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceHover: '#F1F5F9',

    // Borders
    border: '#E2E8F0',
    borderLight: '#F1F5F9',

    // Text
    text: {
      main: '#1E293B',
      secondary: '#475569',
      muted: '#94A3B8',
      inverse: '#FFFFFF',
    },

    // Semantic colors
    semantic: {
      success: '#10B981',
      successLight: '#D1FAE5',
      warning: '#F59E0B',
      warningLight: '#FEF3C7',
      danger: '#EF4444',
      dangerLight: '#FEE2E2',
      info: '#3B82F6',
      infoLight: '#DBEAFE',
    },

    // Risk severity colors
    risk: {
      critical: '#DC2626',
      criticalBg: '#FEE2E2',
      high: '#EA580C',
      highBg: '#FFEDD5',
      medium: '#D97706',
      mediumBg: '#FEF3C7',
      low: '#16A34A',
      lowBg: '#DCFCE7',
    },

    // Heatmap colors (for risk matrix)
    heatmap: {
      negligible: '#22C55E',
      low: '#84CC16',
      medium: '#EAB308',
      high: '#F97316',
      critical: '#EF4444',
    },

    // Gradients
    gradients: {
      hero: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #A855F7 100%)',
      heroSubtle: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
      card: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
    },

    // Sidebar (light theme version)
    sidebar: {
      background: '#FFFFFF',
      itemHover: '#F1F5F9',
      itemActive: '#EEF2FF',
      border: '#E2E8F0',
    },
  },

  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
  },

  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },

  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.03)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.04)',
    card: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
    cardHover: '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.04)',
  },
};

export type Theme = typeof theme;
