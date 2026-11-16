// Etap v5/4: rynek surowców między graczami (czyste reguły).
export const RES = ['metal', 'crystal', 'energy'];
export const VALUE = { metal: 1, crystal: 2, energy: 1.5 }; // orientacyjna wartość surowców
export const TAX = 0.1;               // podatek od sprzedaży (pobierany od sprzedającego, spalany)
export const MIN_AMT = 50, MAX_AMT = 50_000;
export const MIN_RATIO = 0.5, MAX_RATIO = 2; // dopuszczalny zakres ceny względem wartości orientacyjnej
export const MAX_OPEN = 5;
export const TTL_MS = 48 * 3600_000;
export const MIN_LEVEL = 3;
export const MAX_BUYS_DAY = 10;

/** Walidacja oferty; zwraca komunikat błędu albo null. */
export function validate(o) {
  if (!RES.includes(o.sellRes) || !RES.includes(o.buyRes)) return 'Nieznany surowiec.';
  if (o.sellRes === o.buyRes) return 'Wybierz dwa różne surowce.';
  for (const a of [o.sellAmt, o.buyAmt]) if (!Number.isInteger(a) || a < MIN_AMT || a > MAX_AMT) return `Ilości: od ${MIN_AMT} do ${MAX_AMT.toLocaleString('pl-PL')}.`;
  const r = ratio(o);
  if (r < MIN_RATIO || r > MAX_RATIO) return `Cena poza widełkami rynku (${Math.round(MIN_RATIO * 100)}–${Math.round(MAX_RATIO * 100)}% wartości). Zmień ilości.`;
  return null;
}
/** Stosunek wartości żądanej do oferowanej (1 = cena „uczciwa”). */
export const ratio = (o) => (o.buyAmt * VALUE[o.buyRes]) / (o.sellAmt * VALUE[o.sellRes]);
export const sellerGets = (buyAmt) => Math.floor(buyAmt * (1 - TAX));
export const taxOf = (buyAmt) => buyAmt - sellerGets(buyAmt);
