// Etap v5/3: arena PvP – turniej pucharowy co 4 h (czyste reguły: drabinka, symulacja, nagrody).
import * as R from './rules.js';

export const ENTRY_ENERGY = 10;
export const MIN_LEVEL = 2;
export const MAX_PLAYERS = 32;
export const SEASON_XP = { 1: 120, 2: 80, 3: 50, other: 20 };

/** Kolejność rozstawień w drabince rozmiaru n (1 i 2 spotkają się dopiero w finale). */
export function seedOrder(n) {
  let order = [1];
  while (order.length < n) {
    const m = order.length * 2 + 1;
    order = order.flatMap((s) => [s, m - s]);
  }
  return order;
}
export const bracketSize = (n) => { let s = 2; while (s < n) s *= 2; return s; };
export function roundName(roundIdx, rounds) {
  const left = rounds - roundIdx; // 1 = finał
  if (left === 1) return 'Finał';
  if (left === 2) return 'Półfinał';
  if (left === 3) return 'Ćwierćfinał';
  return `1/${2 ** (left - 1)} finału`;
}
/** Nagroda za miejsce (bazowa – skalowana poziomem gracza). place: 1, 2, 3 (półfinał), 5 (ćwierćfinał) … */
export function placeReward(place) {
  if (place === 1) return { metal: 1500, crystal: 800, energy: 300, xp: 150 };
  if (place === 2) return { metal: 900, crystal: 500, energy: 200, xp: 90 };
  if (place === 3) return { metal: 500, crystal: 300, energy: 100, xp: 50 };
  if (place === 5) return { metal: 300, crystal: 150, energy: 50, xp: 30 };
  return { metal: 150, crystal: 80, xp: 15 };
}
export const placeLabel = (place) => (place === 1 ? '1. miejsce' : place === 2 ? '2. miejsce' : place === 3 ? '3.–4. miejsce' : place === 5 ? '5.–8. miejsce' : `${place}.–${place * 2 - 1}. miejsce`);
export const seasonXpFor = (place) => SEASON_XP[place] ?? SEASON_XP.other;

/**
 * Rozgrywa cały turniej. players: [{id, name, level, stats:{maxHp, atk, def}}] (dowolna kolejność).
 * Zwraca { size, rounds: [[{a, b, w, n}]], places: Map(id -> miejsce) }; a/b = {id, name, level, seed} lub null (wolny los).
 */
export function runTournament(players, rnd = Math.random) {
  const seeded = [...players].sort((x, y) => R.power(y.u) - R.power(x.u) || x.id - y.id).map((p, i) => ({ ...p, seed: i + 1 }));
  const size = bracketSize(seeded.length);
  let slots = seedOrder(size).map((s) => seeded[s - 1] || null);
  const rounds = [];
  const places = new Map();
  const total = Math.log2(size);
  for (let r = 0; r < total; r++) {
    const matches = [], next = [];
    for (let i = 0; i < slots.length; i += 2) {
      const a = slots[i], b = slots[i + 1];
      let w = null, n = 0;
      if (a && b) {
        const sim = R.simulate({ name: a.name, hp: a.stats.maxHp, ...a.stats }, { name: b.name, hp: b.stats.maxHp, ...b.stats }, rnd);
        w = sim.aWon ? a : b; n = sim.rounds;
        const loser = sim.aWon ? b : a;
        places.set(loser.id, 2 ** (total - r - 1) + 1); // finał -> 2, półfinał -> 3, ćwierćfinał -> 5 …
      } else w = a || b;
      matches.push({ a: a && pick(a), b: b && pick(b), w: w ? w.id : null, n });
      next.push(w);
    }
    rounds.push(matches);
    slots = next;
  }
  if (slots[0]) places.set(slots[0].id, 1);
  return { size, rounds, places };
}
const pick = (p) => ({ id: p.id, name: p.name, level: p.level, seed: p.seed, title: p.title || '' });
