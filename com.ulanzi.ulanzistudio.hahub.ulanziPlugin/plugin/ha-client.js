// HA Client — WebSocket for live state, REST as fallback for service calls.
// Single instance shared across all actions in the main service.

class HAClient extends EventTarget {
  constructor() {
    super();
    this.url = '';
    this.token = '';
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.connected = false;
    this.authed = false;
    this.reconnectTimer = null;
    this.reconnectDelay = 1000;
  }

  configure(url, token) {
    const changed = url !== this.url || token !== this.token;
    this.url = (url || '').trim().replace(/\/+$/, '');
    this.token = (token || '').trim();
    if (changed) this.reconnect();
  }

  wsUrl() {
    if (!this.url) return '';
    return this.url.replace(/^http/, 'ws') + '/api/websocket';
  }

  async reconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.url || !this.token) return;
    this.connect();
  }

  connect() {
    const url = this.wsUrl();
    if (!url) return;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => { this.connected = true; };
    this.ws.onclose = () => {
      this.connected = false;
      this.authed = false;
      this.dispatchEvent(new Event('disconnected'));
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      this.dispatchEvent(new CustomEvent('error', { detail: 'ws error' }));
    };
    this.ws.onmessage = (ev) => this.handleMessage(ev.data);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect();
    }, this.reconnectDelay);
  }

  handleMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'auth_required') {
      this.send({ type: 'auth', access_token: this.token });
      return;
    }
    if (msg.type === 'auth_ok') {
      this.authed = true;
      this.reconnectDelay = 1000;
      this.dispatchEvent(new Event('connected'));
      this.fetchAllStates();
      this.subscribeStateChanges();
      return;
    }
    if (msg.type === 'auth_invalid') {
      this.dispatchEvent(new CustomEvent('error', { detail: 'auth invalid' }));
      try { this.ws.close(); } catch (e) {}
      return;
    }
    if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
      this.dispatchEvent(new CustomEvent('state-changed', { detail: msg.event.data }));
      return;
    }
    if (msg.type === 'result' && msg.id != null) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if (msg.success) pending.resolve(msg.result);
        else pending.reject(new Error(msg.error?.message || 'ws error'));
      }
    }
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify(obj));
  }

  request(payload) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('timeout'));
        }
      }, 10000);
      this.send({ id, ...payload });
    });
  }

  async fetchAllStates() {
    try {
      const states = await this.request({ type: 'get_states' });
      this.dispatchEvent(new CustomEvent('all-states', { detail: states }));
    } catch (e) {
      this.dispatchEvent(new CustomEvent('error', { detail: e.message }));
    }
  }

  subscribeStateChanges() {
    this.send({ id: this.msgId++, type: 'subscribe_events', event_type: 'state_changed' });
  }

  async callService(domain, service, data, target) {
    const logPayload = JSON.stringify({ domain, service, data, target });
    if (this.authed) {
      try {
        const msg = { type: 'call_service', domain, service, service_data: data || {} };
        if (target && typeof target === 'object') {
          msg.target = target;
        }
        const result = await this.request(msg);
        return true;
      } catch (e) {
        console.warn('[HA Hub] callService WS failed:', logPayload, '→', e.message);
        return false;
      }
    }
    // REST fallback
    try {
      const r = await fetch(`${this.url}/api/services/${domain}/${service}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...(data || {}), ...(target || {}) })
      });
      return r.ok;
    } catch (e) {
      return false;
    }
  }

  async getState(entityId) {
    if (this.authed) {
      try {
        const states = await this.request({ type: 'get_states' });
        return states.find(s => s.entity_id === entityId) || null;
      } catch (e) {}
    }
    try {
      const r = await fetch(`${this.url}/api/states/${entityId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      return r.ok ? await r.json() : null;
    } catch (e) {
      return null;
    }
  }
}

window.HAClient = HAClient;
