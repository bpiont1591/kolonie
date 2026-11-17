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

// ---------- v6 etap 1: klasy statków i drzewko technologii ----------
{
  const N = new Client(`Nowy_${suffix}`);
  await N.post('/rejestracja', { username: N.name, password: 'nowy1234' });
  r = await N.post('/statek/klasa/krazownik');
  check(!r.data.ok && /samouczek/i.test(r.data.msg), 'Klasa: zablokowana w trakcie samouczka', r.data.msg);
  r = await E.get('/statek', false);
  check(r.data.includes('Wybierz klasę statku'), 'Klasa: zaproszenie do wyboru po samouczku');
  let k = (await E.get('/api/klasa')).data;
  const base = k.stats;
  check(k.ok && k.first && k.current === '' && k.classes.length === 4, 'Klasa: 4 klasy, pierwszy wybór darmowy');
  const cr0 = (await E.get('/api/stan')).data.stock.crystal;
  r = await E.post('/statek/klasa/krazownik');
  k = (await E.get('/api/klasa')).data;
  const cr1 = (await E.get('/api/stan')).data.stock.crystal;
  check(r.data.ok && k.current === 'krazownik' && cr1 >= cr0 && k.stats.maxHp > base.maxHp && k.stats.def > base.def && k.stats.atk < base.atk,
    'Klasa: Krążownik – więcej HP i obrony, mniej ataku, za darmo', `HP ${base.maxHp}→${k.stats.maxHp}, obrona ${base.def}→${k.stats.def}, atak ${base.atk}→${k.stats.atk}`);
  r = await E.post('/statek/klasa/szturmowiec');
  check(!r.data.ok && /zmiana klasy możliwa za/.test(r.data.msg), 'Klasa: zmiana blokowana przez 24 h', r.data.msg);
  r = await E.get('/statek/klasa', false);
  check(r.data.includes('cls_krazownik.webp') && r.data.includes('Twoja klasa'), 'Klasa: strona wyboru z portretami');
  st = (await E.get('/api/stan')).data;
  let bd = (await E.get('/api/badania')).data;
  check(bd.ok && bd.rpTotal >= st.user.level - 1 && bd.rpFree === bd.rpTotal, 'Badania: punkty z poziomu i laboratorium', `${bd.rpFree}/${bd.rpTotal} PB`);
  r = await E.post('/badania/start/b2');
  check(!r.data.ok, 'Badania: technologia II poziomu wymaga poprzedniej', r.data.msg);
  if (bd.rpFree >= 1) {
    r = await E.post('/badania/start/b1');
    check(r.data.ok && r.data.tech === 'b1' && r.data.seconds > 0, 'Badania: start (kolejka jak budowa)', r.data.msg);
    r = await E.post('/badania/start/p1');
    check(!r.data.ok, 'Badania: tylko jedno badanie naraz', r.data.msg);
    const atkBefore = (await E.get('/api/klasa')).data.stats.atk;
    r = await E.post('/badania/przyspiesz');
    bd = (await E.get('/api/badania')).data;
    const atkAfter = (await E.get('/api/klasa')).data.stats.atk;
    check(r.data.ok && bd.tech.includes('b1') && !bd.rq && atkAfter > atkBefore, 'Badania: przyspieszenie za kryształy, premia działa', `atak ${atkBefore}→${atkAfter}`);
    r = await E.post('/badania/reset');
    bd = (await E.get('/api/badania')).data;
    check(r.data.ok ? bd.tech.length === 0 && bd.rpFree === bd.rpTotal : /Reset kosztuje/.test(r.data.msg), 'Badania: reset za kryształy zwraca punkty', r.data.msg);
  }
  r = await E.get('/badania', false);
  check(r.data.includes('Drzewko technologii') && ['Uzbrojenie', 'Pancerz', 'Logistyka', 'Taktyka'].every((x) => r.data.includes(x)), 'Badania: 4 gałęzie drzewka');
  if (DEV) {
    await E.post('/api/dev/poziom', { level: 12 }); await E.post('/api/dev/surowce');
    bd = (await E.get('/api/badania')).data;
    check(bd.rpFree >= 11, 'Badania: więcej PB z poziomem', `${bd.rpFree} PB`);
    r = await E.post('/badania/start/l1');
    const sec = r.data.seconds;
    await E.post('/api/dev/przewin', { minutes: Math.ceil(sec / 60) + 1 });
    bd = (await E.get('/api/badania')).data;
    check(bd.tech.includes('l1') && !bd.rq && bd.mods.prod > 0, 'Badania: ukończenie w tle po czasie (leniwe rozliczenie)', `wydobycie +${Math.round(bd.mods.prod * 100)}%`);
    r = await E.post('/badania/start/l2'); await E.post('/api/dev/przewin', { minutes: 25 });
    bd = (await E.get('/api/badania')).data;
    check(bd.tech.includes('l2'), 'Badania: II poziom gałęzi po I');
    await E.post('/api/dev/przewin', { minutes: 24 * 60 + 1 });
    const crB = (await E.get('/api/stan')).data.stock.crystal;
    r = await E.post('/statek/klasa/zwiadowca');
    const crA = (await E.get('/api/stan')).data.stock.crystal;
    check(r.data.ok && crB - crA === 300 + 60 * 12, 'Klasa: zmiana po 24 h za kryształy (300 + 60×poziom)', r.data.msg);
    const rpBefore = (await E.get('/api/badania')).data.rpFree;
    r = await E.post('/badania/reset');
    bd = (await E.get('/api/badania')).data;
    check(r.data.ok && r.data.refunded >= 2 && bd.rpFree === rpBefore + r.data.refunded && bd.mods.prod === 0, 'Badania: reset zwraca PB i zdejmuje premie', r.data.msg);
  }
}

