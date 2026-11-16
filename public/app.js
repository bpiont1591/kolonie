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
