// v9/1: tarcza nowicjusza – czyste reguły (bez bazy).
export const DAYS = 3;          // tarcza trwa do 3 dni od rejestracji…
export const MAX_LEVEL = 8;     // …albo do osiągnięcia poziomu 8 (co nastąpi wcześniej)
export const MS = DAYS * 86400_000;
/** Czy gracz jest chroniony tarczą nowicjusza w chwili `now`. */
export const shielded = (u, now) => Number(u?.newbie_until || 0) > now && Number(u?.level || 1) < MAX_LEVEL;
/** Ile ms zostało (0 = brak tarczy). */
export const left = (u, now) => (shielded(u, now) ? Number(u.newbie_until) - now : 0);
