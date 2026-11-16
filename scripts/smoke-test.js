// Test dymny przez HTTP: rejestracja 2 graczy, zbieranie, ulepszenia, bitwy, korporacja, ranking.
// Użycie: BASE=http://localhost:3100 npm test   (serwer musi działać)
const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 3100}`;
// Token admina (z env lub z pliku .env.admin – nigdy nie wypisywany): konta testowe są oznaczane i sprzątane po teście.
import fs from 'node:fs';
const TOKEN = process.env.ADMIN_TOKEN || (() => { try { return /^ADMIN_TOKEN=(.+)$/m.exec(fs.readFileSync(new URL('../.env.admin', import.meta.url), 'utf8'))[1].trim(); } catch { return ''; } })();
const T_HDR = TOKEN ? { 'x-kolonie-test': TOKEN } : {};
async function cleanup() {
  if (!TOKEN) { console.log('⚠️  Brak ADMIN_TOKEN – konta testowe NIE zostały usunięte.'); return null; }
  const r = await fetch(BASE + '/api/admin/sprzataj', { method: 'POST', headers: { 'x-admin-token': TOKEN, accept: 'application/json' } });
  return r.status === 200 ? r.json() : { ok: false, status: r.status };
}
const bail = async (e) => { console.error(e); await cleanup().catch(() => {}); process.exit(1); };
process.on('uncaughtException', bail);
process.on('unhandledRejection', bail);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, label, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

class Client {
  constructor(name, hdr = {}) { this.name = name; this.cookie = ''; this.hdr = hdr; }
  async req(method, path, body, json = true) {
    const headers = { cookie: this.cookie, ...T_HDR, ...this.hdr };
    if (json) headers.accept = 'application/json';
    if (body) headers['content-type'] = 'application/x-www-form-urlencoded';
    const res = await fetch(BASE + path, { method, headers, body: body ? new URLSearchParams(body) : undefined, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      if (kv.startsWith('sid=')) this.cookie = kv;
    }
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
  get(p, json = true) { return this.req('GET', p, null, json); }
  post(p, b = {}) { return this.req('POST', p, b); }
  async postJson(path, body) {
    const res = await fetch(BASE + path, { method: 'POST', headers: { cookie: this.cookie, accept: 'application/json', 'content-type': 'application/json', ...T_HDR, ...this.hdr }, body: JSON.stringify(body) });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
}

const suffix = Date.now().toString(36).slice(-5);
const A = new Client(`Nova_${suffix}`), B = new Client(`Orion_${suffix}`);

let r = await A.post('/rejestracja', { username: A.name, password: 'tajne123' });
A.id = r.data.userId;
check(r.status === 200 && r.data.ok, `Rejestracja ${A.name}`, r.data.msg);
r = await B.post('/rejestracja', { username: B.name, password: 'haslo456' });
check(r.status === 200 && r.data.ok, `Rejestracja ${B.name}`, r.data.msg);
B.id = r.data.userId;
const E = new Client(`Lyra_${suffix}`);
r = await E.post('/rejestracja', { username: E.name, password: 'haslo321' });
E.id = r.data.userId;
r = await new Client('x').post('/rejestracja', { username: A.name, password: 'cokolwiek' });
check(r.status === 400, 'Duplikat nazwy odrzucony', r.data.msg);
r = await new Client('x').post('/logowanie', { username: A.name, password: 'zle-haslo' });
check(r.status === 400, 'Złe hasło odrzucone');
const C = new Client(A.name);
r = await C.post('/logowanie', { username: A.name, password: 'tajne123' });
check(r.status === 200 && r.data.ok, 'Logowanie poprawnym hasłem');
r = await new Client('anon').get('/api/stan');
check(r.status === 401, 'Brak dostępu bez sesji');

let st = (await A.get('/api/stan')).data;
check(st.ok && st.user.level === 1, 'Stan gracza', `metal=${st.stock.metal} kryształy=${st.stock.crystal} energia=${st.stock.energy}`);
const before = st.stock;

// zbieranie – czekamy, aż w magazynie wydobycia coś się pojawi
for (let i = 0; i < 30; i++) {
  st = (await A.get('/api/stan')).data;
  if (st.pending.metal > 0 && st.pending.energy > 0) break;
  await sleep(1000);
}
r = await A.post('/kolonia/zbierz');
check(r.data.ok, 'Zbieranie surowców', r.data.msg);
st = (await A.get('/api/stan')).data;
check(st.stock.metal > before.metal, 'Metal wzrósł po zebraniu', `${before.metal} → ${st.stock.metal}`);
r = await A.post('/kolonia/zbierz');
check(!r.data.ok, 'Ponowne zbieranie od razu – pusty magazyn', r.data.msg);

r = await A.post('/kolonia/ulepsz/mine');
check(r.data.ok && r.data.level === 2 && r.data.seconds > 0, 'Budowa kopalni poz. 2 rozpoczęta (kolejka)', r.data.msg);
r = await A.post('/kolonia/ulepsz/power');
check(!r.data.ok, 'Kolejka budynków: tylko jedna budowa naraz', r.data.msg);
r = await A.post('/kolonia/ulepsz/nieistnieje');
check(!r.data.ok, 'Nieznany budynek odrzucony');
r = await A.post('/statek/ulepsz/guns');
check(r.data.ok && r.data.level === 2 && r.data.seconds > 0, 'Montaż dział poz. 2 rozpoczęty (osobna kolejka stoczni)', r.data.msg);
r = await A.post('/statek/ulepsz/hull');
check(!r.data.ok, 'Kolejka modułów: jeden moduł naraz', r.data.msg);
st = (await A.get('/api/stan')).data;
check(st.user.b_mine === 1 && st.user.bq_id === 'mine', 'Poziom rośnie dopiero po ukończeniu budowy');
await sleep(9000);
st = (await A.get('/api/stan')).data;
check(st.user.b_mine === 2 && st.user.s_guns === 2 && !st.user.bq_id && !st.user.mq_id, 'Budowy ukończone przy odczycie (bez crona)', `atak=${st.ship.atk}`);
r = await A.post('/statek/ulepsz/guns');
check(!r.data.ok, 'Limit stoczni blokuje poz. 3', r.data.msg);

r = await A.post('/bitwa/piraci/zwiadowca');
check(r.data.ok && r.data.battleId > 0, 'Bitwa z piratami (PvE)', `${r.data.won ? 'wygrana' : 'przegrana'} w ${r.data.rounds} rundach, nagroda ${JSON.stringify(r.data.reward)}`);
const pveId = r.data.battleId;
r = await A.post('/bitwa/piraci/zwiadowca');
check(!r.data.ok, 'Cooldown między bitwami', r.data.msg);
r = await A.get(`/bitwa/${pveId}`, false);
check(r.status === 200 && r.data.includes('Przebieg'), 'Raport z bitwy (HTML)');
r = await B.get(`/bitwa/${pveId}`, false);
check(r.status === 404, 'Cudzy raport niedostępny');

await sleep(4200);
r = await A.post(`/bitwa/gracz/${B.id}`);
check(r.data.ok && r.data.battleId > 0, `Bitwa PvP ${A.name} vs ${B.name}`, `${r.data.won ? 'wygrana' : 'przegrana'}, ${r.data.msg}`);
await sleep(4200);
r = await A.post(`/bitwa/gracz/${B.id}`);
check(!r.data.ok, 'Ochrona po ataku działa', r.data.msg);

r = await A.post('/korporacja/zaloz', { name: `Gwiezdna Flota ${suffix}`, tag: suffix.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X') });
check(r.data.ok, 'Założenie korporacji', r.data.msg);
const corpId = r.data.corpId;
r = await B.post(`/korporacja/dolacz/${corpId}`);
check(r.data.ok, 'Dołączenie do korporacji', r.data.msg);

r = await A.get('/api/ranking?tab=gracze');
const names = r.data.rows.map((x) => x.username);
check(names.includes(A.name) && names.includes(B.name), 'Ranking graczy zawiera obu graczy', `pozycja ${A.name}: #${r.data.myRank}`);
const ia = names.indexOf(A.name), ib = names.indexOf(B.name);
const ra = r.data.rows[ia], rb = r.data.rows[ib];
const expectAFirst = ra.level > rb.level || (ra.level === rb.level && ra.xp >= rb.xp);
check(expectAFirst === ia < ib, 'Kolejność rankingu poprawna', `${A.name} Lv${ra.level}/${ra.xp}XP vs ${B.name} Lv${rb.level}/${rb.xp}XP`);
r = await A.get('/api/ranking?tab=pvp');
check(r.data.ok && r.data.rows.length >= 2, 'Ranking PvP', `#1 ${r.data.rows[0].username} ${r.data.rows[0].pvp_points} pkt`);
r = await A.get('/api/ranking?tab=korporacje');
check(r.data.rows.some((c) => c.id === corpId && c.members === 2), 'Ranking korporacji (2 członków)');

