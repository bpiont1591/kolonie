// Etap v5/1: samouczek – odbiór nagród za kroki misji startowej i pominięcie.
import * as TUT from '../tutorial.js';
import * as G from '../game.js';
import { fail } from '../game.js';

export default function registerTutorial({ app, auth, action }) {
  app.post('/samouczek/odbierz', auth, action('/kolonia', async (t, u, now) => {
    const s = TUT.state(u, now) || fail('Samouczek nie jest aktywny.');
    if (!s.done) fail(`Najpierw wykonaj zadanie: ${s.title}.`);
    const rw = await G.grant(t, u, now, s.r);
    const next = s.n + 1;
    await t.run('UPDATE users SET tut_step = ?, tut_done = 0 WHERE id = ?', [next, u.id]);
    const ns = TUT.STEPS[next - 1];
    return next > TUT.COUNT
      ? { msg: `Misja startowa ukończona! ${G.rewardText(rw)} Powodzenia, komandorze!`, redirect: '/kolonia', data: { step: next, finished: true, reward: rw } }
      : { msg: `Krok ${s.n}/${TUT.COUNT} zaliczony: ${G.rewardText(rw)}`, redirect: ns.page, data: { step: next, reward: rw } };
  }));
  app.post('/samouczek/pomin', auth, action('/kolonia', async (t, u) => {
    if (!(u.tut_step >= 1 && u.tut_step <= TUT.COUNT)) fail('Samouczek nie jest aktywny.');
    await t.run('UPDATE users SET tut_step = 0, tut_done = 0 WHERE id = ?', [u.id]);
    return { msg: 'Samouczek pominięty. Misje dzienne znajdziesz w zakładce Misje.', data: { step: 0 } };
  }));
}
