// Audio utilities for recording and sounds

export class AudioHelper {
  private static audioCtx: AudioContext | null = null;

  private static getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play subtle feedback sound
  static playPop(pitch = 600, duration = 0.08) {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio not allowed yet:', e);
    }
  }

  static playSentSound() {
    this.playPop(520, 0.09);
    setTimeout(() => this.playPop(780, 0.12), 60);
  }

  static playReceiveSound() {
    this.playPop(440, 0.08);
    setTimeout(() => this.playPop(660, 0.1), 80);
  }

  static playRecordStart() {
    this.playPop(300, 0.1);
  }

  static playRecordEnd() {
    this.playPop(480, 0.08);
  }
}
