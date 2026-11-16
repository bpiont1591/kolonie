// Widoki etapu v6/3: wydarzenia czasowe.
import { layout, esc, fmt, img, rewardChips } from './views.js';
import { pi, ic, V } from './icons.js';
import * as EV from './events.js';
import { dur, clockHM } from './time.js';

const dfmt = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'long', day: 'numeric', month: 'long' });
const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

export function events({ user, st, flash, now, evs, inv, myPoints, top, claims, upcoming }) {
  const card = (e) => {
    const k = EV.KINDS[e.kind];
    const invBody = e.kind === 'inwazja' ? `
      <div class="ev-goal"><div class="bar ev-prog"><i style="width:${pct(e.progress, e.goal)}%"></i><span>${fmt(e.progress)} / ${fmt(e.goal)} pkt serwera</span></div>
      <small class="muted">${e.progress >= e.goal ? '✅ Cel osiągnięty – sektor obroniony! Walcz dalej o miejsce w rankingu.' : `Twój wkład: <b>${myPoints}</b> pkt · nagroda od ${EV.MIN_POINTS} pkt`}</small></div>
      <form method="post" action="/wydarzenia/walcz"><button class="btn danger wide">${ic('battle')} Walcz z najeźdźcą · ⚡${EV.XENO.energy}</button></form>
      <div class="ev-pts">${[['Najeźdźca', EV.POINTS.xeno], ['Boss kampanii', EV.POINTS.boss], ['Ekspedycja', EV.POINTS.expedition], ['Misja kampanii', EV.POINTS.campaign], ['Atak na gracza', EV.POINTS.pvp], ['Piraci', EV.POINTS.pirate]].map(([l, p]) => `<span class="chip">${l} <b>+${p}</b></span>`).join('')}</div>
      ${top.length ? `<h4>Najwięksi obrońcy</h4><ol class="ev-top">${top.map((x, i) => `<li${x.username === user.username ? ' class="me"' : ''}><span>${i + 1}.</span><b>${esc(x.username)}</b><span>${fmt(x.points)} pkt</span></li>`).join('')}</ol>` : ''}`
      : e.kind === 'lupy' ? `<div class="duo"><a class="btn primary wide" href="/bitwa">${ic('battle')} Piraci</a><a class="btn primary wide" href="/kampania">${ic('planet')} Kampania</a></div>`
      : `<a class="btn primary wide" href="/ekspedycje">${pi('expedition', 22, 'inl')} Wyślij ekspedycję</a>`;
    return `<article class="ev-card ${k.cls}">
      <div class="ev-art" style="--bg:url('/img/${k.art}.webp?v=${V}')"><span class="ev-live">NA ŻYWO</span>${e.source === 'admin' ? '<span class="ev-src">specjalne</span>' : ''}
        <div class="ev-head"><h3>${k.name}</h3><small>kończy się za <b data-countdown="${e.ends_at}" data-reload>${dur(e.ends_at - now)}</b> · o ${clockHM(e.ends_at)}</small></div></div>
      <div class="ev-body"><p class="small">${k.desc}</p>${invBody}</div></article>`;
  };
  const cl = claims.map((c) => {
    const rw = EV.invasionReward(!!c.success, Number(c.points));
    return `<div class="item"><span class="grow"><b>${c.success ? '🏆 Inwazja odparta' : 'Inwazja zakończona'}</b> <small class="muted">· Twój wkład ${fmt(c.points)} pkt · ${fmt(c.progress)}/${fmt(c.goal)}</small><br>${rw ? rewardChips(rw) : `<small class="muted">Za mało punktów (min. ${EV.MIN_POINTS}).</small>`}</span>
      ${c.claimed ? `<span class="t-ok">${ic('check')} odebrano</span>` : rw ? `<form method="post" action="/wydarzenia/odbierz/${Number(c.id)}"><button class="btn-claim">Odbierz</button></form>` : ''}</div>`;
  }).join('');
  const up = upcoming.map((o) => `<div class="item ev-up ${EV.KINDS[o.kind].cls}">${img(EV.KINDS[o.kind].art, '', 'ev-thumb', 64)}<span class="grow"><b>${EV.KINDS[o.kind].name}</b><br><small class="muted">${dfmt.format(o.starts)}, ${clockHM(o.starts)}–${clockHM(o.ends)}</small></span><small class="muted">za ${dur(o.starts - now)}</small></div>`).join('');
  return layout({ title: 'Wydarzenia', user, st, flash, active: 'bitwa', body: `
  <section class="card arena-head ev-hero"><span class="big-glyph">${ic('event', 'acc')}</span><div class="grow"><small class="tut-k">Wydarzenia czasowe</small><h2>Wydarzenia</h2>
    <small class="muted">${evs.length ? `Trwa: ${evs.length}` : 'Teraz nic nie trwa – sprawdź harmonogram poniżej.'} · czas warszawski</small></div></section>
  ${evs.map(card).join('')}
  ${cl ? `<section class="card"><h3 class="with-ic">${pi('chest', 30)} Nagrody z inwazji</h3>${cl}<p class="muted small">Nagrody można odebrać przez ${EV.CLAIM_DAYS} dni od końca inwazji.</p></section>` : ''}
  <section class="card"><h3 class="with-ic">${ic('clock', 'acc')} Najbliższe wydarzenia</h3>${up}
    <p class="muted small">${EV.SCHEDULE.map((r) => `<b>${EV.KINDS[r.kind].name}</b> – ${r.label}`).join('<br>')}</p></section>` });
}
