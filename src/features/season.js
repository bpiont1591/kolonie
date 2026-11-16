// Etap v5/2: sezony (miesięczny ranking, nagrody i odznaki, archiwum) + przepustka sezonowa (ścieżka darmowa).
import * as S from '../season.js';
import * as Q from '../quests.js';
import * as G from '../game.js';
import { fail } from '../game.js';
import { seasonId, prevSeasonId, msToSeasonEnd } from '../time.js';
import * as VS from '../views-season.js';

/** Zamyka sezon: zapisuje top 10 z nagrodami i odznakami (raz – chronione kluczem w tabeli seasons). */
export async function finalizeSeason(db, season, now = Date.now()) {
  return db.tx(async (t) => {
    const ins = await t.run('INSERT INTO seasons (id, finalized_at) VALUES (?, ?) ON CONFLICT (id) DO NOTHING', [season, now]);
    if (!ins.changes) return null;
    const top = await t.all(`SELECT s.user_id, s.xp, u.username FROM season_stats s JOIN users u ON u.id = s.user_id
      WHERE s.season = ? AND s.xp > 0 ORDER BY s.xp DESC, s.user_id ASC LIMIT ?`, [season, S.AWARD_TOP]);
    for (const [i, r] of top.entries()) {
      const rank = i + 1;
      await t.run('INSERT INTO season_awards (season, user_id, username, rank, xp, reward) VALUES (?, ?, ?, ?, ?, ?)',
        [season, r.user_id, r.username, rank, r.xp, JSON.stringify(S.rankReward(rank))]);
      await t.run('INSERT INTO user_badges (user_id, badge, season, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, badge, season) DO NOTHING',
        [r.user_id, S.badgeForRank(rank), season, now]);
    }
    return top.length;
  });
}

let finalizedPrev = '';
/** Leniwe zamknięcie poprzedniego sezonu (pierwsze wejście po zmianie miesiąca). */
export async function ensureFinalized(db, now = Date.now()) {
  const prev = prevSeasonId(now);
  if (finalizedPrev === prev) return;
  if (!(await db.get('SELECT id FROM seasons WHERE id = ?', [prev]))) {
    const n = await finalizeSeason(db, prev, now);
    if (n !== null) console.log(`Sezon ${prev} zamknięty: ${n} nagrodzonych.`);
  }
  finalizedPrev = prev;
}

/** Stan przepustki gracza. */
export async function passState(q, u, now) {
  const season = seasonId(now);
  const xp = (await q.get('SELECT xp FROM season_stats WHERE season = ? AND user_id = ?', [season, u.id]))?.xp || 0;
  const claimed = new Set((await q.all('SELECT level FROM season_claims WHERE season = ? AND user_id = ?', [season, u.id])).map((r) => Number(r.level)));
  const pr = S.progress(xp);
  const levels = Array.from({ length: S.LEVELS }, (_, i) => {
    const n = i + 1;
    return { n, r: Q.scale(S.passReward(n), u.level), premium: S.premiumPreview(n), reached: pr.level >= n, claimed: claimed.has(n) };
  });
  const claimable = levels.filter((l) => l.reached && !l.claimed).length;
  return { season, xp, ...pr, levels, claimable, endsIn: msToSeasonEnd(now) };
}
export async function passBadge(db, u, now) {
  const season = seasonId(now);
  const xp = (await db.get('SELECT xp FROM season_stats WHERE season = ? AND user_id = ?', [season, u.id]))?.xp || 0;
  const lv = S.level(xp);
  if (!lv) return 0;
  const c = (await db.get('SELECT COUNT(*) AS n FROM season_claims WHERE season = ? AND user_id = ?', [season, u.id])).n;
  const unclaimedAwards = (await db.get('SELECT COUNT(*) AS n FROM season_awards WHERE user_id = ? AND claimed = 0', [u.id])).n;
  return Math.max(0, lv - Number(c)) + Number(unclaimedAwards);
}
async function ranking(db, season, userId, limit = 50) {
  const rows = await db.all(`SELECT s.user_id AS id, s.xp, u.username, u.title, u.level, c.tag FROM season_stats s JOIN users u ON u.id = s.user_id
    LEFT JOIN corps c ON c.id = u.corp_id WHERE s.season = ? AND s.xp > 0 ORDER BY s.xp DESC, s.user_id ASC LIMIT ?`, [season, limit]);
  const me = await db.get('SELECT xp FROM season_stats WHERE season = ? AND user_id = ?', [season, userId]);
  const myRank = me?.xp > 0 ? Number((await db.get('SELECT COUNT(*) AS n FROM season_stats WHERE season = ? AND (xp > ? OR (xp = ? AND user_id < ?))', [season, me.xp, me.xp, userId])).n) + 1 : null;
  return { rows, myRank, myXp: me?.xp || 0 };
}
export const badgesOf = (db, ids) => (ids.length
  ? db.all(`SELECT user_id, badge, season FROM user_badges WHERE user_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC`, ids)
  : Promise.resolve([]));

