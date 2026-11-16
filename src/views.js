import * as R from './rules.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.floor(n).toLocaleString('pl-PL');
const ago = (ts, now) => {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s} s temu`;
  if (s < 3600) return `${Math.floor(s / 60)} min temu`;
  if (s < 86400) return `${Math.floor(s / 3600)} h temu`;
  return `${Math.floor(s / 86400)} d temu`;
};
const costHtml = (c) => R.RES_KEYS.filter((k) => c[k] > 0).map((k) => `<span class="cost">${resIcon(k, 14)} ${fmt(c[k])}</span>`).join(' ');
const canPay = (have, c) => R.RES_KEYS.every((k) => have[k] >= c[k]);

/** Stan gracza wyliczony na chwilę `now` (serwer jest jedynym źródłem prawdy). */
export function state(u, now) {
  const ship = R.shipStats(u);
  return {
    stock: { metal: u.metal, crystal: u.crystal, energy: u.energy },
    pending: R.pending(u, now),
    rates: R.production(u),
    cap: R.storageCap(u),
    ship: { ...ship, hp: R.currentHp(u, now), repair: R.repairPerMin(u), power: R.power(u) },
    xpNeed: R.xpForNext(u.level),
  };
}

function hpBar(st) {
  const pct = Math.round((st.ship.hp / st.ship.maxHp) * 100);
  return `<div class="bar hp" data-live-hp data-hp="${st.ship.hp}" data-max="${st.ship.maxHp}" data-rate="${(st.ship.repair / 60).toFixed(4)}">
    <i style="width:${pct}%"></i><span>🛡️ <b data-hp-text>${st.ship.hp}</b>/${st.ship.maxHp} HP</span></div>`;
}

const V = 4; // wersja zasobów statycznych (cache-busting)
export const img = (name, alt = '', cls = '', size = 64, eager = false) =>
  `<img src="/img/${name}.webp?v=${V}" alt="${esc(alt)}" class="${cls}" width="${size}" height="${size}" decoding="async"${eager ? '' : ' loading="lazy"'}>`;
export const resIcon = (k, size = 18) => `<img src="/img/r_${k}.webp?v=${V}" alt="${R.RESOURCES[k].name}" title="${R.RESOURCES[k].name}" class="ri" width="${size}" height="${size}">`;
const SITE_DESC = 'Kolonie – darmowa kosmiczna gra MMORPG w przeglądarce. Zbuduj kolonię na obcej planecie, ulepszaj statek, walcz z piratami i graczami, dołącz do korporacji. Bez instalacji, na telefonie i komputerze.';

export function layout({ title, user, st, body, flash, active = '', head = '', bodyClass = '', baseUrl = '' }) {
  const top = user ? `
  <header class="top">
    <a class="brand" href="/kolonia"><img src="/img/logo.webp?v=${V}" alt="Kolonie" width="96" height="26"></a>
    <div class="res">
      ${R.RES_KEYS.map((k) => `<span>${resIcon(k)}<b>${fmt(st.stock[k])}</b></span>`).join('')}
    </div>
    <div class="who"><span class="lvl">Lv ${user.level}</span> ${esc(user.username)}</div>
  </header>` : '';
  const tabs = [
    ['kolonia', '/kolonia', '🏙️', 'Kolonia'], ['statek', '/statek', '🚀', 'Statek'], ['bitwa', '/bitwa', '⚔️', 'Bitwa'],
    ['korporacja', '/korporacja', '🛰️', 'Korpo'], ['ranking', '/ranking', '🏆', 'Ranking'],
  ];
  const nav = user ? `<nav class="tabs">${tabs.map(([id, href, ic, label]) =>
    `<a href="${href}" class="${active === id ? 'on' : ''}"><span>${ic}</span>${label}</a>`).join('')}</nav>` : '';
  const fl = flash ? `<div class="flash ${flash.ok ? 'ok' : 'err'}" role="status">${esc(flash.msg)}</div>` : '';
  const fullTitle = title.includes('Kolonie') ? title : `${title} · Kolonie`;
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#050918"><meta name="description" content="${esc(SITE_DESC)}">
<meta name="color-scheme" content="dark">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon-32.png?v=${V}" type="image/png" sizes="32x32"><link rel="icon" href="/icon-192.png?v=${V}" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/icon-180.png?v=${V}"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Kolonie">
<link rel="preload" href="/fonts/rajdhani-bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css?v=${V}">
${head}
<title>${esc(fullTitle)}</title></head>
<body class="${user ? 'in' : 'out'} ${bodyClass}"><div class="stars"></div>${top}<main>${fl}${body}</main>${nav}
<script src="/app.js?v=${V}" defer></script></body></html>`;
}

