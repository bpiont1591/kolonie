// Etap v5/5: panel administratora – statystyki, gracze, bany, flagi multikont/botów, ogłoszenia.
import * as AD from '../admin.js';
import { adminTokenOk, linkedAccounts } from '../security.js';
import * as VA from '../views-admin.js';

const DAY = 86400_000;
export const stats = { blockedPosts: 0, honeypot: 0, regLimit: 0 }; // liczniki od startu serwera

/** Zgłoszenie do przeglądu (multikonto, bot, limit rejestracji). */
export async function addFlag(q, userId, kind, detail, now = Date.now()) {
  if (userId && await q.get('SELECT id FROM flags WHERE user_id = ? AND kind = ? AND resolved_at = 0', [userId, kind])) return;
  await q.run('INSERT INTO flags (user_id, kind, detail, created_at) VALUES (?, ?, ?, ?)', [userId || null, kind, String(detail).slice(0, 300), now]);
}
/** Sprawdza powiązania konta (wspólne IP/urządzenie) i zgłasza je do przeglądu. */
export async function flagIfLinked(db, userId, now = Date.now()) {
  const l = await linkedAccounts(db, userId, now);
  if (!l.length) return 0;
  const u = await db.get('SELECT is_test FROM users WHERE id = ?', [userId]);
  const txt = l.slice(0, 8).map((x) => `${x.username}${x.same_device ? ' (urządzenie)' : ' (IP)'}`).join(', ');
  await addFlag(db, userId, 'multi', `${u?.is_test ? '[test] ' : ''}Wspólne IP/urządzenie z: ${txt}${l.length > 8 ? ` i ${l.length - 8} innymi` : ''}`, now);
  return l.length;
}

let annCache = { at: 0, rows: [] };
export async function activeAnnouncements(db, u, now = Date.now()) {
  if (now - annCache.at > 20_000) annCache = { at: now, rows: await db.all('SELECT id, text, kind, audience, created_at FROM announcements WHERE active = 1 AND expires_at > ? ORDER BY id DESC LIMIT 3', [now]) };
  return annCache.rows.filter((a) => a.audience === 'all' || (a.audience === 'test' && u?.is_test));
}
const resetAnn = () => { annCache.at = 0; };

