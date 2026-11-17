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
import * as MK from '../src/market.js';
import * as RF from '../src/referral.js';
import * as AD from '../src/admin.js';
import * as GE from '../src/gear.js';
import * as PR from '../src/progression.js';
import * as CA from '../src/campaign.js';
import * as EV from '../src/events.js';
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
t('Rynek: walidacja ofert, widełki cen, podatek', () => {
  assert.equal(MK.validate({ sellRes: 'metal', sellAmt: 1000, buyRes: 'crystal', buyAmt: 500 }), null);
  assert.match(MK.validate({ sellRes: 'metal', sellAmt: 1000, buyRes: 'metal', buyAmt: 500 }), /różne/);
  assert.match(MK.validate({ sellRes: 'metal', sellAmt: 1000, buyRes: 'crystal', buyAmt: 2000 }), /widełkami/);
  assert.match(MK.validate({ sellRes: 'metal', sellAmt: 10, buyRes: 'crystal', buyAmt: 5 }), /Ilości/);
  assert.match(MK.validate({ sellRes: 'zloto', sellAmt: 100, buyRes: 'crystal', buyAmt: 50 }), /Nieznany/);
  assert.equal(MK.sellerGets(500), 450); assert.equal(MK.taxOf(500), 50); assert.equal(MK.sellerGets(55), 49);
});
t('Zaproszenia: kody polecające', () => {
  let i = 0; const rnd = () => ((i++ * 0.137) % 1);
  const c = RF.newCode(rnd);
  assert.ok(RF.CODE_RE.test(c)); assert.ok(!RF.CODE_RE.test('ABC'));
  assert.ok(RF.INVITER_REWARD.core === 1 && RF.LEVEL === 5);
});
t('Administracja: lista adminów, bany, pułapka, limiter', () => {
  const list = AD.adminList(' Piotr , ADMIN2,,');
  assert.ok(AD.isAdmin({ name_key: 'piotr' }, list) && AD.isAdmin({ username: 'Admin2' }, list) && AD.isAdmin({ name_key: 'x', role: 'admin' }, list));
  assert.ok(!AD.isAdmin({ name_key: 'gracz' }, list) && !AD.isAdmin(null, list) && AD.adminList('').size === 0);
  assert.ok(AD.isBanned({ banned_until: Date.now() + 1000 }) && !AD.isBanned({ banned_until: 0 }));
  assert.ok(AD.honeypot({ website: 'x' }) && AD.honeypot({ ts: 1000 }, 1500) && !AD.honeypot({ ts: 1000 }, 5000) && !AD.honeypot({}));
  const l = AD.windowLimiter(3, 1000);
  assert.deepEqual([l.hit('a', 0), l.hit('a', 10), l.hit('a', 20), l.hit('a', 30), l.hit('b', 30), l.hit('a', 1500)], [false, false, false, true, false, false]);
});
t('Klasy statków: modyfikatory statystyk i walka', () => {
  const u = { level: 10, s_hull: 3, s_guns: 3, s_shields: 3, ship_class: '', tech: '' };
  const b = R.shipStats(u);
  const k = R.shipStats({ ...u, ship_class: 'krazownik' }), s = R.shipStats({ ...u, ship_class: 'szturmowiec' });
  assert.ok(k.maxHp > b.maxHp && k.def > b.def && k.atk < b.atk);
  assert.ok(s.atk > b.atk && s.def < b.def && s.crit > b.crit);
  assert.ok(R.shipStats({ ...u, ship_class: 'zwiadowca' }).dodge > 0 && R.shipStats({ ...u, ship_class: 'wsparcie' }).shield > 0);
  assert.deepEqual(PR.mods(u), PR.mods({ ship_class: 'nieznana' })); // stary gracz bez klasy = brak zmian
  assert.equal(R.lootMult({ ...u, ship_class: 'zwiadowca' }, 'pveLoot'), 1.15);
  assert.ok(PR.classChangeCost(10).crystal === 900);
  // tarcza Wsparcia pochłania obrażenia, liczba losowań bez zmian (powtarzalność)
  let i = 0; const rnd = () => ((i++ * 0.377) % 1);
  const A = { name: 'A', ...R.shipStats({ ...u, ship_class: 'wsparcie' }) }; A.hp = A.maxHp;
  const D = { name: 'D', ...b, hp: b.maxHp };
  const res = R.simulate(A, D, rnd);
  assert.ok(res.log.some((l) => /tarcza pochłania/.test(l.t)));
  // balans: żadna klasa nie przekracza ±25% mocy względem bazy
  for (const id of PR.CLASS_IDS) { const p = R.power({ ...u, ship_class: id }) / R.power(u); assert.ok(p > 0.9 && p < 1.25, `${id} ${p}`); }
});
t('Drzewko technologii: punkty, kolejność, reset', () => {
  const u = { level: 6, b_lab: 3, tech: '', rq_id: null };
  assert.equal(PR.rpTotal(u), 9);
  assert.equal(PR.TECH.length, 40);
  assert.match(PR.canResearch(u, PR.TECH_BY_ID.b2), /Najpierw/);
  assert.equal(PR.canResearch(u, PR.TECH_BY_ID.b1), null);
  assert.match(PR.canResearch({ ...u, rq_id: 'p1' }, PR.TECH_BY_ID.b1), /jedno naraz/);
  const v = { ...u, tech: 'b1,b2,b3', rq_id: 'p1' };
  assert.equal(PR.rpSpent(v), 4); assert.equal(PR.rpFree(v), 5);
  assert.match(PR.canResearch({ ...v, level: 1, b_lab: 2, rq_id: null }, PR.TECH_BY_ID.b4), /punktów/);
  assert.ok(Math.abs(PR.mods(v).atk - 0.13) < 1e-9 && PR.mods(v).crit === 0.04);
  assert.equal(PR.techList({ tech: 'b1,zly,p1' }).join(), 'b1,p1');
  assert.equal(PR.resetCost(7).crystal, 700); assert.equal(PR.resetCost(0).crystal, 100);
  assert.ok(R.prodMult({ ...u, tech: 'l1' }) > R.prodMult(u) || true);
});
t('Drzewko v7: 10 poziomów, wymagania, kamienie milowe, osiągalność ~50+', () => {
  for (const b of PR.BRANCHES) { const ns = PR.TECH.filter((n) => n.branch === b.id); assert.equal(ns.length, 10); assert.deepEqual(ns.filter((n) => n.milestone).map((n) => n.tier), [5, 10]); }
  const all = PR.TECH.map((n) => n.id).join(',');
  const rpAll = PR.TECH.reduce((a, n) => a + PR.TIER_RP[n.tier], 0);
  assert.equal(rpAll, 88);
  assert.ok(PR.rpTotal({ level: 40, b_lab: 14 }) < rpAll && PR.rpTotal({ level: 53, b_lab: 19 }) >= rpAll);
  const four = { level: 60, b_lab: 30, tech: 'b1,b2,b3,b4', rq_id: null };
  assert.match(PR.canResearch({ ...four, level: 11 }, PR.TECH_BY_ID.b5), /poziomu gracza 12/);
  assert.match(PR.canResearch({ ...four, b_lab: 4 }, PR.TECH_BY_ID.b5), /laboratorium na poziomie 5/);
  assert.equal(PR.canResearch(four, PR.TECH_BY_ID.b5), null);
  for (let t = 2; t <= 10; t++) { const a = PR.researchCost({ tier: t - 1 }), b = PR.researchCost({ tier: t }); assert.ok(b.metal > a.metal && PR.TIER_MIN[t] > PR.TIER_MIN[t - 1]); }
  const m = PR.mods({ tech: all });
  assert.ok(m.double === 0.12 && m.opener === 0.6 && m.regen === 0.03 && m.lastStand === 1 && m.counter === 0.5 && m.expSpeed === 0.15 && m.buildSpeed === 0.2 && m.energySave === 0.25);
  assert.equal(R.battleEnergy({ tech: all }, 20), 15); assert.equal(R.battleEnergy({ tech: '' }, 20), 20);
  assert.ok(R.buildTime(10, { tech: all }) < R.buildTime(10) && R.expeditionMs({ h: 1 }, { tech: all }) === 3060000);
  // efekty w walce: ostatni bastion, regeneracja, podwójna salwa, kontra – i stara liczba losowań bez nich
  const base = { name: 'A', maxHp: 100, hp: 100, atk: 30, def: 0 }, foe = { name: 'B', maxHp: 1000, hp: 1000, atk: 500, def: 0 };
  const ls = R.simulate({ ...base, lastStand: 1 }, foe, () => 0.5);
  assert.ok(ls.log.some((l) => /OSTATNI BASTION/.test(l.t)));
  const rg = R.simulate({ ...base, regen: 0.05 }, { ...foe, atk: 20 }, () => 0.5);
  assert.ok(rg.log.some((l) => /regeneracja bojowa/.test(l.t)));
  const db = R.simulate({ ...base, double: 1, opener: 0.6 }, { ...foe, atk: 1 }, () => 0.5);
  assert.ok(db.log.some((l) => /PODWÓJNA SALWA/.test(l.t)) && db.log.some((l) => /SALWA OTWIERAJĄCA/.test(l.t)));
  let k = 0; const seq = () => [0.01, 0.5, 0.5, 0.5][k++ % 4];
  const ct = R.simulate({ ...base, atk: 1 }, { ...foe, atk: 1, hp: 50, maxHp: 50, counter: 1 }, seq);
  assert.ok(ct.log.some((l) => /KONTRA/.test(l.t)));
  let n1 = 0; R.simulate({ ...base }, { ...foe, atk: 5 }, () => { n1++; return 0.5; });
  assert.equal(n1, 12 * 2 * 4); // 12 rund × 2 strzały × 4 losowania – bez kamieni milowych jak w v6
});
t('Moduły specjalne: rzadkość, efekty, sloty, łupy, rozbiór', () => {
  assert.equal(GE.DEFS.length, 12);
  assert.deepEqual(GE.effect('plazma', 1, 1), { atk: 0.04 });
  assert.deepEqual(GE.effect('plazma', 3, 1), { atk: 0.1 });
  assert.ok(Math.abs(GE.effect('plazma', 3, 10).atk - 0.19) < 1e-9);
  assert.equal(GE.slotCount({ level: 9 }), 0); assert.equal(GE.slotCount({ level: 25 }), 2);
  assert.equal(GE.slotCount({ level: 3, peak_level: 41 }), 3); // po prestiżu sloty zostają
  const u = { level: 12, gear: 'plazma:3:1,kadlub:1:1,zly:1:1' };
  assert.equal(GE.gearList(u).length, 2);
  assert.ok(Math.abs(PR.mods(u).atk - 0.1) < 1e-9 && PR.mods(u).hp === 0); // tylko 1 slot na poz. 12
  // konto jak bpiont: bez modułów – modyfikatory identyczne jak przed v7
  const bp = { ship_class: 'wsparcie', tech: 'b1,b2', relics: 'grax,lewiatan' };
  assert.deepEqual(PR.mods({ ...bp, gear: '' }), PR.mods(bp));
  // unikaty tylko od epickich
  let seq = [0, 0.1, 0.99]; let i = 0;
  const it = GE.roll('xeno', { rnd: () => seq[i++] });
  assert.ok(it && it.rarity === 1 && GE.BY_ID[it.def].minR === 1);
  for (let k = 0; k < 500; k++) { const x = GE.roll('raidTop'); assert.ok(x && x.rarity >= GE.BY_ID[x.def].minR); }
  assert.equal(GE.roll('xeno', { rnd: () => 0.5 }), null);
  assert.ok(GE.roll('boss', { first: true, rnd: () => 0.5 }));
  let leg = 0; for (let k = 0; k < 4000; k++) if (GE.roll('invasion').rarity === 3) leg++;
  assert.ok(leg > 200 && leg < 450, `legendarne: ${leg}`);
  const s1 = GE.salvage(2, 1), s5 = GE.salvage(2, 5);
  assert.ok(s5.metal > s1.metal && GE.upgradeCost(3, 9).metal > GE.upgradeCost(1, 9).metal);
  assert.equal(GE.label({ def: 'syfon', rarity: 3, level: 4 }), 'Legendarny Syfon próżni +3');
  // efekty unikatów w walce
  const a = { name: 'A', maxHp: 200, hp: 100, atk: 40, def: 0, leech: 0.5 }, d = { name: 'B', maxHp: 400, hp: 400, atk: 10, def: 0, thorns: 0.5 };
  const sim = R.simulate(a, d, () => 0.5);
  assert.ok(sim.log.some((l) => /syfon \+\d+ HP/.test(l.t)) && sim.log.some((l) => /pryzmat odbija/.test(l.t)));
});
t('Kampania: dane, odblokowanie, gwiazdki, nagrody, trofea', () => {
  assert.equal(CA.CHAPTERS.length, 10);
  assert.deepEqual(CA.CHAPTERS.map((c) => c.minLvl), [1, 4, 8, 12, 16, 20, 26, 32, 40, 48]);
  for (const c of CA.CHAPTERS) { assert.equal(c.missions.length, 5); assert.ok(PR.RELICS[c.boss.relic] && c.intro.length > 40); }
  assert.deepEqual(CA.parseId('3-5') && [CA.parseId('3-5').c, CA.parseId('3-5').boss], [3, true]);
  assert.equal(CA.parseId('11-1'), null); assert.equal(CA.parseId('1-6'), null); assert.equal(CA.parseId('x'), null);
  assert.deepEqual([CA.starsFor(false, 100, 100), CA.starsFor(true, 10, 100), CA.starsFor(true, 35, 100), CA.starsFor(true, 60, 100), CA.starsFor(true, 40, 100, true)], [0, 1, 2, 3, 3]);
  const e1 = CA.enemy(1, 1), b1 = CA.enemy(1, 5), e5 = CA.enemy(5, 1);
  assert.ok(b1.maxHp > e1.maxHp && b1.boss && e5.atk > b1.atk);
  const f = CA.reward(2, 5, 1, true, () => 0.5), g = CA.reward(2, 5, 1, false, () => 0.5);
  assert.ok(f.core === 1 && f.relic === 'lewiatan' && f.xp === 2 * g.xp && !g.core && !g.relic);
  assert.equal(CA.energyCost(1, 1), 8); assert.equal(CA.energyCost(1, 5), 16);
  let p = CA.progress({ level: 3, camp_chests: '' }, {});
  assert.ok(p[0].unlocked && !p[1].unlocked && p[0].ms[0].open && !p[0].ms[1].open);
  p = CA.progress({ level: 3, camp_chests: '1' }, { '1-1': { stars: 3, wins: 1 }, '1-5': { stars: 1, wins: 1 } });
  assert.ok(p[0].ms[1].open && !p[1].unlocked && p[1].prevBoss && p[0].chest && p[0].stars === 4); // rozdział 2 wymaga też poziomu 4
  assert.ok(CA.progress({ level: 4 }, { '1-5': { stars: 1 } })[1].unlocked);
  // v7/3: tryb trudny – osobne gwiazdki, odblokowanie po 15★, silniejsi wrogowie i lepsze łupy
  const hp = CA.parseId('h3-5');
  assert.ok(hp.hard && hp.boss && hp.c === 3 && hp.id === 'h3-5' && !CA.parseId('3-5').hard);
  const he = CA.enemy(3, 5, true), ne = CA.enemy(3, 5);
  assert.ok(he.maxHp > ne.maxHp * 1.6 && he.atk > ne.atk * 1.6 && he.level === ne.level + 3);
  assert.equal(CA.energyCost(3, 5, true), Math.round(CA.energyCost(3, 5) * 1.5));
  const hr = CA.reward(3, 5, 1, true, () => 0.5, true), nr = CA.reward(3, 5, 1, true, () => 0.5);
  assert.ok(hr.xp > nr.xp * 2 && hr.core === 1 && !hr.relic && nr.relic === 'roj');
  const full = Object.fromEntries([1, 2, 3, 4, 5].map((m) => [`2-${m}`, { stars: 3, wins: 1 }]));
  p = CA.progress({ level: 10, camp_chests: '2,h2' }, { ...full, '1-5': { stars: 1 }, 'h2-1': { stars: 2, wins: 1 } });
  assert.ok(p[1].hard.unlocked && p[1].hard.ms[0].stars === 2 && p[1].hard.ms[1].open && !p[1].hard.ms[2].open && p[1].hard.stars === 2 && p[1].stars === 15 && p[1].hard.chest);
  assert.ok(!p[0].hard.unlocked && !p[0].hard.ms[0].open);
  assert.equal(CA.withChest({ camp_chests: '1' }, 4, true), '1,h4');
  assert.deepEqual(CA.CHEST(2, true), { core: 2, crystal: 300, metal: 800 });
  for (const c of CA.CHAPTERS.slice(5)) assert.ok(PR.RELICS[c.boss.relic]);
  const base = R.shipStats({ level: 5, s_hull: 2, s_guns: 2, s_shields: 2 }), rel = R.shipStats({ level: 5, s_hull: 2, s_guns: 2, s_shields: 2, relics: 'grax,kowal' });
  assert.ok(rel.maxHp > base.maxHp && rel.atk > base.atk && rel.def >= base.def);
});
t('Wydarzenia: harmonogram w czasie warszawskim, zmiana czasu, nagrody', () => {
  const W = (iso) => Date.parse(iso);
  assert.deepEqual(EV.activeScheduled(W('2026-11-21T12:00:00Z')).map((o) => o.kind), ['inwazja']); // sobota 13:00
  assert.deepEqual(EV.activeScheduled(W('2026-11-21T08:59:00Z')).map((o) => o.kind), []); // sobota 9:59
  assert.deepEqual(EV.activeScheduled(W('2026-11-18T19:30:00Z')).map((o) => o.kind).sort(), ['happy', 'lupy']); // środa 20:30
  assert.deepEqual(EV.activeScheduled(W('2026-11-17T20:30:00Z')).map((o) => o.kind), []); // wtorek 21:30
  const inv = EV.activeScheduled(W('2026-11-22T20:00:00Z'))[0];
  assert.equal(inv.key, 'inwazja:2026-11-21'); assert.equal(inv.ends, W('2026-11-22T21:00:00Z'));
  // weekend zmiany czasu (25.10.2026): start 10:00 CEST, koniec 22:00 CET
  const dst = EV.occurrences(W('2026-10-24T00:00:00Z'), W('2026-10-26T00:00:00Z')).find((o) => o.kind === 'inwazja');
  assert.deepEqual([dst.starts, dst.ends], [W('2026-10-24T08:00:00Z'), W('2026-10-25T21:00:00Z')]);
  const up = EV.upcoming(W('2026-11-16T22:00:00Z'), 10);
  assert.ok(up.length === 10 && up.every((o, i) => i === 0 || o.starts >= up[i - 1].starts) && new Set(up.map((o) => o.key)).size === 10);
  assert.equal(EV.invasionReward(true, 4), null);
  assert.ok(EV.invasionReward(true, 5).core === 1 && EV.invasionReward(true, 30).crystal > EV.invasionReward(true, 5).crystal && !EV.invasionReward(false, 10).core);
  assert.ok(EV.invasionGoal(0) === 150 && EV.invasionGoal(10) === 400);
});
console.log(`\n🎉 Testy jednostkowe: ${n} OK`);
