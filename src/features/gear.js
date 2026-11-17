// v7/2: moduły specjalne – ekwipunek, sloty, ulepszanie, rozbiór oraz łupy z bossów.
import * as GE from '../gear.js';
import * as R from '../rules.js';
import * as G from '../game.js';
import { fail } from '../game.js';
import * as VG from '../views-gear.js';

/** Przepisuje users.gear z założonych modułów (slot 1..3). */
export async function syncGear(t, userId) {
  const eq = await t.all('SELECT def, rarity, level, slot FROM items WHERE user_id = ? AND slot > 0 ORDER BY slot', [userId]);
  await t.run('UPDATE users SET gear = ? WHERE id = ?', [GE.gearString(eq), userId]);
}
/** Losuje i zapisuje łup ze źródła. Pełny ekwipunek → moduł od razu rozebrany na surowce. Zwraca {item, text} albo null. */
export async function dropItem(t, u, now, src, opts = {}) {
  const it = GE.roll(src, opts);
  if (!it) return null;
  const cnt = await t.get('SELECT COUNT(*) AS n FROM items WHERE user_id = ?', [u.id]);
  if (Number(cnt.n) >= GE.MAX_ITEMS) {
    const s = GE.salvage(it.rarity, 1);
    await t.run('UPDATE users SET metal = metal + ?, crystal = crystal + ? WHERE id = ?', [s.metal, s.crystal, u.id]);
    return { item: it, salvaged: s, text: ` Moduł specjalny: ${GE.label(it)} – ekwipunek pełny, rozebrano na 🔩${s.metal} 💎${s.crystal}.` };
  }
  const id = await t.insert('INSERT INTO items (user_id, def, rarity, level, slot, source, created_at) VALUES (?, ?, ?, 1, 0, ?, ?)', [u.id, it.def, it.rarity, src, now]);
  return { item: { ...it, id }, text: ` Moduł specjalny: ${GE.label(it)}!` };
}

