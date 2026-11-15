/**
 * Audio 100% procedural con Web Audio API.
 * No hay archivos de sonido: se sintetizan ruido filtrado y osciladores.
 * Todo se crea tras el primer gesto del usuario (requisito de los navegadores).
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.thruster = null;
    this.welder = null;
    this.breath = null;
    this.ready = false;

    this._thrusterValue = -1;
    this._welderOn = false;
    this._breathValue = -1;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      this._build(new Ctx());
    } catch (error) {
      console.warn('[audio] Web Audio no disponible:', error);
    }
  }

  _build(ctx) {
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.55;
    master.connect(ctx.destination);
    this.master = master;

    // Buffer de ruido reutilizado por todos los sistemas.
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    this._buildThruster(ctx, buffer, master);
    this._buildWelder(ctx, buffer, master);
    this._buildBreath(ctx, buffer, master);

    this.ready = true;
  }

  _buildThruster(ctx, buffer, master) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.9;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter).connect(gain).connect(master);
    source.start();

    this.thruster = { filter, gain };
  }

  _buildWelder(ctx, buffer, master) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2300;
    filter.Q.value = 2.4;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter).connect(gain).connect(master);
    source.start();

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 104;

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0;

    osc.connect(oscGain).connect(master);
    osc.start();

    this.welder = { gain, oscGain };
  }

  _buildBreath(ctx, buffer, master) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 0.7;

    // Modulador: respiración lenta.
    const mod = ctx.createGain();
    mod.gain.value = 0.5;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.26;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(mod.gain);
    lfo.start();

    // Nivel controlable (0 = silencio).
    const level = ctx.createGain();
    level.gain.value = 0;

    source.connect(filter).connect(mod).connect(level).connect(master);
    source.start();

    this.breath = { level };
  }

  /* --------------------------------------------------------------- control */

  setThruster(value) {
    if (!this.thruster) return;
    const v = Math.max(0, Math.min(1, value));
    if (Math.abs(v - this._thrusterValue) < 0.02) return;
    this._thrusterValue = v;

    const now = this.ctx.currentTime;
    this.thruster.gain.gain.setTargetAtTime(v * 0.22, now, 0.07);
    this.thruster.filter.frequency.setTargetAtTime(300 + v * 900, now, 0.09);
  }

  setWelder(on) {
    if (!this.welder || on === this._welderOn) return;
    this._welderOn = on;
    const now = this.ctx.currentTime;
    this.welder.gain.gain.setTargetAtTime(on ? 0.1 : 0, now, 0.03);
    this.welder.oscGain.gain.setTargetAtTime(on ? 0.022 : 0, now, 0.03);
  }

  setBreathing(value) {
    if (!this.breath) return;
    const v = Math.max(0, Math.min(1.6, value));
    if (Math.abs(v - this._breathValue) < 0.05) return;
    this._breathValue = v;
    this.breath.level.gain.setTargetAtTime(v * 0.05, this.ctx.currentTime, 0.4);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
  }

  silenceLoops() {
    this.setThruster(0);
    this.setWelder(false);
    this.setBreathing(0);
  }

  /* -------------------------------------------------------------- one-shots */

  _tone({ freq, freqEnd = null, type = 'sine', duration = 0.2, gain = 0.12, delay = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + delay;
    const end = start + duration;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, end);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(envelope).connect(this.master);
    osc.start(start);
    osc.stop(end + 0.03);
  }

  _noiseBurst({ duration = 0.15, frequency = 1400, q = 1.4, gain = 0.15, type = 'bandpass', delay = 0 }) {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + delay;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter).connect(envelope).connect(this.master);
    source.start(start, Math.random() * 1.5);
    source.stop(start + duration + 0.02);
  }

  ui() {
    this._tone({ freq: 1200, type: 'sine', duration: 0.05, gain: 0.045 });
  }

  ping() {
    this._tone({ freq: 880, freqEnd: 1760, type: 'sine', duration: 0.18, gain: 0.1 });
    this._tone({ freq: 1320, freqEnd: 2200, type: 'sine', duration: 0.14, gain: 0.06, delay: 0.14 });
  }

  clank() {
    this._noiseBurst({ duration: 0.1, frequency: 1900, q: 2.2, gain: 0.16 });
    this._tone({ freq: 240, freqEnd: 120, type: 'triangle', duration: 0.12, gain: 0.08 });
  }

  success() {
    this._tone({ freq: 660, type: 'sine', duration: 0.16, gain: 0.1 });
    this._tone({ freq: 880, type: 'sine', duration: 0.18, gain: 0.09, delay: 0.1 });
    this._tone({ freq: 1320, type: 'sine', duration: 0.3, gain: 0.08, delay: 0.2 });
  }

  alarm() {
    this._tone({ freq: 880, type: 'square', duration: 0.09, gain: 0.06 });
    this._tone({ freq: 660, type: 'square', duration: 0.09, gain: 0.06, delay: 0.14 });
  }

  fail() {
    this._tone({ freq: 220, freqEnd: 90, type: 'sawtooth', duration: 0.5, gain: 0.1 });
    this._noiseBurst({ duration: 0.5, frequency: 300, q: 0.8, gain: 0.12, type: 'lowpass' });
  }

  victory() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      this._tone({ freq, type: 'triangle', duration: 0.5, gain: 0.09, delay: i * 0.13 });
    });
  }
}
