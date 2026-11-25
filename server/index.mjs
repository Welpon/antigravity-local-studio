import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createDemoSqliteDb,
  inspectDatabase,
  previewTable,
  runSqlQuery,
} from './db.mjs';
import {
  deletePreset,
  executeHttpRequest,
  readApiState,
  savePreset,
} from './http.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, '..');

const APP_URI = 'ui://local-studio/app.html';
const APP_MIME = 'text/html;profile=mcp-app';

function parseDataDir(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--data-dir=')) return arg.slice('--data-dir='.length);
    if (arg === '--data-dir' && argv[i + 1]) return argv[i + 1];
  }
  return path.join(PLUGIN_ROOT, 'data');
}

const dataDir = parseDataDir(process.argv.slice(2));
const prefsPath = path.join(dataDir, 'prefs.json');

function readPrefs() {
  try {
    if (fs.existsSync(prefsPath)) {
      const parsed = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      return {
        lang: parsed?.lang === 'tr' ? 'tr' : 'en',
        dbTarget: typeof parsed?.dbTarget === 'string' ? parsed.dbTarget : '',
      };
    }
  } catch {
    // default
  }
  return { lang: 'en', dbTarget: '' };
}

function writePrefs(patch = {}) {
  const current = readPrefs();
  const next = {
    ...current,
    ...(patch.lang === 'tr' || patch.lang === 'en' ? { lang: patch.lang } : {}),
    ...(typeof patch.dbTarget === 'string' ? { dbTarget: patch.dbTarget.trim() } : {}),
  };
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(prefsPath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function readAppHtml() {
  const htmlPath = process.env.LOCAL_STUDIO_APP_HTML || path.join(__dirname, 'app.html');
  if (!fs.existsSync(htmlPath)) {
    return '<!doctype html><html><body><p>Local Studio UI not built yet. Run <code>npm run build:ui</code>.</p></body></html>';
  }
  return fs.readFileSync(htmlPath, 'utf8');
}

const TOOLS = [
  {
    name: 'open_local_studio',
    title: 'Local Studio',
    description:
      'Open the Local Studio UI panel (SQLite & PostgreSQL Database Explorer + Localhost API Tester).',
    inputSchema: {
      type: 'object',
      properties: {
        tab: { type: 'string', enum: ['api', 'db'], description: 'Optional initial tab.' },
        db_target: { type: 'string', description: 'Optional SQLite path or PostgreSQL connection URL.' },
      },
    },
    _meta: {
      ui: { resourceUri: APP_URI },
      'com.google.antigravity/ui': {
        entrypoints: [
          { type: 'aux_pane', title: 'Local Studio' },
          { type: 'global', title: 'Local Studio' },
        ],
      },
    },
  },
  {
    name: 'db_create_demo',
    title: 'Create Demo SQLite Database',
    description: 'Create a sample SQLite database with users, projects, tasks, and api_logs tables for instant testing.',
    inputSchema: { type: 'object', properties: {} },
    _meta: { ui: { visibility: ['model', 'app'] } },
  },
  {
    name: 'db_inspect',
    title: 'Inspect Database Schema',
    description: 'List tables, row counts, and column definitions for a SQLite file or PostgreSQL URL.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'SQLite file path or postgres:// connection URL.' },
      },
      required: ['target'],
    },
    _meta: { ui: { visibility: ['model', 'app'] } },
  },
  {
    name: 'db_preview_table',
    title: 'Preview Database Table',
    description: 'Return paginated rows from a SQLite or PostgreSQL table.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        table: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
      required: ['target', 'table'],
    },
    _meta: { ui: { visibility: ['model', 'app'] } },
  },
  {
    name: 'db_run_query',
    title: 'Run SQL Query',
    description: 'Execute a SQL query against SQLite or PostgreSQL (read-only by default unless allow_write is true).',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        sql: { type: 'string' },
        allow_write: { type: 'boolean' },
      },
      required: ['target', 'sql'],
    },
    _meta: { ui: { visibility: ['model', 'app'] } },
  },
  {
    name: 'http_request',
    title: 'Send HTTP API Request',
    description: 'Send a GET/POST/PUT/PATCH/DELETE request to localhost or any HTTP(S) endpoint and inspect status, timing, headers, and formatted body.',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string' },
        url: { type: 'string' },
        headers: { type: 'object' },
        body: { type: 'string' },
      },
      required: ['url'],
    },
    _meta: { ui: { visibility: ['model', 'app'] } },
  },
  {
    name: 'http_save_preset',
    title: 'Save API Request Preset',
    description: 'Save an API request into the Local Studio collection.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        method: { type: 'string' },
        url: { type: 'string' },
        headers: { type: 'object' },
        body: { type: 'string' },
      },
      required: ['url'],
    },
    _meta: { ui: { visibility: ['app'] } },
  },
  {
    name: 'http_delete_preset',
    title: 'Delete API Request Preset',
    description: 'Delete a saved API request from the Local Studio collection.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
    _meta: { ui: { visibility: ['app'] } },
  },
  {
    name: 'get_preferences',
    title: 'Get Preferences',
    description: 'Read persisted UI preferences.',
    inputSchema: { type: 'object', properties: {} },
    _meta: { ui: { visibility: ['app'] } },
  },
  {
    name: 'set_preferences',
    title: 'Set Preferences',
    description: 'Persist UI preferences (language, active DB target).',
    inputSchema: {
      type: 'object',
      properties: {
        lang: { type: 'string', enum: ['en', 'tr'] },
        dbTarget: { type: 'string' },
      },
    },
    _meta: { ui: { visibility: ['app'] } },
  },
];

