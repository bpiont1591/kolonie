// Testy jednostkowe czystych reguł (bez serwera).
import * as Chat from '../src/chat.js';
import * as S from '../src/season.js';
import assert from 'node:assert/strict';
import * as T from '../src/time.js';
import * as Q from '../src/quests.js';
import * as C from '../src/corp.js';
import * as R from '../src/rules.js';
import * as AR from '../src/arena.js';
import * as A from '../src/achievements.js';
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`✅ ${name}`); };

t('Strefa Europe/Warsaw: północ i poniedziałek', () => {
  const a = Date.parse('2026-11-16T22:59:00Z'), b = Date.parse('2026-11-16T23:01:00Z'); // 23:59 i 00:01 w Warszawie (UTC+1)
  assert.equal(T.dayNum(b) - T.dayNum(a), 1);
  assert.equal(T.dayKey(a), '2026-11-16');
  assert.equal(T.weekStart(Date.parse('2026-11-16T12:00:00Z')), T.dayNum(Date.parse('2026-11-16T12:00:00Z'))); // 16.11.2026 to poniedziałek
  assert.equal(T.weekStart(Date.parse('2026-11-22T20:00:00Z')), T.weekStart(Date.parse('2026-11-16T12:00:00Z')));
  assert.ok(T.msToMidnight(a) <= 60_000);
});
t('Kalendarz logowań: seria, reset po przerwie, cykl 7 dni', () => {
  const now = Date.parse('2026-11-16T12:00:00Z'), d = T.dayNum(now);
  assert.deepEqual([Q.loginState({ login_day: 0, login_streak: 0 }, now).next, Q.loginState({ login_day: d - 1, login_streak: 3 }, now).next], [1, 4]);
  assert.equal(Q.loginState({ login_day: d - 2, login_streak: 5 }, now).next, 1);
  assert.equal(Q.loginState({ login_day: d - 2, login_streak: 5 }, now).broken, true);
  assert.equal(Q.loginState({ login_day: d - 1, login_streak: 7 }, now).next, 1);
  assert.equal(Q.loginState({ login_day: d, login_streak: 2 }, now).claimedToday, true);
  assert.ok(Q.LOGIN_REWARDS[6].core && Q.LOGIN_REWARDS[6].metal > Q.LOGIN_REWARDS[0].metal);
});
t('Misje dnia: deterministyczne, 4 różne', () => {
  const now = Date.now(), a = Q.dailyQuests(now).map((q) => q.id);
  assert.deepEqual(a, Q.dailyQuests(now + 1000).map((q) => q.id));
  assert.equal(new Set(a).size, 4);
});
t('Doładowanie produkcji liczone tylko w oknie trwania', () => {
  const u = { b_mine: 1, b_power: 1, collected_at: 0, boost_until: 30 * 60_000 };
  const p = R.pending(u, 60 * 60_000);
  assert.equal(p.metal, Math.floor(8 * (60 + 0.5 * 30)));
});
t('Czasy budowy rosną z poziomem, krótkie na starcie', () => {
  assert.ok(R.buildTime(1) <= 10 && R.buildTime(10) > 600 && R.buildTime(29) < 6 * 3600);
  assert.ok(R.moduleTime(1) <= 10);
});
t('Ekspedycja: zdarzenie, łup i obrażenia w granicach', () => {
  for (let i = 0; i < 200; i++) {
    const r = R.expeditionResult(R.EXPEDITIONS.nieznane, 5, 1);
    assert.ok(r.loot.metal > 0 && r.dmg >= 0 && r.dmg <= 0.5 && r.title);
  }
});
t('Wojna: kontrola planet i zwycięzca tygodnia', () => {
  const rows = [{ planet: 1, corp_id: 1, points: 5 }, { planet: 1, corp_id: 2, points: 9 }, { planet: 2, corp_id: 1, points: 3 }, { planet: 3, corp_id: 1, points: 1 }];
  const ctl = C.control(rows);
  assert.equal(ctl[1].corp_id, 2);
  assert.equal(C.winner(rows).corp_id, 1); // 2 planety vs 1
  assert.equal(C.winner([]), null);
});
t('Boss: podział nagród sumuje się do puli', () => {
  const pool = C.bossPool(3, 3, true);
  const dmg = [500, 300, 200], tot = 1000;
  const sum = dmg.map((d) => C.bossShare(pool, d, tot, 3).metal).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - pool.metal) <= 3);
  assert.ok(C.bossPool(3, 3, false).metal < pool.metal);
});
t('Czat: normalizacja, długość i filtr wulgaryzmów', () => {
  assert.equal(Chat.clean('  hej\n\tkomandorze  ').text, 'hej komandorze');
  assert.ok(Chat.clean('').error);
  assert.ok(Chat.clean('\u0000\u200b ').error);
  assert.ok(Chat.clean('a'.repeat(201)).error);
  assert.equal(Chat.clean('ą'.repeat(200)).text.length, 200);
  assert.equal(Chat.clean('ty KURWA mać').text, 'ty K**** mać');
  assert.equal(Chat.clean('Chujowy plan').text.includes('huj'), false);
  assert.equal(Chat.clean('ładna planeta, szybki statek').text, 'ładna planeta, szybki statek');
  assert.equal(Chat.clean('<b>x</b>').text, '<b>x</b>'); // escapowanie przy wyświetlaniu, nie przy zapisie
});
t('Czat: limiter tempa', () => {
  const lim = Chat.limiter();
  assert.equal(lim(1, 0), null);
  assert.ok(lim(1, 1000)); // < 2 s
  assert.equal(lim(2, 1000), null); // inny gracz niezależnie
  let blocked = 0;
  for (let i = 1; i <= 8; i++) if (lim(1, i * 2500)) blocked++;
  assert.ok(blocked >= 2); // maks. 6 na 30 s
  assert.equal(lim(1, 60_000), null);
});
t('Sezon: identyfikator, poprzedni sezon, czas do końca (Warszawa)', () => {
  const nov = Date.parse('2026-11-30T22:59:00Z'); // 23:59 w Warszawie
  assert.equal(T.seasonId(nov), '2026-11');
  assert.equal(T.seasonId(Date.parse('2026-11-30T23:01:00Z')), '2026-12'); // już 1 grudnia w Warszawie
  assert.equal(T.prevSeasonId(Date.parse('2027-01-10T12:00:00Z')), '2026-12');
  assert.equal(T.prevSeasonId(nov), '2026-10');
  assert.ok(Math.abs(T.msToSeasonEnd(nov) - 60_000) < 2000);
  assert.equal(T.seasonName('2026-11'), 'Listopad 2026');
});
t('Przepustka: poziomy, XP ze zdarzeń, nagrody', () => {
  assert.equal(S.level(0), 0); assert.equal(S.level(149), 0); assert.equal(S.level(150), 1); assert.equal(S.level(999999), 30);
  assert.deepEqual(S.progress(160), { level: 1, inLevel: 10, need: 150, max: false });
  assert.equal(S.progress(10_000).max, true);
  assert.equal(S.xpFor({ pve: 1, win: 1 }), 15);
  assert.equal(S.xpFor({ metal: 900, energy: 50 }), 0);
  assert.equal(S.passReward(10).core, 1); assert.equal(S.passReward(30).core, 1); assert.ok(!S.passReward(7).core);
  assert.ok(S.passReward(5).energy > 0 && S.passReward(29).metal > S.passReward(1).metal);
  assert.equal(S.badgeForRank(1), 'gold'); assert.equal(S.badgeForRank(7), 'top10');
  assert.ok(S.rankReward(1).metal > S.rankReward(2).metal && S.rankReward(2).metal > S.rankReward(10).metal);
});
t('Arena: terminy co 4 h (Warszawa), rozstawienie, drabinka i miejsca', () => {
  assert.equal(T.arenaNext(Date.parse('2026-11-16T14:30:00Z')), Date.parse('2026-11-16T15:00:00Z')); // 15:30 -> 16:00 w Warszawie
  assert.equal(T.arenaNext(Date.parse('2026-11-16T15:00:00Z')), Date.parse('2026-11-16T19:00:00Z')); // równo 16:00 -> następny 20:00
  assert.equal(T.arenaNext(Date.parse('2026-11-16T21:10:00Z')), Date.parse('2026-11-16T23:00:00Z')); // 22:10 -> północ
  assert.equal(T.clockHM(Date.parse('2026-11-16T15:00:00Z')), '16:00');
  assert.deepEqual(AR.seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.equal(AR.bracketSize(5), 8); assert.equal(AR.bracketSize(2), 2);
  assert.equal(AR.roundName(2, 3), 'Finał'); assert.equal(AR.roundName(0, 3), 'Ćwierćfinał');
  const mk = (id, g) => { const u = { level: 5, s_hull: 1, s_guns: g, s_shields: 1 }; return { id, name: 'P' + id, level: 5, u, stats: R.shipStats(u) }; };
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = AR.runTournament([1, 2, 3, 4, 5].map((i) => mk(i, i)), rnd);
  assert.equal(out.size, 8); assert.equal(out.rounds.length, 3);
  assert.equal(out.rounds[0].filter((m) => !m.a || !m.b).length, 3); // 3 wolne losy dla rozstawionych
  const places = [...out.places.values()].sort((a, b) => a - b);
  assert.deepEqual(places, [1, 2, 3, 3, 5]);
  assert.ok(AR.placeReward(1).metal > AR.placeReward(2).metal && AR.placeReward(3).metal > AR.placeReward(9).metal);
});
t('Osiągnięcia: progi, postęp i tytuły', () => {
  const s = { tutDone: 1, pve: 30, pvp: 0, mine: 3, minB: 1, expeditions: 0, level: 4, corp: 0, boss: 0, arena: 0, arenaWins: 0, streak: 2, pass: 0 };
  const ids = A.newlyEarned(s, new Set()).map((a) => a.id);
  assert.deepEqual(ids, ['kadet', 'pierwsza_krew', 'lowca']);
  assert.deepEqual(A.newlyEarned(s, new Set(ids)), []);
  assert.deepEqual(A.progress(A.BY_ID.postrach, s), [30, 100]);
  assert.equal(A.titleOf('lowca'), 'Łowca piratów'); assert.equal(A.titleOf('pierwsza_krew'), ''); assert.equal(A.titleOf('xyz'), '');
  assert.equal(new Set(A.LIST.map((a) => a.id)).size, A.COUNT);
});
console.log(`\n🎉 Testy jednostkowe: ${n} OK`);
