// Shared Property Inspector helpers — entity picker, global connection panel, theme picker.
// Loaded by every action's PI HTML.

(function () {
  const PI = window.HAHubPI = window.HAHubPI || {};

  // ─── Connection fields (inline in form) ──────────────────────
  PI.renderConnectionFields = function (container) {
    if (!container) {
      console.error('[HA Hub PI] renderConnectionFields: container is null/undefined');
      return;
    }
    try {
    container.innerHTML = `
      <div class="hahub-section-title">Home Assistant</div>
      <div class="uspi-item">
        <div class="uspi-item-label">HA URL</div>
        <input type="text" class="uspi-item-value" name="haUrl" placeholder="http://192.168.1.X:8123" autocomplete="off">
      </div>
      <div class="uspi-item">
        <div class="uspi-item-label">Long-lived token</div>
        <input type="password" class="uspi-item-value" name="token" autocomplete="off">
      </div>
      <div class="hahub-conn-test">
        <button type="button" class="hahub-btn" id="hahub-test-btn">Test connection</button>
        <div class="hahub-conn-status" id="hahub-conn-status">Not tested</div>
      </div>
      <div class="hahub-reveal-section">
        <div class="hahub-reveal-master">
          <input type="checkbox" id="hahub-master-reveal" name="revealEnabled" checked>
          <label for="hahub-master-reveal">HA logo reveal animation on page switch</label>
        </div>
        <div class="hahub-reveal-modes" id="hahub-reveal-modes">
          <div class="hahub-mode-option" data-mode="per-tile">
            <span class="hahub-mode-marker">●</span>
            <input type="radio" name="revealMode" value="per-tile" checked style="display:none">
            <div class="hahub-mode-text">
              <div class="hahub-mode-title">Per-tile flip</div>
              <div class="hahub-mode-desc">Each tile shows its own HA logo</div>
            </div>
          </div>
          <div class="hahub-mode-option" data-mode="puzzle">
            <span class="hahub-mode-marker">○</span>
            <input type="radio" name="revealMode" value="puzzle" style="display:none">
            <div class="hahub-mode-text">
              <div class="hahub-mode-title">🧪 Puzzle reveal</div>
              <div class="hahub-mode-desc">All tiles form one giant logo</div>
            </div>
          </div>
        </div>
      </div>`;

    const btn    = container.querySelector('#hahub-test-btn');
    const status = container.querySelector('#hahub-conn-status');
    const urlIn  = container.querySelector('input[name="haUrl"]');
    const tokIn  = container.querySelector('input[name="token"]');

    function setStatus(state, text) {
      status.className = 'hahub-conn-status hahub-status-' + state;
      status.textContent = text;
    }

    // Mode option: click whole row to select; visible marker updates
    const modeOptions = container.querySelectorAll('.hahub-mode-option');
    function refreshModeSelection() {
      modeOptions.forEach(opt => {
        const radio = opt.querySelector('input[type="radio"]');
        const marker = opt.querySelector('.hahub-mode-marker');
        if (radio?.checked) {
          opt.classList.add('hahub-mode-selected');
          if (marker) marker.textContent = '●';
        } else {
          opt.classList.remove('hahub-mode-selected');
          if (marker) marker.textContent = '○';
        }
      });
    }
    modeOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        const radio = opt.querySelector('input[type="radio"]');
        if (!radio) return;
        // Uncheck siblings
        modeOptions.forEach(o => {
          const r = o.querySelector('input[type="radio"]');
          if (r) r.checked = false;
        });
        radio.checked = true;
        refreshModeSelection();
        // Manually trigger change event so form-change handler fires
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    refreshModeSelection();

    btn.addEventListener('click', async () => {
      const url = (urlIn.value || '').trim().replace(/\/+$/, '');
      const tok = (tokIn.value || '').trim();
      if (!url || !tok) {
        setStatus('error', '✖ URL or token empty');
        return;
      }
      setStatus('pending', '⏳ Working...');
      btn.disabled = true;
      try {
        const result = await testHAConnection(url, tok);
        if (result.ok) {
          setStatus('ok', `✓ Connected — ${result.count} entities`);
        } else {
          setStatus('error', '✖ ' + result.error);
        }
      } catch (e) {
        setStatus('error', '✖ ' + (e.message || 'Unknown error'));
      } finally {
        btn.disabled = false;
      }
    });
    } catch (e) {
      console.error('[HA Hub PI] renderConnectionFields error:', e.message, e.stack);
    }
  };

  // ─── Direct HA test from PI (no main service roundtrip) ──────
  function testHAConnection(url, token) {
    return new Promise((resolve) => {
      // Step 1 — verify REST auth + reachability
      const t = setTimeout(() => resolve({ ok: false, error: 'Timeout (5s)' }), 5000);
      fetch(url + '/api/', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => {
          clearTimeout(t);
          if (r.status === 401) return resolve({ ok: false, error: 'Token invalid (401)' });
          if (!r.ok) return resolve({ ok: false, error: 'HTTP ' + r.status });
          // Step 2 — count entities
          return fetch(url + '/api/states', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(rr => rr.json())
            .then(states => resolve({ ok: true, count: Array.isArray(states) ? states.length : 0 }));
        })
        .catch(err => {
          clearTimeout(t);
          resolve({ ok: false, error: 'Unreachable — ' + (err.message || 'network error') });
        });
    });
  }

  // ─── Entity picker ────────────────────────────────────────────
  PI.renderEntityPicker = function (container, opts) {
    const { domains, name, label, onPick } = opts;
    container.innerHTML = `
      <div class="uspi-item">
        <div class="uspi-item-label">${label || 'Entity'}</div>
        <input type="text" class="uspi-item-value" name="${name}" id="${name}-input" placeholder="search or type entity_id" autocomplete="off">
      </div>
      <div class="hahub-results" id="${name}-results"></div>`;

    const input = container.querySelector(`#${name}-input`);
    const results = container.querySelector(`#${name}-results`);

    let lastQuery = '';
    const search = () => {
      const q = input.value.trim();
      if (q === lastQuery) return;
      lastQuery = q;
      if (typeof $UD === 'undefined' || typeof $UD.sendToPlugin !== 'function') {
        results.innerHTML = '<div class="hahub-no-results">Plugin connection not ready — please wait.</div>';
        return;
      }
      $UD.sendToPlugin({
        __type: 'query-entities',
        domains: domains || [],
        query: q,
        replyTag: name
      });
    };

    input.addEventListener('input', search);
    input.addEventListener('focus', search);

    PI._pickerHandlers = PI._pickerHandlers || {};
    PI._pickerHandlers[name] = (list) => {
      if (!list || !list.length) {
        results.innerHTML = '<div class="hahub-no-results">No results — type entity_id directly.</div>';
        return;
      }
      results.innerHTML = list.map(e =>
        `<div class="hahub-result" data-id="${e.entity_id}">
          <div class="hahub-result-name">${e.friendly_name}</div>
          <div class="hahub-result-id">${e.entity_id} — ${e.state || ''}</div>
        </div>`).join('');
      results.querySelectorAll('.hahub-result').forEach(el => {
        el.addEventListener('click', () => {
          input.value = el.dataset.id;
          results.innerHTML = '';
          if (onPick) onPick(el.dataset.id);
        });
      });
    };
  };

  // ─── Theme dropdown ───────────────────────────────────────────
  PI.renderThemeSelect = function (container, name, defaultValue) {
    const themes = [
      ['default', 'Default'], ['warm', 'Warm'], ['cool', 'Cool'],
      ['minimal', 'Minimal'], ['trafficLight', 'Traffic light'], ['ocean', 'Ocean']
    ];
    container.innerHTML = `
      <div class="uspi-item">
        <div class="uspi-item-label">Theme</div>
        <select class="uspi-item-value" name="${name}">
          ${themes.map(([k, l]) =>
            `<option value="${k}"${k === defaultValue ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>`;
  };

  // Pulse color picker: visual color picker + hex text input, side by side.
  // Default red unless user picks something else.
  PI.renderPulseColorField = function (container, defaultHex) {
    const def = defaultHex || '#dc2626';
    container.innerHTML = `
      <div class="uspi-item">
        <div class="uspi-item-label">Pulse color</div>
        <div class="hahub-color-row">
          <input type="color" name="pulseColor" value="${def}" class="hahub-color-picker">
          <input type="text" value="${def}" class="hahub-color-hex" placeholder="#dc2626">
          <div class="hahub-color-presets">
            <button type="button" class="hahub-color-preset" data-color="#dc2626" title="Red"></button>
            <button type="button" class="hahub-color-preset" data-color="#f59e0b" title="Amber"></button>
            <button type="button" class="hahub-color-preset" data-color="#16a34a" title="Green"></button>
            <button type="button" class="hahub-color-preset" data-color="#06b6d4" title="Cyan"></button>
            <button type="button" class="hahub-color-preset" data-color="#7c3aed" title="Purple"></button>
          </div>
        </div>
      </div>`;

    const picker = container.querySelector('.hahub-color-picker');
    const hexInput = container.querySelector('.hahub-color-hex');
    const presets = container.querySelectorAll('.hahub-color-preset');

    // Sync picker → text
    picker.addEventListener('input', () => {
      hexInput.value = picker.value;
      hexInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // Sync text → picker
    hexInput.addEventListener('input', () => {
      const v = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        picker.value = v;
      }
    });
    // Preset click
    presets.forEach(btn => {
      btn.style.background = btn.dataset.color;
      btn.addEventListener('click', () => {
        picker.value = btn.dataset.color;
        hexInput.value = btn.dataset.color;
        picker.dispatchEvent(new Event('change', { bubbles: true }));
        hexInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  };

  // ─── Message routing from main service ────────────────────────
  if (typeof $UD !== 'undefined' && $UD.onSendToPropertyInspector) {
    $UD.onSendToPropertyInspector((msg) => {
      const data = msg.payload || msg.param || msg;
      if (data.__type === 'connection' && PI._connHandlers) {
        PI._connHandlers.apply(data);
      }
      if (data.__type === 'entities' && PI._pickerHandlers) {
        Object.values(PI._pickerHandlers).forEach(fn => fn(data.list));
      }
      if (data.__type === 'key-settings') {
        const formId = PI._keySettingsTarget;
        if (formId && data.settings) {
          PI.applyForm(formId, data.settings);
        }
      }
      if (data.__type === 'global') {
        const formId = PI._globalApplyTarget;
        if (formId) {
          const form = document.getElementById(formId);
          if (form) {
            PI._suppressChange = true;
            try {
              const urlEl = form.querySelector('input[name="haUrl"]');
              const tokEl = form.querySelector('input[name="token"]');
              const revealEl = form.querySelector('input[name="revealEnabled"]');
              if (urlEl && !urlEl.value && data.haUrl) urlEl.value = data.haUrl;
              if (tokEl && !tokEl.value && data.token) tokEl.value = data.token;
              if (revealEl && data.revealEnabled !== undefined) {
                revealEl.checked = !!data.revealEnabled;
              }
              // Set radio button for reveal mode
              if (data.revealMode) {
                const radio = form.querySelector(`input[name="revealMode"][value="${data.revealMode}"]`);
                if (radio) radio.checked = true;
              }
              // Refresh visual selected state on mode rows + markers
              form.querySelectorAll('.hahub-mode-option').forEach(opt => {
                const r = opt.querySelector('input[type="radio"]');
                const marker = opt.querySelector('.hahub-mode-marker');
                if (r?.checked) {
                  opt.classList.add('hahub-mode-selected');
                  if (marker) marker.textContent = '●';
                } else {
                  opt.classList.remove('hahub-mode-selected');
                  if (marker) marker.textContent = '○';
                }
              });
            } finally {
              setTimeout(() => { PI._suppressChange = false; }, 200);
            }
          }
        }
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────
  PI.serializeForm = function (formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    form.querySelectorAll('input, select, textarea').forEach(el => {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        data[el.name] = el.checked;
      } else {
        data[el.name] = el.value;
      }
    });
    return data;
  };

  // Tracks whether form changes should be sent. False during applyForm /
  // global response handling so programmatic value-sets don't echo back as
  // user-initiated config changes (which would erase un-filled fields).
  PI._suppressChange = false;

  PI.applyForm = function (formId, data) {
    if (!data) return;
    const form = document.getElementById(formId);
    if (!form) return;
    PI._suppressChange = true;
    PI._lastApplyAt = Date.now();
    try {
      Object.keys(data).forEach(k => {
        const el = form.querySelector(`[name="${k}"]`);
        if (!el) return;
        if (el.type === 'checkbox') {
          if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
            el.checked = (data[k] === true || data[k] === 'true' || data[k] === 'on');
          }
          return;
        }
        if (el.type === 'radio') {
          // For radios, find the right one in the group with matching value
          const radio = form.querySelector(`input[name="${k}"][value="${data[k]}"]`);
          if (radio) radio.checked = true;
          return;
        }
        if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
          el.value = data[k];
        }
      });
      PI.seedLastSent(formId, PI.serializeForm(formId));
      // Re-apply visual selection on mode-option rows + their markers
      form.querySelectorAll('.hahub-mode-option').forEach(opt => {
        const r = opt.querySelector('input[type="radio"]');
        const marker = opt.querySelector('.hahub-mode-marker');
        if (r?.checked) {
          opt.classList.add('hahub-mode-selected');
          if (marker) marker.textContent = '●';
        } else {
          opt.classList.remove('hahub-mode-selected');
          if (marker) marker.textContent = '○';
        }
      });
    } finally {
      // Long suppression window — covers async global response + multiple
      // change events that may fire as a chain reaction
      setTimeout(() => { PI._suppressChange = false; }, 500);
    }
  };

  // Convenience: fill URL+token from global settings if local form is empty
  PI.requestGlobalConnection = function (formId) {
    if (typeof $UD === 'undefined' || typeof $UD.sendToPlugin !== 'function') return;
    $UD.sendToPlugin({ __type: 'get-global' });
    PI._globalApplyTarget = formId;
  };

  // Ask the main service to send back the current settings for this key.
  // Used to repopulate the PI form when SDK fires onAdd with empty param
  // (which it does on re-click of an already-configured key).
  PI.requestKeySettings = function (formId) {
    if (typeof $UD === 'undefined' || typeof $UD.sendToPlugin !== 'function') return;
    $UD.sendToPlugin({ __type: 'get-key-settings' });
    PI._keySettingsTarget = formId;
  };

  // Cache the last-known-good config per form. If a change attempts to wipe
  // a previously-set "critical" field (entityId, displayEntityId, actionEntityId,
  // domain, service), we treat that as a phantom change event and refuse to send.
  PI._lastSentConfig = {};
  const CRITICAL_FIELDS = ['entityId', 'displayEntityId', 'actionEntityId', 'domain', 'service', 'entityIds'];

  PI.sendConfig = function (formId) {
    if (typeof $UD === 'undefined') {
      console.warn('[HA Hub] $UD not yet available, retrying in 100ms');
      setTimeout(() => PI.sendConfig(formId), 100);
      return;
    }
    const data = PI.serializeForm(formId);
    const last = PI._lastSentConfig[formId];

    // Safety guard: if any previously-set critical field is now empty, this
    // is almost certainly a phantom change event during programmatic fills,
    // not a deliberate user clear. Refuse to wipe.
    if (last) {
      for (const field of CRITICAL_FIELDS) {
        const wasFilled = last[field] && last[field].length > 0;
        const nowEmpty = !data[field] || data[field].length === 0;
        if (wasFilled && nowEmpty) {
          console.warn('[HA Hub] sendConfig refused: critical field "' + field + '" went from "' + last[field] + '" to empty. Likely phantom change. Skipping send.');
          return;
        }
      }
    }

    PI._lastSentConfig[formId] = data;

    if (typeof $UD.sendParamFromPlugin === 'function') {
      $UD.sendParamFromPlugin(data);
    }
    if (typeof $UD.sendToPlugin === 'function') {
      $UD.sendToPlugin(data);
    }
  };

  // Allow applyForm to seed the lastSentConfig cache so the safety guard
  // knows what the "good" baseline is.
  PI.seedLastSent = function (formId, data) {
    if (data && Object.keys(data).length > 0) {
      PI._lastSentConfig[formId] = { ...data };
    }
  };

  PI.bindFormChange = function (formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const handler = () => {
      if (PI._suppressChange) return;
      PI.sendConfig(formId);
    };
    form.addEventListener('change', handler);
    form.addEventListener('input', (e) => {
      if (PI._suppressChange) return;
      if (e.target.tagName === 'TEXTAREA' || e.target.type === 'text' || e.target.type === 'password' || e.target.type === 'number') {
        clearTimeout(form._dt);
        form._dt = setTimeout(handler, 400);
      }
    });
  };
})();
