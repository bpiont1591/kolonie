import * as GE from './gear.js';
// Etap v6/1: klasy statków i drzewko technologii (czyste dane i reguły, bez zależności).
export const CLASSES = {
  szturmowiec: { id: 'szturmowiec', name: 'Szturmowiec', icon: 'c_assault', role: 'Atak',
    desc: 'Ciężkie działa i agresywna taktyka. Kończy walki szybko, ale słabiej znosi ostrzał.',
    m: { atk: 0.1, def: -0.08, hp: -0.06, crit: 0.04 } },
  krazownik: { id: 'krazownik', name: 'Krążownik', icon: 'c_tank', role: 'Wytrzymałość',
    desc: 'Pancerny kolos. Przetrwa najcięższe starcia i dobrze broni kolonii przed napastnikami.',
    m: { hp: 0.18, def: 0.12, atk: -0.07 } },
  zwiadowca: { id: 'zwiadowca', name: 'Zwiadowca', icon: 'c_scout', role: 'Uniki i łupy',
    desc: 'Szybki i zwinny. Częściej unika trafień, trafia krytycznie i przywozi więcej łupów.',
    m: { hp: -0.04, dodge: 0.08, crit: 0.05, pveLoot: 0.15, expLoot: 0.15 } },
  wsparcie: { id: 'wsparcie', name: 'Wsparcie', icon: 'c_support', role: 'Tarcza i rozwój',
    desc: 'Generator tarczy pochłania pierwsze trafienia, drony szybciej naprawiają kadłub, a załoga szybciej się uczy.',
    m: { atk: -0.04, shield: 0.12, repair: 0.6, xp: 0.1 } },
};
export const CLASS_IDS = Object.keys(CLASSES);
export const CLASS_CHANGE_COOLDOWN_MS = 24 * 3600_000;
/** Koszt zmiany klasy (pierwszy wybór darmowy). */
export const classChangeCost = (level) => ({ metal: 0, crystal: 300 + 60 * level, energy: 0 });

