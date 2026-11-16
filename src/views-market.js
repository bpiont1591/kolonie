// Widoki etapu v5/4: rynek surowców i zaproszenia znajomych.
import { layout, esc, fmt, rewardChips, ttl, ago, resIcon, plural } from './views.js';
import { pi, ic, lvBadge } from './icons.js';
import * as M from './market.js';
import * as RF from './referral.js';
import * as R from './rules.js';
import { dur } from './time.js';

const amt = (k, n, size = 18) => `<span class="amt">${resIcon(k, size)}<b>${fmt(n)}</b></span>`;
const rateTag = (o) => {
  const r = M.ratio({ sellRes: o.sell_res, sellAmt: o.sell_amt, buyRes: o.buy_res, buyAmt: o.buy_amt });
  const pct = Math.round(r * 100);
  return `<span class="rate ${pct <= 90 ? 'good' : pct >= 115 ? 'bad' : ''}" title="Cena względem wartości orientacyjnej">${pct}%</span>`;
};

export function market({ user, st, flash, res, offers, mine, hist, now }) {
  const can = user.level >= M.MIN_LEVEL;
  const opt = (sel) => M.RES.map((k) => `<option value="${k}"${k === sel ? ' selected' : ''}>${R.RESOURCES[k].name}</option>`).join('');
  const form = can ? `<form method="post" action="/rynek/wystaw" class="mk-form" id="mk-form">
      <label>Sprzedaję<div class="mk-in"><select name="sell_res">${opt('metal')}</select><input name="sell_amt" type="number" inputmode="numeric" min="${M.MIN_AMT}" max="${M.MAX_AMT}" value="500" required></div></label>
      <label>W zamian chcę<div class="mk-in"><select name="buy_res">${opt('crystal')}</select><input name="buy_amt" type="number" inputmode="numeric" min="${M.MIN_AMT}" max="${M.MAX_AMT}" value="250" required></div></label>
      <p class="small mk-hint" data-mk-hint>Cena: 100% wartości · po podatku otrzymasz 225</p>
      <button class="btn cta wide">${pi('market', 26, 'inl')} Wystaw ofertę</button></form>`
    : `<p class="warn small">${ic('lock')} Rynek odblokujesz na poziomie ${M.MIN_LEVEL}.</p>`;
  const seg = `<div class="seg">${[['', 'Wszystko'], ...M.RES.map((k) => [k, R.RESOURCES[k].name])].map(([k, l]) => `<a href="/rynek${k ? `?res=${k}` : ''}" class="${res === k ? 'on' : ''}">${k ? resIcon(k, 18) : ''}${l}</a>`).join('')}</div>`;
  const list = offers.length ? offers.map((o) => {
    const afford = user[o.buy_res] >= o.buy_amt;
    return `<div class="item offer"><div class="grow">
      <div class="of-line">${amt(o.sell_res, o.sell_amt)}<span class="muted">za</span>${amt(o.buy_res, o.buy_amt)}${rateTag(o)}</div>
      <small class="muted">${esc(o.username)}${ttl(o.title)} · poz. ${o.level} · wygasa za ${dur(Number(o.expires_at) - now)}</small></div>
      <form method="post" action="/rynek/kup/${Number(o.id)}"><button class="btn sm ${afford ? 'primary' : ''}" ${can && afford ? '' : 'disabled'}>Kup</button></form></div>`;
  }).join('') : '<p class="muted">Brak ofert w tej kategorii. Wystaw pierwszą!</p>';
  const my = mine.length ? mine.map((o) => `<div class="item offer mine"><div class="grow"><div class="of-line">${amt(o.sell_res, o.sell_amt)}<span class="muted">za</span>${amt(o.buy_res, o.buy_amt)}${rateTag(o)}</div>
      <small class="muted">otrzymasz ${fmt(M.sellerGets(o.buy_amt))} po podatku · wygasa za ${dur(Number(o.expires_at) - now)}</small></div>
      <form method="post" action="/rynek/anuluj/${Number(o.id)}"><button class="btn sm">Wycofaj</button></form></div>`).join('')
    : '<p class="muted small">Nie masz aktywnych ofert.</p>';
  const label = { sold: 'sprzedana', cancelled: 'wycofana', expired: 'wygasła' };
  const hi = hist.length ? hist.map((o) => {
    const sold = o.status === 'sold', iSold = o.seller_id === user.id;
    const txt = sold ? (iSold ? `Sprzedałeś graczowi ${esc(o.buyer || '—')}: ${amt(o.sell_res, o.sell_amt, 14)} → ${amt(o.buy_res, M.sellerGets(o.buy_amt), 14)}` : `Kupiłeś od ${esc(o.seller || '—')}: ${amt(o.sell_res, o.sell_amt, 14)} za ${amt(o.buy_res, o.buy_amt, 14)}`)
      : `Oferta ${label[o.status] || o.status}: ${amt(o.sell_res, o.sell_amt, 14)} zwrócone`;
    return `<li><span>${txt}</span><small class="muted">${ago(Number(o.closed_at), now)}</small></li>`;
  }).join('') : '';
  const script = `<script>(()=>{const f=document.getElementById('mk-form');if(!f)return;const V=${JSON.stringify(M.VALUE)},T=${M.TAX},h=f.querySelector('[data-mk-hint]');
const u=()=>{const s=f.sell_res.value,b=f.buy_res.value,sa=+f.sell_amt.value||0,ba=+f.buy_amt.value||0;if(s===b){h.textContent='Wybierz dwa różne surowce.';h.className='small mk-hint bad';return;}
const r=sa?Math.round(ba*V[b]/(sa*V[s])*100):0,ok=r>=${M.MIN_RATIO * 100}&&r<=${M.MAX_RATIO * 100};h.textContent='Cena: '+r+'% wartości'+(ok?'':' (dozwolone ${M.MIN_RATIO * 100}–${M.MAX_RATIO * 100}%)')+' · po podatku otrzymasz '+Math.floor(ba*(1-T)).toLocaleString('pl-PL');h.className='small mk-hint'+(ok?'':' bad');};
f.addEventListener('input',u);u();})();</script>`;
  return layout({ title: 'Rynek', user, st, flash, active: 'kolonia', body: `
  <section class="card arena-head market-head">${pi('market', 88, 'float')}<div class="grow"><small class="tut-k">Handel</small><h2>Rynek surowców</h2>
    <small class="muted">Podatek ${Math.round(M.TAX * 100)}% od sprzedaży · do ${M.MAX_OPEN} ofert · ${M.MAX_BUYS_DAY} zakupów na dobę</small></div></section>
  <section class="card"><h3 class="with-ic">${ic('gift', 'acc')} Wystaw ofertę</h3><p class="muted small">Surowce trafiają do depozytu do czasu sprzedaży (oferta ważna 48 h, wycofanie zwraca depozyt). Handel między kontami z tego samego połączenia lub urządzenia jest zablokowany.</p>${form}</section>
  <section class="card"><h3 class="with-ic">${pi('market', 30)} Oferty</h3>${seg}${list}</section>
  <section class="card"><h3 class="with-ic">${ic('log', 'acc')} Moje oferty</h3>${my}${hi ? `<h4 class="muted small" style="margin:14px 0 6px">Historia</h4><ul class="mk-hist">${hi}</ul>` : ''}</section>
  ${script}` });
}

