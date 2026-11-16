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
    if (e.target.hasAttribute('data-keep')) return;
    const b = e.target.querySelector('button');
    if (b) setTimeout(() => { b.disabled = true; }, 0);
  });
  // Instalacja PWA (Android/Chrome)
  const ib = document.getElementById('install-btn');
  let deferred;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; if (ib) ib.hidden = false; });
  if (ib) ib.addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; ib.hidden = true; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

  // Samouczek: podświetlenie wskazanego elementu (body[data-tut-step] = klucz kroku).
  const tk = document.body.dataset.tutStep;
  const target = tk && document.querySelector(`[data-tut="${tk}"]`);
  if (target) {
    target.classList.add('tut-hi');
    const ptr = document.createElement('span');
    ptr.className = 'tut-ptr'; ptr.textContent = 'Tutaj!';
    (target.closest('.upg') || target.parentElement).classList.add('tut-anchor');
    (target.closest('.upg') || target.parentElement).append(ptr);
    setTimeout(() => {
      const r = target.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight - 90) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 700);
  }

  // Web Push: przycisk zgody na powiadomienia (karta na stronie kolonii).
  const pc = document.getElementById('push-card');
  if (pc) {
    const btn = pc.querySelector('[data-push-toggle]'), test = pc.querySelector('[data-push-test]'), st = pc.querySelector('[data-push-status]');
    const say = (m) => { st.textContent = m; };
    const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body || {}) }).then((r) => r.json());
    const u8 = (b64) => { const p = '='.repeat((4 - b64.length % 4) % 4); const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    let sub = null;
    const render = () => {
      btn.hidden = false; btn.disabled = false;
      btn.textContent = sub ? 'Wyłącz powiadomienia' : 'Włącz powiadomienia';
      btn.classList.toggle('ghost', !!sub);
      test.hidden = !sub;
      pc.classList.toggle('on', !!sub);
      if (Notification.permission === 'denied') say('Powiadomienia są zablokowane w ustawieniach przeglądarki.');
      else say(sub ? 'Włączone na tym urządzeniu: ataki, pełny magazyn, budowy, ekspedycje i bossowie.' : 'Dowiedz się od razu, gdy ktoś Cię zaatakuje albo skończy się budowa.');
    };
    if (!ok) say(/iPhone|iPad/.test(navigator.userAgent) ? 'Na iPhonie dodaj Kolonie do ekranu głównego (Udostępnij → Do ekranu początkowego), aby włączyć powiadomienia.' : 'Ta przeglądarka nie obsługuje powiadomień push.');
    else navigator.serviceWorker.ready.then(async (reg) => {
      sub = await reg.pushManager.getSubscription();
      if (sub) post('/api/push/subskrypcja', sub.toJSON()).catch(() => {});
      render();
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          if (sub) {
            await post('/api/push/wypisz', { endpoint: sub.endpoint }).catch(() => {});
            await sub.unsubscribe(); sub = null;
          } else {
            if (await Notification.requestPermission() !== 'granted') { render(); say('Bez zgody przeglądarki nie wyślemy powiadomień.'); return; }
            const k = await fetch('/api/push/klucz', { headers: { accept: 'application/json' } }).then((r) => r.json());
            if (!k.ok) throw new Error(k.msg || 'Powiadomienia są chwilowo niedostępne.');
            sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(k.key) });
            const r = await post('/api/push/subskrypcja', sub.toJSON());
            if (!r.ok) { await sub.unsubscribe(); sub = null; throw new Error(r.msg); }
          }
          render();
        } catch (e) { render(); say(e.message || 'Nie udało się zmienić ustawień powiadomień.'); }
      });
      test.addEventListener('click', async () => {
        test.disabled = true;
        const r = await post('/api/push/test').catch(() => ({ ok: false }));
        say(r.ok ? 'Wysłano powiadomienie testowe.' : (r.msg || 'Nie udało się wysłać testu.'));
        setTimeout(() => { test.disabled = false; }, 3000);
      });
    });
  }
})();
