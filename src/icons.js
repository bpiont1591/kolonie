// Zestaw ikon UI: ręcznie rysowane glify SVG (spójny styl liniowy, gradient teal) + rastrowe ikony premium (WebP).
export const V = 22; // wersja zasobów statycznych (cache-busting)
const P = {
  colony: '<path d="M2.5 20.5h19"/><path d="M3.5 20.5a5.75 5.75 0 0 1 11.5 0"/><path d="M9.25 14.75v5.75M5.2 17.4h8.1"/><path d="M16.75 20.5V9.5h3.5v11"/><path d="M18.5 9.5V5"/><circle cx="18.5" cy="4" r=".9" class="f"/><path d="M16.75 13h3.5M16.75 16.5h3.5"/>',
  ship: '<path d="M13.5 4.5c3-1.4 7-1.5 7-1.5s-.1 4-1.5 7L12 17l-5-5z"/><path d="M7 12l-3.5.8 2.2 2.2M12 17l-.8 3.5-2.2-2.2"/><path d="M6.2 17.8 3.5 20.5"/><circle cx="15.5" cy="8.5" r="1.6" class="f"/>',
  battle: '<path d="M20.5 3.5 9.5 14.5M7 12l5 5M8.5 15.5l-4.5 4.5"/><path d="M3.5 3.5l11 11M17 12l-5 5M15.5 15.5l4.5 4.5"/><path d="M20.5 3.5v3.2M20.5 3.5h-3.2M3.5 3.5v3.2M3.5 3.5h3.2"/>',
  corp: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10.2" ry="3.4" transform="rotate(-22 12 12)"/><circle cx="19.2" cy="7.3" r="1.1" class="f"/>',
  rank: '<path d="M8 3.5h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5v1.5A2.5 2.5 0 0 0 7.5 9H8M16 5h3v1.5A2.5 2.5 0 0 1 16.5 9H16"/><path d="M12 12.5v3.5"/><path d="M8 20.5h8l-.9-4.5H8.9z"/>',
  up: '<path d="M6 12.5l6-6 6 6"/><path d="M6 18l6-6 6 6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15.5" r="1.2" class="f"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  bolt: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z"/>',
  logout: '<path d="M14.5 4h3.3A2.2 2.2 0 0 1 20 6.2v11.6a2.2 2.2 0 0 1-2.2 2.2h-3.3"/><path d="M10 16l4-4-4-4M14 12H3.5"/>',
  login: '<path d="M9.5 4H6.2A2.2 2.2 0 0 0 4 6.2v11.6A2.2 2.2 0 0 0 6.2 20h3.3"/><path d="M14.5 16l4-4-4-4M18.5 12H8"/>',
  download: '<path d="M12 3.5v11.5M7 10.5l5 5 5-5M4.5 20.5h15"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M15.8 4.9a3.2 3.2 0 0 1 0 6.2M18.2 20a6 6 0 0 0-3-5.2"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20.5a7 7 0 0 1 14 0"/>',
  crown: '<path d="M4 18.5h16l1-10.5-5 4.2-4-6.2-4 6.2-5-4.2z"/><path d="M4 21h16"/>',
  log: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" class="f"/><circle cx="4.5" cy="12" r="1.2" class="f"/><circle cx="4.5" cy="18" r="1.2" class="f"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  quest: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.4" class="f"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.8"/><path d="M2.5 9h19v-2.5h-19zM12 6.5v14"/><path d="M12 6.5C10 3 6.5 3.5 7 5.5s5 1 5 1 4.2.9 5-1-3-2.5-5 1z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  chat: '<path d="M4 5.5h11a1.8 1.8 0 0 1 1.8 1.8v6.4a1.8 1.8 0 0 1-1.8 1.8H9l-4 3.5v-3.5H4a1.8 1.8 0 0 1-1.8-1.8V7.3A1.8 1.8 0 0 1 4 5.5z"/><path d="M16.8 9h3.2a1.8 1.8 0 0 1 1.8 1.8v5.4a1.8 1.8 0 0 1-1.8 1.8h-.5V21l-3.3-3h-3"/><circle cx="6.5" cy="10.5" r=".9" class="f"/><circle cx="9.5" cy="10.5" r=".9" class="f"/><circle cx="12.5" cy="10.5" r=".9" class="f"/>',
  t_weapons: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r=".9" class="f"/>',
  t_armor: '<path d="M12 2.8 19.5 5.6v5.6c0 4.6-3.2 8.3-7.5 10-4.3-1.7-7.5-5.4-7.5-10V5.6z"/><path d="M12 6.4 16.3 8v3.3c0 2.7-1.8 4.9-4.3 6-2.5-1.1-4.3-3.3-4.3-6V8z"/>',
  t_logistics: '<path d="M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5z"/><path d="M3.5 8.5 12 13l8.5-4.5M12 13v7"/><path d="M7.8 6.3l8.5 4.5"/>',
  t_tactics: '<path d="M4 20V4"/><path d="M4 4.5h11l-2.5 3.5L15 11.5H4"/><path d="M14 20l3-6 3 6M15.2 17.6h3.6"/>',
  c_assault: '<path d="M12 2.5 18 14l-6 7.5L6 14z"/><path d="M9 11h6M12 6v12"/><path d="M3 16l3-2M21 16l-3-2"/>',
  c_tank: '<path d="M7 3.5h10l4.5 8.5-4.5 8.5H7L2.5 12z"/><path d="M8.6 7h6.8l2.8 5-2.8 5H8.6L5.8 12z"/><circle cx="12" cy="12" r="1.4" class="f"/>',
  c_scout: '<path d="M21.5 12 6 4.5l3 7.5-3 7.5z"/><path d="M9 12h12.5"/><path d="M2.5 9h2.5M2.5 15h2.5M1.5 12h3"/>',
  c_support: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.5v9M7.5 12h9"/><circle cx="12" cy="3.2" r="1" class="f"/><circle cx="20.8" cy="12" r="1" class="f"/><circle cx="3.2" cy="12" r="1" class="f"/>',
  flask: '<path d="M9.5 3h5M10.2 3v6L4.8 18.6A1.7 1.7 0 0 0 6.3 21h11.4a1.7 1.7 0 0 0 1.5-2.4L13.8 9V3"/><path d="M7 15h10"/><circle cx="10.5" cy="17.8" r=".9" class="f"/><circle cx="13.8" cy="18.4" r=".7" class="f"/>',
  star: '<path d="M12 3.2l2.6 5.5 6 .7-4.5 4.1 1.2 5.9L12 16.5l-5.3 2.9 1.2-5.9-4.5-4.1 6-.7z"/>',
  starf: '<path d="M12 3.2l2.6 5.5 6 .7-4.5 4.1 1.2 5.9L12 16.5l-5.3 2.9 1.2-5.9-4.5-4.1 6-.7z" class="f"/>',
  planet: '<circle cx="12" cy="12" r="6"/><path d="M4.2 15.6C1.9 17.6 1.6 19.4 3 20c1.9.8 6.3-.9 10.6-4.1 4.4-3.2 7.3-6.9 6.9-8.9-.3-1.4-2.1-1.6-4.6-.6"/>',
  event: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M12 11.8l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 3.5v4.5H9"/>',
  hole: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5M20.5 12a8.5 8.5 0 0 1-8.5 8.5M12 20.5A8.5 8.5 0 0 1 3.5 12M3.5 12A8.5 8.5 0 0 1 12 3.5"/>',
};
export const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
<defs><linearGradient id="ig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ff4ff"/><stop offset="1" stop-color="#3ee6ff"/></linearGradient></defs>
${Object.entries(P).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('\n')}
</svg>`;
export const NAMES = Object.keys(P);
/** Glif SVG (dziedziczy kolor przez currentColor). */
export const ic = (name, cls = '') => `<svg class="gi ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
/** Ikona rastrowa premium (przezroczysty WebP). */
export const pi = (name, size = 32, cls = '', alt = '') =>
  `<img src="/img/i_${name}.webp?v=${V}" class="pi ${cls}" width="${size}" height="${size}" alt="${alt}" decoding="async">`;
export const RASTER = ['hull', 'guns', 'shields', 'repair', 'power', 'xp', 'pvp', 'corp', 'trophy', 'collect', 'defeat',
  'daily', 'quest', 'chest', 'core', 'timer', 'expedition', 'treasury', 'war', 'bell', 'chat', 'tutorial', 'season', 'medal_gold', 'medal_silver', 'medal_bronze', 'arena', 'achievement', 'market', 'invite', 'admin', 'announce'];
/** Plakietka poziomu (sześciokąt). */
export const lvBadge = (n, cls = '') => `<span class="lv ${cls}" title="Poziom ${n}"><b>${n}</b></span>`;
