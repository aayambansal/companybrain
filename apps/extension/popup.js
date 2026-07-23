// popup.js — status check, space picker, and save triggers.
// All network + extraction work happens in the background service worker;
// the popup fetches /v1/status and /v1/spaces directly for display.

const DEFAULT_API_URL = 'http://localhost:3333';

const el = {
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  space: document.getElementById('space'),
  tags: document.getElementById('tags'),
  savePage: document.getElementById('savePage'),
  saveSelection: document.getElementById('saveSelection'),
  result: document.getElementById('result'),
  openOptions: document.getElementById('openOptions'),
  apiHost: document.getElementById('apiHost'),
};

let config = { apiUrl: DEFAULT_API_URL, apiKey: '', defaultSpace: '', defaultTags: '' };

async function loadConfig() {
  const s = await chrome.storage.sync.get(['apiUrl', 'apiKey', 'defaultSpace', 'defaultTags']);
  config = {
    apiUrl: String(s.apiUrl || DEFAULT_API_URL).replace(/\/+$/, ''),
    apiKey: (s.apiKey || '').trim(),
    defaultSpace: (s.defaultSpace || '').trim(),
    defaultTags: s.defaultTags || '',
  };
}

function authHeaders() {
  // Single-user instances need no key; only send auth when one is configured.
  const h = { 'Content-Type': 'application/json' };
  if (config.apiKey) h.Authorization = 'Bearer ' + config.apiKey;
  return h;
}

function setStatus(state, text) {
  el.statusDot.className = 'dot ' + state;
  el.statusText.textContent = text;
}

function hostLabel(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return url;
  }
}

function setButtonsEnabled(on) {
  el.savePage.disabled = !on;
  el.saveSelection.disabled = !on;
}

function showResult(kind, title, meta) {
  el.result.hidden = false;
  el.result.className = 'result ' + kind;
  el.result.innerHTML = '';
  const t = document.createElement('div');
  t.className = 'r-title';
  t.textContent = title;
  el.result.appendChild(t);
  if (meta) {
    const m = document.createElement('div');
    m.className = 'r-meta';
    m.textContent = meta;
    el.result.appendChild(m);
  }
}

async function checkStatus() {
  el.apiHost.textContent = hostLabel(config.apiUrl);
  if (!config.apiKey) {
    setStatus('err', 'no api key');
    setButtonsEnabled(false);
    showResult('err', 'Not configured', 'Open options to set your API URL and key.');
    return;
  }
  setStatus('checking', 'checking…');
  try {
    const res = await fetch(config.apiUrl + '/v1/status', { headers: authHeaders() });
    if (!res.ok) {
      setStatus('err', 'http ' + res.status);
      setButtonsEnabled(false);
      return;
    }
    const data = await res.json();
    // /v1/status only returns org/counts when the key authenticates.
    if (!data || !data.counts) {
      setStatus('err', 'unauthorized');
      setButtonsEnabled(false);
      showResult('err', 'Invalid API key', 'The key was rejected. Check it in options.');
      return;
    }
    const prov = (data.embedding && data.embedding.provider) || 'ready';
    setStatus('ok', prov + ' · ' + (data.counts.documents || 0) + ' docs');
    setButtonsEnabled(true);
    await loadSpaces();
  } catch (e) {
    setStatus('err', 'offline');
    setButtonsEnabled(false);
    showResult('err', 'Cannot reach the API', config.apiUrl);
  }
}

async function loadSpaces() {
  try {
    const res = await fetch(config.apiUrl + '/v1/spaces', { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const spaces = (data && data.spaces) || [];
    el.space.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = 'default';
    el.space.appendChild(def);
    spaces.forEach((sp) => {
      const opt = document.createElement('option');
      opt.value = sp.slug;
      opt.textContent = sp.name + (sp.isDefault ? ' (default)' : '');
      el.space.appendChild(opt);
    });
    if (config.defaultSpace) el.space.value = config.defaultSpace;
    el.space.disabled = false;
  } catch (e) {
    /* leave the picker on its default option */
  }
}

async function save(mode) {
  setButtonsEnabled(false);
  showResult('pending', mode === 'selection' ? 'Saving selection…' : 'Saving page…', '');
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'cb-save',
      mode: mode,
      tags: el.tags.value,
      space: el.space.value,
    });
    if (response && response.ok) {
      const r = response.result;
      const bits = [r.chars + ' chars'];
      if (r.space) bits.push('space: ' + r.space);
      showResult('ok', 'Saved: ' + r.title, bits.join('  ·  '));
    } else {
      showResult('err', 'Save failed', (response && response.error) || 'Unknown error');
    }
  } catch (e) {
    showResult('err', 'Save failed', (e && e.message) || String(e));
  } finally {
    setButtonsEnabled(true);
  }
}

el.savePage.addEventListener('click', () => save('page'));
el.saveSelection.addEventListener('click', () => save('selection'));
el.openOptions.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

(async function init() {
  await loadConfig();
  el.tags.value = config.defaultTags || '';
  await checkStatus();
})();
