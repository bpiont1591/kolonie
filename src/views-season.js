// Widoki sezonu: przepustka, ranking sezonowy, archiwum zwycięzców.
import { layout, esc, fmt, rewardChips, ttl } from './views.js';
import { pi, ic, lvBadge } from './icons.js';
import * as S from './season.js';
import { seasonName, dur } from './time.js';

const nav = (active) => `<div class="seg">${[['pass', '/sezon', 'season', 'Przepustka'], ['ranking', '/sezon/ranking', 'trophy', 'Ranking'], ['archiwum', '/sezon/archiwum', 'medal_gold', 'Archiwum']]
  .map(([id, href, icn, l]) => `<a href="${href}" class="${active === id ? 'on' : ''}">${pi(icn, 22, 'inl')}${l}</a>`).join('')}</div>`;
export const badgeIcon = (b, size = 20) => { const d = S.BADGES[b.badge]; return d ? `<span class="bdg" title="${esc(d.name)} – ${esc(seasonName(b.season))}">${pi(d.icon, size, 'inl')}</span>` : ''; };
const head = (season, endsIn, extra = '') => `<section class="card season-head">
  <div class="sh-bg"></div>${pi('season', 76, 'float')}
  <div class="grow"><small class="tut-k">Sezon</small><h2>${esc(seasonName(season))}</h2>
  <small class="muted">${ic('clock')} koniec za <b data-countdown="${Date.now() + endsIn}">${dur(endsIn)}</b></small></div>${extra}</section>`;

export function pass({ user, st, flash, ps, awards, now }) {
  const pct = ps.max ? 100 : Math.round((ps.inLevel / ps.need) * 100);
  const aw = awards.map((a) => `<form method="post" action="/sezon/nagroda/${esc(a.season)}" class="callout gold award">${pi(S.BADGES[S.badgeForRank(a.rank)].icon, 52)}
    <span class="grow"><b>${a.rank}. miejsce – ${esc(seasonName(a.season))}</b><br><small>${rewardChips(JSON.parse(a.reward), 14)}</small></span><button class="btn cta sm">Odbierz</button></form>`).join('');
  const rows = ps.levels.map((l) => {
    const state = l.claimed ? 'claimed' : l.reached ? 'ready' : 'locked';
    const btn = l.claimed ? `<span class="pl-ok">${ic('check')}</span>`
      : l.reached ? `<form method="post" action="/sezon/odbierz/${l.n}"><button class="btn-claim">Odbierz</button></form>`
      : `<span class="pl-lock">${ic('lock')}</span>`;
    return `<div class="pl ${state}${l.n % 5 === 0 ? ' milestone' : ''}${l.n === ps.level + 1 ? ' next' : ''}" id="p${l.n}">
      <div class="pl-free"><div class="chips">${rewardChips(l.r, 14)}</div>${btn}</div>
      <div class="pl-n"><b>${l.n}</b></div>
      <div class="pl-prem">${ic('lock')}<small>${esc(l.premium.label)}</small></div></div>`;
  }).join('');
  const all = ps.claimable ? `<form method="post" action="/sezon/odbierz-wszystko"><button class="btn cta wide">${ic('gift')} Odbierz wszystko (${ps.claimable})</button></form>` : '';
  const how = Object.entries({ 'Wygrana bitwa': S.EV_XP.win + S.EV_XP.pve, 'Misja dzienna': S.QUEST_XP.daily, 'Misja tygodniowa': S.QUEST_XP.weekly, 'Skrzynia tygodniowa': S.QUEST_XP.chest, 'Nagroda dnia': S.EV_XP.login, 'Ekspedycja': S.EV_XP.expedition, 'Budowa / moduł': S.EV_XP.build, 'Atak na bossa': S.EV_XP.boss })
    .map(([k, v]) => `<li><span>${k}</span><b>+${v} XP</b></li>`).join('');
  return layout({ title: 'Przepustka sezonowa', user, st, flash, active: 'misje', body: `
  ${head(ps.season, ps.endsIn)}
  ${nav('pass')}
  ${aw}
  <section class="card pass-sum">
    <div class="row"><div class="with-ic">${lvBadge(ps.level, 'lg')}<div><b>Poziom przepustki ${ps.level}/${S.LEVELS}</b><br><small class="muted">${fmt(ps.xp)} XP sezonu</small></div></div></div>
    <div class="bar xp"><i style="width:${pct}%"></i><span>${ps.max ? 'Przepustka ukończona!' : `${ps.inLevel} / ${ps.need} XP do poziomu ${ps.level + 1}`}</span></div>
    ${all}
  </section>
  <section class="card pass-track">
    <div class="pl-head"><span>${pi('season', 22, 'inl')} Darmowa</span><span></span><span class="prem">${ic('lock')} Premium</span></div>
    ${rows}
    <p class="muted small center prem-note">${ic('lock')} Ścieżka Premium pojawi się w przyszłości. Teraz nie da się jej kupić – wszystkie nagrody z ścieżki darmowej są dla każdego.</p>
  </section>
  <section class="card"><h3 class="with-ic">${pi('xp', 28)} Jak zdobywać XP sezonu</h3><ul class="kv">${how}</ul>
  <p class="muted small">Na koniec miesiąca najlepsza dziesiątka rankingu sezonu dostaje nagrody i odznaki przy nicku. Nowy sezon startuje 1. dnia miesiąca o północy.</p></section>` });
}

