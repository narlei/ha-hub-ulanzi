// Aggregate action — watches a list of entities, shows "active count / total"
// on the key. Pulses when count > 0. Perfect as a folder-key on the home page
// pointing to a sub-page with the individual entities.

class AggregateAction {
  constructor(ctx) {
    this.context = ctx;
    this._unsubscribe = null;
  }

  static type() { return 'com.ulanzi.ulanzistudio.hahub.aggregate'; }

  attach(deps) {
    this.deps = deps;
    this._unsubscribe = (e) => {
      const cfg = this.deps.settings.getKey(this.context);
      const ids = this.parseEntityIds(cfg.entityIds);
      if (ids.includes(e.detail.entityId)) this.render();
    };
    deps.cache.addEventListener('entity-changed', this._unsubscribe);
    deps.cache.addEventListener('refreshed', () => this.render());
  }

  detach() {
    if (this._unsubscribe) {
      this.deps.cache.removeEventListener('entity-changed', this._unsubscribe);
    }
    this.deps.pulse.stop(this.context);
  }

  configure(param) {
    this.deps.settings.setKey(this.context, {
      entityIds:  (param?.entityIds || '').trim(),
      activeState:(param?.activeState || 'on').trim(),
      label:      (param?.label || 'DEVICES').trim(),
      theme:       param?.theme || 'warm',
      pulseColor: (param?.pulseColor || param?.activeColor || '').trim(),  // hex; falls back to theme.error.bg
      pulseSpeed:  param?.pulseSpeed || 'normal'
    });
    this.render();
  }

  parseEntityIds(raw) {
    if (!raw) return [];
    return raw.split(/[,\s\n]+/).map(s => s.trim()).filter(Boolean);
  }

  computeCount() {
    const cfg = this.deps.settings.getKey(this.context);
    const ids = this.parseEntityIds(cfg.entityIds);
    let active = 0;
    for (const id of ids) {
      const ent = this.deps.cache.get(id);
      if (ent && ent.state === cfg.activeState) active++;
    }
    return { active, total: ids.length };
  }

  render() {
    const cfg = this.deps.settings.getKey(this.context);
    const { active, total } = this.computeCount();

    if (total === 0) {
      // Not configured yet — show neutral
      const data = window.IconRenderer.renderAggregate({
        count: 0, total: 0, label: cfg.label || '?', theme: cfg.theme
      });
      $UD.setBaseDataIcon(this.context, data, '');
      return;
    }

    const baseOpts = {
      count: active,
      total,
      label: cfg.label,
      theme: cfg.theme,
      activeColor: cfg.pulseColor || null
    };

    if (active > 0) {
      if (!this.deps.pulse.isPulsing(this.context)) {
        this.deps.pulse.start(this.context, cfg.pulseSpeed, (intensity) => {
          const data = window.IconRenderer.renderAggregate({ ...baseOpts, intensity });
          $UD.setBaseDataIcon(this.context, data, '');
        });
      }
      const data = window.IconRenderer.renderAggregate({ ...baseOpts, intensity: 0.5 });
      $UD.setBaseDataIcon(this.context, data, '');
    } else {
      this.deps.pulse.stop(this.context);
      const data = window.IconRenderer.renderAggregate({ ...baseOpts, intensity: 0 });
      $UD.setBaseDataIcon(this.context, data, '');
    }
  }

  // Tap doesn't navigate (SDK doesn't allow that). It's purely informational —
  // user navigates via Ulanzi's built-in Folder mechanism. But we accept tap to
  // optionally fire a service call (e.g. "snooze all alerts") later.
  onTap() {
    // For now: just re-render to acknowledge the tap visually
    this.render();
  }
  onLongPress() {}
}

window.AggregateAction = AggregateAction;
