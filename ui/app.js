import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps';

const I18N = {
  en: {
    appName: 'Local Studio',
    tabApi: 'API Tester',
    tabDb: 'Database',
    sendBtn: 'Send',
    sending: 'Sending...',
    savePresetBtn: 'Save',
    urlPlaceholder: 'http://localhost:3000/api/health or https://...',
    headersLabel: 'Headers (JSON)',
    bodyLabel: 'Body (JSON / Text)',
    responseTitle: 'Response',
    noResponse: 'Click a Demo Preset or enter a URL and press Send.',
    showHeaders: 'Headers',
    debugWithAi: 'Debug / Types with AI',
    savedPresets: 'Saved & Demo Presets',
    recentHistory: 'Recent Requests',
    noHistory: 'No requests sent yet.',
    dbPlaceholder: 'SQLite file path or postgres://user:pass@localhost:5432/db',
    connectBtn: 'Connect',
    demoDbBtn: 'Create Demo DB',
    tablesTitle: 'Tables',
    sendSchemaAi: 'Send Schema to AI',
    noDb: 'Connect to a SQLite file / PostgreSQL URL, or click "Create Demo DB" to try immediately.',
    rows: 'rows',
    previewTitle: 'Table Data',
    prevPage: 'Prev',
    nextPage: 'Next',
    sqlTitle: 'SQL Query Runner',
    sqlPlaceholder: 'SELECT * FROM users LIMIT 20;',
    runSqlBtn: 'Run SQL',
    allowWrite: 'Allow write queries (INSERT/UPDATE/DELETE)',
    readOnlyHint: 'Read-only mode active',
    noRows: 'No rows returned.',
    sentToChat: 'Sent to chat.',
    chatUnavailable: 'Host does not support sending messages to chat.',
    invalidHeaders: 'Headers must be valid JSON object.',
  },
  tr: {
    appName: 'Local Studio',
    tabApi: 'API Testi',
    tabDb: 'Veritabanı',
    sendBtn: 'Gönder',
    sending: 'Gönderiliyor...',
    savePresetBtn: 'Kaydet',
    urlPlaceholder: 'http://localhost:3000/api/health veya https://...',
    headersLabel: 'Başlıklar / Headers (JSON)',
    bodyLabel: 'Gövde / Body (JSON / Metin)',
    responseTitle: 'Yanıt',
    noResponse: 'Hemen denemek için aşağıdaki Demo İsteklerden birine tıkla veya URL yazıp Gönder de.',
    showHeaders: 'Headers',
    debugWithAi: 'AI ile Hata Ayıkla / Tip Üret',
    savedPresets: 'Kayıtlı & Demo İstekler',
    recentHistory: 'Son İstekler',
    noHistory: 'Henüz istek gönderilmedi.',
    dbPlaceholder: 'SQLite dosya yolu veya postgres://user:pass@localhost:5432/db',
    connectBtn: 'Bağlan',
    demoDbBtn: 'Demo DB Oluştur',
    tablesTitle: 'Tablolar',
    sendSchemaAi: 'Şemayı AI\'a Gönder',
    noDb: 'Bir SQLite dosyası / PostgreSQL adresi gir veya hemen denemek için "Demo DB Oluştur"a tıkla.',
    rows: 'satır',
    previewTitle: 'Tablo Verileri',
    prevPage: 'Önceki',
    nextPage: 'Sonraki',
    sqlTitle: 'SQL Sorgu Çalıştırıcı',
    sqlPlaceholder: 'SELECT * FROM users LIMIT 20;',
    runSqlBtn: 'SQL Çalıştır',
    allowWrite: 'Yazma sorgularına izin ver (INSERT/UPDATE/DELETE)',
    readOnlyHint: 'Salt-okunur koruma aktif',
    noRows: 'Satır dönmedi.',
    sentToChat: 'Sohbete gönderildi.',
    chatUnavailable: 'Bu ortam sohbete doğrudan mesaj göndermeyi desteklemiyor.',
    invalidHeaders: 'Headers geçerli bir JSON nesnesi olmalıdır.',
  },
};