// ---------- Etap 1: nagrody dnia i misje ----------
const DEV = (await A.post('/api/dev/misja', { ev: 'noop' })).status === 200;
console.log(DEV ? 'ℹ️  DEV_HOOKS dostępne – pełne testy czasu' : 'ℹ️  Brak DEV_HOOKS (serwer produkcyjny) – testy czasu pominięte');
let ms = (await A.get('/api/misje')).data;
check(ms.ok && ms.daily.length === 4 && ms.weekly.length === 5 && ms.chests.length === 3, 'Misje: 4 dzienne, 5 tygodniowych, 3 skrzynie');
check(ms.login && ms.login.claimedToday === false && ms.login.next === 1, 'Kalendarz logowań: dzień 1 do odebrania');
r = await A.post('/misje/logowanie');
check(r.data.ok && r.data.day === 1 && r.data.reward.metal > 0, 'Odbiór nagrody dnia 1', r.data.msg);
r = await A.post('/misje/logowanie');
check(!r.data.ok, 'Drugi odbiór tego samego dnia odrzucony', r.data.msg);
ms = (await A.get('/api/misje')).data;
const wUpg = ms.weekly.find((q) => q.id === 'w_upg');
check(wUpg.progress >= 2, 'Postęp misji tygodniowej śledzony na serwerze', `ulepszenia ${wUpg.progress}/${wUpg.goal}`);
const wWin = ms.weekly.find((q) => q.id === 'w_win');
check(wWin.progress >= 0 && wWin.progress <= wWin.goal, 'Postęp „wygraj bitwy” zliczany', `${wWin.progress}/${wWin.goal}`);
r = await A.post('/misje/odbierz/w_pvp');
check(!r.data.ok, 'Nieukończonej misji nie można odebrać', r.data.msg);
r = await A.get('/misje', false);
check(r.status === 200 && r.data.includes('Nagroda dnia') && r.data.includes('Misje dzienne'), 'Strona /misje');
if (DEV) {
  for (const ev of ['win', 'upgrade', 'metal', 'pvp']) await A.post('/api/dev/misja', { ev, amount: 9000 });
  let gained = 0;
  for (const id of ['w_win', 'w_upg', 'w_metal', 'w_pvp']) { r = await A.post(`/misje/odbierz/${id}`); if (r.data.ok) gained += r.data.points; }
  check(gained === 100, 'Odbiór 4 misji tygodniowych (+100 pkt)', `${gained} pkt`);
  r = await A.post('/misje/odbierz/w_win');
  check(!r.data.ok, 'Podwójny odbiór misji odrzucony');
  r = await A.post('/misje/skrzynia/1');
  check(r.data.ok && r.data.reward.metal > 0, 'Skrzynia brązowa (50 pkt) otwarta', r.data.msg);
  r = await A.post('/misje/skrzynia/2');
  check(!r.data.ok, 'Skrzynia srebrna zablokowana (120 pkt)', r.data.msg);
  const dq = ms.daily[0];
  await A.post('/api/dev/misja', { ev: dq.ev, amount: dq.goal });
  r = await A.post(`/misje/odbierz/${dq.id}`);
  check(r.data.ok && r.data.points === 10, `Misja dzienna „${dq.name}” odebrana`, r.data.msg);
  await A.post('/api/dev/przewin', { minutes: 1440 });
  r = await A.post('/misje/logowanie');
  check(r.data.ok && r.data.day === 2, 'Seria logowań: następnego dnia dzień 2', r.data.msg);
  await A.post('/api/dev/przewin', { minutes: 2880 });
  r = await A.post('/misje/logowanie');
  check(r.data.ok && r.data.day === 1, 'Pominięty dzień resetuje serię do dnia 1', r.data.msg);
}

