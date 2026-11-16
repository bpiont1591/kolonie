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
const costHtml = (c) => R.RES_KEYS.filter((k) => c[k] > 0).map((k) => `<span class="cost">${R.RESOURCES[k].icon} ${fmt(c[k])}</span>`).join(' ');
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

export function layout({ title, user, st, body, flash, active = '' }) {
  const top = user ? `
  <header class="top">
    <a class="brand" href="/kolonia"><span class="logo">🪐</span><span>KOLONIE</span></a>
    <div class="res">
      ${R.RES_KEYS.map((k) => `<span title="${R.RESOURCES[k].name}">${R.RESOURCES[k].icon} <b>${fmt(st.stock[k])}</b></span>`).join('')}
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
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#070b1a"><meta name="description" content="Kolonie – kosmiczna gra MMORPG w przeglądarce">
<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-192.png"><link rel="stylesheet" href="/style.css?v=3">
<title>${esc(title)} · Kolonie</title></head>
<body class="${user ? 'in' : 'out'}"><div class="stars"></div>${top}<main>${fl}${body}</main>${nav}
<script src="/app.js?v=3" defer></script></body></html>`;
}

export function landing({ online, players, flash }) {
  return layout({ title: 'Witaj, Komandorze', flash, body: `
  <section class="hero">
    <div class="planet big"></div>
    <h1>KOLONIE</h1>
    <p class="tag">Zbuduj kolonię na obcej planecie. Uzbrój statek. Zostań legendą sektora.</p>
    <p class="muted small">${fmt(players)} kolonistów · ${fmt(online)} aktywnych w ostatniej godzinie</p>
  </section>
  <section class="card">
    <h2>Nowa kolonia</h2>
    <form method="post" action="/rejestracja" class="form">
      <input name="username" placeholder="Nazwa komandora (3–16 znaków)" minlength="3" maxlength="16" required autocomplete="username">
      <input name="password" type="password" placeholder="Hasło (min. 6 znaków)" minlength="6" required autocomplete="new-password">
      <button class="btn primary">🚀 Wyląduj na planecie</button>
    </form>
  </section>
  <section class="card">
    <h2>Mam już kolonię</h2>
    <form method="post" action="/logowanie" class="form">
      <input name="username" placeholder="Nazwa komandora" required autocomplete="username">
      <input name="password" type="password" placeholder="Hasło" required autocomplete="current-password">
      <button class="btn">🔑 Zaloguj</button>
    </form>
  </section>
  <section class="card info">
    <h3>Jak grać?</h3>
    <ul>
      <li>⛏️ Kolonia sama wydobywa surowce – wracaj i <b>zbieraj</b> je z magazynu.</li>
      <li>🏗️ Rozbudowuj budynki, by produkować więcej.</li>
      <li>🚀 Ulepszaj kadłub, działa i tarcze swojego statku.</li>
      <li>⚔️ Walcz z piratami i innymi graczami – szybkie bitwy, prawdziwe łupy.</li>
      <li>🛰️ Dołącz do korporacji i wspinaj się w rankingu.</li>
    </ul>
  </section>` });
}

export function colony({ user, st, flash }) {
  const have = { metal: st.stock.metal + st.pending.metal, crystal: st.stock.crystal + st.pending.crystal, energy: st.stock.energy + st.pending.energy };
  const xpPct = Math.round((user.xp / st.xpNeed) * 100);
  const pend = R.RES_KEYS.map((k) => `<div class="pend">
      <span class="ic">${R.RESOURCES[k].icon}</span>
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
      <div class="ic big">${b.icon}</div>
      <div class="grow"><div class="row"><b>${b.name}</b><span class="lvl">poz. ${lvl}</span></div>
        <div class="muted small">${b.desc}</div><div class="eff">${effect}</div>
        <div class="costs">${costHtml(c)}</div></div>
      <form method="post" action="/kolonia/ulepsz/${id}"><button class="btn sm ${ok ? 'primary' : ''}" ${ok ? '' : 'disabled'}>⬆️</button></form>
    </div>`;
  }).join('');
  return layout({ title: 'Kolonia', user, st, flash, active: 'kolonia', body: `
  <section class="card colony">
    <div class="planet"></div>
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

const shipSvg = (u) => `<svg class="ship" viewBox="0 0 200 120" aria-hidden="true">
  <defs><linearGradient id="hg" x1="0" x2="1"><stop offset="0" stop-color="#2b3a67"/><stop offset="1" stop-color="#7fd6ff"/></linearGradient>
  <radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#3ee6ff" stop-opacity="0"/><stop offset="1" stop-color="#3ee6ff" stop-opacity="${Math.min(0.15 + u.s_shields * 0.07, 0.8).toFixed(2)}"/></radialGradient></defs>
  <ellipse cx="105" cy="60" rx="${70 + Math.min(u.s_hull, 10) * 2}" ry="${38 + Math.min(u.s_shields, 10)}" fill="url(#sh)"/>
  <path d="M30 60 L70 40 L150 46 L180 60 L150 74 L70 80 Z" fill="url(#hg)" stroke="#9fe8ff" stroke-width="1.5"/>
  <path d="M70 40 L95 18 L115 44 Z M70 80 L95 102 L115 76 Z" fill="#24335c" stroke="#9fe8ff" stroke-width="1.2"/>
  <ellipse cx="140" cy="60" rx="14" ry="6" fill="#0b1430" stroke="#3ee6ff"/>
  ${Array.from({ length: Math.min(u.s_guns, 6) }, (_, i) => `<rect x="${118 + i * 7}" y="${i % 2 ? 76 : 40}" width="5" height="4" fill="#ff4fd8"/>`).join('')}
  <path d="M30 54 L8 52 L14 60 L8 68 L30 66 Z" fill="#ff8a3d"><animate attributeName="opacity" values="1;.4;1" dur=".6s" repeatCount="indefinite"/></path>
</svg>`;

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
  <section class="card center">
    ${shipSvg(user)}
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
      <div class="ic big">${p.icon}</div>
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
  <section class="card">${hpBar(st)}
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
  <section class="card center result ${won ? 'win' : 'lose'}">
    <div class="huge">${won ? '🏆' : '💀'}</div>
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
