// Widoki panelu administratora (etap v5/5).
import * as EV from './events.js';
import { layout, esc, fmt, ago } from './views.js';
import { pi, ic, lvBadge } from './icons.js';
import * as AD from './admin.js';

const dt = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const when = (ts) => dt.format(ts);
const KIND = { multi: ['Multikonto', 'warn'], bot: ['Bot (pułapka)', 'bad'], reg_limit: ['Limit rejestracji', 'warn'] };
const banTag = (p, now) => (p.banned_until > now ? ` <span class="bad-tag">ban${p.banned_until >= AD.PERMANENT ? ' ∞' : ''}</span>` : '');
const nav = `<div class="seg"><a href="/admin#stat">${ic('log')}Statystyki</a><a href="/admin#flagi">${ic('lock')}Zgłoszenia</a><a href="/admin#gracze">${ic('users')}Gracze</a><a href="/admin#ogl">${pi('announce', 20, 'inl')}Ogłoszenia</a><a href="/admin#wyd">${ic('event')}Wydarzenia</a></div>`;

export function panel({ user, st, flash, s, flags, players, q, anns, logs, events = [], now }) {
  const tile = (v, l, cls = '') => `<div class="ad-tile ${cls}"><b>${fmt(v)}</b><small>${l}</small></div>`;
  const max = Math.max(1, ...s.perDay.map((d) => d.n));
  const chart = `<div class="ad-chart" aria-label="Rejestracje z 14 dni">${s.perDay.map((d) => `<i style="height:${Math.max(4, Math.round((d.n / max) * 100))}%" title="${d.n}"><span>${d.n || ''}</span></i>`).join('')}</div><small class="muted">Nowe konta – ostatnie 14 dni</small>`;
  const fl = flags.length ? flags.map((f) => {
    const [kl, kc] = KIND[f.kind] || [f.kind, ''];
    return `<div class="item flag"><div class="grow"><span class="ad-kind ${kc}">${kl}</span> ${f.user_id ? `<a href="/admin/gracz/${Number(f.user_id)}"><b>${esc(f.username || '?')}</b></a>${banTag(f, now)}` : '<span class="muted">(bez konta)</span>'}
      <br><small class="muted">${esc(f.detail)} · ${ago(Number(f.created_at), now)}</small></div>
      <form method="post" action="/admin/flaga/${Number(f.id)}/ok"><button class="btn sm" title="Oznacz jako sprawdzone">${ic('check')}</button></form></div>`;
  }).join('') : '<p class="muted">Brak zgłoszeń do przeglądu. 🎉</p>';
  const pl = players.map((p) => `<a class="item link" href="/admin/gracz/${Number(p.id)}">${lvBadge(p.level, 'sm')}<span class="grow"><b>${esc(p.username)}</b> ${p.role === 'admin' ? '<span class="ttl">admin</span>' : ''}${p.is_test ? '<span class="muted small"> test</span>' : ''} ${banTag(p, now)}<br><small class="muted">od ${when(Number(p.created_at))}</small></span>${ic('up', 'chev-r')}</a>`).join('') || '<p class="muted">Brak wyników.</p>';
  const an = anns.map((a) => `<div class="item"><span class="grow"><span class="ad-kind ${a.kind === 'warn' ? 'bad' : a.kind === 'event' ? 'warn' : ''}">${AD.ANN_KINDS[a.kind] || a.kind}</span>${a.audience === 'test' ? ' <small class="muted">[test]</small>' : ''} ${esc(a.text)}
      <br><small class="muted">${esc(a.created_by)} · ${a.active && a.expires_at > now ? `do ${when(Number(a.expires_at))}` : 'nieaktywne'}</small></span>
      ${a.active && a.expires_at > now ? `<form method="post" action="/admin/ogloszenie/${Number(a.id)}/wylacz"><button class="btn sm">Wyłącz</button></form>` : ''}</div>`).join('') || '<p class="muted small">Brak ogłoszeń.</p>';
  const lg = logs.map((l) => `<li><b>${esc(l.admin)}</b> ${esc(l.action)} <span class="muted">${esc(l.target)}</span> <small class="muted">${ago(Number(l.created_at), now)}</small></li>`).join('');
  return layout({ title: 'Panel administratora', user, st, flash, active: '', body: `
  <section class="card arena-head admin-head">${pi('admin', 84, 'float')}<div class="grow"><small class="tut-k">Administracja</small><h2>Panel administratora</h2><small class="muted">Zalogowany: ${esc(user.username)}</small></div></section>
  ${nav}
  <section class="card" id="stat"><h3 class="with-ic">${ic('log', 'acc')} Statystyki</h3>
    <div class="ad-tiles">${tile(s.players, 'graczy')}${tile(s.new24, 'nowych (24 h)')}${tile(s.new7, 'nowych (7 dni)')}${tile(s.active24, 'aktywnych (24 h)')}
    ${tile(s.battles24, 'bitew (24 h)')}${tile(s.chat24, 'wiadomości (24 h)')}${tile(s.trades24, 'transakcji (24 h)')}${tile(s.openOffers, 'ofert na rynku')}
    ${tile(s.corps, 'korporacji')}${tile(s.tournaments, 'turniejów areny')}${tile(s.banned, 'zbanowanych', s.banned ? 'bad' : '')}${tile(s.flags, 'zgłoszeń', s.flags ? 'warn' : '')}</div>
    ${chart}
    <p class="muted small">Ochrona od startu serwera: zablokowane żądania ${s.blockedPosts} · pułapka na boty ${s.honeypot} · limit rejestracji z IP ${s.regLimit}</p></section>
  <section class="card" id="flagi"><h3 class="with-ic">${ic('lock', 'acc')} Zgłoszenia do przeglądu (${flags.length})</h3>${fl}</section>
  <section class="card" id="gracze"><h3 class="with-ic">${ic('users', 'acc')} Gracze</h3>
    <form method="get" action="/admin#gracze" class="ref-link"><input name="q" value="${esc(q)}" placeholder="Szukaj nicku…" aria-label="Szukaj nicku"><button class="btn sm primary">Szukaj</button></form>
    ${q ? '' : '<small class="muted">Najnowsze konta:</small>'}${pl}</section>
  <section class="card" id="ogl"><h3 class="with-ic">${pi('announce', 30)} Ogłoszenia</h3>
    <form method="post" action="/admin/ogloszenie" class="mk-form">
      <textarea name="text" maxlength="280" rows="3" placeholder="Treść ogłoszenia dla wszystkich graczy…" required></textarea>
      <div class="mk-in"><select name="kind">${Object.entries(AD.ANN_KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <select name="hours"><option value="6">6 godzin</option><option value="24" selected>24 godziny</option><option value="72">3 dni</option><option value="168">7 dni</option></select></div>
      <button class="btn cta wide">${pi('announce', 24, 'inl')} Opublikuj</button></form>
    ${an}</section>
  <section class="card" id="wyd"><h3 class="with-ic">${ic('event', 'acc')} Wydarzenia</h3>
    <p class="muted small">Harmonogram rusza sam (leniwie, przy wejściu graczy): ${EV.SCHEDULE.map((r) => `${EV.KINDS[r.kind].name} – ${r.label}`).join(' · ')}.</p>
    <form method="post" action="/admin/wydarzenie" class="mk-form">
      <div class="mk-in"><select name="kind">${Object.values(EV.KINDS).map((k) => `<option value="${k.id}">${k.name}</option>`).join('')}</select>
      <select name="hours"><option value="1">1 godzina</option><option value="2" selected>2 godziny</option><option value="6">6 godzin</option><option value="24">24 godziny</option><option value="48">48 godzin</option></select>
      <input name="goal" type="number" min="10" max="100000" value="150" aria-label="Cel inwazji (punkty)" title="Cel inwazji (punkty)"></div>
      <button class="btn cta wide">${ic('event')} Uruchom teraz</button></form>
    ${events.map((e) => `<div class="item"><span class="grow"><span class="ad-kind ${e.kind === 'inwazja' ? 'bad' : 'warn'}">${EV.KINDS[e.kind]?.name || esc(e.kind)}</span>${e.test ? ' <small class="muted">[test]</small>' : ''} <small class="muted">${e.source === 'admin' ? `ręcznie (${esc(e.created_by)})` : 'harmonogram'}</small>
      <br><small class="muted">${when(Number(e.starts_at))} → ${when(Number(e.ends_at))}${e.kind === 'inwazja' ? ` · postęp ${fmt(e.progress)}/${fmt(e.goal)}${e.settled ? (e.success ? ' · ✅ sukces' : ' · ❌ porażka') : ''}` : ''}</small></span>
      ${e.ends_at > now && e.starts_at <= now ? `<form method="post" action="/admin/wydarzenie/${Number(e.id)}/zakoncz"><button class="btn sm">Zakończ</button></form>` : ''}</div>`).join('') || '<p class="muted small">Brak wydarzeń.</p>'}</section>
  ${lg ? `<section class="card"><h3 class="with-ic">${ic('log', 'acc')} Dziennik działań</h3><ul class="mk-hist">${lg}</ul></section>` : ''}` });
}

