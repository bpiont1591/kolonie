// Widoki korporacji (etap 3): przegląd, skarbiec, ulepszenia, wojna o sektor, boss rajdowy.
import * as R from './rules.js';
import * as C from './corp.js';
import { layout, esc, emo, fmt, resIcon, costHtml, rewardChips, ago, hpBar, img, ttl } from './views.js';
import { ic, pi, lvBadge, V } from './icons.js';
import { dur, msToWeekEnd } from './time.js';

const nav = (active) => `<div class="seg corp-nav">${[['przeglad', '/korporacja', 'corp', 'Przegląd'], ['wojna', '/korporacja/wojna', 'war', 'Wojna'], ['boss', '/korporacja/boss', 'defeat', 'Boss']]
  .map(([id, href, icn, l]) => `<a href="${href}" class="${active === id ? 'on' : ''}">${pi(icn, 22, 'inl')}${l}</a>`).join('')}</div>`;
const roleIc = { leader: 'crown', officer: 'star', member: 'user' };
const roleBadge = (r) => `<span class="role ${r}">${ic(roleIc[r] || 'user')}${C.ROLES[r] || r}</span>`;

export function corpList({ user, st, flash, corps }) {
  const list = corps.length ? corps.map((c) => `<div class="item">${pi('corp', 44)}
    <span class="grow"><b>${esc(c.name)}</b> <span class="corp">[${esc(c.tag)}]</span><br><small class="muted">${c.members}/${C.memberCap(c)} członków · siła ${c.power}</small></span>
    <form method="post" action="/korporacja/dolacz/${c.id}"><button class="btn sm primary" ${c.members >= C.memberCap(c) ? 'disabled' : ''}>Dołącz</button></form></div>`).join('')
    : '<p class="muted">Nie ma jeszcze żadnej korporacji. Załóż pierwszą!</p>';
  return layout({ title: 'Korporacje', user, st, flash, active: 'korporacja', body: `
  <section class="card"><h3 class="with-ic">${pi('corp', 30)} Korporacje</h3><p class="muted small">Korporacja to skarbiec, wspólne ulepszenia, wojna o sektor i boss rajdowy. Członkowie dostają +5% XP z bitew.</p>${list}</section>
  <section class="card"><h3 class="with-ic">${ic('star', 'acc')} Załóż korporację</h3>
    <form method="post" action="/korporacja/zaloz" class="form">
      <input name="name" placeholder="Nazwa (3–24 znaki)" minlength="3" maxlength="24" required>
      <input name="tag" placeholder="TAG (2–4 litery/cyfry)" minlength="2" maxlength="4" required style="text-transform:uppercase">
      <button class="btn primary">Załóż za <span class="costs inl">${costHtml(R.CORP_COST)}</span></button>
    </form></section>
  <a class="callout" href="/korporacja/wojna">${pi('war', 44)}<span class="grow"><b>Mapa wojny o sektor</b><br><small>Zobacz, kto kontroluje planety w tym tygodniu</small></span>${ic('up', 'chev-r')}</a>` });
}

export function noCorp({ user, st, flash, what }) {
  return layout({ title: 'Korporacja', user, st, flash, active: 'korporacja', body: `<section class="card center">${pi('corp', 110, 'big-ic')}
    <h2>Potrzebujesz korporacji</h2><p class="muted">Dołącz do korporacji lub ją załóż, aby walczyć z ${what}.</p><a class="btn primary wide" href="/korporacja">Korporacje</a></section>` });
}

