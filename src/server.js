import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createDb } from './db.js';
import * as R from './rules.js';
import * as V from './views.js';
import * as G from './game.js';
import { GameError, fail } from './game.js';
import registerMissions from './features/missions.js';
import registerExpeditions from './features/expeditions.js';
import { dur } from './time.js';
import * as C from './corp.js';
import registerCorp from './features/corp.js';

const scrypt = promisify(crypto.scrypt);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3100;
const SESSION_DAYS = 30;
const db = await createDb({ url: process.env.DATABASE_URL, file: process.env.DB_FILE || path.join(ROOT, 'data', 'kolonie.db') });


// ---------- auth helpers ----------
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
async function verifyPassword(pw, stored) {
  const [alg, s, k] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const key = await scrypt(pw, Buffer.from(s, 'base64'), 64);
  const exp = Buffer.from(k, 'base64');
  return exp.length === key.length && crypto.timingSafeEqual(exp, key);
}
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore */ }
  }
  return out;
}
const secure = process.env.COOKIE_SECURE === '1' || process.env.RENDER ? '; Secure' : '';
const setCookie = (res, name, val, maxAgeSec) =>
  res.append('Set-Cookie', `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`);
async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [sha(token), userId, Date.now() + SESSION_DAYS * 86400_000]);
  setCookie(res, 'sid', token, SESSION_DAYS * 86400);
}