export default function registerGear({ app, db, auth, page, action, dev }) {
  const list = (q, uid) => q.all('SELECT * FROM items WHERE user_id = ? ORDER BY slot = 0, slot, rarity DESC, level DESC, id DESC', [uid]);
  const mine = async (t, u, id) => await t.get('SELECT * FROM items WHERE id = ? AND user_id = ?', [Number(id) || 0, u.id]) || fail('Nie masz takiego modułu.');

  app.get('/statek/moduly', auth, page(async (req, now, st) => VG.gear({ user: req.user, st, flash: req.flash, items: await list(db, req.user.id), sel: Number(req.query.m) || 0 })));
  app.get('/api/moduly', auth, async (req, res, next) => {
    try {
      const items = await list(db, req.user.id);
      res.set('Cache-Control', 'no-store').json({ ok: true, slots: GE.slotCount(req.user), slotLevels: GE.SLOT_LVLS, max: GE.MAX_ITEMS, gear: req.user.gear,
        items: items.map((i) => ({ id: i.id, def: i.def, rarity: i.rarity, level: i.level, slot: i.slot, source: i.source, effect: GE.effect(i.def, i.rarity, i.level),
          upgrade: i.level < GE.MAX_LEVEL ? GE.upgradeCost(i.rarity, i.level) : null, salvage: GE.salvage(i.rarity, i.level) })) });
    } catch (e) { next(e); }
  });

  app.post('/moduly/zaloz/:id', auth, action('/statek/moduly', async (t, u, now, req) => {
    const it = await mine(t, u, req.params.id);
    const n = GE.slotCount(u);
    if (!n) fail(`Pierwszy slot na moduł specjalny odblokujesz na poziomie ${GE.SLOT_LVLS[0]}.`);
    if (it.slot) fail('Ten moduł jest już zamontowany.');
    const eq = await t.all('SELECT * FROM items WHERE user_id = ? AND slot > 0', [u.id]);
    let slot = Number(req.body?.slot) || 0;
    if (!slot) { slot = 1; while (slot <= n && eq.some((e) => e.slot === slot)) slot++; if (slot > n) fail('Wszystkie sloty zajęte – wybierz slot do podmiany.'); }
    if (slot < 1 || slot > n) fail(`Slot ${slot} jest zablokowany (odblokowanie na poziomie ${GE.SLOT_LVLS[slot - 1] || '?'}).`);
    if (eq.some((e) => e.def === it.def && e.slot !== slot)) fail(`Masz już zamontowany ${GE.BY_ID[it.def].name} – dwa takie same moduły się nie sumują.`);
    await t.run('UPDATE items SET slot = 0 WHERE user_id = ? AND slot = ?', [u.id, slot]);
    await t.run('UPDATE items SET slot = ? WHERE id = ?', [slot, it.id]);
    await syncGear(t, u.id);
    return { msg: `Zamontowano: ${GE.label(it)} (slot ${slot}).`, data: { slot } };
  }));
  app.post('/moduly/zdejmij/:id', auth, action('/statek/moduly', async (t, u, now, req) => {
    const it = await mine(t, u, req.params.id);
    if (!it.slot) fail('Ten moduł nie jest zamontowany.');
    await t.run('UPDATE items SET slot = 0 WHERE id = ?', [it.id]);
    await syncGear(t, u.id);
    return { msg: `Zdjęto: ${GE.label(it)}.` };
  }));
  app.post('/moduly/ulepsz/:id', auth, action('/statek/moduly', async (t, u, now, req) => {
    const it = await mine(t, u, req.params.id);
    if (it.level >= GE.MAX_LEVEL) fail('Moduł ma już maksymalny poziom.');
    const c = GE.upgradeCost(it.rarity, it.level);
    if (u.metal < c.metal || u.crystal < c.crystal) fail(`Za mało surowców (potrzeba 🔩${c.metal} 💎${c.crystal}).`);
    await t.run('UPDATE users SET metal = metal - ?, crystal = crystal - ? WHERE id = ?', [c.metal, c.crystal, u.id]);
    await t.run('UPDATE items SET level = level + 1 WHERE id = ?', [it.id]);
    if (it.slot) await syncGear(t, u.id);
    const nx = { ...it, level: it.level + 1 };
    return { msg: `Ulepszono: ${GE.label(nx)} – ${GE.effectText(it.def, it.rarity, nx.level)}.`, redirect: `/statek/moduly?m=${it.id}`, data: { level: nx.level, cost: c } };
  }));
  app.post('/moduly/rozbierz/:id', auth, action('/statek/moduly', async (t, u, now, req) => {
    const it = await mine(t, u, req.params.id);
    if (it.slot) fail('Najpierw zdejmij moduł ze slotu.');
    const s = GE.salvage(it.rarity, it.level);
    await t.run('DELETE FROM items WHERE id = ?', [it.id]);
    await t.run('UPDATE users SET metal = metal + ?, crystal = crystal + ? WHERE id = ?', [s.metal, s.crystal, u.id]);
    return { msg: `Rozebrano ${GE.label(it)}: ${G.rewardText(s)}`, data: { salvage: s } };
  }));

  if (dev) {
    app.post('/api/dev/modul', auth, action('/statek/moduly', async (t, u, now, req) => {
      const def = GE.BY_ID[req.body.def] ? req.body.def : 'plazma', r = Math.min(3, Math.max(1, Number(req.body.rarity) || 1));
      const id = await t.insert('INSERT INTO items (user_id, def, rarity, level, slot, source, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)', [u.id, def, r, Math.min(GE.MAX_LEVEL, Number(req.body.level) || 1), 'dev', now]);
      return { msg: 'ok', data: { id } };
    }));
    app.post('/api/dev/los', auth, action('/', async (t, u, now, req) => {
      const d = await dropItem(t, u, now, req.body.src || 'boss', { first: true });
      return { msg: d?.text || 'brak', data: d };
    }));
  }
}
