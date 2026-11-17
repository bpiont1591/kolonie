// v7/4: prestiż „Odrodzenie” – ekran potwierdzenia, reset, sklep stałych ulepszeń.
import * as PS from '../prestige.js';
import * as R from '../rules.js';
import { fail } from '../game.js';
import * as VP from '../views-prestige.js';

export function preview(u) {
  return { can: u.level >= PS.MIN_LEVEL, minLevel: PS.MIN_LEVEL, level: u.level, rank: Number(u.prestige) || 0, pp: Number(u.pp) || 0, gain: PS.ppFor(u.level),
    perks: PS.perkLevels(u), loses: PS.LOSES, keeps: PS.KEEPS, rankBonus: PS.RANK_BONUS };
}

export default function registerPrestige({ app, auth, page, action, dev }) {
  app.get('/odrodzenie', auth, page(async (req, now, st) => VP.prestige({ user: req.user, st, flash: req.flash, pv: preview(req.user) })));
  app.get('/api/odrodzenie', auth, (req, res) => res.set('Cache-Control', 'no-store').json({ ok: true, ...preview(req.user) }));

  app.post('/odrodzenie', auth, action('/odrodzenie', async (t, u, now, req) => {
    if (u.level < PS.MIN_LEVEL) fail(`Odrodzenie dostępne od poziomu ${PS.MIN_LEVEL} (masz ${u.level}).`);
    if (String(req.body?.confirm || '').trim().toUpperCase() !== 'ODRODZENIE') fail('Aby potwierdzić, wpisz słowo ODRODZENIE.');
    const gain = PS.ppFor(u.level), rank = (Number(u.prestige) || 0) + 1;
    const nu = { ...u, level: 1, xp: 0, tech: '', s_hull: 1, s_guns: 1, s_shields: 1, prestige: rank, peak_level: Math.max(u.peak_level || 0, u.level) };
    const hp = R.shipStats(nu).maxHp;
    // warunek level >= MIN w UPDATE chroni przed podwójnym kliknięciem
    const r = await t.run(`UPDATE users SET level = 1, xp = 0, tech = '', rq_id = NULL, rq_until = 0, s_hull = 1, s_guns = 1, s_shields = 1, mq_id = NULL, mq_until = 0,
      prestige = ?, pp = pp + ?, peak_level = ?, prestige_at = ?, hp = ?, hp_at = ? WHERE id = ? AND level >= ?`, [rank, gain, nu.peak_level, now, hp, now, u.id, PS.MIN_LEVEL]);
    if (!r.changes) fail('Odrodzenie już się dokonało.');
    return { msg: `Odrodzenie! Ranga prestiżu ${rank} (${PS.rankName(rank)}), +${gain} PP. Stały bonus: +${Math.round(PS.RANK_BONUS.xp * rank * 100)}% XP i +${Math.round(PS.RANK_BONUS.prod * rank * 100)}% wydobycia.`,
      redirect: '/odrodzenie', data: { rank, gain, pp: (Number(u.pp) || 0) + gain } };
  }));

  app.post('/odrodzenie/ulepsz/:id', auth, action('/odrodzenie', async (t, u, now, req) => {
    const p = PS.PERKS[req.params.id] || fail('Nieznane ulepszenie.');
    const lv = PS.perkLevels(u), cur = lv[p.id] || 0;
    if (cur >= p.max) fail(`${p.name} ma już maksymalny poziom.`);
    const cost = PS.perkCost(cur);
    if ((Number(u.pp) || 0) < cost) fail(`Za mało punktów prestiżu (potrzeba ${cost} PP).`);
    lv[p.id] = cur + 1;
    const r = await t.run('UPDATE users SET pp = pp - ?, perks = ? WHERE id = ? AND pp >= ?', [cost, PS.perkString(lv), u.id, cost]);
    if (!r.changes) fail('Za mało punktów prestiżu.');
    return { msg: `${p.name} – poziom ${cur + 1} (${p.desc} na poziom). −${cost} PP.`, data: { perk: p.id, level: cur + 1, cost } };
  }));

  if (dev) {
    app.post('/api/dev/prestiz', auth, action('/odrodzenie', async (t, u, now, req) => {
      await t.run('UPDATE users SET pp = ? WHERE id = ?', [Number(req.body.pp) || 0, u.id]);
      return { msg: 'ok' };
    }));
  }
}