// ---------- Etap 2: przyspieszanie budowy i ekspedycje ----------
st = (await A.get('/api/stan')).data;
r = await A.post('/kolonia/ulepsz/power');
check(r.data.ok && r.data.level === 2, 'Budowa elektrowni rozpoczęta', r.data.msg);
r = await A.post('/kolonia/przyspiesz');
const st2 = (await A.get('/api/stan')).data;
check(r.data.ok && r.data.level === 2 && st2.user.b_power === 2, 'Natychmiastowe ukończenie za kryształy', r.data.msg);
r = await B.post('/ekspedycje/wyslij/zwiad');
check(r.data.ok && r.data.until > Date.now(), 'Wysłanie ekspedycji 1 h', r.data.msg);
r = await B.post('/ekspedycje/wyslij/zwiad');
check(!r.data.ok, 'Druga ekspedycja w trakcie odrzucona', r.data.msg);
r = await B.post('/bitwa/piraci/zwiadowca');
check(!r.data.ok && /ekspedycji/.test(r.data.msg), 'Statek na ekspedycji nie może walczyć', r.data.msg);
r = await B.post('/ekspedycje/zawroc');
check(r.data.ok, 'Zawrócenie statku z ekspedycji', r.data.msg);
let ex = (await B.get('/api/ekspedycje')).data;
check(ex.rows[0].status === 'recalled' && ex.ex_until === 0, 'Ekspedycja odwołana, statek w bazie');
r = await B.post('/ekspedycje/wyslij/zwiad');
check(r.data.ok, 'Ponowne wysłanie ekspedycji', r.data.msg);
if (DEV) {
  await B.post('/api/dev/przewin', { minutes: 61 });
  ex = (await B.get('/api/ekspedycje')).data;
  const res = ex.rows[0].result;
  check(ex.rows[0].status === 'done' && ex.ex_until === 0 && res.loot.metal > 0, 'Powrót ekspedycji: losowe zdarzenie i łup', `${res.title}: metal ${res.loot.metal}, kryształy ${res.loot.crystal}, obrażenia ${Math.round(res.dmg * 100)}%`);
  r = await B.get(`/ekspedycje/${ex.rows[0].id}`, false);
  check(r.status === 200 && r.data.includes(res.title), 'Raport z ekspedycji (HTML)');
  r = await A.get(`/ekspedycje/${ex.rows[0].id}`, false);
  check(r.status === 404, 'Cudzy raport ekspedycji niedostępny');
} else {
  r = await B.post('/ekspedycje/zawroc');
  check(r.data.ok, 'Sprzątanie: zawrócenie testowej ekspedycji');
}
r = await B.get('/ekspedycje', false);
check(r.status === 200 && r.data.includes('Ekspedycje'), 'Strona /ekspedycje');

// ---------- Etap 3: korporacje – role, skarbiec, wojna, boss ----------
let ca = (await A.get('/api/korporacja')).data, cb = (await B.get('/api/korporacja')).data;
check(ca.role === 'leader' && cb.role === 'member', 'Role: założyciel = przywódca, nowy = członek');
r = await B.post('/korporacja/wplac', { metal: 50 });
ca = (await A.get('/api/korporacja')).data;
check(r.data.ok && ca.corp.t_metal >= 50, 'Wpłata do skarbca', r.data.msg);
r = await B.post('/korporacja/wplac', { metal: 5 });
check(!r.data.ok, 'Wpłata poniżej minimum odrzucona');
r = await B.post('/korporacja/ulepsz/hq');
check(!r.data.ok && /oficer/i.test(r.data.msg), 'Członek nie może wydawać skarbca', r.data.msg);
r = await A.post(`/korporacja/awans/${B.id}`);
check(r.data.ok && r.data.role === 'officer', 'Awans na oficera', r.data.msg);
r = await B.post('/korporacja/ulepsz/hq');
check(!r.data.ok && /skarbcu/.test(r.data.msg), 'Ulepszenie wymaga surowców w skarbcu', r.data.msg);
r = await B.post('/korporacja/cel/2');
check(r.data.ok && r.data.target === 2, 'Oficer ustawia cel wojny', r.data.msg);
r = await B.post(`/korporacja/wyrzuc/${A.id || 0}`);
check(!r.data.ok, 'Oficer nie może wyrzucić przywódcy');
r = await B.post('/korporacja/boss/wezwij');
check(r.data.ok && r.data.hp > 0, 'Wezwanie bossa rajdowego', r.data.msg);
r = await B.post('/korporacja/boss/wezwij');
check(!r.data.ok, 'Drugi boss naraz odrzucony');
await sleep(4200);
r = await B.post('/korporacja/boss/atak');
check(r.data.ok && r.data.damage > 0, 'Atak na bossa', r.data.msg);
cb = (await B.get('/api/korporacja')).data;
check(cb.boss.hp === cb.boss.max_hp - r.data.damage && cb.hits.length === 1, 'Wspólne HP bossa i ranking obrażeń', `${cb.boss.hp}/${cb.boss.max_hp}`);
const wp = cb.war.mine.find((x) => x.planet === 2);
check(wp && wp.points >= 2, 'Punkty wojny na planecie-celu', `planeta 2: ${wp?.points} pkt`);
r = await B.post(`/korporacja/boss/odbierz/${cb.boss.id}`);
check(!r.data.ok, 'Nagroda niedostępna w trakcie walki');
r = await A.post(`/korporacja/awans/${B.id}`);
check(r.data.ok && r.data.role === 'leader', 'Przekazanie dowodzenia', r.data.msg);
r = await B.post(`/korporacja/awans/${A.id || 0}`);
check(r.data.ok && r.data.role === 'leader', 'Zwrot dowodzenia', r.data.msg);
r = await A.post(`/korporacja/degraduj/${B.id}`);
check(r.data.ok && r.data.role === 'member', 'Degradacja oficera', r.data.msg);
if (DEV) {
  await A.post('/api/dev/surowce');
  r = await A.post('/korporacja/wplac', { metal: 3000, crystal: 1500, energy: 1000 });
  r = await A.post('/korporacja/ulepsz/hq');
  ca = (await A.get('/api/korporacja')).data;
  check(r.data.ok && ca.corp.u_hq === 1, 'Ulepszenie Centrum dowodzenia (+5 miejsc)', r.data.msg);
  await B.post('/api/dev/przewin', { minutes: 49 * 60 });
  r = await B.post(`/korporacja/boss/odbierz/${cb.boss.id}`);
  check(r.data.ok && r.data.killed === false && r.data.reward.metal > 0, 'Boss uciekł po 48 h – nagroda pocieszenia wg obrażeń', r.data.msg);
  r = await B.post(`/korporacja/boss/odbierz/${cb.boss.id}`);
  check(!r.data.ok, 'Podwójny odbiór nagrody z bossa odrzucony');
}
r = await A.post(`/korporacja/wyrzuc/${B.id}`);
check(r.data.ok, 'Przywódca usuwa członka', r.data.msg);
r = await B.post(`/korporacja/dolacz/${corpId}`);
check(r.data.ok, 'Ponowne dołączenie', r.data.msg);

