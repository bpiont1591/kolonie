// Warstwa bazy danych.
// Gra korzysta wyłącznie z interfejsu { get, all, run, insert, tx, kind } z zapytaniami SQL
// i parametrami "?". Adaptery:
//  - Postgres (np. Neon) – gdy ustawiono DATABASE_URL,
//  - SQLite (wbudowany node:sqlite) – lokalnie, gdy DATABASE_URL nie ma.
import fs from 'node:fs';
import path from 'node:path';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS corps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  owner_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  planet TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  metal INTEGER NOT NULL DEFAULT 0,
  crystal INTEGER NOT NULL DEFAULT 0,
  energy INTEGER NOT NULL DEFAULT 0,
  collected_at INTEGER NOT NULL,
  b_mine INTEGER NOT NULL DEFAULT 1,
  b_power INTEGER NOT NULL DEFAULT 1,
  b_shipyard INTEGER NOT NULL DEFAULT 1,
  b_lab INTEGER NOT NULL DEFAULT 1,
  s_hull INTEGER NOT NULL DEFAULT 1,
  s_guns INTEGER NOT NULL DEFAULT 1,
  s_shields INTEGER NOT NULL DEFAULT 1,
  hp INTEGER NOT NULL,
  hp_at INTEGER NOT NULL,
  pve_wins INTEGER NOT NULL DEFAULT 0,
  pvp_wins INTEGER NOT NULL DEFAULT 0,
  pvp_losses INTEGER NOT NULL DEFAULT 0,
  pvp_points INTEGER NOT NULL DEFAULT 0,
  last_battle_at INTEGER NOT NULL DEFAULT 0,
  protected_until INTEGER NOT NULL DEFAULT 0,
  corp_id INTEGER REFERENCES corps(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS users_rank ON users(level DESC, xp DESC);
CREATE INDEX IF NOT EXISTS users_corp ON users(corp_id);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  attacker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  defender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  enemy_name TEXT NOT NULL,
  attacker_won INTEGER NOT NULL,
  log TEXT NOT NULL,
  reward TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS battles_att ON battles(attacker_id, id DESC);
CREATE INDEX IF NOT EXISTS battles_def ON battles(defender_id, id DESC);
`;

// Migracje: lista kroków (każdy = lista poleceń SQL), zapisywana w tabeli schema_migrations.
// Składnia działa w SQLite i Postgresie (INTEGER -> BIGINT i AUTOINCREMENT -> BIGSERIAL podmieniane automatycznie).
export const MIGRATIONS = [
  ['001_daily_quests', [
    'ALTER TABLE users ADD COLUMN login_day INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN login_streak INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN boost_until INTEGER NOT NULL DEFAULT 0',
    `CREATE TABLE IF NOT EXISTS quest_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, period, quest_id)
    )`,
  ]],
];

async function migrate(api, conv = (s) => s) {
  await api.run('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at ' + conv('INTEGER') + ' NOT NULL)');
  const done = new Set((await api.all('SELECT id FROM schema_migrations')).map((r) => r.id));
  for (const [id, stmts] of MIGRATIONS) {
    if (done.has(id)) continue;
    await api.tx(async (t) => {
      for (const sql of stmts) await t.run(conv(sql));
      await t.run('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [id, Date.now()]);
    });
    console.log(`Migracja ${id} wykonana.`);
  }
}

export async function createSqliteDb(file) {
  const { DatabaseSync } = await import('node:sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  raw.exec(SCHEMA);
  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (!s) { s = raw.prepare(sql); cache.set(sql, s); }
    return s;
  };
  // Interfejs jest asynchroniczny, choć SQLite jest synchroniczny – tak jak będzie w Postgresie.
  const api = {
    async get(sql, params = []) { const r = stmt(sql).get(...params); return r ? { ...r } : undefined; },
    async all(sql, params = []) { return stmt(sql).all(...params).map((r) => ({ ...r })); },
    async run(sql, params = []) {
      const r = stmt(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    /** INSERT do tabeli z kolumną id – zwraca nowe id. */
    async insert(sql, params = []) { return Number(stmt(sql).run(...params).lastInsertRowid); },
    kind: 'sqlite',
  };
  // Transakcje są serializowane kolejką, więc logika gry jest atomowa (server-authoritative).
  let queue = Promise.resolve();
  api.tx = (fn) => {
    const next = queue.then(async () => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const out = await fn(api);
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    });
    queue = next.catch(() => {});
    return next;
  };
  api.close = () => raw.close();
  await migrate(api);
  return api;
}

// ---------------- Postgres / Neon ----------------
const pgConv = (sql) => sql
  .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'BIGSERIAL PRIMARY KEY')
  .replace(/\bINTEGER\b/g, 'BIGINT');
const PG_SCHEMA = pgConv(SCHEMA);

const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };

export async function createPgDb(url) {
  const { default: pg } = await import('pg');
  pg.types.setTypeParser(20, (v) => Number(v));    // BIGINT -> number (znaczniki czasu w ms mieszczą się)
  pg.types.setTypeParser(1700, (v) => Number(v));  // NUMERIC (np. SUM) -> number
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX) || 5, idleTimeoutMillis: 30_000 });
  pool.on('error', (e) => console.error('PG pool error:', e.message));
  await pool.query(PG_SCHEMA);
  const mk = (q) => ({
    async get(sql, params = []) { return (await q(toPg(sql), params)).rows[0]; },
    async all(sql, params = []) { return (await q(toPg(sql), params)).rows; },
    async run(sql, params = []) { return { changes: (await q(toPg(sql), params)).rowCount }; },
    async insert(sql, params = []) { return Number((await q(toPg(sql) + ' RETURNING id', params)).rows[0].id); },
    kind: 'postgres',
  });
  const api = mk((sql, p) => pool.query(sql, p));
  // Transakcje serializowane w obrębie procesu (jedna instancja serwera) + prawdziwe BEGIN/COMMIT.
  let queue = Promise.resolve();
  api.tx = (fn) => {
    const next = queue.then(async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(mk((sql, p) => client.query(sql, p)));
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    });
    queue = next.catch(() => {});
    return next;
  };
  api.close = () => pool.end();
  await migrate(api, pgConv);
  return api;
}

export async function createDb({ url, file }) {
  return url ? createPgDb(url) : createSqliteDb(file);
}
