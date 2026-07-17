# Zgodność fiskalna PL (VAT/KSeF/kasa fiskalna) jako główna przewaga różnicująca

**Status:** Draft — ustalenia strategiczne i techniczne gotowe, implementacja nierozpoczęta.
**Target:** `packages/modules/tax` i nowy moduł `fiscal-service` (mikroserwis).
**Depends on:** —
**Author:** właściciel + agent (research 2026-07-17, sześć rund: krajobraz konkurencyjny, luki Shopify, wymogi techniczne KSeF, kasa fiskalna przy pełnym mixie płatności)
**Last updated:** 2026-07-17 (przeniesione do tego repo, treść merytoryczna bez zmian)

## ⚠️ PILNE: terminy KSeF już minęły

Dziś jest **17 lipca 2026**. Harmonogram obowiązkowego KSeF (ustawa z 27.08.2025, terminy prawnie ostateczne):
- **1 lutego 2026** — obowiązek dla dużych podatników (sprzedaż brutto 2025 > 200 mln zł) — **już minęło**.
- **1 kwietnia 2026** — obowiązek dla pozostałych przedsiębiorców — **już minęło**.
- 1 stycznia 2027 — najmniejsi podatnicy (obrót ≤10 000 zł/mies.) — jedyny termin jeszcze przed nami.

**To nie jest planowanie na przyszłość — to aktywna, dziś istniejąca luka.** Każdy klient robiący sprzedaż B2B (faktura dla firmy) już dziś powinien mieć możliwość odbioru/wystawiania faktur przez KSeF. Priorytet tego planu rośnie odpowiednio.

## Summary

Cel projektu to nie "prześcignąć Shopify globalnie" — dystrybucja, zaufanie regulacyjne i dane to fosy nie do dogonienia w rozsądnym czasie (kategoria "AI prowadzi checkout" już poniosła realną porażkę rynkową: OpenAI wycofał ChatGPT Instant Checkout w marcu 2026 po ~30 aktywnych sprzedawcach wobec zapowiadanego "ponad miliona"). Zamiast tego: platforma **dla właściciela i jego kilku-kilkunastu (rosnąco) klientów**, według najlepszych możliwych praktyk inżynierskich, z konkretną, obronioną niszą — **zgodność z polskim reżimem podatkowym, której Shopify strukturalnie nie domyka** (setki jurysdykcji, Polska nigdy nie będzie priorytetem).

## Ustalenia badawcze — co dokładnie jest złamane u Shopify w Polsce

- **Dokumenty generowane natywnie przez Shopify formalnie straciły status faktury VAT w krajowym obrocie B2B od 2026.**
- **Brak natywnej integracji z KSeF** — ani numeracja, ani korekty, ani wysyłka.
- **Brak statusu paragonu fiskalnego** — sprzedaż wymagająca kasy fiskalnej wymaga zewnętrznego systemu.
- **Kwota VAT musi być wyrażona w PLN wg kursu NBP niezależnie od waluty zamówienia** — Shopify tego nie robi natywnie.
- Efekt: sprzedawcy dokładają zewnętrzne narzędzia (np. Fakturownia) do czegoś, co w lokalnie zbudowanym systemie może być wbudowane od początku, nie doklejone.

