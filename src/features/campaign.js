// Etap v6/2: kampania fabularna PvE – rozdziały, gwiazdki, bossowie z unikalnym łupem, zużycie energii.
import * as CA from '../campaign.js';
import * as P from '../progression.js';
import * as R from '../rules.js';
import * as G from '../game.js';
import * as C from '../corp.js';
import { fail } from '../game.js';
import * as VC from '../views-campaign.js';
import * as EVF from './events.js';
import { dropItem } from './gear.js';
import { POINTS as EV_POINTS } from '../events.js';

export async function campaignMap(db, userId) {
  const rows = await db.all('SELECT mission, stars, wins FROM campaign WHERE user_id = ?', [userId]);
  return Object.fromEntries(rows.map((r) => [r.mission, r]));
}

export default function registerCampaign({ app, db, auth, page, action, preBattle, xpGain, dev }) {
  if (dev) {
    // DEV: ustawia gwiazdki misji rozdziału (normalny lub trudny), m = do której misji
    app.post('/api/dev/kampania', auth, action('/kampania', async (t, u, now, req) => {
      const c = Number(req.body.c) || 1, upTo = Math.min(CA.MISSIONS_PER, Number(req.body.m) || CA.MISSIONS_PER), stars = Math.min(3, Number(req.body.stars) || 3), hard = !!Number(req.body.hard);
      for (let m = 1; m <= upTo; m++) {
        await t.run(`INSERT INTO campaign (user_id, mission, stars, wins, updated_at) VALUES (?, ?, ?, 1, ?)
          ON CONFLICT (user_id, mission) DO UPDATE SET stars = excluded.stars, wins = excluded.wins`, [u.id, CA.missionId(c, m, hard), stars, now]);
      }
      return { msg: 'ok' };
    }));
  }
  app.get('/kampania', auth, page(async (req, now, st) => VC.overview({ user: req.user, st, flash: req.flash, prog: CA.progress(req.user, await campaignMap(db, req.user.id)) })));
  app.get('/kampania/:c', auth, page(async (req, now, st) => {
    const prog = CA.progress(req.user, await campaignMap(db, req.user.id));
    const ch = prog[Number(req.params.c) - 1];
    if (!ch) return null;
    return VC.chapter({ user: req.user, st, flash: req.flash, ch, now, hard: req.query.tryb === 'trudny' });
  }));
  app.get('/api/kampania', auth, async (req, res, next) => {
    try {
      const prog = CA.progress(req.user, await campaignMap(db, req.user.id));
      res.set('Cache-Control', 'no-store').json({ ok: true, relics: P.relicList(req.user), chapters: prog.map((c) => ({ n: c.n, title: c.title, planet: c.planet, minLvl: c.minLvl, unlocked: c.unlocked, stars: c.stars, done: c.done, chest: c.chest,
        hard: { unlocked: c.hard.unlocked, stars: c.hard.stars, done: c.hard.done, chest: c.hard.chest, missions: c.hard.ms.map((m) => ({ id: m.id, stars: m.stars, open: m.open, energy: m.energy, enemyPower: Math.round(m.enemy.maxHp / 4 + m.enemy.atk * 2 + m.enemy.def * 2) })) },
        missions: c.ms.map((m) => ({ id: m.id, name: m.name, stars: m.stars, open: m.open, boss: m.boss, energy: m.energy, enemyPower: Math.round(m.enemy.maxHp / 4 + m.enemy.atk * 2 + m.enemy.def * 2) })) })) });
    } catch (e) { next(e); }
  });

  app.post('/kampania/walcz/:id', auth, action('/kampania', async (t, u, now, req) => {
    const mi = CA.parseId(req.params.id) || fail('Nieznana misja.');
    const prog = CA.progress(u, await campaignMap(t, u.id));
    const ch = prog[mi.c - 1], ms = (mi.hard ? ch.hard.ms : ch.ms)[mi.m - 1];
    if (!ch.unlocked) fail(ch.prevBoss ? `Rozdział ${ch.n} dostępny od poziomu ${ch.minLvl}.` : `Najpierw pokonaj bossa rozdziału ${ch.n - 1}.`);
    if (mi.hard && !ch.hard.unlocked) fail(`Tryb trudny odblokujesz po zdobyciu ${CA.STARS_MAX}★ w rozdziale ${ch.n} (masz ${ch.stars}★).`);
    if (!ms.open) fail('Najpierw ukończ poprzednią misję.');
    const me = preBattle(u, now, CA.energyCost(mi.c, mi.m, mi.hard));
    const cost = me.cost;
    const foe = CA.enemy(mi.c, mi.m, mi.hard);
    const sim = R.simulate(me, { ...foe, name: mi.boss ? ch.boss.name : `${foe.name}` });
    const stars = CA.starsFor(sim.aWon, sim.aHp, me.maxHp, mi.boss);
    const first = sim.aWon && ms.wins === 0;
    let rw = { xp: 4, metal: 0, crystal: 0 };
    if (sim.aWon) rw = EVF.doubled(CA.reward(mi.c, mi.m, R.labBonus(u) * R.lootMult(u, 'pveLoot'), first, Math.random, mi.hard), EVF.lootMult(await EVF.activeEvents(t, now, !!u.is_test)));
    const newStars = Math.max(0, stars - ms.stars);
    if (newStars) rw.crystal += newStars * (mi.hard ? 10 : 5) * mi.c;
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
    const drop = !sim.aWon ? null : mi.boss ? await dropItem(t, u, now, mi.hard ? 'bossHard' : 'boss', { first }) : mi.hard ? await dropItem(t, u, now, 'hard') : null;
    const info = { ...got, camp: mi.id, hard: mi.hard, stars, best: Math.max(stars, ms.stars), first, relic, boss: mi.boss, item: drop?.item || null };
    const battleId = await t.insert(`INSERT INTO battles (created_at, kind, attacker_id, defender_id, enemy_name, attacker_won, log, reward)
      VALUES (?, 'pve', ?, NULL, ?, ?, ?, ?)`, [now, u.id, `${ch.planet} ${mi.hard ? 'T' : ''}${mi.c}-${mi.m}: ${mi.boss ? ch.boss.name : mi.name}`, sim.aWon ? 1 : 0, JSON.stringify(sim.log), JSON.stringify(info)]);
    await G.track(t, u.id, now, { pve: 1, win: sim.aWon ? 1 : 0, energy: cost });
    if (sim.aWon) await G.warPoints(t, u, now, C.WAR_POINTS.pve);
    if (sim.aWon) await EVF.contribute(t, u, now, mi.boss ? EV_POINTS.boss : EV_POINTS.campaign);
    const relicTxt = relic ? ` Unikalny łup: ${P.RELICS[relic].name} (${P.RELICS[relic].desc})!` : '';
    const dropTxt = drop?.text || '';
    return { msg: sim.aWon ? `Misja ${mi.hard ? 'trudna ' : ''}${mi.c}-${mi.m} zaliczona: ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} ${G.rewardText(got)}${relicTxt}${dropTxt}` : `Misja ${mi.hard ? 'trudna ' : ''}${mi.c}-${mi.m} nieudana – wzmocnij statek i spróbuj ponownie.`,
      redirect: `/bitwa/${battleId}`, data: { battleId, won: sim.aWon, stars, first, relic, reward: got, item: drop?.item || null } };
  }));

  app.post('/kampania/skrzynia/:c', auth, action('/kampania', async (t, u, now, req) => {
    const c = Number(req.params.c), hard = req.query.tryb === 'trudny' || req.body?.tryb === 'trudny';
    const ch0 = CA.progress(u, await campaignMap(t, u.id))[c - 1] || fail('Nieznany rozdział.');
    const ch = hard ? ch0.hard : ch0;
    if (ch.chest) fail('Ta skrzynia jest już odebrana.');
    if (ch.stars < CA.STARS_MAX) fail(`Skrzynia otworzy się przy ${CA.STARS_MAX}★ (masz ${ch.stars}★).`);
    const rw = CA.CHEST(c, hard);
    await t.run('UPDATE users SET camp_chests = ? WHERE id = ?', [CA.withChest(u, c, hard), u.id]);
    const got = await G.grant(t, u, now, rw);
    const drop = hard ? await dropItem(t, u, now, 'bossHard', { first: true }) : null;
    return { msg: `Skrzynia ${hard ? 'trybu trudnego ' : ''}rozdziału ${c} otwarta! ${G.rewardText(got)}${drop?.text || ''}`, redirect: `/kampania/${c}${hard ? '?tryb=trudny' : ''}`, data: { reward: got, item: drop?.item || null } };
  }));
}