// prosty limiter prób logowania
const attempts = new Map();
function rateLimited(key) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < 10 * 60_000);
  a.push(now);
  attempts.set(key, a);
  return a.length > 20;
}

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' || process.env.RENDER ? 1 : 'loopback');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" });
  next();
});
app.get('/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(ROOT, 'public', 'sw.js')); });
for (const d of ['img', 'fonts']) app.use(`/${d}`, express.static(path.join(ROOT, 'public', d), { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(ROOT, 'public'), { maxAge: '1h' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));

// Ochrona CSRF: ciasteczka SameSite=Lax + sprawdzenie nagłówka Origin dla POST.
app.use((req, res, next) => {
  if (req.method === 'POST' && req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).send('Zły Origin'); }
    catch { return res.status(403).send('Zły Origin'); }
  }
  next();
});

app.use(async (req, res, next) => {
  try {
    req.cookiesObj = parseCookies(req);
    const sid = req.cookiesObj.sid;
    if (sid) {
      const s = await db.get('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?', [sha(sid)]);
      if (s && s.expires_at > Date.now()) req.user = await db.get('SELECT * FROM users WHERE id = ?', [s.user_id]);
      // kończenie zaległych budów/ekspedycji przy odczycie (bez crona)
      if (req.user) await G.augment(db, req.user, Date.now());
      if (req.user && G.isDue(req.user, Date.now())) {
        const done = await db.tx(async (t) => (await G.settle(t, await G.augment(t, await t.get('SELECT * FROM users WHERE id = ?', [s.user_id]), Date.now()), Date.now())).done);
        req.user = await G.augment(db, await db.get('SELECT * FROM users WHERE id = ?', [s.user_id]), Date.now());
        onSettled(req.user, done);
      }
    }
    if (req.cookiesObj.flash) {
      try { req.flash = JSON.parse(req.cookiesObj.flash); } catch { /* ignore */ }
      res.append('Set-Cookie', 'flash=; Path=/; Max-Age=0');
    }
    next();
  } catch (e) { next(e); }
});

const devHooks = [];
const settledHooks = []; // powiadomienia o zakończonych budowach/ekspedycjach (etap 4)
const onSettled = (u, done) => { for (const h of settledHooks) Promise.resolve(h(u, done)).catch((e) => console.error('settledHook', e.message)); }; // dodatkowe przewijanie czasu z modułów
const wantsJson = (req) => (req.get('accept') || '').includes('application/json');
function respond(req, res, { ok, msg, redirect, data = {} }) {
  if (wantsJson(req)) return res.status(ok ? 200 : 400).json({ ok, msg, ...data });
  setCookie(res, 'flash', JSON.stringify({ ok, msg }), 30);
  res.redirect(303, redirect);
}
const auth = (req, res, next) => {
  if (req.user) return next();
  if (wantsJson(req)) return res.status(401).json({ ok: false, msg: 'Zaloguj się.' });
  res.redirect(303, '/');
};
const page = (fn) => async (req, res, next) => {
  try {
    const now = Date.now();
    let st;
    if (req.user) { st = V.state(req.user, now); st.badges = { misje: await G.questBadge(db, req.user, now) }; }
    const html = await fn(req, now, st);
    if (html === null) return res.status(404).send(V.notFound({ user: req.user, st: V.state(req.user, now) }));
    res.set('Cache-Control', 'no-store').send(html);
  } catch (e) { next(e); }
};
/** Akcja gry: atomowa transakcja na świeżo wczytanym graczu. */
const action = (redirect, fn) => async (req, res, next) => {
  try {
    const out = await db.tx(async (t) => {
      const now = Date.now();
      const sres = await G.settle(t, await G.augment(t, await t.get('SELECT * FROM users WHERE id = ?', [req.user.id]), now), now);
      if (sres.done.length) onSettled(sres.u, sres.done);
      return fn(t, sres.u, now, req);
    });
    respond(req, res, { ok: true, msg: out.msg, redirect: out.redirect || redirect, data: out.data });
  } catch (e) {
    if (e instanceof GameError) return respond(req, res, { ok: false, msg: e.message, redirect });
    next(e);
  }
};

// Ujednolicenie stanu: zbiera surowce z magazynu wydobycia i utrwala aktualne HP.
function materialize(u, now) {
  const p = R.pending(u, now);
  return { metal: u.metal + p.metal, crystal: u.crystal + p.crystal, energy: u.energy + p.energy, hp: R.currentHp(u, now), collected: p };
}
const payable = (have, c) => R.RES_KEYS.every((k) => have[k] >= c[k]);
const costText = (c) => R.RES_KEYS.filter((k) => c[k]).map((k) => `${R.RESOURCES[k].icon}${c[k]}`).join(' ');

// ---------- strony publiczne ----------
app.get('/', page(async (req, now) => {
  if (req.user) return '<meta http-equiv="refresh" content="0;url=/kolonia">';
  const players = (await db.get('SELECT COUNT(*) AS n FROM users')).n;
  const online = (await db.get('SELECT COUNT(*) AS n FROM users WHERE collected_at > ? OR last_battle_at > ?', [now - 3600_000, now - 3600_000])).n;
  const battles24 = (await db.get('SELECT COUNT(*) AS n FROM battles WHERE created_at > ?', [now - 86400_000])).n;
  const top = await db.all(`SELECT u.username, u.level, c.tag FROM users u LEFT JOIN corps c ON c.id = u.corp_id
    ORDER BY u.level DESC, u.xp DESC, u.id ASC LIMIT 5`);
  const baseUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
  return V.landing({ players, online, battles24, top, flash: req.flash, baseUrl });
}));

const NAME_RE = /^[\p{L}\p{N}_-]{3,16}$/u;
app.post('/rejestracja', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!NAME_RE.test(username)) return respond(req, res, { ok: false, msg: 'Nazwa: 3–16 znaków (litery, cyfry, _ lub -).', redirect: '/' });
    if (password.length < 6 || password.length > 200) return respond(req, res, { ok: false, msg: 'Hasło musi mieć co najmniej 6 znaków.', redirect: '/' });
    if (rateLimited('reg:' + req.ip)) return respond(req, res, { ok: false, msg: 'Za dużo prób. Spróbuj później.', redirect: '/' });
    const hash = await hashPassword(password);
    const now = Date.now();
    const planet = R.PLANETS[crypto.randomInt(R.PLANETS.length)];
    const base = { s_hull: 1, s_guns: 1, s_shields: 1, level: 1 };
    const id = await db.tx(async (t) => {
      if (await t.get('SELECT id FROM users WHERE name_key = ?', [username.toLowerCase()])) fail('Ta nazwa jest już zajęta.');
      const id = await t.insert(`INSERT INTO users (username, name_key, pass_hash, planet, created_at, metal, crystal, energy, collected_at, hp, hp_at)
        VALUES (?, ?, ?, ?, ?, 400, 200, 150, ?, ?, ?)`, [username, username.toLowerCase(), hash, planet, now, now, R.shipStats(base).maxHp, now]);
      return id;
    });
    await startSession(res, id);
    respond(req, res, { ok: true, msg: `Witaj na planecie ${planet}, komandorze ${username}!`, redirect: '/kolonia', data: { userId: id, planet } });
  } catch (e) {
    if (e instanceof GameError) return respond(req, res, { ok: false, msg: e.message, redirect: '/' });
    next(e);
  }
});

