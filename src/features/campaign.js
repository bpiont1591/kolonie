// Etap v6/2: kampania fabularna PvE – rozdziały, gwiazdki, bossowie z unikalnym łupem, zużycie energii.
import * as CA from '../campaign.js';
import * as P from '../progression.js';
import * as R from '../rules.js';
import * as G from '../game.js';
import * as C from '../corp.js';
import { fail } from '../game.js';
import * as VC from '../views-campaign.js';

export async function campaignMap(db, userId) {
  const rows = await db.all('SELECT mission, stars, wins FROM campaign WHERE user_id = ?', [userId]);
  return Object.fromEntries(rows.map((r) => [r.mission, r]));
}

export default function registerCampaign({ app, db, auth, page, action, preBattle, xpGain }) {
  app.get('/kampania', auth, page(async (req, now, st) => VC.overview({ user: req.user, st, flash: req.flash, prog: CA.progress(req.user, await campaignMap(db, req.user.id)) })));
  app.get('/kampania/:c', auth, page(async (req, now, st) => {
    const prog = CA.progress(req.user, await campaignMap(db, req.user.id));
    const ch = prog[Number(req.params.c) - 1];
    if (!ch) return null;
    return VC.chapter({ user: req.user, st, flash: req.flash, ch, now });
  }));
  app.get('/api/kampania', auth, async (req, res, next) => {
    try {
      const prog = CA.progress(req.user, await campaignMap(db, req.user.id));
      res.set('Cache-Control', 'no-store').json({ ok: true, relics: P.relicList(req.user), chapters: prog.map((c) => ({ n: c.n, title: c.title, planet: c.planet, unlocked: c.unlocked, stars: c.stars, done: c.done, chest: c.chest,
        missions: c.ms.map((m) => ({ id: m.id, name: m.name, stars: m.stars, open: m.open, boss: m.boss, energy: m.energy, enemyPower: Math.round(m.enemy.maxHp / 4 + m.enemy.atk * 2 + m.enemy.def * 2) })) })) });
    } catch (e) { next(e); }
  });

  app.post('/kampania/walcz/:id', auth, action('/kampania', async (t, u, now, req) => {
    const mi = CA.parseId(req.params.id) || fail('Nieznana misja.');
    const prog = CA.progress(u, await campaignMap(t, u.id));
    const ch = prog[mi.c - 1], ms = ch.ms[mi.m - 1];
    if (!ch.unlocked) fail(ch.prevBoss ? `Rozdział ${ch.n} dostępny od poziomu ${ch.minLvl}.` : `Najpierw pokonaj bossa rozdziału ${ch.n - 1}.`);
    if (!ms.open) fail('Najpierw ukończ poprzednią misję.');
    const cost = CA.energyCost(mi.c, mi.m);
    const me = preBattle(u, now, cost);
    const foe = CA.enemy(mi.c, mi.m);
    const sim = R.simulate(me, { ...foe, name: mi.boss ? ch.boss.name : `${foe.name}` });
    const stars = CA.starsFor(sim.aWon, sim.aHp, me.maxHp, mi.boss);
    const first = sim.aWon && ms.wins === 0;
    let rw = { xp: 4, metal: 0, crystal: 0 };
    if (sim.aWon) rw = CA.reward(mi.c, mi.m, R.labBonus(u) * R.lootMult(u, 'pveLoot'), first);
    const newStars = Math.max(0, stars - ms.stars);
    if (newStars) rw.crystal += newStars * 5 * mi.c;
    rw.xp = xpGain(u, rw.xp);
    const relic = rw.relic && !P.relicList(u).includes(rw.relic) ? rw.relic : null;
    delete rw.relic;
    await t.run(`UPDATE users SET energy = energy - ?, hp = ?, hp_at = ?, last_battle_at = ?, pve_wins = pve_wins + ?${relic ? ', relics = ?' : ''} WHERE id = ?`,
      [cost, Math.max(1, sim.aHp), now, now, sim.aWon ? 1 : 0, ...(relic ? [[...P.relicList(u), relic].join(',')] : []), u.id]);
    const got = await G.grant(t, { ...u, energy: u.energy - cost }, now, rw);
    if (sim.aWon || ms.wins === 0) {
      await t.run(`INSERT INTO campaign (user_id, mission, stars, wins, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (user_id, mission) DO UPDATE SET stars = CASE WHEN campaign.stars > excluded.stars THEN campaign.stars ELSE excluded.stars END,
        wins = campaign.wins + excluded.wins, updated_at = excluded.updated_at`, [u.id, mi.id, stars, sim.aWon ? 1 : 0, now]);
    }
    const info = { ...got, camp: mi.id, stars, best: Math.max(stars, ms.stars), first, relic, boss: mi.boss };
    const battleId = await t.insert(`INSERT INTO battles (created_at, kind, attacker_id, defender_id, enemy_name, attacker_won, log, reward)
      VALUES (?, 'pve', ?, NULL, ?, ?, ?, ?)`, [now, u.id, `${ch.planet} ${mi.c}-${mi.m}: ${mi.boss ? ch.boss.name : mi.name}`, sim.aWon ? 1 : 0, JSON.stringify(sim.log), JSON.stringify(info)]);
    await G.track(t, u.id, now, { pve: 1, win: sim.aWon ? 1 : 0, energy: cost });
    if (sim.aWon) await G.warPoints(t, u, now, C.WAR_POINTS.pve);
    const relicTxt = relic ? ` Unikalny łup: ${P.RELICS[relic].name} (${P.RELICS[relic].desc})!` : '';
    return { msg: sim.aWon ? `Misja ${mi.c}-${mi.m} zaliczona: ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} ${G.rewardText(got)}${relicTxt}` : `Misja ${mi.c}-${mi.m} nieudana – wzmocnij statek i spróbuj ponownie.`,
      redirect: `/bitwa/${battleId}`, data: { battleId, won: sim.aWon, stars, first, relic, reward: got } };
  }));

  app.post('/kampania/skrzynia/:c', auth, action('/kampania', async (t, u, now, req) => {
    const c = Number(req.params.c);
    const ch = CA.progress(u, await campaignMap(t, u.id))[c - 1] || fail('Nieznany rozdział.');
    if (ch.chest) fail('Ta skrzynia jest już odebrana.');
    if (ch.stars < CA.STARS_MAX) fail(`Skrzynia otworzy się przy ${CA.STARS_MAX}★ (masz ${ch.stars}★).`);
    const rw = CA.CHEST(c);
    await t.run('UPDATE users SET camp_chests = ? WHERE id = ?', [[...String(u.camp_chests || '').split(',').filter(Boolean), String(c)].join(','), u.id]);
    const got = await G.grant(t, u, now, rw);
    return { msg: `Skrzynia rozdziału ${c} otwarta! ${G.rewardText(got)}`, redirect: `/kampania/${c}`, data: { reward: got } };
  }));
}
