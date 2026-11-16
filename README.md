# 🪐 Kolonie – kosmiczna gra MMORPG w przeglądarce (prototyp MVP)

Mobilna gra przeglądarkowa sci-fi: zakładasz kolonię na obcej planecie, wydobywasz surowce,
rozbudowujesz budynki i statek, walczysz z piratami i innymi graczami, zakładasz korporacje
i wspinasz się w rankingu. Szybkie sesje na telefonie, zero instalacji (PWA).

Cały świat, nazwy, teksty i grafiki są autorskie (CSS/SVG/emoji) – projekt jedynie inspiruje się
*stylem rozgrywki* klasycznych prostych gier WAP/RPG.

## Uruchomienie

Wymagania: **Node.js ≥ 22.13** (testowane na v24) – baza SQLite jest wbudowana w Node (`node:sqlite`),
więc nie trzeba niczego kompilować.

```bash
npm install
npm start            # http://localhost:3100
```

Zmienne środowiskowe:

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `PORT` | `3100` | port serwera |
| `DB_FILE` | `data/kolonie.db` | plik bazy SQLite |
| `GAME_SPEED` | `1` | mnożnik tempa produkcji i napraw (np. `20` do testów) |
| `COOKIE_SECURE` | – | ustaw `1` za HTTPS, by ciasteczko sesji miało flagę `Secure` |

Inne komendy:

```bash
npm run dev          # restart przy zmianach w kodzie
npm test             # test dymny przez HTTP (serwer musi działać; BASE=http://host:port)
```

Test dymny rejestruje 2 graczy, zbiera surowce, ulepsza kopalnię i działa, toczy bitwę z piratami
i bitwę PvP, zakłada korporację, dołącza drugiego gracza i sprawdza wszystkie rankingi oraz strony.

## Zasady gry (skrót)

- **Surowce:** 🔩 metal, 💎 kryształy, ⚡ energia. Start: 400 / 200 / 150.
- **Wydobycie:** kolonia produkuje surowce cały czas do *magazynu wydobycia* (mieści 2 h produkcji).
  Trzeba wracać i klikać **„Zbierz surowce”**, żeby przenieść je do magazynu głównego.
  - Kopalnia: 480 metalu/h i 180 kryształów/h na poziom. Elektrownia: 300 energii/h na poziom.
- **Budynki** (koszt rośnie ×1,55–1,65 na poziom; ulepszenie automatycznie zbiera wydobycie):
  - ⛏️ Kopalnia – metal i kryształy, 🔋 Elektrownia – energia,
  - 🛠️ Stocznia – limit modułów statku = 2 × poziom stoczni, szybsza naprawa (2% + 1%/poziom HP na minutę),
  - 🔬 Laboratorium – +10% XP i łupów z bitew za każdy poziom powyżej 1.
- **Statek:** 🧱 Kadłub (+40 HP), 💥 Działa plazmowe (+6 ataku), 🔰 Tarcze (+4 obrony). Poziom gracza też
  dodaje HP i atak. Statek sam się naprawia z czasem.
- **Bitwy** (maks. 12 rund, strzela się na zmianę; 10% szansy na krytyk ×1,6, 6% na pudło;
  obrażenia = atak ±15% − ½ obrony przeciwnika; jeśli nikt nie padnie – wygrywa lepszy stan kadłuba):
  - ☠️ **Piraci (PvE):** 4 poziomy trudności (Zwiadowca → Korsarz od poz. 3 → Krążownik od poz. 6 →
    Dreadnought od poz. 10). Koszt energii 5–20. Nagroda: XP, metal, kryształy.
  - 👾 **Gracze (PvP):** koszt ⚡10. Wygrana = 10% metalu i kryształów rywala (z limitem) i +10 pkt PvP;
    przegrana −5 pkt. Zaatakowany gracz dostaje 15 min ochrony. Nie można atakować graczy o 3+ poziomy
    słabszych ani członków własnej korporacji. Obrońca broni się automatycznie (nie traci HP).
  - Do walki potrzeba min. 25% HP; między bitwami jest 4 s przerwy.
- **Poziomy:** XP potrzebne na następny poziom = 100 × poziom^1,5. Awans w pełni naprawia statek.
- **Korporacje:** założenie kosztuje 🔩300 💎100; do 20 członków; członkowie mają +5% XP z bitew.
  Gdy założyciel odejdzie, przywództwo przejmuje najsilniejszy członek (pusta korporacja znika).
- **Ranking:** gracze wg poziomu i XP, PvP wg punktów, korporacje wg siły (Σ poziom×100 + pkt PvP).

## Architektura

```
src/server.js   – Express 5: trasy, sesje, akcje gry (każda akcja = atomowa transakcja)
src/rules.js    – czyste reguły i balans gry (produkcja, koszty, statystyki, symulacja bitwy)
src/views.js    – widoki HTML renderowane po stronie serwera (szybkie, działają bez JS)
src/db.js       – warstwa bazy: SQLite (node:sqlite) z interfejsem { get, all, run, tx }
public/         – CSS, mały skrypt klienta (żywe liczniki), PWA: manifest, service worker, ikony
scripts/smoke-test.js – test end-to-end przez HTTP
```

- **Serwer jest jedynym źródłem prawdy:** stan (surowce, HP) wyliczany jest z znaczników czasu
  przy każdym żądaniu; klient tylko animuje liczniki.
- **Bezpieczeństwo:** hasła scrypt z solą, token sesji losowy (w bazie tylko jego SHA-256), ciasteczko
  `HttpOnly; SameSite=Lax`, sprawdzanie nagłówka `Origin` dla POST, CSP, limiter prób logowania,
  zapytania parametryzowane, escapowanie HTML.
- **API JSON:** każda akcja POST zwraca JSON, jeśli wyślesz nagłówek `Accept: application/json`
  (np. `curl -H 'Accept: application/json' -X POST .../kolonia/zbierz`). Dodatkowo `GET /api/stan`
  i `GET /api/ranking?tab=gracze|pvp|korporacje`.

### Przejście na Postgres / Neon

Cała gra korzysta tylko z `db.get/all/run/tx` i SQL z parametrami `?`. Aby przejść na Postgres:
1. napisz `createPgDb(url)` z tym samym interfejsem (pakiet `pg`, zamiana `?` → `$1..$n`,
   `tx` = `BEGIN … COMMIT` na jednym kliencie z puli; `run` zwraca `lastId` przez `RETURNING id`),
2. w schemacie: `INTEGER PRIMARY KEY AUTOINCREMENT` → `BIGSERIAL PRIMARY KEY`, znaczniki czasu → `BIGINT`,
3. w zapytaniach PvP zamień skalarne `MAX(0, x)` na `GREATEST(0, x)`.

## Znane ograniczenia prototypu

- Ulepszenia są natychmiastowe (bez kolejki budowy i czasu budowy).
- Brak czatu, wiadomości, powiadomień push i panelu administratora.
- Korporacje są otwarte (bez zaproszeń/ról), bez wspólnego skarbca i wojen korporacji.
- Limiter logowania i kolejka transakcji działają w pamięci jednego procesu (jedna instancja serwera).
- Brak e-maila / resetu hasła; brak testów jednostkowych balansu (jest test dymny E2E).
