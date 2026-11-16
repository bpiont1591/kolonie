// Etap v5/4: zaproszenia znajomych (czyste reguły).
export const LEVEL = 5;
export const MAX_REWARDED = 20;
export const INVITER_REWARD = { metal: 2000, crystal: 1000, energy: 500, core: 1 };
export const INVITEE_REWARD = { metal: 1000, crystal: 500, energy: 300 };
export const CODE_RE = /^[a-z2-9]{8}$/;
const ALPH = 'abcdefghjkmnpqrstuvwxyz23456789';
export const newCode = (rnd) => Array.from({ length: 8 }, () => ALPH[Math.floor(rnd() * ALPH.length)]).join('');
/** ref_state: 0 – w trakcie, 1 – nagrodzone, 2 – zablokowane (to samo IP/urządzenie), 3 – limit zaproszeń */
export const STATE = { pending: 0, rewarded: 1, blocked: 2, limit: 3 };