app.post('/logowanie', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    if (rateLimited('login:' + req.ip + ':' + username.toLowerCase())) return respond(req, res, { ok: false, msg: 'Za dużo prób. Odczekaj chwilę.', redirect: '/' });
    const u = await db.get('SELECT id, pass_hash FROM users WHERE name_key = ?', [username.toLowerCase()]);
    if (!u || !(await verifyPassword(String(req.body.password || ''), u.pass_hash)))
      return respond(req, res, { ok: false, msg: 'Błędna nazwa lub hasło.', redirect: '/' });
    await startSession(res, u.id);
    respond(req, res, { ok: true, msg: 'Witaj z powrotem, komandorze!', redirect: '/kolonia', data: { userId: u.id } });
  } catch (e) { next(e); }
});

app.post('/wyloguj', async (req, res, next) => {
  try {
    if (req.cookiesObj.sid) await db.tx((t) => t.run('DELETE FROM sessions WHERE token_hash = ?', [sha(req.cookiesObj.sid)]));
    res.append('Set-Cookie', 'sid=; Path=/; Max-Age=0');
    respond(req, res, { ok: true, msg: 'Wylogowano. Do zobaczenia w przestrzeni!', redirect: '/' });
  } catch (e) { next(e); }
});

// ---------- kolonia ----------
app.get('/kolonia', auth, page((req, now, st) => V.colony({ user: req.user, st, flash: req.flash })));

app.get('/api/stan', auth, (req, res) => {
  const now = Date.now();
  const { pass_hash, _corp, ...pub } = req.user;
  res.set('Cache-Control', 'no-store').json({ ok: true, now, user: pub, ...V.state(req.user, now) });
});

app.post('/kolonia/zbierz', auth, action('/kolonia', async (t, u, now) => {
  const p = R.pending(u, now);
  if (p.metal + p.crystal + p.energy <= 0) fail('Magazyn wydobycia jest pusty – daj dronom chwilę.');
  await t.run('UPDATE users SET metal = metal + ?, crystal = crystal + ?, energy = energy + ?, collected_at = ? WHERE id = ?',
    [p.metal, p.crystal, p.energy, now, u.id]);
  await G.track(t, u.id, now, { collect: 1, metal: p.metal });
  return { msg: `Zebrano: 🔩${p.metal} 💎${p.crystal} ⚡${p.energy}`, data: { collected: p } };
}));

app.post('/kolonia/ulepsz/:b', auth, action('/kolonia', async (t, u, now, req) => {
  const def = Object.hasOwn(R.BUILDINGS, req.params.b) ? R.BUILDINGS[req.params.b] : fail('Nieznany budynek.');
  const lvl = u[def.col];
  if (lvl >= R.MAX_LEVEL_BUILDING) fail('Osiągnięto maksymalny poziom.');
  if (u.bq_id) fail(`Trwa już budowa: ${R.BUILDINGS[u.bq_id]?.name}. Poczekaj albo przyspiesz.`);
  const m = materialize(u, now);
  const c = R.upgradeCost(def, lvl);
  if (!payable(m, c)) fail(`Brakuje surowców. Koszt: ${costText(c)}`);
  const secs = R.buildTime(lvl);
  await t.run(`UPDATE users SET metal = ?, crystal = ?, energy = ?, collected_at = ?, hp = ?, hp_at = ?, bq_id = ?, bq_until = ? WHERE id = ?`,
    [m.metal - c.metal, m.crystal - c.crystal, m.energy - c.energy, now, m.hp, now, req.params.b, now + secs * 1000, u.id]);
  await G.track(t, u.id, now, { build: 1, upgrade: 1, metal: m.collected.metal });
  return { msg: `${def.name}: budowa poziomu ${lvl + 1} rozpoczęta (${dur(secs * 1000)}).`, data: { building: req.params.b, level: lvl + 1, cost: c, seconds: secs, until: now + secs * 1000 } };
}));

// ---------- statek ----------
app.get('/statek', auth, page((req, now, st) => V.ship({ user: req.user, st, flash: req.flash })));

