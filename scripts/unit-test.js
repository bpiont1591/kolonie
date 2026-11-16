// Testy jednostkowe czystych reguł (bez serwera).
import assert from 'node:assert/strict';
import * as T from '../src/time.js';
import * as Q from '../src/quests.js';
import * as C from '../src/corp.js';
import * as R from '../src/rules.js';
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
console.log(`\n🎉 Testy jednostkowe: ${n} OK`);
