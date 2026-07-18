# Roadmap: od pustej instalacji Medusy do realnego sklepu

**Status:** In Progress.
**Target:** całe repo `szopifaj` + serwer produkcyjny.
**Depends on:** [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md) (krok 3 poniżej).
**Author:** właściciel + agent.
**Last updated:** 2026-07-18.

## Summary

Ten dokument zastępuje `pawelekbyra/sklepik/docs/plans/medusa-migration.md` jako aktywne źródło statusu — tamten dokument opisywał samą decyzję o migracji z Spree na Medusę (zakończoną) i zostaje w repo `sklepik` jako zapis historyczny, nieaktualizowany dalej. `szopifaj` nie zależy już od tamtego repo dla żadnej bieżącej pracy.

## Key Decisions (do not deviate without discussion)

1. **`sklepik` (Spree) jest porzuconym eksperymentem, nie żywą produkcją.** Właściciel świadomie zrezygnował z ciągłości działania — nie ma czego migrować, nie ma cutover do ochrony.
2. **`szopifaj` jest jedynym aktywnym backendem.** Dokumentacja, decyzje architektoniczne i status roadmapy żyją tutaj, nie w `sklepik`.
3. **🔄 Zmienione 2026-07-17: sedno projektu to kompletność funkcjonalna + multi-sklepowość, nie moduł fiskalny jako punkt wyjścia.** Moduł fiskalny jako część tej całości, nie jej definicja. Patrz [`CLAUDE.md`](../../CLAUDE.md) sekcja "Filozofia". Infrastruktura serwerowa (krok 5 poniżej) została zrobiona poza kolejnością 2026-07-17, na wyraźną prośbę właściciela, żeby zweryfikować że stos działa od backendu do frontu.
4. **🔄 Zmienione ponownie 2026-07-17 (ten sam dzień): multi-sklepowość jest AKTYWNYM PRIORYTETEM, nie TODO.** Krótko wcześniej tego samego dnia właściciel poprosił o odłożenie multi-sklepowości na rzecz kompletności pojedynczego sklepu — **to zostało cofnięte**. Konkretny cel: właściciel chce móc dać koledze dostęp do jego własnego sklepiku i pokazać, że to realnie działa. To wymaga mechanizmu wielosklepowego, nie tylko jednego doskonałego sklepu. Kompletność funkcjonalna pojedynczego sklepu ([`product-2026-audit.md`](product-2026-audit.md)) zostaje ważnym, równoległym torem pracy, ale **nie blokuje** startu multi-sklepowości.
5. **Nie kopiujemy modułów Medusy bezmyślnie i nie trzymamy się jej wzorców z automatu.** Aktywny, nie tylko reaktywny audyt — szukamy najlepszego mechanizmu dla naszego problemu, nie tylko sprawdzamy to, co akurat dotykamy. Pełne uzasadnienie: [`CLAUDE.md`](../../CLAUDE.md) sekcja "Filozofia" (doprecyzowane 2026-07-17).

## Status kroków

1. ✅ **Zrobione:** import Medusa.js jako punkt startowy (`packages/`), własny `CLAUDE.md`, `yarn install`/`yarn build` zweryfikowane jako przechodzące czysto.
2. ⬜ **Następny krok:** audyt `packages/modules/*` (35 modułów — patrz `CLAUDE.md` sekcja "Struktura") — co jest realnie podłączone i działające w `medusa-config.js`, co jest tylko obecne jako źródło ale nieużywane, co brakuje do "kompletnego, nowoczesnego sklepu" (bramki płatności, promocje, gift cards, fulfillment, inventory...). Wynik audytu ma dać konkretną listę do zrobienia zamiast działania na wyczucie.
3. 🟡 **W TOKU (2026-07-17, potwierdzone dwukrotnie tego samego dnia — patrz Key Decision 4):** model wielosklepowy — jeden admin, wiele sklepików, właściciel jako super-admin z pełnym wglądem. Plan: [`multi-store-platform.md`](multi-store-platform.md). Scoping RBAC faktycznie zweryfikowany działający 2026-07-18 (wcześniejsze "end-to-end" z 2026-07-17 było nieprawdziwe — patrz `## Log` niżej). Właściciel sklepiku może dziś realnie zarządzać własnym katalogiem (produkty z cenami) i nie widzi cudzych danych. Pozostaje: widget przełącznika sklepiku w panelu, scoping `orders`.
3a. ⬜ **Równoległy tor, niebolokujący:** audyt "co potrzeba, żeby pojedynczy sklepik był 10/10 na miarę 2026" — pełna funkcjonalność + integracje. Plan: [`product-2026-audit.md`](product-2026-audit.md). Ważne, ale nie warunkuje startu prac nad multi-sklepowością.
4. ⬜ **Do zrobienia:** moduł fiskalny (`FiscalProvider` + Fakturownia + kasa fiskalna) — patrz [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md), część kompletnej platformy, nie jej definicja.
5. ⬜ **Do zrobienia, na końcu:** wygląd/UI storefrontu i panelu — świadomie odłożone, dopóki funkcjonalność nie jest kompletna.
6. 🟡 **Częściowo zrobione (2026-07-17), poza kolejnością:** infrastruktura serwerowa. Backend działa publicznie po HTTPS na `https://141-253-103-172.nip.io` (Postgres+Redis w Dockerze, `szopifaj.service` przez systemd, nginx+certbot). Storefront demonstracyjny (standardowy szablon Medusa Next.js, nie kod ekosystemu) działa na `https://store.141-253-103-172.nip.io`. Szczegóły: [`README.md`](../../README.md) sekcja "Serwer deweloperski". **To wciąż pusta instalacja** — kroki 2-5 pozostają do zrobienia.
7. ⬜ **Decyzja otwarta:** docelowy storefront. Albo podłączyć `pawelekbyra/sklepikFront` (prawdziwe repo ekosystemu, dziś na Vercelu, zbudowane pod API Spree — wymaga przepisania klienta API pod Medusę) pod ten backend, albo świadomie zostać przy dzisiejszym demo na serwerze i zrezygnować z Vercela dla tego projektu. Nierozstrzygnięte na 2026-07-17 — patrz Open Questions.

