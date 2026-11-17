// Etap v6/1: klasy statków (wybór po samouczku, zmiana za kryształy z odnowieniem) i drzewko technologii (kolejka badań).
import * as P from '../progression.js';
import * as R from '../rules.js';
import * as G from '../game.js';
import { fail } from '../game.js';
import { dur } from '../time.js';
import * as VF from '../views-fleet.js';

const tutActive = (u) => u.tut_step >= 1 && u.tut_step <= 5;
export function classState(u, now) {
  const first = !u.ship_class;
  const cdLeft = first ? 0 : Math.max(0, (u.class_changed_at || 0) + P.CLASS_CHANGE_COOLDOWN_MS - now);
  return { current: u.ship_class || '', first, cdLeft, cost: first ? { metal: 0, crystal: 0, energy: 0 } : P.classChangeCost(u.level), locked: tutActive(u) };
}

export default function registerFleet({ app, auth, page, action, onSettled }) {
  app.get('/statek/klasa', auth, page(async (req, now, st) => VF.classes({ user: req.user, st, flash: req.flash, cs: classState(req.user, now), now })));
  app.get('/api/klasa', auth, (req, res) => {
    const now = Date.now();
    res.set('Cache-Control', 'no-store').json({ ok: true, ...classState(req.user, now), stats: R.shipStats(req.user),
      classes: P.CLASS_IDS.map((id) => ({ id, name: P.CLASSES[id].name, mods: P.CLASSES[id].m })) });
  });
  app.post('/statek/klasa/:id', auth, action('/statek/klasa', async (t, u, now, req) => {
    const c = (Object.hasOwn(P.CLASSES, req.params.id) && P.CLASSES[req.params.id]) || fail('Nieznana klasa statku.');
    const cs = classState(u, now);
    if (cs.locked) fail('Najpierw ukończ lub pomiń samouczek – klasę wybierzesz zaraz potem.');
    if (u.ship_class === c.id) fail(`Twój statek już jest klasy ${c.name}.`);
    if (cs.cdLeft > 0) fail(`Kolejna zmiana klasy możliwa za ${dur(cs.cdLeft)}.`);
    if (u.crystal < cs.cost.crystal) fail(`Za mało kryształów (potrzeba 💎${cs.cost.crystal}).`);
    // HP utrwalamy w proporcji do nowego maksimum, by zmiana klasy nie leczyła ani nie raniła statku
    const oldMax = R.shipStats(u).maxHp, hpNow = R.currentHp(u, now);
    const nu = { ...u, ship_class: c.id };
    const hp = Math.max(1, Math.round((hpNow / oldMax) * R.shipStats(nu).maxHp));
    await t.run('UPDATE users SET ship_class = ?, class_changed_at = ?, crystal = crystal - ?, hp = ?, hp_at = ? WHERE id = ?',
      [c.id, now, cs.cost.crystal, hp, now, u.id]);
    return { msg: cs.first ? `Wybrano klasę: ${c.name}! ${c.desc}` : `Statek przebudowany na klasę ${c.name} (💎${cs.cost.crystal}).`,
      redirect: '/statek', data: { shipClass: c.id, cost: cs.cost.crystal } };
  }));

  app.get('/badania', auth, page(async (req, now, st) => VF.research({ user: req.user, st, flash: req.flash, now })));
  app.get('/api/badania', auth, (req, res) => {
    const u = req.user;
    res.set('Cache-Control', 'no-store').json({ ok: true, rpTotal: P.rpTotal(u), rpFree: P.rpFree(u), tech: P.techList(u), rq: u.rq_id || null, rqUntil: u.rq_until || 0, mods: P.mods(u) });
  });
  app.post('/badania/start/:id', auth, action('/badania', async (t, u, now, req) => {
    const n = (Object.hasOwn(P.TECH_BY_ID, req.params.id) && P.TECH_BY_ID[req.params.id]) || fail('Nieznana technologia.');
    const why = P.canResearch(u, n);
    if (why) fail(why);
    const c = P.researchCost(n);
    for (const k of R.RES_KEYS) if (u[k] < c[k]) fail(`Brakuje surowców w magazynie: ${R.RES_KEYS.map((x) => `${R.RESOURCES[x].icon}${c[x]}`).join(' ')}.`);
    const ms = Math.round((P.TIER_MIN[n.tier] * 60_000) / R.SPEED);
    await t.run('UPDATE users SET metal = metal - ?, crystal = crystal - ?, energy = energy - ?, rq_id = ?, rq_until = ? WHERE id = ?',
      [c.metal, c.crystal, c.energy, n.id, now + ms, u.id]);
    await G.track(t, u.id, now, { research: 1 });
    return { msg: `Rozpoczęto badania: ${n.name} (${dur(ms)}).`, data: { tech: n.id, until: now + ms, seconds: Math.round(ms / 1000) } };
  }));
  app.post('/badania/przyspiesz', auth, action('/badania', async (t, u, now) => {
    if (!u.rq_id) fail('Żadne badania nie trwają.');
    const cost = R.rushCost(u.rq_until - now);
    if (u.crystal < cost) fail(`Za mało kryształów (potrzeba 💎${cost}).`);
    await t.run('UPDATE users SET crystal = crystal - ?, rq_until = ? WHERE id = ?', [cost, now, u.id]);
    const res = await G.settle(t, { ...u, crystal: u.crystal - cost, rq_until: now }, now);
    onSettled(res.u, res.done);
    const d = res.done.find((x) => x.kind === 'research');
    return { msg: `Badania ukończone za 💎${cost}: ${d?.name}!`, data: { cost, tech: d?.id } };
  }));
  app.post('/badania/reset', auth, action('/badania', async (t, u) => {
    const spent = P.rpSpent(u);
    if (!spent) fail('Nie masz jeszcze żadnych technologii.');
    const c = P.resetCost(spent);
    if (u.crystal < c.crystal) fail(`Reset kosztuje 💎${c.crystal}.`);
    await t.run("UPDATE users SET crystal = crystal - ?, tech = '', rq_id = NULL, rq_until = 0 WHERE id = ?", [c.crystal, u.id]);
    return { msg: `Drzewko zresetowane (💎${c.crystal}) – odzyskano ${spent} pkt badawczych.`, data: { refunded: spent, cost: c.crystal } };
  }));
}