// ---------- v5 etap 1: samouczek ----------
st = (await E.get('/api/stan')).data;
check(st.tut && st.tut.n === 1 && !st.tut.done && st.tut.key === 'collect', 'Samouczek: nowy gracz zaczyna od kroku 1/5', st.tut?.title);
r = await E.get('/kolonia', false);
check(r.data.includes('Misja startowa') && r.data.includes('data-tut="collect"') && r.data.includes('body class="in ') && /<body[^>]*data-tut-step="collect"/.test(r.data), 'Samouczek: pasek i podświetlenie elementu');
r = await E.post('/samouczek/odbierz');
check(!r.data.ok, 'Samouczek: nagroda dopiero po wykonaniu kroku', r.data.msg);
const tutSteps = [['/kolonia/zbierz', 'Zbierz'], ['/kolonia/ulepsz/mine', 'Kopalnia'], ['/bitwa/piraci/zwiadowca', 'Piraci'], ['/statek/ulepsz/guns', 'Działa'], ['/misje/logowanie', 'Nagroda dnia']];
for (const [i, [path, label]] of tutSteps.entries()) {
  const a = await E.post(path);
  st = (await E.get('/api/stan')).data;
  const before = st.stock?.metal;
  check(a.data.ok && st.tut?.n === i + 1 && st.tut.done, `Samouczek: krok ${i + 1} wykonany (${label})`, a.data.msg);
  r = await E.post('/samouczek/odbierz');
  check(r.data.ok && r.data.step === i + 2 && r.data.reward?.xp > 0, `Samouczek: nagroda za krok ${i + 1}`, r.data.msg);
  if (i === 4) check(r.data.finished && r.data.reward.core === 1, 'Samouczek: finał z Rdzeniem kwantowym');
  if (path.includes('piraci')) await sleep(100);
}
st = (await E.get('/api/stan')).data;
check(st.tut === null && st.user.tut_step === 6 && st.user.boost_until > Date.now(), 'Samouczek ukończony (pasek znika, doładowanie aktywne)');
r = await E.post('/samouczek/odbierz');
check(!r.data.ok, 'Samouczek: brak podwójnych nagród');

// ---------- v5 etap 2: sezony i przepustka ----------
let sz = (await A.get('/api/sezon')).data;
check(sz.ok && sz.xp > 0 && sz.levels.length === 30 && /^\d{4}-\d{2}$/.test(sz.season), 'Sezon: XP sezonu z walk i zbierania', `${sz.season}: ${sz.xp} XP, poziom ${sz.level}`);
check(sz.ranking.rows.some((x) => x.id === A.id) && sz.ranking.myRank >= 1, 'Sezon: gracz w rankingu sezonowym', `#${sz.ranking.myRank}`);
r = await E.post('/sezon/odbierz/30');
check(!r.data.ok, 'Przepustka: nieosiągnięty poziom zablokowany', r.data.msg);
for (const p of ['/sezon', '/sezon/ranking', '/sezon/archiwum']) { r = await E.get(p, false); check(r.status === 200 && r.data.includes('</html>'), `Strona ${p}`); }
r = await E.get('/sezon', false);
check(r.data.includes('Premium') && !/kup|zapłać|płatnoś/i.test(r.data.replace(/nie da się jej kupić/g, '')), 'Przepustka: ścieżka Premium tylko jako zablokowany podgląd');
if (DEV) {
  await E.post('/api/dev/sezon', { season: sz.season, xp: 700 });
  r = await E.post('/sezon/odbierz/1');
  check(r.data.ok && r.data.reward.metal > 0, 'Przepustka: odbiór poziomu 1', r.data.msg);
  r = await E.post('/sezon/odbierz/1');
  check(!r.data.ok, 'Przepustka: brak podwójnego odbioru');
  r = await E.post('/sezon/odbierz-wszystko');
  check(r.data.ok && r.data.levels.join() === '2,3,4', 'Przepustka: odbierz wszystko (poziomy 2–4)', r.data.msg);
  await E.post('/api/dev/sezon', { season: sz.season, xp: 4500 });
  r = await E.post('/sezon/odbierz-wszystko');
  check(r.data.ok && r.data.levels.length === 26 && r.data.reward.core === 3, 'Przepustka: poziomy 5–30 z 3 Rdzeniami', `${r.data.levels?.length} poziomów`);
  const fake = `T-${suffix}`;
  await E.post('/api/dev/sezon', { season: fake, xp: 999 });
  await A.post('/api/dev/sezon', { season: fake, xp: 500 });
  r = await new Client('anon').postJson('/api/dev/sezon-zakoncz', { season: fake });
  check(r.data.ok && r.data.awarded >= 2, 'Sezon: zamknięcie sezonu (top 10)', `nagrodzonych: ${r.data.awarded}`);
  r = await new Client('anon').postJson('/api/dev/sezon-zakoncz', { season: fake });
  check(r.data.awarded === null, 'Sezon: zamknięcie tylko raz');
  sz = (await E.get('/api/sezon')).data;
  const aw = sz.awards.find((x) => x.season === fake);
  check(aw && aw.rank === 1 && sz.badges.some((b) => b.badge === 'gold' && b.season === fake) && sz.badges.some((b) => b.badge === 'pass'), 'Sezon: odznaki (mistrz sezonu, przepustka ukończona)');
  r = await E.post(`/sezon/nagroda/${fake}`);
  check(r.data.ok && r.data.rank === 1 && r.data.reward.metal === 5000, 'Sezon: nagroda za 1. miejsce', r.data.msg);
  r = await E.post(`/sezon/nagroda/${fake}`);
  check(!r.data.ok, 'Sezon: nagroda za miejsce tylko raz');
  r = await E.get('/sezon/archiwum', false);
  check(r.data.includes(E.name) && r.data.includes(fake), 'Sezon: archiwum zwycięzców');
}

// ---------- v5 etap 3: osiągnięcia, tytuły, arena ----------
let ach = (await E.get('/api/osiagniecia')).data;
check(ach.ok && ach.count >= 15 && ach.unlocked.includes('kadet') && ach.unlocked.includes('pierwsza_krew'), 'Osiągnięcia: odblokowane automatycznie (Kadet, Pierwsza krew)', ach.unlocked?.join(', '));
r = await E.post('/osiagniecia/tytul/legenda');
check(!r.data.ok, 'Tytuł: nie można ustawić niezdobytego', r.data.msg);
r = await E.post('/osiagniecia/tytul/kadet');
check(r.data.ok && r.data.titleText === 'Kadet', 'Tytuł: ustawienie „Kadet”', r.data.msg);
r = await E.get('/osiagniecia', false);
check(r.status === 200 && r.data.includes('who-t') && r.data.includes('Osiągnięcia') && r.data.includes('tchip on'), 'Osiągnięcia: strona z tytułem przy nicku');
r = await A.get('/api/ranking?tab=gracze');
check(r.data.rows.find((x) => x.id === E.id)?.title === 'kadet', 'Tytuł widoczny w rankingu');
r = await E.get('/ranking', false);
check(r.data.includes('class="ttl">Kadet'), 'Tytuł przy nicku w rankingu (HTML)');

