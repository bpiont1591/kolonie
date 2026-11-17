// Widoki etapu v6/2: kampania fabularna.
import { layout, esc, fmt, img, rewardChips } from './views.js';
import { pi, ic } from './icons.js';
import * as CA from './campaign.js';
import * as P from './progression.js';
import * as R from './rules.js';

export const starsHtml = (n, max = 3, cls = '') => `<span class="strs ${cls}">${Array.from({ length: max }, (_, i) => ic(i < n ? 'starf' : 'star', i < n ? 'on' : '')).join('')}</span>`;
const powerOf = (e) => Math.round(e.maxHp / 4 + e.atk * 2 + e.def * 2);
const relicCard = (id, have) => { const r = P.RELICS[id]; return `<div class="relic${have ? ' have' : ''}">${ic('starf', 'acc')}<div><b>${r.name}</b><br><small class="muted">${r.desc}</small></div>${have ? `<small class="t-ok">${ic('check')} masz</small>` : ''}</div>`; };

export function overview({ user, st, flash, prog }) {
  const owned = P.relicList(user);
  const total = prog.reduce((a, c) => a + c.stars, 0), hardTotal = prog.reduce((a, c) => a + c.hard.stars, 0);
  const cards = prog.map((c) => {
    const lockTxt = !c.prevBoss ? `Pokonaj bossa rozdziału ${c.n - 1}` : `Od poziomu ${c.minLvl}`;
    return `<a class="chap-card${c.unlocked ? '' : ' locked'}${c.done ? ' done' : ''}" href="/kampania/${c.n}">
      <div class="chap-art">${img(`pl_${c.n}`, c.planet, '', 360)}</div>
      <div class="chap-body"><small class="tut-k">Rozdział ${c.n} · ${esc(c.planet)}</small><h3>${c.title}</h3>
        ${c.unlocked ? `<div class="chap-prog">${starsHtml(Math.round((c.stars / CA.STARS_MAX) * 3))}<span><b>${c.stars}</b>/${CA.STARS_MAX}★</span>${c.done ? `<span class="t-ok">${ic('check')} boss pokonany</span>` : ''}</div>${c.hard.unlocked ? `<div class="chap-prog hardtag">${ic('starf', 'hard-ic')}<span>Trudny: <b>${c.hard.stars}</b>/${CA.STARS_MAX}★</span>${c.hard.done ? `<span class="t-ok">${ic('check')} boss</span>` : ''}</div>` : ''}`
          : `<small class="muted">${ic('lock')} ${lockTxt}</small>`}
      </div>${ic('up', 'chev-r')}</a>`;
  }).join('');
  return layout({ title: 'Kampania', user, st, flash, active: 'bitwa', body: `
  <section class="card camp-hero" style="--bg:url('/img/pl_5.webp')"><small class="tut-k">Kampania fabularna</small><h2>Sygnał z Otchłani</h2>
    <p class="small">Dziesięć planet, pięćdziesiąt misji i dziesięciu bossów strzegących unikalnych łupów. Po zdobyciu 15★ w rozdziale odblokujesz jego <b>tryb trudny</b> – silniejsi wrogowie, lepsze łupy i większa szansa na moduły specjalne. Każda misja zużywa ⚡ energię z magazynu.</p>
    <div class="chap-prog">${ic('starf', 'acc')}<span>Łącznie <b>${total}</b>/${CA.STARS_MAX * CA.CHAPTERS.length}★</span>${hardTotal ? `<span class="hardtag">${ic('starf', 'hard-ic')} trudny: <b>${hardTotal}</b>★</span>` : ''}</div></section>
  <div class="chap-list">${cards}</div>
  <section class="card"><h3 class="with-ic">${ic('starf', 'acc')} Trofea bossów <small class="muted">${CA.CHAPTERS.filter((c) => owned.includes(c.boss.relic)).length}/${CA.CHAPTERS.length}</small></h3>
    <p class="muted small">Trwałe premie dla Twojego statku – zdobywane za pierwsze pokonanie bossa rozdziału.</p>
    <div class="relics">${CA.CHAPTERS.map((c) => relicCard(c.boss.relic, owned.includes(c.boss.relic))).join('')}</div></section>
  <a class="btn wide" href="/bitwa">${ic('login', 'flip')} Wróć do bitew</a>` });
}

