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
  ['002_queues_expeditions', [
    'ALTER TABLE users ADD COLUMN bq_id TEXT',
    'ALTER TABLE users ADD COLUMN bq_until INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN mq_id TEXT',
    'ALTER TABLE users ADD COLUMN mq_until INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN ex_until INTEGER NOT NULL DEFAULT 0',
    `CREATE TABLE IF NOT EXISTS expeditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      return_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      result TEXT NOT NULL DEFAULT '{}'
    )`,
    'CREATE INDEX IF NOT EXISTS expeditions_user ON expeditions(user_id, id DESC)',
  ]],
  ['003_corp_wars_boss', [
    "ALTER TABLE users ADD COLUMN corp_role TEXT NOT NULL DEFAULT 'member'",
    "UPDATE users SET corp_role = 'leader' WHERE id IN (SELECT owner_id FROM corps)",
    'ALTER TABLE corps ADD COLUMN t_metal INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE corps ADD COLUMN t_crystal INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE corps ADD COLUMN t_energy INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE corps ADD COLUMN u_hq INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE corps ADD COLUMN u_lab INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE corps ADD COLUMN u_refinery INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE corps ADD COLUMN war_target INTEGER NOT NULL DEFAULT 4',
    `CREATE TABLE IF NOT EXISTS corp_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      corp_id INTEGER NOT NULL REFERENCES corps(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      text TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS corp_log_corp ON corp_log(corp_id, id DESC)',
    `CREATE TABLE IF NOT EXISTS war_points (
      week INTEGER NOT NULL,
      corp_id INTEGER NOT NULL REFERENCES corps(id) ON DELETE CASCADE,
      planet INTEGER NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (week, corp_id, planet)
    )`,
    `CREATE TABLE IF NOT EXISTS war_contrib (
      week INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      corp_id INTEGER NOT NULL REFERENCES corps(id) ON DELETE CASCADE,
      points INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (week, user_id, corp_id)
    )`,
    `CREATE TABLE IF NOT EXISTS bosses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      corp_id INTEGER NOT NULL REFERENCES corps(id) ON DELETE CASCADE,
      level INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      hp INTEGER NOT NULL,
      spawned_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      ended_at INTEGER NOT NULL DEFAULT 0
    )`,
    'CREATE INDEX IF NOT EXISTS bosses_corp ON bosses(corp_id, id DESC)',
    `CREATE TABLE IF NOT EXISTS boss_hits (
      boss_id INTEGER NOT NULL REFERENCES bosses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      damage INTEGER NOT NULL DEFAULT 0,
      attacks INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (boss_id, user_id)
    )`,
  ]],
  ['004_chat_push', [
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      tag TEXT,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS chat_channel ON chat_messages(channel, id DESC)',
    `CREATE TABLE IF NOT EXISTS push_subs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS push_subs_user ON push_subs(user_id)',
    'ALTER TABLE users ADD COLUMN notified_bq INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN notified_mq INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN notified_ex INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN notified_storage INTEGER NOT NULL DEFAULT 0',
  ]],
  ['005_test_flag', [
    'ALTER TABLE users ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0',
  ]],
  ['006_tutorial', [
    'ALTER TABLE users ADD COLUMN tut_step INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN tut_done INTEGER NOT NULL DEFAULT 0',
  ]],
  ['007_seasons', [
    `CREATE TABLE IF NOT EXISTS season_stats (
      season TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      xp INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (season, user_id)
    )`,
    'CREATE INDEX IF NOT EXISTS season_stats_rank ON season_stats(season, xp DESC)',
    `CREATE TABLE IF NOT EXISTS season_claims (
      season TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      level INTEGER NOT NULL,
      PRIMARY KEY (season, user_id, level)
    )`,
    `CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY,
      finalized_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS season_awards (
      season TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      rank INTEGER NOT NULL,
      xp INTEGER NOT NULL,
      reward TEXT NOT NULL,
      claimed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (season, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_badges (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge TEXT NOT NULL,
      season TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, badge, season)
    )`,
  ]],
  ['008_arena_achievements', [
    `CREATE TABLE IF NOT EXISTS arena_entries (
      t_start INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (t_start, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS arena_tournaments (
      start INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      players INTEGER NOT NULL DEFAULT 0,
      bracket TEXT NOT NULL DEFAULT '{}',
      resolved_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS arena_results (
      start INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      place INTEGER NOT NULL,
      reward TEXT NOT NULL,
      PRIMARY KEY (start, user_id)
    )`,
    'CREATE INDEX IF NOT EXISTS arena_results_user ON arena_results(user_id, start DESC)',
    `CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ach TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, ach)
    )`,
    "ALTER TABLE users ADD COLUMN title TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE chat_messages ADD COLUMN title TEXT NOT NULL DEFAULT ''",
  ]],
  ['009_market_referrals', [
    'CREATE TABLE IF NOT EXISTS app_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)',
    `CREATE TABLE IF NOT EXISTS user_ips (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_hash TEXT NOT NULL,
      device TEXT NOT NULL,
      first_at INTEGER NOT NULL,
      last_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, ip_hash, device)
    )`,
    'CREATE INDEX IF NOT EXISTS user_ips_ip ON user_ips(ip_hash)',
    'CREATE INDEX IF NOT EXISTS user_ips_dev ON user_ips(device)',
    `CREATE TABLE IF NOT EXISTS market_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sell_res TEXT NOT NULL,
      sell_amt INTEGER NOT NULL,
      buy_res TEXT NOT NULL,
      buy_amt INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      buyer_id INTEGER,
      closed_at INTEGER NOT NULL DEFAULT 0
    )`,
    'CREATE INDEX IF NOT EXISTS market_open ON market_offers(status, sell_res)',
    'CREATE INDEX IF NOT EXISTS market_seller ON market_offers(seller_id, status)',
    'CREATE INDEX IF NOT EXISTS market_buyer ON market_offers(buyer_id, closed_at)',
    'ALTER TABLE users ADD COLUMN ref_code TEXT',
    'CREATE UNIQUE INDEX IF NOT EXISTS users_ref_code ON users(ref_code)',
    'ALTER TABLE users ADD COLUMN referred_by INTEGER',
    'ALTER TABLE users ADD COLUMN ref_state INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE users ADD COLUMN reg_ip TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE users ADD COLUMN reg_device TEXT NOT NULL DEFAULT ''",
  ]],
  ['010_admin', [
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT ''",
    'ALTER TABLE users ADD COLUMN banned_until INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE users ADD COLUMN ban_reason TEXT NOT NULL DEFAULT ''",
    `CREATE TABLE IF NOT EXISTS flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      resolved_at INTEGER NOT NULL DEFAULT 0,
      resolved_by TEXT NOT NULL DEFAULT ''
    )`,
    'CREATE INDEX IF NOT EXISTS flags_open ON flags(resolved_at, created_at)',
    `CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'info',
      audience TEXT NOT NULL DEFAULT 'all',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS admin_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
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