const FEATURES = [
  ['b_mine', 'Buduj kolonię', 'Kopalnie, reaktory i laboratoria pracują dla Ciebie nawet wtedy, gdy nie grasz. Wracaj po surowce i rozbudowuj bazę.'],
  ['ship', 'Ulepszaj statek', 'Wzmacniaj kadłub, działa plazmowe i tarcze deflektorowe. Każdy poziom to realna przewaga w walce.'],
  ['p_krazownik', 'Walcz z piratami i graczami', 'Szybkie bitwy na kilka sekund: poluj na piratów rubieży albo rzuć wyzwanie innym komandorom i zabierz im łupy.'],
  ['b_shipyard', 'Dołącz do korporacji', 'Załóż korporację z przyjaciółmi, zdobywajcie bonusy XP i walczcie razem o szczyt rankingu.'],
];
const FAQ = [
  ['Czy gra jest darmowa?', 'Tak. Kolonie są w pełni darmowe i działają w przeglądarce – nie trzeba nic pobierać ani podawać karty.'],
  ['Na czym mogę grać?', 'Na każdym telefonie, tablecie i komputerze z nowoczesną przeglądarką. Grę możesz też zainstalować jak aplikację na ekranie głównym.'],
  ['Ile czasu trzeba poświęcić?', 'Wystarczy kilka minut dziennie. Kolonia produkuje surowce sama, a magazyn mieści 2 godziny wydobycia – wpadaj, zbieraj i rozbudowuj.'],
  ['Czy ktoś może mnie okraść?', 'Inni gracze mogą zaatakować Twoją kolonię i zabrać 10% metalu i kryształów, ale po ataku dostajesz 15 minut ochrony. Silniejsi gracze nie mogą atakować dużo słabszych.'],
  ['Co daje korporacja?', 'Członkowie korporacji dostają +5% XP z bitew i wspólnie rywalizują w rankingu korporacji.'],
];

