// Samouczek dla nowych graczy: 5 kroków misji startowej z nagrodami (czyste reguły).
import * as Q from './quests.js';

export const STEPS = [
  { key: 'collect', ev: 'collect', page: '/kolonia', tab: 'kolonia', title: 'Zbierz surowce',
    text: 'Drony kopalni pracują bez przerwy. Stuknij „Zbierz surowce”, aby przenieść urobek do magazynu.',
    r: { metal: 150, crystal: 60, xp: 10 } },
  { key: 'build', ev: 'build', page: '/kolonia', tab: 'kolonia', title: 'Ulepsz Kopalnię',
    text: 'Wyższa Kopalnia to więcej metalu i kryształów. Rozpocznij jej rozbudowę – na niskich poziomach trwa kilka sekund.',
    r: { metal: 200, crystal: 100, energy: 60, xp: 15 }, state: (u) => u.b_mine >= 2 || u.bq_id === 'mine' },
  { key: 'pve', ev: 'pve', page: '/bitwa', tab: 'bitwa', title: 'Pokonaj piratów',
    text: 'Zwiadowca piratów krąży w pobliżu. Zaatakuj go – bitwa trwa kilka sekund, a zwycięstwo daje XP i łup.',
    r: { metal: 150, energy: 80, xp: 20 } },
  { key: 'module', ev: 'module', page: '/statek', tab: 'statek', title: 'Wzmocnij statek',
    text: 'Zamontuj lepsze Działa plazmowe – silniejszy statek wygrywa trudniejsze bitwy.',
    r: { metal: 150, crystal: 150, xp: 20 }, state: (u) => u.s_hull + u.s_guns + u.s_shields > 3 || !!u.mq_id },
  { key: 'daily', ev: 'login', page: '/misje', tab: 'misje', title: 'Odbierz nagrodę dnia',
    text: 'Codziennie czeka na Ciebie nagroda za logowanie, a misje dzienne dają surowce i XP. Odbierz dzisiejszą nagrodę.',
    r: { metal: 400, crystal: 250, energy: 150, xp: 40, core: 1 }, state: (u, now) => Q.loginState(u, now).claimedToday },
];
export const COUNT = STEPS.length;
export const FINISHED = COUNT + 1; // tut_step: 0 = wyłączony/pominięty, 1..5 = aktywny krok, 6 = ukończony

/** Krok, który kończy dane zdarzenie gry (lub 0). */
export const stepForEvent = (ev) => STEPS.findIndex((s) => s.ev === ev) + 1;

/** Stan samouczka dla gracza (null, gdy nieaktywny). */
export function state(u, now) {
  const n = u.tut_step || 0;
  if (n < 1 || n > COUNT) return null;
  const s = STEPS[n - 1];
  const done = !!u.tut_done || !!(s.state && s.state(u, now));
  return { n, count: COUNT, ...s, done };
}
