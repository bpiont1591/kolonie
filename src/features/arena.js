// Etap v5/3: arena PvP – zapisy, leniwe rozgrywanie turniejów co 4 h, drabinka, nagrody za miejsca.
import * as AR from '../arena.js';
import * as R from '../rules.js';
import * as Q from '../quests.js';
import * as G from '../game.js';
import { fail } from '../game.js';
import { arenaNext } from '../time.js';
import { N, fire } from '../notify.js';
import { checkAchievements } from './achievements.js';
import * as VA from '../views-arena.js';

/** Rozgrywa turniej o danym starcie (raz – klucz w arena_tournaments). */
export async function resolveTournament(db, start, now = Date.now()) {
  const notes = [];
  const res = await db.tx(async (t) => {
    const ins = await t.run("INSERT INTO arena_tournaments (start, status, players, bracket, resolved_at) VALUES (?, 'running', 0, '{}', ?) ON CONFLICT (start) DO NOTHING", [start, now]);
    if (!ins.changes) return null;
    const rows = await t.all(`SELECT u.* FROM arena_entries e JOIN users u ON u.id = e.user_id WHERE e.t_start = ?
      ORDER BY e.joined_at ASC, u.id ASC LIMIT ?`, [start, AR.MAX_PLAYERS]);
    if (rows.length < 2) {
      for (const u of rows) {
        await t.run('UPDATE users SET energy = energy + ? WHERE id = ?', [AR.ENTRY_ENERGY, u.id]);
        notes.push([u.id, { title: 'Turniej areny odwołany', body: `Za mało chętnych – zwróciliśmy ⚡${AR.ENTRY_ENERGY}. Zapisz się na kolejny!`, url: '/arena', tag: 'arena' }]);
      }
      await t.run("UPDATE arena_tournaments SET status = 'cancelled', players = ? WHERE start = ?", [rows.length, start]);
      return { status: 'cancelled', players: rows.length };
    }
    const players = rows.map((u) => ({ id: u.id, name: u.username, level: u.level, title: u.title || '', u, stats: R.shipStats(u) }));
    const out = AR.runTournament(players);
    await t.run("UPDATE arena_tournaments SET status = 'done', players = ?, bracket = ? WHERE start = ?",
      [rows.length, JSON.stringify({ size: out.size, rounds: out.rounds }), start]);
    for (const u of rows) {
      const place = out.places.get(u.id);
      const rw = await G.grant(t, u, now, Q.scale(AR.placeReward(place), u.level));
      await t.run('INSERT INTO arena_results (start, user_id, place, reward) VALUES (?, ?, ?, ?)', [start, u.id, place, JSON.stringify(rw)]);
      await G.seasonXp(t, u.id, now, AR.seasonXpFor(place));
      await checkAchievements(t, u.id, now);
      notes.push([u.id, { title: place === 1 ? 'Wygrałeś turniej areny!' : `Arena: ${AR.placeLabel(place)}`, body: `Nagroda: ${G.rewardText(rw)}`, url: `/arena/turniej/${start}`, tag: 'arena' }]);
    }
    return { status: 'done', players: rows.length, places: Object.fromEntries(out.places) };
  });
  for (const [id, p] of notes) fire(() => N.send(id, p));
  return res;
}

let checkedUntil = 0;
/** Leniwe rozegranie zaległych turniejów (przy wejściu na arenę/bitwę). */
export async function ensureArena(db, now = Date.now(), force = false) {
  if (!force && now < checkedUntil) return;
  const due = await db.all(`SELECT DISTINCT e.t_start FROM arena_entries e LEFT JOIN arena_tournaments a ON a.start = e.t_start
    WHERE e.t_start <= ? AND a.start IS NULL ORDER BY e.t_start`, [now]);
  for (const d of due) {
    const r = await resolveTournament(db, Number(d.t_start), now);
    if (r) console.log(`Turniej areny ${new Date(Number(d.t_start)).toISOString()}: ${r.status}, graczy: ${r.players}.`);
  }
  checkedUntil = arenaNext(now);
}

export async function arenaSummary(db, userId, now) {
  const next = arenaNext(now);
  const n = Number((await db.get('SELECT COUNT(*) AS n FROM arena_entries WHERE t_start = ?', [next])).n);
  const joined = !!(await db.get('SELECT user_id FROM arena_entries WHERE t_start = ? AND user_id = ?', [next, userId]));
  return { next, n, joined };
}