app.post('/statek/ulepsz/:m', auth, action('/statek', async (t, u, now, req) => {
  const def = Object.hasOwn(R.MODULES, req.params.m) ? R.MODULES[req.params.m] : fail('Nieznany moduł.');
  const lvl = u[def.col];
  if (lvl >= R.moduleCap(u)) fail('Limit stoczni! Ulepsz stocznię, by rozbudować moduł.');
  if (u.mq_id) fail(`W stoczni trwają już prace: ${R.MODULES[u.mq_id]?.name}. Poczekaj albo przyspiesz.`);
  const c = R.upgradeCost(def, lvl);
  if (!payable(u, c)) fail(`Brakuje surowców w magazynie. Koszt: ${costText(c)}`);
  const secs = R.moduleTime(lvl);
  await t.run('UPDATE users SET metal = metal - ?, crystal = crystal - ?, energy = energy - ?, mq_id = ?, mq_until = ? WHERE id = ?',
    [c.metal, c.crystal, c.energy, req.params.m, now + secs * 1000, u.id]);
  await G.track(t, u.id, now, { module: 1, upgrade: 1 });
  return { msg: `${def.name}: montaż poziomu ${lvl + 1} rozpoczęty (${dur(secs * 1000)}).`, data: { module: req.params.m, level: lvl + 1, seconds: secs, until: now + secs * 1000 } };
}));

// Natychmiastowe ukończenie za kryształy
for (const [path, q, back] of [['/kolonia/przyspiesz', 'bq', '/kolonia'], ['/statek/przyspiesz', 'mq', '/statek']]) {
  app.post(path, auth, action(back, async (t, u, now) => {
    if (!u[`${q}_id`]) fail('Nic się teraz nie buduje.');
    const left = u[`${q}_until`] - now;
    const cost = R.rushCost(left);
    if (u.crystal < cost) fail(`Za mało kryształów (potrzeba 💎${cost}).`);
    await t.run(`UPDATE users SET crystal = crystal - ?, ${q}_until = ? WHERE id = ?`, [cost, now, u.id]);
    const res = await G.settle(t, { ...u, crystal: u.crystal - cost, [`${q}_until`]: now }, now);
    onSettled(res.u, res.done);
    const d = res.done.find((x) => x.kind === (q === 'bq' ? 'building' : 'module'));
    return { msg: `Ukończono za 💎${cost}: ${d?.name} – poziom ${d?.level}!`, data: { cost, level: d?.level } };
  }));
}

// ---------- bitwy ----------
async function battleTargets(u, now) {
  return db.all(`SELECT u.id, u.username, u.level, u.planet, u.s_hull, u.s_guns, u.s_shields, c.tag
    FROM users u LEFT JOIN corps c ON c.id = u.corp_id
    WHERE u.id != ? AND u.level >= ? AND u.protected_until < ? AND (u.corp_id IS NULL OR u.corp_id != ?)
    ORDER BY ABS(u.level - ?) ASC, u.id DESC LIMIT 10`, [u.id, u.level - 2, now, u.corp_id ?? -1, u.level]);
}

app.get('/bitwa', auth, page(async (req, now, st) => {
  const u = req.user;
  const recent = await db.all(`SELECT b.id, b.kind, b.attacker_id, b.attacker_won, b.enemy_name, b.created_at,
      a.username AS attacker_name, d.username AS defender_name
    FROM battles b JOIN users a ON a.id = b.attacker_id LEFT JOIN users d ON d.id = b.defender_id
    WHERE b.attacker_id = ? OR b.defender_id = ? ORDER BY b.id DESC LIMIT 10`, [u.id, u.id]);
  return V.battle({ user: u, st, flash: req.flash, targets: await battleTargets(u, now), recent, now });
}));

app.get('/bitwa/:id', auth, page(async (req, now, st) => {
  const b = await db.get(`SELECT b.*, a.username AS attacker_name, d.username AS defender_name
    FROM battles b JOIN users a ON a.id = b.attacker_id LEFT JOIN users d ON d.id = b.defender_id WHERE b.id = ?`, [Number(req.params.id) || 0]);
  if (!b || (b.attacker_id !== req.user.id && b.defender_id !== req.user.id)) return null;
  return V.battleLog({ user: req.user, st, flash: req.flash, b, now });
}));

