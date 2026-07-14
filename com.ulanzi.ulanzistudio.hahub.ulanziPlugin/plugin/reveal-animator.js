// RevealAnimator — orchestrates the "HA logo → real content" reveal animation
// on first activation of a key. Triggered by SDK's setActive event.
//
// Two modes:
//   1. Per-key (default): each tile shows its own complete HA logo, then flips.
//   2. Puzzle (experimental, opt-in): all keys collectively show ONE giant
//      logo, each tile rendering its slice based on its grid position.

class RevealAnimator {
  constructor() {
    this.enabled = true;
    this.puzzleMode = false;       // experimental coordinated reveal
    this.durationMs = 600;
    this.frameMs = 50;             // ~20fps
    this.active = new Map();       // context -> { startTime, action, key }
    this.lastRevealAt = new Map(); // context -> timestamp; throttle repeats
    this.throttleMs = 1500;

    // For puzzle mode, the deck dimensions. D200X is 5 cols × 3 rows on
    // most layouts. We auto-detect from observed key strings if possible,
    // but fall back to 5×3 since that's the most common.
    this.gridRows = 3;
    this.gridCols = 5;
    this.observedKeys = new Set();
  }

  setEnabled(on) { this.enabled = !!on; }
  setPuzzleMode(on) { this.puzzleMode = !!on; }

  // Parse "row_col" key string into [row, col]; returns null if not parseable.
  parseKey(keyStr) {
    if (!keyStr || typeof keyStr !== 'string') return null;
    const m = keyStr.match(/^(\d+)_(\d+)$/);
    if (!m) return null;
    return [parseInt(m[1], 10), parseInt(m[2], 10)];
  }

  // Update grid bounds based on observed keys. Helps puzzle mode adapt to
  // decks of different sizes (D200, D200X, Dial, etc.).
  rememberKey(keyStr) {
    if (!keyStr) return;
    this.observedKeys.add(keyStr);
    const parsed = this.parseKey(keyStr);
    if (!parsed) return;
    const [r, c] = parsed;
    if (r + 1 > this.gridRows) this.gridRows = r + 1;
    if (c + 1 > this.gridCols) this.gridCols = c + 1;
  }

  // Trigger reveal animation. action and keyStr come from message.
  start(context, action, keyStr) {
    if (!this.enabled) {
      if (action.render) action.render();
      return;
    }
    if (this.active.has(context)) return;

    const lastTime = this.lastRevealAt.get(context);
    if (lastTime && Date.now() - lastTime < this.throttleMs) {
      if (action.render) action.render();
      return;
    }
    this.lastRevealAt.set(context, Date.now());
    this.rememberKey(keyStr);

    const entry = {
      startTime: Date.now(),
      action,
      key: keyStr,
      timer: null
    };
    this.active.set(context, entry);

    const tick = () => {
      const e = this.active.get(context);
      if (!e) return;
      const elapsed = Date.now() - e.startTime;
      const progress = Math.min(1, elapsed / this.durationMs);

      try {
        let data;
        if (this.puzzleMode) {
          const parsed = this.parseKey(e.key) || [0, 0];
          data = window.IconRenderer.renderPuzzlePiece({
            gridRow: parsed[0],
            gridCol: parsed[1],
            totalRows: this.gridRows,
            totalCols: this.gridCols,
            progress
          });
        } else {
          data = window.IconRenderer.renderRevealFrame(progress);
        }
        $UD.setBaseDataIcon(context, data, '');
      } catch (err) {
        console.warn('[HA Hub] reveal frame error:', err.message);
      }

      if (progress >= 1) {
        this.active.delete(context);
        if (e.action.render) e.action.render();
        return;
      }

      e.timer = setTimeout(tick, this.frameMs);
    };

    tick();
  }

  cancel(context) {
    const e = this.active.get(context);
    if (e?.timer) clearTimeout(e.timer);
    this.active.delete(context);
  }

  isActive(context) {
    return this.active.has(context);
  }
}

window.RevealAnimator = RevealAnimator;
