// Theme presets for icon rendering.

const THEMES = {
  default: {
    label: 'Default',
    on:    { bg: '#16a34a', fg: '#ffffff' },
    off:   { bg: '#1f2937', fg: '#9ca3af' },
    error: { bg: '#b45309', fg: '#fef3c7' }
  },
  warm: {
    label: 'Warm',
    on:    { bg: '#f59e0b', fg: '#1c1917' },
    off:   { bg: '#1c1917', fg: '#78716c' },
    error: { bg: '#dc2626', fg: '#fef2f2' }
  },
  cool: {
    label: 'Cool',
    on:    { bg: '#0ea5e9', fg: '#ffffff' },
    off:   { bg: '#0f172a', fg: '#64748b' },
    error: { bg: '#7c2d12', fg: '#fed7aa' }
  },
  minimal: {
    label: 'Minimal',
    on:    { bg: '#ffffff', fg: '#000000' },
    off:   { bg: '#000000', fg: '#666666' },
    error: { bg: '#666666', fg: '#ffffff' }
  },
  trafficLight: {
    label: 'Traffic light',
    on:    { bg: '#22c55e', fg: '#052e16' },
    off:   { bg: '#dc2626', fg: '#fee2e2' },
    error: { bg: '#f59e0b', fg: '#451a03' }
  },
  ocean: {
    label: 'Ocean',
    on:    { bg: '#06b6d4', fg: '#083344' },
    off:   { bg: '#1e293b', fg: '#94a3b8' },
    error: { bg: '#9f1239', fg: '#ffe4e6' }
  }
};

function getTheme(name) {
  return THEMES[name] || THEMES.default;
}

function listThemes() {
  return Object.keys(THEMES).map(k => ({ key: k, label: THEMES[k].label }));
}

window.HAThemes = { getTheme, listThemes, THEMES };
