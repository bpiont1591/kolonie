import * as P from './progression.js';
// Wspólne operacje gry na bazie (używane przez trasy): nagrody, śledzenie misji.
import * as R from './rules.js';
import * as Q from './quests.js';
import { dailyPeriod, weeklyPeriod } from './time.js';
import * as TUT from './tutorial.js';
import * as S from './season.js';
import { seasonId } from './time.js';

export class GameError extends Error {}
export const fail = (msg) => { throw new GameError(msg); };

/** Przyznaje nagrodę {metal, crystal, energy, xp, core}. Zwraca nagrodę z polem levelUp. */
export async function grant(t, u, now, rw) {
  const d = { metal: rw.metal || 0, crystal: rw.crystal || 0, energy: rw.energy || 0 };
  const sets = [], params = [];
  let levelUp = 0;
  if (rw.core) {
    // przed włączeniem doładowania zbieramy magazyn wydobycia, by bonus liczył się dopiero od teraz
    const p = R.pending(u, now);
    for (const k of R.RES_KEYS) d[k] += p[k];
    sets.push('collected_at = ?', 'boost_until = ?');
    params.push(now, Math.max(now, u.boost_until || 0) + Q.CORE.hours * 3600_000 * Math.max(1, Number(rw.core) || 1));
  }
  sets.unshift('metal = metal + ?', 'crystal = crystal + ?', 'energy = energy + ?');
  params.unshift(d.metal, d.crystal, d.energy);
  if (rw.xp) {
    const lv = R.addXp(u.level, u.xp, rw.xp);
    sets.push('level = ?', 'xp = ?');
    params.push(lv.level, lv.xp);
    if (lv.levelsGained) { levelUp = lv.level; sets.push('hp = ?', 'hp_at = ?'); params.push(R.shipStats({ ...u, level: lv.level }).maxHp, now); }
  }
  await t.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, u.id]);
  return { ...rw, levelUp };
}

/** Tekst nagrody do komunikatu (emoji zamieniane w widoku na ikony). */
export function rewardText(rw) {
  const p = [];
  if (rw.metal) p.push(`🔩${rw.metal}`);
  if (rw.crystal) p.push(`💎${rw.crystal}`);
  if (rw.energy) p.push(`⚡${rw.energy}`);
  if (rw.xp) p.push(`+${rw.xp} XP`);
  if (rw.core) p.push(`${Q.CORE.name}${rw.core > 1 ? ` ×${rw.core}` : ''} (${Q.CORE.desc})`);
  if (rw.levelUp) p.push(`awans na poziom ${rw.levelUp}!`);
  return p.join(' ');
}

const UPSERT = `INSERT INTO quest_progress (user_id, period, quest_id, progress) VALUES (?, ?, ?, ?)
  ON CONFLICT (user_id, period, quest_id) DO UPDATE SET progress = quest_progress.progress + excluded.progress`;
/** Zdarzenia gry -> postęp misji (dziennych i tygodniowych). events: { win: 1, metal: 120, ... } */
export async function track(t, userId, now, events) {
  const dp = dailyPeriod(now), wp = weeklyPeriod(now);
  await seasonXp(t, userId, now, S.xpFor(events));
  for (const [ev, amt] of Object.entries(events)) {
    if (!amt || amt <= 0) continue;
    const ts = TUT.stepForEvent(ev);
    if (ts) await t.run('UPDATE users SET tut_done = 1 WHERE id = ? AND tut_step = ? AND tut_done = 0', [userId, ts]);
    for (const q of Q.dailyQuests(now)) if (q.ev === ev) await t.run(UPSERT, [userId, dp, q.id, Math.round(amt)]);
    for (const q of Q.WEEKLY) if (q.ev === ev) await t.run(UPSERT, [userId, wp, q.id, Math.round(amt)]);
  }
}
/** Dodaje XP sezonu (ranking miesięczny + przepustka). */
export async function seasonXp(t, userId, now, amount) {
  if (!(amount > 0)) return;
  await t.run(`INSERT INTO season_stats (season, user_id, xp) VALUES (?, ?, ?)
    ON CONFLICT (season, user_id) DO UPDATE SET xp = season_stats.xp + excluded.xp`, [seasonId(now), userId, Math.round(amount)]);
}
export const addPoints = (t, userId, now, pts) => t.run(UPSERT, [userId, weeklyPeriod(now), '_pts', pts]);