export function corpHome({ user, st, flash, c, members, log, now }) {
  const mgr = C.canManage(user.corp_role);
  const bonuses = [`<span class="chip">${pi('xp', 18, 'inl')}+${Math.round(C.xpBonus(c) * 100)}% XP</span>`];
  if (C.refineryBonus(c)) bonuses.push(`<span class="chip">${pi('collect', 18, 'inl')}+${Math.round(C.refineryBonus(c) * 100)}% wydobycia</span>`);
  if (user._warWinner) bonuses.push(`<span class="chip rare">${pi('war', 18, 'inl')}Zwycięzca wojny +${C.WAR_WIN_BONUS * 100}%</span>`);
  const tres = R.RES_KEYS.map((k) => `<div class="pend">${resIcon(k, 34)}<b>${fmt(c['t_' + k])}</b><small>${R.RESOURCES[k].name}</small></div>`).join('');
  const ups = Object.entries(C.UPGRADES).map(([id, d]) => {
    const lvl = c[d.col], max = lvl >= d.max, cost = C.upgradeCost(d, lvl);
    const can = mgr && !max && c.t_metal >= cost.metal && c.t_crystal >= cost.crystal && c.t_energy >= cost.energy;
    return `<div class="upg${can ? ' ready' : ''}">
      <div class="upg-ic"><span class="mod-ic">${pi(d.icon, 54)}</span>${lvBadge(lvl, 'corner')}</div>
      <div class="upg-body"><div class="upg-name">${d.name}</div><div class="muted small">${d.desc}</div>
        <div class="prog"><i style="width:${Math.round((lvl / d.max) * 100)}%"></i></div>
        <div class="upg-foot"><span class="lvtext">poz. <b>${lvl}</b>/${d.max}</span>${max ? '<span class="warn small">Maks.</span>' : `<span class="costs">${costHtml(cost, { metal: c.t_metal, crystal: c.t_crystal, energy: c.t_energy })}</span>`}</div></div>
      <form method="post" action="/korporacja/ulepsz/${id}"><button class="btn-up${can ? '' : ' is-off'}" ${can ? '' : 'disabled'} title="${mgr ? 'Opłacane ze skarbca' : 'Tylko przywódca lub oficer'}">${mgr ? ic('up') : ic('lock')}<span>${max ? 'MAX' : mgr ? 'Ulepsz' : 'Oficer'}</span></button></form></div>`;
  }).join('');
  const mem = members.map((m) => {
    const acts = [];
    if (m.id !== user.id) {
      if (user.corp_role === 'leader' && m.corp_role === 'member') acts.push(`<form method="post" action="/korporacja/awans/${m.id}"><button class="icon-btn" title="Awansuj na oficera">${ic('up')}</button></form>`);
      if (user.corp_role === 'leader' && m.corp_role === 'officer') acts.push(`<form method="post" action="/korporacja/awans/${m.id}" onsubmit="return confirm('Przekazać dowodzenie graczowi ${esc(m.username)}?')"><button class="icon-btn gold" title="Przekaż dowodzenie">${ic('crown')}</button></form>`,
        `<form method="post" action="/korporacja/degraduj/${m.id}"><button class="icon-btn" title="Odbierz stopień oficera">${ic('up', 'down')}</button></form>`);
      if ((user.corp_role === 'leader' && m.corp_role !== 'leader') || (user.corp_role === 'officer' && m.corp_role === 'member'))
        acts.push(`<form method="post" action="/korporacja/wyrzuc/${m.id}" onsubmit="return confirm('Usunąć gracza ${esc(m.username)} z korporacji?')"><button class="icon-btn red" title="Usuń z korporacji">${ic('logout')}</button></form>`);
    }
    return `<div class="item member${m.id === user.id ? ' me' : ''}"><span class="avatar ${m.corp_role}">${ic(roleIc[m.corp_role] || 'user')}</span>
      <span class="grow"><b>${esc(m.username)}</b>${ttl(m.title)} ${roleBadge(m.corp_role)}<br><small class="muted">poz. ${m.level} · siła ${R.power(m)} · ${pi('pvp', 14, 'inl')}${m.pvp_points}</small></span>
      <span class="acts">${acts.join('')}</span></div>`;
  }).join('');
  return layout({ title: c.name, user, st, flash, active: 'korporacja', body: `
  ${nav('przeglad')}
  <section class="card center corp-head">${pi('corp', 96, 'big-ic')}<h2>${esc(c.name)} <span class="corp">[${esc(c.tag)}]</span></h2>
    <div>${roleBadge(user.corp_role)}</div>
    <p class="muted small">${members.length}/${C.memberCap(c)} członków</p><div class="chips center-chips">${bonuses.join('')}</div></section>
  <section class="card"><h3 class="with-ic">${pi('treasury', 32)} Skarbiec</h3>
    <div class="pends">${tres}</div>
    <form method="post" action="/korporacja/wplac" class="donate">
      ${R.RES_KEYS.map((k) => `<label>${resIcon(k, 18)}<input name="${k}" type="number" min="0" max="${Math.floor(st.stock[k])}" step="10" placeholder="0" inputmode="numeric" aria-label="${R.RESOURCES[k].name}"></label>`).join('')}
      <button class="btn primary">${ic('up')} Wpłać</button>
    </form>
    <p class="muted small">Skarbiec finansuje ulepszenia korporacji. Wydawać mogą przywódca i oficerowie.</p></section>
  <section class="card"><h3 class="with-ic">${ic('star', 'acc')} Ulepszenia korporacji</h3>${ups}</section>
  <section class="card"><h3 class="with-ic">${ic('users', 'acc')} Członkowie</h3>${mem}</section>
  <section class="card"><h3 class="with-ic">${ic('log', 'acc')} Dziennik</h3>
    <ul class="corp-log">${log.map((l) => `<li><span class="muted">${ago(l.created_at, now)}</span> ${emo(esc(l.text))}</li>`).join('') || '<li class="muted">Pusto.</li>'}</ul></section>
  <section class="card"><form method="post" action="/korporacja/opusc" onsubmit="return confirm('Na pewno opuścić korporację?')">
    <button class="btn wide">${ic('logout')} Opuść korporację</button></form></section>` });
}

