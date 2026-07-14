// Smart Dialer — encoder that adjusts whatever entity is in edit mode.
// When no edit mode active, shows "EDIT —" placeholder.
// When activated by long-press elsewhere, takes over and shows live value.

class SmartDialerAction {
  constructor(ctx) {
    this.context = ctx;
    this._activatedHandler = null;
    this._deactivatedHandler = null;
    this._cacheHandler = null;
  }

  static type() { return 'com.ulanzi.ulanzistudio.hahub.smartdialer'; }

  attach(deps) {
    this.deps = deps;

    this._activatedHandler = () => this.render();
    this._deactivatedHandler = () => this.render();
    this._valueChangedHandler = () => this.render();
    this._cacheHandler = (e) => {
      const active = this.deps.editMode.active;
      if (active && e.detail.entityId === active.entityId) this.render();
    };

    deps.editMode.addEventListener('edit-activated', this._activatedHandler);
    deps.editMode.addEventListener('edit-deactivated', this._deactivatedHandler);
    deps.editMode.addEventListener('edit-value-changed', this._valueChangedHandler);
    deps.cache.addEventListener('entity-changed', this._cacheHandler);
    deps.cache.addEventListener('refreshed', () => this.render());
  }

  detach() {
    if (this._activatedHandler) {
      this.deps.editMode.removeEventListener('edit-activated', this._activatedHandler);
      this.deps.editMode.removeEventListener('edit-deactivated', this._deactivatedHandler);
      this.deps.editMode.removeEventListener('edit-value-changed', this._valueChangedHandler);
      this.deps.cache.removeEventListener('entity-changed', this._cacheHandler);
    }
  }

  configure(param) {
    this.deps.settings.setKey(this.context, {
      step: parseInt(param?.step) || 10,
      idleLabel: (param?.idleLabel || 'EDIT').trim(),
      theme: param?.theme || 'cool'
    });
    this.render();
  }

  // Read the current numeric value of the entity in edit mode.
  // Returns null only if entity doesn't exist; returns 0 for off-state lights/media.
  currentValue() {
    const active = this.deps.editMode.active;
    if (!active) return null;

    // Optimistic value takes priority — set when user just rotated and
    // we're waiting for HA to confirm. Prevents flicker.
    const optimistic = this.deps.editMode.getOptimistic();
    if (optimistic != null) return optimistic;

    const ent = this.deps.cache.get(active.entityId);
    if (!ent) return null;

    const isOff = ent.state === 'off' || ent.state === 'unavailable' ||
                  ent.state === 'idle' || ent.state === 'paused' ||
                  ent.state === 'standby';

    switch (active.type) {
      case 'brightness': {
        if (isOff) return 0;
        const b = ent.attributes?.brightness;
        return b != null ? Math.round((b / 255) * 100) : 0;
      }
      case 'volume': {
        const v = ent.attributes?.volume_level;
        return v != null ? Math.round(v * 100) : 0;
      }
      case 'temperature':
        // Climate target temperature — use current setpoint or current temp
        return ent.attributes?.temperature ??
               ent.attributes?.current_temperature ?? 20;
      case 'position':
        return ent.attributes?.current_position ?? 0;
      case 'percentage':
        return ent.attributes?.percentage ?? 0;
      default:
        return null;
    }
  }

  isEntityOn() {
    const active = this.deps.editMode.active;
    if (!active) return false;
    const ent = this.deps.cache.get(active.entityId);
    if (!ent) return false;
    const offStates = ['off', 'unavailable', 'unknown', 'idle', 'paused', 'standby'];
    return !offStates.includes(ent.state);
  }

  render() {
    const cfg = this.deps.settings.getKey(this.context);
    const active = this.deps.editMode.active;

    if (!active) {
      // Idle state — show placeholder
      const data = window.IconRenderer.renderSensor({
        value: '—', unit: '', label: cfg.idleLabel,
        muted: true, theme: cfg.theme
      });
      $UD.setBaseDataIcon(this.context, data, '');
      return;
    }

    // Edit mode active — show entity name + current value
    const ent = this.deps.cache.get(active.entityId);
    const v = this.currentValue();
    const label = (ent?.attributes?.friendly_name || active.entityId.split('.').pop() || '').slice(0, 12).toUpperCase();
    const unit = this.unitFor(active.type);

    const data = window.IconRenderer.renderSensor({
      value: v != null ? Math.round(v) : '—',
      unit, label, theme: cfg.theme
    });
    $UD.setBaseDataIcon(this.context, data, '');
  }