function preBattle(u, now, energyCost) {
  if (u.ex_until > now) fail(`Statek jest na ekspedycji – wróci za ${dur(u.ex_until - now)}.`);
  const ship = R.shipStats(u);
  const hp = R.currentHp(u, now);
  if (now - u.last_battle_at < R.BATTLE_COOLDOWN_MS) fail('Działa się chłodzą – odczekaj kilka sekund.');
  if (hp < ship.maxHp * R.MIN_HP_RATIO) fail(`Statek zbyt uszkodzony (${hp}/${ship.maxHp} HP). Poczekaj na naprawę.`);
  if (u.energy < energyCost) fail(`Za mało energii w magazynie (potrzeba ⚡${energyCost}). Zbierz surowce.`);
  return { name: u.username, hp, maxHp: ship.maxHp, atk: ship.atk, def: ship.def };
}
function xpGain(u, base) { return Math.round(base * (1 + (u._xpBonus ?? (u.corp_id ? R.CORP_XP_BONUS : 0)))); }

app.post('/bitwa/piraci/:tier', auth, action('/bitwa', async (t, u, now, req) => {
  const tier = R.PIRATES.find((p) => p.id === req.params.tier) || fail('Nieznany przeciwnik.');
  if (u.level < tier.minLvl) fail(`Ten cel jest dostępny od poziomu ${tier.minLvl}.`);
  const me = preBattle(u, now, tier.energy);
  const enemy = R.pirate(tier, u.level);
  const sim = R.simulate(me, enemy);
  let reward = { xp: 3, metal: 0, crystal: 0 };
  if (sim.aWon) reward = R.pirateReward(tier, u.level, R.labBonus(u));
  reward.xp = xpGain(u, reward.xp);
  const lv = R.addXp(u.level, u.xp, reward.xp);
  const hp = lv.levelsGained ? R.shipStats({ ...u, level: lv.level }).maxHp : Math.max(1, sim.aHp);
  await t.run(`UPDATE users SET energy = energy - ?, metal = metal + ?, crystal = crystal + ?, level = ?, xp = ?, hp = ?, hp_at = ?,
      last_battle_at = ?, pve_wins = pve_wins + ? WHERE id = ?`,
    [tier.energy, reward.metal, reward.crystal, lv.level, lv.xp, hp, now, now, sim.aWon ? 1 : 0, u.id]);
  const rw = { ...reward, tier: tier.id, levelUp: lv.levelsGained ? lv.level : 0 };
  const battleId = await t.insert(`INSERT INTO battles (created_at, kind, attacker_id, defender_id, enemy_name, attacker_won, log, reward)
    VALUES (?, 'pve', ?, NULL, ?, ?, ?, ?)`, [now, u.id, tier.name, sim.aWon ? 1 : 0, JSON.stringify(sim.log), JSON.stringify(rw)]);
  await G.track(t, u.id, now, { pve: 1, win: sim.aWon ? 1 : 0, energy: tier.energy });
  if (sim.aWon) await G.warPoints(t, u, now, C.WAR_POINTS.pve);
  return { msg: sim.aWon ? `Zwycięstwo! +${reward.xp} XP, 🔩${reward.metal} 💎${reward.crystal}` : 'Porażka – piraci okazali się silniejsi.',
    redirect: `/bitwa/${battleId}`, data: { battleId, won: sim.aWon, reward: rw, rounds: sim.rounds } };
}));

