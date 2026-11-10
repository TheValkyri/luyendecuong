/**
 * Section 5.5: Apple-Grade Acoustic & Taptic Web Audio Sound Engine
 * - Zero external audio SDKs, zero network audio downloads
 * - Multi-layered acoustic synthesis with warm lowpass filtering & harmonic overtones
 * - Supports all 6 required cues:
 *   1. button_interaction (Apple Force Touch / Taptic subtle woody tap)
 *   2. answer_selection (iOS Selection Pop with warm 5th harmonic resonance)
 *   3. navigation (Apple Books airy page glide)
 *   4. countdown_warning (Apple Watch gentle glass double-chime)
 *   5. submission_confirmation (Apple Pay ascending confirmation triad)
 *   6. exam_completion (Apple Keynote warm Major-9th completion chord)
 * - Never autoplays on page load, never loops, attenuates in Exam Mode
 */

export type SoundCueType =
  | 'button_interaction'
  | 'answer_selection'
  | 'navigation'
  | 'countdown_warning'
  | 'submission_confirmation'
  | 'exam_completion';

export interface SoundEngineSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
  examMode: boolean;
}

const STORAGE_KEY = 'khaothi_sound_settings_v2';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private settings: SoundEngineSettings = {
    enabled: true,
    volume: 0.38,
    examMode: false,
  };
  private lastPlayedTimestamp = 0;

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.enabled === 'boolean') this.settings.enabled = parsed.enabled;
          if (typeof parsed.volume === 'number') {
            this.settings.volume = Math.max(0, Math.min(1, parsed.volume));
          }
        }
      }
    } catch {
      // Ignore storage access errors in restricted frames
    }
  }

  private persistSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            enabled: this.settings.enabled,
            volume: this.settings.volume,
          })
        );
      }
    } catch {
      // Ignore storage errors
    }
  }

  public getSettings(): SoundEngineSettings {
    return { ...this.settings };
  }

  public setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.persistSettings();
  }

  public setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    this.persistSettings();
  }

  public setExamMode(examMode: boolean): void {
    this.settings.examMode = examMode;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays an Apple-inspired acoustic/taptic synthesized sound cue.
   * Returns true if scheduled, false if muted/throttled/unsupported.
   */
  public play(cue: SoundCueType): boolean {
    if (!this.settings.enabled || this.settings.volume <= 0.001) {
      return false;
    }

    const nowMs = Date.now();
    // Prevent overlapping rapid sound bursts (< 35ms apart)
    if (nowMs - this.lastPlayedTimestamp < 35) {
      return false;
    }
    this.lastPlayedTimestamp = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return false;

    // In Exam Mode, attenuate subtle UI clicks by 45% to keep focus calm
    const modeAttenuation = this.settings.examMode ? 0.55 : 1.0;
    const masterGain = Math.max(0.001, Math.min(0.65, this.settings.volume * modeAttenuation));
    const t0 = ctx.currentTime;

    switch (cue) {
      case 'button_interaction': {
        // Apple Taptic subtle woody tap (ultra-short 22ms low-passed impulse)
        this.scheduleAcousticVoice(ctx, {
          startFreq: 720,
          endFreq: 260,
          startTime: t0,
          durationSec: 0.022,
          peakGain: masterGain * 0.28,
          type: 'sine',
          filterCutoffHz: 1300,
        });
        break;
      }
      case 'answer_selection': {
        // iOS Selection Pop + warm fifth harmonic overtone
        this.scheduleAcousticVoice(ctx, {
          startFreq: 493.88,
          endFreq: 587.33,
          startTime: t0,
          durationSec: 0.055,
          peakGain: masterGain * 0.36,
          type: 'sine',
          filterCutoffHz: 1800,
        });
        this.scheduleAcousticVoice(ctx, {
          startFreq: 739.99,
          endFreq: 880,
          startTime: t0 + 0.006,
          durationSec: 0.048,
          peakGain: masterGain * 0.14,
          type: 'triangle',
          filterCutoffHz: 1600,
        });
        break;
      }
      case 'navigation': {
        // Airy Apple Books page glide
        this.scheduleAcousticVoice(ctx, {
          startFreq: 370,
          endFreq: 440,
          startTime: t0,
          durationSec: 0.04,
          peakGain: masterGain * 0.24,
          type: 'sine',
          filterCutoffHz: 950,
        });
        break;
      }
      case 'countdown_warning': {
        // Apple Watch gentle glass double-chime (A5 -> E5)
        this.scheduleAcousticVoice(ctx, {
          startFreq: 880,
          endFreq: 880,
          startTime: t0,
          durationSec: 0.11,
          peakGain: masterGain * 0.42,
          type: 'sine',
          filterCutoffHz: 2400,
        });
        this.scheduleAcousticVoice(ctx, {
          startFreq: 659.25,
          endFreq: 659.25,
          startTime: t0 + 0.125,
          durationSec: 0.15,
          peakGain: masterGain * 0.45,
          type: 'sine',
          filterCutoffHz: 2200,
        });
        break;
      }
      case 'submission_confirmation': {
        // Apple Pay reassuring ascending chime (C5 -> G5 -> C6)
        const notes = [
          { freq: 523.25, delay: 0, dur: 0.09, gain: 0.38 },
          { freq: 783.99, delay: 0.065, dur: 0.11, gain: 0.42 },
          { freq: 1046.5, delay: 0.135, dur: 0.2, gain: 0.46 },
        ];
        notes.forEach((n) => {
          this.scheduleAcousticVoice(ctx, {
            startFreq: n.freq,
            endFreq: n.freq,
            startTime: t0 + n.delay,
            durationSec: n.dur,
            peakGain: masterGain * n.gain,
            type: 'sine',
            filterCutoffHz: 2600,
          });
        });
        break;
      }
      case 'exam_completion': {
        // Apple Keynote warm Major-9th completion chord (C5 -> E5 -> G5 -> B5 -> D6)
        const chord = [523.25, 659.25, 783.99, 987.77, 1174.66];
        chord.forEach((freq, idx) => {
          this.scheduleAcousticVoice(ctx, {
            startFreq: freq,
            endFreq: freq,
            startTime: t0 + idx * 0.058,
            durationSec: 0.24,
            peakGain: masterGain * (0.42 - idx * 0.04),
            type: 'sine',
            filterCutoffHz: 2800,
          });
        });
        break;
      }
    }
    return true;
  }

  private scheduleAcousticVoice(
    ctx: AudioContext,
    opts: {
      startFreq: number;
      endFreq: number;
      startTime: number;
      durationSec: number;
      peakGain: number;
      type: OscillatorType;
      filterCutoffHz: number;
    }
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.startFreq, opts.startTime);
    if (opts.endFreq !== opts.startFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        opts.endFreq,
        opts.startTime + opts.durationSec
      );
    }

    gain.gain.setValueAtTime(0.0001, opts.startTime);
    gain.gain.linearRampToValueAtTime(
      opts.peakGain,
      opts.startTime + Math.min(0.008, opts.durationSec * 0.2)
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + opts.durationSec);

    if (typeof ctx.createBiquadFilter === 'function') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(opts.filterCutoffHz, opts.startTime);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(ctx.destination);

    osc.start(opts.startTime);
    osc.stop(opts.startTime + opts.durationSec + 0.012);
  }
}

export const soundEngine = new SoundEngine();
