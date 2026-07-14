// Service call action — invoke any HA service with JSON-defined data.
// Power-user mode: the user types domain, service, and a JSON data blob.

class ServiceAction {
  constructor(ctx) { this.context = ctx; }
  static type() { return 'com.ulanzi.ulanzistudio.hahub.service'; }

  attach(deps) { this.deps = deps; }
  detach() {}

  configure(param) {
    this.deps.settings.setKey(this.context, {
      domain: (param?.domain || '').trim(),
      service: (param?.service || '').trim(),
      dataJson: (param?.dataJson || '{}').trim(),
      label: (param?.label || '').trim(),
      color: param?.color || '#0ea5e9',
      theme: param?.theme || 'cool'
    });
    this.render();
  }

  render() {
    const cfg = this.deps.settings.getKey(this.context);
    const label = (cfg.label || cfg.service || 'SERVICE').toUpperCase();
    const data = window.IconRenderer.renderTrigger({
      label, theme: cfg.theme, color: cfg.color || null
    });
    $UD.setBaseDataIcon(this.context, data, '');
  }

  async onTap() {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.domain || !cfg.service) {
      $UD.toast('Service: domain and service required');
      $UD.showAlert(this.context);
      return;
    }
    let payload = {};
    try {
      payload = cfg.dataJson ? JSON.parse(cfg.dataJson) : {};
    } catch (e) {
      $UD.toast('Service: invalid JSON');
      $UD.showAlert(this.context);
      return;
    }
    const ok = await this.deps.client.callService(cfg.domain, cfg.service, payload, null);
    if (ok) this.flash();
    else $UD.showAlert(this.context);
  }

  onLongPress() { this.onTap(); }

  flash() {
    const cfg = this.deps.settings.getKey(this.context);
    const label = (cfg.label || cfg.service || 'SERVICE').toUpperCase();
    const flashData = window.IconRenderer.renderTrigger({
      label: '✓ ' + label, theme: cfg.theme, color: '#22c55e'
    });
    $UD.setBaseDataIcon(this.context, flashData, '');
    setTimeout(() => this.render(), 800);
  }
}

window.ServiceAction = ServiceAction;
