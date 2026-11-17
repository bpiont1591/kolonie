// Kampania fabularna PvE: 10 planet × (4 misje + boss) + tryb trudny. Czyste dane i reguły (bez bazy).
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
  // v7/3: rozdziały 6–10 – Prastarzy wracają
  { n: 6, planet: 'Aurelia', title: 'Złote Grobowce', minLvl: 20, L: 21, energy: 18,
    intro: 'Brama zamilkła, ale Strażnik zdążył wysłać ostatni impuls – prosto do Aurelii, świata złotych miast-grobowców. Automaty Prastarych otwierają oczy po raz pierwszy od miliona lat.',
    missions: [
      ['Piaski pamięci', 'Wydmy skrywają czujniki Prastarych. Każdy krok budzi kolejnego złotego wartownika.'],
      ['Aleja monolitów', 'Monolity wyładowują energię w rytm runicznych zaklęć. Przebij się, zanim zamkną krąg.'],
      ['Krypta inżynierów', 'W grobowcu leżą plany broni, które zniszczyły pół galaktyki. Nie mogą wpaść w złe ręce.'],
      ['Złoty dziedziniec', 'Gwardia Archonta formuje szyk. Ich tarcze świecą tym samym światłem co Brama.'],
      ['Archont Aurelii', 'Ostatni namiestnik Prastarych twierdzi, że Brama była więzieniem – a Ty właśnie zabiłeś jego klucznika.'],
    ],
    boss: { name: 'Archont Aurelii', relic: 'archont' } },
  { n: 7, planet: 'Tempestia', title: 'Oko Burzy', minLvl: 26, L: 27, energy: 20,
    intro: 'Archont przed śmiercią wskazał Tempestię: gazowego olbrzyma, w którego wiecznym huraganie Prastarzy uwięzili tytana zdolnego otworzyć Bramę od środka.',
    missions: [
      ['Ściana wiatru', 'Wichury rozpędzone do prędkości pocisków. Żniwiarze burzy polują na zagubione statki.'],
      ['Stacje zbiorcze', 'Ktoś odpalił stare kolektory energii. Burza rośnie – i karmi coś w swoim oku.'],
      ['Deszcz piorunów', 'Pioruny trafiają co sekundę. Tarcze ledwo wytrzymują, a eskorta tytana już nadlatuje.'],
      ['Ściana oka', 'Tuż za ścianą huraganu panuje martwa cisza. I coś ogromnego, co się przeciąga.'],
      ['Burzowy Tytan', 'Wiek uwięzienia nauczył go jednego: nienawidzić każdego, kto przylatuje z Bramy. Czyli Ciebie.'],
    ],
    boss: { name: 'Burzowy Tytan', relic: 'tytan' } },
  { n: 8, planet: 'Nekropolis', title: 'Martwa Flota', minLvl: 32, L: 33, energy: 22,
    intro: 'Rdzeń Tytana zawierał mapę bitwy sprzed eonów. Na orbicie księżyca Nekropolis wciąż dryfuje flota, która wtedy przegrała – i nie wie, że jest martwa.',
    missions: [
      ['Pas wraków', 'Tysiące kadłubów, każdy z działami w gotowości. Widmowe sygnały wołają o posiłki.'],
      ['Mgła upiorów', 'Zielona mgła wyłącza radar. Okręty-widma wyłaniają się z niej bez ostrzeżenia.'],
      ['Okręt szpitalny', 'Medyczne drony wciąż naprawiają martwą flotę. Zniszcz je, a widma przestaną wstawać.'],
      ['Pomost dowodzenia', 'Okręt flagowy budzi się z letargu. Jego reaktor bije jak serce.'],
      ['Admirał Widmo', 'Admirał przysięgał bronić Bramy przed tym, co jest po drugiej stronie. Nie rozpoznaje sojusznika – dla niego jesteś najeźdźcą.'],
    ],
    boss: { name: 'Admirał Widmo', relic: 'widmo' } },
  { n: 9, planet: 'Chronos', title: 'Pęknięty Czas', minLvl: 40, L: 41, energy: 24,
    intro: 'Dziennik Admirała mówi o planecie, na której Prastarzy próbowali cofnąć czas, by nigdy nie zbudować Bramy. Chronos pękł – a w szczelinach czasu coś zaczęło jeść.',
    missions: [
      ['Pętla', 'Ta sama bitwa powtarza się co minutę. Musisz wygrać ją, zanim pętla się zamknie.'],
      ['Odłamki jutra', 'Wrogowie z przyszłości znają Twoje manewry. Zaskocz ich czymś, czego jeszcze nie zrobiłeś.'],
      ['Mechanizm', 'Gigantyczne tryby nadają rytm całej planecie. Zatrzymaj je, a czas zwolni.'],
      ['Szczelina', 'Za szczeliną widać wszystkie warianty Twojej floty – i wszystkie przegrane bitwy.'],
      ['Czasożerca', 'Istota, która zjada sekundy. Wie, jak skończy się ta walka – ale nie wie, że Ty też już to wiesz.'],
    ],
    boss: { name: 'Czasożerca', relic: 'chronos' } },
  { n: 10, planet: 'Serce Otchłani', title: 'Tron Pustki', minLvl: 48, L: 49, energy: 26,
    intro: 'Wszystkie ślady prowadzą z powrotem do Bramy – ale tym razem na drugą stronę. Tam, w Sercu Otchłani, na tronie z obsydianu czeka ten, który wysłał pierwszy sygnał.',
    missions: [
      ['Przejście', 'Brama otwiera się z krzykiem. Po drugiej stronie nie ma gwiazd – tylko echo Twojego reaktora.'],
      ['Obsydianowe iglice', 'Iglice wysysają energię z tarcz. Zniszcz je, zanim statek zgaśnie jak świeca.'],
      ['Chór Pustki', 'Tysiące głosów szepcze Twoje imię. Każdy szept to kolejny okręt cienia.'],
      ['Schody tronu', 'Ostatnia gwardia Pana Pustki. Za nimi jest już tylko on – i odpowiedź, po co to wszystko.'],
      ['Pan Pustki', 'Wezwał Cię, bo tylko ktoś z zewnątrz mógł przejść przez Bramę. Teraz chce Twojego statku, by wrócić do galaktyki. Nie pozwól mu.'],
    ],
    boss: { name: 'Pan Pustki', relic: 'pustka' } },
];
export const MISSIONS_PER = 5;
/** v7/3: tryb trudny – odblokowany po 15★ rozdziału w normalnym, osobne gwiazdki (id „hC-M”). */
export const HARD = { lvlAdd: 3, mult: 1.6, energy: 1.5, loot: 2 };
export const missionId = (c, m, hard = false) => `${hard ? 'h' : ''}${c}-${m}`;
export function parseId(id) {
  const raw = String(id), hard = raw.startsWith('h');
  const [c, m] = raw.slice(hard ? 1 : 0).split('-').map(Number);
  const ch = CHAPTERS[c - 1];
  if (!ch || !(m >= 1 && m <= MISSIONS_PER)) return null;
  return { c, m, ch, hard, boss: m === MISSIONS_PER, name: ch.missions[m - 1][0], story: ch.missions[m - 1][1], id: missionId(c, m, hard) };
}
export const energyCost = (c, m, hard = false) => { const e = CHAPTERS[c - 1].energy + (m === MISSIONS_PER ? 8 : m - 1); return hard ? Math.round(e * HARD.energy) : e; };
export const enemyLevel = (c, m, hard = false) => CHAPTERS[c - 1].L + Math.floor((m - 1) / 2) + (hard ? HARD.lvlAdd : 0);
/** Przeciwnik o stałej sile (nie skaluje się z graczem – kampania to wyzwanie). */
export function enemy(c, m, hard = false) {
  const L = enemyLevel(c, m, hard), boss = m === MISSIONS_PER;
  const mult = (boss ? 0.72 : 0.6 + 0.05 * (m - 1)) * (hard ? HARD.mult : 1);
  const hp = Math.round((90 + 25 * L) * mult * (boss ? 1.4 : 1));
  return { name: CHAPTERS[c - 1].missions[m - 1][0], hp, maxHp: hp, atk: Math.round((10 + 4 * L) * mult), def: Math.round((2 + 2 * L) * mult * 0.8), crit: boss ? (hard ? 0.08 : 0.05) : hard ? 0.03 : 0, dodge: 0, shield: 0, level: L, boss };
}
/** Gwiazdki: 1 za wygraną, 2 przy ≥30% HP, 3 przy ≥60% HP po walce (z bossem progi ×0,65). */
export const starsFor = (won, hpLeft, maxHp, boss = false) => { if (!won) return 0; const k = boss ? 0.65 : 1; return hpLeft >= 0.6 * k * maxHp ? 3 : hpLeft >= 0.3 * k * maxHp ? 2 : 1; };
export function reward(c, m, bonus, first, rnd = Math.random, hard = false) {
  const L = enemyLevel(c, m, hard), boss = m === MISSIONS_PER, k = (boss ? 2 : 1) * (first ? 2 : 1) * bonus * (hard ? HARD.loot : 1);
  const r = 0.9 + rnd() * 0.2;
  const rw = { xp: Math.round((20 + 6 * L) * k), metal: Math.round((40 + 12 * L) * k * r), crystal: Math.round((14 + 5 * L) * k * r) };
  if (boss && first) { rw.core = 1; rw.crystal += (hard ? 200 : 100) * c; if (!hard) rw.relic = CHAPTERS[c - 1].boss.relic; }
  return rw;
}
export const CHEST = (c, hard = false) => (hard ? { core: 2, crystal: 150 * c, metal: 400 * c } : { core: 1, crystal: 60 * c, metal: 150 * c });
export const STARS_MAX = MISSIONS_PER * 3;
const chestKey = (n, hard) => `${hard ? 'h' : ''}${n}`;
export const chestOpened = (u, n, hard = false) => String(u.camp_chests || '').split(',').includes(chestKey(n, hard));
export const withChest = (u, n, hard = false) => [...String(u.camp_chests || '').split(',').filter(Boolean), chestKey(n, hard)].join(',');
function missions(ch, map, unlocked, hard) {
  return ch.missions.map((x, i) => {
    const m = i + 1, rec = map[missionId(ch.n, m, hard)];
    const open = unlocked && (m === 1 || map[missionId(ch.n, m - 1, hard)]?.stars > 0);
    return { id: missionId(ch.n, m, hard), m, name: x[0], story: x[1], stars: rec?.stars || 0, wins: rec?.wins || 0, open, boss: m === MISSIONS_PER, hard, energy: energyCost(ch.n, m, hard), enemy: enemy(ch.n, m, hard) };
  });
}
/** Stan kampanii z mapy {missionId: {stars, wins}}. */
export function progress(u, map) {
  return CHAPTERS.map((ch) => {
    const prevBoss = ch.n === 1 || (map[missionId(ch.n - 1, MISSIONS_PER)]?.stars > 0);
    const unlocked = prevBoss && u.level >= ch.minLvl;
    const ms = missions(ch, map, unlocked, false);
    const stars = ms.reduce((a, x) => a + x.stars, 0);
    const hUnlocked = unlocked && stars >= STARS_MAX;
    const hms = missions(ch, map, hUnlocked, true);
    const hard = { unlocked: hUnlocked, ms: hms, stars: hms.reduce((a, x) => a + x.stars, 0), done: hms[MISSIONS_PER - 1].stars > 0, chest: chestOpened(u, ch.n, true) };
    return { ...ch, unlocked, prevBoss, ms, stars, done: ms[MISSIONS_PER - 1].stars > 0, chest: chestOpened(u, ch.n), hard };
  });
}