app.post('/bitwa/gracz/:id', auth, action('/bitwa', async (t, u, now, req) => {
  let d = await t.get('SELECT * FROM users WHERE id = ?', [Number(req.params.id) || 0]) || fail('Nie ma takiego gracza.');
  d = (await G.settle(t, d, now)).u;
  if (d.id === u.id) fail('Nie możesz zaatakować samego siebie.');
  if (d.level < u.level - 2) fail('Ten gracz jest za słaby – honor komandora na to nie pozwala.');
  if (d.protected_until > now) fail('Ten gracz jest pod ochroną tarczy planetarnej.');
  if (u.corp_id && d.corp_id === u.corp_id) fail('Nie atakuje się członków własnej korporacji!');
  const me = preBattle(u, now, R.PVP_ENERGY);
  const ds = R.shipStats(d);
  // Obrońca walczy automatycznymi dronami w pełnej sprawności – jego statek nie traci HP.
  const sim = R.simulate(me, { name: d.username, hp: ds.maxHp, maxHp: ds.maxHp, atk: ds.atk, def: ds.def });
  let reward = { xp: 4, metal: 0, crystal: 0 };
  if (sim.aWon) {
    const capLoot = 150 + 75 * u.level;
    reward = { xp: 20 + 6 * d.level, metal: Math.min(capLoot, Math.floor(d.metal * 0.1)), crystal: Math.min(capLoot, Math.floor(d.crystal * 0.1)) };
  }
  reward.xp = xpGain(u, Math.round(reward.xp * (sim.aWon ? R.labBonus(u) : 1)));
  const lv = R.addXp(u.level, u.xp, reward.xp);
  const hp = lv.levelsGained ? R.shipStats({ ...u, level: lv.level }).maxHp : Math.max(1, sim.aHp);
  await t.run(`UPDATE users SET energy = energy - ?, metal = metal + ?, crystal = crystal + ?, level = ?, xp = ?, hp = ?, hp_at = ?,
      last_battle_at = ?, pvp_wins = pvp_wins + ?, pvp_losses = pvp_losses + ?, pvp_points = CASE WHEN pvp_points + ? > 0 THEN pvp_points + ? ELSE 0 END WHERE id = ?`,
    [R.PVP_ENERGY, reward.metal, reward.crystal, lv.level, lv.xp, hp, now, now, sim.aWon ? 1 : 0, sim.aWon ? 0 : 1, sim.aWon ? 10 : -5, sim.aWon ? 10 : -5, u.id]);
  await t.run(`UPDATE users SET metal = metal - ?, crystal = crystal - ?, protected_until = ?,
      pvp_wins = pvp_wins + ?, pvp_losses = pvp_losses + ?, pvp_points = CASE WHEN pvp_points + ? > 0 THEN pvp_points + ? ELSE 0 END WHERE id = ?`,
    [reward.metal, reward.crystal, now + R.PVP_SHIELD_MS, sim.aWon ? 0 : 1, sim.aWon ? 1 : 0, sim.aWon ? -5 : 5, sim.aWon ? -5 : 5, d.id]);
  const rw = { ...reward, levelUp: lv.levelsGained ? lv.level : 0 };
  const battleId = await t.insert(`INSERT INTO battles (created_at, kind, attacker_id, defender_id, enemy_name, attacker_won, log, reward)
    VALUES (?, 'pvp', ?, ?, ?, ?, ?, ?)`, [now, u.id, d.id, d.username, sim.aWon ? 1 : 0, JSON.stringify(sim.log), JSON.stringify(rw)]);
  await G.track(t, u.id, now, { pvp: 1, win: sim.aWon ? 1 : 0, energy: R.PVP_ENERGY });
  if (sim.aWon) await G.warPoints(t, u, now, C.WAR_POINTS.pvp);
  return { msg: sim.aWon ? `Zwycięstwo nad ${d.username}! Łup: 🔩${reward.metal} 💎${reward.crystal}` : `${d.username} odparł Twój atak.`,
    redirect: `/bitwa/${battleId}`, data: { battleId, won: sim.aWon, reward: rw, rounds: sim.rounds } };
}));

// ---------- ranking ----------
async function rankingData(tab, userId) {
  if (tab === 'korporacje') {
    return { rows: await db.all(`SELECT c.id, c.name, c.tag, COUNT(u.id) AS members, COALESCE(SUM(u.level * 100 + u.pvp_points), 0) AS power
      FROM corps c JOIN users u ON u.corp_id = c.id GROUP BY c.id ORDER BY power DESC LIMIT 50`) };
  }
  const order = tab === 'pvp' ? 'u.pvp_points DESC, u.pvp_wins DESC, u.id ASC' : 'u.level DESC, u.xp DESC, u.id ASC';
  const rows = await db.all(`SELECT u.id, u.username, u.level, u.xp, u.pve_wins, u.pvp_wins, u.pvp_losses, u.pvp_points, c.tag
    FROM users u LEFT JOIN corps c ON c.id = u.corp_id ORDER BY ${order} LIMIT 50`);
  const me = await db.get('SELECT level, xp, pvp_points, pvp_wins, id FROM users WHERE id = ?', [userId]);
  const higher = tab === 'pvp'
    ? await db.get('SELECT COUNT(*) AS n FROM users WHERE pvp_points > ? OR (pvp_points = ? AND (pvp_wins > ? OR (pvp_wins = ? AND id < ?)))', [me.pvp_points, me.pvp_points, me.pvp_wins, me.pvp_wins, me.id])
    : await db.get('SELECT COUNT(*) AS n FROM users WHERE level > ? OR (level = ? AND (xp > ? OR (xp = ? AND id < ?)))', [me.level, me.level, me.xp, me.xp, me.id]);
  return { rows, myRank: higher.n + 1 };
}
app.get('/ranking', auth, page(async (req, now, st) => {
  const tab = ['gracze', 'pvp', 'korporacje'].includes(req.query.tab) ? req.query.tab : 'gracze';
  const data = await rankingData(tab, req.user.id);
  return V.ranking({ user: req.user, st, flash: req.flash, tab, ...data });
}));
app.get('/api/ranking', auth, async (req, res, next) => {
  try {
    const tab = ['gracze', 'pvp', 'korporacje'].includes(req.query.tab) ? req.query.tab : 'gracze';
    res.json({ ok: true, tab, ...(await rankingData(tab, req.user.id)) });
  } catch (e) { next(e); }
});