export function landing({ online, players, battles24, top, flash, baseUrl }) {
  const url = baseUrl || '';
  const title = 'Kolonie – darmowa kosmiczna gra MMORPG w przeglądarce';
  const head = `<link rel="canonical" href="${esc(url)}/">
<meta property="og:type" content="website"><meta property="og:site_name" content="Kolonie">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(SITE_DESC)}">
<meta property="og:url" content="${esc(url)}/"><meta property="og:locale" content="pl_PL">
<meta property="og:image" content="${esc(url)}/img/og.jpg?v=${V}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Kolonie – zbuduj kolonię i podbij galaktykę">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(SITE_DESC)}"><meta name="twitter:image" content="${esc(url)}/img/og.jpg?v=${V}">
<link rel="preload" href="/img/hero.webp?v=${V}" as="image" fetchpriority="high">`;
  const stat = (n, label) => `<div class="stat"><b>${fmt(n)}</b><span>${label}</span></div>`;
  const pirates = R.PIRATES.map((p) => `<figure class="pirate-card">${img('p_' + p.id, p.name, '', 160)}
    <figcaption><b>${p.name}</b><small>${p.minLvl > 1 ? `od poziomu ${p.minLvl}` : 'dla każdego'}</small></figcaption></figure>`).join('');
  const rank = top.length ? top.map((r, i) => `<li><span class="pos">${i + 1}</span><b>${esc(r.username)}</b>${r.tag ? ` <span class="corp">[${esc(r.tag)}]</span>` : ''}<span class="grow"></span><span class="lvl">Lv ${r.level}</span></li>`).join('')
    : '<li class="muted">Ranking czeka na pierwszego komandora – może to będziesz Ty?</li>';
  return layout({ title, flash, head, bodyClass: 'landing', baseUrl, body: `
  <section class="hero-full">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="hero-inner">
      <img class="hero-logo" src="/img/logo.webp?v=${V}" alt="Kolonie" width="640" height="177" fetchpriority="high">
      <h1>Zbuduj kolonię.<br><span>Podbij galaktykę.</span></h1>
      <p class="lead">Darmowa kosmiczna gra MMORPG w przeglądarce. Rozbuduj bazę na obcej planecie, uzbrój statek i walcz o sławę w sektorze.</p>
      <a class="btn cta" href="#start">🚀 Zagraj za darmo</a>
      <a class="hero-login" href="#logowanie">Mam już konto – zaloguj się</a>
      <div class="hero-stats">${stat(players, 'kolonistów')}${stat(online, 'aktywnych (1 h)')}${stat(battles24, 'bitew (24 h)')}</div>
    </div>
    <a class="scroll-hint" href="#o-grze" aria-label="Przewiń w dół">⌄</a>
  </section>

  <section id="o-grze" class="features">
    <h2 class="section-title">Twoja kolonia. Twoje zasady.</h2>
    ${FEATURES.map(([im, h, t]) => `<article class="feature">${img(im, h, '', 320)}<div><h3>${h}</h3><p>${t}</p></div></article>`).join('')}
  </section>

  <section class="battle-teaser">
    <div class="bt-bg" aria-hidden="true"></div>
    <div class="bt-inner">
      <h2 class="section-title">Bitwy w kilka sekund</h2>
      <p>Każde starcie to szybki raport: salwy plazmowe, torpedy jonowe, trafienia krytyczne. Zwycięstwo daje XP, metal i kryształy.</p>
      <div class="pirates">${pirates}</div>
    </div>
  </section>

  <section class="card rank-preview">
    <h2 class="section-title">🏆 Najlepsi komandorzy</h2>
    <ol class="mini-rank">${rank}</ol>
  </section>

  <section id="start" class="card auth">
    <h2 class="section-title">Załóż kolonię – za darmo</h2>
    <p class="muted small">Wystarczy nazwa i hasło. Żadnych maili, żadnej instalacji.</p>
    <form method="post" action="/rejestracja" class="form">
      <input name="username" placeholder="Nazwa komandora (3–16 znaków)" minlength="3" maxlength="16" required autocomplete="username" aria-label="Nazwa komandora">
      <input name="password" type="password" placeholder="Hasło (min. 6 znaków)" minlength="6" required autocomplete="new-password" aria-label="Hasło">
      <button class="btn cta wide">🚀 Wyląduj na planecie</button>
    </form>
  </section>
  <section id="logowanie" class="card auth">
    <h3>Masz już kolonię?</h3>
    <form method="post" action="/logowanie" class="form">
      <input name="username" placeholder="Nazwa komandora" required autocomplete="username" aria-label="Nazwa komandora">
      <input name="password" type="password" placeholder="Hasło" required autocomplete="current-password" aria-label="Hasło">
      <button class="btn wide">🔑 Zaloguj</button>
    </form>
  </section>

  <section class="card install">
    <h3>📲 Zainstaluj jak aplikację</h3>
    <p class="small">Kolonie działają jak aplikacja – pełny ekran i ikona na ekranie głównym, bez sklepu.</p>
    <button class="btn primary wide" id="install-btn" hidden>⬇️ Zainstaluj Kolonie</button>
    <ul class="small muted">
      <li><b>Android (Chrome):</b> menu ⋮ → „Zainstaluj aplikację”.</li>
      <li><b>iPhone (Safari):</b> przycisk Udostępnij → „Do ekranu początkowego”.</li>
    </ul>
  </section>

  <section class="faq">
    <h2 class="section-title">Najczęstsze pytania</h2>
    ${FAQ.map(([q, a]) => `<details class="card"><summary>${q}</summary><p>${a}</p></details>`).join('')}
  </section>

  <section class="final-cta">
    <h2>Galaktyka czeka, Komandorze.</h2>
    <a class="btn cta" href="#start">🚀 Zagraj za darmo</a>
  </section>

  <footer class="footer">
    <img src="/img/logo.webp?v=${V}" alt="Kolonie" width="140" height="39" loading="lazy">
    <p>© ${new Date().getFullYear()} Kolonie · darmowa gra przeglądarkowa sci-fi</p>
    <p><a href="#o-grze">O grze</a> · <a href="#start">Rejestracja</a> · <a href="#logowanie">Logowanie</a></p>
  </footer>` });
}