export function chapter({ user, st, flash, ch: ch0, now, hard: wantHard }) {
  const hard = !!wantHard;
  const ch = hard ? { ...ch0, ms: ch0.hard.ms, stars: ch0.hard.stars, chest: ch0.hard.chest, unlocked: ch0.hard.unlocked } : ch0;
  const q = hard ? '?tryb=trudny' : '';
  const myPower = R.power(user), hp = R.currentHp(user, now), maxHp = R.shipStats(user).maxHp;
  const node = (m) => {
    const ep = powerOf(m.enemy), diff = ep > myPower * 1.15 ? 'hard' : ep < myPower * 0.85 ? 'easy' : 'even';
    const btn = !ch.unlocked || !m.open ? `<button class="btn wide" disabled>${ic('lock')} Zablokowana</button>`
      : `<form method="post" action="/kampania/walcz/${m.id}"><button class="btn ${m.boss ? 'danger' : 'primary'} wide">${ic('battle')} ${m.wins ? 'Powtórz' : 'Walcz'} · ⚡${m.energy}</button></form>`;
    if (m.boss) return `<article class="boss-node${m.open ? '' : ' locked'}${m.stars ? ' beaten' : ''}">
      <div class="boss-art">${img(`cb_${ch.n}`, ch.boss.name, '', 400)}<span class="boss-tag">BOSS</span></div>
      <div class="cls-body"><small class="tut-k">Misja ${m.id}</small><h3>${ch.boss.name}</h3><p class="small muted">${m.story}</p>
      <div class="mnode-meta">${starsHtml(m.stars)}<span class="pw ${diff}">${pi('power', 18, 'inl')}${ep} <small>vs ${myPower}</small></span></div>
      ${hard ? `<div class="relic hardloot">${ic('gem', 'acc')}<div><b>Moduł specjalny</b><br><small class="muted">pierwsze zwycięstwo: 100%, potem 60% · epicki 40%, legendarny 15%</small></div></div>`
        : `<small class="muted">Unikalny łup (za pierwsze zwycięstwo):</small>${relicCard(ch.boss.relic, P.relicList(user).includes(ch.boss.relic))}`}
      ${btn}</div></article>`;
    return `<article class="mnode${m.open ? '' : ' locked'}${m.stars ? ' cleared' : ''}"><span class="mnum">${m.m}</span>
      <div class="grow"><b>${m.name}</b><p class="small muted">${m.story}</p>
      <div class="mnode-meta">${starsHtml(m.stars)}<span class="pw ${diff}">${pi('power', 18, 'inl')}${ep} <small>vs ${myPower}</small></span></div>${btn}</div></article>`;
  };
  const chest = CA.CHEST(ch.n, hard);
  const modeNav = `<div class="seg modes"><a href="/kampania/${ch.n}" class="${hard ? '' : 'on'}">Normalny · ${ch0.stars}/${CA.STARS_MAX}★</a>${ch0.hard.unlocked ? `<a href="/kampania/${ch.n}?tryb=trudny" class="${hard ? 'on' : ''} hardmode-tab">${ic('starf', 'hard-ic')} Trudny · ${ch0.hard.stars}/${CA.STARS_MAX}★</a>` : `<span class="off">${ic('lock')} Trudny – po ${CA.STARS_MAX}★</span>`}</div>`;
  return layout({ title: `Kampania – ${ch.title}${hard ? ' (trudny)' : ''}`, user, st, flash, active: 'bitwa', bodyClass: hard ? 'hardmode' : '', body: `
  <section class="card chap-head" style="--bg:url('/img/pl_${ch.n}.webp')"><div class="chap-head-in">
    <small class="tut-k">Rozdział ${ch.n} · ${esc(ch.planet)}${hard ? ' · TRYB TRUDNY' : ''}</small><h2>${ch.title}</h2><p class="small">${hard ? 'Echo tej samej historii – ale wrogowie są silniejsi o 60%, mają 3 poziomy więcej i trafiają celniej. W zamian: podwójne łupy, osobne gwiazdki i moduły specjalne.' : ch.intro}</p>
    <div class="chap-prog">${ic('starf', 'acc')}<span><b>${ch.stars}</b>/${CA.STARS_MAX}★</span><span>${ic('heart', 'hp-ic')}${hp}/${maxHp} HP</span><span>⚡${fmt(user.energy)}</span></div></div></section>
  ${modeNav}
  ${ch.unlocked ? '' : `<p class="warn small">${ic('lock')} ${hard ? `Tryb trudny odblokujesz po zdobyciu ${CA.STARS_MAX}★ w trybie normalnym.` : ch.prevBoss ? `Rozdział dostępny od poziomu ${ch.minLvl}.` : `Najpierw pokonaj bossa rozdziału ${ch.n - 1}.`}</p>`}
  <p class="muted small center">Gwiazdki: ★ wygrana · ★★ ≥30% HP · ★★★ ≥60% HP po walce (z bossem progi niższe).</p>
  <div class="mpath">${ch.ms.map(node).join('<i class="mlink"></i>')}</div>
  <section class="card chest-card${ch.chest ? ' opened' : ''}"><h3 class="with-ic">${pi('chest', 30)} Skrzynia rozdziału${hard ? ' (trudny)' : ''}</h3>
    <p class="muted small">Zdobądź wszystkie ${CA.STARS_MAX}★ w tym rozdziale${hard ? ' w trybie trudnym – w środku także gwarantowany moduł specjalny' : ''}.</p>${rewardChips(chest)}
    ${ch.chest ? `<span class="t-ok">${ic('check')} odebrana</span>` : `<form method="post" action="/kampania/skrzynia/${ch.n}${q}"><button class="btn-claim" ${ch.stars >= CA.STARS_MAX ? '' : 'disabled'}>Otwórz (${ch.stars}/${CA.STARS_MAX}★)</button></form>`}</section>
  <div class="duo"><a class="btn wide" href="/kampania">${ic('login', 'flip')} Rozdziały</a>${CA.CHAPTERS[ch.n] ? `<a class="btn wide" href="/kampania/${ch.n + 1}${q}">Rozdział ${ch.n + 1} ${ic('up', 'chev-r')}</a>` : ''}</div>` });
}
