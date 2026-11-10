/**
 * Section 5.4: Motion & Animation Engine
 * - Hardware-accelerated (transform & opacity only)
 * - Calibrated durations: Micro (150ms), Component (220ms), Modal (240ms), Completion (380ms)
 * - Respects prefers-reduced-motion media query and user override
 */

export type MotionCategory = 'micro' | 'component' | 'modal' | 'completion';

export interface MotionSpec {
  category: MotionCategory;
  durationMs: number;
  easing: string;
  cssTransition: string;
}

export const MOTION_SPECS: Record<MotionCategory, MotionSpec> = {
  micro: {
    category: 'micro',
    durationMs: 150, // 120-180ms range
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    cssTransition: 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1), opacity 150ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
  component: {
    category: 'component',
    durationMs: 220, // 180-260ms range
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    cssTransition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
  modal: {
    category: 'modal',
    durationMs: 240, // 180-300ms range
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    cssTransition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
  completion: {
    category: 'completion',
    durationMs: 380, // 300-450ms range
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    cssTransition: 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1), opacity 380ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
};

export class MotionEngine {
  private manualReducedMotion: boolean | null = null;

  public isReducedMotionPreferred(): boolean {
    if (this.manualReducedMotion !== null) {
      return this.manualReducedMotion;
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }

  public setReducedMotionOverride(enabled: boolean | null): void {
    this.manualReducedMotion = enabled;
    if (typeof document !== 'undefined') {
      if (this.isReducedMotionPreferred()) {
        document.documentElement.setAttribute('data-reduced-motion', 'true');
      } else {
        document.documentElement.removeAttribute('data-reduced-motion');
      }
    }
  }

  public getEffectiveDuration(category: MotionCategory): number {
    if (this.isReducedMotionPreferred()) {
      return 0;
    }
    return MOTION_SPECS[category].durationMs;
  }

  public getStyleForTransition(category: MotionCategory): {
    transition: string;
    willChange?: string;
  } {
    if (this.isReducedMotionPreferred()) {
      return { transition: 'none' };
    }
    return {
      transition: MOTION_SPECS[category].cssTransition,
    };
  }
}

export const motionEngine = new MotionEngine();
