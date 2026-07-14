// Smart Toggle — display state from one entity, toggle a different entity.
// Use case: see if washing machine is running (binary_sensor),
// tap toggles the forced-override (input_boolean).
// Long-press on an edit-eligible display entity activates Edit Mode.

const SMART_EDIT_DOMAINS = ['light', 'climate', 'cover', 'media_player', 'fan'];

class SmartToggleAction {
  constructor(ctx) {
    this.context = ctx;
    this._unsubscribe = null;
    this._editHandler = null;
  }

  static type() { return 'com.ulanzi.ulanzistudio.hahub.smarttoggle'; }

  attach(deps) {
    this.deps = deps;
    this._unsubscribe = (e) => {
      const cfg = this.deps.settings.getKey(this.context);
      if (e.detail.entityId === cfg.displayEntityId || e.detail.entityId === cfg.actionEntityId) {
        this.render();
      }
    };
    deps.cache.addEventListener('entity-changed', this._unsubscribe);
    deps.cache.addEventListener('refreshed', () => this.render());

    this._editHandler = () => this.render();
    deps.editMode.addEventListener('edit-activated', this._editHandler);
    deps.editMode.addEventListener('edit-deactivated', this._editHandler);
    deps.editMode.addEventListener('edit-value-changed', this._editHandler);
  }

  detach() {
    if (this._unsubscribe) {
      this.deps.cache.removeEventListener('entity-changed', this._unsubscribe);
    }
    if (this._editHandler) {
      this.deps.editMode.removeEventListener('edit-activated', this._editHandler);
      this.deps.editMode.removeEventListener('edit-deactivated', this._editHandler);
      this.deps.editMode.removeEventListener('edit-value-changed', this._editHandler);
    }
    this.deps.pulse.stop(this.context);
  }

  configure(param) {
    this.deps.settings.setKey(this.context, {
      displayEntityId: (param?.displayEntityId || '').trim(),
      actionEntityId:  (param?.actionEntityId  || '').trim(),
      label:           (param?.label           || '').trim(),
      theme:            param?.theme || 'default',
      onText:          (param?.onText          || 'RUNNING').trim(),
      offText:         (param?.offText         || 'IDLE').trim(),
      pulseOn:         (param?.pulseOn         || 'on').trim(),
      pulseSpeed:       param?.pulseSpeed || 'normal',
      pulseColor:      (param?.pulseColor      || '').trim(),
      showForcedBadge: param?.showForcedBadge === true || param?.showForcedBadge === 'true' || param?.showForcedBadge === 'on'
    });
    this.render();
  }

  shouldPulse() {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.pulseOn || !cfg.displayEntityId) return false;
    const ent = this.deps.cache.get(cfg.displayEntityId);
    if (!ent) return false;
    return ent.state === cfg.pulseOn;
  }

  isBeingEdited() {
    const cfg = this.deps.settings.getKey(this.context);
    return cfg.displayEntityId && this.deps.editMode.isEditing(cfg.displayEntityId);
  }

  isEditEligible() {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.displayEntityId) return false;
    return SMART_EDIT_DOMAINS.includes(cfg.displayEntityId.split('.')[0]);
  }

  editValueLabel() {
    const active = this.deps.editMode.active;
    if (!active) return '';

    // Optimistic value first to prevent flicker during dialing
    const optimistic = this.deps.editMode.getOptimistic();
    if (optimistic != null) {
      const unit = (active.type === 'temperature') ? '°' : '%';
      return optimistic + unit;
    }

    const cfg = this.deps.settings.getKey(this.context);
    const ent = this.deps.cache.get(cfg.displayEntityId);
    if (!ent) return '';

    switch (active.type) {
      case 'brightness': {
        const b = ent.attributes?.brightness;
        if (ent.state === 'off') return '0%';
        return b != null ? Math.round((b / 255) * 100) + '%' : '—';
      }
      case 'volume': {
        const v = ent.attributes?.volume_level;
        return v != null ? Math.round(v * 100) + '%' : '—';
      }
      case 'temperature':
        return (ent.attributes?.temperature ?? '—') + '°';
      case 'position':
        return (ent.attributes?.current_position ?? '—') + '%';
      case 'percentage':
        return (ent.attributes?.percentage ?? '—') + '%';
      default: return '';
    }
  }

  render() {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.displayEntityId) {
      const data = window.IconRenderer.renderState({ state: null, label: '?', theme: cfg.theme });
      $UD.setBaseDataIcon(this.context, data, '');
      return;
    }
    const ent = this.deps.cache.get(cfg.displayEntityId);
    const state = ent?.state ?? null;
    const label = (cfg.label || ent?.attributes?.friendly_name || cfg.displayEntityId.split('.').pop() || '').toUpperCase();

    if (this.isBeingEdited()) {
      const editLabel = this.editValueLabel();
      if (!this.deps.pulse.isPulsing(this.context)) {
        this.deps.pulse.start(this.context, 'normal', (intensity) => {
          const data = window.IconRenderer.renderEditMode({ label, value: editLabel, intensity });
          $UD.setBaseDataIcon(this.context, data, '');
        });
      }
      const data = window.IconRenderer.renderEditMode({ label, value: editLabel, intensity: 0.5 });
      $UD.setBaseDataIcon(this.context, data, '');
      return;
    }

    let sublabel = '';
    if (cfg.showForcedBadge && cfg.actionEntityId) {
      const actionEnt = this.deps.cache.get(cfg.actionEntityId);
      if (actionEnt?.state === 'on') sublabel = '⚡ FORCED';
    }

    const baseOpts = {
      state, label, sublabel, theme: cfg.theme,
      onText: cfg.onText, offText: cfg.offText,
      pulseColor: cfg.pulseColor || undefined
    };

    if (this.shouldPulse()) {
      if (!this.deps.pulse.isPulsing(this.context)) {
        this.deps.pulse.start(this.context, cfg.pulseSpeed, (intensity) => {
          const data = window.IconRenderer.renderState({ ...baseOpts, intensity });
          $UD.setBaseDataIcon(this.context, data, '');
        });
      }
      const data = window.IconRenderer.renderState({ ...baseOpts, intensity: 0.5 });
      $UD.setBaseDataIcon(this.context, data, '');
    } else {
      this.deps.pulse.stop(this.context);
      const data = window.IconRenderer.renderState(baseOpts);
      $UD.setBaseDataIcon(this.context, data, '');
    }
  }

  async onTap() {
    if (this.isBeingEdited()) {
      this.deps.editMode.deactivate();
      return;
    }
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.actionEntityId) {
      $UD.toast('Smart Toggle: no action entity set');
      return;
    }
    const domain = cfg.actionEntityId.split('.')[0];
    await this.deps.client.callService(domain, 'toggle', null, { entity_id: cfg.actionEntityId });
  }

  onLongPress() {
    if (this.isEditEligible()) {
      const cfg = this.deps.settings.getKey(this.context);
      this.deps.editMode.activate(cfg.displayEntityId, this.context);
      return;
    }
    this.onTap();
  }
}

window.SmartToggleAction = SmartToggleAction;