export function war({ user, st, flash, w, now }) {
  const mgr = user.corp_id && C.canManage(user.corp_role);
  const target = user._corp?.war_target;
  const P = Object.fromEntries(C.PLANETS.map((p) => [p.id, p]));
  const lines = C.LINKS.map(([a, b]) => `<line x1="${P[a].x}" y1="${P[a].y}" x2="${P[b].x}" y2="${P[b].y}"/>`).join('');
  const planets = C.PLANETS.map((p) => {
    const own = w.ctl[p.id];
    const mineP = w.mine.find((r) => r.planet === p.id)?.points || 0;
    const hue = own ? (own.corp_id === user.corp_id ? 185 : C.tagHue(own.tag)) : null;
    const cls = ['planet-node', own ? (own.corp_id === user.corp_id ? 'ours' : 'theirs') : 'free', target === p.id ? 'target' : ''].join(' ');
    const inner = `<span class="orb" style="--h:${p.hue};--s:${p.size}"></span>
      <span class="pl-name">${esc(p.name)}</span>
      <span class="pl-own" ${hue !== null ? `style="--oh:${hue}"` : ''}>${own ? `[${esc(own.tag)}] ${own.points}` : 'wolna'}</span>
      ${mineP && own?.corp_id !== user.corp_id ? `<span class="pl-mine">my: ${mineP}</span>` : ''}`;
    const pos = `style="left:${p.x}%;top:${p.y}%"`;
    return mgr ? `<form method="post" action="/korporacja/cel/${p.id}" class="${cls}" ${pos}><button title="Ustaw jako cel">${inner}</button></form>`
      : `<div class="${cls}" ${pos}>${inner}</div>`;
  }).join('');
  const stand = w.standings.length ? w.standings.map((s, i) => `<div class="item rank${s.corp_id === user.corp_id ? ' me' : ''}"><span class="pos">${i + 1}</span>
    <span class="grow"><b>[${esc(s.tag)}]</b> ${esc(s.name)}<br><small class="muted">${s.points} pkt wojny</small></span><b class="pts">${pi('war', 20, 'inl')}${s.planets}</b></div>`).join('')
    : '<p class="muted">Żadna planeta nie została jeszcze zdobyta w tym tygodniu.</p>';
  return layout({ title: 'Wojna o sektor', user, st, flash, active: 'korporacja', body: `
  ${user.corp_id ? nav('wojna') : ''}
  <section class="card war-card">
    <div class="row"><h3 class="with-ic">${pi('war', 32)} Wojna o sektor</h3><span class="timer">${ic('clock')} ${dur(msToWeekEnd(now))}</span></div>
    <p class="muted small">Wygrane bitwy członków dają punkty na planecie-celu korporacji (pirat ${C.WAR_POINTS.pve} · gracz ${C.WAR_POINTS.pvp} · boss ${C.WAR_POINTS.boss}). Planetę kontroluje korporacja z największą liczbą punktów. Zwycięzca tygodnia (najwięcej planet) dostaje <b>+${C.WAR_WIN_BONUS * 100}% wydobycia</b> przez cały następny tydzień.</p>
    <div class="sector" style="--bg:url('/img/sector_bg.webp?v=${V}')"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${planets}</div>
    ${mgr ? '<p class="small center muted">Dotknij planety, aby ustawić ją jako cel korporacji.</p>' : user.corp_id ? `<p class="small center muted">Cel korporacji: <b>${esc(P[target]?.name || '')}</b> (ustala przywódca lub oficer)</p>` : ''}
  </section>
  ${w.prev ? `<section class="callout rare">${pi('trophy', 48)}<span class="grow"><b>Zwycięzca zeszłego tygodnia</b><br><small>[${esc(w.prev.tag)}] ${esc(w.prev.name)} · ${w.prev.planets} planet · +${C.WAR_WIN_BONUS * 100}% wydobycia</small></span></section>` : ''}
  <section class="card"><h3 class="with-ic">${pi('trophy', 30)} Klasyfikacja tygodnia</h3>${stand}</section>
  ${user.corp_id ? `<section class="card"><h3 class="with-ic">${ic('users', 'acc')} Wkład członków</h3>${w.contrib.map((c) => `<div class="item"><span class="grow">${esc(c.username)}</span><b class="pts">${c.points} pkt</b></div>`).join('') || '<p class="muted">Jeszcze nikt nie zdobył punktów. Wygrywajcie bitwy!</p>'}</section>` : ''}` });
}

