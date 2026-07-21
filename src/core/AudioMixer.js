/**
 * AudioMixer.js
 * Controls audio tracks, muting original sound, replacing audio track, and rendering waveforms.
 */

export class AudioMixer {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.replacementAudioFile = null;
    this.replacementAudioEl = null;
    this.replacementAudioBuffer = null;
    this.replacementVolume = 1.0;
    this.videoVolume = 1.0;
    this.listeners = new Map();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(fn => fn(data));
    }
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setMuteOriginal(muted) {
    this.isMuted = muted;
    this.emit('audioConfigChanged', this.getConfig());
  }

  async loadReplacementAudio(file) {
    this.initAudioContext();
    this.replacementAudioFile = file;
    const arrayBuffer = await file.arrayBuffer();
    this.replacementAudioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

    if (this.replacementAudioEl) {
      URL.revokeObjectURL(this.replacementAudioEl.src);
    }
    this.replacementAudioEl = new Audio(URL.createObjectURL(file));

    this.emit('replacementAudioLoaded', {
      name: file.name,
      duration: this.replacementAudioBuffer.duration,
      buffer: this.replacementAudioBuffer
    });
    this.emit('audioConfigChanged', this.getConfig());
    return this.replacementAudioBuffer;
  }

  removeReplacementAudio() {
    if (this.replacementAudioEl) {
      URL.revokeObjectURL(this.replacementAudioEl.src);
      this.replacementAudioEl = null;
    }
    this.replacementAudioFile = null;
    this.replacementAudioBuffer = null;
    this.emit('audioConfigChanged', this.getConfig());
  }

  getConfig() {
    return {
      isMuted: this.isMuted,
      hasReplacementAudio: !!this.replacementAudioBuffer,
      replacementName: this.replacementAudioFile ? this.replacementAudioFile.name : null,
      replacementVolume: this.replacementVolume,
      videoVolume: this.videoVolume
    };
  }

  /**
   * Renders the loaded audio buffer's waveform onto a 2D canvas context
   */
  drawWaveform(canvas, color = '#4285f4') {
    if (!canvas || !this.replacementAudioBuffer) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const data = this.replacementAudioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = color;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  }
}
