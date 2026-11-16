// Test dymny przez HTTP: rejestracja 2 graczy, zbieranie, ulepszenia, bitwy, korporacja, ranking.
// Użycie: BASE=http://localhost:3100 npm test   (serwer musi działać)
const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 3100}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, label, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

class Client {
  constructor(name) { this.name = name; this.cookie = ''; }
  async req(method, path, body, json = true) {
    const headers = { cookie: this.cookie };
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
}

const suffix = Date.now().toString(36).slice(-5);
const A = new Client(`Nova_${suffix}`), B = new Client(`Orion_${suffix}`);

let r = await A.post('/rejestracja', { username: A.name, password: 'tajne123' });
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

for (const p of ['/kolonia', '/statek', '/bitwa', '/misje', '/korporacja', '/ranking', '/ranking?tab=pvp', '/ranking?tab=korporacje']) {
  r = await A.get(p, false);
  check(r.status === 200 && r.data.includes('</html>'), `Strona ${p}`);
}
r = await new Client('anon').get('/', false);
check(r.status === 200 && r.data.includes('Zagraj za darmo') && r.data.includes('og:image'), 'Strona startowa');
r = await new Client('anon').get('/manifest.webmanifest', false);
check(r.status === 200, 'Manifest PWA');

console.log(failures ? `\n❌ Błędów: ${failures}` : '\n🎉 Wszystkie testy przeszły!');
process.exit(failures ? 1 : 0);
