// Etap 2: ekspedycje statku (1 h / 4 h / 8 h) – wynik losowany przy powrocie, raport do wglądu.
import * as R from '../rules.js';
import * as G from '../game.js';
import { fail } from '../game.js';
import { dur } from '../time.js';
import * as V from '../views.js';
import * as EVF from './events.js';

export default function registerExpeditions({ app, db, auth, page, action }) {
  const list = (uid) => db.all('SELECT * FROM expeditions WHERE user_id = ? ORDER BY id DESC LIMIT 10', [uid]);

  app.get('/ekspedycje', auth, page(async (req, now, st) => {
    const rows = await list(req.user.id);
    return V.expeditions({ user: req.user, st, flash: req.flash, rows, now });
  }));
  app.get('/api/ekspedycje', auth, async (req, res, next) => {
    try { res.set('Cache-Control', 'no-store').json({ ok: true, now: Date.now(), ex_until: req.user.ex_until, rows: (await list(req.user.id)).map((r) => ({ ...r, result: JSON.parse(r.result) })) }); }
    catch (e) { next(e); }
  });
  app.get('/ekspedycje/:id', auth, page(async (req, now, st) => {
    const ex = await db.get('SELECT * FROM expeditions WHERE id = ? AND user_id = ?', [Number(req.params.id) || 0, req.user.id]);
    if (!ex) return null;
    return V.expeditionReport({ user: req.user, st, flash: req.flash, ex, now });
  }));

  app.post('/ekspedycje/wyslij/:kind', auth, action('/ekspedycje', async (t, u, now, req) => {
    const kind = Object.hasOwn(R.EXPEDITIONS, req.params.kind) ? R.EXPEDITIONS[req.params.kind] : fail('Nieznany cel ekspedycji.');
    if (u.ex_until > now) fail(`Statek jest już w drodze – wróci za ${dur(u.ex_until - now)}.`);
    const ship = R.shipStats(u);
    const hp = R.currentHp(u, now);
    if (hp < ship.maxHp * R.EXPEDITION_MIN_HP) fail(`Statek musi mieć min. ${R.EXPEDITION_MIN_HP * 100}% HP (${hp}/${ship.maxHp}).`);
    if (u.energy < kind.energy) fail(`Za mało energii w magazynie (potrzeba ⚡${kind.energy}).`);
    const until = now + R.expeditionMs(kind, u);
    const happy = EVF.isOn(await EVF.activeEvents(t, now, !!u.is_test), 'happy') ? 100 : 0; // Happy hour: podwójne łupy dla wysłanych teraz
    const id = await t.insert("INSERT INTO expeditions (user_id, kind, started_at, return_at, status, result, bonus) VALUES (?, ?, ?, ?, 'active', '{}', ?)", [u.id, kind.id, now, until, happy]);
    await t.run('UPDATE users SET energy = energy - ?, ex_until = ?, hp = ?, hp_at = ? WHERE id = ?', [kind.energy, until, hp, now, u.id]);
    await G.track(t, u.id, now, { expedition: 1, energy: kind.energy });
    return { msg: `${kind.name}: statek wystartował! Powrót za ${dur(until - now)}.${happy ? ' Happy hour: łupy ×2!' : ''}`, data: { expeditionId: id, until, bonus: happy } };
  }));

  app.post('/ekspedycje/zawroc', auth, action('/ekspedycje', async (t, u, now) => {
    if (!(u.ex_until > now)) fail('Statek nie jest na ekspedycji.');
    const ex = await t.get("SELECT id FROM expeditions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [u.id]);
    if (ex) await t.run("UPDATE expeditions SET status = 'recalled', return_at = ?, result = ? WHERE id = ?",
      [now, JSON.stringify({ event: 'recalled', title: 'Odwołana', text: 'Statek zawrócił przed czasem – bez łupów.', loot: {}, dmg: 0 }), ex.id]);
    await t.run('UPDATE users SET ex_until = 0 WHERE id = ?', [u.id]);
    return { msg: 'Statek zawrócił do bazy. Ekspedycja przerwana bez łupów.' };
  }));
}
