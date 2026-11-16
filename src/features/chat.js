// Etap 4: czat globalny i korporacyjny (odpytywanie HTTP, limity, filtr wulgaryzmów, escapowanie).
import { clean, limiter, MAX_LEN } from '../chat.js';
import { layout, esc } from '../views.js';
import { pi, ic } from '../icons.js';

const HISTORY = 50;

export default function registerChat({ app, db, auth, page, wantsJson, respond }) {
  const limit = limiter();
  /** 'g' – globalny, 'k' – korporacja gracza. Zwraca id kanału w bazie albo null (brak dostępu). */
  const channel = (u, k) => (k === 'k' ? (u.corp_id ? `c${u.corp_id}` : null) : 'g');
  const out = (r) => ({ id: Number(r.id), userId: Number(r.user_id), user: r.username, tag: r.tag || '', text: r.text, at: Number(r.created_at) });
  const recent = async (ch, after = 0) => (after > 0
    ? await db.all('SELECT * FROM chat_messages WHERE channel = ? AND id > ? ORDER BY id ASC LIMIT 100', [ch, after])
    : (await db.all('SELECT * FROM chat_messages WHERE channel = ? ORDER BY id DESC LIMIT ?', [ch, HISTORY])).reverse());

  app.get('/czat', auth, page(async (req, now, st) => {
    const u = req.user;
    const k = req.query.kanal === 'k' && u.corp_id ? 'k' : 'g';
    const msgs = (await recent(channel(u, k))).map(out);
    const last = msgs.length ? msgs[msgs.length - 1].id : 0;
    const tz = { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' };
    const li = (m) => `<li class="msg${m.userId === u.id ? ' me' : ''}"><div class="mh"><b>${esc(m.user)}</b>${m.tag ? ` <span class="corp">[${esc(m.tag)}]</span>` : ''}<time>${new Date(m.at).toLocaleTimeString('pl-PL', tz)}</time></div><p>${esc(m.text)}</p></li>`;
    const corpTab = u.corp_id ? `<a href="/czat?kanal=k" class="${k === 'k' ? 'on' : ''}">${pi('corp', 22, 'inl')}Korporacja</a>`
      : `<a href="/korporacja" class="off" title="Dołącz do korporacji, aby pisać na jej kanale">${ic('lock')}Korporacja</a>`;
    const body = `
    <section class="chat-head card">${pi('chat', 64, 'float')}<div class="grow"><h2>Łączność podprzestrzenna</h2><small class="muted">${k === 'k' ? 'Kanał tylko dla Twojej korporacji' : 'Kanał ogólny – piszą wszyscy komandorzy'}</small></div></section>
    <div class="seg">${`<a href="/czat" class="${k === 'g' ? 'on' : ''}">${pi('chat', 22, 'inl')}Globalny</a>`}${corpTab}</div>
    <section id="chat" class="card chat" data-kanal="${k}" data-me="${u.id}" data-last="${last}">
      <ol class="msgs" data-msgs aria-live="polite">${msgs.length ? msgs.map(li).join('') : '<li class="empty muted">Cisza w eterze. Napisz pierwszą wiadomość!</li>'}</ol>
      <p class="flash err" data-err hidden></p>
      <form method="post" action="/czat/wyslij" class="chat-form" data-keep autocomplete="off">
        <input type="hidden" name="kanal" value="${k}">
        <input name="tekst" maxlength="${MAX_LEN}" required placeholder="Napisz wiadomość…" aria-label="Wiadomość" enterkeyhint="send">
        <button class="btn" aria-label="Wyślij">${ic('up', 'send')}</button>
      </form>
      <small class="muted chat-rules"><span data-count>0/${MAX_LEN}</span> · maks. ${MAX_LEN} znaków, bez spamu i wulgaryzmów</small>
    </section>`;
    return layout({ title: 'Czat', user: u, st, flash: req.flash, active: 'czat', body, head: '<script src="/chat.js?v=11" defer></script>' });
  }));

  app.get('/api/czat', auth, async (req, res, next) => {
    try {
      const ch = channel(req.user, req.query.kanal);
      if (!ch) return res.status(403).json({ ok: false, msg: 'Kanał tylko dla członków korporacji.' });
      const after = Math.max(0, Number(req.query.po) || 0);
      res.set('Cache-Control', 'no-store').json({ ok: true, messages: (await recent(ch, after)).map(out) });
    } catch (e) { next(e); }
  });

  const post = async (req, res, next) => {
    const back = `/czat${req.body?.kanal === 'k' ? '?kanal=k' : ''}`;
    const reply = (ok, msg, data = {}, code = 400) => {
      if (wantsJson(req)) return res.status(ok ? 200 : code).json({ ok, msg, ...data });
      respond(req, res, { ok, msg, redirect: back });
    };
    try {
      const u = req.user;
      const ch = channel(u, req.body?.kanal);
      if (!ch) return reply(false, 'Kanał tylko dla członków korporacji.', {}, 403);
      const c = clean(req.body?.tekst);
      if (c.error) return reply(false, c.error);
      const now = Date.now();
      const lim = limit(u.id, now);
      if (lim) return reply(false, lim, {}, 429);
      const dup = await db.get('SELECT text FROM chat_messages WHERE user_id = ? AND channel = ? AND created_at > ? ORDER BY id DESC LIMIT 1', [u.id, ch, now - 60_000]);
      if (dup && dup.text === c.text) return reply(false, 'Ta sama wiadomość przed chwilą – bez spamu.', {}, 429);
      const tag = u.corp_id ? (await db.get('SELECT tag FROM corps WHERE id = ?', [u.corp_id]))?.tag : null;
      const id = await db.insert('INSERT INTO chat_messages (channel, user_id, username, tag, text, created_at) VALUES (?, ?, ?, ?, ?, ?)', [ch, u.id, u.username, tag || null, c.text, now]);
      reply(true, 'Wysłano.', { message: out({ id, user_id: u.id, username: u.username, tag, text: c.text, created_at: now }) });
    } catch (e) { next(e); }
  };
  app.post('/api/czat', auth, post);
  app.post('/czat/wyslij', auth, post);
}