// ---------- v7 etap 1: drzewko 10 poziomów ----------
{
  let bd = (await E.get('/api/badania')).data;
  r = await E.get('/badania', false);
  check((r.data.match(/class="tnode/g) || []).length === 40 && r.data.includes('Kamienie milowe') && r.data.includes('Działa sprzężone'), 'Drzewko v7: 4 gałęzie × 10 poziomów z kamieniami milowymi');
  if (DEV) {
    await E.post('/api/dev/poziom', { level: 30 }); await E.post('/api/dev/surowce'); await E.post('/api/dev/surowce');
    await E.post('/api/dev/budynek', { b: 'lab', level: 4 });
    await E.post('/badania/reset');
    for (const id of ['b1', 'b2', 'b3', 'b4']) { await E.post(`/badania/start/${id}`); await E.post('/badania/przyspiesz'); }
    r = await E.post('/badania/start/b5');
    check(!r.data.ok && /laboratorium na poziomie 5/.test(r.data.msg), 'Drzewko v7: wyższe poziomy wymagają laboratorium', r.data.msg);
    await E.post('/api/dev/budynek', { b: 'lab', level: 6 });
    r = await E.post('/badania/start/b5');
    const sec = r.data.seconds;
    check(r.data.ok && sec === 240 * 60, 'Drzewko v7: kamień milowy V – 4 h badań', r.data.msg);
    await E.post('/api/dev/przewin', { minutes: 241 });
    bd = (await E.get('/api/badania')).data;
    check(bd.tech.includes('b5') && bd.mods.double === 0.12, 'Drzewko v7: „Działa sprzężone” aktywne (szansa na drugą salwę)');
    r = await E.post('/badania/start/b6');
    check(!r.data.ok && /poziomu gracza|laboratorium/.test(r.data.msg) || r.data.ok, 'Drzewko v7: kolejne wymagania', r.data.msg);
    await E.post('/badania/reset');
  }
}

// ---------- v7 etap 2: moduły specjalne ----------
{
  r = await E.get('/statek/moduly', false);
  check(r.status === 200 && r.data.includes('Moduły specjalne') && r.data.includes('Skąd brać moduły'), 'Moduły specjalne: strona ładowni i slotów');
  let gm = (await E.get('/api/moduly')).data;
  check(gm.ok && Array.isArray(gm.items) && gm.slotLevels.join() === '10,25,40', 'Moduły specjalne: API (sloty od poz. 10/25/40)');
  if (DEV) {
    await E.post('/api/dev/poziom', { level: 30 }); await E.post('/api/dev/surowce'); await E.post('/api/dev/surowce');
    const a = (await E.post('/api/dev/modul', { def: 'plazma', rarity: 3 })).data.id;
    const b = (await E.post('/api/dev/modul', { def: 'kadlub', rarity: 2 })).data.id;
    const c = (await E.post('/api/dev/modul', { def: 'plazma', rarity: 1 })).data.id;
    const d = (await E.post('/api/dev/modul', { def: 'syfon', rarity: 2 })).data.id;
    gm = (await E.get('/api/moduly')).data;
    check(gm.slots === 2 && gm.items.length >= 4, 'Moduły specjalne: 2 sloty na poziomie 30');
    const atk0 = (await E.get('/api/badania')).data.mods.atk;
    r = await E.post(`/moduly/zaloz/${a}`);
    const atk1 = (await E.get('/api/badania')).data.mods.atk;
    check(r.data.ok && Math.abs(atk1 - atk0 - 0.1) < 1e-6, 'Moduły specjalne: legendarny Rdzeń plazmowy daje +10% ataku', `${atk0} → ${atk1}`);
    r = await E.post(`/moduly/zaloz/${c}`);
    check(!r.data.ok && /nie sumują/.test(r.data.msg), 'Moduły specjalne: dwa takie same moduły się nie sumują', r.data.msg);
    r = await E.post(`/moduly/zaloz/${b}`);
    check(r.data.ok && r.data.slot === 2, 'Moduły specjalne: drugi slot');
    r = await E.post(`/moduly/zaloz/${d}`);
    check(!r.data.ok && /zajęte/.test(r.data.msg), 'Moduły specjalne: pełne sloty wymagają wyboru slotu');
    r = await E.post(`/moduly/zaloz/${d}`, { slot: 3 });
    check(!r.data.ok && /zablokowany/.test(r.data.msg), 'Moduły specjalne: slot 3 zablokowany do poz. 40', r.data.msg);
    r = await E.post(`/moduly/zaloz/${d}`, { slot: 2 });
    gm = (await E.get('/api/moduly')).data;
    check(r.data.ok && gm.items.find((i) => i.id === d).slot === 2 && gm.items.find((i) => i.id === b).slot === 0 && /syfon:2:1/.test(gm.gear), 'Moduły specjalne: podmiana w slocie (unikat Syfon próżni)');
    const st0 = (await E.get('/api/stan')).data;
    r = await E.post(`/moduly/ulepsz/${a}`);
    const st1 = (await E.get('/api/stan')).data;
    gm = (await E.get('/api/moduly')).data;
    check(r.data.ok && r.data.level === 2 && /plazma:3:2/.test(gm.gear) && st0.stock.metal - st1.stock.metal >= r.data.cost.metal - 500, 'Moduły specjalne: ulepszenie za surowce', r.data.msg);
    r = await E.post(`/moduly/rozbierz/${a}`);
    check(!r.data.ok && /zdejmij/.test(r.data.msg), 'Moduły specjalne: nie można rozebrać zamontowanego');
    await E.post(`/moduly/zdejmij/${a}`);
    const n0 = gm.items.length;
    r = await E.post(`/moduly/rozbierz/${a}`);
    gm = (await E.get('/api/moduly')).data;
    check(r.data.ok && r.data.salvage.metal > 4000 && gm.items.length === n0 - 1 && !/plazma/.test(gm.gear), 'Moduły specjalne: rozbiór na surowce (z odzyskiem ulepszeń)', r.data.msg);
    r = await E.post('/api/dev/los', { src: 'boss' });
    check(r.data.ok && r.data.item?.def, 'Moduły specjalne: łup z bossa (gwarantowany przy pierwszym zwycięstwie)', r.data.msg);
    r = await E.post('/moduly/zaloz/999999');
    check(!r.data.ok, 'Moduły specjalne: cudzy/nieistniejący moduł odrzucony');
    for (const it of (await E.get('/api/moduly')).data.items) { if (it.slot) await E.post(`/moduly/zdejmij/${it.id}`); await E.post(`/moduly/rozbierz/${it.id}`); }
  }
}

// ---------- v7 etap 3: kampania 6–10 i tryb trudny ----------
{
  const K = new Client(`Kampan_${suffix}`);
  await K.post('/rejestracja', { username: K.name, password: 'tajnehaslo1' });
  await K.post('/samouczek/pomin');
  let kp = (await K.get('/api/kampania')).data;
  check(kp.ok && kp.chapters.length === 10 && kp.chapters.map((c) => c.minLvl).join() === '1,4,8,12,16,20,26,32,40,48', 'Kampania v7: 10 rozdziałów (minLvl 20/26/32/40/48 dla nowych)');
  check(kp.chapters.every((c) => c.hard && !c.hard.unlocked && c.hard.missions.length === 5 && c.hard.missions[0].id === `h${c.n}-1`), 'Kampania v7: tryb trudny zablokowany na start, osobne misje');
  r = await K.post('/kampania/walcz/h1-1');
  check(!r.data.ok && /15★/.test(r.data.msg), 'Kampania v7: tryb trudny wymaga 15★ w rozdziale', r.data.msg);
  r = await K.post('/kampania/walcz/6-1');
  check(!r.data.ok && /bossa rozdziału 5/.test(r.data.msg), 'Kampania v7: rozdział 6 po bossie rozdziału 5', r.data.msg);
  r = await K.get('/kampania/10', false);
  check(r.status === 200 && r.data.includes('Tron Pustki') && r.data.includes('pl_10.webp') && r.data.includes('cb_10.webp'), 'Kampania v7: rozdział 10 – planeta i boss z grafiką');
  r = await K.get('/kampania/1?tryb=trudny', false);
  check(r.status === 200 && r.data.includes('hardmode') && /Trudny – po 15★/.test(r.data), 'Kampania v7: zakładka trybu trudnego (zablokowana)');
  if (DEV) {
    await K.post('/api/dev/poziom', { level: 60 }); for (let i = 0; i < 3; i++) await K.post('/api/dev/surowce');
    await K.post('/api/dev/kampania', { c: 1, stars: 3 });
    kp = (await K.get('/api/kampania')).data;
    check(kp.chapters[0].stars === 15 && kp.chapters[0].hard.unlocked && kp.chapters[0].hard.missions[0].open && !kp.chapters[0].hard.missions[1].open, 'Kampania v7: 15★ odblokowuje tryb trudny rozdziału');
    check(kp.chapters[0].hard.missions[0].enemyPower > kp.chapters[0].missions[0].enemyPower * 1.6, 'Kampania v7: trudni wrogowie silniejsi (×1,6, +3 poz.)');
    await K.post('/api/dev/przewin', { minutes: 120 });
    const e0 = (await K.get('/api/stan')).data.stock.energy;
    r = await K.post('/kampania/walcz/h1-1');
    const e1 = (await K.get('/api/stan')).data.stock.energy;
    kp = (await K.get('/api/kampania')).data;
    check(r.data.ok && r.data.won && kp.chapters[0].hard.missions[0].stars === r.data.stars && kp.chapters[0].missions[0].stars === 3 && e0 - e1 >= 12, 'Kampania v7: walka w trybie trudnym – osobne gwiazdki, ×1,5 energii', r.data.msg);
    r = await K.get(`/bitwa/${r.data.battleId}`, false);
    check(r.status === 200 && r.data.includes('/kampania/1?tryb=trudny'), 'Kampania v7: raport bitwy prowadzi do mapy trybu trudnego');
    r = await K.post('/kampania/skrzynia/1?tryb=trudny');
    check(!r.data.ok && /15★/.test(r.data.msg), 'Kampania v7: skrzynia trybu trudnego wymaga 15★ trudnych', r.data.msg);
    await K.post('/api/dev/kampania', { c: 1, m: 4, stars: 1, hard: 1 });
    await K.post('/api/dev/przewin', { minutes: 120 });
    r = await K.post('/kampania/walcz/h1-5');
    check(r.data.ok && r.data.won && r.data.item && r.data.item.rarity >= 1 && /Moduł specjalny/.test(r.data.msg), 'Kampania v7: boss trybu trudnego – gwarantowany moduł przy pierwszym zwycięstwie', r.data.msg);
    await K.post('/api/dev/kampania', { c: 1, stars: 3, hard: 1 });
    r = await K.post('/kampania/skrzynia/1?tryb=trudny');
    const kc = (await K.get('/api/kampania')).data.chapters[0];
    check(r.data.ok && r.data.item && kc.hard.chest && !kc.chest, 'Kampania v7: skrzynia trybu trudnego (2 rdzenie + moduł), normalna osobno', r.data.msg);
    for (let c = 1; c <= 5; c++) await K.post('/api/dev/kampania', { c, stars: 1 });
    kp = (await K.get('/api/kampania')).data;
    check(kp.chapters[5].unlocked && !kp.chapters[6].unlocked && kp.chapters[5].missions[0].open, 'Kampania v7: rozdział 6 odblokowany po bossie 5 (poz. 20+)');
    r = await K.get('/kampania/6', false);
    check(r.data.includes('Złote Grobowce') && r.data.includes('Archont Aurelii') && r.data.includes('Korona Archonta'), 'Kampania v7: fabuła i trofeum rozdziału 6');
  }
}

// ---------- v6 etap 2: kampania fabularna ----------
{
  let ca = (await E.get('/api/kampania')).data;
  check(ca.ok && ca.chapters.length === 10 && ca.chapters.every((c) => c.missions.length === 5 && c.missions[4].boss), 'Kampania: 10 rozdziałów × 5 misji (boss na końcu)');
  check(ca.chapters[0].unlocked && !ca.chapters[1].unlocked && ca.chapters[0].missions[0].open && !ca.chapters[0].missions[1].open, 'Kampania: odblokowany tylko rozdział 1, misja 1');
  r = await E.post('/kampania/walcz/1-2');
  check(!r.data.ok && /poprzedni/.test(r.data.msg), 'Kampania: misja 2 wymaga ukończenia misji 1', r.data.msg);
  r = await E.post('/kampania/walcz/2-1');
  check(!r.data.ok, 'Kampania: rozdział 2 zablokowany', r.data.msg);
  r = await E.get('/kampania/1', false);
  check(r.data.includes('Rdzawe Rubieże') && r.data.includes('Złomiarz Grax') && r.data.includes('cb_1.webp') && r.data.includes('Skrzynia rozdziału'), 'Kampania: mapa rozdziału z fabułą, bossem i skrzynią');
  if (DEV) await E.post('/api/dev/przewin', { minutes: 90 }); else await sleep(4200);
  const en0 = (await E.get('/api/stan')).data.stock.energy;
  r = await E.post('/kampania/walcz/1-1');
  const en1 = (await E.get('/api/stan')).data.stock.energy;
  check(r.data.ok && r.data.battleId && (r.data.won ? r.data.stars >= 1 : true), 'Kampania: walka w misji 1-1', r.data.msg);
  check(en0 - en1 === 8, 'Kampania: misja zużywa energię', `⚡${en0}→${en1}`);
  if (r.data.won) {
    check(r.data.first && r.data.reward.crystal > 0 && r.data.reward.xp > 0, 'Kampania: podwójna nagroda za pierwsze przejście');
    const bl = (await E.get(`/bitwa/${r.data.battleId}`, false)).data;
    check(bl.includes('/kampania/walcz/1-1') && bl.includes('Mapa rozdziału'), 'Kampania: raport z gwiazdkami i powtórką');
    ca = (await E.get('/api/kampania')).data;
    check(ca.chapters[0].missions[0].stars === r.data.stars && ca.chapters[0].missions[1].open, 'Kampania: gwiazdki zapisane, misja 2 odblokowana', `${r.data.stars}★`);
  }
  r = await E.post('/kampania/skrzynia/1');
  check(!r.data.ok && /15★/.test(r.data.msg), 'Kampania: skrzynia wymaga 15★', r.data.msg);
  if (DEV) {
    await E.post('/api/dev/poziom', { level: 22 }); await E.post('/api/dev/surowce');
    for (const mod of ['hull', 'guns', 'shields']) for (let i = 0; i < 3; i++) { await E.post(`/statek/ulepsz/${mod}`); await E.post('/statek/przyspiesz'); }
    let tries = 0;
    for (let m = 1; m <= 5; m++) {
      for (let k = 0; k < 6; k++) {
        await E.post('/api/dev/przewin', { minutes: 120 });
        const f = await E.post(`/kampania/walcz/1-${m}`); tries++;
        if (m === 5 && f.data.won && f.data.relic) check(f.data.relic === 'grax' && f.data.reward.core === 1, 'Kampania: boss upuszcza unikalny łup i Rdzeń', f.data.msg);
        if (f.data.stars === 3) break;
      }
    }
    ca = (await E.get('/api/kampania')).data;
    check(ca.chapters[0].done && ca.relics.includes('grax'), 'Kampania: boss pokonany, trofeum w kolekcji', `${ca.chapters[0].stars}★ w ${tries} walkach`);
    check(ca.chapters[1].unlocked && ca.chapters[1].missions[0].open, 'Kampania: rozdział 2 odblokowany po bossie');
    await E.post('/api/dev/przewin', { minutes: 120 });
    const again = await E.post('/kampania/walcz/1-5');
    check(again.data.won ? !again.data.relic && !again.data.reward.core : true, 'Kampania: trofeum tylko raz');
    if (ca.chapters[0].stars === 15) {
      r = await E.post('/kampania/skrzynia/1');
      check(r.data.ok && r.data.reward.core === 1, 'Kampania: skrzynia za 15★', r.data.msg);
      r = await E.post('/kampania/skrzynia/1');
      check(!r.data.ok, 'Kampania: skrzynia tylko raz');
    }
  }
}

// ---------- v6 etap 3: wydarzenia czasowe ----------
{
  const cool = async () => { if (DEV) await E.post('/api/dev/przewin', { minutes: 120 }); else await sleep(4300); };
  let ev = (await E.get('/api/wydarzenia')).data;
  check(ev.ok && ev.upcoming.length >= 3 && ev.upcoming.every((o) => o.starts > Date.now() && o.ends > o.starts), 'Wydarzenia: harmonogram najbliższych wydarzeń', ev.upcoming.map((o) => o.kind).join(', '));
  if (DEV) {
    const sat = ev.next?.inwazja?.starts;
    r = await E.post('/api/dev/harmonogram', { at: sat + 3600_000 });
    const c = r.data.created || [];
    check(r.data.ok && c.length === 1 && c[0].kind === 'inwazja' && c[0].source === 'auto' && c[0].goal >= 150 && r.data.settled, 'Wydarzenia: leniwy start i koniec z harmonogramu (bez crona, bez duplikatów)', c.map((x) => x.ekey).join() || JSON.stringify(r.data).slice(0, 200));
  }
  const already = ev.active.map((e) => e.kind);
  if (!already.includes('inwazja')) {
    r = await E.post('/wydarzenia/walcz');
    check(!r.data.ok && /inwazji/.test(r.data.msg), 'Wydarzenia: najeźdźcy tylko podczas inwazji', r.data.msg);
  }
  if (TOKEN) {
    const ADM = new Client(`Adm_${suffix}`, { ...fpOf('adm6'), 'x-admin-token': TOKEN });
    await ADM.post('/rejestracja', { username: ADM.name, password: 'admin1234' });
    r = await new Client('anon').post('/admin/wydarzenie', { kind: 'inwazja' });
    check(r.status === 401 || r.status === 403 || !r.data.ok, 'Wydarzenia: uruchamianie tylko dla admina');
    r = await ADM.post('/admin/wydarzenie', { kind: 'inwazja', hours: 1, goal: 10 });
    const invId = r.data.id;
    check(r.data.ok && invId, 'Wydarzenia: admin uruchamia inwazję ręcznie', r.data.msg);
    ev = (await E.get('/api/wydarzenia')).data;
    const inv = ev.active.find((e) => e.id === invId);
    check(inv && inv.goal === 10 && inv.source === 'admin', 'Wydarzenia: inwazja widoczna dla graczy (testowych)');
    r = await E.get('/kolonia', false);
    check(r.data.includes('class="evbar"') && r.data.includes('Inwazja obcych'), 'Wydarzenia: pasek ogłoszenia u góry strony');
    r = await E.get('/wydarzenia', false);
    check(r.data.includes('ev_inwazja.webp') && r.data.includes('Walcz z najeźdźcą') && r.data.includes('pkt serwera'), 'Wydarzenia: strona z globalnym paskiem postępu');
    let pts = 0;
    if (DEV) await E.post('/api/dev/poziom', { level: 8 });
    for (let i = 0; i < 4 && pts < 6; i++) { await cool(); r = await E.post('/wydarzenia/walcz'); if (r.data.won) pts += r.data.points; }
    check(pts >= 3 && r.data.battleId, 'Wydarzenia: walka z najeźdźcą daje punkty serwera', `+${pts} pkt`);
    if (r.data.battleId) { const bl = (await E.get(`/bitwa/${r.data.battleId}`, false)).data; check(bl.includes('p_xeno.webp') && bl.includes('/wydarzenia/walcz'), 'Wydarzenia: raport z najeźdźcą'); }
    await cool();
    const before = await E.post('/kampania/walcz/1-1');
    r = await ADM.post('/admin/wydarzenie', { kind: 'lupy', hours: 1 });
    check(r.data.ok, 'Wydarzenia: admin uruchamia podwójne łupy', r.data.msg);
    const lootId = r.data.id;
    await cool();
    const during = await E.post('/kampania/walcz/1-1');
    if (before.data.won && during.data.won) check(during.data.reward.metal / before.data.reward.metal > 1.5, 'Wydarzenia: podwójne łupy działają', `🔩${before.data.reward.metal} → 🔩${during.data.reward.metal}`);
    ev = (await E.get('/api/wydarzenia')).data;
    const invNow = ev.active.find((e) => e.id === invId);
    check(invNow.progress >= pts + (before.data.won ? 2 : 0) + (during.data.won ? 2 : 0) && ev.myPoints === invNow.progress, 'Wydarzenia: misje kampanii też liczą się do inwazji', `${invNow.progress}/${invNow.goal}`);
    r = await ADM.post('/admin/wydarzenie', { kind: 'happy', hours: 1 });
    const happyId = r.data.id;
    const HH = new Client(`Happy_${suffix}`, fpOf('hh6'));
    await HH.post('/rejestracja', { username: HH.name, password: 'happy1234' });
    await HH.post('/samouczek/pomin');
    r = await HH.post('/ekspedycje/wyslij/zwiad');
    check(r.data.ok && r.data.bonus === 100 && /Happy hour/.test(r.data.msg), 'Wydarzenia: happy hour – ekspedycja z podwójnymi łupami', r.data.msg);
    await HH.post('/ekspedycje/zawroc');
    r = await ADM.get('/admin', false);
    check(r.data.includes('id="wyd"') && r.data.includes('Uruchom teraz') && r.data.includes('Zakończ'), 'Wydarzenia: sekcja w panelu admina');
    for (const id of [invId, lootId, happyId]) r = await ADM.post(`/admin/wydarzenie/${id}/zakoncz`);
    check(r.data.ok, 'Wydarzenia: admin kończy wydarzenie');
    ev = (await E.get('/api/wydarzenia')).data;
    const cl = ev.claims.find((c) => c.id === invId);
    check(!ev.active.some((e) => [invId, lootId, happyId].includes(e.id)) && cl && cl.success === (invNow.progress >= 10), 'Wydarzenia: koniec rozliczony leniwie (sukces/porażka)', `sukces=${cl?.success}, ${cl?.points} pkt`);
    r = await E.post(`/wydarzenia/odbierz/${invId}`);
    check(cl?.points >= 5 ? r.data.ok && r.data.reward.crystal > 0 : !r.data.ok, 'Wydarzenia: nagroda za udział w inwazji', r.data.msg);
    r = await E.post(`/wydarzenia/odbierz/${invId}`);
    check(!r.data.ok, 'Wydarzenia: nagroda tylko raz', r.data.msg);
  }
}

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
