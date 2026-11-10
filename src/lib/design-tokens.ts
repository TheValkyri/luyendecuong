/**
 * Unified Design System Tokens & Motion Specification (Sections 5.2, 5.3, 5.4, 5.7)
 * Enforces single source of truth across Student Workspace, Teacher Dashboard, and Question Studio.
 */

export type ComponentVisualState =
  | 'default'
  | 'hover'
  | 'active'
  | 'focus'
  | 'selected'
  | 'disabled'
  | 'loading'
  | 'success'
  | 'warning'
  | 'error'
  | 'offline';

export const SUPPORTED_COMPONENT_STATES: readonly ComponentVisualState[] = [
  'default',
  'hover',
  'active',
  'focus',
  'selected',
  'disabled',
  'loading',
  'success',
  'warning',
  'error',
  'offline',
] as const;

export const DESIGN_SYSTEM_TOKENS = {
  meta: {
    name: 'KhaoThi Precision Design System',
    version: '2.0.0',
    artDirection: 'Utilitarian Editorial & Swiss Precision EdTech',
    wcagTarget: 'WCAG 2.2 AA',
    dials: {
      DESIGN_VARIANCE: 4,
      MOTION_INTENSITY: 5,
      VISUAL_DENSITY: 6,
    },
  },
  colors: {
    light: {
      canvas: '#F6F7F9',
      surface: '#FFFFFF',
      elevated: '#FFFFFF',
      subtle: '#EEF1F5',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#475569',
      accentPrimary: '#0369A1',
      accentHover: '#075985',
      accentActive: '#0C4A6E',
      accentSubtle: '#E0F2FE',
      statusSuccess: '#065F46',
      statusWarning: '#92400E',
      statusError: '#991B1B',
      statusOffline: '#334155',
      borderSubtle: '#E2E8F0',
      borderDefault: '#CBD5E1',
    },
    dark: {
      canvas: '#0B0F17',
      surface: '#111827',
      elevated: '#1E293B',
      subtle: '#162032',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      accentPrimary: '#38BDF8',
      accentHover: '#7DD3FC',
      accentActive: '#0284C7',
      accentSubtle: 'rgba(56, 189, 248, 0.14)',
      statusSuccess: '#6EE7B7',
      statusWarning: '#FCD34D',
      statusError: '#FCA5A5',
      statusOffline: '#CBD5E1',
      borderSubtle: '#1E293B',
      borderDefault: '#334155',
    },
  },
  typography: {
    fontSans: "'Plus Jakarta Sans', 'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
    fontMono: "'JetBrains Mono', 'Geist Mono', monospace",
    scale: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
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
  },
  radii: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '22px',
    pill: '9999px',
  },
  elevation: {
    base: 1,
    sticky: 20,
    drawer: 40,
    modal: 50,
    toast: 60,
  },
  motion: {
    durationsMs: {
      microInteraction: 150,      // Spec: 120-180ms
      componentTransition: 220,   // Spec: 180-260ms
      modalTransition: 240,       // Spec: 180-300ms
      completionAnimation: 380,   // Spec: 300-450ms
    },
    easing: {
      spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      smooth: 'cubic-bezier(0.32, 0.72, 0, 1)',
      outQuart: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
    gpuPropertiesOnly: ['transform', 'opacity'] as const,
  },
  breakpointsPx: {
    smallMobile: 360,
    mobile: 390,
    tablet: 768,
    laptop: 1024,
    desktop: 1440,
  },
  iconSystem: {
    library: '@phosphor-icons/react',
    defaultWeight: 'regular',
    activeWeight: 'fill',
    emojiAllowed: false,
  },
} as const;

/**
 * Helper returning semantic class names for each of the 11 required component states.
 */
export function getStateTokenClasses(state: ComponentVisualState): string {
  switch (state) {
    case 'default':
      return 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-default)]';
    case 'hover':
      return 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-strong)] -translate-y-[1px]';
    case 'active':
      return 'bg-[var(--bg-muted)] text-[var(--text-primary)] border-[var(--accent-primary)] scale-[0.985]';
    case 'focus':
      return 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]';
    case 'selected':
      return 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-primary)] font-semibold';
    case 'disabled':
      return 'bg-[var(--bg-subtle)] text-[var(--text-disabled)] border-[var(--border-subtle)] opacity-55 cursor-not-allowed';
    case 'loading':
      return 'skeleton-shimmer text-transparent border-[var(--border-subtle)] cursor-wait';
    case 'success':
      return 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]';
    case 'warning':
      return 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]';
    case 'error':
      return 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]';
    case 'offline':
      return 'bg-[var(--status-offline-bg)] text-[var(--status-offline-text)] border-[var(--status-offline-border)] border-dashed';
  }
}