export const BRANCHES = [
  { id: 'bron', name: 'Uzbrojenie', icon: 't_weapons' },
  { id: 'pancerz', name: 'Pancerz', icon: 't_armor' },
  { id: 'logistyka', name: 'Logistyka', icon: 't_logistics' },
  { id: 'taktyka', name: 'Taktyka', icon: 't_tactics' },
];
const N = (id, branch, tier, name, desc, m, milestone = false) => ({ id, branch, tier, name, desc, m, milestone });
export const TECH = [
  N('b1', 'bron', 1, 'Kalibracja dział', '+5% ataku', { atk: 0.05 }),
  N('b2', 'bron', 2, 'Celowniki kwantowe', '+4% szansy na trafienie krytyczne', { crit: 0.04 }),
  N('b3', 'bron', 3, 'Plazma wysokoenergetyczna', '+8% ataku', { atk: 0.08 }),
  N('b4', 'bron', 4, 'Salwa burzowa', '+4% ataku, +5% szansy na krytyk', { atk: 0.04, crit: 0.05 }),
  N('p1', 'pancerz', 1, 'Stop tytanowy', '+6% HP kadłuba', { hp: 0.06 }),
  N('p2', 'pancerz', 2, 'Deflektory warstwowe', '+8% obrony', { def: 0.08 }),
  N('p3', 'pancerz', 3, 'Nanonaprawa', '+25% szybkości naprawy', { repair: 0.25 }),
  N('p4', 'pancerz', 4, 'Tarcza rezonansowa', 'tarcza pochłania 6% maks. HP na start walki', { shield: 0.06 }),
  N('l1', 'logistyka', 1, 'Drony górnicze', '+5% wydobycia', { prod: 0.05 }),
  N('l2', 'logistyka', 2, 'Silosy próżniowe', '+15% pojemności magazynu wydobycia', { storage: 0.15 }),
  N('l3', 'logistyka', 3, 'Rafinacja orbitalna', '+7% wydobycia', { prod: 0.07 }),
  N('l4', 'logistyka', 4, 'Nawigacja głęboka', '+15% łupów z ekspedycji', { expLoot: 0.15 }),
  N('t1', 'taktyka', 1, 'Analiza bitew', '+8% XP', { xp: 0.08 }),
  N('t2', 'taktyka', 2, 'Łowcy nagród', '+10% łupów z piratów i kampanii', { pveLoot: 0.1 }),
  N('t3', 'taktyka', 3, 'Manewry unikowe', '+4% szansy na unik', { dodge: 0.04 }),
  N('t4', 'taktyka', 4, 'Abordaż', '+15% łupów z ataków na graczy', { pvpLoot: 0.15 }),
  // v7: poziomy 5–10 (5 i 10 to kamienie milowe z unikalnymi efektami)
  N('b5', 'bron', 5, 'Działa sprzężone', 'KAMIEŃ MILOWY: 12% szansy na drugą salwę w turze', { double: 0.12 }, true),
  N('b6', 'bron', 6, 'Rdzenie fotonowe', '+6% ataku', { atk: 0.06 }),
  N('b7', 'bron', 7, 'Matryca celownicza', '+4% szansy na krytyk', { crit: 0.04 }),
  N('b8', 'bron', 8, 'Akcelerator cząstek', '+7% ataku', { atk: 0.07 }),
  N('b9', 'bron', 9, 'Ogień zaporowy', '+5% ataku, +3% krytyka', { atk: 0.05, crit: 0.03 }),
  N('b10', 'bron', 10, 'Gniew Gwiazd', 'KAMIEŃ MILOWY: pierwsza salwa w walce +60% obrażeń', { opener: 0.6 }, true),
  N('p5', 'pancerz', 5, 'Regeneracja bojowa', 'KAMIEŃ MILOWY: naprawa 3% maks. HP co rundę walki', { regen: 0.03 }, true),
  N('p6', 'pancerz', 6, 'Kompozyt neutronowy', '+8% HP kadłuba', { hp: 0.08 }),
  N('p7', 'pancerz', 7, 'Pole odchylające', '+8% obrony', { def: 0.08 }),
  N('p8', 'pancerz', 8, 'Roje nanitów', '+30% naprawy, +4% HP', { repair: 0.3, hp: 0.04 }),
  N('p9', 'pancerz', 9, 'Tarcza fazowa', 'tarcza pochłania dodatkowe 5% maks. HP', { shield: 0.05 }),
  N('p10', 'pancerz', 10, 'Ostatni bastion', 'KAMIEŃ MILOWY: raz na walkę przetrwasz śmiertelne trafienie z 1 HP', { lastStand: 1 }, true),
  N('l5', 'logistyka', 5, 'Konwoje', 'KAMIEŃ MILOWY: ekspedycje krótsze o 15%', { expSpeed: 0.15 }, true),
  N('l6', 'logistyka', 6, 'Głębinowe świdry', '+8% wydobycia', { prod: 0.08 }),
  N('l7', 'logistyka', 7, 'Hangary orbitalne', '+25% pojemności magazynu wydobycia', { storage: 0.25 }),
  N('l8', 'logistyka', 8, 'Rafinerie kwantowe', '+10% wydobycia', { prod: 0.1 }),
  N('l9', 'logistyka', 9, 'Mapy gwiezdne', '+15% łupów z ekspedycji, +5% wydobycia', { expLoot: 0.15, prod: 0.05 }),
  N('l10', 'logistyka', 10, 'Fuzja przemysłowa', 'KAMIEŃ MILOWY: budowy i montaż modułów o 20% krótsze', { buildSpeed: 0.2 }, true),
  N('t5', 'taktyka', 5, 'Kontratak', 'KAMIEŃ MILOWY: po uniku 50% szansy na natychmiastową kontrę', { counter: 0.5 }, true),
  N('t6', 'taktyka', 6, 'Akademia floty', '+10% XP', { xp: 0.1 }),
  N('t7', 'taktyka', 7, 'Kontrakty łowieckie', '+15% łupów PvE', { pveLoot: 0.15 }),
  N('t8', 'taktyka', 8, 'Silniki manewrowe', '+4% szansy na unik', { dodge: 0.04 }),
  N('t9', 'taktyka', 9, 'Grabież', '+15% łupów PvP, +5% XP', { pvpLoot: 0.15, xp: 0.05 }),
  N('t10', 'taktyka', 10, 'Mistrz floty', 'KAMIEŃ MILOWY: walki kosztują 25% mniej energii', { energySave: 0.25 }, true),
];
export const MAX_TIER = 10;
/** Wymagania wyższych poziomów drzewka (poziom gracza i laboratorium). */
export const TIER_REQ = { 5: { lvl: 12, lab: 5 }, 6: { lvl: 18, lab: 7 }, 7: { lvl: 25, lab: 9 }, 8: { lvl: 32, lab: 11 }, 9: { lvl: 40, lab: 13 }, 10: { lvl: 48, lab: 15 } };
/** Unikalne łupy bossów kampanii – trwałe premie (sumują się z klasą i technologiami). */
export const RELICS = {
  grax: { id: 'grax', name: 'Złomiany pancerz Graxa', desc: '+4% HP kadłuba', m: { hp: 0.04 } },
  lewiatan: { id: 'lewiatan', name: 'Kryształowe serce', desc: 'tarcza pochłania 3% maks. HP', m: { shield: 0.03 } },
  roj: { id: 'roj', name: 'Feromon Roju', desc: '+10% łupów PvE i z ekspedycji', m: { pveLoot: 0.1, expLoot: 0.1 } },
  kowal: { id: 'kowal', name: 'Rdzeń kuźni', desc: '+5% ataku i obrony', m: { atk: 0.05, def: 0.05 } },
  otchlan: { id: 'otchlan', name: 'Oko Otchłani', desc: '+3% krytyka i uniku', m: { crit: 0.03, dodge: 0.03 } },
};
export const relicList = (u) => String(u?.relics || '').split(',').filter((id) => RELICS[id]);
export const TECH_BY_ID = Object.fromEntries(TECH.map((n) => [n.id, n]));
// v7: pełne drzewko (40 węzłów) kosztuje 88 PB – osiągalne ok. poziomu 50+ (PB = poziom−1 + 2×(laboratorium−1)).
export const TIER_RP = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
export const TIER_MIN = { 1: 5, 2: 20, 3: 60, 4: 180, 5: 240, 6: 360, 7: 540, 8: 720, 9: 960, 10: 1440 }; // czas badań w minutach
const costK = (t) => t ** 2 * (t > 4 ? 1.45 ** (t - 4) : 1);
export const researchCost = (n) => ({ metal: Math.round(200 * costK(n.tier)), crystal: Math.round(150 * costK(n.tier)), energy: Math.round(50 * costK(n.tier)) });
export const resetCost = (spent) => ({ metal: 0, crystal: Math.max(100, 100 * spent), energy: 0 });

