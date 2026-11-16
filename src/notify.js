// Punkt wysyłki powiadomień (ustawiany przez moduł Web Push; domyślnie nic nie robi).
export const N = {
  /** send(userId, {title, body, url, tag}) */
  send: async () => 0,
  /** toCorp(corpId, exceptUserId, payload) */
  toCorp: async () => 0,
};
export const fire = (fn) => setImmediate(() => Promise.resolve().then(fn).catch((e) => console.error('push:', e.message)));