export function player({ user, st, flash, p, linkedTo, fl, seen, envAdmin, now }) {
  const banned = p.banned_until > now;
  const lk = linkedTo.length ? linkedTo.map((l) => `<a class="item link" href="/admin/gracz/${Number(l.id)}">${lvBadge(l.level, 'sm')}<span class="grow"><b>${esc(l.username)}</b><br><small class="muted">${[l.same_ip ? 'to samo IP' : '', l.same_device ? 'to samo urządzenie' : ''].filter(Boolean).join(' · ')}</small></span>${ic('up', 'chev-r')}</a>`).join('')
    : '<p class="muted small">Brak powiązanych kont (30 dni).</p>';
  const flh = fl.map((f) => `<li><span class="ad-kind ${(KIND[f.kind] || [])[1] || ''}">${(KIND[f.kind] || [f.kind])[0]}</span> ${esc(f.detail)} <small class="muted">${ago(Number(f.created_at), now)}${f.resolved_at ? ` · sprawdzone (${esc(f.resolved_by)})` : ''}</small></li>`).join('');
  const isAdm = p.role === 'admin' || envAdmin;
  const banForm = banned
    ? `<p class="bad-line">Zbanowany ${p.banned_until >= AD.PERMANENT ? 'na stałe' : `do ${when(Number(p.banned_until))}`}. Powód: ${esc(p.ban_reason)}</p>
      <form method="post" action="/admin/odbanuj/${Number(p.id)}"><button class="btn wide">${ic('check')} Odbanuj</button></form>`
    : isAdm ? '<p class="muted small">Administratora nie można zbanować.</p>'
    : `<form method="post" action="/admin/ban/${Number(p.id)}" class="mk-form" onsubmit="return confirm('Zbanować gracza ${esc(p.username)}?')">
      <input name="reason" maxlength="200" placeholder="Powód (widoczny dla gracza)">
      <select name="days">${AD.BAN_DAYS.map((d) => `<option value="${d}"${d === 7 ? ' selected' : ''}>${d ? `${d} ${d === 1 ? 'dzień' : 'dni'}` : 'na stałe'}</option>`).join('')}</select>
      <button class="btn danger wide">${ic('lock')} Zbanuj</button></form>`;
  return layout({ title: `Gracz ${p.username}`, user, st, flash, active: '', body: `
  <section class="card"><div class="with-ic">${lvBadge(p.level, 'lg')}<div class="grow"><h2 style="margin:0">${esc(p.username)} ${isAdm ? '<span class="ttl">admin</span>' : ''}</h2>
    <small class="muted">ID ${Number(p.id)} · konto od ${when(Number(p.created_at))}${p.is_test ? ' · konto testowe' : ''}</small></div></div>
    <ul class="mk-hist" style="margin-top:10px"><li><span>Ostatnia aktywność</span><b>${seen.last ? ago(Number(seen.last), now) : '—'}</b></li><li><span>Adresy IP / urządzenia (skróty)</span><b>${seen.ips} / ${seen.devs}</b></li>
    <li><span>Bitwy PvE / PvP</span><b>${p.pve_wins} / ${p.pvp_wins}</b></li><li><span>Surowce</span><b>${fmt(p.metal)} / ${fmt(p.crystal)} / ${fmt(p.energy)}</b></li></ul></section>
  <section class="card"><h3 class="with-ic">${ic('lock', 'acc')} Blokada</h3>${banForm}</section>
  <section class="card"><h3 class="with-ic">${ic('users', 'acc')} Powiązane konta</h3>${lk}</section>
  ${flh ? `<section class="card"><h3 class="with-ic">${ic('log', 'acc')} Zgłoszenia</h3><ul class="mk-hist">${flh}</ul></section>` : ''}
  <section class="card"><h3 class="with-ic">${pi('admin', 28)} Rola</h3>${envAdmin ? '<p class="muted small">Administrator z ustawienia ADMIN_USERS (zmiana tylko na serwerze).</p>'
    : `<form method="post" action="/admin/rola/${Number(p.id)}"><input type="hidden" name="role" value="${p.role === 'admin' ? '' : 'admin'}"><button class="btn wide">${p.role === 'admin' ? 'Odbierz rolę administratora' : 'Nadaj rolę administratora'}</button></form>`}</section>
  <a class="btn wide" href="/admin">${ic('login', 'flip')} Panel</a>` });
}