const state = {
  lang: 'en',
  activeTab: 'api',
  busy: false,
  toast: null,
  canSendMessage: false,
  // API Tester
  method: 'GET',
  url: 'https://jsonplaceholder.typicode.com/todos/1',
  headersText: '{\n  "Accept": "application/json"\n}',
  bodyText: '',
  showRespHeaders: false,
  response: null,
  presets: [],
  history: [],
  // Database Explorer
  dbInput: '',
  dbTarget: '',
  schema: null,
  selectedTable: '',
  tablePreview: null,
  sqlInput: 'SELECT * FROM users LIMIT 20;',
  allowWrite: false,
  sqlResult: null,
};

function t(key) {
  return (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(text, isError = false) {
  state.toast = { text, isError };
  render();
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    state.toast = null;
    render();
  }, 5000);
}

const app = new App({ name: 'Local Studio', version: '1.0.0' });

function applyThemeFromContext(ctx) {
  if (!ctx) return;
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
}

app.onhostcontextchanged = (ctx) => applyThemeFromContext(ctx);

app.ontoolinput = (params) => {
  const args = params?.arguments || {};
  if (args.tab === 'api' || args.tab === 'db') state.activeTab = args.tab;
  if (args.db_target) {
    state.dbInput = args.db_target;
    state.dbTarget = args.db_target;
  }
  render();
};

app.ontoolresult = (result) => {
  const sc = result?.structuredContent;
  if (!sc) return;
  if (sc.activeTab === 'api' || sc.activeTab === 'db') state.activeTab = sc.activeTab;
  if (sc.prefs?.lang === 'en' || sc.prefs?.lang === 'tr') state.lang = sc.prefs.lang;
  if (sc.dbTarget) {
    state.dbTarget = sc.dbTarget;
    state.dbInput = sc.dbTarget;
  }
  if (sc.schema) state.schema = sc.schema;
  if (sc.apiState) {
    state.presets = sc.apiState.presets || [];
    state.history = sc.apiState.history || [];
  }
  render();
};

async function callTool(name, args = {}) {
  const res = await app.callServerTool({ name, arguments: args });
  if (res?.isError) {
    throw new Error(res?.content?.[0]?.text || 'Tool call failed');
  }
  return res;
}

async function sendPromptToChat(text) {
  if (!state.canSendMessage) {
    showToast(t('chatUnavailable'), true);
    return;
  }
  try {
    await app.sendMessage({ role: 'user', content: [{ type: 'text', text }] });
    showToast(t('sentToChat'));
  } catch (err) {
    showToast(err.message || t('chatUnavailable'), true);
  }
}

async function loadInitial() {
  state.busy = true;
  render();
  try {
    const res = await callTool('open_local_studio', { tab: state.activeTab });
    const sc = res?.structuredContent;
    if (sc) {
      if (sc.prefs?.lang === 'en' || sc.prefs?.lang === 'tr') state.lang = sc.prefs.lang;
      if (sc.dbTarget) {
        state.dbTarget = sc.dbTarget;
        state.dbInput = sc.dbTarget;
      }
      state.schema = sc.schema || null;
      if (sc.apiState) {
        state.presets = sc.apiState.presets || [];
        state.history = sc.apiState.history || [];
      }
    }
  } catch (err) {
    showToast(err.message, true);
  } finally {
    state.busy = false;
    render();
  }
}

async function toggleLang() {
  state.lang = state.lang === 'en' ? 'tr' : 'en';
  render();
  try {
    await callTool('set_preferences', { lang: state.lang });
  } catch {
    // non-fatal
  }
}

function parseHeaders() {
  const raw = state.headersText.trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(t('invalidHeaders'));
  }
  return parsed;
}

async function handleSendRequest() {
  let headers;
  try {
    headers = parseHeaders();
  } catch {
    showToast(t('invalidHeaders'), true);
    return;
  }
  state.busy = true;
  render();
  try {
    const res = await callTool('http_request', {
      method: state.method,
      url: state.url,
      headers,
      body: state.bodyText,
    });
    const sc = res?.structuredContent;
    if (sc?.response) state.response = sc.response;
    if (sc?.apiState) {
      state.presets = sc.apiState.presets || [];
      state.history = sc.apiState.history || [];
    }
  } catch (err) {
    showToast(err.message, true);
  } finally {
    state.busy = false;
    render();
  }
}

