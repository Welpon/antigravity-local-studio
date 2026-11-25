import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PRESETS = [
  {
    id: 'demo-todo',
    name: 'Demo: GET Todo #1',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/todos/1',
    headers: { Accept: 'application/json' },
    body: '',
  },
  {
    id: 'demo-users',
    name: 'Demo: GET Users List',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/users?_limit=3',
    headers: { Accept: 'application/json' },
    body: '',
  },
  {
    id: 'demo-post',
    name: 'Demo: POST Create Item',
    method: 'POST',
    url: 'https://jsonplaceholder.typicode.com/posts',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hello Local Studio', body: 'Test payload', userId: 1 }, null, 2),
  },
  {
    id: 'local-health',
    name: 'Localhost: Health Check',
    method: 'GET',
    url: 'http://localhost:3000/api/health',
    headers: { Accept: 'application/json' },
    body: '',
  },
];

function stateFilePath(dataDir) {
  return path.join(dataDir, 'api-state.json');
}

export function readApiState(dataDir) {
  const file = stateFilePath(dataDir);
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        presets: Array.isArray(parsed?.presets) ? parsed.presets : [...DEFAULT_PRESETS],
        history: Array.isArray(parsed?.history) ? parsed.history : [],
      };
    }
  } catch {
    // fallback to defaults
  }
  return { presets: [...DEFAULT_PRESETS], history: [] };
}

function writeApiState(dataDir, next) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(stateFilePath(dataDir), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function savePreset(dataDir, preset) {
  const current = readApiState(dataDir);
  const id = preset.id || `req-${Date.now()}`;
  const clean = {
    id,
    name: String(preset.name || `${preset.method || 'GET'} ${preset.url || ''}`).trim().slice(0, 80),
    method: String(preset.method || 'GET').toUpperCase(),
    url: String(preset.url || '').trim(),
    headers: preset.headers && typeof preset.headers === 'object' ? preset.headers : {},
    body: typeof preset.body === 'string' ? preset.body : '',
  };
  const idx = current.presets.findIndex((p) => p.id === id);
  if (idx >= 0) current.presets[idx] = clean;
  else current.presets.unshift(clean);
  return writeApiState(dataDir, current);
}

export function deletePreset(dataDir, id) {
  const current = readApiState(dataDir);
  current.presets = current.presets.filter((p) => p.id !== id);
  return writeApiState(dataDir, current);
}

export async function executeHttpRequest(dataDir, { method = 'GET', url = '', headers = {}, body = '', timeoutMs = 15000 } = {}) {
  const cleanUrl = String(url || '').trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    throw new Error('URL must start with http:// or https://');
  }
  const cleanMethod = String(method || 'GET').toUpperCase();
  const cleanHeaders = {};
  if (headers && typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) {
      if (String(k).trim()) cleanHeaders[String(k).trim()] = String(v ?? '');
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const fetchOpts = {
      method: cleanMethod,
      headers: cleanHeaders,
      signal: controller.signal,
    };
    if (!['GET', 'HEAD'].includes(cleanMethod) && body) {
      fetchOpts.body = String(body);
    }

    const res = await fetch(cleanUrl, fetchOpts);
    const durationMs = Date.now() - startedAt;
    const rawText = await res.text();
    const sizeBytes = Buffer.byteLength(rawText, 'utf8');
    const respHeaders = {};
    res.headers.forEach((v, k) => {
      respHeaders[k] = v;
    });

    let isJson = false;
    let formattedBody = rawText;
    try {
      const parsed = JSON.parse(rawText);
      isJson = true;
      formattedBody = JSON.stringify(parsed, null, 2);
    } catch {
      // keep raw text
    }

    const truncated = formattedBody.length > 24000;
    const outputBody = truncated ? `${formattedBody.slice(0, 24000)}\n... (truncated)` : formattedBody;

    const result = {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      durationMs,
      sizeBytes,
      contentType: respHeaders['content-type'] || '',
      headers: respHeaders,
      body: outputBody,
      isJson,
      truncated,
      method: cleanMethod,
      url: cleanUrl,
      timestamp: new Date().toISOString(),
    };

    const st = readApiState(dataDir);
    st.history.unshift({
      id: `h-${Date.now()}`,
      method: cleanMethod,
      url: cleanUrl,
      status: res.status,
      durationMs,
      timestamp: result.timestamp,
    });
    st.history = st.history.slice(0, 25);
    writeApiState(dataDir, st);

    return result;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const msg = err?.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : err?.message || String(err);
    return {
      ok: false,
      status: 0,
      statusText: 'NETWORK_ERROR',
      durationMs,
      sizeBytes: 0,
      contentType: '',
      headers: {},
      body: msg,
      isJson: false,
      truncated: false,
      method: cleanMethod,
      url: cleanUrl,
      timestamp: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}
