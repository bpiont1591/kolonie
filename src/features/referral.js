// Etap v5/4: zaproszenia – link polecający, nagrody dla obu graczy po osiągnięciu poziomu 5 przez zaproszonego.
import crypto from 'node:crypto';
import * as RF from '../referral.js';
import * as G from '../game.js';
import { linked } from '../security.js';
import { N, fire } from '../notify.js';
import * as VM from '../views-market.js';

const rnd = () => crypto.randomInt(1 << 30) / (1 << 30);
export async function ensureCode(db, u) {
  if (u.ref_code) return u.ref_code;
  for (let i = 0; i < 5; i++) {
    const code = RF.newCode(rnd);
    try {
      const r = await db.run('UPDATE users SET ref_code = ? WHERE id = ? AND ref_code IS NULL', [code, u.id]);
      if (r.changes) return code;
      return (await db.get('SELECT ref_code FROM users WHERE id = ?', [u.id])).ref_code;
    } catch { /* kolizja kodu – losujemy ponownie */ }
  }
  throw new Error('Nie udało się wygenerować kodu polecającego.');
}
export const findInviter = (db, code) => (RF.CODE_RE.test(String(code || '')) ? db.get('SELECT id, username FROM users WHERE ref_code = ?', [code]) : Promise.resolve(null));

/** Po akcji: nagroda za zaproszenie, gdy zaproszony osiągnął poziom 5 (w transakcji). Zwraca komunikat lub ''. */
export async function checkReferral(t, userId, now) {
  const u = await t.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!u?.referred_by || u.ref_state !== RF.STATE.pending || u.level < RF.LEVEL) return '';
  const inv = await t.get('SELECT * FROM users WHERE id = ?', [u.referred_by]);
  if (!inv) { await t.run('UPDATE users SET ref_state = ? WHERE id = ?', [RF.STATE.blocked, u.id]); return ''; }
  if (await linked(t, u.id, inv.id, now)) {
    await t.run('UPDATE users SET ref_state = ? WHERE id = ?', [RF.STATE.blocked, u.id]);
    return 'Nagroda za zaproszenie zablokowana: konta korzystały z tego samego połączenia lub urządzenia.';
  }
  const done = Number((await t.get('SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND ref_state = ?', [inv.id, RF.STATE.rewarded])).n);
  if (done >= RF.MAX_REWARDED) { await t.run('UPDATE users SET ref_state = ? WHERE id = ?', [RF.STATE.limit, u.id]); return ''; }
  await t.run('UPDATE users SET ref_state = ? WHERE id = ?', [RF.STATE.rewarded, u.id]);
  const mine = await G.grant(t, u, now, RF.INVITEE_REWARD);
  const theirs = await G.grant(t, inv, now, RF.INVITER_REWARD);
  fire(() => N.send(inv.id, { title: 'Nagroda za zaproszenie!', body: `${u.username} osiągnął poziom ${RF.LEVEL}. Otrzymujesz: ${G.rewardText(theirs)}`, url: '/zaproszenia', tag: 'ref' }));
  return `Poziom ${RF.LEVEL}! Nagroda za dołączenie z zaproszenia ${inv.username}: ${G.rewardText(mine)}`;
}

export default function registerReferral({ app, db, auth, page, baseUrl }) {
  const data = async (req) => {
    const code = await ensureCode(db, req.user);
    const invited = await db.all('SELECT id, username, level, ref_state, created_at FROM users WHERE referred_by = ? ORDER BY id DESC LIMIT 50', [req.user.id]);
    return { code, link: `${baseUrl(req)}/?ref=${code}`, invited };
  };
  app.get('/zaproszenia', auth, page(async (req, now, st) => VM.referrals({ user: req.user, st, flash: req.flash, ...(await data(req)), now })));
  app.get('/api/zaproszenia', auth, async (req, res, next) => {
    try {
      const d = await data(req);
      res.set('Cache-Control', 'no-store').json({ ok: true, code: d.code, link: d.link, level: RF.LEVEL,
        invited: d.invited.map((i) => ({ id: Number(i.id), username: i.username, level: i.level, state: i.ref_state })) });
    } catch (e) { next(e); }
  });
}
