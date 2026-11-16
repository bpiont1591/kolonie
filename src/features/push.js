// Etap 4: Web Push (VAPID). Klucze wyłącznie ze zmiennych środowiskowych – nigdy w repozytorium ani w logach.
import webpush from 'web-push';
import * as R from '../rules.js';
import { N } from '../notify.js';

const SCAN_MS = 60_000;
const MAX_SUBS = 5;
const B64U = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

export default function registerPush({ app, db, auth }) {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  let enabled = false;
  if (pub && priv) {
    try { webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@kolonie.invalid', pub, priv); enabled = true; }
    catch (e) { console.error('Web Push wyłączony: niepoprawne klucze VAPID.'); }
  }
  registerPush.enabled = enabled;

  /** Wysyła powiadomienie na wszystkie urządzenia gracza; zwraca liczbę udanych wysyłek. */
  async function send(userId, payload) {
    if (!enabled) return 0;
    const subs = await db.all('SELECT id, endpoint, p256dh, auth FROM push_subs WHERE user_id = ?', [userId]);
    let ok = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, timeout: 8000 });
        ok++;
      } catch (e) {
        // wygasła subskrypcja (urządzenie wypisane) – usuwamy martwy adres
        if (e.statusCode === 404 || e.statusCode === 410) await db.run('DELETE FROM push_subs WHERE id = ?', [s.id]).catch(() => {});
      }
    }));
    return ok;
  }
  async function toCorp(corpId, exceptUserId, payload) {
    if (!enabled) return 0;
    const ms = await db.all('SELECT DISTINCT p.user_id FROM push_subs p JOIN users u ON u.id = p.user_id WHERE u.corp_id = ? AND u.id <> ?', [corpId, exceptUserId || 0]);
    let n = 0;
    for (const m of ms) n += await send(Number(m.user_id), payload);
    return n;
  }
  /** Do wszystkich subskrybentów (testOnly – tylko konta testowe). */
  async function toAll(payload, testOnly = false) {
    if (!enabled) return 0;
    const ms = await db.all(`SELECT DISTINCT p.user_id FROM push_subs p JOIN users u ON u.id = p.user_id WHERE u.is_test = ? OR ? = 0 LIMIT 1000`, [testOnly ? 1 : 0, testOnly ? 1 : 0]);
    let n = 0;
    for (const m of ms) n += await send(Number(m.user_id), payload);
    return n;
  }
  N.send = send; N.toCorp = toCorp; N.toAll = toAll;

  // Skaner (co minutę): zakończone budowy/moduły, powrót z ekspedycji, pełny magazyn – dla graczy z subskrypcją.
  let scanning = false;
  async function scan(now = Date.now()) {
    if (!enabled || scanning) return 0;
    scanning = true;
    let sent = 0;
    try {
      const full = now - R.STORAGE_MINUTES * 60_000;
      const us = await db.all(`SELECT u.* FROM users u WHERE u.id IN (SELECT user_id FROM push_subs) AND (
        (u.bq_id IS NOT NULL AND u.bq_until <= ? AND u.notified_bq <> u.bq_until) OR
        (u.mq_id IS NOT NULL AND u.mq_until <= ? AND u.notified_mq <> u.mq_until) OR
        (u.ex_until > 0 AND u.ex_until <= ? AND u.notified_ex <> u.ex_until) OR
        (u.collected_at <= ? AND u.notified_storage <> u.collected_at)) LIMIT 200`, [now, now, now, full]);
      for (const u of us) {
        const msgs = [], set = {};
        if (u.bq_id && u.bq_until <= now && u.notified_bq !== u.bq_until) {
          const d = R.BUILDINGS[u.bq_id];
          if (d) msgs.push({ title: 'Budowa ukończona', body: `${d.name} – poziom ${u[d.col] + 1}. Zajrzyj do kolonii!`, url: '/kolonia', tag: 'build' });
          set.notified_bq = u.bq_until;
        }
        if (u.mq_id && u.mq_until <= now && u.notified_mq !== u.mq_until) {
          const d = R.MODULES[u.mq_id];
          if (d) msgs.push({ title: 'Moduł zamontowany', body: `${d.name} – poziom ${u[d.col] + 1}. Statek gotowy do lotu.`, url: '/statek', tag: 'module' });
          set.notified_mq = u.mq_until;
        }
        if (u.ex_until > 0 && u.ex_until <= now && u.notified_ex !== u.ex_until) {
          msgs.push({ title: 'Statek wrócił z ekspedycji', body: 'Sprawdź raport i odbierz łupy.', url: '/ekspedycje', tag: 'expedition' });
          set.notified_ex = u.ex_until;
        }
        if (u.collected_at <= full && u.notified_storage !== u.collected_at) {
          msgs.push({ title: 'Magazyn wydobycia pełny', body: 'Zbierz surowce – kopalnie przestały produkować.', url: '/kolonia', tag: 'storage' });
          set.notified_storage = u.collected_at;
        }
        const cols = Object.keys(set);
        if (cols.length) await db.run(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => set[c]), u.id]);
        for (const m of msgs) sent += await send(u.id, m);
      }
    } catch (e) { console.error('push scan:', e.message); }
    finally { scanning = false; }
    return sent;
  }
  registerPush.scan = scan;
  if (enabled) setInterval(scan, SCAN_MS).unref();

  const off = (res) => res.status(503).json({ ok: false, msg: 'Powiadomienia są chwilowo niedostępne.' });
  app.get('/api/push/klucz', auth, (req, res) => (enabled ? res.json({ ok: true, key: pub }) : off(res)));

  app.post('/api/push/subskrypcja', auth, async (req, res, next) => {
    try {
      if (!enabled) return off(res);
      const { endpoint, keys } = req.body || {};
      let url;
      try { url = new URL(String(endpoint)); } catch { url = null; }
      if (!url || url.protocol !== 'https:' || String(endpoint).length > 1000 || !B64U.test(keys?.p256dh || '') || !B64U.test(keys?.auth || ''))
        return res.status(400).json({ ok: false, msg: 'Niepoprawna subskrypcja.' });
      const uid = req.user.id, now = Date.now();
      await db.tx(async (t) => {
        await t.run(`INSERT INTO push_subs (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
        [uid, String(endpoint), keys.p256dh, keys.auth, now]);
        const mine = await t.all('SELECT id FROM push_subs WHERE user_id = ? ORDER BY id DESC', [uid]);
        // maks. 5 urządzeń na gracza – najstarsza subskrypcja ustępuje nowej
        for (const s of mine.slice(MAX_SUBS)) await t.run('DELETE FROM push_subs WHERE id = ?', [s.id]);
      });
      // nowa subskrypcja: nie wysyłaj zaległych powiadomień o starym magazynie
      await db.run('UPDATE users SET notified_storage = collected_at WHERE id = ? AND notified_storage = 0', [uid]);
      const n = (await db.get('SELECT COUNT(*) AS n FROM push_subs WHERE user_id = ?', [uid])).n;
      res.json({ ok: true, msg: 'Powiadomienia włączone.', devices: Number(n) });
    } catch (e) { next(e); }
  });

  app.post('/api/push/wypisz', auth, async (req, res, next) => {
    try {
      await db.run('DELETE FROM push_subs WHERE user_id = ? AND endpoint = ?', [req.user.id, String(req.body?.endpoint || '')]);
      res.json({ ok: true, msg: 'Powiadomienia wyłączone na tym urządzeniu.' });
    } catch (e) { next(e); }
  });

  const lastTest = new Map();
  app.post('/api/push/test', auth, async (req, res, next) => {
    try {
      if (!enabled) return off(res);
      const now = Date.now();
      if (now - (lastTest.get(req.user.id) || 0) < 10_000) return res.status(429).json({ ok: false, msg: 'Odczekaj chwilę przed kolejnym testem.' });
      lastTest.set(req.user.id, now);
      const n = await send(req.user.id, { title: 'Kolonie: test łączności', body: 'Powiadomienia działają. Do zobaczenia w sektorze, komandorze!', url: '/kolonia', tag: 'test' });
      res.json({ ok: true, sent: n, msg: n ? 'Wysłano.' : 'Brak aktywnych urządzeń.' });
    } catch (e) { next(e); }
  });
}
