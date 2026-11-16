// Czat: odpytywanie co 4 s (tylko gdy karta jest widoczna), wysyłanie przez fetch. Tekst wstawiany wyłącznie przez textContent.
(() => {
  const box = document.getElementById('chat');
  if (!box) return;
  const list = box.querySelector('[data-msgs]'), form = box.querySelector('form'), input = form.querySelector('input[name=tekst]');
  const err = box.querySelector('[data-err]'), count = box.querySelector('[data-count]');
  const kanal = box.dataset.kanal, me = +box.dataset.me, max = +input.maxLength || 200;
  let last = +box.dataset.last || 0, busy = false;
  const hhmm = (t) => new Date(t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
  const near = () => list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  const scroll = () => { list.scrollTop = list.scrollHeight; };
  function add(m) {
    if (m.id <= last) return;
    last = m.id;
    const li = document.createElement('li');
    li.className = 'msg' + (m.userId === me ? ' me' : '');
    const head = document.createElement('div'); head.className = 'mh';
    const who = document.createElement('b'); who.textContent = m.user; head.append(who);
    if (m.tag) { const t = document.createElement('span'); t.className = 'corp'; t.textContent = `[${m.tag}]`; head.append(' ', t); }
    const time = document.createElement('time'); time.textContent = hhmm(m.at); head.append(time);
    const p = document.createElement('p'); p.textContent = m.text;
    li.append(head, p);
    list.querySelector('.empty')?.remove();
    list.append(li);
    while (list.children.length > 120) list.firstElementChild.remove();
  }
  async function poll() {
    if (document.hidden || busy) return;
    busy = true;
    try {
      const r = await fetch(`/api/czat?kanal=${encodeURIComponent(kanal)}&po=${last}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (r.ok) { const d = await r.json(); const stick = near(); d.messages.forEach(add); if (stick && d.messages.length) scroll(); }
    } catch { /* offline – spróbujemy za chwilę */ } finally { busy = false; }
  }
  const upd = () => { const n = [...input.value].length; count.textContent = `${n}/${max}`; count.classList.toggle('warn', n > max - 20); };
  input.addEventListener('input', upd);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tekst = input.value.trim();
    if (!tekst) return;
    const b = form.querySelector('button'); b.disabled = true; err.hidden = true;
    try {
      const r = await fetch('/api/czat', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ kanal, tekst }) });
      const d = await r.json();
      if (!d.ok) { err.textContent = d.msg; err.hidden = false; }
      else { input.value = ''; upd(); await poll(); scroll(); }
    } catch { err.textContent = 'Brak połączenia – spróbuj ponownie.'; err.hidden = false; }
    setTimeout(() => { b.disabled = false; }, 1200);
    input.focus();
  });
  scroll(); upd();
  setInterval(poll, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
})();
