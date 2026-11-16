// Widoki etapu v6/1: wybór klasy statku i drzewko technologii.
import { layout, esc, fmt, costHtml, img } from './views.js';
import { pi, ic } from './icons.js';
import * as P from './progression.js';
import * as R from './rules.js';
import { dur } from './time.js';

const pct = (v) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;
const MOD_LABEL = { hp: 'HP', atk: 'atak', def: 'obrona', crit: 'krytyk', dodge: 'unik', shield: 'tarcza (maks. HP)', repair: 'naprawa', prod: 'wydobycie', storage: 'magazyn', xp: 'XP', pveLoot: 'łupy PvE', pvpLoot: 'łupy PvP', expLoot: 'łupy z ekspedycji' };
export const modChips = (m) => Object.entries(m).filter(([, v]) => v).map(([k, v]) => `<span class="mchip ${v > 0 ? 'up' : 'down'}">${pct(v)} ${MOD_LABEL[k] || k}</span>`).join('');
export const classBadge = (u) => (P.CLASSES[u.ship_class] ? `<span class="cls-badge">${ic(P.CLASSES[u.ship_class].icon)}${P.CLASSES[u.ship_class].name}</span>` : '');

export function classes({ user, st, flash, cs, now }) {
  const cards = P.CLASS_IDS.map((id) => {
    const c = P.CLASSES[id], cur = cs.current === id;
    const s = R.shipStats({ ...user, ship_class: id });
    const btn = cur ? `<span class="btn wide on-cls">${ic('check')} Twoja klasa</span>`
      : cs.locked ? `<button class="btn wide" disabled>${ic('lock')} Po samouczku</button>`
      : cs.cdLeft ? `<button class="btn wide" disabled>${ic('clock')} za ${dur(cs.cdLeft)}</button>`
      : `<form method="post" action="/statek/klasa/${id}"><button class="btn ${cs.first ? 'cta' : 'primary'} wide">${cs.first ? 'Wybierz' : `Przebuduj · 💎${fmt(cs.cost.crystal)}`}</button></form>`;
    return `<article class="cls-card${cur ? ' cur' : ''}">
      <div class="cls-art">${img(`cls_${id}`, c.name, '', 400)}<span class="cls-role">${ic(c.icon)} ${c.role}</span></div>
      <div class="cls-body"><h3>${c.name}</h3><p class="small muted">${c.desc}</p><div class="mchips">${modChips(c.m)}</div>
      <div class="cls-stats"><span>${ic('heart', 'hp-ic')}${s.maxHp}</span><span>${pi('guns', 18, 'inl')}${s.atk}</span><span>${pi('shields', 18, 'inl')}${s.def}</span><span>${pi('power', 18, 'inl')}${R.power({ ...user, ship_class: id })}</span></div>
      ${btn}</div></article>`;
  }).join('');
  return layout({ title: 'Klasa statku', user, st, flash, active: 'statek', body: `
  <section class="card arena-head"><span class="big-glyph">${ic('ship', 'acc')}</span><div class="grow"><small class="tut-k">Stocznia</small><h2>Klasa statku</h2>
    <small class="muted">${cs.first ? 'Pierwszy wybór jest darmowy. Klasa wpływa na walki z piratami, graczami i na arenie.' : `Zmiana klasy: 💎${fmt(cs.cost.crystal)}, nie częściej niż raz na 24 h. Moduły i technologie zostają.`}</small></div></section>
  ${cs.locked ? `<p class="warn small">${ic('lock')} Klasę wybierzesz po ukończeniu (albo pominięciu) samouczka.</p>` : ''}
  <div class="cls-grid">${cards}</div>
  <a class="btn wide" href="/statek">${ic('login', 'flip')} Wróć do statku</a>` });
}

export function research({ user, st, flash, now }) {
  const have = new Set(P.techList(user));
  const free = P.rpFree(user), total = P.rpTotal(user);
  const col = (b) => P.TECH.filter((n) => n.branch === b.id).map((n) => {
    const done = have.has(n.id), running = user.rq_id === n.id;
    const why = done || running ? null : P.canResearch(user, n);
    const state = done ? 'done' : running ? 'run' : why ? 'locked' : 'ready';
    const c = P.researchCost(n), ms = Math.round((P.TIER_MIN[n.tier] * 60_000) / R.SPEED);
    const act = done ? `<small class="t-ok">${ic('check')} zbadane</small>`
      : running ? `<div class="bar sm"><i style="width:${Math.max(3, Math.round(100 - ((user.rq_until - now) / ms) * 100))}%"></i><span data-countdown="${user.rq_until}" data-reload>${dur(user.rq_until - now)}</span></div>
        <form method="post" action="/badania/przyspiesz"><button class="btn-claim">Przyspiesz · 💎${R.rushCost(user.rq_until - now)}</button></form>`
      : why ? `<small class="muted">${esc(why)}</small>`
      : `<div class="costs">${costHtml(c, user)}</div><form method="post" action="/badania/start/${n.id}"><button class="btn-claim">Badaj · ${P.TIER_RP[n.tier]} PB · ${dur(ms)}</button></form>`;
    return `<div class="tnode ${state}"><span class="tier">${['', 'I', 'II', 'III', 'IV'][n.tier]}</span>
      <div class="grow"><b>${n.name}</b><br><small class="muted">${n.desc}</small><div class="tact">${act}</div></div></div>`;
  }).join('<i class="tlink"></i>');
  const branches = P.BRANCHES.map((b) => `<section class="card tbranch"><h3 class="with-ic">${ic(b.icon, 'acc')} ${b.name}</h3>${col(b)}</section>`).join('');
  const spent = P.rpSpent(user), rc = P.resetCost(spent);
  return layout({ title: 'Badania', user, st, flash, active: 'statek', body: `
  <section class="card arena-head research-head"><span class="big-glyph">${ic('flask', 'acc')}</span><div class="grow"><small class="tut-k">Laboratorium</small><h2>Drzewko technologii</h2>
    <small class="muted">Punkty badawcze: <b>${free}</b> wolnych z ${total} · 1 PB za poziom gracza, 2 PB za poziom laboratorium</small>
    <div class="bar sm"><i style="width:${total ? Math.round(((total - free) / total) * 100) : 0}%"></i></div></div></section>
  <div class="mchips own">${modChips(P.mods(user))}</div>
  <div class="tree">${branches}</div>
  <section class="card"><h3 class="with-ic">${ic('reset', 'acc')} Reset drzewka</h3><p class="muted small">Zwraca wszystkie punkty badawcze (również z trwającego badania). Surowce wydane na badania przepadają.</p>
    <form method="post" action="/badania/reset" onsubmit="return confirm('Zresetować całe drzewko technologii?')"><button class="btn wide" ${spent ? '' : 'disabled'}>${ic('reset')} Resetuj · 💎${fmt(rc.crystal)}</button></form></section>` });
}
