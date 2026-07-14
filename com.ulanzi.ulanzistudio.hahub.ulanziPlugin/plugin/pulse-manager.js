// PulseManager — orchestrates animated icon redraws for actions that
// want to attract attention (e.g. running deferrable, alert state).
//
// An action registers a context with a render-callback receiving the
// current pulse phase (0..1, sine-wave). The callback is responsible
// for using `phase` to alter colors/opacity and call setBaseDataIcon.
// Stop pulsing by calling stop(context).

class PulseManager {
  constructor() {
    this.entries = new Map();    // context -> { speed, callback, phase, lastTick }
    this.timer = null;
    this.tickMs = 80;            // ~12 fps, smooth enough for LCD feedback
  }

  start(context, speed, callback) {
    // speed: 'slow' (1Hz), 'normal' (1.5Hz), 'fast' (3Hz), 'breathing' (0.5Hz)
    const speeds = { slow: 0.001, normal: 0.0015, fast: 0.003, breathing: 0.0005 };
    const rate = speeds[speed] || speeds.normal;
    this.entries.set(context, { rate, callback, phase: 0, lastTick: Date.now() });
    if (!this.timer) this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  stop(context) {
    if (this.entries.has(context)) {
      this.entries.delete(context);
    }
    if (this.entries.size === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isPulsing(context) {
    return this.entries.has(context);
  }

  tick() {
    const now = Date.now();
    this.entries.forEach((entry, context) => {
      const dt = now - entry.lastTick;
      entry.lastTick = now;
      entry.phase = (entry.phase + dt * entry.rate) % 1;
      // Convert linear 0..1 phase to sine 0..1 for breathing effect
      const sine = (Math.sin(entry.phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      try {
        entry.callback(sine);
      } catch (e) {
        console.warn('[HA Hub] pulse callback error:', e.message);
      }
    });
  }
}

window.PulseManager = PulseManager;
