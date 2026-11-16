// Kampania fabularna PvE: 5 planet × (4 misje + boss). Czyste dane i reguły (bez bazy).
export const CHAPTERS = [
  { n: 1, planet: 'Kharon Prime', title: 'Rdzawe Rubieże', minLvl: 1, L: 2, energy: 8,
    intro: 'Sygnał SOS z rdzawej pustyni Kharona urywa się w pół słowa. Złomiarze z klanu Graxa ogołacają wraki konwojów kolonijnych – i właśnie namierzyli Twoją kolonię.',
    missions: [
      ['Echo konwoju', 'Wrak transportowca wciąż nadaje. Przy nim kręci się para łupieżców – przegoń ich, zanim rozbiorą czarną skrzynkę.'],
      ['Burza pyłowa', 'W kanionach pył oślepia sensory. Złomiarze polują tu z zasadzki – trzymaj się blisko skał.'],
      ['Złomowisko', 'Orbitalne cmentarzysko statków to ich baza zaopatrzeniowa. Odetnij im dostawy części.'],
      ['Stacja Odys', 'Opuszczona stacja badawcza skrywa kody do kryjówki Graxa. Jej działka wciąż są aktywne.'],
      ['Złomiarz Grax', 'Grax pozszywał swój okręt z dziesiątek wraków. Każda blacha to czyjś zaginiony statek. Pora to zakończyć.'],
    ],
    boss: { name: 'Złomiarz Grax', relic: 'grax' } },
  { n: 2, planet: 'Nivalis', title: 'Lodowy Pas', minLvl: 4, L: 5, energy: 10,
    intro: 'Z danych Graxa wynika, że ktoś płacił mu za kryształy z lodowego Nivalis. Pod lodem budzi się coś starszego niż ludzkie kolonie.',
    missions: [
      ['Szron na kadłubie', 'Mróz kruszy pancerze. Patrole lodowych dronów atakują wszystko, co emituje ciepło.'],
      ['Kryształowe iglice', 'Iglice rezonują z Twoimi tarczami. Zniszcz nadajniki, zanim zakłócą nawigację.'],
      ['Zorza', 'W blasku zorzy kryją się myśliwce przemytników kryształów. Odbierz im ładunek.'],
      ['Lodowa szczelina', 'Szczelina prowadzi do jaskini, gdzie coś ogromnego oddycha chłodem.'],
      ['Lewiatan Szronu', 'Żywy kryształ wielkości krążownika. Jego rdzeń pulsuje tym samym światłem co sygnał z Kharona.'],
    ],
    boss: { name: 'Lewiatan Szronu', relic: 'lewiatan' } },
  { n: 3, planet: 'Virex', title: 'Toksyczna Dżungla', minLvl: 8, L: 9, energy: 12,
    intro: 'Rdzeń Lewiatana wskazuje na Virex – planetę, gdzie dżungla świeci kwasem, a Rój buduje okręty z własnych ciał.',
    missions: [
      ['Kwaśny deszcz', 'Atmosfera Virex przeżera stal. Zestrzel zwiadowców Roju, zanim wezwą resztę.'],
      ['Ule', 'Ule rosną na orbicie jak grzyby. Każdy zniszczony to mniej dronów w następnej fali.'],
      ['Feromonowy szlak', 'Rój komunikuje się zapachem. Podążaj szlakiem i przerwij łączność.'],
      ['Gniazdo', 'Serce kolonii Roju broni się z dziką furią. Królowa jest tuż za nim.'],
      ['Królowa Roju', 'Biomechaniczny statek-matka. Gdy padnie, Rój straci głos – ale zdąży krzyknąć do kogoś w Kuźni.'],
    ],
    boss: { name: 'Królowa Roju', relic: 'roj' } },
  { n: 4, planet: 'Pyros', title: 'Kuźnia Pyros', minLvl: 12, L: 13, energy: 14,
    intro: 'Krzyk Roju trafił do Pyros – wulkanicznej kuźni, w której ktoś masowo produkuje okręty wojenne z lawy i żelaza.',
    missions: [
      ['Rzeki magmy', 'Lawa wyrzuca w górę odłamki skał. Wartownicy kuźni patrolują strumienie ognia.'],
      ['Odlewnia', 'Tu powstają kadłuby. Zniszcz linię produkcyjną, zanim zjedzie z niej kolejna eskadra.'],
      ['Dymne kominy', 'Dym tłumi radary. Walczysz na wyczucie z ciężkimi kanonierkami.'],
      ['Brama kuźni', 'Ostatnia linia obrony: działa wielkie jak wieże i pancerz rozgrzany do białości.'],
      ['Kowal Wojny', 'Żywa forteca-kuźnia. Jej rdzeń bije w rytmie sygnału, który wszystko połączył – z Bramy Otchłani.'],
    ],
    boss: { name: 'Kowal Wojny', relic: 'kowal' } },
  { n: 5, planet: 'Otchłań', title: 'Brama Otchłani', minLvl: 16, L: 17, energy: 16,
    intro: 'Na skraju mapy wisi czarna planeta otoczona pierścieniem starożytnej bramy. To stąd płynął sygnał. Coś po drugiej stronie chce wrócić.',
    missions: [
      ['Szklane pustkowie', 'Powierzchnia z czarnego szkła odbija Twoje strzały. Strażnicy bramy już Cię widzą.'],
      ['Odłamki run', 'Kamienie runiczne krążą jak satelity i strzelają fioletowym światłem.'],
      ['Horyzont zdarzeń', 'Grawitacja osobliwości szarpie kadłubem. Utrzymaj kurs i przebij się przez straż.'],
      ['Pierścień', 'Pierścień bramy budzi się do życia. Jeśli się otworzy, nic go już nie zamknie.'],
      ['Strażnik Otchłani', 'Ostatni strażnik starożytnej rasy. Pokonaj go, a Brama zamilknie – na razie.'],
    ],
    boss: { name: 'Strażnik Otchłani', relic: 'otchlan' } },
];
export const MISSIONS_PER = 5;
export const missionId = (c, m) => `${c}-${m}`;
export function parseId(id) {
  const [c, m] = String(id).split('-').map(Number);
  const ch = CHAPTERS[c - 1];
  if (!ch || !(m >= 1 && m <= MISSIONS_PER)) return null;
  return { c, m, ch, boss: m === MISSIONS_PER, name: ch.missions[m - 1][0], story: ch.missions[m - 1][1], id: missionId(c, m) };
}
export const energyCost = (c, m) => CHAPTERS[c - 1].energy + (m === MISSIONS_PER ? 8 : m - 1);
export const enemyLevel = (c, m) => CHAPTERS[c - 1].L + Math.floor((m - 1) / 2);
/** Przeciwnik o stałej sile (nie skaluje się z graczem – kampania to wyzwanie). */
export function enemy(c, m) {
  const L = enemyLevel(c, m), boss = m === MISSIONS_PER;
  const mult = boss ? 0.72 : 0.6 + 0.05 * (m - 1);
  const hp = Math.round((90 + 25 * L) * mult * (boss ? 1.4 : 1));
  return { name: CHAPTERS[c - 1].missions[m - 1][0], hp, maxHp: hp, atk: Math.round((10 + 4 * L) * mult), def: Math.round((2 + 2 * L) * mult * 0.8), crit: boss ? 0.05 : 0, dodge: 0, shield: 0, level: L, boss };
}
/** Gwiazdki: 1 za wygraną, 2 przy ≥30% HP, 3 przy ≥60% HP po walce (z bossem progi ×0,65). */
export const starsFor = (won, hpLeft, maxHp, boss = false) => { if (!won) return 0; const k = boss ? 0.65 : 1; return hpLeft >= 0.6 * k * maxHp ? 3 : hpLeft >= 0.3 * k * maxHp ? 2 : 1; };
export function reward(c, m, bonus, first, rnd = Math.random) {
  const L = enemyLevel(c, m), boss = m === MISSIONS_PER, k = (boss ? 2 : 1) * (first ? 2 : 1) * bonus;
  const r = 0.9 + rnd() * 0.2;
  const rw = { xp: Math.round((20 + 6 * L) * k), metal: Math.round((40 + 12 * L) * k * r), crystal: Math.round((14 + 5 * L) * k * r) };
  if (boss && first) { rw.core = 1; rw.relic = CHAPTERS[c - 1].boss.relic; rw.crystal += 100 * c; }
  return rw;
}
export const CHEST = (c) => ({ core: 1, crystal: 60 * c, metal: 150 * c });
export const STARS_MAX = MISSIONS_PER * 3;
/** Stan kampanii z mapy {missionId: {stars, wins}}. */
export function progress(u, map) {
  return CHAPTERS.map((ch) => {
    const prevBoss = ch.n === 1 || (map[missionId(ch.n - 1, MISSIONS_PER)]?.stars > 0);
    const unlocked = prevBoss && u.level >= ch.minLvl;
    const ms = ch.missions.map((x, i) => {
      const m = i + 1, rec = map[missionId(ch.n, m)];
      const open = unlocked && (m === 1 || map[missionId(ch.n, m - 1)]?.stars > 0);
      return { id: missionId(ch.n, m), m, name: x[0], story: x[1], stars: rec?.stars || 0, wins: rec?.wins || 0, open, boss: m === MISSIONS_PER, energy: energyCost(ch.n, m), enemy: enemy(ch.n, m) };
    });
    const stars = ms.reduce((a, x) => a + x.stars, 0);
    return { ...ch, unlocked, prevBoss, ms, stars, done: ms[MISSIONS_PER - 1].stars > 0, chest: String(u.camp_chests || '').split(',').includes(String(ch.n)) };
  });
}
