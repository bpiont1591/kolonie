// v7/2: moduły specjalne – rzadkie łupy z bossów (sloty statku, rzadkość, ulepszanie, rozbiór).
export const RARITY = {
  1: { id: 1, key: 'rzadki', name: 'Rzadki', mult: 1, cost: 1, color: '#4da3ff' },
  2: { id: 2, key: 'epicki', name: 'Epicki', mult: 1.6, cost: 1.5, color: '#b26bff' },
  3: { id: 3, key: 'legendarny', name: 'Legendarny', mult: 2.5, cost: 2.2, color: '#ffb340' },
};
/** Definicje: sprite = indeks w public/img/gear.webp (4×3), m = efekt rzadkiego modułu na poziomie 1. minR = minimalna rzadkość. */
const D = (id, sprite, name, desc, m, minR = 1) => ({ id, sprite, name, desc, m, minR });
export const DEFS = [
  D('plazma', 0, 'Rdzeń plazmowy', 'ataku', { atk: 0.04 }),
  D('pancerz', 1, 'Płyta reaktywna', 'obrony', { def: 0.05 }),
  D('kadlub', 2, 'Wręga tytanowa', 'HP kadłuba', { hp: 0.05 }),
  D('tarcza', 3, 'Emiter tarczy', 'tarczy (z maks. HP)', { shield: 0.03 }),
  D('soczewka', 4, 'Soczewka celownicza', 'szansy na krytyk', { crit: 0.025 }),
  D('zyroskop', 5, 'Żyroskop fazowy', 'szansy na unik', { dodge: 0.02 }),
  D('skaner', 6, 'Skaner łupów', 'łupów PvE i z ekspedycji', { pveLoot: 0.05, expLoot: 0.05 }),
  D('wiertlo', 7, 'Wiertło grawitacyjne', 'wydobycia', { prod: 0.03 }),
  D('kondensator', 8, 'Kondensator zerowy', 'mniej energii na walki', { energySave: 0.03 }),
  D('nanokuznia', 9, 'Nanokuźnia', 'maks. HP naprawy co rundę walki', { regen: 0.008 }),
  D('syfon', 10, 'Syfon próżni', 'UNIKAT: zadanych obrażeń wraca jako HP', { leech: 0.05 }, 2),
  D('pryzmat', 11, 'Pryzmat odbicia', 'UNIKAT: otrzymanych obrażeń odbija w napastnika', { thorns: 0.08 }, 2),
];
export const BY_ID = Object.fromEntries(DEFS.map((d) => [d.id, d]));
export const MAX_LEVEL = 10;
export const MAX_ITEMS = 40;
/** Sloty odblokowywane poziomem gracza (najwyższym osiągniętym – prestiż ich nie zabiera). */
export const SLOT_LVLS = [10, 25, 40];
export const slotCount = (u) => SLOT_LVLS.filter((l) => Math.max(u?.level || 1, u?.peak_level || 0) >= l).length;
/** Wartość efektu: baza × rzadkość × (1 + 10% za każdy poziom ulepszenia). */
export const scale = (r, lvl) => RARITY[r].mult * (1 + 0.1 * (lvl - 1));
export function effect(def, r, lvl) {
  const d = BY_ID[def], k = scale(r, lvl), m = {};
  for (const [key, v] of Object.entries(d.m)) m[key] = Math.round(v * k * 10000) / 10000;
  return m;
}
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
export function effectText(def, r, lvl) {
  const d = BY_ID[def], m = effect(def, r, lvl);
  return `+${pct(Object.values(m)[0])} ${d.desc.replace(/^UNIKAT: /, '')}`;
}
/** Koszt ulepszenia z poziomu lvl na lvl+1. */
export const upgradeCost = (r, lvl) => {
  const k = RARITY[r].cost * lvl ** 1.7;
  return { metal: Math.round(600 * k), crystal: Math.round(300 * k), energy: 0 };
};
/** Rozbiór: bazowy odzysk zależny od rzadkości + 50% surowców włożonych w ulepszenia. */
export function salvage(r, lvl) {
  const out = { metal: Math.round(800 * RARITY[r].cost ** 2), crystal: Math.round(400 * RARITY[r].cost ** 2), energy: 0 };
  for (let l = 1; l < lvl; l++) { const c = upgradeCost(r, l); out.metal += Math.round(c.metal / 2); out.crystal += Math.round(c.crystal / 2); }
  return out;
}
/** Źródła łupu: szansa na drop i wagi rzadkości [rzadki, epicki, legendarny]. */
export const SOURCES = {
  boss: { name: 'boss kampanii', chance: 0.35, firstChance: 1, w: [70, 25, 5] },
  bossHard: { name: 'boss kampanii (tryb trudny)', chance: 0.6, firstChance: 1, w: [45, 40, 15] },
  hard: { name: 'misja w trybie trudnym', chance: 0.06, w: [75, 22, 3] },
  raid: { name: 'boss rajdowy', chance: 1, w: [55, 35, 10] },
  raidTop: { name: 'boss rajdowy (najwięcej obrażeń)', chance: 1, w: [30, 45, 25] },
  invasion: { name: 'odparta inwazja', chance: 1, w: [60, 32, 8] },
  xeno: { name: 'najeźdźca obcych', chance: 0.06, w: [80, 18, 2] },
};
/** Losuje moduł ze źródła (lub null). first = pierwsze zwycięstwo (gwarancja). luck mnoży szansę. */
export function roll(src, { first = false, luck = 1, rnd = Math.random } = {}) {
  const s = SOURCES[src];
  if (!s) return null;
  if (rnd() >= Math.min(1, (first && s.firstChance ? s.firstChance : s.chance) * luck)) return null;
  const tot = s.w[0] + s.w[1] + s.w[2];
  let x = rnd() * tot, r = 1;
  for (let i = 0; i < 3; i++) { if ((x -= s.w[i]) < 0) { r = i + 1; break; } }
  const pool = DEFS.filter((d) => d.minR <= r);
  return { def: pool[Math.floor(rnd() * pool.length)].id, rarity: r, level: 1 };
}
export const label = (it) => `${RARITY[it.rarity].name} ${BY_ID[it.def]?.name || it.def}${it.level > 1 ? ` +${it.level - 1}` : ''}`;
/** Zapis założonych modułów w users.gear: „def:rzadkość:poziom” po przecinku. */
export const gearString = (items) => items.filter((i) => BY_ID[i.def]).map((i) => `${i.def}:${i.rarity}:${i.level}`).join(',');
export function gearList(u) {
  return String(u?.gear || '').split(',').map((s) => s.split(':')).filter(([d, r, l]) => BY_ID[d] && RARITY[r] && Number(l) >= 1)
    .map(([d, r, l]) => ({ def: d, rarity: Number(r), level: Math.min(MAX_LEVEL, Number(l)) }));
}
