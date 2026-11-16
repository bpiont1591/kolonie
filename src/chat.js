// Czat: normalizacja tekstu, limity, prosty filtr wulgaryzmów (czyste funkcje).
export const MAX_LEN = 200;
export const MIN_GAP_MS = 2000;
export const BURST = { n: 6, ms: 30_000 };
const ROOTS = ['kurw', 'chuj', 'huj', 'pierdol', 'pierdal', 'jeb', 'pizd', 'kutas', 'cwel', 'dziwk', 'skurw', 'fuck', 'shit', 'cunt', 'bitch'];
const BAD = new RegExp(`[\\p{L}]*(?:${ROOTS.join('|')})[\\p{L}]*`, 'giu');
/** Zwraca {text} albo {error}. */
export function clean(raw) {
  let t = String(raw ?? '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return { error: 'Wiadomość jest pusta.' };
  if ([...t].length > MAX_LEN) return { error: `Wiadomość może mieć maks. ${MAX_LEN} znaków.` };
  t = t.replace(BAD, (w) => w[0] + '*'.repeat(Math.max(2, [...w].length - 1)));
  return { text: t };
}
/** Limiter: zwraca komunikat błędu albo null. */
export function limiter() {
  const hist = new Map();
  return (key, now = Date.now()) => {
    const h = (hist.get(key) || []).filter((x) => now - x < BURST.ms);
    if (h.length && now - h[h.length - 1] < MIN_GAP_MS) return 'Zwolnij – odczekaj chwilę przed kolejną wiadomością.';
    if (h.length >= BURST.n) return 'Za dużo wiadomości. Odczekaj pół minuty.';
    h.push(now); hist.set(key, h);
    if (hist.size > 5000) hist.delete(hist.keys().next().value);
    return null;
  };
}