export function boss({ user, st, flash, b, hits, now }) {
  const mgr = C.canManage(user.corp_role);
  const total = hits.reduce((a, h) => a + h.damage, 0) || 1;
  const mine = hits.find((h) => h.user_id === user.id);
  let main;
  if (!b || (b.status !== 'active' && (!mine || mine.claimed))) {
    const cd = b ? b.ended_at + C.BOSS.cooldownH * 3600_000 - now : 0;
    main = `<section class="card center boss-card idle">${img('boss', C.BOSS.name, 'boss-art dim', 320, true)}
      <h2>${C.BOSS.name}</h2><p class="muted">${b ? (b.status === 'killed' ? 'Ostatni boss został zniszczony.' : 'Ostatni boss uciekł z sektora.') : 'Sensory sektora są czyste.'}</p>
      ${mgr ? (cd > 0 ? `<button class="btn wide" disabled>${ic('clock')} Kolejny boss za ${dur(cd)}</button>` : `<form method="post" action="/korporacja/boss/wezwij"><button class="btn danger wide">${ic('battle')} Namierz bossa (${C.BOSS.hours} h na walkę)</button></form>`)
        : '<p class="small muted">Bossa wzywa przywódca lub oficer.</p>'}</section>`;
  } else {
    const pct = Math.round((b.hp / b.max_hp) * 100);
    const active = b.status === 'active';
    main = `<section class="card center boss-card ${b.status}">
      <div class="boss-wrap">${img('boss', C.BOSS.name, 'boss-art', 320, true)}${active ? '' : `<span class="boss-stamp">${b.status === 'killed' ? 'ZNISZCZONY' : 'UCIEKŁ'}</span>`}</div>
      <h2>${C.BOSS.name} ${lvBadge(b.level, 'red')}</h2>
      <div class="bar boss-hp"><i style="width:${pct}%"></i><span>${fmt(b.hp)} / ${fmt(b.max_hp)} HP</span></div>
      ${active ? `<p class="small"><span class="timer">${ic('clock')} ucieka za <span data-countdown="${b.ends_at}" data-reload>${dur(b.ends_at - now)}</span></span></p>
        ${hpBar(st)}
        <form method="post" action="/korporacja/boss/atak"><button class="btn danger wide boss-atk">${ic('battle')} Atakuj <span class="en">${resIcon('energy', 18)}${C.BOSS.energy}</span></button></form>
        <p class="muted small">Każdy atak: obrażenia ≈ 4× Twój atak (krytyk ×2), kontratak bossa −5–12% HP, +${C.WAR_POINTS.boss} pkt wojny. Nagrody po walce według obrażeń, najlepszy gracz dostaje Rdzeń kwantowy.</p>`
      : mine && !mine.claimed ? `<form method="post" action="/korporacja/boss/odbierz/${b.id}"><button class="btn claim wide">${ic('gift')} Odbierz ${b.status === 'killed' ? 'łupy' : 'nagrodę pocieszenia'}</button></form>` : ''}
    </section>`;
  }
  const rank = hits.length ? hits.map((h, i) => `<div class="item rank${h.user_id === user.id ? ' me' : ''}"><span class="pos">${i + 1}</span>
    <span class="grow"><b>${esc(h.username)}</b> <small class="muted">· ${h.attacks} ataków</small><div class="prog"><i style="width:${Math.round((h.damage / total) * 100)}%"></i></div></span>
    <b class="pts">${fmt(h.damage)}</b></div>`).join('') : '<p class="muted">Brak ataków.</p>';
  return layout({ title: 'Boss rajdowy', user, st, flash, active: 'korporacja', body: `
  ${nav('boss')}
  ${main}
  ${b ? `<section class="card"><h3 class="with-ic">${pi('trophy', 30)} Ranking obrażeń</h3>${rank}</section>` : ''}` });
}
