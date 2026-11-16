// Czas gry liczony w strefie Europe/Warsaw (reset dzienny o północy, tygodniowy w poniedziałek o północy).
const TZ = 'Europe/Warsaw';
const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtClock = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
/** 'YYYY-MM-DD' w Warszawie. */
export const dayKey = (now) => fmtDay.format(now);
/** Numer dnia (dni od 1970-01-01) według kalendarza warszawskiego. */
export const dayNum = (now) => Math.round(Date.parse(dayKey(now) + 'T00:00:00Z') / 86400000);
/** Numer dnia poniedziałku bieżącego tygodnia (1970-01-05 był poniedziałkiem = dzień 4). */
export const weekStart = (now) => { const d = dayNum(now); return d - (((d - 4) % 7) + 7) % 7; };
export const dailyPeriod = (now) => 'd' + dayNum(now);
export const weeklyPeriod = (now) => 'w' + weekStart(now);
/** Milisekundy do najbliższej północy w Warszawie. */
export function msToMidnight(now) {
  const [h, m, s] = fmtClock.format(now).split(':').map(Number);
  return Math.max(1000, 86400_000 - ((h * 3600 + m * 60 + s) * 1000 + (now % 1000)));
}
export function msToWeekEnd(now) { return msToMidnight(now) + (weekStart(now) + 6 - dayNum(now)) * 86400_000; }
/** "5 h 12 min" / "3 d 4 h" / "42 s" */
export function dur(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${s % 60 && m < 10 ? ` ${s % 60} s` : ''}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
  return `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ''}`;
}
