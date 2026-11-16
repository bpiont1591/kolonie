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
const N = (id, branch, tier, name, desc, m) => ({ id, branch, tier, name, desc, m });
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
];
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
export const TIER_RP = { 1: 1, 2: 2, 3: 3, 4: 4 };
export const TIER_MIN = { 1: 5, 2: 20, 3: 60, 4: 180 }; // czas badań w minutach
export const researchCost = (n) => ({ metal: 200 * n.tier ** 2, crystal: 150 * n.tier ** 2, energy: 50 * n.tier ** 2 });
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
  if (rpFree(u) < TIER_RP[n.tier]) return `Za mało punktów badawczych (potrzeba ${TIER_RP[n.tier]}).`;
  return null;
}

const ZERO = { hp: 0, atk: 0, def: 0, crit: 0, dodge: 0, shield: 0, repair: 0, prod: 0, storage: 0, xp: 0, pveLoot: 0, pvpLoot: 0, expLoot: 0 };
const cache = new Map();
/** Łączne modyfikatory klasy i technologii (sumowane). */
export function mods(u) {
  const key = `${u?.ship_class || ''}|${u?.tech || ''}|${u?.relics || ''}`;
  let m = cache.get(key);
  if (m) return m;
  m = { ...ZERO };
  const add = (x) => { for (const [k, v] of Object.entries(x)) m[k] += v; };
  if (CLASSES[u?.ship_class]) add(CLASSES[u.ship_class].m);
  for (const id of techList(u)) add(TECH_BY_ID[id].m);
  for (const id of relicList(u)) add(RELICS[id].m);
  if (cache.size > 500) cache.clear();
  cache.set(key, m);
  return m;
}
