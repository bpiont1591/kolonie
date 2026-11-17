// Etap 1: nagrody za codzienne logowanie, misje dzienne i tygodniowe, skrzynie tygodniowe.
import * as Q from '../quests.js';
import * as S from '../season.js';
import * as G from '../game.js';
import { fail } from '../game.js';
import { dailyPeriod, weeklyPeriod, msToMidnight, msToWeekEnd } from '../time.js';
import * as V from '../views.js';
import { passState } from './season.js';

export default function registerMissions({ app, db, auth, page, action }) {
  app.get('/misje', auth, page(async (req, now, st) => {
    const qs = await G.questState(db, req.user, now);
    const season = await passState(db, req.user, now);
    return V.missions({ user: req.user, st, flash: req.flash, qs, resetIn: msToMidnight(now), weekIn: msToWeekEnd(now), now, season });
  }));
  app.get('/api/misje', auth, async (req, res, next) => {
    try { const now = Date.now(); res.set('Cache-Control', 'no-store').json({ ok: true, ...(await G.questState(db, req.user, now)), resetIn: msToMidnight(now) }); }
    catch (e) { next(e); }
  });

  app.post('/misje/logowanie', auth, action('/misje', async (t, u, now) => {
    const ls = Q.loginState(u, now);
    if (ls.claimedToday) fail('Dzisiejsza nagroda już odebrana – wróć jutro!');
    const day = ls.next, streak = ls.streak + 1;
    const rw = await G.grant(t, u, now, Q.scale(Q.LOGIN_REWARDS[day - 1], u.level));
    await t.run('UPDATE users SET login_day = ?, login_streak = ?, streak_best = CASE WHEN streak_best < ? THEN ? ELSE streak_best END WHERE id = ?',
      [ls.today, streak, streak, streak, u.id]);
    await G.track(t, u.id, now, { login: 1 });
    const ms = Q.MILESTONES.includes(day) ? ` Kamień milowy: ${day} dni!` : '';
    return { msg: `Dzień ${day}/${Q.LOGIN_DAYS} (seria ${streak}): ${G.rewardText(rw)}.${ms}`, data: { day, streak, reward: rw, milestone: Q.MILESTONES.includes(day) } };
  }));

  // v9/1: ratunek serii – po opuszczeniu jednego dnia, za kryształy
  app.post('/misje/ratunek', auth, action('/misje', async (t, u, now) => {
    const ls = Q.loginState(u, now);
    if (!ls.rescue) fail('Nie ma czego ratować – ratunek działa tylko po opuszczeniu dokładnie jednego dnia.');
    if (!ls.rescue.ok) fail(`Ratunek serii będzie dostępny za ${ls.rescue.cooldownDays} ${ls.rescue.cooldownDays === 1 ? 'dzień' : 'dni'}.`);
    if (u.crystal < ls.rescue.cost) fail(`Brakuje kryształów: potrzeba 💎${ls.rescue.cost}.`);
    await t.run('UPDATE users SET crystal = crystal - ?, login_day = ?, streak_rescue_day = ? WHERE id = ?', [ls.rescue.cost, ls.today - 1, ls.today, u.id]);
    return { msg: `Seria uratowana (${ls.rescue.lost} ${ls.rescue.lost === 1 ? "dzień" : "dni"})! Odbierz dzisiejszą nagrodę.`, data: { streak: ls.rescue.lost, cost: ls.rescue.cost } };
  }));

  app.post('/misje/odbierz/:id', auth, action('/misje', async (t, u, now, req) => {
    const id = String(req.params.id);
    let q = Q.dailyQuests(now).find((x) => x.id === id), period = dailyPeriod(now), pts = Q.POINTS.daily;
    if (!q) { q = Q.WEEKLY.find((x) => x.id === id); period = weeklyPeriod(now); pts = Q.POINTS.weekly; }
    if (!q) fail('Nie ma takiej misji (mogła się już zresetować).');
    const row = await t.get('SELECT progress, claimed FROM quest_progress WHERE user_id = ? AND period = ? AND quest_id = ?', [u.id, period, id]);
    if (!row || row.progress < q.goal) fail('Misja nie jest jeszcze ukończona.');
    if (row.claimed) fail('Nagroda za tę misję została już odebrana.');
    await t.run('UPDATE quest_progress SET claimed = 1 WHERE user_id = ? AND period = ? AND quest_id = ?', [u.id, period, id]);
    await G.addPoints(t, u.id, now, pts);
    const sxp = pts === Q.POINTS.weekly ? S.QUEST_XP.weekly : S.QUEST_XP.daily;
    await G.seasonXp(t, u.id, now, sxp);
    const rw = await G.grant(t, u, now, Q.scale(q.r, u.level));
    return { msg: `Misja „${q.name}” ukończona! ${G.rewardText(rw)} · +${pts} pkt misji · +${sxp} XP sezonu`, data: { quest: id, reward: rw, points: pts } };
  }));

  app.post('/misje/skrzynia/:n', auth, action('/misje', async (t, u, now, req) => {
    const n = Number(req.params.n);
    const c = Q.CHESTS[n - 1] || fail('Nie ma takiej skrzyni.');
    const wp = weeklyPeriod(now);
    const pts = (await t.get("SELECT progress FROM quest_progress WHERE user_id = ? AND period = ? AND quest_id = '_pts'", [u.id, wp]))?.progress || 0;
    if (pts < c.pts) fail(`Potrzebujesz ${c.pts} pkt misji (masz ${pts}).`);
    const done = await t.get('SELECT claimed FROM quest_progress WHERE user_id = ? AND period = ? AND quest_id = ?', [u.id, wp, `_chest${n}`]);
    if (done?.claimed) fail('Ta skrzynia jest już otwarta.');
    await t.run(`INSERT INTO quest_progress (user_id, period, quest_id, progress, claimed) VALUES (?, ?, ?, 0, 1)
      ON CONFLICT (user_id, period, quest_id) DO UPDATE SET claimed = 1`, [u.id, wp, `_chest${n}`]);
    const rw = await G.grant(t, u, now, Q.scale(c.r, u.level));
    await G.seasonXp(t, u.id, now, S.QUEST_XP.chest);
    return { msg: `${c.name} otwarta! ${G.rewardText(rw)}`, data: { chest: n, reward: rw } };
  }));
}