export const techList = (u) => String(u?.tech || '').split(',').filter((id) => TECH_BY_ID[id]);
/** Punkty badawcze: 1 za każdy poziom powyżej 1 i 2 za każdy poziom laboratorium powyżej 1. */
export const rpTotal = (u) => Math.max(0, (u.level || 1) - 1) + 2 * Math.max(0, (u.b_lab || 1) - 1);
export const rpSpent = (u) => techList(u).reduce((a, id) => a + TIER_RP[TECH_BY_ID[id].tier], 0) + (u.rq_id && TECH_BY_ID[u.rq_id] ? TIER_RP[TECH_BY_ID[u.rq_id].tier] : 0);
export const rpFree = (u) => rpTotal(u) - rpSpent(u);
/** Czy węzeł można badać: poprzedni w gałęzi zbadany, sam jeszcze nie. */
export function canResearch(u, n) {
  const have = new Set(techList(u));
  if (have.has(n.id) || u.rq_id === n.id) return 'Już zbadane.';
  if (u.rq_id) return 'Trwa inne badanie – jedno naraz.';
  const prev = TECH.find((x) => x.branch === n.branch && x.tier === n.tier - 1);
  if (prev && !have.has(prev.id)) return `Najpierw zbadaj „${prev.name}”.`;
  const req = TIER_REQ[n.tier];
  if (req && (u.level || 1) < req.lvl) return `Wymaga poziomu gracza ${req.lvl}.`;
  if (req && (u.b_lab || 1) < req.lab) return `Wymaga laboratorium na poziomie ${req.lab}.`;
  if (rpFree(u) < TIER_RP[n.tier]) return `Za mało punktów badawczych (potrzeba ${TIER_RP[n.tier]}).`;
  return null;
}

const ZERO = { hp: 0, atk: 0, def: 0, crit: 0, dodge: 0, shield: 0, repair: 0, prod: 0, storage: 0, xp: 0, pveLoot: 0, pvpLoot: 0, expLoot: 0,
  double: 0, opener: 0, regen: 0, lastStand: 0, counter: 0, expSpeed: 0, buildSpeed: 0, energySave: 0, leech: 0, thorns: 0 };
const cache = new Map();
/** Łączne modyfikatory klasy i technologii (sumowane). */
export function mods(u) {
  const key = `${u?.ship_class || ''}|${u?.tech || ''}|${u?.relics || ''}|${u?.gear || ''}`;
  let m = cache.get(key);
  if (m) return m;
  m = { ...ZERO };
  const add = (x) => { for (const [k, v] of Object.entries(x)) m[k] += v; };
  if (CLASSES[u?.ship_class]) add(CLASSES[u.ship_class].m);
  for (const id of techList(u)) add(TECH_BY_ID[id].m);
  for (const id of relicList(u)) add(RELICS[id].m);
  for (const g of GE.gearList(u).slice(0, GE.slotCount(u))) add(GE.effect(g.def, g.rarity, g.level));
  if (cache.size > 500) cache.clear();
  cache.set(key, m);
  return m;
}
