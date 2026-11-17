// Etap 3: korporacje – role, skarbiec i ulepszenia, wojna o sektor, boss rajdowy.
import { N, fire } from '../notify.js';
import * as R from '../rules.js';
import * as C from '../corp.js';
import * as G from '../game.js';
import { fail } from '../game.js';
import { weekStart, dur } from '../time.js';
import * as VC from '../views-corp.js';
import { dropItem } from './gear.js';

export default function registerCorp({ app, db, auth, page, action, payable, costText, preBattle, settledHooks, devHooks }) {
  const members = (q, corpId) => q.all('SELECT id, username, title, level, xp, prestige, pvp_points, corp_role, s_hull, s_guns, s_shields FROM users WHERE corp_id = ? ORDER BY CASE corp_role WHEN \'leader\' THEN 0 WHEN \'officer\' THEN 1 ELSE 2 END, level DESC, xp DESC', [corpId]);
  const need = (u) => u.corp_id || fail('Nie należysz do żadnej korporacji.');
  const needRole = (u) => C.canManage(u.corp_role) || fail('Tylko przywódca lub oficer może to zrobić.');

  /** Aktualny boss (z wygaszeniem po czasie). */
  async function currentBoss(q, corpId, now) {
    const b = await q.get('SELECT * FROM bosses WHERE corp_id = ? ORDER BY id DESC LIMIT 1', [corpId]);
    if (b && b.status === 'active' && b.ends_at <= now) {
      await q.run("UPDATE bosses SET status = 'escaped', ended_at = ? WHERE id = ? AND status = 'active'", [b.ends_at, b.id]);
      b.status = 'escaped'; b.ended_at = b.ends_at;
    }
    return b;
  }
  async function warState(q, now, corpId) {
    const week = weekStart(now);
    const rows = await q.all('SELECT w.planet, w.corp_id, w.points, c.tag, c.name FROM war_points w JOIN corps c ON c.id = w.corp_id WHERE w.week = ? AND w.points > 0', [week]);
    const ctl = C.control(rows);
    const standings = {};
    for (const r of Object.values(ctl)) { standings[r.corp_id] ??= { corp_id: r.corp_id, tag: r.tag, name: r.name, planets: 0, points: 0 }; standings[r.corp_id].planets++; }
    for (const r of rows) if (standings[r.corp_id]) standings[r.corp_id].points += r.points;
    const prev = await G.weekWinner(q, week - 7);
    const prevCorp = prev ? await q.get('SELECT id, name, tag FROM corps WHERE id = ?', [prev.corp_id]) : null;
    const mine = corpId ? rows.filter((r) => r.corp_id === corpId) : [];
    const contrib = corpId ? await q.all('SELECT u.username, w.points FROM war_contrib w JOIN users u ON u.id = w.user_id WHERE w.week = ? AND w.corp_id = ? ORDER BY w.points DESC LIMIT 10', [week, corpId]) : [];
    return { week, rows, ctl, standings: Object.values(standings).sort((a, b) => b.planets - a.planets || b.points - a.points), prev: prev && prevCorp ? { ...prev, ...prevCorp } : null, mine, contrib };
  }

  // ---------- strony ----------
  app.get('/korporacja', auth, page(async (req, now, st) => {
    const u = req.user;
    if (u.corp_id && u._corp) {
      const log = await db.all('SELECT * FROM corp_log WHERE corp_id = ? ORDER BY id DESC LIMIT 12', [u.corp_id]);
      return VC.corpHome({ user: u, st, flash: req.flash, c: u._corp, members: await members(db, u.corp_id), log, now });
    }
    const corps = await db.all(`SELECT c.id, c.name, c.tag, c.u_hq, COUNT(u.id) AS members, COALESCE(SUM(u.level), 0) AS power
      FROM corps c LEFT JOIN users u ON u.corp_id = c.id GROUP BY c.id, c.name, c.tag, c.u_hq ORDER BY power DESC LIMIT 30`);
    return VC.corpList({ user: u, st, flash: req.flash, corps });
  }));
  app.get('/korporacja/wojna', auth, page(async (req, now, st) => VC.war({ user: req.user, st, flash: req.flash, w: await warState(db, now, req.user.corp_id), now })));
  app.get('/korporacja/boss', auth, page(async (req, now, st) => {
    const u = req.user;
    if (!u.corp_id) return VC.noCorp({ user: u, st, flash: req.flash, what: 'bossem rajdowym' });
    const b = await currentBoss(db, u.corp_id, now);
    const hits = b ? await db.all('SELECT h.*, u.username FROM boss_hits h JOIN users u ON u.id = h.user_id WHERE h.boss_id = ? ORDER BY h.damage DESC', [b.id]) : [];
    return VC.boss({ user: u, st, flash: req.flash, b, hits, now });
  }));
  app.get('/api/korporacja', auth, async (req, res, next) => {
    try {
      const u = req.user, now = Date.now();
      if (!u.corp_id) return res.json({ ok: true, corp: null, war: await warState(db, now, null) });
      const b = await currentBoss(db, u.corp_id, now);
      const hits = b ? await db.all('SELECT user_id, damage, attacks, claimed FROM boss_hits WHERE boss_id = ?', [b.id]) : [];
      res.set('Cache-Control', 'no-store').json({ ok: true, corp: u._corp, role: u.corp_role, members: await members(db, u.corp_id), boss: b, hits, war: await warState(db, now, u.corp_id) });
    } catch (e) { next(e); }
  });

  // ---------- członkostwo ----------
  app.post('/korporacja/zaloz', auth, action('/korporacja', async (t, u, now, req) => {
    if (u.corp_id) fail('Najpierw opuść obecną korporację.');
    const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
    const tag = String(req.body.tag || '').trim().toUpperCase();
    if (!/^[\p{L}\p{N} ._-]{3,24}$/u.test(name)) fail('Nazwa: 3–24 znaki (litery, cyfry, spacje).');
    if (!/^[A-Z0-9]{2,4}$/.test(tag)) fail('TAG: 2–4 wielkie litery lub cyfry.');
    if (!payable(u, R.CORP_COST)) fail(`Brakuje surowców. Koszt: ${costText(R.CORP_COST)}`);
    if (await t.get('SELECT id FROM corps WHERE name_key = ? OR tag = ?', [name.toLowerCase(), tag])) fail('Nazwa lub TAG są już zajęte.');
    const corpId = await t.insert('INSERT INTO corps (name, name_key, tag, owner_id, created_at) VALUES (?, ?, ?, ?, ?)', [name, name.toLowerCase(), tag, u.id, now]);
    await t.run("UPDATE users SET corp_id = ?, corp_role = 'leader', metal = metal - ?, crystal = crystal - ? WHERE id = ?", [corpId, R.CORP_COST.metal, R.CORP_COST.crystal, u.id]);
    await G.corpLog(t, corpId, now, `${u.username} zakłada korporację.`);
    return { msg: `Założono korporację ${name} [${tag}]!`, data: { corpId } };
  }));
  app.post('/korporacja/dolacz/:id', auth, action('/korporacja', async (t, u, now, req) => {
    if (u.corp_id) fail('Już należysz do korporacji.');
    const c = await t.get('SELECT * FROM corps WHERE id = ?', [Number(req.params.id) || 0]) || fail('Nie ma takiej korporacji.');
    const n = (await t.get('SELECT COUNT(*) AS n FROM users WHERE corp_id = ?', [c.id])).n;
    if (n >= C.memberCap(c)) fail('Korporacja jest pełna.');
    await t.run("UPDATE users SET corp_id = ?, corp_role = 'member' WHERE id = ?", [c.id, u.id]);
    await G.corpLog(t, c.id, now, `${u.username} dołącza do korporacji.`);
    return { msg: `Dołączyłeś do ${c.name} [${c.tag}]!`, data: { corpId: c.id } };
  }));
  async function removeMember(t, c, m, now, text) {
    await t.run("UPDATE users SET corp_id = NULL, corp_role = 'member' WHERE id = ?", [m.id]);
    if (m.corp_role === 'leader') {
      const heir = await t.get(`SELECT id, username FROM users WHERE corp_id = ? ORDER BY CASE corp_role WHEN 'officer' THEN 0 ELSE 1 END, level DESC, id ASC LIMIT 1`, [c.id]);
      if (heir) {
        await t.run("UPDATE users SET corp_role = 'leader' WHERE id = ?", [heir.id]);
        await t.run('UPDATE corps SET owner_id = ? WHERE id = ?', [heir.id, c.id]);
        await G.corpLog(t, c.id, now, `${heir.username} przejmuje dowodzenie.`);
      } else { await t.run('DELETE FROM corps WHERE id = ?', [c.id]); return; }
    }
    await G.corpLog(t, c.id, now, text);
  }
  app.post('/korporacja/opusc', auth, action('/korporacja', async (t, u, now) => {
    need(u);
    const c = await t.get('SELECT * FROM corps WHERE id = ?', [u.corp_id]);
    await removeMember(t, c, u, now, `${u.username} opuszcza korporację.`);
    return { msg: 'Opuściłeś korporację.' };
  }));
  const target = async (t, u, req) => {
    const m = await t.get('SELECT id, username, corp_id, corp_role FROM users WHERE id = ?', [Number(req.params.id) || 0]);
    if (!m || m.corp_id !== u.corp_id) fail('Ten gracz nie należy do Twojej korporacji.');
    if (m.id === u.id) fail('Nie możesz tego zrobić sobie.');
    return m;
  };
  app.post('/korporacja/awans/:id', auth, action('/korporacja', async (t, u, now, req) => {
    need(u); if (u.corp_role !== 'leader') fail('Tylko przywódca nadaje stopnie.');
    const m = await target(t, u, req);
    if (m.corp_role === 'member') {
      await t.run("UPDATE users SET corp_role = 'officer' WHERE id = ?", [m.id]);
      await G.corpLog(t, u.corp_id, now, `${m.username} awansuje na oficera.`);
      return { msg: `${m.username} jest teraz oficerem.`, data: { role: 'officer' } };
    }
    // oficer -> przywódca (przekazanie dowodzenia)
    await t.run("UPDATE users SET corp_role = 'leader' WHERE id = ?", [m.id]);
    await t.run("UPDATE users SET corp_role = 'officer' WHERE id = ?", [u.id]);
    await t.run('UPDATE corps SET owner_id = ? WHERE id = ?', [m.id, u.corp_id]);
    await G.corpLog(t, u.corp_id, now, `${u.username} przekazuje dowodzenie: ${m.username}.`);
    return { msg: `${m.username} przejmuje dowodzenie korporacją.`, data: { role: 'leader' } };
  }));
  app.post('/korporacja/degraduj/:id', auth, action('/korporacja', async (t, u, now, req) => {
    need(u); if (u.corp_role !== 'leader') fail('Tylko przywódca odbiera stopnie.');
    const m = await target(t, u, req);
    if (m.corp_role !== 'officer') fail('Ten gracz nie jest oficerem.');
    await t.run("UPDATE users SET corp_role = 'member' WHERE id = ?", [m.id]);
    await G.corpLog(t, u.corp_id, now, `${m.username} traci stopień oficera.`);
    return { msg: `${m.username} jest teraz członkiem.`, data: { role: 'member' } };
  }));
  app.post('/korporacja/wyrzuc/:id', auth, action('/korporacja', async (t, u, now, req) => {
    need(u); needRole(u);
    const m = await target(t, u, req);
    if (m.corp_role === 'leader' || (m.corp_role === 'officer' && u.corp_role !== 'leader')) fail('Nie możesz wyrzucić gracza o równym lub wyższym stopniu.');
    await removeMember(t, u._corp, m, now, `${m.username} zostaje usunięty przez ${u.username}.`);
    return { msg: `${m.username} został usunięty z korporacji.` };
  }));

  // ---------- skarbiec i ulepszenia ----------
  app.post('/korporacja/wplac', auth, action('/korporacja', async (t, u, now, req) => {
    need(u);
    const amt = {};
    for (const k of R.RES_KEYS) amt[k] = Math.max(0, Math.floor(Number(req.body[k]) || 0));
    if (R.RES_KEYS.every((k) => amt[k] === 0)) fail('Podaj, ile surowców chcesz wpłacić.');
    if (R.RES_KEYS.some((k) => amt[k] > 0 && amt[k] < C.MIN_DONATION)) fail(`Minimalna wpłata to ${C.MIN_DONATION} jednostek.`);
    if (!payable(u, amt)) fail('Nie masz tylu surowców w magazynie.');
    await t.run('UPDATE users SET metal = metal - ?, crystal = crystal - ?, energy = energy - ? WHERE id = ?', [amt.metal, amt.crystal, amt.energy, u.id]);
    await t.run('UPDATE corps SET t_metal = t_metal + ?, t_crystal = t_crystal + ?, t_energy = t_energy + ? WHERE id = ?', [amt.metal, amt.crystal, amt.energy, u.corp_id]);
    await G.corpLog(t, u.corp_id, now, `${u.username} wpłaca do skarbca: ${costText(amt)}.`);
    await G.track(t, u.id, now, { donate: amt.metal + amt.crystal + amt.energy });
    return { msg: `Wpłacono do skarbca: ${costText(amt)}`, data: { donated: amt } };
  }));
  app.post('/korporacja/ulepsz/:k', auth, action('/korporacja', async (t, u, now, req) => {
    need(u); needRole(u);
    const def = Object.hasOwn(C.UPGRADES, req.params.k) ? C.UPGRADES[req.params.k] : fail('Nieznane ulepszenie.');
    const c = u._corp, lvl = c[def.col];
    if (lvl >= def.max) fail('Maksymalny poziom ulepszenia.');
    const cost = C.upgradeCost(def, lvl);
    if (c.t_metal < cost.metal || c.t_crystal < cost.crystal || c.t_energy < cost.energy) fail(`Za mało surowców w skarbcu. Koszt: ${costText(cost)}`);
    await t.run(`UPDATE corps SET t_metal = t_metal - ?, t_crystal = t_crystal - ?, t_energy = t_energy - ?, ${def.col} = ${def.col} + 1 WHERE id = ?`, [cost.metal, cost.crystal, cost.energy, c.id]);
    await G.corpLog(t, c.id, now, `${u.username} ulepsza: ${def.name} → poz. ${lvl + 1}.`);
    return { msg: `${def.name}: poziom ${lvl + 1}!`, data: { upgrade: req.params.k, level: lvl + 1 } };
  }));

  // ---------- wojna ----------
  app.post('/korporacja/cel/:planet', auth, action('/korporacja/wojna', async (t, u, now, req) => {
    need(u); needRole(u);
    const p = C.PLANETS.find((x) => x.id === Number(req.params.planet)) || fail('Nie ma takiej planety.');
    await t.run('UPDATE corps SET war_target = ? WHERE id = ?', [p.id, u.corp_id]);
    await G.corpLog(t, u.corp_id, now, `${u.username} wyznacza cel wojny: ${p.name}.`);
    return { msg: `Cel korporacji: ${p.name}. Zwycięstwa członków dają punkty na tej planecie.`, data: { target: p.id } };
  }));

  // ---------- boss rajdowy ----------
  app.post('/korporacja/boss/wezwij', auth, action('/korporacja/boss', async (t, u, now) => {
    need(u); needRole(u);
    const b = await currentBoss(t, u.corp_id, now);
    if (b && b.status === 'active') fail('Boss już atakuje sektor!');
    if (b && b.ended_at + C.BOSS.cooldownH * 3600_000 > now) fail(`Kolejnego bossa można wezwać za ${dur(b.ended_at + C.BOSS.cooldownH * 3600_000 - now)}.`);
    const ms = await members(t, u.corp_id);
    const levels = ms.reduce((a, m) => a + m.level, 0);
    const level = Math.max(1, Math.round(levels / ms.length));
    const hp = C.bossHp(levels);
    const id = await t.insert("INSERT INTO bosses (corp_id, level, max_hp, hp, spawned_at, ends_at, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
      [u.corp_id, level, hp, hp, now, now + C.BOSS.hours * 3600_000]);
    await G.corpLog(t, u.corp_id, now, `${u.username} namierza bossa: ${C.BOSS.name} (poz. ${level}).`);
    for (const h of bossHooks) Promise.resolve(h(u.corp_id, { id, level, hp }, u)).catch(() => {});
    return { msg: `${C.BOSS.name} pojawia się w sektorze! Macie ${C.BOSS.hours} h.`, data: { bossId: id, hp, level } };
  }));
  app.post('/korporacja/boss/atak', auth, action('/korporacja/boss', async (t, u, now) => {
    need(u);
    const b = await currentBoss(t, u.corp_id, now);
    if (!b || b.status !== 'active') fail('Brak aktywnego bossa.');
    const me = preBattle(u, now, C.BOSS.energy);
    const hit = C.bossHit(me.atk, R.labBonus(u));
    const dmg = Math.min(b.hp, hit.dmg);
    const hp = Math.max(1, Math.round(me.hp - hit.counter * me.maxHp));
    await t.run('UPDATE users SET energy = energy - ?, hp = ?, hp_at = ?, last_battle_at = ? WHERE id = ?', [me.cost, hp, now, now, u.id]);
    await t.run(`INSERT INTO boss_hits (boss_id, user_id, damage, attacks) VALUES (?, ?, ?, 1)
      ON CONFLICT (boss_id, user_id) DO UPDATE SET damage = boss_hits.damage + excluded.damage, attacks = boss_hits.attacks + 1`, [b.id, u.id, dmg]);
    const left = b.hp - dmg;
    if (left <= 0) {
      await t.run("UPDATE bosses SET hp = 0, status = 'killed', ended_at = ? WHERE id = ?", [now, b.id]);
      await G.corpLog(t, u.corp_id, now, `${u.username} zadaje ostateczny cios! ${C.BOSS.name} zniszczona.`);
    } else await t.run('UPDATE bosses SET hp = hp - ? WHERE id = ?', [dmg, b.id]);
    await G.warPoints(t, u, now, C.WAR_POINTS.boss);
    await G.track(t, u.id, now, { boss: 1, energy: me.cost });
    return { msg: `${hit.crit ? 'Trafienie krytyczne! ' : ''}Zadano ${dmg} obrażeń. Kontratak: −${me.hp - hp} HP.${left <= 0 ? ' Boss zniszczony!' : ''}`,
      data: { damage: dmg, crit: hit.crit, bossHp: Math.max(0, left), killed: left <= 0 } };
  }));
  app.post('/korporacja/boss/odbierz/:id', auth, action('/korporacja/boss', async (t, u, now, req) => {
    need(u);
    const b = await t.get('SELECT * FROM bosses WHERE id = ? AND corp_id = ?', [Number(req.params.id) || 0, u.corp_id]) || fail('Nie ma takiego bossa.');
    const cur = await currentBoss(t, u.corp_id, now);
    const status = cur && cur.id === b.id ? cur.status : b.status;
    if (status === 'active') fail('Walka jeszcze trwa.');
    const hits = await t.all('SELECT user_id, damage, claimed FROM boss_hits WHERE boss_id = ? ORDER BY damage DESC', [b.id]);
    const mine = hits.find((h) => h.user_id === u.id) || fail('Nie brałeś udziału w tej walce.');
    if (mine.claimed) fail('Nagroda już odebrana.');
    const total = hits.reduce((a, h) => a + h.damage, 0);
    const killed = status === 'killed';
    const rw = C.bossShare(C.bossPool(b.level, hits.length, killed), mine.damage, total, hits.length);
    if (killed && hits[0].user_id === u.id) rw.core = 1; // najwięcej obrażeń -> Rdzeń kwantowy
    await t.run('UPDATE boss_hits SET claimed = 1 WHERE boss_id = ? AND user_id = ?', [b.id, u.id]);
    const got = await G.grant(t, u, now, rw);
    const drop = killed ? await dropItem(t, u, now, hits[0].user_id === u.id ? 'raidTop' : 'raid') : null;
    return { msg: `${killed ? 'Łupy z bossa' : 'Nagroda pocieszenia'}: ${G.rewardText(got)}${drop?.text || ''}`, data: { reward: got, killed, item: drop?.item || null } };
  }));

  const bossHooks = [(corpId, b, by) => fire(() => N.toCorp(corpId, by.id, {
    title: 'Boss w sektorze!', body: `${C.BOSS.name} (poz. ${b.level}) atakuje. Macie ${C.BOSS.hours} h – do dział, komandorze!`, url: '/korporacja/boss', tag: 'boss' }))];
  registerCorp.bossHooks = bossHooks;
  devHooks.push(async (t, u, ms) => {
    if (u.corp_id) await t.run("UPDATE bosses SET spawned_at = spawned_at - ?, ends_at = ends_at - ?, ended_at = CASE WHEN ended_at > 0 THEN ended_at - ? ELSE 0 END WHERE corp_id = ?", [ms, ms, ms, u.corp_id]);
  });
}
