# Kolonie – dokument projektowy (GDD)

## 1. Wizja
**Kolonie** to szybka, mobilna gra MMORPG sci-fi w przeglądarce. Gracz jest komandorem, który
zakłada kolonię na odległej planecie na rubieżach galaktyki. Rozgrywka składa się z krótkich
sesji (1–3 min): zbierz surowce → ulepsz coś → stocz bitwę → sprawdź ranking. Gra działa jak
aplikacja (PWA), bez instalacji ze sklepu.

**Filary:**
1. *Sesje na kawę* – wszystko w kilku kliknięciach, każda akcja daje natychmiastowy efekt.
2. *Wieczny progres* – zawsze jest coś do ulepszenia, a produkcja trwa, gdy gracz jest offline.
3. *Rywalizacja i wspólnota* – PvP, korporacje i rankingi dają powód do powrotu.
4. *Uczciwość* – cała logika na serwerze, brak pay-to-win w rdzeniu rozgrywki.

## 2. Świat
Rok 2387. Po upadku Konsorcjum Ziemskiego setki kolonii na rubieżach muszą radzić sobie same.
Między planetami grasują piraci (Pas Oriona, Czerwona Mgławica, flota Króla Pustki), a korporacje
kolonistów walczą o wpływy. Planety mają nazwy realnych egzoplanet (Kepler-442b, Proxima b…)
oraz polskich kolonii (Nowa Wisła, Nowy Kraków).

## 3. Pętla rozgrywki
```
 Wydobycie (czas) → Zbierz → Ulepsz budynki/statek → Bitwa (PvE/PvP) → XP, łupy, ranking
        ↑_____________________________________________________________________|
```
- **Krótka pętla (minuty):** zbieranie, bitwy z piratami, ulepszenia.
- **Średnia (dni):** poziomy gracza, odblokowanie silniejszych piratów, rozbudowa stoczni.
- **Długa (tygodnie):** pozycja w rankingu, siła korporacji, sezony.

## 4. Systemy (MVP – zaimplementowane)
| System | Opis |
|---|---|
| Surowce | metal, kryształy, energia; produkcja ciągła do magazynu wydobycia (2 h) |
| Budynki | Kopalnia, Elektrownia, Stocznia, Laboratorium – koszt rośnie wykładniczo |
| Statek | Kadłub, Działa plazmowe, Tarcze; limit = 2 × poziom stoczni; samonaprawa |
| PvE | 4 typy piratów odblokowywane poziomem; koszt energii; łupy skalowane poziomem i laboratorium |
| PvP | atak na gracza w zasięgu poziomu; łup 10% surowców; 15 min ochrony; punkty PvP |
| Bitwa | turowa symulacja ≤12 rund, krytyki i pudła, raport z barwnym opisem |
| Poziomy | XP = 100 × poziom^1,5; awans = pełna naprawa |
| Korporacje | zakładanie (koszt), dołączanie, opuszczanie, sukcesja lidera, +5% XP |
| Ranking | gracze (poziom/XP), PvP (punkty), korporacje (siła) |
| PWA | manifest, ikony, service worker (cache zasobów, ekran offline) |

## 5. Balans (wartości startowe)
- Produkcja/h na poziom: metal 480, kryształy 180 (kopalnia), energia 300 (elektrownia).
- Koszt ulepszenia = baza × wzrost^(poziom−1); wzrost 1,5 (moduły) – 1,65 (laboratorium).
- Statek: HP = 80 + 40·kadłub + 10·poziom; atak = 8 + 6·działa + poziom; obrona = 2 + 4·tarcze.
- Pirat poziomu L: HP = (90 + 25L)·m, atak = (10 + 4L)·m, obrona = (2 + 2L)·m·0,8
  (m = 0,6 / 0,9 / 1,2 / 1,6).
- `GAME_SPEED` przyspiesza produkcję i naprawy (serwery testowe / eventowe „turbo”).

## 6. Monetyzacja (propozycja, etyczna)
- Przepustka sezonowa z kosmetykami (skórki statków, ramki, emotki w czacie).
- Kosmetyczne motywy kolonii, nazwy w kolorze, odznaki korporacji.
- Bez sprzedaży surowców/statystyk za prawdziwe pieniądze w rankingowym PvP.

## 7. Roadmapa
### Faza 1 – „Pierwszy kontakt” (MVP+)
- Kolejka budowy z czasem (z możliwością skrócenia za aktywność, nie za pieniądze).
- Czat globalny i korporacyjny na żywo (WebSocket / SSE).
- Powiadomienia push (Web Push): „magazyn pełny”, „zostałeś zaatakowany”, „statek naprawiony”.
- Profil gracza, historia bitew, osiągnięcia.

### Faza 2 – „Rubieże”
- **Crafting:** części z piratów (rdzenie plazmowe, stopy kwantowe) → moduły specjalne
  (działa jonowe, tarcze fazowe, dopalacze) z rzadkością i losowymi atrybutami.
- **Ekspedycje:** wysyłanie statku na misję na X godzin (eksploracja, artefakty, ryzyko).
- **Mapa sektora:** planety graczy na siatce, zasięg i paliwo.
- **Badania:** drzewko technologii w laboratorium.

### Faza 3 – „Wojny korporacji”
- Wspólne **bossy kosmiczne** (rajd: Lewiatan z Pustki z globalnym HP i tabelą obrażeń).
- Wojny korporacji o stacje orbitalne / sektory, skarbiec i role (lider, oficer, rekrut).
- Handel między graczami (giełda surowców z prowizją jako „sink”).

### Faza 4 – „Sezony i wydarzenia na żywo”
- **Sezony** (6–8 tygodni): reset rankingu sezonowego, nagrody kosmetyczne, nowa mechanika co sezon
  (np. „Burza jonowa” – tarcze ×2, działa −20%).
- **Wydarzenia na żywo:** inwazja piratów w weekend, deszcz meteorów (bonus kryształów),
  turnieje PvP z drabinką.
- Codzienne i tygodniowe zadania, seria logowań.

### Technicznie
- Migracja na Postgres (Neon) – warstwa `db.js` jest gotowa na adapter.
- Wiele instancji serwera: sesje i limiter w Redis/Key Value, blokady wierszy `SELECT … FOR UPDATE`.
- Testy jednostkowe balansu (symulacje Monte Carlo bitew), telemetria i panel admina.
- Lokalizacja (PL → EN), dostępność (kontrast, czytniki ekranu), tryb jasny.
