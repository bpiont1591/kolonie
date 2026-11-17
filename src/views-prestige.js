// v7/4: widok prestiżu „Odrodzenie”.
import { layout, esc, pBadge } from './views.js';
import { ic, pi } from './icons.js';
import * as PS from './prestige.js';

export function prestige({ user, st, flash, pv }) {
  const pct = Math.min(100, Math.round((user.level / PS.MIN_LEVEL) * 100));
  const next = pv.rank + 1;
  const perks = Object.values(PS.PERKS).map((p) => {
    const l = pv.perks[p.id] || 0, cost = PS.perkCost(l), max = l >= p.max;
    return `<div class="perk${l ? ' have' : ''}"><div class="grow"><b>${p.name}</b> <small class="muted">${l}/${p.max}</small><br><small>${p.desc} na poziom${l ? ` · teraz: <b>${p.rp ? `+${l * p.rp} PB` : Object.values(p.per).map((v) => `+${Math.round(v * l * 100)}%`)[0]}</b>` : ''}</small>
      <div class="bar sm"><i style="width:${Math.round((l / p.max) * 100)}%"></i></div></div>
      ${max ? `<small class="t-ok">${ic('check')} maks.</small>` : `<form method="post" action="/odrodzenie/ulepsz/${p.id}"><button class="btn-claim" ${pv.pp >= cost ? '' : 'disabled'}>+1 · ${cost} PP</button></form>`}</div>`;
  }).join('');
  return layout({ title: 'Odrodzenie', user, st, flash, active: 'statek', body: `
  <section class="card arena-head prestige-head"><span class="big-glyph">${ic('prestige', 'gold-ic')}</span><div class="grow"><small class="tut-k">Prestiż</small>
    <h2>Odrodzenie ${pBadge(pv.rank)}</h2>
    <small class="muted">${pv.rank ? `Ranga ${pv.rank} – ${PS.rankName(pv.rank)} · stałe +${Math.round(PS.RANK_BONUS.xp * pv.rank * 100)}% XP i +${Math.round(PS.RANK_BONUS.prod * pv.rank * 100)}% wydobycia` : 'Od 50. poziomu możesz zacząć od nowa – silniejszy niż kiedykolwiek.'}</small>
    <div class="pp-line">${ic('prestige', 'gold-ic')} <b>${pv.pp}</b> punktów prestiżu do wydania</div></div></section>
  ${pv.can ? `<p class="callout gold"><span class="big-glyph sm">${ic('prestige', 'gold-ic')}</span><span class="grow"><b>Odrodzenie dostępne!</b><br><small>Za poziom ${user.level}: +${pv.gain} PP i ranga ${next} (${PS.rankName(next)}).</small></span></p>`
    : `<section class="card"><h3 class="with-ic">${ic('lock')} Odrodzenie od poziomu ${PS.MIN_LEVEL}</h3><div class="bar"><i style="width:${pct}%"></i><span>poziom ${user.level} / ${PS.MIN_LEVEL}</span></div>
      <p class="muted small">Na poziomie 50 dostaniesz 5 PP, a za każde kolejne pełne 5 poziomów – 2 PP więcej.</p></section>`}
  <div class="duo pr-cols">
    <section class="card pr-lose"><h3 class="with-ic">${ic('reset')} Tracisz</h3><ul>${pv.loses.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
    <section class="card pr-keep"><h3 class="with-ic">${ic('check')} Zachowujesz</h3><ul>${pv.keeps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
  </div>
  <section class="card pr-gain"><h3 class="with-ic">${ic('starf', 'gold-ic')} Zyskujesz</h3><ul>
    <li><b>+${pv.can ? pv.gain : PS.ppFor(PS.MIN_LEVEL)} PP</b> na stałe ulepszenia poniżej</li>
    <li>rangę prestiżu <b>${next}</b> – znak ${pBadge(next)} przy nicku i w rankingach oraz osobny ranking prestiżu</li>
    <li>stały bonus za każdą rangę: <b>+${Math.round(PS.RANK_BONUS.xp * 100)}% XP</b> i <b>+${Math.round(PS.RANK_BONUS.prod * 100)}% wydobycia</b></li></ul></section>
  <section class="card"><h3 class="with-ic">${ic('reset', 'acc')} Potwierdzenie</h3>
    ${pv.can ? `<form method="post" action="/odrodzenie" class="pr-confirm" onsubmit="return confirm('Na pewno? Wrócisz na poziom 1, stracisz technologie i poziomy modułów statku. Tej operacji nie można cofnąć.')">
      <label class="small">Wpisz <b>ODRODZENIE</b>, aby potwierdzić:<input name="confirm" autocomplete="off" placeholder="ODRODZENIE" required pattern="[Oo][Dd][Rr][Oo][Dd][Zz][Ee][Nn][Ii][Ee]"></label>
      <button class="btn danger wide">${ic('prestige')} Odródź się · ranga ${next}</button></form>`
    : `<button class="btn wide" disabled>${ic('lock')} Dostępne od poziomu ${PS.MIN_LEVEL}</button>`}</section>
  <section class="card"><h3 class="with-ic">${ic('up', 'acc')} Stałe ulepszenia prestiżu</h3><p class="muted small">Kupione raz, zostają na zawsze – także po kolejnych odrodzeniach. Poziom n kosztuje n PP.</p><div class="perks">${perks}</div></section>
  <div class="duo"><a class="btn wide" href="/ranking?tab=prestiz">${pi('trophy', 22, 'inl')} Ranking prestiżu</a><a class="btn wide" href="/statek">${ic('login', 'flip')} Statek</a></div>` });
}
