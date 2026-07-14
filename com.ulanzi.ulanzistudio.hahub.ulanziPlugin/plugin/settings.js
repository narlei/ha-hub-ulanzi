// Settings manager — wraps Ulanzi global + action settings.
// Global: { haUrl, token } — shared across all actions.
// Per-key: action-specific config keyed by context.

class Settings {
  constructor() {
    this.global = { haUrl: '', token: '' };
    this.keys = new Map();
    this._listeners = new Set();
  }

  setGlobal(g) {
    this.global = {
      haUrl: (g?.haUrl || '').trim().replace(/\/+$/, ''),
      token: (g?.token || '').trim()
    };
    if ($UD) $UD.setGlobalSettings(this.global);
    this._listeners.forEach(fn => fn(this.global));
  }

  loadGlobalFrom(message) {
    if (message?.param) {
      this.global = {
        haUrl: (message.param.haUrl || '').trim().replace(/\/+$/, ''),
        token: (message.param.token || '').trim()
      };
      this._listeners.forEach(fn => fn(this.global));
    }
  }

  onGlobalChange(fn) {
    this._listeners.add(fn);
  }

  setKey(context, data) {
    this.keys.set(context, data || {});
  }

  getKey(context) {
    return this.keys.get(context) || {};
  }

  removeKey(context) {
    this.keys.delete(context);
  }
}

window.HASettings = Settings;
