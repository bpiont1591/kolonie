// Etap v6/3: wydarzenia czasowe – harmonogram, leniwe start/koniec przy wejściu gracza (bez crona), pasek ogłoszeń + push,
// inwazja z globalnym paskiem postępu, podwójne łupy, happy hour ekspedycji, ręczne uruchamianie z panelu admina.
import * as EV from '../events.js';
import * as R from '../rules.js';
import * as G from '../game.js';
import { fail } from '../game.js';
import { N, fire } from '../notify.js';
import * as VE from '../views-events.js';
import { dropItem } from './gear.js';

const ENSURE_EVERY_MS = 20_000;
let lastEnsure = 0;
const cache = new Map(); // test? -> {at, rows}
export const resetEventsCache = () => { cache.clear(); lastEnsure = 0; };

async function activePlayers(db, now) {
  const r = await db.get('SELECT COUNT(*) AS n FROM users WHERE is_test = 0 AND (collected_at > ? OR last_battle_at > ?)', [now - 7 * 86400_000, now - 7 * 86400_000]);
  return Number(r?.n) || 0;
}
const startPush = (e) => ({ title: `${EV.KINDS[e.kind].name} – start!`, body: `${EV.KINDS[e.kind].desc}`.slice(0, 160), url: '/wydarzenia', tag: `ev-${e.kind}` });

/** Leniwe rozliczenie harmonogramu: tworzy trwające wydarzenia i zamyka zakończone. Wołane przy wejściu gracza. */
export async function ensureEvents(db, now, force = false) {
  if (!force && now - lastEnsure < ENSURE_EVERY_MS) return;
  lastEnsure = now;
  for (const o of EV.activeScheduled(now)) {
    const goal = o.kind === 'inwazja' ? EV.invasionGoal(await activePlayers(db, now)) : 0;
    const r = await db.run(`INSERT INTO events (kind, ekey, starts_at, ends_at, goal, source, created_at) VALUES (?, ?, ?, ?, ?, 'auto', ?)
      ON CONFLICT (ekey) DO NOTHING`, [o.kind, o.key, o.starts, o.ends, goal, now]);
    if (r.changes) { cache.clear(); fire(() => N.toAll?.(startPush(o), false)); }
  }
  await settleEnded(db, now);
}
export async function settleEnded(db, now, ids = null) {
  const only = ids?.length ? ` AND id IN (${ids.map(() => '?').join(',')})` : '';
  const ended = await db.all(`SELECT * FROM events WHERE ends_at <= ? AND settled = 0${only} LIMIT 20`, [now, ...(ids || [])]);
  for (const e of ended) {
    const success = e.kind === 'inwazja' && e.progress >= e.goal ? 1 : 0;
    const r = await db.run('UPDATE events SET settled = 1, success = ? WHERE id = ? AND settled = 0', [success, e.id]);
    if (!r.changes || e.kind !== 'inwazja') continue;
    cache.clear();
    const ps = await db.all('SELECT user_id FROM event_points WHERE event_id = ? AND points >= ?', [e.id, EV.MIN_POINTS]);
    for (const p of ps) fire(() => N.send(Number(p.user_id), { title: success ? 'Inwazja odparta! 🏆' : 'Inwazja zakończona', body: success ? 'Serwer obronił sektor – odbierz nagrodę za udział.' : 'Tym razem obcy przetrwali. Odbierz nagrodę pocieszenia.', url: '/wydarzenia', tag: `ev-end-${e.id}` }));
  }
}
/** Aktywne wydarzenia widoczne dla gracza (wydarzenia testowe – tylko dla kont testowych). */
export async function activeEvents(db, now, isTest = false) {
  const k = isTest ? 1 : 0, c = cache.get(k);
  if (c && now - c.at < 5_000 && c.rows.every((e) => e.ends_at > now)) return c.rows;
  const rows = await db.all('SELECT * FROM events WHERE starts_at <= ? AND ends_at > ? AND (test = 0 OR ? = 1) ORDER BY ends_at ASC', [now, now, k]);
  cache.set(k, { at: now, rows });
  return rows;
}
export const isOn = (evs, kind) => evs.find((e) => e.kind === kind) || null;
/** Mnożnik łupów surowcowych z wydarzeń (Podwójne łupy). */
export const lootMult = (evs) => (isOn(evs, 'lupy') ? 2 : 1);
export const doubled = (rw, m) => (m === 1 ? rw : { ...rw, metal: Math.round((rw.metal || 0) * m), crystal: Math.round((rw.crystal || 0) * m) });
/** Wkład gracza w inwazję (jeśli trwa). */
export async function contribute(t, u, now, pts) {
  if (!pts) return 0;
  const inv = isOn(await activeEvents(t, now, !!u.is_test), 'inwazja');
  if (!inv) return 0;
  await t.run(`INSERT INTO event_points (event_id, user_id, points, claimed) VALUES (?, ?, ?, 0)
    ON CONFLICT (event_id, user_id) DO UPDATE SET points = event_points.points + excluded.points`, [inv.id, u.id, pts]);
  await t.run('UPDATE events SET progress = progress + ? WHERE id = ?', [pts, inv.id]);
  inv.progress += pts;
  return pts;
}
/** Wydarzenia do paska u góry strony. */
export async function forUser(db, u, now) {
  await ensureEvents(db, now);
  return (await activeEvents(db, now, !!u.is_test)).map((e) => ({ id: e.id, kind: e.kind, ends: e.ends_at, goal: e.goal, progress: e.progress }));
}