/** Pełny stan misji gracza. */
export async function questState(db, u, now) {
  const dp = dailyPeriod(now), wp = weeklyPeriod(now);
  const rows = await db.all('SELECT period, quest_id, progress, claimed FROM quest_progress WHERE user_id = ? AND period IN (?, ?)', [u.id, dp, wp]);
  const get = (p, id) => rows.find((r) => r.period === p && r.quest_id === id) || { progress: 0, claimed: 0 };
  const mk = (q, p) => { const r = get(p, q.id); return { ...q, r: Q.scale(q.r, u.level), progress: Math.min(q.goal, r.progress), claimed: !!r.claimed, done: r.progress >= q.goal }; };
  const daily = Q.dailyQuests(now).map((q) => mk(q, dp));
  const weekly = Q.WEEKLY.map((q) => mk(q, wp));
  const points = get(wp, '_pts').progress;
  const chests = Q.CHESTS.map((c, i) => ({ ...c, n: i + 1, r: Q.scale(c.r, u.level), claimed: !!get(wp, `_chest${i + 1}`).claimed, ready: points >= c.pts }));
  const login = Q.loginState(u, now);
  const claimable = !login.claimedToday + [...daily, ...weekly].filter((q) => q.done && !q.claimed).length + chests.filter((c) => c.ready && !c.claimed).length;
  return { daily, weekly, points, chests, login, claimable };
}
/** Lekki licznik do plakietki na zakładce. */
export async function questBadge(db, u, now) {
  const login = Q.loginState(u, now);
  if (!login.claimedToday) return 1;
  const s = await questState(db, u, now);
  return s.claimable;
}

// ---------- Etap 2: kolejki budowy i ekspedycje (kończone „przy odczycie”, bez crona) ----------
export const isDue = (u, now) => !!((u.bq_id && u.bq_until <= now) || (u.mq_id && u.mq_until <= now) || (u.ex_until && u.ex_until <= now) || (u.rq_id && u.rq_until <= now));
const SETTLE_COLS = ['metal', 'crystal', 'energy', 'collected_at', 'hp', 'hp_at', 'b_mine', 'b_power', 'b_shipyard', 'b_lab',
  's_hull', 's_guns', 's_shields', 'bq_id', 'bq_until', 'mq_id', 'mq_until', 'ex_until', 'level', 'xp', 'boost_until', 'tech', 'rq_id', 'rq_until'];

