// Etap v5/3: osiągnięcia i tytuły przy nicku (czyste reguły, bez bazy).
// stat(s) -> bieżąca wartość; goal -> próg; title -> tytuł odblokowywany razem z osiągnięciem.
export const LIST = [
  { id: 'kadet', name: 'Kadet', desc: 'Ukończ samouczek', stat: (s) => s.tutDone, goal: 1, title: 'Kadet', r: { metal: 200, crystal: 100 } },
  { id: 'pierwsza_krew', name: 'Pierwsza krew', desc: 'Wygraj pierwszą bitwę', stat: (s) => s.pve + s.pvp, goal: 1, r: { metal: 150, crystal: 80 } },
  { id: 'lowca', name: 'Łowca piratów', desc: 'Pokonaj 25 piratów', stat: (s) => s.pve, goal: 25, title: 'Łowca piratów', r: { metal: 600, crystal: 300 } },
  { id: 'postrach', name: 'Postrach piratów', desc: 'Pokonaj 100 piratów', stat: (s) => s.pve, goal: 100, title: 'Postrach piratów', r: { metal: 2000, crystal: 1000, energy: 300 } },
  { id: 'pojedynek', name: 'Pojedynkowicz', desc: 'Wygraj 10 bitew z graczami', stat: (s) => s.pvp, goal: 10, title: 'Pojedynkowicz', r: { metal: 800, crystal: 400 } },
  { id: 'watazka', name: 'Watażka', desc: 'Wygraj 50 bitew z graczami', stat: (s) => s.pvp, goal: 50, title: 'Watażka', r: { metal: 2500, crystal: 1200, energy: 400 } },
  { id: 'inzynier', name: 'Inżynier', desc: 'Rozbuduj kopalnię do poziomu 5', stat: (s) => s.mine, goal: 5, title: 'Inżynier', r: { metal: 500, crystal: 250 } },
  { id: 'magnat', name: 'Magnat', desc: 'Wszystkie budynki na poziomie 8', stat: (s) => s.minB, goal: 8, title: 'Magnat', r: { metal: 3000, crystal: 1500, energy: 500 } },
  { id: 'odkrywca', name: 'Odkrywca', desc: 'Ukończ 5 ekspedycji', stat: (s) => s.expeditions, goal: 5, title: 'Odkrywca', r: { metal: 700, crystal: 350 } },
  { id: 'weteran', name: 'Weteran', desc: 'Osiągnij poziom 10', stat: (s) => s.level, goal: 10, title: 'Weteran', r: { metal: 1000, crystal: 500 } },
  { id: 'legenda', name: 'Legenda', desc: 'Osiągnij poziom 20', stat: (s) => s.level, goal: 20, title: 'Legenda', r: { metal: 4000, crystal: 2000, energy: 600 } },
  { id: 'towarzysz', name: 'Towarzysz', desc: 'Dołącz do korporacji', stat: (s) => s.corp, goal: 1, title: 'Towarzysz', r: { metal: 300, crystal: 150 } },
  { id: 'pogromca', name: 'Pogromca bossów', desc: 'Zaatakuj bossa korporacji 20 razy', stat: (s) => s.boss, goal: 20, title: 'Pogromca bossów', r: { metal: 1200, crystal: 600 } },
  { id: 'gladiator', name: 'Gladiator', desc: 'Weź udział w 5 turniejach areny', stat: (s) => s.arena, goal: 5, title: 'Gladiator', r: { metal: 900, crystal: 450 } },
  { id: 'mistrz_areny', name: 'Mistrz areny', desc: 'Wygraj turniej areny', stat: (s) => s.arenaWins, goal: 1, title: 'Mistrz areny', r: { metal: 1500, crystal: 800, energy: 300 } },
  { id: 'wytrwaly', name: 'Wytrwały', desc: 'Loguj się 7 dni z rzędu', stat: (s) => s.streak, goal: 7, title: 'Wytrwały', r: { metal: 700, crystal: 350 } },
  { id: 'sezonowiec', name: 'Weteran sezonu', desc: 'Osiągnij 30. poziom przepustki sezonowej', stat: (s) => s.pass, goal: 1, title: 'Weteran sezonu', r: { metal: 2000, crystal: 1000 } },
];
export const BY_ID = Object.fromEntries(LIST.map((a) => [a.id, a]));
export const COUNT = LIST.length;
/** Tekst tytułu dla zapisanego id (pusty, gdy brak/nieznany). */
export const titleOf = (id) => (id && BY_ID[id]?.title) || '';
/** Postęp osiągnięcia: [bieżąca wartość obcięta do progu, próg]. */
export function progress(a, s) { return [Math.min(a.goal, Math.max(0, Number(a.stat(s)) || 0)), a.goal]; }
/** Osiągnięcia spełnione według statystyk, a jeszcze nieodblokowane. */
export function newlyEarned(s, owned) { return LIST.filter((a) => !owned.has(a.id) && a.stat(s) >= a.goal); }
