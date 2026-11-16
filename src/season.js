// Sezony: miesięczny ranking, przepustka sezonowa (30 poziomów), nagrody i odznaki na koniec sezonu (czyste reguły).
export const LEVELS = 30;
export const XP_PER_LEVEL = 150;
/** XP sezonu za zdarzenia gry (te same zdarzenia, co misje). */
export const EV_XP = { win: 12, pve: 3, pvp: 5, build: 8, module: 8, expedition: 15, boss: 4, login: 20, collect: 2, arena: 10 };
export const QUEST_XP = { daily: 30, weekly: 80, chest: 50 };

export const level = (xp) => Math.min(LEVELS, Math.floor(xp / XP_PER_LEVEL));
export function progress(xp) {
  const lv = level(xp);
  return { level: lv, inLevel: lv >= LEVELS ? XP_PER_LEVEL : xp - lv * XP_PER_LEVEL, need: XP_PER_LEVEL, max: lv >= LEVELS };
}
export function xpFor(events) {
  let s = 0;
  for (const [ev, amt] of Object.entries(events)) if (EV_XP[ev] && amt > 0) s += EV_XP[ev] * Math.min(amt, 50);
  return s;
}

/** Nagroda ścieżki darmowej za poziom n (bazowa, skalowana poziomem gracza przy odbiorze). */
export function passReward(n) {
  const r = { metal: 120 + 25 * n, crystal: 50 + 12 * n };
  if (n % 5 === 0) { r.energy = 100 + 10 * n; r.xp = 20 + 2 * n; }
  if (n === 10 || n === 20 || n === 30) r.core = 1;
  return r;
}
/** Ścieżka Premium – tylko podgląd (zablokowana, bez płatności). */
export function premiumPreview(n) {
  return n % 5 === 0 ? { label: n === 30 ? 'Skórka statku' : 'Ramka avatara' } : { label: 'Pakiet surowców' };
}

export const BADGES = {
  gold: { name: 'Mistrz sezonu', icon: 'medal_gold' },
  silver: { name: 'Wicemistrz sezonu', icon: 'medal_silver' },
  bronze: { name: 'Brąz sezonu', icon: 'medal_bronze' },
  top10: { name: 'Top 10 sezonu', icon: 'season' },
  pass: { name: 'Przepustka ukończona', icon: 'season' },
};
export const badgeForRank = (rank) => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'top10');
/** Nagrody za miejsce w rankingu sezonu (top 10). */
export function rankReward(rank) {
  if (rank === 1) return { metal: 5000, crystal: 3000, energy: 2000, xp: 300, core: 1 };
  if (rank === 2) return { metal: 3500, crystal: 2000, energy: 1500, xp: 200, core: 1 };
  if (rank === 3) return { metal: 2500, crystal: 1500, energy: 1000, xp: 150 };
  return { metal: 1200, crystal: 800, energy: 500, xp: 80 };
}
export const AWARD_TOP = 10;