async function handleSavePreset() {
  let headers = {};
  try {
    headers = parseHeaders();
  } catch {
    showToast(t('invalidHeaders'), true);
    return;
  }
  try {
    const res = await callTool('http_save_preset', {
      method: state.method,
      url: state.url,
      headers,
      body: state.bodyText,
    });
    if (res?.structuredContent?.apiState) {
      state.presets = res.structuredContent.apiState.presets || [];
    }
    showToast('Saved.');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleDeletePreset(id) {
  try {
    const res = await callTool('http_delete_preset', { id });
    if (res?.structuredContent?.apiState) {
      state.presets = res.structuredContent.apiState.presets || [];
    }
    render();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleDebugApiWithAi() {
  if (!state.response) return;
  const r = state.response;
  const prompt =
    state.lang === 'tr'
      ? `Local Studio API yanıtını incele, varsa hatayı açıkla ve bu yanıt için temiz TypeScript arayüzü (type/interface) üret:\n\nİstek: ${r.method} ${r.url}\nDurum: ${r.status} ${r.statusText} (${r.durationMs}ms)\nYanıt:\n\`\`\`json\n${(r.body || '').slice(0, 3000)}\n\`\`\``
      : `Inspect this Local Studio API response, diagnose any issues, and generate clean TypeScript interfaces for the payload:\n\nRequest: ${r.method} ${r.url}\nStatus: ${r.status} ${r.statusText} (${r.durationMs}ms)\nResponse:\n\`\`\`json\n${(r.body || '').slice(0, 3000)}\n\`\`\``;
  await sendPromptToChat(prompt);
}

async function handleCreateDemoDb() {
  state.busy = true;
  render();
  try {
    const res = await callTool('db_create_demo', {});
    const sc = res?.structuredContent;
    if (sc) {
      state.dbTarget = sc.dbTarget;
      state.dbInput = sc.dbTarget;
      state.schema = sc.schema;
      state.selectedTable = '';
      state.tablePreview = null;
      state.sqlResult = null;
      if (sc.schema?.tables?.length) {
        await handleSelectTable(sc.schema.tables[0].name, 0);
      }
    }
  } catch (err) {
    showToast(err.message, true);
  } finally {
    state.busy = false;
    render();
  }
}

async function handleConnectDb() {
  const target = state.dbInput.trim();
  if (!target) return;
  state.busy = true;
  render();
  try {
    const res = await callTool('db_inspect', { target });
    const sc = res?.structuredContent;
    if (sc) {
      state.dbTarget = sc.dbTarget;
      state.schema = sc.schema;
      state.selectedTable = '';
      state.tablePreview = null;
      state.sqlResult = null;
      if (sc.schema?.tables?.length) {
        await handleSelectTable(sc.schema.tables[0].name, 0);
      }
    }
  } catch (err) {
    showToast(err.message, true);
  } finally {
    state.busy = false;
    render();
  }
}

async function handleSelectTable(tableName, offset = 0) {
  state.selectedTable = tableName;
  state.sqlInput = `SELECT * FROM ${tableName} LIMIT 20;`;
  try {
    const res = await callTool('db_preview_table', {
      target: state.dbTarget,
      table: tableName,
      limit: 25,
      offset,
    });
    state.tablePreview = res?.structuredContent || null;
  } catch (err) {
    showToast(err.message, true);
  }
  render();
}

async function handleRunSql() {
  if (!state.dbTarget || !state.sqlInput.trim()) return;
  state.busy = true;
  render();
  try {
    const res = await callTool('db_run_query', {
      target: state.dbTarget,
      sql: state.sqlInput,
      allow_write: state.allowWrite,
    });
    state.sqlResult = res?.structuredContent || null;
    if (state.allowWrite) {
      const schemaRes = await callTool('db_inspect', { target: state.dbTarget });
      if (schemaRes?.structuredContent?.schema) state.schema = schemaRes.structuredContent.schema;
    }
  } catch (err) {
    showToast(err.message, true);
  } finally {
    state.busy = false;
    render();
  }
}

async function handleSendSchemaToAi() {
  if (!state.schema?.tables?.length) return;
  const summary = state.schema.tables
    .map((tbl) => {
      const cols = tbl.columns.map((c) => `${c.name}: ${c.type}${c.pk ? ' PK' : ''}`).join(', ');
      return `- ${tbl.name} (${tbl.rowCount} rows): ${cols}`;
    })
    .join('\n');
  const prompt =
    state.lang === 'tr'
      ? `Local Studio veritabanı şemam (${state.schema.engine}):\n\n${summary}\n\nBu şemayı bağlam olarak bil; SQL sorguları veya backend API uçları yazarken bu tablo ve sütun adlarını kullan.`
      : `Here is my Local Studio database schema (${state.schema.engine}):\n\n${summary}\n\nUse these exact tables and column names when helping me write SQL queries, ORM models, or API endpoints.`;
  await sendPromptToChat(prompt);
}

function renderDataTable(columns, rows) {
  if (!columns?.length || !rows?.length) {
    return `<div class="empty">${esc(t('noRows'))}</div>`;
  }
  return `
    <div class="table-wrap">
      <table class="grid">
        <thead>
          <tr>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr>${columns
                  .map((c) => {
                    const val = r[c];
                    const txt = val === null || val === undefined ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val);
                    return `<td title="${esc(txt)}">${esc(txt)}</td>`;
                  })
                  .join('')}</tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderApiTab() {
  const r = state.response;
  const statusBadge = r
    ? `<span class="badge ${r.status >= 200 && r.status < 300 ? 'badge-ok' : r.status >= 400 ? 'badge-warn' : 'badge-danger'}">${r.status || 'ERR'} ${esc(r.statusText)}</span>`
    : '';

  const respHtml = !r
    ? `<div class="empty">${esc(t('noResponse'))}</div>`
    : `
      <div class="row-between">
        <div class="row">
          ${statusBadge}
          <span class="badge mono">${r.durationMs}ms</span>
          <span class="badge mono">${r.sizeBytes} B</span>
        </div>
        <div class="row">
          <button class="btn btn-sm" data-action="toggle-resp-headers">${esc(t('showHeaders'))}</button>
          ${
            state.canSendMessage
              ? `<button class="btn btn-sm btn-primary" data-action="debug-api-ai">✨ ${esc(t('debugWithAi'))}</button>`
              : ''
          }
        </div>
      </div>
      ${
        state.showRespHeaders
          ? `<pre class="code-box">${esc(JSON.stringify(r.headers, null, 2))}</pre>`
          : ''
      }
      <pre class="code-box">${esc(r.body)}</pre>
    `;

  return `
    <div class="card">
      <div class="row-nowrap">
        <select class="select mono" id="methodSelect" style="width:94px">
          ${['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
            .map((m) => `<option value="${m}" ${state.method === m ? 'selected' : ''}>${m}</option>`)
            .join('')}
        </select>
        <input class="input mono" id="urlInput" placeholder="${esc(t('urlPlaceholder'))}" value="${esc(state.url)}" style="flex:1" />
        <button class="btn btn-primary" data-action="send-req" ${state.busy ? 'disabled' : ''}>${state.busy ? esc(t('sending')) : '▶ ' + esc(t('sendBtn'))}</button>
        <button class="btn" data-action="save-preset" title="${esc(t('savePresetBtn'))}">💾</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <div class="muted" style="margin-bottom:3px">${esc(t('headersLabel'))}</div>
          <textarea class="textarea" id="headersInput">${esc(state.headersText)}</textarea>
        </div>
        <div>
          <div class="muted" style="margin-bottom:3px">${esc(t('bodyLabel'))}</div>
          <textarea class="textarea" id="bodyInput">${esc(state.bodyText)}</textarea>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">${esc(t('responseTitle'))}</span></div>
      ${respHtml}
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">${esc(t('savedPresets'))} (${state.presets.length})</span></div>
      <div class="list">
        ${state.presets
          .map(
            (p) => `
          <div class="list-item" data-action="load-preset" data-id="${esc(p.id)}">
            <div class="row" style="min-width:0;flex:1">
              <span class="badge badge-accent mono">${esc(p.method)}</span>
              <span class="truncate" style="font-weight:600">${esc(p.name)}</span>
            </div>
            <button class="btn btn-sm" data-action="delete-preset" data-id="${esc(p.id)}">✕</button>
          </div>`
          )
          .join('')}
      </div>
    </div>

    ${
      state.history.length > 0
        ? `
    <div class="card">
      <div class="card-header"><span class="card-title">${esc(t('recentHistory'))}</span></div>
      <div class="list">
        ${state.history
          .slice(0, 8)
          .map(
            (h) => `
          <div class="list-item" data-action="load-history" data-method="${esc(h.method)}" data-url="${esc(h.url)}">
            <div class="row" style="min-width:0;flex:1">
              <span class="badge mono">${esc(h.method)}</span>
              <span class="mono truncate" style="flex:1">${esc(h.url)}</span>
            </div>
            <span class="badge ${h.status >= 200 && h.status < 300 ? 'badge-ok' : 'badge-warn'} mono">${h.status} · ${h.durationMs}ms</span>
          </div>`
          )
          .join('')}
      </div>
    </div>`
        : ''
    }
  `;
}

function renderDbTab() {
  const schema = state.schema;
  const activeTbl = schema?.tables?.find((tbl) => tbl.name === state.selectedTable);

  return `
    <div class="card">
      <div class="row-nowrap">
        <input class="input mono" id="dbTargetInput" placeholder="${esc(t('dbPlaceholder'))}" value="${esc(state.dbInput)}" style="flex:1" />
        <button class="btn btn-primary" data-action="connect-db" ${state.busy ? 'disabled' : ''}>${esc(t('connectBtn'))}</button>
        <button class="btn btn-ok" data-action="create-demo-db" ${state.busy ? 'disabled' : ''}>🧪 ${esc(t('demoDbBtn'))}</button>
      </div>
      ${
        !schema
          ? `<div class="empty">${esc(t('noDb'))}</div>`
          : `
        <div class="row-between">
          <div class="row">
            <span class="badge badge-accent">${esc(schema.engine.toUpperCase())}</span>
            <span class="muted mono truncate" style="max-width:340px" title="${esc(schema.target)}">${esc(schema.target)}</span>
          </div>
          ${
            state.canSendMessage
              ? `<button class="btn btn-sm btn-primary" data-action="send-schema-ai">✨ ${esc(t('sendSchemaAi'))}</button>`
              : ''
          }
        </div>
        <div class="pill-list">
          ${schema.tables
            .map(
              (tbl) => `
            <button class="btn btn-sm ${state.selectedTable === tbl.name ? 'btn-primary' : ''}" data-action="select-table" data-table="${esc(tbl.name)}">
              📋 ${esc(tbl.name)} <span class="muted">(${tbl.rowCount})</span>
            </button>`
            )
            .join('')}
        </div>
      `
      }
    </div>

    ${
      activeTbl && state.tablePreview
        ? `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${esc(t('previewTitle'))}: ${esc(activeTbl.name)} (${state.tablePreview.total} ${esc(t('rows'))})</span>
        <div class="row">
          <button class="btn btn-sm" data-action="page-prev" ${state.tablePreview.offset <= 0 ? 'disabled' : ''}>◀ ${esc(t('prevPage'))}</button>
          <button class="btn btn-sm" data-action="page-next" ${state.tablePreview.offset + state.tablePreview.limit >= state.tablePreview.total ? 'disabled' : ''}>${esc(t('nextPage'))} ▶</button>
        </div>
      </div>
      <div class="pill-list">
        ${activeTbl.columns
          .map(
            (c) => `<span class="badge mono">${esc(c.name)}: ${esc(c.type)}${c.pk ? ' 🔑' : ''}</span>`
          )
          .join('')}
      </div>
      ${renderDataTable(state.tablePreview.columns, state.tablePreview.rows)}
    </div>`
        : ''
    }

    ${
      schema
        ? `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${esc(t('sqlTitle'))}</span>
        <span class="badge ${state.allowWrite ? 'badge-warn' : 'badge-ok'}">${state.allowWrite ? 'WRITE' : esc(t('readOnlyHint'))}</span>
      </div>
      <textarea class="textarea" id="sqlInput" placeholder="${esc(t('sqlPlaceholder'))}">${esc(state.sqlInput)}</textarea>
      <div class="row-between">
        <label class="toggle-label">
          <input type="checkbox" id="allowWriteCheck" ${state.allowWrite ? 'checked' : ''} />
          <span>${esc(t('allowWrite'))}</span>
        </label>
        <button class="btn btn-primary btn-sm" data-action="run-sql" ${state.busy ? 'disabled' : ''}>▶ ${esc(t('runSqlBtn'))}</button>
      </div>
      ${
        state.sqlResult
          ? `
        <div class="muted mono">${state.sqlResult.rowCount} row(s) · ${state.sqlResult.changes} changed · ${state.sqlResult.durationMs}ms</div>
        ${state.sqlResult.columns?.length ? renderDataTable(state.sqlResult.columns, state.sqlResult.rows) : ''}`
          : ''
      }
    </div>`
        : ''
    }
  `;
}

function render() {
  const root = document.getElementById('root');
  if (!root) return;
  const toastHtml = state.toast
    ? `<div class="toast ${state.toast.isError ? 'toast-err' : 'toast-ok'}">${esc(state.toast.text)}</div>`
    : '';

  root.innerHTML = `
    <div class="app-shell">
      <div class="topbar">
        <div class="brand">
          <span class="brand-icon">⚡</span>
          <span>${esc(t('appName'))}</span>
        </div>
        <div class="row">
          <button class="btn btn-sm" data-action="toggle-lang">${state.lang === 'en' ? 'EN / TR' : 'TR / EN'}</button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn ${state.activeTab === 'api' ? 'active' : ''}" data-action="tab" data-tab="api">🌐 ${esc(t('tabApi'))}</button>
        <button class="tab-btn ${state.activeTab === 'db' ? 'active' : ''}" data-action="tab" data-tab="db">🗄️ ${esc(t('tabDb'))}</button>
      </div>

      ${toastHtml}
      ${state.activeTab === 'api' ? renderApiTab() : renderDbTab()}
    </div>
  `;
}

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'urlInput') state.url = el.value;
  if (el.id === 'headersInput') state.headersText = el.value;
  if (el.id === 'bodyInput') state.bodyText = el.value;
  if (el.id === 'dbTargetInput') state.dbInput = el.value;
  if (el.id === 'sqlInput') state.sqlInput = el.value;
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'methodSelect') state.method = el.value;
  if (el.id === 'allowWriteCheck') {
    state.allowWrite = el.checked;
    render();
  }
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'tab') {
    state.activeTab = btn.dataset.tab;
    render();
  } else if (action === 'toggle-lang') {
    toggleLang();
  } else if (action === 'send-req') {
    handleSendRequest();
  } else if (action === 'save-preset') {
    handleSavePreset();
  } else if (action === 'delete-preset') {
    e.stopPropagation();
    handleDeletePreset(btn.dataset.id);
  } else if (action === 'load-preset') {
    const p = state.presets.find((x) => x.id === btn.dataset.id);
    if (p) {
      state.method = p.method;
      state.url = p.url;
      state.headersText = JSON.stringify(p.headers || {}, null, 2);
      state.bodyText = p.body || '';
      render();
    }
  } else if (action === 'load-history') {
    state.method = btn.dataset.method || 'GET';
    state.url = btn.dataset.url || '';
    render();
  } else if (action === 'toggle-resp-headers') {
    state.showRespHeaders = !state.showRespHeaders;
    render();
  } else if (action === 'debug-api-ai') {
    handleDebugApiWithAi();
  } else if (action === 'create-demo-db') {
    handleCreateDemoDb();
  } else if (action === 'connect-db') {
    handleConnectDb();
  } else if (action === 'select-table') {
    handleSelectTable(btn.dataset.table, 0);
  } else if (action === 'page-prev' && state.tablePreview) {
    handleSelectTable(state.selectedTable, Math.max(0, state.tablePreview.offset - state.tablePreview.limit));
  } else if (action === 'page-next' && state.tablePreview) {
    handleSelectTable(state.selectedTable, state.tablePreview.offset + state.tablePreview.limit);
  } else if (action === 'run-sql') {
    handleRunSql();
  } else if (action === 'send-schema-ai') {
    handleSendSchemaToAi();
  }
});

async function bootstrap() {
  render();
  await app.connect();
  applyThemeFromContext(app.getHostContext());
  const caps = app.getHostCapabilities();
  state.canSendMessage = Boolean(caps?.message);
  await loadInitial();
}

bootstrap().catch((err) => {
  showToast(err?.message || 'Failed to connect MCP App', true);
});
