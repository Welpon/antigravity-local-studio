import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const { Client } = pg;

export function detectEngine(target) {
  const s = String(target || '').trim();
  if (/^postgres(ql)?:\/\//i.test(s)) return 'postgres';
  return 'sqlite';
}

function toPlainRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const obj = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'bigint') obj[k] = Number(v);
      else if (v instanceof Uint8Array || Buffer.isBuffer(v)) obj[k] = `<Buffer ${v.length} bytes>`;
      else obj[k] = v;
    }
    return obj;
  });
}

function isReadOnlySql(sql) {
  const cleaned = String(sql || '')
    .replace(/--[^\n]*\n?/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();
  if (!cleaned) return false;
  // Disallow multiple statements in read-only mode
  const parts = cleaned.split(';').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return false;
  return /^(SELECT|PRAGMA|EXPLAIN|WITH|SHOW)\b/i.test(parts[0]);
}

function quoteIdentSqlite(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function quoteIdentPg(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

export function createDemoSqliteDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'demo.sqlite');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        stack TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        owner_id INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
        title TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        done INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS api_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        logged_at TEXT NOT NULL
      );
    `);

    const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get();
    if (!countRow || Number(countRow.cnt) === 0) {
      db.exec(`
        INSERT INTO users (name, email, role, created_at) VALUES
          ('Ada Lovelace', 'ada@example.dev', 'admin', '2026-01-10T09:00:00Z'),
          ('Alan Turing', 'alan@example.dev', 'developer', '2026-01-14T11:30:00Z'),
          ('Grace Hopper', 'grace@example.dev', 'architect', '2026-02-02T14:15:00Z');

        INSERT INTO projects (name, stack, status, owner_id) VALUES
          ('Context Brain', 'Node.js + MCP App', 'shipped', 1),
          ('Ship Guard', 'Node.js + Hooks', 'shipped', 2),
          ('Local Studio', 'SQLite + Postgres + HTTP', 'active', 3);

        INSERT INTO tasks (project_id, title, priority, done) VALUES
          (1, 'Add backup & export manager', 'high', 1),
          (2, 'Add PreToolUse secret scanner', 'high', 1),
          (3, 'Build SQLite & Postgres table browser', 'high', 1),
          (3, 'Add saved API collections', 'medium', 0);

        INSERT INTO api_logs (method, endpoint, status_code, duration_ms, logged_at) VALUES
          ('GET', '/api/health', 200, 14, '2026-03-01T10:00:00Z'),
          ('GET', '/api/projects', 200, 32, '2026-03-01T10:05:12Z'),
          ('POST', '/api/tasks', 201, 48, '2026-03-01T10:09:44Z'),
          ('GET', '/api/admin/metrics', 403, 9, '2026-03-01T10:12:03Z');
      `);
    }
  } finally {
    db.close();
  }
  return dbPath;
}

async function withPgClient(connectionString, fn) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function inspectDatabase(target) {
  const rawTarget = String(target || '').trim();
  if (!rawTarget) throw new Error('Database path or connection string is required.');

  const engine = detectEngine(rawTarget);

  if (engine === 'sqlite') {
    const resolved = path.resolve(rawTarget);
    if (!fs.existsSync(resolved)) {
      throw new Error(`SQLite file not found: ${resolved}`);
    }
    const db = new DatabaseSync(resolved, { readOnly: true });
    try {
      const tableRows = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all();
      const tables = tableRows.map((t) => {
        const name = String(t.name);
        const colRows = db.prepare(`PRAGMA table_info(${quoteIdentSqlite(name)})`).all();
        const countRes = db.prepare(`SELECT COUNT(*) AS cnt FROM ${quoteIdentSqlite(name)}`).get();
        return {
          name,
          rowCount: Number(countRes?.cnt ?? 0),
          columns: colRows.map((c) => ({
            name: String(c.name),
            type: String(c.type || 'TEXT'),
            nullable: Number(c.notnull) === 0,
            pk: Number(c.pk) > 0,
          })),
        };
      });
      return { engine: 'sqlite', target: resolved, tables };
    } finally {
      db.close();
    }
  }

  return withPgClient(rawTarget, async (client) => {
    const tRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = [];
    for (const row of tRes.rows) {
      const name = String(row.table_name);
      const colRes = await client.query(
        `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
        `,
        [name]
      );
      const cntRes = await client.query(`SELECT COUNT(*)::int AS cnt FROM ${quoteIdentPg(name)}`);
      tables.push({
        name,
        rowCount: Number(cntRes.rows[0]?.cnt ?? 0),
        columns: colRes.rows.map((c) => ({
          name: String(c.column_name),
          type: String(c.data_type),
          nullable: c.is_nullable === 'YES',
          pk: false,
        })),
      });
    }
    return { engine: 'postgres', target: rawTarget.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@'), tables };
  });
}

export async function previewTable(target, tableName, { limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const schema = await inspectDatabase(target);
  const table = schema.tables.find((t) => t.name === tableName);
  if (!table) {
    throw new Error(`Table not found: ${tableName}`);
  }

  const engine = detectEngine(target);
  if (engine === 'sqlite') {
    const db = new DatabaseSync(path.resolve(target), { readOnly: true });
    try {
      const rows = db
        .prepare(`SELECT * FROM ${quoteIdentSqlite(table.name)} LIMIT ? OFFSET ?`)
        .all(safeLimit, safeOffset);
      return {
        table: table.name,
        columns: table.columns.map((c) => c.name),
        rows: toPlainRows(rows),
        total: table.rowCount,
        limit: safeLimit,
        offset: safeOffset,
      };
    } finally {
      db.close();
    }
  }

  return withPgClient(target, async (client) => {
    const res = await client.query(
      `SELECT * FROM ${quoteIdentPg(table.name)} LIMIT $1 OFFSET $2`,
      [safeLimit, safeOffset]
    );
    return {
      table: table.name,
      columns: res.fields.map((f) => f.name),
      rows: toPlainRows(res.rows),
      total: table.rowCount,
      limit: safeLimit,
      offset: safeOffset,
    };
  });
}

export async function runSqlQuery(target, sql, { allowWrite = false } = {}) {
  const query = String(sql || '').trim();
  if (!query) throw new Error('SQL query cannot be empty.');
  if (!allowWrite && !isReadOnlySql(query)) {
    throw new Error('Read-only mode is enabled. Only SELECT / PRAGMA / EXPLAIN / WITH / SHOW queries are allowed unless you enable write mode.');
  }

  const engine = detectEngine(target);
  const startedAt = Date.now();

  if (engine === 'sqlite') {
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) throw new Error(`SQLite file not found: ${resolved}`);
    const db = new DatabaseSync(resolved, { readOnly: !allowWrite });
    try {
      if (/^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(query)) {
        const rows = toPlainRows(db.prepare(query).all()).slice(0, 200);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return {
          engine: 'sqlite',
          columns,
          rows,
          rowCount: rows.length,
          changes: 0,
          durationMs: Date.now() - startedAt,
        };
      }
      const info = db.prepare(query).run();
      return {
        engine: 'sqlite',
        columns: [],
        rows: [],
        rowCount: 0,
        changes: Number(info?.changes ?? 0),
        durationMs: Date.now() - startedAt,
      };
    } finally {
      db.close();
    }
  }

  return withPgClient(target, async (client) => {
    const res = await client.query(query);
    const rows = toPlainRows(res.rows || []).slice(0, 200);
    const columns = (res.fields || []).map((f) => f.name);
    return {
      engine: 'postgres',
      columns,
      rows,
      rowCount: rows.length,
      changes: typeof res.rowCount === 'number' ? res.rowCount : rows.length,
      durationMs: Date.now() - startedAt,
    };
  });
}