## Constraints on Current Work

- Nie dokładać nowych funkcji do `sklepik`/Spree — porzucony eksperyment, zero wyjątków dla "krytycznych poprawek produkcyjnych".
- Moduł fiskalny budować od razu na `szopifaj`, nigdy jako tymczasowy kod gdzie indziej.
- Serwer Oracle (`141.253.103.172`) był na 3-tygodniowym trialu od ok. 2026-07-17 — sprawdzić realny status konta przed traktowaniem go jako stabilnego fundamentu długoterminowego.

## Open Questions

- Storefront: `sklepikFront`+Vercel vs. zostać na serwerze bez Vercela — właściciel skłania się ku rezygnacji z Vercela dla tego projektu (sesja 2026-07-17), ale decyzja niesfinalizowana.
- Real dane sklepu (produkty, ceny, dostawa) — kto/jak je wprowadzi, ręcznie przez panel czy import.

## References

- [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md)
- [`multi-store-platform.md`](multi-store-platform.md)
- [`vision-2026.md`](vision-2026.md)
- [`../../README.md`](../../README.md) — stan wdrożenia serwera, na bieżąco.
- Archiwum historyczne: `pawelekbyra/sklepik/docs/plans/medusa-migration.md` (nieaktualizowane od 2026-07-17).

## Log

### 2026-07-18 (sesja interaktywna z właścicielem, po nocnych uruchomieniach zaplanowanego agenta)

**Kontekst przed tą sesją:** zaplanowany cykliczny agent (cron co 2h) uruchomił się kilka razy w nocy. Jedno uruchomienie (04:01) zrobiło niewiele; drugie (06:01) urwało się po samym czytaniu dokumentacji; trzecie (07:27) zaczęło realną pracę i przy okazji naprawiło ryzyko przypadkowego zacommitowania katalogu `app/` (sekrety, config) — ale utknęło, bo użyło `AskUserQuestion` w kontekście bez nadzoru i nikt nie mógł odpowiedzieć. Poprawiono instrukcję dla przyszłych uruchomień (zakaz czekania na odpowiedź, samodzielny wybór rozsądnej opcji).

**Co zrobiono w tej sesji:**
1. Odkryto i naprawiono architektoniczny blocker: format kluczy `rbac_policy` nie pozwalał na zawężone polityki (migracja + `RbacModuleService` + loader super-admina).
2. Rozszerzono `createSklepikWorkflow` o realne nadanie zawężonej roli RBAC właścicielowi nowego sklepiku (dotąd tego nie robił, mimo dokumentacji twierdzącej inaczej).
3. Rozszerzono scoped policies na endpointy produktów (dotąd tylko sales-channels).
4. **Test end-to-end (drugi admin, usunięta rola super-admina, dostęp do cudzego sklepiku/produktu przez API) ujawnił, że scoping nigdy realnie nie działał** — dwa niezależne, systemowe błędy: `MiddlewareFileLoader` gubił pole `scopedPolicies` przy rejestracji routingu (dotyczyło **każdego** endpointu, nie tylko sales-channels/products), oraz surowe zapytanie SQL w `RbacRepository.listPoliciesForRoles` nie pobierało kolumny `resource_id` (istniało od czasu przed dodaniem tej kolumny, nigdy zaktualizowane). Oba naprawione. Szczegóły w `multi-store-platform.md`, sekcja "Trzy błędy, przez które scoping nigdy realnie nie działał".
5. Potwierdzone testem na żywym serwerze (nie tylko czytaniem kodu): admin widzi własny sklepik/produkt (200), nie widzi cudzego (403) — dla `sales_channel` i `product`, GET/POST/DELETE.
6. Dane testowe posprzątane (konta `test-owner-a@`, `test-superadmin@`, testowy produkt i sklepik) — poza samym testowym sklepikiem "Sklepik Testowy A", który zostawiono jako żywy dowód działania (sales_channel `sc_01KXT36HWW37BW40FXFMKP76C4`).
7. Build → migracje → restart → weryfikacja `/health`+`/app` wykonane kilkukrotnie w trakcie iteracji z debugowaniem. **Efekt uboczny do zapamiętania:** ręczne `systemctl stop szopifaj` (zrobione żeby uniknąć wyścigu z trwającym w tle buildem) zatrzymuje przez `Requires=` też `szopifaj-storefront`, a kolejne `systemctl start szopifaj` **nie** wznawia automatycznie storefrontu — trzeba go wystartować osobno. Złapane i naprawione w tej sesji po zgłoszeniu przez właściciela (502 na storefroncie).