let ar = (await E.get('/api/arena')).data;
check(ar.ok && ar.next > Date.now() && ar.next - Date.now() <= 4 * 3600_000 && !ar.joined, 'Arena: najbliższy turniej w ciągu 4 h', new Date(ar.next).toISOString());
let lv = (await E.get('/api/stan')).data;
const enBefore = lv.stock.energy;
r = await E.post('/arena/zapisz');
check(r.data.ok && r.data.start === ar.next, 'Arena: zapis na turniej', r.data.msg);
lv = (await E.get('/api/stan')).data;
check(Math.round(enBefore - lv.stock.energy) === 10 || lv.stock.energy < enBefore, 'Arena: opłata ⚡10', `${Math.floor(enBefore)} → ${Math.floor(lv.stock.energy)}`);
r = await E.post('/arena/zapisz');
check(!r.data.ok, 'Arena: brak podwójnego zapisu', r.data.msg);
r = await E.post('/arena/wypisz');
check(r.data.ok, 'Arena: wypisanie ze zwrotem energii', r.data.msg);
r = await E.post('/arena/zapisz');
check(r.data.ok, 'Arena: ponowny zapis');
r = await E.get('/arena', false);
check(r.status === 200 && r.data.includes(E.name) && r.data.includes('Wypisz się') && r.data.includes('Nagrody'), 'Arena: strona z listą zapisanych');
r = await E.get('/bitwa', false);
check(r.data.includes('Arena – turniej o') && r.data.includes('Jesteś zapisany'), 'Arena: zaproszenie na stronie Bitwa');
if (DEV) {
  r = await E.postJson('/api/dev/arena-teraz', {});
  check(r.data.ok && r.data.status === 'cancelled' && r.data.players === 1, 'Arena: turniej odwołany przy 1 graczu (zwrot energii)');
  const lvl = {};
  for (const c of [A, B, E]) { await c.post('/api/dev/surowce'); lvl[c.name] = (await c.get('/api/stan')).data.user.level; }
  for (const c of [A, B, E]) {
    r = await c.post('/arena/zapisz');
    check(lvl[c.name] >= 2 ? r.data.ok : !r.data.ok, `Arena: zapis ${c.name} (poz. ${lvl[c.name]})`, r.data.msg);
  }
  const joined = [A, B, E].filter((c) => lvl[c.name] >= 2);
  r = await E.postJson('/api/dev/arena-teraz', {});
  const places = Object.values(r.data.places || {}).sort((a, b) => a - b);
  check(r.data.ok && r.data.status === 'done' && r.data.players === joined.length && places[0] === 1 && places[1] === 2, 'Arena: turniej rozegrany (drabinka, miejsca)', JSON.stringify(r.data.places));
  const start = r.data.start;
  ar = (await E.get('/api/arena')).data;
  check(ar.results[0]?.start === start && ar.results[0].place >= 1, 'Arena: wynik w historii gracza', `miejsce ${ar.results[0]?.place}`);
  r = await E.get(`/arena/turniej/${start}`, false);
  check(r.status === 200 && r.data.includes('Finał') && r.data.includes('Mistrz') && r.data.includes(E.name), 'Arena: strona turnieju z drabinką');
  r = await E.get('/arena', false);
  check(r.data.includes('Ostatni turniej') && r.data.includes('bk-col'), 'Arena: ostatnia drabinka na stronie areny');
} else {
  r = await E.post('/arena/wypisz');
  check(r.data.ok, 'Arena: wypisanie konta testowego przed sprzątaniem');
}
r = await E.post('/osiagniecia/tytul/brak');
check(r.data.ok && r.data.title === '', 'Tytuł: zdjęcie tytułu');

