import * as R from './rules.js';
import { SPRITE, ic, pi, lvBadge, V as ASSET_V } from './icons.js';
import * as Q from './quests.js';
import { dur, clockHM } from './time.js';
import { titleOf } from './achievements.js';
export { ic, pi, lvBadge };

/** Polska odmiana: plural(2, 'nagroda', 'nagrody', 'nagród') -> 'nagrody'. */
export const plural = (n, one, few, many) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Tytuł przy nicku (z osiągnięć). */
export const ttl = (id) => { const t = titleOf(id); return t ? ` <span class="ttl">${esc(t)}</span>` : ''; };
export const fmt = (n) => Math.floor(n).toLocaleString('pl-PL');
export const ago = (ts, now) => {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s} s temu`;
  if (s < 3600) return `${Math.floor(s / 60)} min temu`;
  if (s < 86400) return `${Math.floor(s / 3600)} h temu`;
  return `${Math.floor(s / 86400)} d temu`;
};
export const costHtml = (c, have) => R.RES_KEYS.filter((k) => c[k] > 0).map((k) => `<span class="cost${have && have[k] < c[k] ? ' lack' : ''}">${resIcon(k, 16)}${fmt(c[k])}</span>`).join('');
/** Zamienia emoji z komunikatów/logów na ikony (po escapowaniu). */
const EMO = { '🔩': () => resIcon('metal', 16), '💎': () => resIcon('crystal', 16), '⚡': () => resIcon('energy', 16), '🏆': () => pi('trophy', 20, 'inl'), '💀': () => pi('defeat', 20, 'inl') };
export const emo = (html) => html.replace(/🔩|💎|⚡|🏆|💀/gu, (m) => EMO[m]());
const canPay = (have, c) => R.RES_KEYS.every((k) => have[k] >= c[k]);

/** Stan gracza wyliczony na chwilę `now` (serwer jest jedynym źródłem prawdy). */
export function state(u, now) {
  const ship = R.shipStats(u);
  return {
    stock: { metal: u.metal, crystal: u.crystal, energy: u.energy },
    pending: R.pending(u, now),
    rates: R.production(u, now),
    cap: R.storageCap(u, now),
    ship: { ...ship, hp: R.currentHp(u, now), repair: R.repairPerMin(u), power: R.power(u) },
    xpNeed: R.xpForNext(u.level),
  };
}

export function hpBar(st) {
  const pct = Math.round((st.ship.hp / st.ship.maxHp) * 100);
  return `<div class="bar hp" data-live-hp data-hp="${st.ship.hp}" data-max="${st.ship.maxHp}" data-rate="${(st.ship.repair / 60).toFixed(4)}">
    <i style="width:${pct}%"></i><span>${ic('heart', 'hp-ic')} <b data-hp-text>${st.ship.hp}</b>/${st.ship.maxHp} HP</span></div>`;
}

const V = ASSET_V; // wersja zasobów statycznych (cache-busting)
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
    <a class="rank-link${active === 'ranking' ? ' on' : ''}" href="/ranking" aria-label="Ranking" title="Ranking">${pi('trophy', 30)}</a>
    <a class="who" href="/osiagniecia" title="Osiągnięcia i tytuły">${lvBadge(user.level, 'sm')}<span>${esc(user.username)}${titleOf(user.title) ? `<small class="who-t">${esc(titleOf(user.title))}</small>` : ''}</span></a>
  </header>` : '';
  const tabs = [
    ['kolonia', '/kolonia', 'colony', 'Kolonia'], ['statek', '/statek', 'ship', 'Statek'], ['bitwa', '/bitwa', 'battle', 'Bitwa'],
    ['misje', '/misje', 'quest', 'Misje'], ['korporacja', '/korporacja', 'corp', 'Korpo'], ['czat', '/czat', 'chat', 'Czat'],
  ];
  const nav = user ? `<nav class="tabs">${tabs.map(([id, href, icon, label]) =>
    `<a href="${href}" class="${active === id ? 'on' : ''}"${active === id ? ' aria-current="page"' : ''}>${ic(icon)}<span>${label}</span>${st?.badges?.[id] ? `<i class="badge">${st.badges[id] > 9 ? '9+' : st.badges[id]}</i>` : ''}</a>`).join('')}</nav>` : '';
  const tb = user && st?.tut ? tutBar(st.tut, active) : '';
  const fl = flash ? `<div class="flash ${flash.ok ? 'ok' : 'err'}" role="status">${emo(esc(flash.msg))}</div>` : '';
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
<body class="${user ? 'in' : 'out'} ${bodyClass}" data-now="${Date.now()}"${st?.tut && !st.tut.done && st.tut.tab === active ? ` data-tut-step="${st.tut.key}"` : ''}>${SPRITE}<div class="stars"></div>${top}<main>${fl}${tb}${body}</main>${nav}
<script src="/app.js?v=${V}" defer></script></body></html>`;
}

/** Pasek samouczka (misja startowa) – widoczny na każdej stronie do ukończenia lub pominięcia. */
function tutBar(t, active) {
  const dots = Array.from({ length: t.count }, (_, i) => `<i class="${i + 1 < t.n ? 'on' : i + 1 === t.n ? 'cur' : ''}"></i>`).join('');
  const here = t.tab === active;
  const act = t.done
    ? `<form method="post" action="/samouczek/odbierz"><button class="btn cta wide">${ic('gift')} Odbierz nagrodę</button></form>`
    : here ? `<p class="tut-here">${ic('up', 'bounce')} Wskazany element świeci się na tej stronie</p>`
    : `<a class="btn primary wide" href="${t.page}">Pokaż mi ${ic('up', 'chev-r')}</a>`;
  return `<section class="card tut${t.done ? ' done' : ''}" id="tut" aria-label="Samouczek">
    <div class="tut-top">${pi('tutorial', 58, 'float')}<div class="grow"><small class="tut-k">Misja startowa · krok ${t.n}/${t.count}</small><b>${t.done ? `${ic('check')} ${t.title} – gotowe!` : t.title}</b><div class="tut-dots">${dots}</div></div></div>
    <p class="tut-text">${t.done ? 'Świetnie, komandorze! Odbierz nagrodę i przejdź dalej.' : t.text}</p>
    <div class="tut-rw">${rewardChips(t.r, 16)}</div>
    ${act}
    <form method="post" action="/samouczek/pomin" class="tut-skip" onsubmit="return confirm('Pominąć samouczek? Pozostałe nagrody przepadną.')"><button class="linkish">Pomiń samouczek</button></form>
  </section>`;
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

export function landing({ online, players, battles24, top, flash, baseUrl, invitedBy = null, refCode = '' }) {
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
  const rank = top.length ? top.map((r, i) => `<li><span class="pos">${i + 1}</span><b>${esc(r.username)}</b>${r.tag ? ` <span class="corp">[${esc(r.tag)}]</span>` : ''}<span class="grow"></span>${lvBadge(r.level)}</li>`).join('')
    : '<li class="muted">Ranking czeka na pierwszego komandora – może to będziesz Ty?</li>';
  return layout({ title, flash, head, bodyClass: 'landing', baseUrl, body: `
  <section class="hero-full">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="hero-inner">
      <img class="hero-logo" src="/img/logo.webp?v=${V}" alt="Kolonie" width="640" height="177" fetchpriority="high">
      <h1>Zbuduj kolonię.<br><span>Podbij galaktykę.</span></h1>
      <p class="lead">Darmowa kosmiczna gra MMORPG w przeglądarce. Rozbuduj bazę na obcej planecie, uzbrój statek i walcz o sławę w sektorze.</p>
      <a class="btn cta" href="#start">${ic('ship')} Zagraj za darmo</a>
      <a class="hero-login" href="#logowanie">Mam już konto – zaloguj się</a>
      <div class="hero-stats">${stat(players, 'kolonistów')}${stat(online, 'aktywnych (1 h)')}${stat(battles24, 'bitew (24 h)')}</div>
    </div>
    <a class="scroll-hint" href="#o-grze" aria-label="Przewiń w dół">${ic('up', 'down')}</a>
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
    <h2 class="section-title with-ic">${pi('trophy', 40)} Najlepsi komandorzy</h2>
    <ol class="mini-rank">${rank}</ol>
  </section>

  <section id="start" class="card auth">
    <h2 class="section-title">Załóż kolonię – za darmo</h2>
    <p class="muted small">Wystarczy nazwa i hasło. Żadnych maili, żadnej instalacji.</p>
    ${invitedBy ? `<div class="callout invite-cta">${pi('invite', 44)}<span class="grow"><b>Zaproszenie od ${esc(invitedBy)}</b><br><small>Osiągnij poziom 5, a oboje dostaniecie nagrody!</small></span></div>` : ''}
    <form method="post" action="/rejestracja" class="form">
      ${refCode ? `<input type="hidden" name="ref" value="${esc(refCode)}">` : ''}
      <input name="username" placeholder="Nazwa komandora (3–16 znaków)" minlength="3" maxlength="16" required autocomplete="username" aria-label="Nazwa komandora">
      <input name="password" type="password" placeholder="Hasło (min. 6 znaków)" minlength="6" required autocomplete="new-password" aria-label="Hasło">
      <button class="btn cta wide">${ic('ship')} Wyląduj na planecie</button>
    </form>
  </section>
  <section id="logowanie" class="card auth">
    <h3>Masz już kolonię?</h3>
    <form method="post" action="/logowanie" class="form">
      <input name="username" placeholder="Nazwa komandora" required autocomplete="username" aria-label="Nazwa komandora">
      <input name="password" type="password" placeholder="Hasło" required autocomplete="current-password" aria-label="Hasło">
      <button class="btn wide">${ic('login')} Zaloguj</button>
    </form>
  </section>

  <section class="card install">
    <h3 class="with-ic">${ic('download', 'acc')} Zainstaluj jak aplikację</h3>
    <p class="small">Kolonie działają jak aplikacja – pełny ekran i ikona na ekranie głównym, bez sklepu.</p>
    <button class="btn primary wide" id="install-btn" hidden>${ic('download')} Zainstaluj Kolonie</button>
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
    <a class="btn cta" href="#start">${ic('ship')} Zagraj za darmo</a>
  </section>

  <footer class="footer">
    <img src="/img/logo.webp?v=${V}" alt="Kolonie" width="140" height="39" loading="lazy">
    <p>© ${new Date().getFullYear()} Kolonie · darmowa gra przeglądarkowa sci-fi</p>
    <p><a href="#o-grze">O grze</a> · <a href="#start">Rejestracja</a> · <a href="#logowanie">Logowanie</a></p>
  </footer>` });
}

/** Karta ulepszenia: ikona + plakietka poziomu, efekt (teraz → dalej), postęp do maks., koszt, przycisk z szewronem. */
function upgradeCard({ action, icon, name, desc, lvl, max, effect, next, cost, have, block, secs, building, busy, rushAction, now, tut = '' }) {
  const td = tut ? ` data-tut="${tut}"` : '';
  const afford = canPay(have, cost);
  const ok = !block && !busy && !building && afford;
  const pct = Math.min(100, Math.round((lvl / max) * 100));
  if (building) {
    const left = Math.max(0, building.until - now), rc = R.rushCost(left);
    const bp = Math.min(100, Math.max(2, Math.round((1 - left / (building.total * 1000)) * 100)));
    return `<div class="upg building"${td}>
    <div class="upg-ic">${icon}${lvBadge(lvl, 'corner')}</div>
    <div class="upg-body">
      <div class="upg-name">${name} <span class="arrow">→</span> <span class="nx">poz. ${lvl + 1}</span></div>
      <div class="bq-line">${pi('timer', 22, 'inl spin')} W budowie · zostało <b data-countdown="${building.until}" data-reload>${dur(left)}</b></div>
      <div class="prog build"><i style="width:${bp}%" data-bar-from="${building.until - building.total * 1000}" data-bar-to="${building.until}"></i></div>
      <div class="upg-foot"><span class="lvtext">po ukończeniu: ${next || effect}</span></div>
    </div>
    <form method="post" action="${rushAction}"><button class="btn-up rush" title="Ukończ natychmiast za ${rc} kryształów" ${have.crystal >= rc ? '' : 'disabled'}>${resIcon('crystal', 22)}<span>${fmt(rc)}</span></button></form>
  </div>`;
  }
  const btn = block ? `<button class="btn-up is-max" disabled title="${esc(block.why)}">${ic('lock')}<span>${block.label}</span></button>`
    : busy ? `<button class="btn-up is-off" disabled title="Kolejka zajęta: ${esc(busy)}">${ic('clock')}<span>Zajęte</span></button>`
    : `<button class="btn-up${ok ? '' : ' is-off'}" ${ok ? '' : 'disabled'} title="${ok ? `Ulepsz do poziomu ${lvl + 1}` : 'Za mało surowców'}">${ic('up')}<span>${ok ? 'Ulepsz' : 'Brak'}</span></button>`;
  return `<div class="upg${ok ? ' ready' : ''}"${td}>
    <div class="upg-ic">${icon}${lvBadge(lvl, 'corner')}</div>
    <div class="upg-body">
      <div class="upg-name">${name}</div>
      <div class="muted small">${desc}</div>
      <div class="eff">${effect}${next ? ` <span class="arrow">→</span> <span class="nx">${next}</span>` : ''}</div>
      <div class="prog" title="Poziom ${lvl} z ${max}"><i style="width:${pct}%"></i></div>
      <div class="upg-foot"><span class="lvtext">poz. <b>${lvl}</b>/${max}</span>${block ? `<span class="warn small">${esc(block.why)}</span>` : `<span class="costs">${costHtml(cost, have)}<span class="cost time">${ic('clock')}${dur(secs * 1000)}</span></span>`}</div>
    </div>
    <form method="post" action="${action}">${btn}</form>
  </div>`;
}

/** Nagroda jako „żetony” z ikonami. */
export function rewardChips(r, size = 18) {
  const out = [];
  for (const k of R.RES_KEYS) if (r[k]) out.push(`<span class="chip">${resIcon(k, size)}${fmt(r[k])}</span>`);
  if (r.xp) out.push(`<span class="chip">${pi('xp', size, 'inl')}${r.xp} XP</span>`);
  if (r.core) out.push(`<span class="chip rare">${pi('core', size + 4, 'inl')}${Q.CORE.name}</span>`);
  return `<span class="chips">${out.join('')}</span>`;
}
const qIcon = (name, size = 44) => name.startsWith('r_') ? `<img src="/img/${name}.webp?v=${V}" class="pi" width="${size}" height="${size}" alt="">` : pi(name, size);

function expeditionCallout(user, now) {
  if (user.ex_until > now) return `<a class="callout exp" href="/ekspedycje">${pi('expedition', 48)}<span class="grow"><b>Statek na ekspedycji</b><br><small>Powrót za <span data-countdown="${user.ex_until}" data-reload>${dur(user.ex_until - now)}</span></small></span>${ic('up', 'chev-r')}</a>`;
  return `<a class="callout exp" href="/ekspedycje">${pi('expedition', 48)}<span class="grow"><b>Ekspedycje</b><br><small>Wyślij statek po łupy: 1 h, 4 h lub 8 h</small></span>${ic('up', 'chev-r')}</a>`;
}

const EX_EVENT_ICON = { calm: 'collect', wreck: 'treasury', pirates: 'defeat', storm: 'shields', artifact: 'core', empty: 'timer', recalled: 'timer' };
export function expeditions({ user, st, flash, rows, now }) {
  const active = rows.find((r) => r.status === 'active' && user.ex_until > now);
  const minHp = Math.ceil(st.ship.maxHp * R.EXPEDITION_MIN_HP);
  const kinds = Object.values(R.EXPEDITIONS).map((k) => {
    const can = !active && st.ship.hp >= minHp && st.stock.energy >= k.energy;
    const est = Math.round((60 + 25 * user.level) * k.h), estC = Math.round((25 + 10 * user.level) * k.h);
    return `<div class="exp-opt h${k.h}">
      <div class="exp-h">${k.h} h</div>
      <div class="grow"><b>${k.name}</b><div class="muted small">${k.desc}</div>
        <div class="chips"><span class="chip">${resIcon('metal', 15)}~${fmt(est)}</span><span class="chip">${resIcon('crystal', 15)}~${fmt(estC)}</span>${k.h >= 8 ? `<span class="chip rare">${pi('core', 18, 'inl')}szansa</span>` : ''}</div></div>
      <form method="post" action="/ekspedycje/wyslij/${k.id}"><button class="btn sm ${can ? 'primary' : ''}" ${can ? '' : 'disabled'}>${ic('ship')}<span class="en">${resIcon('energy', 16)}${k.energy}</span></button></form></div>`;
  }).join('');
  const act = active ? (() => {
    const total = active.return_at - active.started_at, left = active.return_at - now;
    const pct = Math.min(100, Math.max(2, Math.round((1 - left / total) * 100)));
    const k = R.EXPEDITIONS[active.kind];
    return `<section class="card exp-active">
      <div class="with-ic">${pi('expedition', 56, 'float')}<div class="grow"><h3 style="margin:0">${k.name}</h3><small class="muted">Statek w drodze · bitwy niedostępne</small></div></div>
      <div class="bar exp-bar"><i style="width:${pct}%" data-bar-from="${active.started_at}" data-bar-to="${active.return_at}"></i><span>Powrót za <b data-countdown="${active.return_at}" data-reload>${dur(left)}</b></span></div>
      <form method="post" action="/ekspedycje/zawroc" onsubmit="return confirm('Zawrócić statek? Ekspedycja przepadnie bez łupów.')"><button class="btn sm wide">${ic('logout', 'flip')} Zawróć statek (bez łupów)</button></form>
    </section>`;
  })() : '';
  const hist = rows.filter((r) => r.status !== 'active');
  const histHtml = hist.length ? hist.map((r) => {
    const res = JSON.parse(r.result);
    return `<a class="item link" href="/ekspedycje/${r.id}">${pi(EX_EVENT_ICON[res.event] || 'expedition', 40, 'res-ic')}
      <span class="grow"><b>${esc(res.title || '')}</b> <small class="muted">· ${R.EXPEDITIONS[r.kind]?.name || ''}</small><br>${res.loot && Object.keys(res.loot).length ? rewardChips(res.loot, 14) : '<small class="muted">bez łupów</small>'}</span>${ic('up', 'chev-r')}</a>`;
  }).join('') : '<p class="muted">Brak raportów – wyślij pierwszą ekspedycję!</p>';
  return layout({ title: 'Ekspedycje', user, st, flash, active: 'statek', body: `
  <section class="card banner exp-banner" style="--bg:url('/img/expedition_bg.webp?v=${V}')"><h2>Ekspedycje</h2>
    <p class="small">Statek wyrusza w nieznane: surowce, wraki, artefakty – ale też piraci i burze jonowe. W tym czasie nie może walczyć.</p>${hpBar(st)}</section>
  ${act}
  <section class="card"><h3 class="with-ic">${pi('expedition', 30)} Cele</h3>
    ${!active && st.ship.hp < minHp ? `<p class="warn small">Statek potrzebuje min. ${R.EXPEDITION_MIN_HP * 100}% HP (${minHp}), by wyruszyć.</p>` : ''}
    ${kinds}</section>
  <section class="card"><h3 class="with-ic">${ic('log', 'acc')} Raporty</h3>${histHtml}</section>` });
}

export function expeditionReport({ user, st, flash, ex, now }) {
  const res = JSON.parse(ex.result);
  const k = R.EXPEDITIONS[ex.kind];
  if (ex.status === 'active') return layout({ title: 'Ekspedycja', user, st, flash, active: 'statek', body: `<section class="card center">${pi('expedition', 120, 'big-ic float')}<h2>${k.name}</h2><p>Statek wciąż w drodze – powrót za <b data-countdown="${ex.return_at}" data-reload>${dur(ex.return_at - now)}</b>.</p><a class="btn wide" href="/ekspedycje">Wróć</a></section>` });
  const bad = res.event === 'pirates' || res.event === 'storm';
  return layout({ title: 'Raport z ekspedycji', user, st, flash, active: 'statek', body: `
  <section class="card center result banner ${bad ? 'lose' : 'win'}" style="--bg:url('/img/expedition_bg.webp?v=${V}')">
    ${pi(EX_EVENT_ICON[res.event] || 'expedition', 110, 'big-ic')}
    <small class="muted">${k?.name || ''} · ${k?.h || ''} h</small>
    <h2>${esc(res.title)}</h2>
    <p>${esc(res.text)}</p>
    ${res.loot && Object.keys(res.loot).length ? `<p class="reward">${rewardChips(res.loot, 20)}</p>` : ''}
    ${res.dmg ? `<p class="warn small">${ic('heart', 'hp-ic')} Uszkodzenia kadłuba: −${Math.round(res.dmg * 100)}% HP</p>` : ''}
    ${res.levelUp ? `<p class="lvup">${pi('power', 22, 'inl')} Awans na poziom ${res.levelUp}!</p>` : ''}
  </section>
  <section class="card"><a class="btn primary wide" href="/ekspedycje">${ic('ship')} Kolejna ekspedycja</a></section>` });
}

function colonyCallouts(user, st, now) {
  const out = [];
  const ls = Q.loginState(user, now);
  if (!ls.claimedToday) out.push(`<a class="callout gold" href="/misje">${pi('daily', 48)}<span class="grow"><b>Nagroda dnia czeka!</b><br><small>Dzień ${ls.next}/7 kalendarza logowań${ls.next === 7 ? ' – rzadki Rdzeń kwantowy!' : ''}</small></span>${ic('up', 'chev-r')}</a>`);
  if ((user.boost_until || 0) > now) out.push(`<div class="callout rare">${pi('core', 48)}<span class="grow"><b>${Q.CORE.name} aktywny</b><br><small>+${R.BOOST_BONUS * 100}% wydobycia jeszcze przez <span data-countdown="${user.boost_until}">${dur(user.boost_until - now)}</span></small></span></div>`);
  return out.join('');
}

export function colony({ user, st, flash, now = Date.now() }) {
  const have = { metal: st.stock.metal + st.pending.metal, crystal: st.stock.crystal + st.pending.crystal, energy: st.stock.energy + st.pending.energy };
  const xpPct = Math.round((user.xp / st.xpNeed) * 100);
  const pend = R.RES_KEYS.map((k) => `<div class="pend">
      ${resIcon(k, 40)}
      <b data-live-res data-v="${st.pending[k]}" data-rate="${(st.rates[k] / 60).toFixed(4)}" data-cap="${st.cap[k]}">${fmt(st.pending[k])}</b>
      <small>+${fmt(st.rates[k] * 60)}/h · maks. ${fmt(st.cap[k])}</small></div>`).join('');
  const perH = (v) => fmt(v * R.SPEED * 60);
  const blds = Object.entries(R.BUILDINGS).map(([id, b]) => {
    const lvl = user[b.col];
    const max = R.MAX_LEVEL_BUILDING;
    const effect = {
      mine: (l) => `${resIcon('metal', 16)}${perH(8 * l)}/h ${resIcon('crystal', 16)}${perH(3 * l)}/h`,
      power: (l) => `${resIcon('energy', 16)}${perH(5 * l)}/h`,
      shipyard: (l) => `moduły do poz. ${l * 2} · naprawa ${2 + l}%/min`,
      lab: (l) => `bonus bitewny +${(l - 1) * 10}%`,
    }[id];
    return upgradeCard({ action: `/kolonia/ulepsz/${id}`, icon: img('b_' + id, b.name, 'thumb', 64), name: b.name, desc: b.desc,
      lvl, max, effect: effect(lvl), next: lvl < max ? effect(lvl + 1) : '', cost: R.upgradeCost(b, lvl), have,
      block: lvl >= max ? { label: 'MAX', why: 'Osiągnięto maksymalny poziom' } : null, now, secs: R.buildTime(lvl), rushAction: '/kolonia/przyspiesz', tut: id === 'mine' ? 'build' : '',
      building: user.bq_id === id ? { until: user.bq_until, total: R.buildTime(lvl) } : null, busy: user.bq_id && user.bq_id !== id ? R.BUILDINGS[user.bq_id]?.name : null });
  }).join('');
  return layout({ title: 'Kolonia', user, st, flash, active: 'kolonia', body: `
  <section class="card colony banner" style="--bg:url('/img/hero.webp?v=${V}')">
    <div class="grow">
      <div class="muted small">Planeta</div><h2>${esc(user.planet)}</h2>
      <div class="muted small">Kolonia komandora <b>${esc(user.username)}</b></div>
      <div class="xp-row">${lvBadge(user.level, 'lg')}<div class="bar xp"><i style="width:${xpPct}%"></i><span>${pi('xp', 22, 'inl')} ${fmt(user.xp)} / ${fmt(st.xpNeed)} XP</span></div></div>
    </div>
  </section>
  ${colonyCallouts(user, st, now)}
  <section class="card">
    <div class="row"><h3>Magazyn wydobycia</h3><span class="muted small">pojemność: 2 h produkcji</span></div>
    <div class="pends">${pend}</div>
    <form method="post" action="/kolonia/zbierz"><button class="btn primary wide collect" data-tut="collect">${pi('collect', 34, 'btn-pi')} Zbierz surowce</button></form>
  </section>
  <section class="card"><h3 class="with-ic">${ic('colony', 'acc')} Budynki</h3><p class="muted small">Jedna budowa naraz. Rozpoczęcie budowy zbiera surowce z magazynu wydobycia.</p>${blds}</section>
  <section class="card"><h3 class="with-ic">${ic('users', 'acc')} Handel i społeczność</h3>
    <a class="callout market-cta" href="/rynek">${pi('market', 48)}<span class="grow"><b>Rynek surowców</b><br><small>Wymieniaj metal, kryształy i energię z innymi graczami</small></span>${ic('up', 'chev-r')}</a>
    <a class="callout invite-cta" href="/zaproszenia">${pi('invite', 48)}<span class="grow"><b>Zaproś znajomych</b><br><small>Nagrody dla Was obojga, gdy znajomy osiągnie poziom 5</small></span>${ic('up', 'chev-r')}</a>
    <a class="callout" href="/osiagniecia">${pi('achievement', 48)}<span class="grow"><b>Osiągnięcia i tytuły</b><br><small>Zdobywaj odznaczenia i tytuł przy nicku</small></span>${ic('up', 'chev-r')}</a>
  </section>
  <section class="card push-card" id="push-card">
    <div class="with-ic">${pi('bell', 56, 'float')}<div class="grow"><h3 style="margin:0">Powiadomienia</h3><small class="muted" data-push-status>Dowiedz się od razu, gdy ktoś Cię zaatakuje albo skończy się budowa.</small></div></div>
    <div class="push-btns"><button type="button" class="btn primary" data-push-toggle hidden>Włącz powiadomienia</button><button type="button" class="btn sm" data-push-test hidden>Wyślij test</button></div>
  </section>
  <div class="logout"><form method="post" action="/wyloguj"><button class="btn sm">${ic('logout')} Wyloguj</button></form></div>` });
}

export function ship({ user, st, flash, now = Date.now() }) {
  const cap = R.moduleCap(user);
  const base = R.shipStats(user);
  const modEff = {
    hull: (d) => `${ic('heart', 'hp-ic')} ${base.maxHp + 40 * d} HP`,
    guns: (d) => `${pi('guns', 16, 'inl')} atak ${base.atk + 6 * d}`,
    shields: (d) => `${pi('shields', 16, 'inl')} obrona ${base.def + 4 * d}`,
  };
  const mods = Object.entries(R.MODULES).map(([id, m]) => {
    const lvl = user[m.col];
    const capped = lvl >= cap;
    return upgradeCard({ action: `/statek/ulepsz/${id}`, icon: `<span class="mod-ic">${pi(id, 64, '', m.name)}</span>`, name: m.name, desc: m.desc,
      lvl, max: cap, effect: modEff[id](0), next: capped ? '' : modEff[id](1), cost: R.upgradeCost(m, lvl), have: st.stock,
      block: capped && user.mq_id !== id ? { label: 'Limit', why: 'Ulepsz stocznię, by podnieść limit' } : null, now, secs: R.moduleTime(lvl), rushAction: '/statek/przyspiesz', tut: id === 'guns' ? 'module' : '',
      building: user.mq_id === id ? { until: user.mq_until, total: R.moduleTime(lvl) } : null, busy: user.mq_id && user.mq_id !== id ? R.MODULES[user.mq_id]?.name : null });
  }).join('');
  return layout({ title: 'Statek', user, st, flash, active: 'statek', body: `
  <section class="card center ship-card" style="--shield:${Math.min(0.15 + user.s_shields * 0.07, 0.8).toFixed(2)}">
    <div class="ship-art">${img('ship', 'Twój statek', '', 320, true)}</div>
    <h2>Statek „${esc(user.username)}”</h2>
    ${hpBar(st)}
    <div class="stats">
      <div>${pi('guns', 40)}<b>${st.ship.atk}</b><small>Atak</small></div>
      <div>${pi('shields', 40)}<b>${st.ship.def}</b><small>Obrona</small></div>
      <div>${pi('repair', 40)}<b>${Math.round(st.ship.repair)}</b><small>HP/min</small></div>
      <div>${pi('power', 40)}<b>${st.ship.power}</b><small>Siła</small></div>
    </div>
  </section>
  ${expeditionCallout(user, now)}
  <section class="card"><h3 class="with-ic">${ic('ship', 'acc')} Moduły</h3><p class="muted small">Limit poziomu modułów: ${cap} (2 × poziom stoczni). Za surowce z magazynu głównego.</p>${mods}</section>` });
}

export function battle({ user, st, flash, targets, recent, now, arena }) {
  const enough = st.ship.hp >= st.ship.maxHp * R.MIN_HP_RATIO;
  const away = user.ex_until > now;
  const pir = R.PIRATES.map((p) => {
    const locked = user.level < p.minLvl;
    const e = R.pirate(p, user.level);
    return `<div class="item ${locked ? 'locked' : ''}">
      ${img('p_' + p.id, p.name, 'thumb', 64)}
      <div class="grow"><div class="row"><b>${p.name}</b>${locked ? `<span class="lock-tag">${ic('lock')} od poz. ${p.minLvl}</span>` : lvBadge(e.level, 'red')}</div>
        <div class="muted small">${p.desc}</div>
        ${locked ? '' : `<div class="eff stats-inl"><span>${ic('heart', 'hp-ic')}${e.hp}</span><span>${pi('guns', 18, 'inl')}${e.atk}</span><span>${pi('shields', 18, 'inl')}${e.def}</span></div>`}</div>
      <form method="post" action="/bitwa/piraci/${p.id}"><button class="btn sm ${locked ? '' : 'danger'}"${p.id === 'zwiadowca' ? ' data-tut="pve"' : ''} ${locked ? 'disabled' : ''}>${locked ? ic('lock') : ic('battle')}<span class="en">${resIcon('energy', 16)}${p.energy}</span></button></form>
    </div>`;
  }).join('');
  const tg = targets.length ? targets.map((t) => `<div class="item">
      <span class="avatar">${esc(t.username.slice(0, 1).toUpperCase())}</span>
      <div class="grow"><b>${esc(t.username)}</b> ${t.tag ? `<span class="corp">[${esc(t.tag)}]</span>` : ''}
        <div class="muted small">poz. ${t.level} · siła ${R.power(t)} · ${esc(t.planet)}</div></div>
      <form method="post" action="/bitwa/gracz/${t.id}"><button class="btn sm danger">${ic('battle')}<span class="en">${resIcon('energy', 16)}${R.PVP_ENERGY}</span></button></form>
    </div>`).join('') : '<p class="muted">Brak dostępnych celów w Twoim zasięgu.</p>';
  const rec = recent.length ? recent.map((b) => {
    const mine = b.attacker_id === user.id;
    const won = mine ? b.attacker_won : !b.attacker_won;
    const label = b.kind === 'pve' ? b.enemy_name : mine ? `atak na ${esc(b.defender_name)}` : `obrona przed ${esc(b.attacker_name)}`;
    return `<a class="item link" href="/bitwa/${b.id}">${pi(won ? 'trophy' : 'defeat', 40, 'res-ic', won ? 'Wygrana' : 'Porażka')}
      <span class="grow">${label}<br><small class="muted">${ago(b.created_at, now)}</small></span>${ic('up', 'chev-r')}</a>`;
  }).join('') : '<p class="muted">Jeszcze nie walczyłeś.</p>';
  return layout({ title: 'Bitwa', user, st, flash, active: 'bitwa', body: `
  <section class="card banner battle-banner" style="--bg:url('/img/battle_bg.webp?v=${V}')"><h2>Centrum dowodzenia</h2>${hpBar(st)}
    ${away ? `<p class="warn small with-ic">${pi('expedition', 26)} Statek jest na ekspedycji – wróci za <b data-countdown="${user.ex_until}" data-reload>${dur(user.ex_until - now)}</b>. Bitwy niedostępne.</p>` : ''}
    ${enough ? '' : `<p class="warn small">Statek jest zbyt uszkodzony (min. ${R.MIN_HP_RATIO * 100}% HP). Poczekaj na naprawę.</p>`}</section>
  ${arena ? `<a class="callout arena-cta" href="/arena">${pi('arena', 56)}<span class="grow"><b>Arena – turniej o ${clockHM(arena.next)}</b><br><small class="muted">${arena.joined ? 'Jesteś zapisany ✓' : 'Zapisy otwarte'} · ${arena.n} ${plural(arena.n, 'gracz', 'graczy', 'graczy')} · start za <b data-countdown="${arena.next}">${dur(arena.next - now)}</b></small></span>${ic('up', 'chev-r')}</a>` : ''}
  <section class="card"><h3 class="with-ic">${pi('defeat', 30)} Piraci</h3>${pir}</section>
  <section class="card"><h3 class="with-ic">${pi('pvp', 30)} Inni gracze</h3><p class="muted small">Wygrana = łup 10% metalu i kryształów rywala. Zaatakowany gracz dostaje 15 min ochrony.</p>${tg}</section>
  <section class="card"><h3 class="with-ic">${ic('log', 'acc')} Ostatnie bitwy</h3>${rec}</section>` });
}

export function battleLog({ user, st, flash, b, now }) {
  const mine = b.attacker_id === user.id;
  const won = mine ? b.attacker_won : !b.attacker_won;
  const log = JSON.parse(b.log);
  const rw = JSON.parse(b.reward);
  const rewardLine = [rw.xp ? `<span>${pi('xp', 22, 'inl')}+${rw.xp} XP</span>` : '', rw.metal ? `<span>${resIcon('metal', 20)}${rw.metal}</span>` : '',
    rw.crystal ? `<span>${resIcon('crystal', 20)}${rw.crystal}</span>` : '', rw.levelUp ? `<span class="lvup">${pi('power', 22, 'inl')}Awans na poziom ${rw.levelUp}!</span>` : ''].filter(Boolean).join('');
  const again = b.kind === 'pve' && mine ? `<form method="post" action="/bitwa/piraci/${esc(rw.tier)}"><button class="btn danger wide">${ic('battle')} Walcz ponownie</button></form>` : '';
  return layout({ title: 'Raport z bitwy', user, st, flash, active: 'bitwa', body: `
  <section class="card center result banner ${won ? 'win' : 'lose'}" style="--bg:url('/img/battle_bg.webp?v=${V}')">
    ${b.kind === 'pve' && rw.tier ? img('p_' + rw.tier, b.enemy_name, 'enemy', 120, true) : pi(won ? 'trophy' : 'defeat', 120, 'big-ic')}
    <h2>${won ? 'ZWYCIĘSTWO' : 'PORAŻKA'}</h2>
    <p>${esc(b.attacker_name)} <span class="muted">vs</span> ${esc(b.kind === 'pve' ? b.enemy_name : b.defender_name)}</p>
    ${mine && rewardLine ? `<p class="reward">${rewardLine}</p>` : ''}
    <p class="muted small">${ago(b.created_at, now)}</p>
  </section>
  <section class="card"><h3>Przebieg</h3><ol class="log">${log.map((l) => `<li class="${l.side}"><span class="r">R${l.r}</span>${emo(esc(l.t))}</li>`).join('')}</ol></section>
  <section class="card">${again}<a class="btn wide" href="/bitwa">${ic('login', 'flip')} Wróć</a></section>` });
}

export function ranking({ user, st, flash, tab, rows, myRank }) {
  const tabs = [['gracze', 'Poziom', 'xp'], ['pvp', 'PvP', 'pvp'], ['korporacje', 'Korpo', 'corp']];
  const head = `<div class="seg">${tabs.map(([id, l, icn]) => `<a href="/ranking?tab=${id}" class="${tab === id ? 'on' : ''}">${pi(icn, 22, 'inl')}${l}</a>`).join('')}<a href="/sezon/ranking">${pi('season', 22, 'inl')}Sezon</a></div>`;
  let body;
  if (tab === 'korporacje') {
    body = rows.map((c, i) => `<div class="item rank"><span class="pos">${i + 1}</span><span class="grow"><b>${esc(c.name)}</b> <span class="corp">[${esc(c.tag)}]</span>
      <br><small class="muted">${c.members} członków</small></span><b class="pts">${pi('power', 20, 'inl')}${fmt(c.power)}</b></div>`).join('');
  } else {
    body = rows.map((r, i) => `<div class="item rank ${r.id === user.id ? 'me' : ''}"><span class="pos">${i + 1}</span>
      <span class="grow"><b>${esc(r.username)}</b>${ttl(r.title)} ${r.tag ? `<span class="corp">[${esc(r.tag)}]</span>` : ''}<br>
      <small class="muted">${tab === 'pvp' ? `${r.pvp_wins} W / ${r.pvp_losses} P` : `${fmt(r.xp)} XP · ${r.pve_wins} piratów`}</small></span>
      ${tab === 'pvp' ? `<b class="pts">${pi('pvp', 20, 'inl')}${r.pvp_points}</b>` : lvBadge(r.level)}</div>`).join('');
  }
  return layout({ title: 'Ranking', user, st, flash, active: 'ranking', body: `
  <section class="card">${head}${myRank ? `<p class="muted small">Twoja pozycja: <b>#${myRank}</b></p>` : ''}
  ${body || '<p class="muted">Pusto.</p>'}</section>` });
}

export function notFound({ user, st }) {
  return layout({ title: 'Nie znaleziono', user, st, body: `<section class="card center"><div class="huge">${ic('hole', 'acc')}</div><h2>Czarna dziura</h2><p>Tej strony nie ma w tym sektorze.</p><a class="btn" href="/">Wróć</a></section>` });
}

export function missions({ user, st, flash, qs, resetIn, weekIn, now, season }) {
  const ls = qs.login;
  const days = Q.LOGIN_REWARDS.map((r0, i) => {
    const d = i + 1, r = Q.scale(r0, user.level);
    const done = d <= ls.doneUpTo, today = !ls.claimedToday && d === ls.next;
    const main = r.core ? pi('core', 40) : r.metal ? resIcon('metal', 34) : r.crystal ? resIcon('crystal', 34) : resIcon('energy', 34);
    const amount = r.core ? 'Rdzeń' : fmt(r.metal || r.crystal || r.energy);
    return `<div class="day${done ? ' done' : ''}${today ? ' today' : ''}${d === 7 ? ' rare' : ''}" title="${esc(Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', '))}">
      <small>Dzień ${d}</small>${main}<b>${amount}</b>${done ? `<span class="ok">${ic('check')}</span>` : ''}</div>`;
  }).join('');
  const nextR = Q.scale(Q.LOGIN_REWARDS[ls.next - 1], user.level);
  const claim = ls.claimedToday
    ? `<button class="btn wide" disabled>${ic('check')} Odebrano – kolejna nagroda za <span data-countdown="${now + resetIn}">${dur(resetIn)}</span></button>`
    : `<form method="post" action="/misje/logowanie"><button class="btn cta wide" data-tut="daily">${ic('gift')} Odbierz dzień ${ls.next}</button></form>
       <div class="center small muted" style="margin-top:6px">W nagrodzie: ${rewardChips(nextR, 16)}</div>`;
  const qRow = (q) => {
    const pct = Math.round((q.progress / q.goal) * 100);
    const btn = q.claimed ? `<span class="q-done">${ic('check')}</span>`
      : q.done ? `<form method="post" action="/misje/odbierz/${q.id}"><button class="btn sm primary claim">Odbierz</button></form>`
      : `<span class="q-cnt">${fmt(q.progress)}/${fmt(q.goal)}</span>`;
    return `<div class="quest${q.claimed ? ' claimed' : q.done ? ' ready' : ''}">${qIcon(q.icon)}
      <div class="grow"><b>${q.name}</b><div class="prog"><i style="width:${pct}%"></i></div>${rewardChips(q.r, 15)}</div>${btn}</div>`;
  };
  const maxPts = Q.CHESTS[Q.CHESTS.length - 1].pts;
  const chests = qs.chests.map((c) => `<div class="chest t${c.n}${c.claimed ? ' opened' : c.ready ? ' ready' : ''}" style="left:${(c.pts / maxPts) * 100}%">
      ${pi('chest', 54)}<small>${c.pts} pkt</small></div>`).join('');
  const chestList = qs.chests.map((c) => `<div class="quest${c.claimed ? ' claimed' : c.ready ? ' ready' : ''}"><span class="chest-ic t${c.n}">${pi('chest', 44)}</span>
      <div class="grow"><b>${c.name}</b> <small class="muted">· ${c.pts} pkt</small><br>${rewardChips(c.r, 15)}</div>
      ${c.claimed ? `<span class="q-done">${ic('check')}</span>` : c.ready ? `<form method="post" action="/misje/skrzynia/${c.n}"><button class="btn sm primary claim">Otwórz</button></form>` : `<span class="q-cnt">${ic('lock')}</span>`}</div>`).join('');
  const sc = season ? `<a class="callout season" href="/sezon">${pi('season', 52)}<span class="grow"><b>Przepustka sezonowa · poziom ${season.level}/30</b><br>
    <small>${season.claimable ? `<b class="ok-t">${season.claimable} ${plural(season.claimable, 'nagroda', 'nagrody', 'nagród')} do odebrania!</b>` : `${season.inLevel}/${season.need} XP do kolejnego poziomu`}</small>
    <span class="mini-bar"><i style="width:${season.max ? 100 : Math.round(season.inLevel / season.need * 100)}%"></i></span></span>${ic('up', 'chev-r')}</a>` : '';
  return layout({ title: 'Misje', user, st, flash, active: 'misje', body: `
  ${sc}
  <section class="card daily-card">
    <div class="with-ic">${pi('daily', 52)}<div class="grow"><h2 style="margin:0">Nagroda dnia</h2>
      <small class="muted">Seria: <b>${ls.streak}</b> ${ls.streak === 1 ? 'dzień' : 'dni'} z rzędu · co 7. dzień rzadki przedmiot</small></div></div>
    ${ls.broken ? '<p class="warn small">Seria przerwana – pominięto dzień, kalendarz zaczyna się od nowa.</p>' : ''}
    <div class="cal">${days}</div>
    ${claim}
  </section>
  <section class="card">
    <div class="row"><h3 class="with-ic">${pi('quest', 30)} Misje dzienne</h3><span class="timer">${ic('clock')} <span data-countdown="${now + resetIn}">${dur(resetIn)}</span></span></div>
    ${qs.daily.map(qRow).join('')}
    <p class="muted small">Każda misja dzienna: +${Q.POINTS.daily} pkt do skrzyni tygodniowej. Reset o północy (czas polski).</p>
  </section>
  <section class="card">
    <div class="row"><h3 class="with-ic">${pi('chest', 30)} Skrzynia tygodnia</h3><span class="timer">${ic('clock')} ${dur(weekIn)}</span></div>
    <div class="pts-track"><div class="prog big"><i style="width:${Math.min(100, (qs.points / maxPts) * 100)}%"></i></div>${chests}</div>
    <p class="center"><b class="pts-big">${qs.points}</b> <span class="muted">/ ${maxPts} pkt misji</span></p>
    ${chestList}
  </section>
  <section class="card">
    <h3 class="with-ic">${pi('trophy', 30)} Misje tygodniowe</h3>
    ${qs.weekly.map(qRow).join('')}
    <p class="muted small">Każda misja tygodniowa: +${Q.POINTS.weekly} pkt. Reset w poniedziałek o północy.</p>
  </section>` });
}

