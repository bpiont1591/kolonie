// Bezpieczeństwo: token administracyjny (testy/sprzątanie), sprzątanie kont testowych.
import crypto from 'node:crypto';

/** Porównanie w stałym czasie z ADMIN_TOKEN (min. 24 znaki; bez tokenu – zawsze false). */
export function adminTokenOk(given) {
  const want = process.env.ADMIN_TOKEN || '';
  if (want.length < 24 || typeof given !== 'string' || !given) return false;
  const a = crypto.createHash('sha256').update(given).digest(), b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Usuwa konta oznaczone is_test = 1 wraz z powiązanymi rekordami (sesje, bitwy, misje, czat, push… – kaskadowo).
 * Korporacje założone przez konta testowe: bez prawdziwych członków – usuwane; z prawdziwymi – dowodzenie
 * przechodzi na najwyższego rangą prawdziwego członka.
 */
export async function purgeTestUsers(t) {
  const corps = await t.all('SELECT c.id FROM corps c JOIN users u ON u.id = c.owner_id WHERE u.is_test = 1');
  let corpsDeleted = 0;
  for (const c of corps) {
    const heir = await t.get('SELECT id FROM users WHERE corp_id = ? AND is_test = 0 ORDER BY level DESC, xp DESC, id ASC LIMIT 1', [c.id]);
    if (heir) {
      await t.run('UPDATE corps SET owner_id = ? WHERE id = ?', [heir.id, c.id]);
      await t.run("UPDATE users SET corp_role = 'leader' WHERE id = ?", [heir.id]);
    } else {
      await t.run('UPDATE users SET corp_id = NULL WHERE corp_id = ?', [c.id]);
      await t.run('DELETE FROM corps WHERE id = ?', [c.id]);
      corpsDeleted++;
    }
  }
  await t.run("DELETE FROM admin_log WHERE admin IN (SELECT username FROM users WHERE is_test = 1) OR target LIKE '[test]%'");
  await t.run("DELETE FROM flags WHERE detail LIKE '[test]%'");
  await t.run("DELETE FROM announcements WHERE audience = 'test'");
  await t.run('DELETE FROM events WHERE test = 1');
  const ids = (await t.all('SELECT id FROM users WHERE is_test = 1')).map((r) => r.id);
  for (const id of ids) await t.run('DELETE FROM users WHERE id = ?', [id]);
  return { users: ids.length, corps: corpsDeleted };
}

// ---------- śledzenie IP/urządzeń (ochrona przed multikontami) ----------
// IP i identyfikator urządzenia zapisujemy wyłącznie jako skróty HMAC z losową solą trzymaną w bazie.
let salt = null;
export async function getSalt(db) {
  if (salt) return salt;
  let r = await db.get("SELECT v FROM app_meta WHERE k = 'salt'");
  if (!r) {
    await db.run("INSERT INTO app_meta (k, v) VALUES ('salt', ?) ON CONFLICT (k) DO NOTHING", [crypto.randomBytes(24).toString('base64url')]);
    r = await db.get("SELECT v FROM app_meta WHERE k = 'salt'");
  }
  salt = r.v;
  return salt;
}
export const hashId = (s, value) => crypto.createHmac('sha256', s).update(String(value)).digest('base64url').slice(0, 22);
/** Testy automatyczne (z ważnym tokenem) mogą podać sztuczne IP/urządzenie, by symulować różnych graczy. */
const testOverride = (req, h) => (adminTokenOk(req.get('x-kolonie-test')) ? req.get(h) : null);
export const clientIp = (req) => (testOverride(req, 'x-test-ip') ? 'test:' + testOverride(req, 'x-test-ip') : req.ip || '?');
export const clientDevice = (req) => (testOverride(req, 'x-test-device') ? 'test:' + testOverride(req, 'x-test-device') : req.did || '?');
export async function fingerprint(db, req) {
  const s = await getSalt(db);
  return { ip: hashId(s, clientIp(req)), device: hashId(s, 'd:' + clientDevice(req)) };
}
const seen = new Map();
/** Zapisuje parę IP/urządzenie gracza (co najwyżej raz na 10 min na parę). */
export async function recordSeen(db, userId, req, now = Date.now()) {
  const fp = await fingerprint(db, req);
  const key = `${userId}|${fp.ip}|${fp.device}`;
  if (now - (seen.get(key) || 0) < 10 * 60_000) return fp;
  seen.set(key, now);
  if (seen.size > 50_000) seen.clear();
  await db.run(`INSERT INTO user_ips (user_id, ip_hash, device, first_at, last_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id, ip_hash, device) DO UPDATE SET last_at = excluded.last_at`, [userId, fp.ip, fp.device, now, now]);
  return fp;
}
export const LINK_WINDOW_MS = 30 * 86400_000;
/** Czy dwa konta dzieliły IP lub urządzenie w ostatnich 30 dniach. */
export async function linked(q, a, b, now = Date.now()) {
  if (a === b) return true;
  const r = await q.get(`SELECT 1 AS x FROM user_ips x JOIN user_ips y ON (x.ip_hash = y.ip_hash OR x.device = y.device)
    WHERE x.user_id = ? AND y.user_id = ? AND x.last_at > ? AND y.last_at > ? LIMIT 1`, [a, b, now - LINK_WINDOW_MS, now - LINK_WINDOW_MS]);
  return !!r;
}
/** Konta powiązane z graczem (wspólne IP lub urządzenie). */
export async function linkedAccounts(q, userId, now = Date.now()) {
  return q.all(`SELECT u.id, u.username, u.level, u.is_test,
      MAX(CASE WHEN x.ip_hash = y.ip_hash THEN 1 ELSE 0 END) AS same_ip, MAX(CASE WHEN x.device = y.device THEN 1 ELSE 0 END) AS same_device
    FROM user_ips x JOIN user_ips y ON (x.ip_hash = y.ip_hash OR x.device = y.device) AND y.user_id <> x.user_id
    JOIN users u ON u.id = y.user_id
    WHERE x.user_id = ? AND x.last_at > ? AND y.last_at > ? GROUP BY u.id, u.username, u.level, u.is_test ORDER BY u.id`, [userId, now - LINK_WINDOW_MS, now - LINK_WINDOW_MS]);
}
