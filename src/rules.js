// Czyste reguły gry (bez bazy danych i HTTP) – łatwe do testowania i balansowania.
export const SPEED = Math.max(0.1, Number(process.env.GAME_SPEED) || 1); // mnożnik tempa (tylko do testów)
export const MIN = 60_000;
export const STORAGE_MINUTES = 120;       // magazyn wydobycia mieści 2 h produkcji
export const BATTLE_COOLDOWN_MS = 4_000;  // anty-spam między bitwami
export const PVP_SHIELD_MS = 15 * MIN;    // ochrona po byciu zaatakowanym
export const MIN_HP_RATIO = 0.25;         // min. stan kadłuba do walki
export const MAX_LEVEL_BUILDING = 30;
export const CORP_MAX_MEMBERS = 20;
export const CORP_COST = { metal: 300, crystal: 100, energy: 0 };
export const CORP_XP_BONUS = 0.05;

export const RESOURCES = {
  metal: { name: 'Metal', icon: '🔩' },
  crystal: { name: 'Kryształy', icon: '💎' },
  energy: { name: 'Energia', icon: '⚡' },
};
export const RES_KEYS = ['metal', 'crystal', 'energy'];

export const BUILDINGS = {
  mine: { col: 'b_mine', name: 'Kopalnia', icon: '⛏️', growth: 1.55,
    desc: 'Automatyczne drony wydobywają metal i kryształy.', base: { metal: 60, crystal: 25, energy: 10 } },
  power: { col: 'b_power', name: 'Elektrownia', icon: '🔋', growth: 1.55,
    desc: 'Reaktor fuzyjny zasilający kolonię energią.', base: { metal: 50, crystal: 20, energy: 0 } },
  shipyard: { col: 'b_shipyard', name: 'Stocznia', icon: '🛠️', growth: 1.6,
    desc: 'Limit modułów statku = 2 × poziom stoczni. Przyspiesza naprawy kadłuba.', base: { metal: 120, crystal: 60, energy: 30 } },
  lab: { col: 'b_lab', name: 'Laboratorium', icon: '🔬', growth: 1.65,
    desc: '+10% XP i łupów z bitew za każdy poziom powyżej 1.', base: { metal: 100, crystal: 90, energy: 50 } },
};

export const MODULES = {
  hull: { col: 's_hull', name: 'Kadłub', icon: '🧱', growth: 1.5,
    desc: '+40 HP statku.', base: { metal: 80, crystal: 20, energy: 10 } },
  guns: { col: 's_guns', name: 'Działa plazmowe', icon: '💥', growth: 1.5,
    desc: '+6 do ataku.', base: { metal: 60, crystal: 40, energy: 20 } },
  shields: { col: 's_shields', name: 'Tarcze deflektorowe', icon: '🔰', growth: 1.5,
    desc: '+4 do obrony (pochłania obrażenia).', base: { metal: 40, crystal: 60, energy: 30 } },
};

export const PIRATES = [
  { id: 'zwiadowca', name: 'Zwiadowca piratów', icon: '🛸', minLvl: 1, mult: 0.6, energy: 5,
    desc: 'Lekki myśliwiec szukający łatwego łupu.' },
  { id: 'korsarz', name: 'Korsarz Pasa Oriona', icon: '🏴‍☠️', minLvl: 3, mult: 0.9, energy: 8,
    desc: 'Doświadczony najemnik z przemyconymi działami.' },
  { id: 'krazownik', name: 'Krążownik Czerwonej Mgławicy', icon: '🔴', minLvl: 6, mult: 1.2, energy: 12,
    desc: 'Ciężko opancerzony okręt flagowy klanu piratów.' },
  { id: 'dreadnought', name: 'Dreadnought Króla Pustki', icon: '☠️', minLvl: 10, mult: 1.6, energy: 20,
    desc: 'Legenda rubieży. Tylko najlepsi wracają z łupem.' },
];
export const PVP_ENERGY = 10;

export const PLANETS = ['Kepler-442b', 'Proxima b', 'Tau Ceti e', 'Gliese 667Cc', 'Nowa Wisła', 'Trappist-1e',
  'Wolf 1061c', 'Ross 128b', 'Teegarden b', 'LHS 1140b', 'Nowy Kraków', 'Arrakon IV', 'Helion Prime', 'Vesper-9'];

export function upgradeCost(def, lvl) {
  const f = def.growth ** (lvl - 1);
  return { metal: Math.round(def.base.metal * f), crystal: Math.round(def.base.crystal * f), energy: Math.round(def.base.energy * f) };
}

