// Wydarzenia czasowe: definicje i harmonogram (czas Europe/Warsaw). Czyste funkcje – bez bazy i bez crona.
import { dayKey, dayNum } from './time.js';

export const KINDS = {
  inwazja: { id: 'inwazja', name: 'Inwazja obcych', short: 'Inwazja', art: 'ev_inwazja', cls: 'ev-inv',
    desc: 'Flota Xeno przebija się przez szczelinę! Walcz z najeźdźcami, piratami i w kampanii, wysyłaj ekspedycje – każdy punkt przybliża cały serwer do zwycięstwa.' },
  lupy: { id: 'lupy', name: 'Podwójne łupy', short: '2× łupy', art: 'ev_lupy', cls: 'ev-loot',
    desc: 'Metal i kryształy z walk z piratami, najeźdźcami i misji kampanii ×2.' },
  happy: { id: 'happy', name: 'Happy hour ekspedycji', short: 'Happy hour', art: 'ev_happy', cls: 'ev-happy',
    desc: 'Ekspedycje wysłane w trakcie wydarzenia przywożą podwójne łupy.' },
};
/** Harmonogram (dzień tygodnia: 0 = poniedziałek). Wszystkie godziny w Warszawie. */
export const SCHEDULE = [
  { kind: 'inwazja', day: 5, from: 10, toDay: 6, to: 22, label: 'co weekend: sobota 10:00 – niedziela 22:00' },
  { kind: 'lupy', day: 2, from: 18, toDay: 2, to: 22, label: 'w środy 18:00 – 22:00' },
  { kind: 'happy', day: null, from: 20, toDay: null, to: 21, label: 'codziennie 20:00 – 21:00' },
];
export const POINTS = { pirate: 1, xeno: 3, campaign: 2, boss: 5, expedition: 3, pvp: 2 };
export const XENO = { id: 'xeno', name: 'Najeźdźca Xeno', icon: '👾', minLvl: 1, mult: 0.72, energy: 10, desc: 'Chitynowy okręt obcych.' };
export const CLAIM_DAYS = 3;
export const MIN_POINTS = 5;
export function invasionReward(success, points) {
  if (points < MIN_POINTS) return null;
  if (!success) return { metal: 250, crystal: 60 };
  return points >= 25 ? { metal: 600, crystal: 250, core: 1 } : { metal: 300, crystal: 100, core: 1 };
}
export const invasionGoal = (activePlayers) => Math.max(150, 40 * activePlayers);

const fmtClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
/** Początek doby (północ w Warszawie) zawierającej ts. */
export function dayStart(ts) {
  const [h, m, s] = fmtClock.format(ts).split(':').map(Number);
  return ts - ((h * 3600 + m * 60 + s) * 1000 + (ts % 1000));
}
/** Chwila „godzina h” w dniu przesuniętym o k dni względem dnia ts (odporna na zmianę czasu). */
// liczone od lokalnej doby wskazanej chwili – godziny po zmianie czasu (≥3:00) wypadają poprawnie
const at = (ts, k, h) => dayStart(dayStart(ts) + k * 86400_000 + 12 * 3600_000) + h * 3600_000;
export const weekday = (ts) => (((dayNum(ts) - 4) % 7) + 7) % 7;

/** Wystąpienia zaplanowanych wydarzeń przecinające okno [from, to). */
export function occurrences(from, to) {
  const out = [];
  for (let k = -2; k <= Math.ceil((to - from) / 86400_000) + 1; k++) {
    const base = dayStart(from) + k * 86400_000 + 12 * 3600_000; // południe dnia k
    const wd = weekday(base);
    for (const r of SCHEDULE) {
      if (r.day !== null && wd !== r.day) continue;
      const starts = at(base, 0, r.from), ends = at(base, r.toDay === null ? 0 : r.toDay - r.day, r.to);
      if (ends > from && starts < to) out.push({ kind: r.kind, key: `${r.kind}:${dayKey(base)}`, starts, ends });
    }
  }
  return out.sort((a, b) => a.starts - b.starts);
}
export const activeScheduled = (now) => occurrences(now, now + 1).filter((o) => o.starts <= now && o.ends > now);
export const upcoming = (now, n = 4) => occurrences(now, now + 8 * 86400_000).filter((o) => o.starts > now).slice(0, n);
