// v7/2: widok modułów specjalnych (sloty, ładownia, ulepszanie, rozbiór).
import { layout, esc, fmt, costHtml } from './views.js';
import { ic } from './icons.js';
import { V } from './icons.js';
import * as GE from './gear.js';
import { modChips } from './views-fleet.js';

/** Ikona modułu ze sprite'a (4×3) w ramce koloru rzadkości. */
export const gearIcon = (def, rarity, size = 56) => {
  const d = GE.BY_ID[def], i = d ? d.sprite : 0;
  return `<span class="gsp r${rarity}" style="--s:${size}px;background-image:url(/img/gear.webp?v=${V});background-position:${(i % 4) * 33.333}% ${Math.floor(i / 4) * 50}%" role="img" aria-label="${esc(d?.name || def)}"></span>`;
};
const rtag = (r) => `<span class="rtag r${r}">${GE.RARITY[r].name}</span>`;

export function gear({ user, st, flash, items, sel }) {
  const n = GE.slotCount(user), eq = items.filter((i) => i.slot > 0);
  const slots = GE.SLOT_LVLS.map((lvl, k) => {
    const s = k + 1, it = eq.find((e) => e.slot === s);
    if (s > n) return `<div class="gslot locked">${ic('lock')}<b>Slot ${s}</b><small class="muted">od poziomu ${lvl}</small></div>`;
    if (!it) return `<div class="gslot empty"><span class="gsp empty"></span><b>Slot ${s}</b><small class="muted">pusty</small></div>`;
    return `<div class="gslot r${it.rarity}">${gearIcon(it.def, it.rarity, 64)}<b>${GE.BY_ID[it.def].name}${it.level > 1 ? ` +${it.level - 1}` : ''}</b>${rtag(it.rarity)}<small>${GE.effectText(it.def, it.rarity, it.level)}</small>
      <form method="post" action="/moduly/zdejmij/${it.id}"><button class="btn-claim ghost">Zdejmij</button></form></div>`;
  }).join('');
  const sum = {};
  for (const it of eq.filter((e) => e.slot <= n)) for (const [k, v] of Object.entries(GE.effect(it.def, it.rarity, it.level))) sum[k] = (sum[k] || 0) + v;
  const free = n - eq.filter((e) => e.slot <= n).length;
  const cards = items.map((it) => {
    const d = GE.BY_ID[it.def];
    if (!d) return '';
    const up = it.level < GE.MAX_LEVEL ? GE.upgradeCost(it.rarity, it.level) : null, sv = GE.salvage(it.rarity, it.level);
    const equip = it.slot ? `<span class="t-ok small">${ic('check')} w slocie ${it.slot}</span>`
      : !n ? `<small class="muted">${ic('lock')} slot od poz. ${GE.SLOT_LVLS[0]}</small>`
      : free > 0 ? `<form method="post" action="/moduly/zaloz/${it.id}"><button class="btn-claim">Załóż</button></form>`
      : `<span class="swap">${Array.from({ length: n }, (_, k) => `<form method="post" action="/moduly/zaloz/${it.id}"><input type="hidden" name="slot" value="${k + 1}"><button class="btn-claim ghost">→ slot ${k + 1}</button></form>`).join('')}</span>`;
    return `<article class="gcard r${it.rarity}${sel === it.id ? ' sel' : ''}" id="m${it.id}">${gearIcon(it.def, it.rarity)}
      <div class="grow"><b>${d.name}${it.level > 1 ? ` <span class="glvl">+${it.level - 1}</span>` : ''}</b> ${rtag(it.rarity)}
        <div class="small">${GE.effectText(it.def, it.rarity, it.level)}${up ? ` <span class="muted">→ ${GE.effectText(it.def, it.rarity, it.level + 1).split(' ')[0]}</span>` : ''}</div>
        <div class="gact">${equip}
          ${up ? `<form method="post" action="/moduly/ulepsz/${it.id}"><button class="btn-claim">${ic('up')} Ulepsz <span class="costs">${costHtml(up, st.stock || user)}</span></button></form>` : '<small class="t-ok">poziom maks.</small>'}
          ${it.slot ? '' : `<form method="post" action="/moduly/rozbierz/${it.id}" onsubmit="return confirm('Rozebrać ${esc(GE.label(it))}? Odzyskasz ${fmt(sv.metal)} metalu i ${fmt(sv.crystal)} kryształów.')"><button class="btn-claim ghost danger">Rozbierz · ${costHtml(sv)}</button></form>`}</div></div></article>`;
  }).join('');
  const src = Object.values(GE.SOURCES).map((s) => `<li><b>${s.name}</b> – ${Math.round(s.chance * 100)}%${s.firstChance ? ' (pierwsze zwycięstwo: 100%)' : ''} · <span class="rtag r1">${s.w[0]}%</span> <span class="rtag r2">${s.w[1]}%</span> <span class="rtag r3">${s.w[2]}%</span></li>`).join('');
  return layout({ title: 'Moduły specjalne', user, st, flash, active: 'statek', body: `
  <section class="card arena-head"><span class="big-glyph">${ic('gem', 'acc')}</span><div class="grow"><small class="tut-k">Stocznia</small><h2>Moduły specjalne</h2>
    <small class="muted">Rzadkie łupy z bossów. Sloty odblokowujesz na poziomach ${GE.SLOT_LVLS.join(', ')}. Moduły ulepszysz do +${GE.MAX_LEVEL - 1} albo rozbierzesz na surowce.</small></div></section>
  <div class="gslots">${slots}</div>
  ${Object.keys(sum).length ? `<div class="mchips own">${modChips(sum)}</div>` : ''}
  <section class="card"><h3 class="with-ic">${ic('gift', 'acc')} Ładownia <small class="muted">${items.length}/${GE.MAX_ITEMS}</small></h3>
    ${cards ? `<div class="glist">${cards}</div>` : `<p class="muted">Brak modułów. Pokonaj bossa kampanii, bossa rajdowego korporacji albo pomóż odeprzeć inwazję obcych.</p>`}</section>
  <section class="card"><h3 class="with-ic">${ic('starf', 'acc')} Skąd brać moduły</h3><ul class="small gsrc">${src}</ul>
    <p class="muted small">Epickie i legendarne moduły mogą mieć unikalne efekty: <b>Syfon próżni</b> (leczy część zadanych obrażeń) i <b>Pryzmat odbicia</b> (odbija część otrzymanych). Dwa takie same moduły nie sumują się.</p></section>
  <a class="btn wide" href="/statek">${ic('login', 'flip')} Wróć do statku</a>` });
}
