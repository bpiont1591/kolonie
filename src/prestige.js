// v7/4: prestiż „Odrodzenie” – reset poziomu od 50. poziomu w zamian za stałe bonusy i punkty prestiżu (PP).
export const MIN_LEVEL = 50;
/** Pasywny bonus za każdą rangę prestiżu. */
export const RANK_BONUS = { xp: 0.05, prod: 0.03 };
/** Punkty prestiżu za odrodzenie: 5 + 2 za każde pełne 5 poziomów powyżej 50. */
export const ppFor = (level) => (level < MIN_LEVEL ? 0 : 5 + 2 * Math.floor((level - MIN_LEVEL) / 5));
/** Sklep stałych ulepszeń (koszt poziomu n = n PP). */
export const PERKS = {
  wojownik: { id: 'wojownik', name: 'Dziedzictwo wojownika', desc: '+2% ataku', per: { atk: 0.02 }, max: 10 },
  pancerz: { id: 'pancerz', name: 'Dziedzictwo pancerza', desc: '+2% HP kadłuba', per: { hp: 0.02 }, max: 10 },
  przemysl: { id: 'przemysl', name: 'Dziedzictwo przemysłu', desc: '+3% wydobycia', per: { prod: 0.03 }, max: 10 },
  pamiec: { id: 'pamiec', name: 'Pamięć pokoleń', desc: '+4% XP', per: { xp: 0.04 }, max: 10 },
  lowca: { id: 'lowca', name: 'Instynkt łowcy', desc: '+3% łupów PvE i z ekspedycji', per: { pveLoot: 0.03, expLoot: 0.03 }, max: 10 },
  archiwa: { id: 'archiwa', name: 'Archiwa Prastarych', desc: '+2 punkty badawcze', per: {}, rp: 2, max: 5 },
};
export const perkCost = (lvl) => lvl + 1;
export function perkLevels(u) {
  const out = {};
  for (const part of String(u?.perks || '').split(',')) {
    const [id, l] = part.split(':');
    if (PERKS[id] && Number(l) > 0) out[id] = Math.min(PERKS[id].max, Number(l));
  }
  return out;
}
export const perkString = (lv) => Object.entries(lv).filter(([id, l]) => PERKS[id] && l > 0).map(([id, l]) => `${id}:${l}`).join(',');
/** Modyfikatory z rangi prestiżu i kupionych ulepszeń. */
export function prestigeMods(u) {
  const m = {}, rank = Number(u?.prestige) || 0;
  const add = (k, v) => { m[k] = (m[k] || 0) + v; };
  for (const [k, v] of Object.entries(RANK_BONUS)) if (rank) add(k, v * rank);
  for (const [id, l] of Object.entries(perkLevels(u))) for (const [k, v] of Object.entries(PERKS[id].per)) add(k, v * l);
  return m;
}
export const bonusRp = (u) => (perkLevels(u).archiwa || 0) * PERKS.archiwa.rp;
/** Co traci / co zachowuje gracz – do ekranu potwierdzenia (i testów). */
export const LOSES = ['poziom gracza i XP (wracasz na poziom 1)', 'zbadane technologie i trwające badanie', 'poziomy modułów statku (działa, kadłub, tarcze) i trwający montaż'];
export const KEEPS = ['budynki kolonii i wszystkie surowce', 'klasę statku, trofea bossów i moduły specjalne (sloty zostają odblokowane)', 'gwiazdki i skrzynie kampanii (wyższe rozdziały znów wymagają poziomu)',
  'osiągnięcia, tytuły, korporację, punkty PvP, arenę i sezon', 'kupione ulepszenia prestiżu i wcześniejsze rangi'];
export const rankName = (r) => (r >= 10 ? 'Wieczny' : r >= 5 ? 'Legenda' : r >= 3 ? 'Weteran' : r >= 1 ? 'Odrodzony' : '');
