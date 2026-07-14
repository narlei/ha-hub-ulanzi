// Encoder action — rotary dial for stepped numeric controls.
// Use cases: light brightness, media volume, climate temperature.

class EncoderAction {
  constructor(ctx) {
    this.context = ctx;
    this._listener = null;
  }

  static type() { return 'com.ulanzi.ulanzistudio.hahub.encoder'; }

  attach(deps) {
    this.deps = deps;
    this._listener = (e) => {
      const cfg = this.deps.settings.getKey(this.context);
      if (e.detail.entityId === cfg.entityId) this.render();
    };
    deps.cache.addEventListener('entity-changed', this._listener);
    deps.cache.addEventListener('refreshed', () => this.render());
  }

  detach() {
    if (this._listener) {
      this.deps.cache.removeEventListener('entity-changed', this._listener);
    }
  }

  configure(param) {
    this.deps.settings.setKey(this.context, {
      entityId: (param?.entityId || '').trim(),
      label: (param?.label || '').trim(),
      mode: param?.mode || 'brightness',
      step: parseInt(param?.step) || 10,
      min: parseInt(param?.min) || 0,
      max: parseInt(param?.max) || 100,
      theme: param?.theme || 'cool'
    });
    this.render();
  }

  currentValue() {
    const cfg = this.deps.settings.getKey(this.context);
    const ent = this.deps.cache.get(cfg.entityId);
    if (!ent) return null;
    if (cfg.mode === 'brightness') {
      const b = ent.attributes?.brightness;
      return b != null ? Math.round((b / 255) * 100) : null;
    }
    if (cfg.mode === 'volume') {
      const v = ent.attributes?.volume_level;
      return v != null ? Math.round(v * 100) : null;
    }
    if (cfg.mode === 'temperature') {
      return ent.attributes?.temperature ?? null;
    }
    if (cfg.mode === 'numeric') {
      return parseFloat(ent.state);
    }
    return null;
  }

  render() {
    const cfg = this.deps.settings.getKey(this.context);
    const v = this.currentValue();
    const ent = this.deps.cache.get(cfg.entityId);
    const label = (cfg.label || ent?.attributes?.friendly_name || cfg.entityId?.split('.').pop() || '').slice(0, 12);
    const unit = cfg.mode === 'temperature' ? '°' : (cfg.mode === 'brightness' || cfg.mode === 'volume' ? '%' : '');
    const data = window.IconRenderer.renderSensor({
      value: v != null ? Math.round(v) : null,
      unit, label, theme: cfg.theme
    });
    $UD.setBaseDataIcon(this.context, data, '');
  }

  async adjust(direction) {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.entityId) return;
    const cur = this.currentValue();
    if (cur == null) return;
    const target = Math.max(cfg.min, Math.min(cfg.max, cur + direction * cfg.step));
    const [domain] = cfg.entityId.split('.');

    if (cfg.mode === 'brightness') {
      await this.deps.client.callService('light', 'turn_on', {
        brightness_pct: target
      }, { entity_id: cfg.entityId });
    } else if (cfg.mode === 'volume') {
      await this.deps.client.callService('media_player', 'volume_set', {
        volume_level: target / 100
      }, { entity_id: cfg.entityId });
    } else if (cfg.mode === 'temperature') {
      await this.deps.client.callService('climate', 'set_temperature', {
        temperature: target
      }, { entity_id: cfg.entityId });
    } else if (cfg.mode === 'numeric') {
      await this.deps.client.callService(domain, 'set_value', {
        value: target
      }, { entity_id: cfg.entityId });
    }
  }

  onDialRotateLeft()  { this.adjust(-1); }
  onDialRotateRight() { this.adjust(+1); }
  async onDialDown() {
    // Press = toggle for lights/media, otherwise no-op
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.entityId) return;
    const [domain] = cfg.entityId.split('.');
    if (domain === 'light' || domain === 'media_player' || domain === 'switch') {
      await this.deps.client.callService(domain, 'toggle', null, { entity_id: cfg.entityId });
    }
  }
}

window.EncoderAction = EncoderAction;