export function rankingPage({ user, st, flash, season, rows, myRank, myXp, badges, endsIn }) {
  const bmap = {};
  for (const b of badges) (bmap[b.user_id] ||= []).push(b);
  const list = rows.map((r, i) => `<div class="item rank ${r.id === user.id ? 'me' : ''}"><span class="pos">${i < 3 ? pi(['medal_gold', 'medal_silver', 'medal_bronze'][i], 30) : i + 1}</span>
    <span class="grow"><b>${esc(r.username)}</b>${ttl(r.title)}${r.tag ? ` <span class="corp">[${esc(r.tag)}]</span>` : ''} ${(bmap[r.id] || []).slice(0, 4).map((b) => badgeIcon(b, 18)).join('')}<br><small class="muted">poziom przepustki ${S.level(r.xp)}</small></span>
    <b class="pts">${fmt(r.xp)} XP</b></div>`).join('');
  const rw = [1, 2, 3, 4].map((k) => `<div class="rw-rank">${pi(S.BADGES[S.badgeForRank(k)].icon, 34)}<b>${k === 4 ? '4–10' : k + '.'}</b><div class="chips">${rewardChips(S.rankReward(k), 13)}</div></div>`).join('');
  return layout({ title: 'Ranking sezonu', user, st, flash, active: 'misje', body: `
  ${head(season, endsIn)}
  ${nav('ranking')}
  <section class="card">${myRank ? `<p class="muted small">Twoja pozycja: <b>#${myRank}</b> · ${fmt(myXp)} XP</p>` : '<p class="muted small">Zdobądź XP sezonu, by trafić do rankingu.</p>'}
  ${list || '<p class="muted">Sezon dopiero się zaczyna – bądź pierwszy!</p>'}</section>
  <section class="card"><h3 class="with-ic">${pi('chest', 28)} Nagrody na koniec sezonu</h3><div class="rw-ranks">${rw}</div></section>` });
}

export function archive({ user, st, flash, seasons, mine }) {
  const list = seasons.map((s) => `<div class="arch"><h3>${pi('season', 26, 'inl')} ${esc(seasonName(s.id))}</h3>
    ${s.top.map((r) => `<div class="item rank"><span class="pos">${pi(['medal_gold', 'medal_silver', 'medal_bronze'][r.rank - 1], 30)}</span><span class="grow"><b>${esc(r.username)}</b></span><b class="pts">${fmt(r.xp)} XP</b></div>`).join('')}</div>`).join('');
  const my = mine.length ? `<div class="badge-grid">${mine.map((b) => `<div class="bg-item">${pi(S.BADGES[b.badge]?.icon || 'season', 54)}<b>${esc(S.BADGES[b.badge]?.name || b.badge)}</b><small>${esc(seasonName(b.season))}</small></div>`).join('')}</div>`
    : '<p class="muted small">Nie masz jeszcze odznak. Ukończ przepustkę albo wejdź do top 10 sezonu!</p>';
  return layout({ title: 'Archiwum sezonów', user, st, flash, active: 'misje', body: `
  <section class="card season-head"><div class="sh-bg"></div>${pi('medal_gold', 76, 'float')}<div class="grow"><small class="tut-k">Galeria sław</small><h2>Archiwum zwycięzców</h2><small class="muted">Najlepsi komandorzy minionych sezonów</small></div></section>
  ${nav('archiwum')}
  <section class="card"><h3 class="with-ic">${pi('season', 28)} Twoje odznaki</h3>${my}</section>
  <section class="card">${list || '<p class="muted">Pierwszy sezon wciąż trwa. Zwycięzcy pojawią się tu po jego zakończeniu.</p>'}</section>` });
}
