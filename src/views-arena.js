// Widoki etapu v5/3: arena (zapisy, drabinka, historia) i osiągnięcia z tytułami.
import { layout, esc, fmt, rewardChips, ttl, plural, ago, pBadge } from './views.js';
import { pi, ic, lvBadge } from './icons.js';
import * as AR from './arena.js';
import * as A from './achievements.js';
import * as Q from './quests.js';
import * as R from './rules.js';
import { dur, clockHM } from './time.js';

const dayFmt = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const when = (ts) => dayFmt.format(ts);
const placeIcon = (p, size = 34) => pi(p === 1 ? 'medal_gold' : p === 2 ? 'medal_silver' : p === 3 ? 'medal_bronze' : 'arena', size, 'inl');

/** Drabinka turnieju: kolumny rund, mecze z wyróżnieniem zwycięzcy i gracza. */
export function bracket(br, meId) {
  if (!br?.rounds?.length) return '<p class="muted">Brak drabinki.</p>';
  const total = br.rounds.length;
  const side = (p, w) => (p
    ? `<div class="bk-p${p.id === w ? ' win' : ''}${p.id === meId ? ' me' : ''}"><i class="seed">${p.seed}</i><span class="bk-n">${esc(p.name)}${ttl(p.title)}</span><small>${p.level}</small></div>`
    : '<div class="bk-p bye"><i class="seed">–</i><span class="bk-n">wolny los</span></div>');
  const cols = br.rounds.map((ms, r) => `<div class="bk-col"><h4>${AR.roundName(r, total)}</h4><div class="bk-ms">${ms.map((m) => `<div class="bk-m">${side(m.a, m.w)}${side(m.b, m.w)}${m.n ? `<small class="bk-r">${m.n} ${plural(m.n, 'runda', 'rundy', 'rund')}</small>` : ''}</div>`).join('')}</div></div>`).join('');
  const champ = br.rounds[total - 1][0];
  const w = champ && [champ.a, champ.b].find((p) => p && p.id === champ.w);
  return `<div class="bracket">${cols}<div class="bk-col champ"><h4>Mistrz</h4><div class="bk-ms"><div class="bk-m win">${pi('trophy', 44)}<b>${w ? esc(w.name) : '—'}</b></div></div></div></div>`;
}

export function arena({ user, st, flash, sum, entrants, last, mine, now }) {
  const canJoin = user.level >= AR.MIN_LEVEL;
  const btn = sum.joined
    ? `<form method="post" action="/arena/wypisz"><button class="btn wide">${ic('logout')} Wypisz się (zwrot ${R.RESOURCES.energy.icon}${AR.ENTRY_ENERGY})</button></form>`
    : `<form method="post" action="/arena/zapisz"><button class="btn cta wide" ${canJoin ? '' : 'disabled'}>${ic('battle')} ${canJoin ? `Zapisz się · ⚡${AR.ENTRY_ENERGY}` : `Od poziomu ${AR.MIN_LEVEL}`}</button></form>`;
  const ent = entrants.length ? entrants.map((e, i) => `<div class="item${e.id === user.id ? ' me' : ''}"><span class="pos">${i + 1}</span>
    <span class="grow"><b>${esc(e.username)}</b>${pBadge(e.prestige)}${ttl(e.title)}<br><small class="muted">siła ${R.power(e)}</small></span>${lvBadge(e.level, 'sm')}</div>`).join('')
    : '<p class="muted">Nikt jeszcze się nie zapisał – bądź pierwszy!</p>';
  const rewards = [1, 2, 3, 5, 9].map((p) => `<li>${placeIcon(p, 26)}<span>${AR.placeLabel(p).replace('9.–17. miejsce', 'pozostali')}</span><span class="chips">${rewardChips(Q.scale(AR.placeReward(p), user.level), 13)}</span><small class="muted">+${AR.seasonXpFor(p)} XP sez.</small></li>`).join('');
  const hist = mine.length ? mine.map((r) => `<a class="item link" href="/arena/turniej/${Number(r.start)}">${placeIcon(Number(r.place))}<span class="grow">${AR.placeLabel(Number(r.place))}<br><small class="muted">${when(Number(r.start))}</small></span>${ic('up', 'chev-r')}</a>`).join('')
    : '<p class="muted">Nie brałeś jeszcze udziału w turnieju.</p>';
  const lastBr = last ? JSON.parse(last.bracket) : null;
  return layout({ title: 'Arena', user, st, flash, active: 'bitwa', body: `
  <section class="card arena-head">${pi('arena', 92, 'float')}
    <div class="grow"><small class="tut-k">Arena PvP</small><h2>Turniej o ${clockHM(sum.next)}</h2>
    <small class="muted">${ic('clock')} start za <b data-countdown="${sum.next}" data-reload>${dur(sum.next - now)}</b> · ${sum.n} ${plural(sum.n, 'zapisany', 'zapisanych', 'zapisanych')} / ${AR.MAX_PLAYERS}</small></div></section>
  <section class="card"><p class="small muted">Turniej pucharowy co 4 godziny (0:00, 4:00, 8:00, 12:00, 16:00, 20:00). Walczą statki w pełnej sprawności – liczą się moduły i poziom. Najsilniejsi są rozstawieni, a nagrody trafiają do magazynu automatycznie.</p>
    ${sum.joined ? `<p class="ok-line">${ic('check')} Jesteś zapisany na ten turniej.</p>` : ''}${btn}</section>
  <section class="card"><h3 class="with-ic">${pi('trophy', 30)} Nagrody</h3><ul class="arena-rw">${rewards}</ul></section>
  <section class="card"><h3 class="with-ic">${ic('users', 'acc')} Zapisani</h3>${ent}</section>
  ${last ? `<section class="card"><h3 class="with-ic">${pi('arena', 30)} Ostatni turniej <small class="muted">· ${when(Number(last.start))} · ${last.players} graczy</small></h3>${bracket(lastBr, user.id)}</section>` : ''}
  <section class="card"><h3 class="with-ic">${ic('log', 'acc')} Twoje turnieje</h3>${hist}</section>
  <a class="btn wide" href="/bitwa">${ic('login', 'flip')} Wróć do bitew</a>` });
}

