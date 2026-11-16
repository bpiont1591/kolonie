// Etap v5/4: rynek – oferty wymiany surowców z depozytem, podatkiem i blokadą handlu między powiązanymi kontami.
import * as M from '../market.js';
import * as R from '../rules.js';
import { fail } from '../game.js';
import { linked } from '../security.js';
import { N, fire } from '../notify.js';
import * as VM from '../views-market.js';

const resName = (k) => R.RESOURCES[k].name.toLowerCase();
/** Zwrot depozytu z wygasłych ofert (leniwie przy wejściu na rynek). */
export async function expireOffers(db, now = Date.now()) {
  const rows = await db.all("SELECT id FROM market_offers WHERE status = 'open' AND expires_at <= ? LIMIT 200", [now]);
  for (const r of rows) {
    await db.tx(async (t) => {
      const o = await t.get("SELECT * FROM market_offers WHERE id = ? AND status = 'open'", [r.id]);
      if (!o) return;
      await t.run("UPDATE market_offers SET status = 'expired', closed_at = ? WHERE id = ?", [now, o.id]);
      await t.run(`UPDATE users SET ${o.sell_res} = ${o.sell_res} + ? WHERE id = ?`, [o.sell_amt, o.seller_id]);
    });
  }
}

export default function registerMarket({ app, db, auth, page, action }) {
  const pre = async (req, res, next) => { try { await expireOffers(db); next(); } catch (e) { next(e); } };
  const list = (res, uid) => db.all(`SELECT o.*, u.username, u.title, u.level FROM market_offers o JOIN users u ON u.id = o.seller_id
    WHERE o.status = 'open' ${res ? 'AND o.sell_res = ?' : ''} AND o.seller_id <> ? ORDER BY o.created_at DESC LIMIT 60`, res ? [res, uid] : [uid]);

  app.get('/rynek', auth, pre, page(async (req, now, st) => {
    const res = M.RES.includes(req.query.res) ? req.query.res : '';
    const offers = (await list(res, req.user.id)).sort((a, b) => M.ratio({ sellRes: a.sell_res, sellAmt: a.sell_amt, buyRes: a.buy_res, buyAmt: a.buy_amt })
      - M.ratio({ sellRes: b.sell_res, sellAmt: b.sell_amt, buyRes: b.buy_res, buyAmt: b.buy_amt }));
    const mine = await db.all("SELECT * FROM market_offers WHERE seller_id = ? AND status = 'open' ORDER BY id DESC", [req.user.id]);
    const hist = await db.all(`SELECT o.*, s.username AS seller, b.username AS buyer FROM market_offers o LEFT JOIN users s ON s.id = o.seller_id LEFT JOIN users b ON b.id = o.buyer_id
      WHERE (o.seller_id = ? OR o.buyer_id = ?) AND o.status <> 'open' ORDER BY o.closed_at DESC LIMIT 10`, [req.user.id, req.user.id]);
    return VM.market({ user: req.user, st, flash: req.flash, res, offers, mine, hist, now });
  }));
  app.get('/api/rynek', auth, pre, async (req, res, next) => {
    try {
      const r = M.RES.includes(req.query.res) ? req.query.res : '';
      const offers = await list(r, req.user.id);
      const mine = await db.all("SELECT * FROM market_offers WHERE seller_id = ? AND status = 'open' ORDER BY id DESC", [req.user.id]);
      const pub = (o) => ({ id: Number(o.id), seller: o.username, sellerId: Number(o.seller_id), sellRes: o.sell_res, sellAmt: o.sell_amt, buyRes: o.buy_res, buyAmt: o.buy_amt, expiresAt: Number(o.expires_at) });
      res.set('Cache-Control', 'no-store').json({ ok: true, tax: M.TAX, offers: offers.map(pub), mine: mine.map(pub) });
    } catch (e) { next(e); }
  });

  app.post('/rynek/wystaw', auth, action('/rynek', async (t, u, now, req) => {
    if (u.level < M.MIN_LEVEL) fail(`Rynek jest dostępny od poziomu ${M.MIN_LEVEL}.`);
    const o = { sellRes: String(req.body.sell_res), sellAmt: Math.floor(Number(req.body.sell_amt)), buyRes: String(req.body.buy_res), buyAmt: Math.floor(Number(req.body.buy_amt)) };
    const err = M.validate(o);
    if (err) fail(err);
    const open = Number((await t.get("SELECT COUNT(*) AS n FROM market_offers WHERE seller_id = ? AND status = 'open'", [u.id])).n);
    if (open >= M.MAX_OPEN) fail(`Możesz mieć najwyżej ${M.MAX_OPEN} aktywnych ofert.`);
    if (u[o.sellRes] < o.sellAmt) fail(`Za mało surowca w magazynie (${resName(o.sellRes)}: ${Math.floor(u[o.sellRes])}). Zbierz surowce.`);
    await t.run(`UPDATE users SET ${o.sellRes} = ${o.sellRes} - ? WHERE id = ?`, [o.sellAmt, u.id]);
    const id = await t.insert(`INSERT INTO market_offers (seller_id, sell_res, sell_amt, buy_res, buy_amt, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [u.id, o.sellRes, o.sellAmt, o.buyRes, o.buyAmt, now, now + M.TTL_MS]);
    return { msg: `Wystawiono ofertę: ${R.RESOURCES[o.sellRes].icon}${o.sellAmt} za ${R.RESOURCES[o.buyRes].icon}${o.buyAmt}. Surowce trafiły do depozytu.`, data: { offerId: id } };
  }));
  app.post('/rynek/anuluj/:id', auth, action('/rynek', async (t, u, now, req) => {
    const o = await t.get("SELECT * FROM market_offers WHERE id = ? AND seller_id = ? AND status = 'open'", [Number(req.params.id) || 0, u.id]);
    if (!o) fail('Nie ma takiej aktywnej oferty.');
    await t.run("UPDATE market_offers SET status = 'cancelled', closed_at = ? WHERE id = ?", [now, o.id]);
    await t.run(`UPDATE users SET ${o.sell_res} = ${o.sell_res} + ? WHERE id = ?`, [o.sell_amt, u.id]);
    return { msg: `Oferta wycofana – zwrócono ${R.RESOURCES[o.sell_res].icon}${o.sell_amt}.` };
  }));
  app.post('/rynek/kup/:id', auth, action('/rynek', async (t, u, now, req) => {
    if (u.level < M.MIN_LEVEL) fail(`Rynek jest dostępny od poziomu ${M.MIN_LEVEL}.`);
    const o = await t.get("SELECT * FROM market_offers WHERE id = ? AND status = 'open'", [Number(req.params.id) || 0]);
    if (!o || o.expires_at <= now) fail('Oferta jest już nieaktualna.');
    if (o.seller_id === u.id) fail('Nie możesz kupić własnej oferty.');
    if (await linked(t, u.id, o.seller_id, now)) fail('Handel zablokowany: to konto korzystało z tego samego połączenia lub urządzenia co sprzedawca (ochrona przed multikontami).');
    const today = Number((await t.get('SELECT COUNT(*) AS n FROM market_offers WHERE buyer_id = ? AND closed_at > ?', [u.id, now - 86400_000])).n);
    if (today >= M.MAX_BUYS_DAY) fail(`Limit ${M.MAX_BUYS_DAY} zakupów na dobę – wróć później.`);
    if (u[o.buy_res] < o.buy_amt) fail(`Za mało surowca: potrzeba ${R.RESOURCES[o.buy_res].icon}${o.buy_amt}.`);
    const upd = await t.run("UPDATE market_offers SET status = 'sold', buyer_id = ?, closed_at = ? WHERE id = ? AND status = 'open'", [u.id, now, o.id]);
    if (!upd.changes) fail('Ktoś był szybszy – oferta już sprzedana.');
    const gets = M.sellerGets(o.buy_amt);
    if (o.buy_res === o.sell_res) fail('Błędna oferta.');
    await t.run(`UPDATE users SET ${o.buy_res} = ${o.buy_res} - ?, ${o.sell_res} = ${o.sell_res} + ? WHERE id = ?`, [o.buy_amt, o.sell_amt, u.id]);
    await t.run(`UPDATE users SET ${o.buy_res} = ${o.buy_res} + ? WHERE id = ?`, [gets, o.seller_id]);
    fire(() => N.send(o.seller_id, { title: 'Rynek: oferta sprzedana', body: `${u.username} kupił ${o.sell_amt} (${resName(o.sell_res)}). Otrzymujesz ${gets} (${resName(o.buy_res)}) po podatku.`, url: '/rynek', tag: 'market' }));
    return { msg: `Kupiono ${R.RESOURCES[o.sell_res].icon}${o.sell_amt} za ${R.RESOURCES[o.buy_res].icon}${o.buy_amt}.`, data: { got: { [o.sell_res]: o.sell_amt }, paid: { [o.buy_res]: o.buy_amt }, sellerGets: gets } };
  }));
}
