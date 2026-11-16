// Etap v5/5: administracja i ochrona przed botami (czyste reguły).
/** Lista nicków adminów z env ADMIN_USERS („nick1,nick2”) – porównanie bez wielkości liter. */
export const adminList = (env = process.env.ADMIN_USERS) => new Set(String(env || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
export const isAdmin = (u, list = adminList()) => !!u && (u.role === 'admin' || list.has(String(u.name_key || u.username || '').toLowerCase()));
export const isBanned = (u, now = Date.now()) => !!u && u.banned_until > now;
export const PERMANENT = 9_000_000_000_000_000;
export const BAN_DAYS = [1, 3, 7, 30, 0]; // 0 = na stałe

export const REG_PER_IP_DAY = 3;      // maks. nowych kont z jednego IP na dobę
export const POST_PER_MIN = 90;       // maks. żądań POST z jednego IP na minutę
export const HONEYPOT_FIELD = 'website';
export const MIN_FORM_MS = 1500;      // formularz wysłany szybciej = bot

/** Limiter okna przesuwnego: hit(key, now) -> true, gdy limit przekroczony. */
export function windowLimiter(limit, windowMs) {
  const m = new Map();
  return {
    hit(key, now = Date.now()) {
      const a = (m.get(key) || []).filter((t) => now - t < windowMs);
      a.push(now);
      m.set(key, a);
      if (m.size > 20_000) for (const [k, v] of m) if (!v.length || now - v[v.length - 1] > windowMs) m.delete(k);
      return a.length > limit;
    },
  };
}
/** Sprawdzenie pułapki na boty w formularzu rejestracji; zwraca powód albo null. */
export function honeypot(body, now = Date.now()) {
  if (String(body?.[HONEYPOT_FIELD] || '').trim()) return 'wypełnione ukryte pole';
  const ts = Number(body?.ts);
  if (ts && now - ts < MIN_FORM_MS) return `formularz wysłany po ${now - ts} ms`;
  return null;
}
export const ANN_KINDS = { info: 'Informacja', event: 'Wydarzenie', warn: 'Ważne' };