const server = new Server(
  { name: 'local-studio', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: APP_URI,
      name: 'Local Studio App',
      description: 'Interactive SQLite/Postgres Explorer & Localhost API Tester UI',
      mimeType: APP_MIME,
      _meta: { ui: { prefersBorder: false } },
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri !== APP_URI) {
    throw new Error(`Unknown resource URI: ${request.params.uri}`);
  }
  return {
    contents: [
      {
        uri: APP_URI,
        mimeType: APP_MIME,
        text: readAppHtml(),
        _meta: { ui: { prefersBorder: false } },
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    if (name === 'open_local_studio') {
      const prefs = readPrefs();
      const apiState = readApiState(dataDir);
      const dbTarget = String(args.db_target || prefs.dbTarget || '').trim();
      let schema = null;
      if (dbTarget) {
        try {
          schema = await inspectDatabase(dbTarget);
        } catch {
          schema = null;
        }
      }
      const validTabs = new Set(['api', 'db']);
      return {
        content: [
          {
            type: 'text',
            text: `Local Studio ready | Saved API presets: ${apiState.presets.length} | DB: ${schema ? `${schema.engine} (${schema.tables.length} tables)` : 'not connected'}`,
          },
        ],
        structuredContent: {
          activeTab: validTabs.has(args.tab) ? args.tab : 'api',
          prefs,
          dbTarget,
          schema,
          apiState,
        },
      };
    }

    if (name === 'db_create_demo') {
      const dbPath = createDemoSqliteDb(dataDir);
      writePrefs({ dbTarget: dbPath });
      const schema = await inspectDatabase(dbPath);
      return {
        content: [
          {
            type: 'text',
            text: `Demo SQLite DB ready at ${dbPath} (${schema.tables.length} tables).`,
          },
        ],
        structuredContent: { dbTarget: dbPath, schema },
      };
    }

    if (name === 'db_inspect') {
      const target = String(args.target || '').trim();
      const schema = await inspectDatabase(target);
      writePrefs({ dbTarget: target });
      return {
        content: [
          {
            type: 'text',
            text: `Connected (${schema.engine}): ${schema.tables.length} table(s) found.`,
          },
        ],
        structuredContent: { dbTarget: target, schema },
      };
    }

    if (name === 'db_preview_table') {
      const res = await previewTable(args.target, args.table, {
        limit: args.limit,
        offset: args.offset,
      });
      return {
        content: [
          {
            type: 'text',
            text: `Table ${res.table}: showing ${res.rows.length} of ${res.total} rows.`,
          },
        ],
        structuredContent: res,
      };
    }

    if (name === 'db_run_query') {
      const res = await runSqlQuery(args.target, args.sql, {
        allowWrite: Boolean(args.allow_write),
      });
      return {
        content: [
          {
            type: 'text',
            text: `Query OK (${res.durationMs}ms): ${res.rowCount} row(s) returned, ${res.changes} changed.`,
          },
        ],
        structuredContent: res,
      };
    }

    if (name === 'http_request') {
      const res = await executeHttpRequest(dataDir, {
        method: args.method,
        url: args.url,
        headers: args.headers,
        body: args.body,
      });
      const apiState = readApiState(dataDir);
      return {
        content: [
          {
            type: 'text',
            text: `${res.method} ${res.url} -> ${res.status} ${res.statusText} (${res.durationMs}ms, ${res.sizeBytes} bytes)`,
          },
        ],
        structuredContent: { response: res, apiState },
      };
    }

    if (name === 'http_save_preset') {
      const apiState = savePreset(dataDir, args);
      return {
        content: [{ type: 'text', text: `Saved preset (${apiState.presets.length} total).` }],
        structuredContent: { apiState },
      };
    }

    if (name === 'http_delete_preset') {
      const apiState = deletePreset(dataDir, args.id);
      return {
        content: [{ type: 'text', text: `Deleted preset (${apiState.presets.length} remaining).` }],
        structuredContent: { apiState },
      };
    }

    if (name === 'get_preferences') {
      const prefs = readPrefs();
      return { content: [{ type: 'text', text: JSON.stringify(prefs) }], structuredContent: prefs };
    }

    if (name === 'set_preferences') {
      const prefs = writePrefs(args);
      return { content: [{ type: 'text', text: JSON.stringify(prefs) }], structuredContent: prefs };
    }

    return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: `Error: ${err?.message || String(err)}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