export const BOOST_BONUS = 0.5; // Rdzeń kwantowy: +50% wydobycia
/** Stały mnożnik produkcji (bonusy korporacji ustawiane w u._prodBonus). */
export const prodMult = (u) => 1 + (u._prodBonus || 0);
const boostOn = (u, now) => !!now && (u.boost_until || 0) > now;
/** Produkcja na minutę (z aktywnym Rdzeniem kwantowym, jeśli podano `now`). */
export function production(u, now) {
  const m = prodMult(u) * (boostOn(u, now) ? 1 + BOOST_BONUS : 1);
  return { metal: 8 * u.b_mine * SPEED * m, crystal: 3 * u.b_mine * SPEED * m, energy: 5 * u.b_power * SPEED * m };
}
export function storageCap(u, now) {
  const p = production(u, now);
  return { metal: Math.floor(p.metal * STORAGE_MINUTES), crystal: Math.floor(p.crystal * STORAGE_MINUTES), energy: Math.floor(p.energy * STORAGE_MINUTES) };
}
/** Surowce czekające w magazynie wydobycia (do zebrania). Doładowanie liczone tylko w oknie jego trwania. */
export function pending(u, now) {
  const mins = Math.max(0, (now - u.collected_at) / MIN);
  const boosted = Math.max(0, (Math.min(now, u.boost_until || 0) - u.collected_at) / MIN);
  const p = production(u), cap = storageCap(u, now);
  const out = {};
  for (const k of RES_KEYS) out[k] = Math.floor(Math.min(p[k] * (mins + BOOST_BONUS * boosted), cap[k]));
  return out;
}

export function shipStats(u) {
  return {
    maxHp: 80 + 40 * u.s_hull + 10 * u.level,
    atk: 8 + 6 * u.s_guns + u.level,
    def: 2 + 4 * u.s_shields,
  };
}
export function repairPerMin(u) {
  return (0.02 + 0.01 * u.b_shipyard) * shipStats(u).maxHp * SPEED;
}
export function currentHp(u, now) {
  const { maxHp } = shipStats(u);
  const mins = Math.max(0, (now - u.hp_at) / MIN);
  return Math.min(maxHp, Math.floor(u.hp + repairPerMin(u) * mins));
}
export const moduleCap = (u) => u.b_shipyard * 2;
export const labBonus = (u) => 1 + 0.1 * (u.b_lab - 1);
export const xpForNext = (level) => Math.round(100 * level ** 1.5);
export const power = (u) => { const s = shipStats(u); return Math.round(s.maxHp / 4 + s.atk * 2 + s.def * 2); };

/** Dodaje XP, zwraca nowy poziom i postęp. */
export function addXp(level, xp, gain) {
  let l = level, x = xp + gain, ups = 0;
  while (x >= xpForNext(l)) { x -= xpForNext(l); l++; ups++; }
  return { level: l, xp: x, levelsGained: ups };
}

export function pirate(tier, level) {
  const L = Math.max(level, tier.minLvl);
  const hp = Math.round((90 + 25 * L) * tier.mult);
  return { name: tier.name, hp, maxHp: hp, atk: Math.round((10 + 4 * L) * tier.mult), def: Math.round((2 + 2 * L) * tier.mult * 0.8), level: L };
}

export function pirateReward(tier, level, bonus, rnd = Math.random) {
  const L = Math.max(level, tier.minLvl);
  const r = 0.85 + rnd() * 0.3;
  return {
    xp: Math.round((15 + 5 * L) * tier.mult * bonus),
    metal: Math.round((30 + 10 * L) * tier.mult * bonus * r),
    crystal: Math.round((10 + 4 * L) * tier.mult * bonus * r),
  };
}

const HIT = ['oddaje salwę z dział plazmowych', 'odpala torpedę jonową', 'tnie kadłub wiązką laserową',
  'ostrzeliwuje mostek z działek szynowych', 'wypuszcza rój mikrodronów'];
const MISS = ['pudłuje – pocisk znika w pustce', 'trafia w tarczę odbitą od asteroidy', 'traci namiar przez zakłócenia'];

/** Symulacja bitwy. a strzela pierwszy. Max 12 rund. */
export function simulate(a, d, rnd = Math.random) {
  const A = { ...a }, D = { ...d };
  const log = [];
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const shoot = (s, t, round) => {
    if (rnd() < 0.06) { log.push({ r: round, side: s === A ? 'a' : 'd', t: `${s.name} ${pick(MISS)}.` }); return; }
    let dmg = s.atk * (0.85 + rnd() * 0.3) - t.def * 0.5;
    const crit = rnd() < 0.1;
    if (crit) dmg *= 1.6;
    dmg = Math.max(1, Math.round(dmg));
    t.hp = Math.max(0, t.hp - dmg);
    log.push({ r: round, side: s === A ? 'a' : 'd', t: `${s.name} ${pick(HIT)}: −${dmg} HP${crit ? ' (KRYTYK!)' : ''}. ${t.name}: ${t.hp}/${t.maxHp}` });
  };
  let round = 0;
  while (round < 12 && A.hp > 0 && D.hp > 0) {
    round++;
    shoot(A, D, round);
    if (D.hp > 0) shoot(D, A, round);
  }
  let aWon;
  if (D.hp <= 0) aWon = true;
  else if (A.hp <= 0) aWon = false;
  else {
    aWon = A.hp / A.maxHp > D.hp / D.maxHp;
    log.push({ r: round, side: 'x', t: 'Koniec amunicji – o wyniku decyduje stan kadłubów.' });
  }
  log.push({ r: round, side: 'x', t: aWon ? `🏆 Zwycięstwo: ${A.name}!` : `💀 ${A.name} wycofuje się pokonany.` });
  return { aWon, aHp: A.hp, dHp: D.hp, rounds: round, log };
}