export function tournament({ user, st, flash, tr, mine, now }) {
  const br = JSON.parse(tr.bracket);
  const head = tr.status === 'cancelled' ? '<p class="muted">Turniej odwołany – za mało chętnych. Energia została zwrócona.</p>'
    : mine ? `<div class="callout gold">${placeIcon(Number(mine.place), 52)}<span class="grow"><b>${AR.placeLabel(Number(mine.place))}</b><br><small>${rewardChips(JSON.parse(mine.reward), 14)}</small></span></div>` : '';
  return layout({ title: 'Turniej areny', user, st, flash, active: 'bitwa', body: `
  <section class="card"><h2 class="with-ic">${pi('arena', 40)} Turniej ${when(Number(tr.start))}</h2><p class="muted small">${tr.players} graczy · rozegrany ${ago(Number(tr.resolved_at), now)}</p>${head}</section>
  ${tr.status === 'done' ? `<section class="card">${bracket(br, user.id)}</section>` : ''}
  <a class="btn wide" href="/arena">${ic('login', 'flip')} Arena</a>` });
}

export function achievements({ user, st, flash, s, owned, now }) {
  const got = A.LIST.filter((a) => owned.has(a.id)).length;
  const cards = A.LIST.map((a) => {
    const has = owned.has(a.id);
    const [cur, goal] = A.progress(a, s);
    return `<div class="ach${has ? ' got' : ''}">${pi('achievement', 48, has ? '' : 'dim')}
      <div class="grow"><b>${esc(a.name)}</b>${a.title ? ` <small class="ach-t">tytuł: ${esc(a.title)}</small>` : ''}<br><small class="muted">${esc(a.desc)}</small>
      ${has ? `<small class="ach-ok">${ic('check')} zdobyte ${ago(owned.get(a.id), now)}</small>` : `<div class="bar sm"><i style="width:${Math.round((cur / goal) * 100)}%"></i><span>${fmt(cur)} / ${fmt(goal)}</span></div>`}
      <div class="chips">${rewardChips(a.r, 13)}</div></div></div>`;
  }).join('');
  const titles = A.LIST.filter((a) => a.title && owned.has(a.id));
  const tsel = titles.length ? `<div class="titles">${titles.map((a) => `<form method="post" action="/osiagniecia/tytul/${a.id}"><button class="tchip${user.title === a.id ? ' on' : ''}">${esc(a.title)}</button></form>`).join('')}
    ${user.title ? `<form method="post" action="/osiagniecia/tytul/brak"><button class="tchip off">Bez tytułu</button></form>` : ''}</div>`
    : '<p class="muted small">Zdobądź osiągnięcie z tytułem, by wyświetlać go przy nicku.</p>';
  return layout({ title: 'Osiągnięcia', user, st, flash, active: '', body: `
  <section class="card arena-head">${pi('achievement', 84, 'float')}<div class="grow"><small class="tut-k">Profil</small><h2>${esc(user.username)}${pBadge(user.prestige)}${ttl(user.title)}</h2>
    <small class="muted">Osiągnięcia: <b>${got}/${A.COUNT}</b></small><div class="bar sm"><i style="width:${Math.round((got / A.COUNT) * 100)}%"></i></div></div></section>
  <section class="card"><h3 class="with-ic">${ic('crown', 'acc')} Tytuł przy nicku</h3>${tsel}</section>
  <section class="card"><h3 class="with-ic">${pi('achievement', 30)} Osiągnięcia</h3><div class="ach-grid">${cards}</div></section>` });
}
