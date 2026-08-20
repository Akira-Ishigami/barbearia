export function playNotificationSound() {
  if (typeof window === "undefined") return;

  try {
    type WindowWithWebkitAudio = typeof window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctx = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const now = ctx.currentTime;

    function tone(freq: number, start: number, dur: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.25, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    }

    tone(880, 0, 0.15);
    tone(1175, 0.16, 0.22);

    setTimeout(() => ctx.close(), 700);
  } catch {
    // Audio isn't critical to the flow — fail silently.
  }
}
