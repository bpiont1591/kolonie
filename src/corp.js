// Etap 3: korporacje – role, skarbiec, ulepszenia, wojny o sektor, boss rajdowy (czyste reguły).
export const ROLES = { leader: 'Przywódca', officer: 'Oficer', member: 'Członek' };
export const canManage = (role) => role === 'leader' || role === 'officer';

export const UPGRADES = {
  hq: { col: 'u_hq', name: 'Centrum dowodzenia', icon: 'corp', max: 4, desc: '+5 miejsc w korporacji na poziom.', base: { metal: 3000, crystal: 1500, energy: 1000 } },
  lab: { col: 'u_lab', name: 'Sieć badawcza', icon: 'xp', max: 5, desc: '+2% XP z bitew dla członków na poziom.', base: { metal: 2000, crystal: 2500, energy: 1000 } },
  refinery: { col: 'u_refinery', name: 'Rafineria orbitalna', icon: 'collect', max: 5, desc: '+3% wydobycia kolonii członków na poziom.', base: { metal: 4000, crystal: 2000, energy: 1500 } },
};
export const upgradeCost = (def, lvl) => {
  const f = 2 ** lvl;
  return { metal: def.base.metal * f, crystal: def.base.crystal * f, energy: def.base.energy * f };
};
export const BASE_MEMBERS = 20;
export const memberCap = (c) => BASE_MEMBERS + 5 * (c?.u_hq || 0);
export const xpBonus = (c) => 0.05 + 0.02 * (c?.u_lab || 0);
export const refineryBonus = (c) => 0.03 * (c?.u_refinery || 0);
export const WAR_WIN_BONUS = 0.10;
export const MIN_DONATION = 10;

// ---------- wojna o sektor ----------
export const PLANETS = [
  { id: 1, name: 'Erydan', x: 16, y: 24, size: 1.0, hue: 190 },
  { id: 2, name: 'Kasjopea IX', x: 47, y: 13, size: 0.85, hue: 30 },
  { id: 3, name: 'Nowa Wisła', x: 80, y: 24, size: 1.05, hue: 140 },
  { id: 4, name: 'Węzeł Omega', x: 50, y: 50, size: 1.35, hue: 275 },
  { id: 5, name: 'Tartar', x: 18, y: 76, size: 0.95, hue: 10 },
  { id: 6, name: 'Brama Heliosa', x: 52, y: 86, size: 0.9, hue: 50 },
  { id: 7, name: 'Obsydian', x: 83, y: 74, size: 1.1, hue: 220 },
];
export const LINKS = [[1, 2], [2, 3], [1, 4], [2, 4], [3, 4], [4, 5], [4, 6], [4, 7], [5, 6], [6, 7], [1, 5], [3, 7]];
export const WAR_POINTS = { pve: 1, pvp: 3, boss: 2 };
/** Kontrola planet z wierszy war_points {planet, corp_id, points}. */
export function control(rows) {
  const best = {};
  for (const r of rows) if (!best[r.planet] || r.points > best[r.planet].points) best[r.planet] = r;
  return best; // planet -> {corp_id, points}
}
/** Zwycięzca tygodnia: najwięcej planet, remis -> suma punktów. */
export function winner(rows) {
  const ctl = control(rows), tally = {};
  for (const r of Object.values(ctl)) { tally[r.corp_id] ??= { corp_id: r.corp_id, planets: 0, points: 0 }; tally[r.corp_id].planets++; }
  for (const r of rows) if (tally[r.corp_id]) tally[r.corp_id].points += r.points;
  return Object.values(tally).sort((a, b) => b.planets - a.planets || b.points - a.points)[0] || null;
}
/** Kolor korporacji wyliczony z TAG-u. */
export const tagHue = (tag) => [...String(tag)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

// ---------- boss rajdowy ----------
export const BOSS = { name: 'Matka Roju Xal’Thar', hours: 48, energy: 15, cooldownH: 12 };
export const bossHp = (levels) => 800 + 400 * levels; // levels = suma poziomów członków
export function bossHit(atk, labBonus, rnd = Math.random) {
  const crit = rnd() < 0.12;
  return { dmg: Math.round(atk * 4 * (0.85 + rnd() * 0.3) * labBonus * (crit ? 2 : 1)), crit, counter: 0.05 + rnd() * 0.07 };
}
/** Pula nagród zależna od poziomu bossa i liczby uczestników. */
export function bossPool(level, n, killed) {
  const k = killed ? 1 : 0.25;
  return { metal: Math.round(1200 * level * n * k), crystal: Math.round(600 * level * n * k), energy: Math.round(400 * level * n * k), xp: Math.round(120 * level * n * k) };
}
/** Udział gracza: 20% równo + 80% proporcjonalnie do obrażeń. */
export function bossShare(pool, dmg, totalDmg, n) {
  const s = 0.2 / n + 0.8 * (totalDmg ? dmg / totalDmg : 1 / n);
  const out = {};
  for (const [k, v] of Object.entries(pool)) out[k] = Math.round(v * s);
  return out;
}
