// Wspólne operacje gry na bazie (używane przez trasy): nagrody, śledzenie misji.
import * as R from './rules.js';
import * as Q from './quests.js';
import { dailyPeriod, weeklyPeriod } from './time.js';

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
    params.push(now, Math.max(now, u.boost_until || 0) + Q.CORE.hours * 3600_000);
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
  if (rw.core) p.push(`${Q.CORE.name} (${Q.CORE.desc})`);
  if (rw.levelUp) p.push(`awans na poziom ${rw.levelUp}!`);
  return p.join(' ');
}

const UPSERT = `INSERT INTO quest_progress (user_id, period, quest_id, progress) VALUES (?, ?, ?, ?)
  ON CONFLICT (user_id, period, quest_id) DO UPDATE SET progress = quest_progress.progress + excluded.progress`;
/** Zdarzenia gry -> postęp misji (dziennych i tygodniowych). events: { win: 1, metal: 120, ... } */
export async function track(t, userId, now, events) {
  const dp = dailyPeriod(now), wp = weeklyPeriod(now);
  for (const [ev, amt] of Object.entries(events)) {
    if (!amt || amt <= 0) continue;
    for (const q of Q.dailyQuests(now)) if (q.ev === ev) await t.run(UPSERT, [userId, dp, q.id, Math.round(amt)]);
    for (const q of Q.WEEKLY) if (q.ev === ev) await t.run(UPSERT, [userId, wp, q.id, Math.round(amt)]);
  }
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