// ---------- v5 etap 4: rynek i zaproszenia ----------
const fpOf = (k) => (T_HDR['x-kolonie-test'] ? { 'x-test-ip': `${k}-${suffix}`, 'x-test-device': `${k}-${suffix}` } : {});
const M1 = new Client(`Kupiec_${suffix}`, fpOf('m1')), M2 = new Client(`Handlarz_${suffix}`, fpOf('m2')), M3 = new Client(`Klon_${suffix}`, fpOf('m1'));
for (const c of [M1, M2, M3]) { r = await c.post('/rejestracja', { username: c.name, password: 'rynek123' }); c.id = r.data.userId; }
check(M1.id && M2.id && M3.id, 'Rynek: konta testowe handlarzy');
r = await M1.post('/rynek/wystaw', { sell_res: 'metal', sell_amt: 300, buy_res: 'crystal', buy_amt: 150 });
check(!r.data.ok && /poziomu 3/.test(r.data.msg), 'Rynek: dostęp od poziomu 3', r.data.msg);
r = await M1.get('/rynek', false);
check(r.status === 200 && r.data.includes('Rynek surowców') && r.data.includes('Podatek 10%'), 'Rynek: strona');
r = await M1.get('/api/rynek');
check(r.data.ok && Array.isArray(r.data.offers) && r.data.tax === 0.1, 'Rynek: API ofert');
if (DEV) {
  for (const c of [M1, M2, M3]) { await c.post('/api/dev/poziom', { level: 4 }); await c.post('/api/dev/surowce'); }
  r = await M1.post('/rynek/wystaw', { sell_res: 'metal', sell_amt: 300, buy_res: 'metal', buy_amt: 300 });
  check(!r.data.ok, 'Rynek: ten sam surowiec odrzucony', r.data.msg);
  r = await M1.post('/rynek/wystaw', { sell_res: 'metal', sell_amt: 1000, buy_res: 'crystal', buy_amt: 2000 });
  check(!r.data.ok && /widełkami/.test(r.data.msg), 'Rynek: cena poza widełkami odrzucona', r.data.msg);
  const s1 = (await M1.get('/api/stan')).data.stock;
  r = await M1.post('/rynek/wystaw', { sell_res: 'metal', sell_amt: 1000, buy_res: 'crystal', buy_amt: 500 });
  check(r.data.ok && r.data.offerId > 0, 'Rynek: wystawienie oferty (depozyt)', r.data.msg);
  const offer1 = r.data.offerId;
  let s1b = (await M1.get('/api/stan')).data.stock;
  check(Math.round(s1.metal - s1b.metal) === 1000 || s1.metal - s1b.metal > 990, 'Rynek: metal pobrany do depozytu', `${Math.floor(s1.metal)} → ${Math.floor(s1b.metal)}`);
  r = await M1.post(`/rynek/kup/${offer1}`);
  check(!r.data.ok, 'Rynek: nie można kupić własnej oferty');
  r = await M3.post(`/rynek/kup/${offer1}`);
  check(!r.data.ok && /multikont/.test(r.data.msg), 'Rynek: blokada handlu między kontami z tego samego IP/urządzenia', r.data.msg);
  const s2 = (await M2.get('/api/stan')).data.stock;
  r = await M2.post(`/rynek/kup/${offer1}`);
  check(r.data.ok && r.data.sellerGets === 450, 'Rynek: zakup oferty (podatek 10%)', r.data.msg);
  const s2b = (await M2.get('/api/stan')).data.stock;
  check(s2b.metal - s2.metal >= 999 && s2.crystal - s2b.crystal >= 499 && s2.crystal - s2b.crystal < 520, 'Rynek: kupujący otrzymał metal i zapłacił kryształami');
  const s1c = (await M1.get('/api/stan')).data.stock;
  check(s1c.crystal - s1b.crystal >= 449 && s1c.crystal - s1b.crystal < 470, 'Rynek: sprzedający otrzymał 450 kryształów (po podatku)', `${Math.floor(s1b.crystal)} → ${Math.floor(s1c.crystal)}`);
  r = await M2.post(`/rynek/kup/${offer1}`);
  check(!r.data.ok, 'Rynek: oferta sprzedana tylko raz');
  r = await M1.post('/rynek/wystaw', { sell_res: 'energy', sell_amt: 400, buy_res: 'metal', buy_amt: 600 });
  const offer2 = r.data.offerId;
  r = await M1.post(`/rynek/anuluj/${offer2}`);
  check(r.data.ok, 'Rynek: wycofanie oferty ze zwrotem depozytu', r.data.msg);
  r = await M1.get('/rynek', false);
  check(r.data.includes('Sprzedałeś graczowi') && r.data.includes('wycofana'), 'Rynek: historia transakcji');
}
// zaproszenia
const R1 = new Client(`Mentor_${suffix}`, fpOf('r1'));
r = await R1.post('/rejestracja', { username: R1.name, password: 'mentor123' }); R1.id = r.data.userId;
let rf = (await R1.get('/api/zaproszenia')).data;
check(rf.ok && /^[a-z2-9]{8}$/.test(rf.code) && rf.link.endsWith(`/?ref=${rf.code}`), 'Zaproszenia: link polecający', rf.link);
r = await new Client('anon').get(`/?ref=${rf.code}`, false);
check(r.data.includes(`Zaproszenie od ${R1.name}`) && r.data.includes(`name="ref" value="${rf.code}"`), 'Zaproszenia: strona startowa z zaproszeniem');
const R2 = new Client(`Uczen_${suffix}`, fpOf('r2')), R3 = new Client(`Klon2_${suffix}`, fpOf('r1'));
r = await R2.post('/rejestracja', { username: R2.name, password: 'uczen123', ref: rf.code }); R2.id = r.data.userId;
r = await R3.post('/rejestracja', { username: R3.name, password: 'klon1234', ref: rf.code }); R3.id = r.data.userId;
st = (await R2.get('/api/stan')).data;
check(st.user.referred_by === R1.id && st.user.ref_state === 0 && st.user.reg_ip === undefined, 'Zaproszenia: rejestracja z kodem (bez ujawniania IP)');
rf = (await R1.get('/api/zaproszenia')).data;
check(rf.invited.length === 2 && rf.invited.find((i) => i.id === R3.id)?.state === 2 && rf.invited.find((i) => i.id === R2.id)?.state === 0, 'Zaproszenia: konto z tego samego IP/urządzenia oznaczone (bez nagrody)');
r = await R1.get('/zaproszenia', false);
check(r.status === 200 && r.data.includes(R2.name) && r.data.includes('zablokowane'), 'Zaproszenia: strona z listą zaproszonych');
if (DEV) {
  const m0 = (await R1.get('/api/stan')).data.stock.metal;
  r = await R2.post('/api/dev/poziom', { level: 5 });
  check(r.data.ok && /Nagroda za dołączenie/.test(r.data.referral || ''), 'Zaproszenia: nagroda dla zaproszonego na poziomie 5', r.data.referral);
  const m1 = (await R1.get('/api/stan')).data;
  check(m1.stock.metal - m0 >= 1999 && m1.user.boost_until > Date.now(), 'Zaproszenia: nagroda dla zapraszającego (z Rdzeniem)');
  rf = (await R1.get('/api/zaproszenia')).data;
  check(rf.invited.find((i) => i.id === R2.id)?.state === 1, 'Zaproszenia: status „nagrodzone”');
  r = await R2.post('/api/dev/misja', { ev: 'noop' });
  check(!r.data.referral, 'Zaproszenia: nagroda tylko raz');
  r = await R3.post('/api/dev/poziom', { level: 5 });
  check(!r.data.referral, 'Zaproszenia: multikonto bez nagrody');
}

