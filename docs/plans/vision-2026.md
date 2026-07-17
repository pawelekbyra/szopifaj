# Wizja: produkt 10/10 na miarę 2026 roku

**Status:** Draft — azymut ustalony, żadna z trzech ścieżek nie rozpoczęta technicznie.
**Target:** `szopifaj` (ten backend), głównie moduły `tax`, `payment`, `order`.
**Depends on:** `pawelekbyra/sklepik/docs/plans/fiscal-compliance-poland.md` (fundament — MVP zgodności fiskalnej musi powstać, zanim ma sens rozszerzać go o poniższe).
**Author:** właściciel + agent (sesja 2026-07-17, po research-passie "state-of-the-art 2026 fiscal commerce platform")
**Last updated:** 2026-07-17

## Summary

Właściciel zapytał wprost: gdyby nie było ograniczeń inżynierskich, co jest najbardziej wartościowe do zbudowania na tym fundamencie, żeby to był produkt 10/10, nie kompromis? Research-pass dał odpowiedź w trzech konkretnych, uzasadnionych kierunkach — i równie ważną listą tego, co **świadomie odrzucić** jako efektowną, ale przedwczesną technologię na tę skalę.

Wspólny mianownik wszystkich trzech: **moduł fiskalny (`fiscal-compliance-poland.md`) nie jako funkcja compliance, tylko jako architektoniczny rdzeń**, wokół którego reszta produktu buduje zaufanie i przewagę.

## Key Decisions (do not deviate without discussion)

1. **Polska nie jest pułapem tego produktu — jest punktem startowym.** Silnik e-fakturowania budujemy wokół modelu kanonicznego **EN 16931** (unijny standard semantyczny, do którego cała UE zmierza obowiązkowo do 2030-2035), z wymiennymi adapterami per-kraj (KSeF dziś, docelowo Chorus Pro/PDP Francja, SdI Włochy, przyszłe niemieckie/hiszpańskie systemy). To realna, uzasadniona strategia ekspansji, nie fantazja — Francja wdraża obowiązkowe B2B e-fakturowanie już od września 2026, na tym samym standardzie.
2. **Pełna automatyczna rekoncyliacja finansowa przez open banking (PolishAPI/AIS), nie tylko webhooki bramek płatniczych.** Cel: zero ręcznej księgowości dla właściciela sklepu. Infrastruktura istnieje dziś (Enable Banking, Yapily jako dostawcy AIS w PL/UE).
3. **Niezmienna, kryptograficznie połączona księga zdarzeń finansowych** (append-only log + SHA-256 hash chain, wzorzec Certificate Transparency/QLDB) — obejmuje tylko moduł finansowy/fiskalny, nie cały system. Tanie technicznie, wysoka wartość zaufania (klient i przyszły audyt skarbowy).

**Świadomie odrzucone jako przedwczesne na tę skalę (nie budować bez nowego uzasadnienia):**
- Globalna dystrybucja bazy danych (CockroachDB/Spanner) — problem skali, którego ten produkt jeszcze nie ma.
- Pełny event sourcing/CQRS całego systemu commerce (nie tylko modułu finansowego) — nadmiarowe przy obecnym wolumenie.
- Własny silnik kredytowy/faktoringowy zamiast integracji z istniejącym partnerem (np. PragmaGO, lider embedded finance B2B w CEE, gotowe integracje z Przelewy24/PayU/imoje/Shoper) — regulacyjnie kosztowne bez proporcjonalnej korzyści różnicującej. Embedded finance jako *build-on-top* przez partnerstwo owszem ma wartość (dodatkowy przychód, realna korzyść dla producenta bez dostępu do kredytu bankowego) — ale to nie fundament różnicujący produkt, więc niżej w kolejności niż punkty 1-3.

## Design Details

Nierozpoczęte technicznie. Zależne od ukończenia MVP z `fiscal-compliance-poland.md` (warstwa `FiscalProvider`, integracja Fakturownia, kasa fiskalna Novitus NoviAPI) — te trzy kierunki to rozszerzenie tamtego fundamentu, nie zastąpienie go.

Szkic do zaprojektowania w kolejnej sesji:
- Model kanoniczny EN 16931 jako wewnętrzna reprezentacja faktury w module `tax`, z adapterami serializującymi do formatu docelowego kraju (KSeF XML/FA(3) jako pierwszy adapter).
- Integracja AIS (Enable Banking jako pierwszy kandydat) + silnik dopasowania fuzzy-matching (kwota/tytuł przelewu/NIP) z fallbackiem do ręcznej weryfikacji wyjątków.
- Append-only tabela zdarzeń finansowych w Postgresie z kolumną `previous_hash`/`hash` (SHA-256 nad treścią + poprzednim hashem) — prosty wzorzec, żadnej nowej infrastruktury (blockchain, DLT) nie jest potrzebny.

## Migration Path

Nie zaczynać żadnego z tych trzech kierunków przed ukończeniem MVP zgodności fiskalnej (`fiscal-compliance-poland.md` Etap 1) — to fundament, na którym te trzy stoją. Kolejność po MVP: (1) immutable ledger — najtańszy, najszybszy do zbudowania, wzmacnia zaufanie do reszty; (2) EN 16931 jako model kanoniczny — przy okazji budowania własnej integracji KSeF (Etap 2 z `fiscal-compliance-poland.md`), nie przy Fakturowni jako pierwszej implementacji; (3) open banking/AIS — niezależny strumień pracy, można równolegle.

## Constraints on Current Work

- Nie projektować modelu faktury w sposób ściśle przywiązany do polskiego FA(3) — od początku myśleć w kategoriach EN 16931 jako nadzbioru, nawet jeśli pierwszy adapter jest tylko polski.
- Tabela zdarzeń finansowych (jeśli/gdy powstanie) — zaprojektować jako append-only od pierwszego dnia (bez `UPDATE`/`DELETE` na rekordach), żeby nie trzeba było migrować danych historycznych later.

## Open Questions

- Dokładny wybór dostawcy AIS (Enable Banking vs Yapily vs inny) — nieobadane szczegółowo, do zrobienia przed startem implementacji punktu 2.
- Czy immutable ledger powinien być widoczny/eksportowalny dla klienta (jako element budowania zaufania — "zobacz historię swojego sklepu") czy tylko wewnętrzny mechanizm audytowy — decyzja produktowa, nierozstrzygnięta.
- Model przychodowy dla embedded finance (jaki % prowizji, czy w ogóle na start) — nierozstrzygnięte, niski priorytet.

## References

- `pawelekbyra/sklepik/docs/plans/fiscal-compliance-poland.md` — fundament, na którym te trzy kierunki się opierają.
- `pawelekbyra/sklepik/docs/plans/medusa-migration.md` — decyzja o backendzie, na którym to wszystko powstaje.
- Research-pass 2026-07-17 "State-of-the-art 2026 fiscal commerce platform" — [vatcalc.com ViDA/DRR](https://www.vatcalc.com/eu/eu-2028-digital-reporting-requirements-drr-e-invoice/), [Vertex ViDA guide](https://www.vertexinc.com/en-gb/eu-guide-vat-digital-age-vida), [openbankingtracker.com Poland](https://www.openbankingtracker.com/country/poland), [lendtech.pl PragmaGO](https://www.lendtech.pl/wiadomosci/pragmago-x-przelewy24-finance-juz-dziala-do-150-tys-zl-na-firme-w-90-sekund/), [dev.to tamper-proof audit logs](https://dev.to/robertatkinson3570/the-architecture-behind-tamper-proof-audit-logs-56ek).
