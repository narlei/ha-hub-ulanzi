// Entity cache — reactive store fed by HAClient events.
// Subscribers get notified per-entity when state changes.

class EntityCache extends EventTarget {
  constructor(client) {
    super();
    this.client = client;
    this.entities = new Map();

    client.addEventListener('all-states', (e) => {
      this.entities.clear();
      for (const s of e.detail) {
        this.entities.set(s.entity_id, s);
      }
      this.dispatchEvent(new Event('refreshed'));
    });

    client.addEventListener('state-changed', (e) => {
      const { entity_id, new_state } = e.detail;
      if (new_state) {
        this.entities.set(entity_id, new_state);
      } else {
        this.entities.delete(entity_id);
      }
      this.dispatchEvent(new CustomEvent('entity-changed', {
        detail: { entityId: entity_id, state: new_state }
      }));
    });
  }

  get(entityId) {
    return this.entities.get(entityId) || null;
  }

  getAll() {
    return Array.from(this.entities.values());
  }

  // Returns entities matching domain prefix, optionally filtered by query string.
  search(domains, query) {
    const q = (query || '').toLowerCase().trim();
    const list = this.getAll().filter(s => {
      if (domains && domains.length) {
        const dom = s.entity_id.split('.')[0];
        if (!domains.includes(dom)) return false;
      }
      if (!q) return true;
      const haystack = (s.entity_id + ' ' + (s.attributes?.friendly_name || '')).toLowerCase();
      return haystack.includes(q);
    });
    list.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
    return list.slice(0, 50);
  }

  // Convenience for picker — light-weight summary objects
  searchSummary(domains, query) {
    return this.search(domains, query).map(s => ({
      entity_id: s.entity_id,
      friendly_name: s.attributes?.friendly_name || s.entity_id,
      state: s.state,
      domain: s.entity_id.split('.')[0]
    }));
  }
}

window.EntityCache = EntityCache;