8. **Dopisano `inventory_item`/`price` do uprawnień właściciela sklepiku** (był to jedyny pozostały blocker uniemożliwiający sprzedawanie czegokolwiek — bez tego POST /admin/products odrzucał każdy produkt z ceną). Świadomy kompromis: te dwa zasoby nie są zawężone do sales_channel (brak bezpośredniego linku), więc uprawnienie jest efektywnie globalne w zakresie create/read/update — opisane w kodzie i `multi-store-platform.md`. Przetestowane end-to-end drugim, nowym adminem (utworzenie i usunięcie własnego wycenionego produktu) — działa, izolacja między sklepikami nadal poprawna (403 na dostęp do cudzego).

**Stan zweryfikowany na koniec sesji:** `szopifaj.service` i `szopifaj-storefront.service` aktywne, `/health`+`/app` 200, storefront 200. 7 nowych commitów lokalnych (niepushowane — brak danych logowania GitHub na serwerze), `git status` czysty. Właściciel sklepiku może dziś: założyć sklepik, zobaczyć/edytować tylko swój `sales_channel`, tworzyć/czytać/edytować/usuwać własne produkty z cenami — i nie widzi niczego z cudzych sklepików.

**Co dalej (następne uruchomienie/sesja):**
- Widget "przełącznik sklepiku" w topbarze panelu admina + custom route `/app/sklepiki/nowy` (Design Details → Panel "moje sklepiki", nierozpoczęte) — jedyny brakujący kawałek żeby to było użyteczne przez UI, nie tylko przez surowe API.
- Rozszerzyć scoped policies na `orders` (ostatni zasób z Design Details, jeszcze nietknięty).
- Middleware storefrontu resolvujący subdomenę → sales_channel/publishable key (Migration Path krok 6) — storefront wciąż ma jeden zahardkodowany klucz.

### 2026-07-18, część 2 (Postgres RLS — właściciel zapytał czy model RBAC to nie skrót)

Właściciel zapytał wprost, czy podejście "zaufani admini + RBAC" to nie kompromis kosztem solidności, w porównaniu do pełnej separacji modułowej jak we wtyczkach marketplace. Research potwierdził: **Postgres Row-Level Security to faktyczny standard branżowy** dla tego dokładnie problemu — obrona w głębi, baza fizycznie odmawia niezależnie od poprawności kodu aplikacji. Zapisane jako Key Decision 9 w `multi-store-platform.md`.

**Zrobione i zweryfikowane:**
- Nowa nieuprzywilejowana rola bazy `szopifaj_app` (dotychczasowa `szopifaj` jest superuserem, dla którego RLS jest całkowicie ignorowane) — usługa działa na niej od tej sesji.
- Polityki RLS na `product`/`sales_channel`, **SELECT-only** (ważna, dwukrotnie odkrywana tego dnia semantyka Postgresa: brak `FOR` klauzuli obejmuje też zapis tym samym warunkiem co odczyt, blokując tworzenie produktu w tej samej transakcji co jego link do sklepiku) — przetestowane surowym SQL i pełnym API.

**Próbowane i cofnięte:** warstwa aplikacji (middleware + hak na `client.acquireConnection` we wspólnym połączeniu Knex, ustawiający kontekst per-request) — zaimplementowana w pełni, zbudowana, wdrożona, **złamała tworzenie produktu** bo `createProductsWorkflow` z rdzenia Medusy sam wewnętrznie odczytuje dopiero co utworzony produkt zanim jego link do sklepiku istnieje. Cofnięte w całości, zweryfikowane (produkt znów da się tworzyć, `git status` czysty). Pełny opis przyczyny i dwie możliwe drogi naprawy w `multi-store-platform.md`, sekcja "Row-Level Security".

**Stan na koniec:** RLS włączone i bezpiecznie nieaktywne (jak przed próbą — bez warstwy aplikacji nikt nigdy nie ustawia kontekstu, więc każde zapytanie widzi wszystko). Backend zdrowy, `/health`+`/app` 200, storefront 200. Żadna funkcjonalność nie ucierpiała netto — kilka godzin realnej pracy, ale kod produkcyjny wrócił dokładnie do stanu sprzed próby.