export default function registerAdmin({ app, db, auth, page, respond, wantsJson }) {
  const guard = (req, res, next) => {
    const viaToken = adminTokenOk(req.get('x-admin-token'));
    if (req.user && (AD.isAdmin(req.user) || viaToken)) { req.adminName = req.user.username; return next(); }
    if (wantsJson(req)) return res.status(404).json({ ok: false, msg: 'Nie znaleziono.' });
    res.status(404).send('Nie znaleziono.');
  };
  const log = (who, action, target, now = Date.now()) => db.run('INSERT INTO admin_log (admin, action, target, created_at) VALUES (?, ?, ?, ?)', [who, action, String(target).slice(0, 200), now]);
  const act = (redirect, fn) => async (req, res, next) => {
    try {
      const out = await fn(req, Date.now());
      respond(req, res, { ok: out.ok !== false, msg: out.msg, redirect: out.redirect || redirect, data: out.data });
    } catch (e) { next(e); }
  };
  const getStats = async (now) => {
    const n = async (sql, p = []) => Number((await db.get(sql, p)).n);
    const real = 'is_test = 0';
    const days = await db.all(`SELECT created_at FROM users WHERE ${real} AND created_at > ?`, [now - 14 * DAY]);
    const perDay = Array.from({ length: 14 }, (_, i) => {
      const from = now - (14 - i) * DAY;
      return { from, n: days.filter((d) => d.created_at > from && d.created_at <= from + DAY).length };
    });
    return {
      players: await n(`SELECT COUNT(*) AS n FROM users WHERE ${real}`),
      new24: await n(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND created_at > ?`, [now - DAY]),
      new7: await n(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND created_at > ?`, [now - 7 * DAY]),
      active24: await n(`SELECT COUNT(DISTINCT p.user_id) AS n FROM user_ips p JOIN users u ON u.id = p.user_id WHERE u.${real} AND p.last_at > ?`, [now - DAY]),
      battles24: await n('SELECT COUNT(*) AS n FROM battles WHERE created_at > ?', [now - DAY]),
      chat24: await n('SELECT COUNT(*) AS n FROM chat_messages WHERE created_at > ?', [now - DAY]),
      trades24: await n("SELECT COUNT(*) AS n FROM market_offers WHERE status = 'sold' AND closed_at > ?", [now - DAY]),
      openOffers: await n("SELECT COUNT(*) AS n FROM market_offers WHERE status = 'open'"),
      corps: await n('SELECT COUNT(*) AS n FROM corps'),
      tournaments: await n("SELECT COUNT(*) AS n FROM arena_tournaments WHERE status = 'done'"),
      banned: await n('SELECT COUNT(*) AS n FROM users WHERE banned_until > ?', [now]),
      flags: await n('SELECT COUNT(*) AS n FROM flags WHERE resolved_at = 0'),
      ...stats, perDay,
    };
  };
  const openFlags = () => db.all(`SELECT f.*, u.username, u.banned_until FROM flags f LEFT JOIN users u ON u.id = f.user_id
    WHERE f.resolved_at = 0 ORDER BY f.id DESC LIMIT 50`);

  app.get('/admin', auth, guard, page(async (req, now, st) => {
    const q = String(req.query.q || '').trim().slice(0, 30);
    const players = q
      ? await db.all('SELECT id, username, level, created_at, banned_until, role, is_test FROM users WHERE name_key LIKE ? ORDER BY level DESC LIMIT 30', [`%${q.toLowerCase().replace(/[%_]/g, '')}%`])
      : await db.all('SELECT id, username, level, created_at, banned_until, role, is_test FROM users ORDER BY id DESC LIMIT 15');
    const anns = await db.all('SELECT * FROM announcements ORDER BY id DESC LIMIT 10');
    const logs = await db.all('SELECT * FROM admin_log ORDER BY id DESC LIMIT 15');
    return VA.panel({ user: req.user, st, flash: req.flash, s: await getStats(now), flags: await openFlags(), players, q, anns, logs, now });
  }));
  app.get('/admin/gracz/:id', auth, guard, page(async (req, now, st) => {
    const p = await db.get('SELECT * FROM users WHERE id = ?', [Number(req.params.id) || 0]);
    if (!p) return null;
    const linkedTo = await linkedAccounts(db, p.id, now);
    const fl = await db.all('SELECT * FROM flags WHERE user_id = ? ORDER BY id DESC LIMIT 20', [p.id]);
    const seen = await db.get('SELECT COUNT(DISTINCT ip_hash) AS ips, COUNT(DISTINCT device) AS devs, MAX(last_at) AS last FROM user_ips WHERE user_id = ?', [p.id]);
    return VA.player({ user: req.user, st, flash: req.flash, p, linkedTo, fl, seen, envAdmin: AD.adminList().has(p.name_key), now });
  }));
  app.get('/admin/api/statystyki', auth, guard, async (req, res, next) => { try { res.json({ ok: true, ...(await getStats(Date.now())) }); } catch (e) { next(e); } });
  app.get('/admin/api/flagi', auth, guard, async (req, res, next) => {
    try { res.json({ ok: true, flags: (await openFlags()).map((f) => ({ id: Number(f.id), userId: f.user_id ? Number(f.user_id) : null, username: f.username || null, kind: f.kind, detail: f.detail })) }); } catch (e) { next(e); }
  });

  app.post('/admin/ban/:id', auth, guard, act('/admin', async (req, now) => {
    const p = await db.get('SELECT * FROM users WHERE id = ?', [Number(req.params.id) || 0]);
    if (!p) return { ok: false, msg: 'Nie ma takiego gracza.' };
    if (p.id === req.user.id) return { ok: false, msg: 'Nie możesz zbanować samego siebie.', redirect: `/admin/gracz/${p.id}` };
    if (AD.isAdmin(p)) return { ok: false, msg: 'Nie można zbanować administratora.', redirect: `/admin/gracz/${p.id}` };
    const days = Number(req.body.days);
    const until = AD.BAN_DAYS.includes(days) && days > 0 ? now + days * DAY : AD.PERMANENT;
    const reason = String(req.body.reason || '').trim().slice(0, 200) || 'Naruszenie zasad gry';
    await db.tx(async (t) => {
      await t.run('UPDATE users SET banned_until = ?, ban_reason = ? WHERE id = ?', [until, reason, p.id]);
      await t.run('DELETE FROM sessions WHERE user_id = ?', [p.id]);
      await t.run("UPDATE market_offers SET status = 'cancelled', closed_at = ? WHERE seller_id = ? AND status = 'open'", [now, p.id]);
      await t.run('DELETE FROM arena_entries WHERE user_id = ?', [p.id]);
    });
    await log(req.adminName, 'ban', `${p.username} (${until === AD.PERMANENT ? 'na stałe' : `${days} d`}): ${reason}`, now);
    return { msg: `Zbanowano ${p.username} ${until === AD.PERMANENT ? 'na stałe' : `na ${days} d`}.`, redirect: `/admin/gracz/${p.id}`, data: { until } };
  }));
  app.post('/admin/odbanuj/:id', auth, guard, act('/admin', async (req, now) => {
    const p = await db.get('SELECT id, username FROM users WHERE id = ?', [Number(req.params.id) || 0]);
    if (!p) return { ok: false, msg: 'Nie ma takiego gracza.' };
    await db.run("UPDATE users SET banned_until = 0, ban_reason = '' WHERE id = ?", [p.id]);
    await log(req.adminName, 'unban', p.username, now);
    return { msg: `Odblokowano ${p.username}.`, redirect: `/admin/gracz/${p.id}` };
  }));
  app.post('/admin/rola/:id', auth, guard, act('/admin', async (req, now) => {
    const p = await db.get('SELECT id, username FROM users WHERE id = ?', [Number(req.params.id) || 0]);
    if (!p) return { ok: false, msg: 'Nie ma takiego gracza.' };
    const role = req.body.role === 'admin' ? 'admin' : '';
    await db.run('UPDATE users SET role = ? WHERE id = ?', [role, p.id]);
    await log(req.adminName, role ? 'grant_admin' : 'revoke_admin', p.username, now);
    return { msg: role ? `${p.username} jest teraz administratorem.` : `Odebrano rolę administratora: ${p.username}.`, redirect: `/admin/gracz/${p.id}` };
  }));
  app.post('/admin/flaga/:id/ok', auth, guard, act('/admin', async (req, now) => {
    const r = await db.run('UPDATE flags SET resolved_at = ?, resolved_by = ? WHERE id = ? AND resolved_at = 0', [now, req.adminName, Number(req.params.id) || 0]);
    if (!r.changes) return { ok: false, msg: 'Zgłoszenie już rozpatrzone.' };
    await log(req.adminName, 'flag_ok', `#${req.params.id}`, now);
    return { msg: 'Zgłoszenie oznaczone jako sprawdzone.' };
  }));
  app.post('/admin/ogloszenie', auth, guard, act('/admin', async (req, now) => {
    const text = String(req.body.text || '').trim().slice(0, 280);
    if (text.length < 3) return { ok: false, msg: 'Treść ogłoszenia jest za krótka.' };
    const kind = AD.ANN_KINDS[req.body.kind] ? req.body.kind : 'info';
    const hours = Math.min(24 * 30, Math.max(1, Number(req.body.hours) || 24));
    const audience = req.body.audience === 'test' || req.user.is_test ? 'test' : 'all';
    const id = await db.insert('INSERT INTO announcements (text, kind, audience, created_at, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?)', [text, kind, audience, now, now + hours * 3600_000, req.adminName]);
    resetAnn();
    await log(req.adminName, 'announce', `${audience === 'test' ? '[test] ' : ''}${text}`, now);
    return { msg: 'Ogłoszenie opublikowane.', data: { id } };
  }));
  app.post('/admin/ogloszenie/:id/wylacz', auth, guard, act('/admin', async (req, now) => {
    await db.run('UPDATE announcements SET active = 0 WHERE id = ?', [Number(req.params.id) || 0]);
    resetAnn();
    await log(req.adminName, 'announce_off', `#${req.params.id}`, now);
    return { msg: 'Ogłoszenie wyłączone.' };
  }));
}
