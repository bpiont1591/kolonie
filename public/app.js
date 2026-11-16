// Lekki klient: żywe liczniki surowców/HP, PWA, blokada podwójnego kliknięcia.
(() => {
  const t0 = performance.now();
  const fmt = (n) => Math.floor(n).toLocaleString('pl-PL');
  const res = [...document.querySelectorAll('[data-live-res]')];
  const hp = document.querySelector('[data-live-hp]');
  function tick() {
    const s = (performance.now() - t0) / 1000;
    for (const el of res) {
      const v = Math.min(+el.dataset.cap, +el.dataset.v + +el.dataset.rate * s);
      el.textContent = fmt(v);
      el.classList.toggle('warn', v >= +el.dataset.cap);
    }
    if (hp) {
      const max = +hp.dataset.max, v = Math.min(max, +hp.dataset.hp + +hp.dataset.rate * s);
      hp.querySelector('[data-hp-text]').textContent = Math.floor(v);
      hp.querySelector('i').style.width = (v / max * 100).toFixed(1) + '%';
    }
  }
  // Odliczanie (data-countdown = znacznik czasu końca w ms); po dojściu do zera odświeża stronę (np. koniec budowy).
  const cds = [...document.querySelectorAll('[data-countdown]')];
  const dur = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min${s % 60 && m < 10 ? ` ${s % 60} s` : ''}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
    return `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ''}`;
  };
  const skew = Date.now() - (+document.body.dataset.now || Date.now());
  let reloading = false;
  function cdTick() {
    const now = Date.now() - skew;
    for (const el of cds) {
      const left = +el.dataset.countdown - now;
      el.textContent = dur(left);
      if (left <= 0 && el.hasAttribute('data-reload') && !reloading) { reloading = true; setTimeout(() => location.reload(), 800); }
    }
  }
  const bars = [...document.querySelectorAll('[data-bar-to]')];
  function barTick() {
    const now = Date.now() - skew;
    for (const b of bars) { const f = +b.dataset.barFrom, t = +b.dataset.barTo; b.style.width = Math.min(100, Math.max(2, (now - f) / (t - f) * 100)).toFixed(1) + '%'; }
  }
  if (cds.length || bars.length) setInterval(() => { cdTick(); barTick(); }, 1000);
  if (res.length || hp) setInterval(tick, 1000);
  document.addEventListener('submit', (e) => {
    const b = e.target.querySelector('button');
    if (b) setTimeout(() => { b.disabled = true; }, 0);
  });
  // Instalacja PWA (Android/Chrome)
  const ib = document.getElementById('install-btn');
  let deferred;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; if (ib) ib.hidden = false; });
  if (ib) ib.addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; ib.hidden = true; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