export function colony({ user, st, flash }) {
  const have = { metal: st.stock.metal + st.pending.metal, crystal: st.stock.crystal + st.pending.crystal, energy: st.stock.energy + st.pending.energy };
  const xpPct = Math.round((user.xp / st.xpNeed) * 100);
  const pend = R.RES_KEYS.map((k) => `<div class="pend">
      ${resIcon(k, 40)}
      <b data-live-res data-v="${st.pending[k]}" data-rate="${(st.rates[k] / 60).toFixed(4)}" data-cap="${st.cap[k]}">${fmt(st.pending[k])}</b>
      <small>+${fmt(st.rates[k] * 60)}/h · maks. ${fmt(st.cap[k])}</small></div>`).join('');
  const blds = Object.entries(R.BUILDINGS).map(([id, b]) => {
    const lvl = user[b.col];
    const c = R.upgradeCost(b, lvl);
    const ok = canPay(have, c) && lvl < R.MAX_LEVEL_BUILDING;
    let effect = '';
    if (id === 'mine') effect = `🔩 ${fmt(8 * lvl * R.SPEED * 60)}/h · 💎 ${fmt(3 * lvl * R.SPEED * 60)}/h`;
    if (id === 'power') effect = `⚡ ${fmt(5 * lvl * R.SPEED * 60)}/h`;
    if (id === 'shipyard') effect = `Moduły do poz. ${lvl * 2} · naprawa ${2 + lvl}%/min`;
    if (id === 'lab') effect = `Bonus bitewny +${(lvl - 1) * 10}%`;
    return `<div class="item">
      ${img('b_' + id, b.name, 'thumb', 64)}
      <div class="grow"><div class="row"><b>${b.name}</b><span class="lvl">poz. ${lvl}</span></div>
        <div class="muted small">${b.desc}</div><div class="eff">${effect}</div>
        <div class="costs">${costHtml(c)}</div></div>
      <form method="post" action="/kolonia/ulepsz/${id}"><button class="btn sm ${ok ? 'primary' : ''}" ${ok ? '' : 'disabled'}>⬆️</button></form>
    </div>`;
  }).join('');
  return layout({ title: 'Kolonia', user, st, flash, active: 'kolonia', body: `
  <section class="card colony banner" style="--bg:url('/img/hero.webp?v=${V}')">
    <div class="grow">
      <div class="muted small">Planeta</div><h2>${esc(user.planet)}</h2>
      <div class="muted small">Kolonia komandora <b>${esc(user.username)}</b></div>
      <div class="bar xp"><i style="width:${xpPct}%"></i><span>Poziom ${user.level} · ${fmt(user.xp)}/${fmt(st.xpNeed)} XP</span></div>
    </div>
  </section>
  <section class="card">
    <div class="row"><h3>Magazyn wydobycia</h3><span class="muted small">pojemność: 2 h produkcji</span></div>
    <div class="pends">${pend}</div>
    <form method="post" action="/kolonia/zbierz"><button class="btn primary wide">📦 Zbierz surowce</button></form>
  </section>
  <section class="card"><h3>Budynki</h3><p class="muted small">Ulepszenie automatycznie zbiera surowce z magazynu wydobycia.</p>${blds}</section>
  <div class="logout"><form method="post" action="/wyloguj"><button class="btn sm">🚪 Wyloguj</button></form></div>` });
}

