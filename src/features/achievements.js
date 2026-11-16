// Etap v5/3: osiągnięcia (automatyczne odblokowanie + nagroda) i wybór tytułu przy nicku.
import * as A from '../achievements.js';
import * as G from '../game.js';
import * as TUT from '../tutorial.js';
import { fail } from '../game.js';
import * as VA from '../views-arena.js';

/** Statystyki potrzebne do osiągnięć. */
export async function achStats(q, u) {
  const ex = await q.get("SELECT COUNT(*) AS n FROM expeditions WHERE user_id = ? AND status = 'done'", [u.id]);
  const boss = await q.get('SELECT COALESCE(SUM(attacks), 0) AS n FROM boss_hits WHERE user_id = ?', [u.id]);
  const ar = await q.get('SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN place = 1 THEN 1 ELSE 0 END), 0) AS w FROM arena_results WHERE user_id = ?', [u.id]);
  const pass = await q.get("SELECT COUNT(*) AS n FROM user_badges WHERE user_id = ? AND badge = 'pass'", [u.id]);
  return {
    tutDone: u.tut_step === TUT.FINISHED ? 1 : 0, pve: u.pve_wins, pvp: u.pvp_wins, mine: u.b_mine,
    minB: Math.min(u.b_mine, u.b_power, u.b_shipyard, u.b_lab), expeditions: Number(ex.n), level: u.level, corp: u.corp_id ? 1 : 0,
    boss: Number(boss.n), arena: Number(ar.n), arenaWins: Number(ar.w), streak: u.login_streak, pass: Number(pass.n) ? 1 : 0,
  };
}
export const ownedSet = async (q, userId) => new Set((await q.all('SELECT ach FROM user_achievements WHERE user_id = ?', [userId])).map((r) => r.ach));

/** Sprawdza i odblokowuje nowe osiągnięcia (w transakcji). Zwraca listę odblokowanych. */
export async function checkAchievements(t, userId, now) {
  let u = await t.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!u) return [];
  const fresh = A.newlyEarned(await achStats(t, u), await ownedSet(t, userId));
  const out = [];
  for (const a of fresh) {
    const ins = await t.run('INSERT INTO user_achievements (user_id, ach, created_at) VALUES (?, ?, ?) ON CONFLICT (user_id, ach) DO NOTHING', [userId, a.id, now]);
    if (!ins.changes) continue;
    const rw = await G.grant(t, u, now, a.r);
    u = await t.get('SELECT * FROM users WHERE id = ?', [userId]);
    out.push({ id: a.id, name: a.name, title: a.title || '', reward: rw });
  }
  return out;
}
export const achText = (list) => list.map((a) => `Osiągnięcie „${a.name}”: ${G.rewardText(a.reward)}${a.title ? ` (tytuł: ${a.title})` : ''}`).join(' · ');

export default function registerAchievements({ app, db, auth, page, action }) {
  app.get('/osiagniecia', auth, page(async (req, now, st) => {
    const fresh = await db.tx((t) => checkAchievements(t, req.user.id, now));
    const u = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const s = await achStats(db, u);
    const owned = new Map((await db.all('SELECT ach, created_at FROM user_achievements WHERE user_id = ?', [u.id])).map((r) => [r.ach, Number(r.created_at)]));
    const flash = req.flash || (fresh.length ? { ok: true, msg: achText(fresh) } : null);
    return VA.achievements({ user: u, st, flash, s, owned, now });
  }));
  app.get('/api/osiagniecia', auth, async (req, res, next) => {
    try {
      const owned = await ownedSet(db, req.user.id);
      res.json({ ok: true, title: req.user.title || '', titleText: A.titleOf(req.user.title), count: A.COUNT,
        unlocked: [...owned], list: A.LIST.map((a) => ({ id: a.id, name: a.name, desc: a.desc, title: a.title || '', goal: a.goal })) });
    } catch (e) { next(e); }
  });
  app.post('/osiagniecia/tytul/:id', auth, action('/osiagniecia', async (t, u, now, req) => {
    const id = String(req.params.id);
    if (id === 'brak') {
      await t.run("UPDATE users SET title = '' WHERE id = ?", [u.id]);
      return { msg: 'Tytuł zdjęty.', data: { title: '' } };
    }
    const a = A.BY_ID[id];
    if (!a || !a.title) fail('Nieznany tytuł.');
    if (!(await t.get('SELECT ach FROM user_achievements WHERE user_id = ? AND ach = ?', [u.id, id]))) fail(`Najpierw zdobądź osiągnięcie „${a.name}”.`);
    await t.run('UPDATE users SET title = ? WHERE id = ?', [id, u.id]);
    return { msg: `Nowy tytuł: ${a.title}.`, data: { title: id, titleText: a.title } };
  }));
}
