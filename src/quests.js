// Nagrody za logowanie, misje dzienne i tygodniowe – czyste reguły (bez bazy).
import { dayNum } from './time.js';

/** Kalendarz 7 dni – nagrody bazowe (skalowane poziomem gracza). Dzień 7: Rdzeń kwantowy. */
export const LOGIN_REWARDS = [
  { metal: 200 },
  { crystal: 120 },
  { energy: 150 },
  { metal: 400, crystal: 200 },
  { crystal: 300, energy: 200 },
  { metal: 600, energy: 300, xp: 40 },
  { metal: 1000, crystal: 600, energy: 500, xp: 100, core: 1 },
];
export const CORE = { name: 'Rdzeń kwantowy', hours: 24, bonus: 0.5, desc: '+50% wydobycia przez 24 h' };

// ev: nazwa zdarzenia śledzonego po stronie serwera
export const DAILY_POOL = [
  { id: 'win3', ev: 'win', goal: 3, name: 'Wygraj 3 bitwy', icon: 'trophy', r: { metal: 250, crystal: 100, xp: 25 } },
  { id: 'pve4', ev: 'pve', goal: 4, name: 'Stocz 4 bitwy z piratami', icon: 'defeat', r: { metal: 200, energy: 120, xp: 20 } },
  { id: 'build1', ev: 'build', goal: 1, name: 'Ulepsz dowolny budynek', icon: 'collect', r: { metal: 300, crystal: 120 } },
  { id: 'module1', ev: 'module', goal: 1, name: 'Ulepsz moduł statku', icon: 'guns', r: { crystal: 150, energy: 100 } },
  { id: 'metal', ev: 'metal', goal: 800, name: 'Zbierz 800 metalu', icon: 'r_metal', r: { crystal: 150, energy: 150 } },
  { id: 'collect3', ev: 'collect', goal: 3, name: 'Zbierz surowce 3 razy', icon: 'collect', r: { metal: 200, crystal: 80, energy: 80 } },
  { id: 'pvp1', ev: 'pvp', goal: 1, name: 'Zaatakuj innego gracza', icon: 'pvp', r: { metal: 300, energy: 150, xp: 25 } },
  { id: 'energy', ev: 'energy', goal: 50, name: 'Zużyj 50 energii w bitwach', icon: 'r_energy', r: { metal: 250, crystal: 120 } },
];
export const DAILY_COUNT = 4;
export const WEEKLY = [
  { id: 'w_win', ev: 'win', goal: 25, name: 'Wygraj 25 bitew', icon: 'trophy', r: { metal: 1500, crystal: 600, xp: 120 } },
  { id: 'w_upg', ev: 'upgrade', goal: 8, name: 'Wykonaj 8 ulepszeń', icon: 'power', r: { metal: 1200, crystal: 800 } },
  { id: 'w_metal', ev: 'metal', goal: 8000, name: 'Zbierz 8000 metalu', icon: 'r_metal', r: { crystal: 900, energy: 700 } },
  { id: 'w_pvp', ev: 'pvp', goal: 8, name: 'Zaatakuj graczy 8 razy', icon: 'pvp', r: { metal: 1500, energy: 600, xp: 100 } },
];
export const POINTS = { daily: 10, weekly: 25 };
/** Skrzynie tygodniowe za punkty misji. */
export const CHESTS = [
  { pts: 50, name: 'Skrzynia brązowa', r: { metal: 800, crystal: 400, energy: 300 } },
  { pts: 120, name: 'Skrzynia srebrna', r: { metal: 2000, crystal: 1000, energy: 800, xp: 100 } },
  { pts: 200, name: 'Skrzynia złota', r: { metal: 4000, crystal: 2000, energy: 1500, xp: 300, core: 1 } },
];

/** Mnożnik nagród zależny od poziomu gracza. */
export const levelMult = (level) => 1 + 0.15 * (level - 1);
export function scale(r, level) {
  const m = levelMult(level), out = {};
  for (const [k, v] of Object.entries(r)) out[k] = k === 'core' ? v : Math.round(v * m);
  return out;
}

/** Deterministyczny wybór misji dnia (taki sam dla wszystkich graczy). */
export function dailyQuests(now) {
  let seed = dayNum(now) * 2654435761 % 4294967296;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pool = [...DAILY_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, DAILY_COUNT);
}

/** Stan kalendarza logowań. */
export function loginState(u, now) {
  const today = dayNum(now);
  const claimedToday = u.login_day === today;
  const continuing = u.login_day === today - 1;
  const next = claimedToday ? (u.login_streak % 7) + 1 : continuing ? (u.login_streak % 7) + 1 : 1;
  const broken = !claimedToday && !continuing && u.login_day > 0;
  // dni oznaczone jako odebrane w bieżącym cyklu
  const doneUpTo = claimedToday ? u.login_streak : continuing ? u.login_streak % 7 : 0;
  return { today, claimedToday, next, broken, doneUpTo, streak: claimedToday || continuing ? u.login_streak : 0 };
}