export default function registerArena({ app, db, auth, page, action, dev }) {
  const pre = async (req, res, next) => { try { await ensureArena(db); next(); } catch (e) { next(e); } };

  app.get('/arena', auth, pre, page(async (req, now, st) => {
    const sum = await arenaSummary(db, req.user.id, now);
    const entrants = await db.all(`SELECT u.id, u.username, u.level, u.title, u.s_hull, u.s_guns, u.s_shields FROM arena_entries e JOIN users u ON u.id = e.user_id
      WHERE e.t_start = ? ORDER BY e.joined_at ASC LIMIT ?`, [sum.next, AR.MAX_PLAYERS]);
    const last = await db.get("SELECT * FROM arena_tournaments WHERE status = 'done' ORDER BY start DESC LIMIT 1");
    const mine = await db.all('SELECT start, place, reward FROM arena_results WHERE user_id = ? ORDER BY start DESC LIMIT 10', [req.user.id]);
    return VA.arena({ user: req.user, st, flash: req.flash, sum, entrants, last, mine, now });
  }));
  app.get('/arena/turniej/:start', auth, pre, page(async (req, now, st) => {
    const tr = await db.get('SELECT * FROM arena_tournaments WHERE start = ?', [Number(req.params.start) || 0]);
    if (!tr) return null;
    const mine = await db.get('SELECT place, reward FROM arena_results WHERE start = ? AND user_id = ?', [tr.start, req.user.id]);
    return VA.tournament({ user: req.user, st, flash: req.flash, tr, mine, now });
  }));
  app.get('/api/arena', auth, pre, async (req, res, next) => {
    try {
      const now = Date.now();
      const sum = await arenaSummary(db, req.user.id, now);
      const mine = await db.all('SELECT start, place FROM arena_results WHERE user_id = ? ORDER BY start DESC LIMIT 10', [req.user.id]);
      res.set('Cache-Control', 'no-store').json({ ok: true, ...sum, entryEnergy: AR.ENTRY_ENERGY, minLevel: AR.MIN_LEVEL, results: mine.map((r) => ({ start: Number(r.start), place: Number(r.place) })) });
    } catch (e) { next(e); }
  });
  app.post('/arena/zapisz', auth, action('/arena', async (t, u, now) => {
    if (u.level < AR.MIN_LEVEL) fail(`Arena jest dostępna od poziomu ${AR.MIN_LEVEL}.`);
    const next = arenaNext(now);
    if (await t.get('SELECT user_id FROM arena_entries WHERE t_start = ? AND user_id = ?', [next, u.id])) fail('Jesteś już zapisany na najbliższy turniej.');
    const n = Number((await t.get('SELECT COUNT(*) AS n FROM arena_entries WHERE t_start = ?', [next])).n);
    if (n >= AR.MAX_PLAYERS) fail('Turniej jest pełny – zapisz się na kolejny.');
    if (u.energy < AR.ENTRY_ENERGY) fail(`Za mało energii w magazynie (potrzeba ⚡${AR.ENTRY_ENERGY}). Zbierz surowce.`);
    await t.run('UPDATE users SET energy = energy - ? WHERE id = ?', [AR.ENTRY_ENERGY, u.id]);
    await t.run('INSERT INTO arena_entries (t_start, user_id, joined_at) VALUES (?, ?, ?)', [next, u.id, now]);
    return { msg: `Zapisano na turniej areny (⚡${AR.ENTRY_ENERGY}). Start o ${new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' }).format(next)}.`, data: { start: next, players: n + 1 } };
  }));
  app.post('/arena/wypisz', auth, action('/arena', async (t, u, now) => {
    const next = arenaNext(now);
    const del = await t.run('DELETE FROM arena_entries WHERE t_start = ? AND user_id = ?', [next, u.id]);
    if (!del.changes) fail('Nie jesteś zapisany na najbliższy turniej.');
    await t.run('UPDATE users SET energy = energy + ? WHERE id = ?', [AR.ENTRY_ENERGY, u.id]);
    return { msg: `Wypisano z turnieju – zwrócono ⚡${AR.ENTRY_ENERGY}.`, data: { start: next } };
  }));

  if (dev) {
    // test: przesuwa zapisy na najbliższy turniej w przeszłość i rozgrywa go od razu
    app.post('/api/dev/arena-teraz', auth, async (req, res, next) => {
      try {
        const now = Date.now();
        const start = now - 1000;
        await db.run('UPDATE arena_entries SET t_start = ? WHERE t_start = ?', [start, arenaNext(now)]);
        const r = await resolveTournament(db, start, now);
        res.json({ ok: true, start, ...r });
      } catch (e) { next(e); }
    });
  }
}
