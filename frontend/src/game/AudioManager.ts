/**
 * Gestor de audio procedural ligero mediante Web Audio API nativa.
 * Genera efectos sonoros sinteticos en tiempo real sin requerir archivos externos.
 */

export type FootstepSurface = 'grass' | 'water' | 'wood';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.35;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    } catch {
      console.warn('[WARN] Web Audio API no soportada en este entorno.');
    }
  }

  /**
   * Reanuda el contexto de audio si fue suspendido por la politica del navegador.
   */
  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Genera un buffer de ruido blanco aleatorio en memoria.
   */
  private createNoiseBuffer(duration = 0.2): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Reproduce un sonido de pisada adaptado segun la superficie transitada y la velocidad.
   */
  public playFootstep(surface: FootstepSurface, isRunning = false): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const intensity = isRunning ? 1.25 : 0.95;

    switch (surface) {
      case 'water':
        this.playWaterFootstep(now, intensity);
        break;
      case 'wood':
        this.playWoodFootstep(now, intensity);
        break;
      case 'grass':
      default:
        this.playGrassFootstep(now, intensity);
        break;
    }
  }

  /**
   * Sintesis de pisada sobre pasto y tierra seca (crujido vegetal suave filtrado paso bajo).
   */
  private playGrassFootstep(time: number, intensity: number): void {
    if (!this.ctx || !this.masterGain) return;

    const noiseBuffer = this.createNoiseBuffer(0.12);
    if (!noiseBuffer) return;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Filtro paso bajo para atenuar frecuencias altas y simular tierra/pasto
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const baseFreq = 500 + Math.random() * 120;
    filter.frequency.setValueAtTime(baseFreq, time);
    filter.Q.setValueAtTime(1.2, time);

    const gain = this.ctx.createGain();
    const peakVolume = 0.22 * intensity * (0.85 + Math.random() * 0.3);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(peakVolume, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noiseSource.start(time);
    noiseSource.stop(time + 0.1);
  }

  /**
   * Sintesis de chapoteo en el agua del pantano (burbuja de agua + salpicadura liquida resonante).
   */
  private playWaterFootstep(time: number, intensity: number): void {
    if (!this.ctx || !this.masterGain) return;

    // 1. Salpicadura de ruido liquido
    const noiseBuffer = this.createNoiseBuffer(0.16);
    if (noiseBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      const centerFreq = 950 + Math.random() * 250;
      bandpass.frequency.setValueAtTime(centerFreq, time);
      bandpass.Q.setValueAtTime(2.8, time);

      const noiseGain = this.ctx.createGain();
      const peakVol = 0.32 * intensity;
      noiseGain.gain.setValueAtTime(0.001, time);
      noiseGain.gain.linearRampToValueAtTime(peakVol, time + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

      noiseSource.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noiseSource.start(time);
      noiseSource.stop(time + 0.15);
    }

    // 2. Golpe de burbuja/desplazamiento de liquido (barrido sinusoidal rapido)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const startFreq = 380 + Math.random() * 80;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(140, time + 0.08);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.18 * intensity, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.09);
  }

  /**
   * Sintesis de pisada sobre madera (tablones de la sala de bienvenida).
   */
  private playWoodFootstep(time: number, intensity: number): void {
    if (!this.ctx || !this.masterGain) return;

    // Impacto sordo de madera
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const woodFreq = 140 + Math.random() * 30;
    osc.frequency.setValueAtTime(woodFreq, time);
    osc.frequency.exponentialRampToValueAtTime(woodFreq * 0.7, time + 0.07);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.25 * intensity, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.08);

    // Chasquido de suela
    const clickBuffer = this.createNoiseBuffer(0.04);
    if (clickBuffer) {
      const clickSource = this.ctx.createBufferSource();
      clickSource.buffer = clickBuffer;

      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(1200, time);

      const clickGain = this.ctx.createGain();
      clickGain.gain.setValueAtTime(0.12 * intensity, time);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

      clickSource.connect(highpass);
      highpass.connect(clickGain);
      clickGain.connect(this.masterGain);

      clickSource.start(time);
      clickSource.stop(time + 0.04);
    }
  }

  /**
   * Sonido al iniciar un salto.
   */
  public playJump(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(320, time + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.13);
  }

  /**
   * Sonido al aterrizar contra el suelo tras una caida.
   */
  public playLand(surface: FootstepSurface): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    // El aterrizaje reproduce dos impactos escalonados con mayor intensidad
    this.playFootstep(surface, true);
    setTimeout(() => {
      this.playFootstep(surface, false);
    }, 45);
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
