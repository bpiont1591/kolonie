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
  constructor(name) { this.name = name; this.cookie = ''; }
  async req(method, path, body, json = true) {
    const headers = { cookie: this.cookie, ...T_HDR };
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
    const res = await fetch(BASE + path, { method: 'POST', headers: { cookie: this.cookie, accept: 'application/json', 'content-type': 'application/json', ...T_HDR }, body: JSON.stringify(body) });
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

// ---------- etap 4: czat ----------
const D = new Client(`Vega_${suffix}`);
r = await D.post('/rejestracja', { username: D.name, password: 'haslo789' });
D.id = r.data.userId;
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

// ---------- sprzątanie: usunięcie kont testowych z tej serii ----------
r = await new Client('anon').postJson('/api/admin/sprzataj', {});
check(r.status === 403, 'Sprzątanie bez tokenu odrzucone');
if (TOKEN) {
  const c = await cleanup();
  check(c?.ok && c.users >= 3, 'Sprzątanie kont testowych', `${c?.users} kont, ${c?.corps} korporacji`);
  r = await A.get('/api/stan');
  check(r.status === 401, 'Konto testowe usunięte (sesja nieważna)');
} else console.log('⚠️  Brak ADMIN_TOKEN – konta testowe zostają w bazie.');

console.log(failures ? `\n❌ Błędów: ${failures}` : '\n🎉 Wszystkie testy przeszły!');
process.exit(failures ? 1 : 0);