export function ship({ user, st, flash }) {
  const cap = R.moduleCap(user);
  const mods = Object.entries(R.MODULES).map(([id, m]) => {
    const lvl = user[m.col];
    const c = R.upgradeCost(m, lvl);
    const capped = lvl >= cap;
    const ok = !capped && canPay(st.stock, c);
    return `<div class="item">
      <div class="ic big">${m.icon}</div>
      <div class="grow"><div class="row"><b>${m.name}</b><span class="lvl">poz. ${lvl}/${cap}</span></div>
        <div class="muted small">${m.desc}</div>
        <div class="costs">${capped ? '<span class="warn small">Ulepsz stocznię, by podnieść limit</span>' : costHtml(c)}</div></div>
      <form method="post" action="/statek/ulepsz/${id}"><button class="btn sm ${ok ? 'primary' : ''}" ${ok ? '' : 'disabled'}>⬆️</button></form>
    </div>`;
  }).join('');
  return layout({ title: 'Statek', user, st, flash, active: 'statek', body: `
  <section class="card center ship-card" style="--shield:${Math.min(0.15 + user.s_shields * 0.07, 0.8).toFixed(2)}">
    <div class="ship-art">${img('ship', 'Twój statek', '', 320, true)}</div>
    <h2>Statek „${esc(user.username)}”</h2>
    ${hpBar(st)}
    <div class="stats">
      <div><span>💥</span><b>${st.ship.atk}</b><small>Atak</small></div>
      <div><span>🔰</span><b>${st.ship.def}</b><small>Obrona</small></div>
      <div><span>🛠️</span><b>${Math.round(st.ship.repair)}</b><small>HP/min</small></div>
      <div><span>⭐</span><b>${st.ship.power}</b><small>Siła</small></div>
    </div>
  </section>
  <section class="card"><h3>Moduły</h3><p class="muted small">Limit poziomu modułów: ${cap} (2 × poziom stoczni). Za surowce z magazynu głównego.</p>${mods}</section>` });
}

export function battle({ user, st, flash, targets, recent, now }) {
  const enough = st.ship.hp >= st.ship.maxHp * R.MIN_HP_RATIO;
  const pir = R.PIRATES.map((p) => {
    const locked = user.level < p.minLvl;
    const e = R.pirate(p, user.level);
    return `<div class="item ${locked ? 'locked' : ''}">
      ${img('p_' + p.id, p.name, 'thumb', 64)}
      <div class="grow"><div class="row"><b>${p.name}</b><span class="lvl">${locked ? `🔒 od poz. ${p.minLvl}` : `poz. ${e.level}`}</span></div>
        <div class="muted small">${p.desc}</div>
        ${locked ? '' : `<div class="eff">❤️ ${e.hp} · 💥 ${e.atk} · 🔰 ${e.def}</div>`}</div>
      <form method="post" action="/bitwa/piraci/${p.id}"><button class="btn sm ${locked ? '' : 'danger'}" ${locked ? 'disabled' : ''}>⚔️ ⚡${p.energy}</button></form>
    </div>`;
  }).join('');
  const tg = targets.length ? targets.map((t) => `<div class="item">
      <div class="ic">👾</div>
      <div class="grow"><b>${esc(t.username)}</b> ${t.tag ? `<span class="corp">[${esc(t.tag)}]</span>` : ''}
        <div class="muted small">poz. ${t.level} · siła ${R.power(t)} · ${esc(t.planet)}</div></div>
      <form method="post" action="/bitwa/gracz/${t.id}"><button class="btn sm danger">⚔️ ⚡${R.PVP_ENERGY}</button></form>
    </div>`).join('') : '<p class="muted">Brak dostępnych celów w Twoim zasięgu.</p>';
  const rec = recent.length ? recent.map((b) => {
    const mine = b.attacker_id === user.id;
    const won = mine ? b.attacker_won : !b.attacker_won;
    const label = b.kind === 'pve' ? b.enemy_name : mine ? `atak na ${esc(b.defender_name)}` : `obrona przed ${esc(b.attacker_name)}`;
    return `<a class="item link" href="/bitwa/${b.id}"><span class="ic">${won ? '🏆' : '💀'}</span>
      <span class="grow">${label}<br><small class="muted">${ago(b.created_at, now)}</small></span><span>›</span></a>`;
  }).join('') : '<p class="muted">Jeszcze nie walczyłeś.</p>';
  return layout({ title: 'Bitwa', user, st, flash, active: 'bitwa', body: `
  <section class="card banner battle-banner" style="--bg:url('/img/battle_bg.webp?v=${V}')"><h2>Centrum dowodzenia</h2>${hpBar(st)}
    ${enough ? '' : `<p class="warn small">Statek jest zbyt uszkodzony (min. ${R.MIN_HP_RATIO * 100}% HP). Poczekaj na naprawę.</p>`}</section>
  <section class="card"><h3>☠️ Piraci</h3>${pir}</section>
  <section class="card"><h3>👾 Inni gracze</h3><p class="muted small">Wygrana = łup 10% metalu i kryształów rywala. Zaatakowany gracz dostaje 15 min ochrony.</p>${tg}</section>
  <section class="card"><h3>📜 Ostatnie bitwy</h3>${rec}</section>` });
}

