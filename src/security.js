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
  const ids = (await t.all('SELECT id FROM users WHERE is_test = 1')).map((r) => r.id);
  for (const id of ids) await t.run('DELETE FROM users WHERE id = ?', [id]);
  return { users: ids.length, corps: corpsDeleted };
}
