// Scene action — triggers a scene.turn_on or script.run.

class SceneAction {
  constructor(ctx) {
    this.context = ctx;
  }

  static type() { return 'com.ulanzi.ulanzistudio.hahub.scene'; }

  attach(deps) { this.deps = deps; }
  detach() {}

  configure(param) {
    this.deps.settings.setKey(this.context, {
      entityId: (param?.entityId || '').trim(),
      label: (param?.label || '').trim(),
      color: param?.color || '',
      theme: param?.theme || 'default'
    });
    this.render();
  }

  render() {
    const cfg = this.deps.settings.getKey(this.context);
    const label = (cfg.label || cfg.entityId?.split('.').pop() || 'SCENE').toUpperCase();
    const data = window.IconRenderer.renderTrigger({
      label, theme: cfg.theme, color: cfg.color || null
    });
    $UD.setBaseDataIcon(this.context, data, '');
  }

  async onTap() {
    const cfg = this.deps.settings.getKey(this.context);
    if (!cfg.entityId) {
      $UD.toast('Scene: no entity configured');
      $UD.showAlert(this.context);
      return;
    }
    const [domain] = cfg.entityId.split('.');
    if (domain === 'scene') {
      await this.deps.client.callService('scene', 'turn_on', null, { entity_id: cfg.entityId });
    } else if (domain === 'script') {
      const scriptName = cfg.entityId.split('.')[1];
      await this.deps.client.callService('script', scriptName, null, null);
    } else if (domain === 'automation') {
      await this.deps.client.callService('automation', 'trigger', null, { entity_id: cfg.entityId });
    } else {
      $UD.toast(`Scene: unknown domain ${domain}`);
    }
    // Brief flash for feedback
    this.flash();
  }

  onLongPress() { this.onTap(); }

  flash() {
    const cfg = this.deps.settings.getKey(this.context);
    const label = (cfg.label || cfg.entityId?.split('.').pop() || 'SCENE').toUpperCase();
    const flashData = window.IconRenderer.renderTrigger({
      label: '✓ ' + label, theme: cfg.theme, color: '#22c55e'
    });
    $UD.setBaseDataIcon(this.context, flashData, '');
    setTimeout(() => this.render(), 800);
  }
}

window.SceneAction = SceneAction;
