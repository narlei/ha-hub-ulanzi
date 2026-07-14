// Sensor display action — read-only key showing entity state + unit.
// Optional thresholds turn the icon warning-coloured.

class SensorAction {
  constructor(ctx) {
    this.context = ctx;
    this._listener = null;
  }

  static type() { return 'com.ulanzi.ulanzistudio.hahub.sensor'; }

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
      attribute: (param?.attribute || '').trim(),
      decimals: parseInt(param?.decimals) || 0,
      thresholdHigh: param?.thresholdHigh != null && param?.thresholdHigh !== '' ? parseFloat(param.thresholdHigh) : null,
      thresholdLow:  param?.thresholdLow  != null && param?.thresholdLow  !== '' ? parseFloat(param.thresholdLow)  : null,
      theme: param?.theme || 'cool'
    });
    this.render();
  }

  formatValue(raw, decimals) {
    if (raw == null) return null;
    const num = parseFloat(raw);
    if (isFinite(num)) {
      return num.toFixed(decimals);
    }
    return String(raw);
  }

  evaluateWarning(value, cfg) {
    const num = parseFloat(value);
    if (!isFinite(num)) return false;
    if (cfg.thresholdHigh != null && num > cfg.thresholdHigh) return true;
    if (cfg.thresholdLow  != null && num < cfg.thresholdLow)  return true;
    return false;
  }

  render() {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.entityId) {
      const data = window.IconRenderer.renderSensor({ value: null, label: '?', theme: cfg.theme });
      $UD.setBaseDataIcon(this.context, data, '');
      return;
    }
    const ent = this.deps.cache.get(cfg.entityId);
    let raw = null, unit = '';
    if (ent) {
      raw = cfg.attribute ? ent.attributes?.[cfg.attribute] : ent.state;
      unit = ent.attributes?.unit_of_measurement || '';
    }
    const value = this.formatValue(raw, cfg.decimals);
    const label = (cfg.label || ent?.attributes?.friendly_name || cfg.entityId.split('.').pop() || '').slice(0, 14);
    const warning = this.evaluateWarning(value, cfg);
    const muted = (raw == null || raw === 'unavailable');

    const data = window.IconRenderer.renderSensor({
      value: muted ? '—' : value,
      unit, label, warning, muted, theme: cfg.theme
    });
    $UD.setBaseDataIcon(this.context, data, '');
  }

  onTap() {}
  onLongPress() {}
}

window.SensorAction = SensorAction;