export function battleLog({ user, st, flash, b, now }) {
  const mine = b.attacker_id === user.id;
  const won = mine ? b.attacker_won : !b.attacker_won;
  const log = JSON.parse(b.log);
  const rw = JSON.parse(b.reward);
  const rewardLine = [rw.xp ? `✨ ${rw.xp} XP` : '', rw.metal ? `🔩 ${rw.metal}` : '', rw.crystal ? `💎 ${rw.crystal}` : '',
    rw.levelUp ? `🎉 Awans na poziom ${rw.levelUp}!` : ''].filter(Boolean).join(' · ');
  const again = b.kind === 'pve' && mine ? `<form method="post" action="/bitwa/piraci/${esc(rw.tier)}"><button class="btn danger wide">⚔️ Walcz ponownie</button></form>` : '';
  return layout({ title: 'Raport z bitwy', user, st, flash, active: 'bitwa', body: `
  <section class="card center result banner ${won ? 'win' : 'lose'}" style="--bg:url('/img/battle_bg.webp?v=${V}')">
    ${b.kind === 'pve' && rw.tier ? img('p_' + rw.tier, b.enemy_name, 'enemy', 120, true) : `<div class="huge">${won ? '🏆' : '💀'}</div>`}
    <h2>${won ? 'ZWYCIĘSTWO' : 'PORAŻKA'}</h2>
    <p>${esc(b.attacker_name)} <span class="muted">vs</span> ${esc(b.kind === 'pve' ? b.enemy_name : b.defender_name)}</p>
    ${mine && rewardLine ? `<p class="reward">${rewardLine}</p>` : ''}
    <p class="muted small">${ago(b.created_at, now)}</p>
  </section>
  <section class="card"><h3>Przebieg</h3><ol class="log">${log.map((l) => `<li class="${l.side}"><span class="r">R${l.r}</span>${esc(l.t)}</li>`).join('')}</ol></section>
  <section class="card">${again}<a class="btn wide" href="/bitwa">↩️ Wróć</a></section>` });
}

