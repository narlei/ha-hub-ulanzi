// Toggle action — switch / light / input_boolean / fan / cover.
// Subscribes to entity-changed events for live updates. No polling.
// Supports optional pulse animation when state matches a configured value.
// On long-press of edit-eligible entities (light/climate/cover/media_player/fan),
// activates Edit Mode so a Smart Dialer can adjust brightness/temp/etc.

const EDIT_DOMAINS = ['light', 'climate', 'cover', 'media_player', 'fan'];

class ToggleAction {
  constructor(ctx) {
    this.context = ctx;
    this._unsubscribe = null;
    this._editHandler = null;
  }

  static type() { return 'com.ulanzi.ulanzistudio.hahub.toggle'; }

  attach(deps) {
    this.deps = deps;
    this._unsubscribe = (e) => {
      const cfg = this.deps.settings.getKey(this.context);
      if (e.detail.entityId === cfg.entityId) this.render();
    };
    deps.cache.addEventListener('entity-changed', this._unsubscribe);
    deps.cache.addEventListener('refreshed', () => this.render());

    // Re-render when edit mode activates/deactivates (for cyan pulse)
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
      entityId: (param?.entityId || '').trim(),
      label:    (param?.label    || '').trim(),
      theme:    param?.theme || 'default',
      onText:   (param?.onText  || '').trim(),
      offText:  (param?.offText || '').trim(),
      longPressEntityId: (param?.longPressEntityId || '').trim(),
      pulseOn:  (param?.pulseOn  || '').trim(),
      pulseSpeed: param?.pulseSpeed || 'normal',
      pulseColor: (param?.pulseColor || '').trim()
    });
    this.render();
  }

  shouldPulse() {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.pulseOn) return false;
    const ent = this.deps.cache.get(cfg.entityId);
    if (!ent) return false;
    return ent.state === cfg.pulseOn;
  }

  isBeingEdited() {
    const cfg = this.deps.settings.getKey(this.context);
    return cfg.entityId && this.deps.editMode.isEditing(cfg.entityId);
  }

  isEditEligible() {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.entityId) return false;
    return EDIT_DOMAINS.includes(cfg.entityId.split('.')[0]);
  }

  render() {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.entityId) {
      const data = window.IconRenderer.renderState({ state: null, label: '?', theme: cfg.theme });
      $UD.setBaseDataIcon(this.context, data, '');
      return;
    }
    const ent = this.deps.cache.get(cfg.entityId);
    const state = ent?.state ?? null;
    const label = (cfg.label || ent?.attributes?.friendly_name || cfg.entityId.split('.').pop() || '').toUpperCase();

    // If in edit mode for this entity: cyan pulse + show live value as sublabel
    if (this.isBeingEdited()) {
      const editLabel = this.editValueLabel(ent);
      if (!this.deps.pulse.isPulsing(this.context)) {
        this.deps.pulse.start(this.context, 'normal', (intensity) => {
          // Override theme to cyan during edit
          const data = window.IconRenderer.renderState({
            state: 'editing', label, sublabel: editLabel,
            theme: cfg.theme, intensity,
            onText: '✏ EDIT'
          });
          // Force cyan via custom render — use renderSensor with edit color
          this._renderEdit(label, editLabel, intensity);
        });
      }
      this._renderEdit(label, editLabel, 0.5);
      return;
    }

    if (this.shouldPulse()) {
      if (!this.deps.pulse.isPulsing(this.context)) {
        this.deps.pulse.start(this.context, cfg.pulseSpeed, (intensity) => {
          const data = window.IconRenderer.renderState({
            state, label, theme: cfg.theme, intensity,
            pulseColor: cfg.pulseColor || undefined,
            onText: cfg.onText || undefined,
            offText: cfg.offText || undefined
          });
          $UD.setBaseDataIcon(this.context, data, '');
        });
      }
      const data = window.IconRenderer.renderState({
        state, label, theme: cfg.theme, intensity: 0.5,
        pulseColor: cfg.pulseColor || undefined,
        onText: cfg.onText || undefined,
        offText: cfg.offText || undefined
      });
      $UD.setBaseDataIcon(this.context, data, '');
    } else {
      this.deps.pulse.stop(this.context);
      const data = window.IconRenderer.renderState({
        state, label, theme: cfg.theme,
        onText: cfg.onText || undefined,
        offText: cfg.offText || undefined
      });
      $UD.setBaseDataIcon(this.context, data, '');
    }
  }

  // Custom render path during edit mode — cyan background with live value
  _renderEdit(label, editLabel, intensity) {
    const data = window.IconRenderer.renderEditMode({
      label, value: editLabel, intensity
    });
    $UD.setBaseDataIcon(this.context, data, '');
  }

  // Build a "23°" or "67%" label for the entity being edited
  editValueLabel(ent) {
    const active = this.deps.editMode.active;
    if (!active) return '';

    // Optimistic value takes priority during active dialing
    const optimistic = this.deps.editMode.getOptimistic();
    if (optimistic != null) {
      const unit = (active.type === 'temperature') ? '°' : '%';
      return optimistic + unit;
    }

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
      default:
        return '';
    }
  }

  async onTap() {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.entityId) {
      $UD.toast('HA Toggle: no entity configured');
      $UD.showAlert(this.context);
      return;
    }
    // If currently in edit mode for this entity, tap = exit edit mode
    if (this.isBeingEdited()) {
      this.deps.editMode.deactivate();
      return;
    }
    const domain = cfg.entityId.split('.')[0];
    await this.deps.client.callService(domain, 'toggle', null, { entity_id: cfg.entityId });
  }

  async onLongPress() {
    const cfg = this.deps.settings.getKey(this.context);

    // Edit-eligible entity: activate Edit Mode for Smart Dialers
    if (this.isEditEligible()) {
      this.deps.editMode.activate(cfg.entityId, this.context);
      return;
    }

    // Otherwise: long-press secondary entity (existing behaviour)
    if (!cfg.longPressEntityId) {
      this.onTap();
      return;
    }
    const domain = cfg.longPressEntityId.split('.')[0];
    await this.deps.client.callService(domain, 'toggle', null, { entity_id: cfg.longPressEntityId });
  }
}

window.ToggleAction = ToggleAction;