Źródła: [ksiegowego.pl — Shopify a faktury VAT w Polsce](https://ksiegowego.pl/artykul/shopify-a-faktury-vat-w-polsce-jak-przygotowac-sprzedaz-zgodnie-z-przepisami), [icomSEO — integracja Shopify z księgowością](https://icomseo.pl/blog/integracja-shopify-z-ksiegowoscia-wyzwania-przy-sprzedazy-miedzynarodowej/).

Dodatkowe potwierdzone luki Shopify (mniej krytyczne niż VAT/KSeF, ale warte świadomości): opłaty transakcyjne przy niekorzystaniu z Shopify Payments, twarde limity customizacji bez Shopify Plus (~2000-2300 USD/mies. progu wejścia), utrata danych klientów przy migracji z platformy, słabe wsparcie B2B/subskrypcji bez płatnych dodatków.

## Key Decisions (do not deviate without discussion)

1. **Cel: platforma dla właściciela + kilku-kilkunastu (rosnąco) klientów, nie globalny konkurent Shopify.** Nie projektujemy pod setki tysięcy sklepów, projektujemy pod dziesiątki, dobrze.
2. **Zgodność fiskalna PL (VAT/KSeF/kasa fiskalna) jest główną przewagą różnicującą, nie funkcją poboczną.** Pierwszorzędny moduł domenowy, nie plugin doklejony na końcu.
3. **Najlepsze możliwe praktyki inżynierskie, nie kompromisy wokół ograniczeń frameworka.** Tam, gdzie architektura/konwencje Medusy nie pasują do zgodności fiskalnej lub wielosklepowości, przepisujemy — patrz [`CLAUDE.md`](../../CLAUDE.md), sekcja "Filozofia".
4. **Personalizacja/page builder nie jest głównym różnicownikiem.** Shopify/Webflow robią to szybciej przez wbudowane AI. "Wystarczająco dobre", priorytet na zgodność fiskalną.
5. **Zakres geograficzny zawężony świadomie do Polski/Europy Środkowej na start**, z modelem kanonicznym EN 16931 jako nadzbiorem na przyszłość (patrz [`vision-2026.md`](vision-2026.md)) — nie "platforma dla każdego sklepu na świecie" od razu.

## Design Details

**Kluczowa decyzja architektoniczna: warstwa abstrakcji `FiscalProvider`, nie własny klient KSeF od razu.**

- Interfejs `FiscalProvider` (nazwa robocza) — backend nie wie, czy faktura leci przez własny klient KSeF czy przez zewnętrzne API. Szybki start, późniejsza migracja na własną integrację bez przepisywania reszty systemu. Wzorzec spójny z resztą Medusy: moduł `tax` z podmiennym `providers/` (patrz [`CLAUDE.md`](../../CLAUDE.md)).
- **Pierwsza implementacja: integracja z Fakturownią** (darmowa integracja z KSeF na dowolnym abonamencie, gotowe API, obsługa kas fiskalnych Novitus/Posnet/Elzab/iPOS, obsługa e-paragonów). Szybki time-to-market, zero ryzyka regulacyjnego na start. Alternatywy tej klasy: wFirma, ifirma, inFakt.
- **❌ ODRZUCONE: ograniczenie płatności B2C do przelewu/BLIK.** Platforma ma obsługiwać pełen zakres metod płatności (karta, Przelewy24, PayU, Stripe) od początku. **Potwierdzone badawczo: przy jakiejkolwiek płatności innej niż bezpośredni przelew na konto, fiskalizacja jest obowiązkowa od pierwszej transakcji** — karta/bramka płatnicza przerywa bezpośredni związek wpłaty z transakcją wymagany przez przepis o zwolnieniu, nawet BLIK rozliczany jako transakcja kartowa się nie kwalifikuje. Kasa wirtualna prawnie odpada dla zwykłej sprzedaży detalicznej (zamknięta lista PKWiU: transport, gastronomia, hotelarstwo, myjnie, węgiel — nie handel/rękodzieło).
- **✅ Architektura kasy fiskalnej (wzorzec używany przez IdoSell/Shoper/duże platformy PL):** fizyczna drukarka fiskalna online z natywnym REST API — **Novitus NoviAPI** jako pierwszy wybór (~2800-3000 zł netto/urządzenie), Posnet Thermal HD Online jako porównanie/backup. Podłączona do dedykowanego, zawsze dostępnego mini-serwera z publicznym dostępem (musi łączyć się z Centralnym Repozytorium Kas MF). Osobny mikroserwis „fiscal-service" nasłuchuje webhooków bramki płatności (Stripe/P24/PayU) i po potwierdzeniu wpłaty wystawia paragon przez NoviAPI. **E-paragon za zgodą klienta w checkout** (opt-in + e-mail, zgodnie z art. 111 ustawy o VAT) zamiast/obok papierowego; bez zgody — paragon drukowany lokalnie i pakowany fizycznie do przesyłki. Mikroserwis potrzebuje kolejki z retry na wypadek offline drukarki i alarmowania — brak fiskalizacji przy przyjętej płatności to ryzyko sankcji karnoskarbowych.
- **B2B → KSeF, nie zwykła faktura PDF.** Format: struktura logiczna **FA(3)** (aktualna wersja), XML wg XSD publikowanego przez MF. Model danych zamówienia (moduł `order`) musi mieć od początku pola wymagane przez FA(3): NIP, dane adresowe, stawki VAT, kody GTU, jednostki miary — żeby nie przerabiać schematu bazy później.
- **Środowiska KSeF do developmentu:** MF udostępnia 3 odrębne środowiska — testowe (TE, `ksef-test.mf.gov.pl`), demo/przedprodukcyjne (TR, `ksef-demo.mf.gov.pl`, bez skutków prawnych), produkcyjne (PRD). Podłączyć środowisko testowe do CI wcześnie.
- **Uwierzytelnianie KSeF** (potrzebne dopiero przy własnej integracji, nie przy starcie przez Fakturownię): podpis kwalifikowany XAdES albo token KSeF. UPO (Urzędowe Poświadczenie Odbioru) zawiera numer KSeF, timestamp, hash SHA-256 — pojawia się zwykle w ciągu kilku minut, ma znaczenie dowodowe. Tryb offline (offline24/awaryjny) wymaga wysyłki do 24h od przywrócenia łączności.
- Przeliczanie VAT wg kursu NBP w PLN niezależnie od waluty zamówienia.
- Brak oficjalnego SDK Node/TS dla KSeF — integrację i tak trzeba pisać ręcznie niezależnie od wyboru frameworka.

## Migration Path

**Etap 1 (MVP, wysoki priorytet — terminy już minęły):**
1. Model danych zamówienia (moduł `order`) rozszerzony o pola FA(3) (NIP, adres, VAT, GTU, jednostki miary).
2. Rozróżnienie B2B (NIP podany → faktura, docelowo przez KSeF) vs B2C (paragon/e-paragon lub faktura na żądanie).
3. **Pełen zakres metod płatności B2C od startu** (karta, P24, PayU, Stripe) — bez ograniczeń.
4. Mikroserwis „fiscal-service" + fizyczna drukarka fiskalna online (Novitus NoviAPI) — fiskalizacja każdej opłaconej transakcji, e-paragon za zgodą.
5. Interfejs `FiscalProvider` + pierwsza implementacja przez API Fakturowni (wystawianie faktury B2B/KSeF po zmianie statusu zamówienia, pobieranie UPO).
6. Środowisko testowe KSeF podłączone w CI.

**Etap 2 (odłożone, dopiero gdy skala uzasadni koszt — setki faktur/mies.):**
- Własna natywna integracja z surowym KSeF API (certyfikaty, XAdES, tryb offline) zamiast Fakturowni.
- VAT-OSS/eksport UE dla sprzedaży wielosklepowej.
- Model kanoniczny EN 16931 jako wewnętrzna reprezentacja faktury, z adapterami per-kraj — patrz [`vision-2026.md`](vision-2026.md).

## Constraints on Current Work

- Nie inwestować w personalizację/page builder ponad "wystarczająco dobre" kosztem zgodności fiskalnej.
- Każda praca nad modelem zamówienia/płatności (moduły `order`, `payment`, `tax`) powinna mieć z tyłu głowy przyszłe wymogi faktury/KSeF (numeracja, korekty, PLN wg NBP), żeby nie trzeba było tego retrofitować.
- Nie projektować modelu faktury ściśle przywiązanego do polskiego FA(3) — myśleć w kategoriach EN 16931 jako nadzbioru od początku, nawet jeśli pierwszy adapter jest tylko polski.

## Open Questions

- Czy moduł fiskalny powinien być wymienny/pluginowy (na wypadek ekspansji poza Polskę) czy hardkodowany pod PL na start — nierozstrzygnięte, nie blokuje pierwszego kroku. Interfejs `FiscalProvider` częściowo już to rozwiązuje niezależnie od tej decyzji.

## References

- [`vision-2026.md`](vision-2026.md) — kierunek długoterminowy (EN 16931, open banking, immutable ledger), zależny od ukończenia MVP tego planu.
- Research-pass 2026-07-17 "Structural gaps incumbents leave open" — źródło ustaleń VAT/KSeF wyżej.
- Research-pass 2026-07-17 "Technical requirements for KSeF and fiscal integration" — [gov.pl/finanse harmonogram](https://www.gov.pl/web/finanse/obowiazkowy-ksef-odroczony-do-1-lutego-2026-r), [dokumentacja API KSeF 2.0/FA(3)](https://www.gov.pl/web/finanse/publikacja-dokumentacji-api-ksef-20-oraz-struktury-logicznej-fa3), [fakturownia.pl/integracja-z-ksef](https://fakturownia.pl/integracja-z-ksef).
- Research-pass 2026-07-17 "Research fiscal cash register requirements with card payments" — [sklepfiskalny.pl Novitus NoviAPI](https://sklepfiskalny.pl/Drukarka-fiskalna-NOVITUS-Bono-online), [gov.pl e-paragony](https://www.gov.pl/web/gov/ulatwienia-w-e-paragonach).
- Historia decyzji (dlaczego Medusa zamiast Spree, dlaczego nie konkurować globalnie z Shopify) — archiwum w `pawelekbyra/sklepik/docs/plans/` (`medusa-migration.md`, `fiscal-compliance-poland.md`), nieaktualizowane od 2026-07-17, zachowane jako zapis historyczny, nie jako bieżąca dokumentacja.