// ---------- moduły funkcji ----------
const ctx = { xpGain, preBattle, settledHooks, devHooks, app, db, auth, page, action, respond, wantsJson, materialize, payable, costText };
registerMissions(ctx);
registerExpeditions(ctx);
registerCorp(ctx);

// ---------- narzędzia testowe (tylko lokalnie: DEV_HOOKS=1, nigdy na Renderze) ----------
if (process.env.DEV_HOOKS === '1' && !process.env.RENDER) {
  console.log('⚠️  DEV_HOOKS włączone – endpointy testowe /api/dev/*');
  // Przesuwa zegar gracza wstecz o N minut (symulacja upływu czasu).
  app.post('/api/dev/przewin', auth, action('/', async (t, u, now, req) => {
    const ms = Math.max(0, Number(req.body.minutes) || 0) * 60_000;
    const days = Math.floor(ms / 86400_000);
    await t.run(`UPDATE users SET collected_at = collected_at - ?, hp_at = hp_at - ?, last_battle_at = last_battle_at - ?,
      protected_until = protected_until - ?, login_day = CASE WHEN login_day > 0 THEN login_day - ? ELSE 0 END WHERE id = ?`, [ms, ms, ms, ms, days, u.id]);
    await t.run(`UPDATE users SET bq_until = CASE WHEN bq_until > 0 THEN bq_until - ? ELSE 0 END, mq_until = CASE WHEN mq_until > 0 THEN mq_until - ? ELSE 0 END,
      ex_until = CASE WHEN ex_until > 0 THEN ex_until - ? ELSE 0 END, boost_until = CASE WHEN boost_until > 0 THEN boost_until - ? ELSE 0 END WHERE id = ?`, [ms, ms, ms, ms, u.id]);
    await t.run("UPDATE expeditions SET started_at = started_at - ?, return_at = return_at - ? WHERE user_id = ? AND status = 'active'", [ms, ms, u.id]);
    for (const h of devHooks) await h(t, u, ms);
    return { msg: 'Przewinięto czas.' };
  }));
  app.post('/api/dev/surowce', auth, action('/', async (t, u) => {
    await t.run('UPDATE users SET metal = metal + 20000, crystal = crystal + 20000, energy = energy + 20000 WHERE id = ?', [u.id]);
    return { msg: 'ok' };
  }));
  app.post('/api/dev/misja', auth, action('/', async (t, u, now, req) => {
    await G.track(t, u.id, now, { [String(req.body.ev)]: Number(req.body.amount) || 1 });
    return { msg: 'ok' };
  }));
}

// ---------- health / 404 / błędy ----------
app.get('/healthz', async (req, res) => { try { await db.get('SELECT 1 AS ok'); res.json({ ok: true, db: db.kind }); } catch { res.status(503).json({ ok: false }); } });

app.use((req, res) => {
  const now = Date.now();
  res.status(404).send(V.notFound({ user: req.user, st: req.user && V.state(req.user, now) }));
});
app.use((err, req, res, _next) => {
  console.error(err);
  if (wantsJson(req)) return res.status(500).json({ ok: false, msg: 'Błąd serwera.' });
  res.status(500).send('Błąd serwera – awaria reaktora. Spróbuj ponownie.');
});

// sprzątanie wygasłych sesji
setInterval(() => db.tx((t) => t.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()])).catch(() => {}), 3600_000).unref();

app.listen(PORT, () => console.log(`🪐 Kolonie działa na http://localhost:${PORT} (baza: ${db.kind}, tempo gry ×${R.SPEED})`));