export function corp({ user, st, flash, myCorp, members, corps }) {
  if (myCorp) {
    return layout({ title: 'Korporacja', user, st, flash, active: 'korporacja', body: `
    <section class="card center"><div class="huge">🛰️</div><h2>${esc(myCorp.name)} <span class="corp">[${esc(myCorp.tag)}]</span></h2>
      <p class="muted small">${members.length}/${R.CORP_MAX_MEMBERS} członków · bonus +${R.CORP_XP_BONUS * 100}% XP z bitew</p></section>
    <section class="card"><h3>Członkowie</h3>${members.map((m, i) => `<div class="item"><span class="ic">${m.id === myCorp.owner_id ? '👑' : '👤'}</span>
      <span class="grow"><b>${esc(m.username)}</b><br><small class="muted">poz. ${m.level} · ${m.pvp_points} pkt PvP</small></span><span class="muted">#${i + 1}</span></div>`).join('')}</section>
    <section class="card"><form method="post" action="/korporacja/opusc" onsubmit="return confirm('Na pewno opuścić korporację?')">
      <button class="btn wide">🚪 Opuść korporację</button></form></section>` });
  }
  const list = corps.length ? corps.map((c) => `<div class="item"><span class="ic">🛰️</span>
    <span class="grow"><b>${esc(c.name)}</b> <span class="corp">[${esc(c.tag)}]</span><br><small class="muted">${c.members}/${R.CORP_MAX_MEMBERS} członków · siła ${c.power}</small></span>
    <form method="post" action="/korporacja/dolacz/${c.id}"><button class="btn sm primary" ${c.members >= R.CORP_MAX_MEMBERS ? 'disabled' : ''}>Dołącz</button></form></div>`).join('')
    : '<p class="muted">Nie ma jeszcze żadnej korporacji. Załóż pierwszą!</p>';
  return layout({ title: 'Korporacje', user, st, flash, active: 'korporacja', body: `
  <section class="card"><h3>🛰️ Korporacje</h3><p class="muted small">Członkowie korporacji dostają +${R.CORP_XP_BONUS * 100}% XP z bitew i wspólnie walczą o ranking.</p>${list}</section>
  <section class="card"><h3>Załóż korporację</h3>
    <form method="post" action="/korporacja/zaloz" class="form">
      <input name="name" placeholder="Nazwa (3–24 znaki)" minlength="3" maxlength="24" required>
      <input name="tag" placeholder="TAG (2–4 litery/cyfry)" minlength="2" maxlength="4" required style="text-transform:uppercase">
      <button class="btn primary">Załóż za ${costHtml(R.CORP_COST)}</button>
    </form></section>` });
}

export function ranking({ user, st, flash, tab, rows, myRank }) {
  const tabs = [['gracze', 'Poziom'], ['pvp', 'PvP'], ['korporacje', 'Korporacje']];
  const head = `<div class="seg">${tabs.map(([id, l]) => `<a href="/ranking?tab=${id}" class="${tab === id ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  let body;
  if (tab === 'korporacje') {
    body = rows.map((c, i) => `<div class="item rank"><span class="pos">${i + 1}</span><span class="grow"><b>${esc(c.name)}</b> <span class="corp">[${esc(c.tag)}]</span>
      <br><small class="muted">${c.members} członków</small></span><b>${fmt(c.power)}</b></div>`).join('');
  } else {
    body = rows.map((r, i) => `<div class="item rank ${r.id === user.id ? 'me' : ''}"><span class="pos">${i + 1}</span>
      <span class="grow"><b>${esc(r.username)}</b> ${r.tag ? `<span class="corp">[${esc(r.tag)}]</span>` : ''}<br>
      <small class="muted">${tab === 'pvp' ? `${r.pvp_wins} W / ${r.pvp_losses} P` : `${fmt(r.xp)} XP · ${r.pve_wins} piratów`}</small></span>
      <b>${tab === 'pvp' ? `${r.pvp_points} pkt` : `Lv ${r.level}`}</b></div>`).join('');
  }
  return layout({ title: 'Ranking', user, st, flash, active: 'ranking', body: `
  <section class="card">${head}${myRank ? `<p class="muted small">Twoja pozycja: <b>#${myRank}</b></p>` : ''}
  ${body || '<p class="muted">Pusto.</p>'}</section>` });
}

export function notFound({ user, st }) {
  return layout({ title: 'Nie znaleziono', user, st, body: `<section class="card center"><div class="huge">🕳️</div><h2>Czarna dziura</h2><p>Tej strony nie ma w tym sektorze.</p><a class="btn" href="/">Wróć</a></section>` });
}