export default function registerSeason({ app, db, auth, page, action }) {
  const pre = async (req, res, next) => { try { await ensureFinalized(db); next(); } catch (e) { next(e); } };

  app.get('/sezon', auth, pre, page(async (req, now, st) => {
    const ps = await passState(db, req.user, now);
    const awards = await db.all('SELECT * FROM season_awards WHERE user_id = ? AND claimed = 0 ORDER BY season DESC', [req.user.id]);
    return VS.pass({ user: req.user, st, flash: req.flash, ps, awards, now });
  }));
  app.get('/sezon/ranking', auth, pre, page(async (req, now, st) => {
    const season = seasonId(now);
    const r = await ranking(db, season, req.user.id);
    const badges = await badgesOf(db, r.rows.map((x) => x.id));
    return VS.rankingPage({ user: req.user, st, flash: req.flash, season, ...r, badges, endsIn: msToSeasonEnd(now) });
  }));
  app.get('/sezon/archiwum', auth, pre, page(async (req, now, st) => {
    const rows = await db.all('SELECT season, user_id, username, rank, xp FROM season_awards WHERE rank <= 3 ORDER BY season DESC, rank ASC LIMIT 120');
    const seasons = [];
    for (const r of rows) { let s = seasons.find((x) => x.id === r.season); if (!s) seasons.push(s = { id: r.season, top: [] }); s.top.push(r); }
    const mine = await db.all('SELECT badge, season FROM user_badges WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    return VS.archive({ user: req.user, st, flash: req.flash, seasons, mine });
  }));
  app.get('/api/sezon', auth, pre, async (req, res, next) => {
    try {
      const now = Date.now();
      const ps = await passState(db, req.user, now);
      const r = await ranking(db, ps.season, req.user.id, 10);
      const awards = await db.all('SELECT season, rank, xp, reward, claimed FROM season_awards WHERE user_id = ? ORDER BY season DESC', [req.user.id]);
      const badges = await db.all('SELECT badge, season FROM user_badges WHERE user_id = ?', [req.user.id]);
      res.set('Cache-Control', 'no-store').json({ ok: true, ...ps, levels: ps.levels.map(({ n, r: rw, reached, claimed }) => ({ n, r: rw, reached, claimed })), ranking: r, awards, badges });
    } catch (e) { next(e); }
  });

  async function claimLevel(t, u, now, n) {
    const ps = await passState(t, u, now);
    const l = ps.levels[n - 1] || fail('Nie ma takiego poziomu przepustki.');
    if (!l.reached) fail(`Poziom ${n} przepustki jeszcze nieosiągnięty.`);
    if (l.claimed) fail('Ta nagroda została już odebrana.');
    await t.run('INSERT INTO season_claims (season, user_id, level) VALUES (?, ?, ?)', [ps.season, u.id, n]);
    if (n === S.LEVELS) await t.run('INSERT INTO user_badges (user_id, badge, season, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, badge, season) DO NOTHING', [u.id, 'pass', ps.season, now]);
    return l.r;
  }
  app.post('/sezon/odbierz/:n', auth, action('/sezon', async (t, u, now, req) => {
    const n = Number(req.params.n) || 0;
    const r = await claimLevel(t, u, now, n);
    const rw = await G.grant(t, u, now, r);
    return { msg: `Przepustka – poziom ${n}: ${G.rewardText(rw)}${n === S.LEVELS ? ' · odznaka „Przepustka ukończona”!' : ''}`, data: { level: n, reward: rw } };
  }));
  app.post('/sezon/odbierz-wszystko', auth, action('/sezon', async (t, u, now) => {
    const ps = await passState(t, u, now);
    const todo = ps.levels.filter((l) => l.reached && !l.claimed);
    if (!todo.length) fail('Brak nagród do odebrania.');
    const sum = {};
    for (const l of todo) { const r = await claimLevel(t, u, now, l.n); for (const [k, v] of Object.entries(r)) sum[k] = (sum[k] || 0) + v; }
    const rw = await G.grant(t, u, now, sum);
    const word = todo.length === 1 ? 'nagrodę' : todo.length % 10 >= 2 && todo.length % 10 <= 4 && (todo.length % 100 < 10 || todo.length % 100 >= 20) ? 'nagrody' : 'nagród';
    return { msg: `Odebrano ${todo.length} ${word} przepustki: ${G.rewardText(rw)}`, data: { levels: todo.map((l) => l.n), reward: rw } };
  }));
  app.post('/sezon/nagroda/:season', auth, action('/sezon', async (t, u, now, req) => {
    const a = await t.get('SELECT * FROM season_awards WHERE season = ? AND user_id = ?', [String(req.params.season), u.id]) || fail('Brak nagrody za ten sezon.');
    if (a.claimed) fail('Nagroda za ten sezon została już odebrana.');
    await t.run('UPDATE season_awards SET claimed = 1 WHERE season = ? AND user_id = ?', [a.season, u.id]);
    const rw = await G.grant(t, u, now, JSON.parse(a.reward));
    return { msg: `Nagroda za ${a.rank}. miejsce w sezonie: ${G.rewardText(rw)}`, data: { rank: a.rank, reward: rw } };
  }));
}