export function referrals({ user, st, flash, code, link, invited, now }) {
  const stLabel = (i) => (i.ref_state === RF.STATE.rewarded ? `<span class="ok-tag">${ic('check')} nagrodzone</span>`
    : i.ref_state === RF.STATE.blocked ? '<span class="bad-tag">zablokowane</span>'
    : i.ref_state === RF.STATE.limit ? '<span class="bad-tag">limit</span>'
    : `<span class="muted small">poz. ${i.level}/${RF.LEVEL}</span>`);
  const list = invited.length ? invited.map((i) => `<div class="item"><span class="avatar">${esc(i.username.slice(0, 1).toUpperCase())}</span><div class="grow"><b>${esc(i.username)}</b>
      <div class="bar sm"><i style="width:${Math.min(100, Math.round((i.level / RF.LEVEL) * 100))}%"></i></div></div>${stLabel(i)}</div>`).join('')
    : '<p class="muted">Nikt jeszcze nie dołączył z Twojego linku.</p>';
  const done = invited.filter((i) => i.ref_state === RF.STATE.rewarded).length;
  return layout({ title: 'Zaproś znajomych', user, st, flash, active: 'kolonia', body: `
  <section class="card arena-head invite-head">${pi('invite', 88, 'float')}<div class="grow"><small class="tut-k">Zaproszenia</small><h2>Zaproś znajomych</h2>
    <small class="muted">Gdy znajomy osiągnie <b>poziom ${RF.LEVEL}</b>, oboje dostajecie nagrody.</small></div></section>
  <section class="card"><h3>Twój link</h3>
    <div class="ref-link"><input id="ref-link" value="${esc(link)}" readonly aria-label="Link polecający"><button type="button" class="btn sm primary" data-copy="#ref-link">Kopiuj</button></div>
    <button type="button" class="btn wide" data-share data-url="${esc(link)}" hidden>${ic('users')} Udostępnij</button>
    <p class="muted small">Kod: <b>${esc(code)}</b></p></section>
  <section class="card"><h3 class="with-ic">${ic('gift', 'acc')} Nagrody</h3>
    <div class="ref-rw"><div><small class="muted">Ty</small><div class="chips">${rewardChips(RF.INVITER_REWARD, 14)}</div></div>
    <div><small class="muted">Znajomy</small><div class="chips">${rewardChips(RF.INVITEE_REWARD, 14)}</div></div></div>
    <p class="muted small">Nagradzanych zaproszeń: ${done}/${RF.MAX_REWARDED}. Konta z tego samego połączenia lub urządzenia nie otrzymują nagród (ochrona przed multikontami).</p></section>
  <section class="card"><h3 class="with-ic">${ic('users', 'acc')} Zaproszeni (${invited.length})</h3>${list}</section>
  <script>(()=>{const b=document.querySelector('[data-copy]');b&&b.addEventListener('click',async()=>{const i=document.querySelector(b.dataset.copy);i.select();try{await navigator.clipboard.writeText(i.value);}catch{document.execCommand('copy');}b.textContent='Skopiowano!';setTimeout(()=>b.textContent='Kopiuj',1800);});
const s=document.querySelector('[data-share]');if(s&&navigator.share){s.hidden=false;s.addEventListener('click',()=>navigator.share({title:'Kolonie',text:'Dołącz do mnie w Koloniach – darmowej kosmicznej grze w przeglądarce!',url:s.dataset.url}).catch(()=>{}));}})();</script>` });
}