/** Kończy zaległe budowy/ekspedycje (w kolejności czasu). Zwraca zaktualizowanego gracza i listę zdarzeń. */
export async function settle(t, u, now) {
  if (!isDue(u, now)) return { u, done: [] };
  const evs = [];
  if (u.bq_id && u.bq_until <= now) evs.push(['b', u.bq_until]);
  if (u.mq_id && u.mq_until <= now) evs.push(['m', u.mq_until]);
  if (u.ex_until && u.ex_until <= now) evs.push(['e', u.ex_until]);
  if (u.rq_id && u.rq_until <= now) evs.push(['r', u.rq_until]);
  evs.sort((a, b) => a[1] - b[1]);
  let c = { ...u };
  const done = [];
  const collectAt = (at) => {
    const p = R.pending(c, at);
    c = { ...c, metal: c.metal + p.metal, crystal: c.crystal + p.crystal, energy: c.energy + p.energy, collected_at: Math.max(c.collected_at, at),
      hp: R.currentHp(c, at), hp_at: Math.max(c.hp_at, at) };
  };
  for (const [k, at] of evs) {
    if (k === 'b') {
      const def = R.BUILDINGS[c.bq_id];
      collectAt(at); // produkcja do chwili ukończenia liczona po staremu
      if (def) { c[def.col] += 1; done.push({ kind: 'building', id: c.bq_id, name: def.name, level: c[def.col], at }); }
      c.bq_id = null; c.bq_until = 0;
    } else if (k === 'm') {
      const def = R.MODULES[c.mq_id];
      c.hp = R.currentHp(c, at); c.hp_at = Math.max(c.hp_at, at);
      if (def) { c[def.col] += 1; if (c.mq_id === 'hull') c.hp += 40; done.push({ kind: 'module', id: c.mq_id, name: def.name, level: c[def.col], at }); }
      c.mq_id = null; c.mq_until = 0;
    } else if (k === 'r') {
      const n = P.TECH_BY_ID[c.rq_id];
      collectAt(at); // bonusy technologii (np. wydobycie) liczą się od chwili ukończenia badań
      if (n && !P.techList(c).includes(n.id)) { c.tech = [...P.techList(c), n.id].join(','); done.push({ kind: 'research', id: n.id, name: n.name, at }); }
      c.rq_id = null; c.rq_until = 0;
    } else {
      const ex = await t.get("SELECT * FROM expeditions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [c.id]);
      c.ex_until = 0;
      if (!ex) continue;
      const kind = R.EXPEDITIONS[ex.kind] || R.EXPEDITIONS.zwiad;
      const res = R.expeditionResult(kind, c.level, R.labBonus(c) * R.lootMult(c, 'expLoot') * (1 + (Number(ex.bonus) || 0) / 100));
      collectAt(at);
      const maxHp = R.shipStats(c).maxHp;
      c.hp = Math.max(1, Math.round(c.hp - res.dmg * maxHp)); c.hp_at = Math.max(c.hp_at, at);
      c.metal += res.loot.metal; c.crystal += res.loot.crystal; c.energy += res.loot.energy;
      const lv = R.addXp(c.level, c.xp, res.loot.xp);
      if (lv.levelsGained) { c.hp = R.shipStats({ ...c, level: lv.level }).maxHp; res.levelUp = lv.level; }
      c.level = lv.level; c.xp = lv.xp;
      if (res.loot.core) c.boost_until = Math.max(at, c.boost_until || 0) + Q.CORE.hours * 3600_000;
      await t.run("UPDATE expeditions SET status = 'done', result = ? WHERE id = ?", [JSON.stringify(res), ex.id]);
      done.push({ kind: 'expedition', id: ex.id, name: kind.name, at, title: res.title });
    }
  }
  await t.run(`UPDATE users SET ${SETTLE_COLS.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...SETTLE_COLS.map((k) => c[k]), c.id]);
  return { u: c, done };
}

// ---------- Etap 3: bonusy korporacji, punkty wojenne ----------
import * as C from './corp.js';
import { weekStart } from './time.js';
const winnerCache = new Map(); // tydzień (zakończony) -> zwycięzca
export async function weekWinner(db, week) {
  if (winnerCache.has(week)) return winnerCache.get(week);
  const w = C.winner(await db.all('SELECT planet, corp_id, points FROM war_points WHERE week = ? AND points > 0', [week]));
  winnerCache.set(week, w);
  if (winnerCache.size > 20) winnerCache.delete(winnerCache.keys().next().value);
  return w;
}
/** Dokleja do gracza bonusy korporacji (_prodBonus, _xpBonus, _corp). */
export async function augment(db, u, now) {
  if (!u) return u;
  u._prodBonus = 0; u._xpBonus = 0; u._corp = null;
  if (!u.corp_id) return u;
  const c = await db.get('SELECT * FROM corps WHERE id = ?', [u.corp_id]);
  if (!c) return u;
  const w = await weekWinner(db, weekStart(now) - 7);
  u._corp = c; u._warWinner = !!(w && w.corp_id === c.id);
  u._prodBonus = C.refineryBonus(c) + (u._warWinner ? C.WAR_WIN_BONUS : 0);
  u._xpBonus = C.xpBonus(c);
  return u;
}
/** Punkty wojenne za aktywność członka (na planetę-cel korporacji). */
export async function warPoints(t, u, now, pts) {
  if (!u.corp_id || !pts) return;
  const c = u._corp || await t.get('SELECT war_target FROM corps WHERE id = ?', [u.corp_id]);
  const week = weekStart(now), planet = c?.war_target || 4;
  await t.run(`INSERT INTO war_points (week, corp_id, planet, points) VALUES (?, ?, ?, ?)
    ON CONFLICT (week, corp_id, planet) DO UPDATE SET points = war_points.points + excluded.points`, [week, u.corp_id, planet, pts]);
  await t.run(`INSERT INTO war_contrib (week, user_id, corp_id, points) VALUES (?, ?, ?, ?)
    ON CONFLICT (week, user_id, corp_id) DO UPDATE SET points = war_contrib.points + excluded.points`, [week, u.id, u.corp_id, pts]);
}
export const corpLog = (t, corpId, now, text) => t.run('INSERT INTO corp_log (corp_id, created_at, text) VALUES (?, ?, ?)', [corpId, now, text]);
