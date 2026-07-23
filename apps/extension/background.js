// background.js — MV3 service worker.
// Owns the context menus and the save pipeline: extract page content via
// chrome.scripting, POST it to CompanyBrain, and surface the outcome as a
// toolbar badge + notification. The popup drives saves through the "cb-save"
// message so all the save logic lives in one place.

const DEFAULT_API_URL = 'http://localhost:3333';

const MENU_SELECTION = 'cb-save-selection';
const MENU_PAGE = 'cb-save-page';

// --- config ---------------------------------------------------------------

async function getConfig() {
  const s = await chrome.storage.sync.get(['apiUrl', 'apiKey', 'defaultSpace', 'defaultTags']);
  return {
    apiUrl: String(s.apiUrl || DEFAULT_API_URL).replace(/\/+$/, ''),
    apiKey: (s.apiKey || '').trim(),
    defaultSpace: (s.defaultSpace || '').trim(),
    defaultTags: s.defaultTags || '',
  };
}

function parseTags(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// --- api ------------------------------------------------------------------

async function postMemory(config, payload) {
  // No key is required against a single-user instance (the default self-host).
  // Only send the Authorization header when a key is actually configured.
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = 'Bearer ' + config.apiKey;
  let res;
  try {
    res = await fetch(config.apiUrl + '/v1/memories', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error('Cannot reach the API at ' + config.apiUrl + '. Is it running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        'The API rejected the request. If it runs in multi-user mode, set an API key in the extension options.',
      );
    }
    const msg = (data && (data.message || data.error)) || 'HTTP ' + res.status;
    throw new Error(String(msg));
  }
  return (data && data.memory) || data;
}

// --- extraction -----------------------------------------------------------

async function extractFromTab(tabId) {
  let results;
  try {
    results = await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (e) {
    throw new Error('Cannot read this page. Browser and store pages are protected.');
  }
  const result = results && results[0] && results[0].result;
  if (!result) throw new Error('Could not extract content from this page.');
  return result;
}

// --- save pipeline --------------------------------------------------------

async function saveTab(tab, mode, extra) {
  extra = extra || {};
  if (!tab || tab.id == null) throw new Error('No active tab.');
  const config = await getConfig();
  const page = await extractFromTab(tab.id);

  let content;
  let sourceType;
  if (mode === 'selection') {
    content = (extra.selection || page.selection || '').trim();
    if (!content) throw new Error('No text is selected on the page.');
    sourceType = 'web-selection';
  } else {
    content = (page.text || '').trim();
    if (!content) throw new Error('Could not find readable text on this page.');
    sourceType = 'web';
  }

  const tags = parseTags(extra.tags != null ? extra.tags : config.defaultTags);
  const space =
    (extra.space != null && extra.space !== '' ? extra.space : config.defaultSpace) || '';

  const payload = {
    title: page.title || tab.title || page.url,
    content: content,
    format: 'text',
    sourceUrl: page.url,
    sourceType: sourceType,
    metadata: {
      byline: page.byline || undefined,
      savedFrom: 'chrome-extension',
      capturedAt: new Date().toISOString(),
    },
  };
  if (tags.length) payload.tags = tags;
  if (space) payload.space = space;

  const memory = await postMemory(config, payload);
  return {
    memory: memory,
    title: payload.title,
    chars: content.length,
    space: space || null,
    mode: mode,
  };
}

// --- feedback -------------------------------------------------------------

async function flashBadge(text, color) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: color });
    await chrome.action.setBadgeText({ text: text });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' }).catch(() => {});
    }, 4000);
  } catch (e) {
    /* badge is best-effort */
  }
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: title,
      message: String(message || '').slice(0, 300),
    });
  } catch (e) {
    /* notifications are best-effort */
  }
}

// --- context menus --------------------------------------------------------

function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SELECTION,
      title: 'Save selection to CompanyBrain',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: 'Save page to CompanyBrain',
      contexts: ['page', 'selection', 'link', 'image'],
    });
  });
}

chrome.runtime.onInstalled.addListener(setupMenus);
chrome.runtime.onStartup.addListener(setupMenus);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const mode = info.menuItemId === MENU_SELECTION ? 'selection' : 'page';
  try {
    const result = await saveTab(tab, mode, { selection: info.selectionText });
    await flashBadge('OK', '#22c55e');
    notify('Saved to CompanyBrain', result.title);
  } catch (e) {
    await flashBadge('ERR', '#ef4444');
    notify('CompanyBrain — save failed', (e && e.message) || e);
  }
});

// --- popup bridge ---------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'cb-save') return false;
  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await saveTab(tab, msg.mode, { tags: msg.tags, space: msg.space });
      await flashBadge('OK', '#22c55e');
      notify('Saved to CompanyBrain', result.title);
      sendResponse({ ok: true, result: result });
    } catch (e) {
      await flashBadge('ERR', '#ef4444');
      sendResponse({ ok: false, error: (e && e.message) || String(e) });
    }
  })();
  return true; // keep the message channel open for the async response
});