  unitFor(type) {
    switch (type) {
      case 'brightness': case 'volume': case 'position': case 'percentage': return '%';
      case 'temperature': return '°';
      default: return '';
    }
  }

  async adjust(direction) {
    const active = this.deps.editMode.active;
    if (!active) return;
    const cfg = this.deps.settings.getKey(this.context);
    const cur = this.currentValue();
    if (cur == null) {
      console.warn('[HA Hub] Smart Dialer: no current value for', active.entityId);
      return;
    }

    // Refresh edit mode timeout — user is actively interacting
    this.deps.editMode.refresh();

    let target = cur + direction * cfg.step;
    // Clamp by edit type
    const limits = {
      brightness: [0, 100], volume: [0, 100],
      position: [0, 100], percentage: [0, 100],
      temperature: [10, 35]
    };
    const [lo, hi] = limits[active.type] || [0, 100];
    target = Math.max(lo, Math.min(hi, target));

    // Optimistic update: tell EditModeManager the new value immediately so
    // source-key and dialer can render it without waiting for HA's
    // state-changed echo (which may take 200-500ms).
    this.deps.editMode.setOptimistic(target);
    // Trigger an immediate re-render across all subscribers
    this.deps.editMode.dispatchEvent(new CustomEvent('edit-value-changed'));

    const entityId = active.entityId;
    let ok = false;

    switch (active.type) {
      case 'brightness':
        // light.turn_on with brightness_pct auto-powers-on
        if (target === 0) {
          ok = await this.deps.client.callService('light', 'turn_off', null, { entity_id: entityId });
        } else {
          ok = await this.deps.client.callService('light', 'turn_on',
            { brightness_pct: target }, { entity_id: entityId });
        }
        break;

      case 'volume':
        ok = await this.deps.client.callService('media_player', 'volume_set',
          { volume_level: target / 100 }, { entity_id: entityId });
        break;

      case 'temperature': {
        // Climate: if entity is off, first set HVAC mode to enable temperature control.
        if (!this.isEntityOn()) {
          const ent = this.deps.cache.get(entityId);
          // Pick the first available non-off mode
          const modes = ent?.attributes?.hvac_modes || [];
          const preferredMode = modes.find(m => m !== 'off') || 'auto';
          await this.deps.client.callService('climate', 'set_hvac_mode',
            { hvac_mode: preferredMode }, { entity_id: entityId });
          // Brief delay so HA updates state before set_temperature
          await new Promise(r => setTimeout(r, 200));
        }
        ok = await this.deps.client.callService('climate', 'set_temperature',
          { temperature: target }, { entity_id: entityId });
        break;
      }

      case 'position':
        ok = await this.deps.client.callService('cover', 'set_cover_position',
          { position: target }, { entity_id: entityId });
        break;

      case 'percentage':
        // Fan: if off, turn_on with percentage
        if (!this.isEntityOn() && target > 0) {
          ok = await this.deps.client.callService('fan', 'turn_on',
            { percentage: target }, { entity_id: entityId });
        } else if (target === 0) {
          ok = await this.deps.client.callService('fan', 'turn_off', null, { entity_id: entityId });
        } else {
          ok = await this.deps.client.callService('fan', 'set_percentage',
            { percentage: target }, { entity_id: entityId });
        }
        break;
    }

    if (!ok) {
      console.warn('[HA Hub] Smart Dialer: service call failed for', entityId, active.type);
    }
  }

  async onDialDown() {
    const active = this.deps.editMode.active;
    if (!active) return;
    this.deps.editMode.refresh();
    // Press = toggle in edit context
    const domain = active.entityId.split('.')[0];
    if (['light', 'media_player', 'fan', 'switch'].includes(domain)) {
      await this.deps.client.callService(domain, 'toggle', null, { entity_id: active.entityId });
    } else if (domain === 'cover') {
      await this.deps.client.callService('cover', 'stop_cover', null, { entity_id: active.entityId });
    }
  }

  onDialRotateLeft()  { this.adjust(-1); }
  onDialRotateRight() { this.adjust(+1); }
}

window.SmartDialerAction = SmartDialerAction;