// ---------- etap 4: czat ----------
const D = new Client(`Vega_${suffix}`);
r = await D.post('/rejestracja', { username: D.name, password: 'haslo789' });
D.id = r.data.userId;
r = await D.post('/samouczek/pomin');
st = (await D.get('/api/stan')).data;
check(r.data.ok && st.tut === null && st.user.tut_step === 0, 'Samouczek: można pominąć', r.data.msg);
r = await D.post('/samouczek/pomin');
check(!r.data.ok, 'Samouczek: ponowne pominięcie odrzucone');
r = await A.postJson('/api/czat', { kanal: 'g', tekst: `Witajcie w sektorze! ${suffix}` });
check(r.status === 200 && r.data.ok && r.data.message.id > 0, 'Czat: wysłanie wiadomości globalnej', r.data.msg);
const firstId = r.data.message?.id || 0;
r = await A.postJson('/api/czat', { kanal: 'g', tekst: 'druga za szybko' });
check(r.status === 429, 'Czat: limit tempa (min. 2 s między wiadomościami)', r.data.msg);
r = await A.postJson('/api/czat', { kanal: 'g', tekst: 'x'.repeat(201) });
check(r.status === 400, 'Czat: limit długości 200 znaków', r.data.msg);
r = await A.postJson('/api/czat', { kanal: 'g', tekst: '   \u0007  ' });
check(r.status === 400, 'Czat: pusta wiadomość odrzucona');
// HTML i wulgaryzmy testujemy na kanale testowej korporacji (nie zaśmiecamy czatu globalnego na produkcji)
r = await B.postJson('/api/czat', { kanal: 'k', tekst: `<script>alert(1)</script><b>hej</b> ${suffix}` });
check(r.data.ok, 'Czat: wiadomość z HTML przyjęta jako tekst', r.data.msg);
const corpFirst = r.data.message?.id || 0;
await sleep(2100);
r = await B.postJson('/api/czat', { kanal: 'k', tekst: `ty kurwa ${suffix}` });
check(r.data.ok && !/kurwa/i.test(r.data.message.text) && r.data.message.text.startsWith('ty k*'), 'Czat: filtr wulgaryzmów', r.data.message?.text);
await sleep(2100);
r = await B.postJson('/api/czat', { kanal: 'k', tekst: `Tajna narada korpo ${suffix}` });
check(r.data.ok, 'Czat korporacji: wysłanie', r.data.msg);
r = await A.get(`/api/czat?kanal=k&po=${corpFirst - 1}`);
check(r.data.ok && r.data.messages.length === 3 && r.data.messages[0].text.includes('<script>') && r.data.messages.some((m) => m.text === `Tajna narada korpo ${suffix}`), 'Czat korporacji: pobieranie nowych wiadomości (po id), widoczne dla członków', `${r.data.messages?.length} wiad.`);
r = await A.get('/czat?kanal=k', false);
check(r.status === 200 && r.data.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !r.data.includes('<script>alert(1)'), 'Czat: HTML escapowany na stronie');
r = await D.get(`/api/czat?kanal=g&po=${firstId - 1}`);
check(r.data.ok && r.data.messages.some((m) => m.id === firstId), 'Czat globalny: widoczny dla wszystkich');
r = await D.get('/api/czat?kanal=k');
check(r.status === 403, 'Czat korporacji: brak dostępu dla obcych');
r = await D.postJson('/api/czat', { kanal: 'k', tekst: 'wpuśćcie mnie' });
check(r.status === 403, 'Czat korporacji: obcy nie może pisać');
r = await D.get('/api/czat?kanal=g');
check(!r.data.messages.some((m) => m.text.includes('Tajna narada')), 'Czat: kanały rozdzielone');

// ---------- etap 4: Web Push ----------
r = await A.get('/api/push/klucz');
const PUSH = r.status === 200 && r.data.ok;
check(PUSH && /^[A-Za-z0-9_-]{80,90}$/.test(r.data.key), 'Push: publiczny klucz VAPID', PUSH ? `${r.data.key.length} znaków` : `status ${r.status}`);
const fakeSub = { endpoint: `https://push.invalid/kolonie-test-${suffix}`, keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'QUFBQUFBQUFBQUFBQUFBQQ' } };
r = await A.postJson('/api/push/subskrypcja', { endpoint: 'http://zly.example/x', keys: fakeSub.keys });
check(r.status === 400 || !PUSH, 'Push: subskrypcja bez HTTPS odrzucona');
if (PUSH) {
  r = await A.postJson('/api/push/subskrypcja', fakeSub);
  check(r.data.ok && r.data.devices === 1, 'Push: zapis subskrypcji (opt-in)', r.data.msg);
  r = await A.postJson('/api/push/subskrypcja', fakeSub);
  check(r.data.ok && r.data.devices === 1, 'Push: ponowna subskrypcja bez duplikatu');
  r = await A.postJson('/api/push/test', {});
  check(r.data.ok && r.data.sent === 0, 'Push: wysyłka testowa (nieosiągalny adres nie psuje serwera)', r.data.msg);
  if (DEV) {
    await A.post('/api/dev/przewin', { minutes: 130 });
    r = await new Client('anon').postJson('/api/dev/push-skan', { id: A.id });
    check(r.data.ok && r.data.n.notified_storage === r.data.n.collected_at, 'Push: skaner wykrywa pełny magazyn', `sent=${r.data.sent}`);
    r = await new Client('anon').postJson('/api/dev/push-skan', { id: A.id });
    check(r.data.ok && r.data.sent === 0, 'Push: brak powtórnego powiadomienia');
  }
  r = await A.postJson('/api/push/wypisz', { endpoint: fakeSub.endpoint });
  check(r.data.ok, 'Push: wypisanie (opt-out)', r.data.msg);
}
r = await new Client('anon').postJson('/api/push/subskrypcja', fakeSub);
check(r.status === 401, 'Push: subskrypcja wymaga logowania');

for (const p of ['/czat', '/czat?kanal=k', '/korporacja/wojna', '/korporacja/boss', '/kolonia', '/statek', '/bitwa', '/misje', '/korporacja', '/ranking', '/ranking?tab=pvp', '/ranking?tab=korporacje']) {
  r = await A.get(p, false);
  check(r.status === 200 && r.data.includes('</html>'), `Strona ${p}`);
}
r = await new Client('anon').get('/', false);
check(r.status === 200 && r.data.includes('Zagraj za darmo') && r.data.includes('og:image'), 'Strona startowa');
r = await new Client('anon').get('/manifest.webmanifest', false);
check(r.status === 200, 'Manifest PWA');