export default function registerEvents({ app, db, auth, page, action, preBattle, xpGain, settledHooks, dev }) {
  if (dev) {
    // Test leniwego harmonogramu w dowolnej chwili: tworzy/rozlicza wydarzenia „jakby” był czas `at`, potem sprząta po sobie.
    app.post('/api/dev/harmonogram', auth, async (req, res, next) => {
      try {
        const at = Number(req.body.at) || Date.now(), keys = EV.activeScheduled(at).map((o) => o.key);
        await ensureEvents(db, at, true);
        await ensureEvents(db, at + 60_000, true); // drugie wejście nie dubluje
        const rows = keys.length ? await db.all(`SELECT * FROM events WHERE ekey IN (${keys.map(() => '?').join(',')})`, keys) : [];
        const end = Math.max(0, ...rows.map((e) => e.ends_at)) + 1;
        await settleEnded(db, end, rows.map((e) => e.id));
        const after = keys.length ? await db.all(`SELECT id, settled FROM events WHERE ekey IN (${keys.map(() => '?').join(',')})`, keys) : [];
        for (const e of rows) if (e.source === 'auto' && e.created_at === at) await db.run('DELETE FROM events WHERE id = ?', [e.id]);
        resetEventsCache();
        res.json({ ok: true, created: rows.map((e) => ({ kind: e.kind, ekey: e.ekey, goal: e.goal, starts: e.starts_at, ends: e.ends_at, source: e.source })), settled: after.every((e) => e.settled === 1) });
      } catch (e) { next(e); }
    });
  }
  // powrót z ekspedycji podczas inwazji = punkty dla serwera
  settledHooks.push(async (u, done) => {
    const n = done.filter((d) => d.kind === 'expedition').length;
    if (n) await db.tx((t) => contribute(t, u, Date.now(), n * EV.POINTS.expedition));
  });

  const viewData = async (u, now) => {
    const evs = await activeEvents(db, now, !!u.is_test);
    const inv = isOn(evs, 'inwazja');
    const mine = inv ? await db.get('SELECT points FROM event_points WHERE event_id = ? AND user_id = ?', [inv.id, u.id]) : null;
    const top = inv ? await db.all('SELECT u.username, p.points FROM event_points p JOIN users u ON u.id = p.user_id WHERE p.event_id = ? ORDER BY p.points DESC, u.id ASC LIMIT 5', [inv.id]) : [];
    const claims = await db.all(`SELECT e.*, p.points, p.claimed FROM events e JOIN event_points p ON p.event_id = e.id
      WHERE p.user_id = ? AND e.kind = 'inwazja' AND e.settled = 1 AND e.ends_at > ? ORDER BY e.ends_at DESC LIMIT 5`, [u.id, now - EV.CLAIM_DAYS * 86400_000]);
    return { evs, inv, myPoints: Number(mine?.points) || 0, top, claims, upcoming: Object.keys(EV.KINDS).map((k) => EV.upcoming(now, 30).find((o) => o.kind === k)).filter(Boolean).sort((x, y) => x.starts - y.starts) };
  };
  app.get('/wydarzenia', auth, page(async (req, now, st) => VE.events({ user: req.user, st, flash: req.flash, now, ...(await viewData(req.user, now)) })));
  app.get('/api/wydarzenia', auth, async (req, res, next) => {
    try {
      const now = Date.now();
      await ensureEvents(db, now);
      const d = await viewData(req.user, now);
      res.set('Cache-Control', 'no-store').json({ ok: true, active: d.evs.map((e) => ({ id: e.id, kind: e.kind, starts: e.starts_at, ends: e.ends_at, goal: e.goal, progress: e.progress, source: e.source })),
        myPoints: d.myPoints, next: Object.fromEntries(Object.keys(EV.KINDS).map((k) => [k, EV.upcoming(now, 20).find((o) => o.kind === k) || null])), claims: d.claims.map((c) => ({ id: c.id, success: !!c.success, points: c.points, claimed: !!c.claimed })), upcoming: EV.upcoming(now, 5) });
    } catch (e) { next(e); }
  });

  app.post('/wydarzenia/walcz', auth, action('/wydarzenia', async (t, u, now) => {
    const evs = await activeEvents(t, now, !!u.is_test);
    if (!isOn(evs, 'inwazja')) fail('Najeźdźcy pojawiają się tylko podczas inwazji obcych.');
    const tier = EV.XENO;
    const me = preBattle(u, now, tier.energy);
    const sim = R.simulate(me, R.pirate(tier, u.level));
    let reward = { xp: 3, metal: 0, crystal: 0 };
    if (sim.aWon) reward = doubled(R.pirateReward(tier, u.level, R.labBonus(u) * R.lootMult(u, 'pveLoot')), lootMult(evs));
    reward.xp = xpGain(u, reward.xp);
    await t.run('UPDATE users SET energy = energy - ?, hp = ?, hp_at = ?, last_battle_at = ?, pve_wins = pve_wins + ? WHERE id = ?',
      [me.cost, Math.max(1, sim.aHp), now, now, sim.aWon ? 1 : 0, u.id]);
    const got = await G.grant(t, { ...u, energy: u.energy - me.cost }, now, reward);
    const pts = sim.aWon ? await contribute(t, u, now, EV.POINTS.xeno) : 0;
    const drop = sim.aWon ? await dropItem(t, u, now, 'xeno') : null;
    const battleId = await t.insert(`INSERT INTO battles (created_at, kind, attacker_id, defender_id, enemy_name, attacker_won, log, reward)
      VALUES (?, 'pve', ?, NULL, ?, ?, ?, ?)`, [now, u.id, tier.name, sim.aWon ? 1 : 0, JSON.stringify(sim.log), JSON.stringify({ ...got, tier: 'xeno', evPts: pts, item: drop?.item || null })]);
    await G.track(t, u.id, now, { pve: 1, win: sim.aWon ? 1 : 0, energy: me.cost });
    return { msg: sim.aWon ? `Najeźdźca zniszczony! +${pts} pkt inwazji · ${G.rewardText(got)}${drop?.text || ''}` : 'Najeźdźca okazał się silniejszy – napraw statek i wracaj do walki.',
      redirect: `/bitwa/${battleId}`, data: { battleId, won: sim.aWon, points: pts, reward: got, item: drop?.item || null } };
  }));

  app.post('/wydarzenia/odbierz/:id', auth, action('/wydarzenia', async (t, u, now, req) => {
    const e = await t.get("SELECT * FROM events WHERE id = ? AND kind = 'inwazja'", [Number(req.params.id) || 0]) || fail('Nie ma takiego wydarzenia.');
    if (!e.settled) fail('Inwazja jeszcze trwa – nagrody po jej zakończeniu.');
    if (e.ends_at < now - EV.CLAIM_DAYS * 86400_000) fail('Minął czas na odbiór nagrody.');
    const p = await t.get('SELECT * FROM event_points WHERE event_id = ? AND user_id = ?', [e.id, u.id]);
    const rw = EV.invasionReward(!!e.success, Number(p?.points) || 0) || fail(`Nagroda wymaga min. ${EV.MIN_POINTS} pkt udziału.`);
    const r = await t.run('UPDATE event_points SET claimed = 1 WHERE event_id = ? AND user_id = ? AND claimed = 0', [e.id, u.id]);
    if (!r.changes) fail('Nagroda już odebrana.');
    const got = await G.grant(t, u, now, rw);
    const drop = e.success ? await dropItem(t, u, now, 'invasion') : null;
    return { msg: `${e.success ? 'Nagroda za obronę sektora' : 'Nagroda pocieszenia'}: ${G.rewardText(got)}${drop?.text || ''}`, data: { reward: got, item: drop?.item || null } };
  }));
}
