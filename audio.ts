/**
 * وحدة الصوت والموسيقى الخلفية (Audio Module)
 * تحترم قيود Autoplay في المتصفحات وتعمل بهدوء تام بعد تفاعل المستخدم
 */

import { BACKGROUND_MUSIC_URL } from '../config';

class AudioController {
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private isPlaying = false;
  private hasUserInteracted = false;
  private enabled = false;
  private volume = 0.2;
  private customUrl = '';

  public registerUserInteraction() {
    this.hasUserInteracted = true;
    if (this.enabled && !this.isPlaying) {
      this.start();
    }
  }

  public configure(options: {
    enabled: boolean;
    volume?: number;
    customUrl?: string;
  }) {
    const urlChanged =
      options.customUrl !== undefined && options.customUrl !== this.customUrl;
    this.enabled = options.enabled;
    if (options.volume !== undefined) {
      this.volume = Math.max(0.02, Math.min(0.8, options.volume));
    }
    if (options.customUrl !== undefined) {
      this.customUrl = options.customUrl.trim();
    }

    if (urlChanged && this.isPlaying) {
      this.stop();
    }

    if (this.enabled && this.hasUserInteracted) {
      this.start();
      this.updateVolume();
    } else if (!this.enabled) {
      this.stop();
    }
  }

  private getEffectiveUrl(): string {
    return (this.customUrl || BACKGROUND_MUSIC_URL || '').trim();
  }

  private updateVolume() {
    if (this.audioEl) {
      this.audioEl.volume = this.volume;
    }
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(
        this.volume * 0.12,
        this.audioCtx.currentTime,
        0.4
      );
    }
  }

  public start() {
    if (!this.hasUserInteracted || !this.enabled || this.isPlaying) return;

    const url = this.getEffectiveUrl();

    if (url) {
      try {
        if (!this.audioEl || this.audioEl.src !== url) {
          this.audioEl = new Audio(url);
          this.audioEl.loop = true;
        }
        this.audioEl.volume = this.volume;
        this.audioEl
          .play()
          .then(() => {
            this.isPlaying = true;
          })
          .catch(() => {
            // Autoplay blocked or invalid URL — fallback silently
            this.isPlaying = false;
          });
      } catch {
        this.isPlaying = false;
      }
      return;
    }

    // في حال عدم وضع رابط خارجي في BACKGROUND_MUSIC_URL بعد، نولّد خلفية صوتية محيطية هادئة جدًا عبر Web Audio API
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const master = this.audioCtx.createGain();
      master.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
      master.gain.exponentialRampToValueAtTime(
        Math.max(0.01, this.volume * 0.12),
        this.audioCtx.currentTime + 2.5
      );

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, this.audioCtx.currentTime);

      master.connect(filter);
      filter.connect(this.audioCtx.destination);

      // تآلف دافئ وهادئ جدًا (A2 + E3 + C#4 خافت)
      const freqs = [110, 164.81, 220];
      this.oscillators = freqs.map((freq, idx) => {
        const osc = this.audioCtx!.createOscillator();
        const oscGain = this.audioCtx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx!.currentTime);
        oscGain.gain.setValueAtTime(idx === 2 ? 0.15 : 0.4, this.audioCtx!.currentTime);
        osc.connect(oscGain);
        oscGain.connect(master);
        osc.start();
        return osc;
      });

      this.masterGain = master;
      this.isPlaying = true;
    } catch {
      this.isPlaying = false;
    }
  }

  public stop() {
    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch {}
    }

    if (this.oscillators.length > 0) {
      this.oscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      });
      this.oscillators = [];
    }

    this.isPlaying = false;
  }
}

export const AudioModule = new AudioController();