// ---------- v5 etap 5: panel admina, bany, ogłoszenia, ochrona przed botami ----------
r = await M2.get('/admin', false);
check(r.status === 404, 'Admin: panel ukryty przed zwykłym graczem');
r = await M2.post(`/admin/ban/${M1.id}`, { days: 1 });
check(r.status === 404, 'Admin: akcje niedostępne dla zwykłego gracza');
if (TOKEN) {
  const ADM = new Client(`Admin_${suffix}`, { ...fpOf('adm'), 'x-admin-token': TOKEN });
  r = await ADM.post('/rejestracja', { username: ADM.name, password: 'admin1234' }); ADM.id = r.data.userId;
  r = await ADM.get('/admin', false);
  check(r.status === 200 && r.data.includes('Panel administratora') && r.data.includes('Zgłoszenia do przeglądu') && r.data.includes('graczy'), 'Admin: panel ze statystykami');
  r = await ADM.get('/admin/api/statystyki');
  check(r.data.ok && r.data.players >= 0 && r.data.perDay.length === 14, 'Admin: API statystyk', `graczy: ${r.data.players}, aktywnych 24 h: ${r.data.active24}`);
  r = await ADM.get('/admin/api/flagi');
  check(r.data.ok && r.data.flags.some((f) => f.userId === M3.id && f.kind === 'multi'), 'Admin: multikonto (to samo IP/urządzenie) zgłoszone do przeglądu', r.data.flags.find((f) => f.userId === M3.id)?.detail);
  const fid = r.data.flags.find((f) => f.userId === M3.id)?.id;
  r = await ADM.post(`/admin/flaga/${fid}/ok`);
  check(r.data.ok, 'Admin: zgłoszenie oznaczone jako sprawdzone');
  r = await ADM.get(`/admin/gracz/${M3.id}`, false);
  check(r.status === 200 && r.data.includes(M1.name) && r.data.includes('to samo'), 'Admin: karta gracza z powiązanymi kontami');
  r = await ADM.get(`/admin?q=${encodeURIComponent(M2.name.slice(0, 8))}`, false);
  check(r.data.includes(M2.name), 'Admin: wyszukiwanie gracza');
  // ban
  r = await ADM.post(`/admin/ban/${ADM.id}`, { days: 1 });
  check(!r.data.ok, 'Admin: nie można zbanować samego siebie');
  r = await ADM.post(`/admin/ban/${M2.id}`, { days: 1, reason: 'Test bana' });
  check(r.data.ok && r.data.until > Date.now(), 'Admin: ban gracza na 1 dzień', r.data.msg);
  r = await M2.get('/api/stan');
  check(r.status === 401, 'Ban: sesja zbanowanego unieważniona');
  r = await new Client('x', fpOf('m2')).post('/logowanie', { username: M2.name, password: 'rynek123' });
  check(!r.data.ok && r.data.banned && /zablokowane/.test(r.data.msg) && /Test bana/.test(r.data.msg), 'Ban: logowanie odrzucone z powodem', r.data.msg);
  r = await ADM.get('/api/ranking?tab=gracze');
  check(!r.data.rows.some((x) => x.id === M2.id), 'Ban: zbanowany znika z rankingu');
  r = await ADM.post(`/admin/odbanuj/${M2.id}`);
  check(r.data.ok, 'Admin: odbanowanie');
  r = await M2.post('/logowanie', { username: M2.name, password: 'rynek123' });
  check(r.data.ok, 'Ban: po odbanowaniu logowanie działa');
  // rola admina
  r = await ADM.post(`/admin/rola/${M1.id}`, { role: 'admin' });
  check(r.data.ok, 'Admin: nadanie roli administratora');
  r = await M1.get('/admin', false);
  check(r.status === 200, 'Admin: nowy administrator ma dostęp do panelu');
  r = await M1.get('/kolonia', false);
  check(r.data.includes('href="/admin"'), 'Admin: skrót do panelu w nagłówku');
  r = await ADM.post(`/admin/ban/${M1.id}`, { days: 1 });
  check(!r.data.ok, 'Admin: administratora nie można zbanować');
  await ADM.post(`/admin/rola/${M1.id}`, { role: '' });
  r = await M1.get('/admin', false);
  check(r.status === 404, 'Admin: odebranie roli');
  // ogłoszenia (widoczne tylko dla kont testowych)
  r = await ADM.post('/admin/ogloszenie', { text: `Ogłoszenie testowe ${suffix}`, kind: 'event', hours: 1 });
  check(r.data.ok && r.data.id > 0, 'Ogłoszenia: publikacja');
  const annId = r.data.id;
  r = await M2.get('/kolonia', false);
  check(r.data.includes(`Ogłoszenie testowe ${suffix}`) && r.data.includes('data-ann-x'), 'Ogłoszenia: pasek u graczy');
  r = await ADM.post(`/admin/ogloszenie/${annId}/wylacz`);
  r = await M2.get('/kolonia', false);
  check(r.data.ok !== false && !String(r.data).includes(`Ogłoszenie testowe ${suffix}`), 'Ogłoszenia: wyłączenie');
}
// pułapka na boty, limit rejestracji z IP, limit żądań
r = await new Client('bot', fpOf('bot')).post('/rejestracja', { username: `Bot_${suffix}`, password: 'botbot12', website: 'http://spam.example' });
check(TOKEN ? r.data.ok : !r.data.ok, TOKEN ? 'Pułapka: testy z tokenem omijają pułapkę (kontrola)' : 'Pułapka na boty');
if (TOKEN) {
  const enf = (k) => ({ ...fpOf(k), 'x-test-enforce': '1' });
  r = await new Client('bot2', enf('bot')).post('/rejestracja', { username: `Bot2_${suffix}`, password: 'botbot12', website: 'http://spam.example' });
  check(!r.data.ok && /Nie udało się/.test(r.data.msg), 'Pułapka na boty: ukryte pole odrzuca rejestrację', r.data.msg);
  r = await new Client('bot3', enf('bot')).post('/rejestracja', { username: `Bot3_${suffix}`, password: 'botbot12', ts: Date.now() - 200 });
  check(!r.data.ok, 'Pułapka na boty: zbyt szybkie wysłanie formularza odrzucone');
  const okRegs = [];
  for (let i = 1; i <= 4; i++) {
    r = await new Client('ip', enf('ip')).post('/rejestracja', { username: `IpT${i}_${suffix}`, password: 'iptest12' });
    okRegs.push(r.data.ok);
  }
  check(okRegs.join() === 'true,true,true,false', `Limit rejestracji: ${3} konta na IP na dobę`, okRegs.join());
  r = await new Client('adm', { ...fpOf('adm'), 'x-admin-token': TOKEN }).get('/admin/api/flagi');
  const statuses = [];
  const RL = new Client('rl', enf('rl'));
  for (let i = 0; i < 95; i++) statuses.push((await RL.post('/api/nieistnieje')).status);
  check(statuses.includes(429) && statuses.indexOf(429) >= 88, 'Limit żądań: 429 po przekroczeniu 90 POST/min z jednego IP', `pierwsze 429 przy #${statuses.indexOf(429) + 1}`);
}

// ---------- sprzątanie: usunięcie kont testowych z tej serii ----------
r = await new Client('anon').postJson('/api/admin/sprzataj', {});
check(r.status === 403, 'Sprzątanie bez tokenu odrzucone');
if (TOKEN) {
  const c = await cleanup();
  check(c?.ok && c.users >= 4, 'Sprzątanie kont testowych', `${c?.users} kont, ${c?.corps} korporacji`);
  r = await A.get('/api/stan');
  check(r.status === 401, 'Konto testowe usunięte (sesja nieważna)');
} else console.log('⚠️  Brak ADMIN_TOKEN – konta testowe zostają w bazie.');

console.log(failures ? `\n❌ Błędów: ${failures}` : '\n🎉 Wszystkie testy przeszły!');
process.exit(failures ? 1 : 0);
