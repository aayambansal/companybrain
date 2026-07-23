// options.js — read/write extension settings and test the API connection.

const DEFAULT_API_URL = 'http://localhost:3333';

const el = {
  form: document.getElementById('form'),
  apiUrl: document.getElementById('apiUrl'),
  apiKey: document.getElementById('apiKey'),
  defaultSpace: document.getElementById('defaultSpace'),
  defaultTags: document.getElementById('defaultTags'),
  save: document.getElementById('save'),
  test: document.getElementById('test'),
  result: document.getElementById('result'),
};

function normalizeUrl(raw) {
  return String(raw || DEFAULT_API_URL)
    .trim()
    .replace(/\/+$/, '');
}

function showResult(kind, text) {
  el.result.hidden = false;
  el.result.className = 'result ' + kind;
  el.result.textContent = text;
}

async function load() {
  const s = await chrome.storage.sync.get(['apiUrl', 'apiKey', 'defaultSpace', 'defaultTags']);
  el.apiUrl.value = s.apiUrl || DEFAULT_API_URL;
  el.apiKey.value = s.apiKey || '';
  el.defaultSpace.value = s.defaultSpace || '';
  el.defaultTags.value = s.defaultTags || '';
}

async function save(e) {
  e.preventDefault();
  const apiUrl = normalizeUrl(el.apiUrl.value);
  el.apiUrl.value = apiUrl;
  await chrome.storage.sync.set({
    apiUrl: apiUrl,
    apiKey: el.apiKey.value.trim(),
    defaultSpace: el.defaultSpace.value.trim(),
    defaultTags: el.defaultTags.value.trim(),
  });
  showResult('ok', 'Saved.');
}

async function test() {
  const apiUrl = normalizeUrl(el.apiUrl.value);
  const apiKey = el.apiKey.value.trim();
  if (!apiKey) {
    showResult('err', 'Enter an API key first.');
    return;
  }
  el.test.disabled = true;
  showResult('pending', 'Testing ' + apiUrl + ' …');
  try {
    const res = await fetch(apiUrl + '/v1/status', {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showResult('err', 'Failed: HTTP ' + res.status + ' — ' + (data.message || data.error || ''));
      return;
    }
    if (!data.counts) {
      showResult('err', 'Reached the server, but the API key was not accepted (unauthorized).');
      return;
    }
    const lines = [
      'Connected to ' + (data.name || 'companybrain') + ' v' + (data.version || '?'),
      'Embedding: ' +
        ((data.embedding && data.embedding.provider) || '?') +
        ' / ' +
        ((data.embedding && data.embedding.model) || '?'),
      'LLM: ' +
        ((data.llm && data.llm.provider) || '?') +
        (data.llm && data.llm.available ? ' (available)' : ' (unavailable)'),
      'Org counts: ' +
        (data.counts.documents || 0) +
        ' documents · ' +
        (data.counts.chunks || 0) +
        ' chunks · ' +
        (data.counts.spaces || 0) +
        ' spaces',
    ];
    showResult('ok', lines.join('\n'));
  } catch (err) {
    showResult('err', 'Cannot reach ' + apiUrl + '. Is the server running and reachable?');
  } finally {
    el.test.disabled = false;
  }
}

el.form.addEventListener('submit', save);
el.test.addEventListener('click', test);

load();
