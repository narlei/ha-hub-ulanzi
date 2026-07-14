// Long-press detection — distinguishes tap from long-press per context.
// Long-press threshold default 500ms; configurable.

class LongPressDetector {
  constructor(threshold = 500) {
    this.threshold = threshold;
    this.timers = new Map();
    this.fired = new Map();
    this.onTap = null;
    this.onLongPress = null;
  }

  keyDown(context) {
    this.fired.set(context, false);
    const t = setTimeout(() => {
      this.fired.set(context, true);
      if (this.onLongPress) this.onLongPress(context);
    }, this.threshold);
    this.timers.set(context, t);
  }

  keyUp(context) {
    const t = this.timers.get(context);
    if (t) {
      clearTimeout(t);
      this.timers.delete(context);
    }
    if (!this.fired.get(context)) {
      if (this.onTap) this.onTap(context);
    }
    this.fired.delete(context);
  }
}

window.LongPressDetector = LongPressDetector;
