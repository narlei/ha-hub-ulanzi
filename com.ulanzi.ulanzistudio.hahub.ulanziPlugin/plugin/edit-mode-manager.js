// EditModeManager — coordinates "edit mode" between source key (long-pressed)
// and Smart Dialer encoders.
//
// Flow:
//   1. User long-presses a light/climate/cover/media_player/fan toggle.
//   2. Source key calls EditModeManager.activate(entityId, sourceContext).
//   3. EditModeManager dispatches 'edit-activated' event with the entity info.
//   4. All Smart Dialer encoders listen and switch to controlling this entity.
//   5. Source key listens too, pulses cyan, shows live value.
//   6. After 5s of no encoder activity, OR tap on source key, deactivate.

class EditModeManager extends EventTarget {
  constructor() {
    super();
    this.active = null;        // { entityId, sourceContext, type } or null
    this.timeoutMs = 15000;    // 15s — long enough to think + adjust
    this._timeout = null;
    this._optimisticValue = null;
    this._optimisticUntil = 0;
  }

  // Set an optimistic value to display until HA confirms via state-changed.
  // Smart Dialer calls this immediately after a service call so the source key
  // doesn't flicker between old value and "—" while waiting for HA confirmation.
  setOptimistic(value) {
    this._optimisticValue = value;
    this._optimisticUntil = Date.now() + 1500;  // hold for max 1.5s
  }

  getOptimistic() {
    if (this._optimisticValue == null) return null;
    if (Date.now() > this._optimisticUntil) {
      this._optimisticValue = null;
      return null;
    }
    return this._optimisticValue;
  }

  clearOptimistic() {
    this._optimisticValue = null;
    this._optimisticUntil = 0;
  }

  activate(entityId, sourceContext) {
    if (!entityId) return;
    const type = this.deriveType(entityId);
    if (!type) return;

    // If already editing same entity, just refresh timeout
    if (this.active && this.active.entityId === entityId) {
      this.refresh();
      return;
    }

    // If editing a different entity, deactivate first to clean up
    if (this.active) this.deactivate();

    this.active = { entityId, sourceContext, type };
    this.dispatchEvent(new CustomEvent('edit-activated', { detail: this.active }));
    this.refresh();
  }

  deactivate() {
    if (!this.active) return;
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    this.clearOptimistic();
    const wasActive = this.active;
    this.active = null;
    this.dispatchEvent(new CustomEvent('edit-deactivated', { detail: wasActive }));
  }

  // Bump timeout — called whenever encoder is rotated or pressed
  refresh() {
    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = setTimeout(() => this.deactivate(), this.timeoutMs);
  }

  isActive() {
    return this.active !== null;
  }

  isEditing(entityId) {
    return this.active && this.active.entityId === entityId;
  }

  // Map entity domain to edit type
  deriveType(entityId) {
    const domain = entityId.split('.')[0];
    switch (domain) {
      case 'light':         return 'brightness';
      case 'climate':       return 'temperature';
      case 'cover':         return 'position';
      case 'media_player':  return 'volume';
      case 'fan':           return 'percentage';
      default:              return null;
    }
  }
}

window.EditModeManager = EditModeManager;
