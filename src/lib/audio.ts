/**
 * Synthesize a soft, pleasant completion chime using the Web Audio API.
 * Works client-side across all modern browsers without any external audio files.
 */
export function playFaceGroupingCompleteSound() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number, gainLevel: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);

      // Smooth linear attack & pleasant exponential decay
      gain.gain.setValueAtTime(0, now + startOffset);
      gain.gain.linearRampToValueAtTime(gainLevel, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    // Ascending two-tone chime: G5 (783.99 Hz) -> C6 (1046.50 Hz)
    playTone(783.99, 0.0, 0.22, 0.15);
    playTone(1046.5, 0.09, 0.36, 0.18);

    // Clean up AudioContext after completion
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // Ignored if browser blocks audio prior to user gesture
  }
}
