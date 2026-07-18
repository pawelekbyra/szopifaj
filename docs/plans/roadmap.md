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
2. ✅ **Zrobione (2026-07-18):** audyt `packages/modules/*` (35 modułów) — pełna tabela statusów + priorytetyzacja w [`module-audit-2026.md`](module-audit-2026.md). **Kluczowy wniosek: 24/35 podłączone i funkcjonalne, ale 3 najważniejsze dla realnego sklepu są tylko szkieletem** — `payment` (jedyny provider to no-op `system`, autoryzuje każdą płatność bez pobrania pieniędzy — **nikt dziś nie może zapłacić naprawdę**, mimo że kompletny kod Stripe z wariantami P24/BLIK już istnieje w repo, po prostu niezarejestrowany), `notification` (zero e-maili do klienta, tylko wewnętrzny feed admina — kod SendGrid gotowy, niepodłączony), `fulfillment` (tylko ręczny, zero kuriera). Implementacja tych punktów (audyt to tylko analiza) — nierozpoczęta.
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

- [`module-audit-2026.md`](module-audit-2026.md) — audyt 35 modułów `packages/modules/*`, krok 2.
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
- Widget "przełącznik sklepiku" w topbarze panelu admina + custom route `/app/sklepiki/nowy` (Design Details → Panel "moje sklepiki", nierozpoczęte) — jedyny brakujący kawałek żeby to było użyteczne przez UI, nie tylko przez surowe API. Uwaga architektoniczna do rozstrzygnięcia: właściwe miejsce na kod widgetu to `app/src/admin/widgets/` (potwierdzone czytaniem `admin-vite-plugin`), ale `app/` nie jest w git — wymaga decyzji jak wersjonować kod widgetu, zanim się go napisze.
- ✅ **Zrobione (2026-07-18):** scoped policies na `orders` (GET/POST `:id`) + `order:read` dla właściciela sklepiku. Przetestowane end-to-end (własne 200, cudze 403). Znany brak: lista `/admin/orders` nadal nie zawężona (jak products) — do zamknięcia przez RLS.
- Middleware storefrontu resolvujący subdomenę → sales_channel/publishable key (Migration Path krok 6) — storefront wciąż ma jeden zahardkodowany klucz.

### 2026-07-18, część 2 (Postgres RLS — właściciel zapytał czy model RBAC to nie skrót)

Właściciel zapytał wprost, czy podejście "zaufani admini + RBAC" to nie kompromis kosztem solidności, w porównaniu do pełnej separacji modułowej jak we wtyczkach marketplace. Research potwierdził: **Postgres Row-Level Security to faktyczny standard branżowy** dla tego dokładnie problemu — obrona w głębi, baza fizycznie odmawia niezależnie od poprawności kodu aplikacji. Zapisane jako Key Decision 9 w `multi-store-platform.md`.

**Zrobione i zweryfikowane:**
- Nowa nieuprzywilejowana rola bazy `szopifaj_app` (dotychczasowa `szopifaj` jest superuserem, dla którego RLS jest całkowicie ignorowane) — usługa działa na niej od tej sesji.
- Polityki RLS na `product`/`sales_channel`, **SELECT-only** (ważna, dwukrotnie odkrywana tego dnia semantyka Postgresa: brak `FOR` klauzuli obejmuje też zapis tym samym warunkiem co odczyt, blokując tworzenie produktu w tej samej transakcji co jego link do sklepiku) — przetestowane surowym SQL i pełnym API.

**Próbowane i cofnięte:** warstwa aplikacji (middleware + hak na `client.acquireConnection` we wspólnym połączeniu Knex, ustawiający kontekst per-request) — zaimplementowana w pełni, zbudowana, wdrożona, **złamała tworzenie produktu** bo `createProductsWorkflow` z rdzenia Medusy sam wewnętrznie odczytuje dopiero co utworzony produkt zanim jego link do sklepiku istnieje. Cofnięte w całości, zweryfikowane (produkt znów da się tworzyć, `git status` czysty). Pełny opis przyczyny i dwie możliwe drogi naprawy w `multi-store-platform.md`, sekcja "Row-Level Security".

**Stan na koniec:** RLS włączone i bezpiecznie nieaktywne (jak przed próbą — bez warstwy aplikacji nikt nigdy nie ustawia kontekstu, więc każde zapytanie widzi wszystko). Backend zdrowy, `/health`+`/app` 200, storefront 200. Żadna funkcjonalność nie ucierpiała netto — kilka godzin realnej pracy, ale kod produkcyjny wrócił dokładnie do stanu sprzed próby.

### 2026-07-18, część 3 (scoping orders + middleware storefrontu — Migration Path krok 6 i 7)

**Scoped policies na `orders`:** GET/POST `/admin/orders/:id`, wzorem products (order ma bezpośrednią kolumnę `sales_channel_id`, prostszy przypadek niż product przez link). Właściciel sklepiku dostaje `order:read`. Przetestowane na żywo: własne zamówienie 200, cudze (mimo posiadania `order:read`) 403, konto bez `order:read` w ogóle 403. Znany, już wcześniej udokumentowany brak: lista `/admin/orders` nadal nie zawężona (jak products) — do zamknięcia przez RLS, nie osobną łatką.

**Middleware storefrontu (Migration Path krok 6), w `szopifaj-storefront`:** nowy backendowy endpoint `GET /store/sklepiki/resolve?handle=X` (autoryzowany dowolnym "bootstrap" kluczem) + `createSklepikWorkflow` generujący `handle`+`default_country_code` w metadanych sklepiku. Middleware storefrontu resolvuje pierwszy segment hosta jako handle, dostaje właściwy klucz+kraj, przekazuje klucz dalej nagłówkiem do warstwy danych (ten sam wzorzec co istniejący nagłówek lokalizacji).

**Ważne odkrycie po drodze:** `GET /store/regions` zwraca regiony **wszystkich** sklepików niezależnie od klucza — brak formalnego powiązania sales_channel↔region w Medusie. Bez tego odkrycia funkcja wyglądałaby na działającą (200, bez błędów) ale cicho zawsze pokazywała ten sam, najstarszy region niezależnie od odwiedzanej subdomeny. Naprawione: kraj brany wprost z metadanych/resolve, nie wyliczany.

Przetestowane end-to-end żądaniami z ręcznie ustawianym nagłówkiem `Host` (bez nginx/DNS): domyślna domena → `/pl` (bez regresji), testowy sklepik z regionem Portugalia → `/pt`, poprawnie różne.

**Ograniczenie infrastrukturalne (nie kodowe), do wiedzy właściciela:** dowolne subdomeny na żywo wymagają certyfikatu SSL wildcard (weryfikacja DNS-01) — niemożliwe z `nip.io`, bo nie kontrolujemy jego DNS. Mechanizm w kodzie gotowy i poprawny; do użycia na żywo potrzebna własna domena albo certyfikaty zakładane ręcznie per-sklepik.

**Stan na koniec sesji:** backend i storefront zdrowe, `/health`+`/app`+storefront 200. Commity: 4 nowe w `szopifaj` (orders scoping, handle+resolve, country_code fix, ta notatka), 1 nowy w `szopifaj-storefront` (middleware) — oba repo lokalnie, niepushowane.

**Co dalej:** widget przełącznika sklepiku w panelu (blokowany kwestią gdzie wersjonować kod — `app/src/admin/` nie jest w git, patrz wpis wyżej), scoping list endpointów (przez RLS, gdy warstwa aplikacji RLS zostanie poprawnie zrobiona), rozważenie własnej domeny dla prawdziwych subdomen sklepików.

### 2026-07-18, część 4 (⏸️ PRZERWANE NA ŻYCZENIE WŁAŚCICIELA — widget panelu, w trakcie)

**Kontekst przerwania:** właściciel poprosił o zatrzymanie w tym miejscu — potrzebował agenta gdzie indziej, nie awaria/błąd. Usługa produkcyjna zdrowa i nietknięta (`/health`+`/app`+storefront 200 zweryfikowane bezpośrednio przed przerwaniem).

**Zrobione i zacommitowane (kod kompletny, ale build panelu NIEZWERYFIKOWANY — patrz "Następny krok"):**
1. **Rozwiązana blokada architektoniczna z poprzedniej sesji:** `.gitignore` miał blanket `/app/` (dodany 2026-07-17 po wypadku z `git stash -u`) — chronił sekrety/build, ale uniemożliwiał trackowanie prawdziwego kodu. Zawężone do konkretnych ścieżek (`.env`, `dist/`, `.medusa/`, `public/`, `server.log`) — `app/src/`, `medusa-config.js`, `package.json`, `tsconfig.json` są teraz trackowane (zweryfikowane: brak sekretów w tych plikach, tylko `process.env.X`).
2. **Widget "moje sklepiki"** w strefie `topbar` (`app/src/admin/widgets/sklepik-switcher.tsx`) — dropdown z listą sklepików admina (z `GET /admin/sklepiki`) + link do zakładania nowego. Nawigacyjny, nie filtruje widoków (nierozstrzygnięte jak głębiej zintegrować z listami produktów/zamówień).
3. **Custom route `/sklepiki/nowy`** (`app/src/admin/routes/sklepiki/nowy/page.tsx`) — formularz (nazwa/kraj/waluta) wołający `POST /admin/sklepiki`, pokazuje handle+publishable key po sukcesie.
4. Oba pliki używają `app/src/admin/lib/sdk.ts` — ten sam wzorzec (`@medusajs/js-sdk`, `auth: {type: "session"}`) co w pluginach loyalty/draft-order.

**⚠️ NASTĘPNY KROK (dokładnie tu przerwano):** kod nigdy nie przeszedł przez pełny build panelu, więc **nieprzetestowany nawet czy się kompiluje w kontekście reszty pluginów**, a tym bardziej czy renderuje się poprawnie w przeglądarce. Historia prób:
- `medusa build --admin-only` (z `app/` jako cwd) → nieudane: krok lintingu wysypał się (`eslint.findConfigFile is not a function`) — **niezwiązane z tym kodem, problem wersji/konfiguracji eslint w tym repo**, obejście: `--lint false`.
- Z `--lint false` → build faktycznie ruszył, ale wysypał się na **nieaktualnym, wcześniej skompilowanym bundlu pluginu loyalty** (`packages/plugins/loyalty/.medusa/server/src/admin/index.mjs`, błąd: `"z" is not exported by ".../zod.js"`) — też niezwiązane z moim kodem, ten plugin nie był przebudowywany od jakiejś zmiany w `packages/core/framework`.
- Próba naprawy: `yarn turbo run build:plugin --filter=@medusajs/loyalty-plugin --force` (wymusza rebuild loyalty + wszystkiego co go używa) — **nie zdążyła się skończyć / padła** po ~15 minutach, 25/38 zadań, `@medusajs/dashboard#build` zakończył się kodem 129 (prawdopodobnie SIGHUP/zabite z zewnątrz albo zasoby, nie błąd w kodzie — build realnie się posuwał, nie zapętlił). Przerwane w tym momencie na życzenie właściciela.

**Zalecany następny krok:** spróbować **węższego** podejścia zamiast pełnego `--force` na całe drzewo zależności loyalty:
1. Sprawdzić, czy `yarn build` (pełny, bez `--force`, standardowy — ten codziennie działający w tej sesji) sam z siebie odświeży `packages/plugins/loyalty/.medusa/server/src/admin/index.mjs` poprawnie (możliwe że problem był tylko w kombinacji z `--force` i brakiem cache, nie w samym kodzie loyalty).
2. Jeśli nie — zbadać dokładnie **dlaczego** loyalty ma nieaktualny bundle: sprawdzić `git log` na `packages/core/framework/src/deps/zod.ts` (albo gdziekolwiek `zod` jest re-eksportowany) pod kątem zmiany, która mogła zerwać kompatybilność z już zbudowanym `.mjs`.
3. Dopiero potem: `medusa build --admin-only --lint false` (z `app/` jako cwd) żeby zbudować panel z nowym widgetem, `sudo systemctl restart szopifaj`, zweryfikować w przeglądarce że widget faktycznie się pokazuje i działa (kliknięcie, lista sklepików, formularz zakładania nowego) — **to jeszcze nie było zrobione ani razu, nawet przez curl**, sam kod nigdy nie widział przeglądarki.
4. Osobno naprawić `eslint.findConfigFile is not a function` (niezależny, mniejszy problem) — do zbadania czy to wersja eslint w root `package.json` niezgodna z tym co woła `medusa build`.

**Stan repo na przerwanie:** `git status` czysty w obu repo (`szopifaj`, `szopifaj-storefront`), wszystko zacommitowane lokalnie, nic niepushowane (jak zawsze — brak danych logowania GitHub). Żadnych osieroconych procesów w tle (zweryfikowane `ps aux`).

### 2026-07-18, część 5 (self-signup publiczny + strona serowymichal.pl)

**Kontekst:** właściciel kupił domenę `serowymichal.pl` (home.pl) i poprosił o stronę startową pozwalającą każdemu założyć własny sklepik od razu, bez zaproszenia — zmiana wcześniejszej decyzji "zamknięta/zaproszeniowa" (Key Decision 7 w `multi-store-platform.md`, zaktualizowane). Próba zlecenia tego headless-agentowi na serwerze (`claude -p` przez SSH) nie ruszyła — natychmiastowy limit sesji konta na serwerze (reset 19:00 UTC), zero zmian w produkcji z tej próby. Zadanie wykonane bezpośrednio przez sesję interaktywną z właścicielem.

**Zrobione i przetestowane end-to-end na żywym serwerze:**
1. Nowy publiczny endpoint `POST /admin/sklepiki/self-signup` + workflow `self-signup.ts` (User + link auth identity + `createSklepikWorkflow`) — wzorem `acceptInviteWorkflow`, ale bez wymogu zaproszenia. Wymagał własnego wpisu w `middlewares.ts` (`authenticate("user", ["bearer"], { allowUnregistered: true })`) — samo `AUTHENTICATE = false` w route.ts nie wystarczało, `req.auth_context` przychodził `undefined` bez tego wpisu (znalezione i naprawione).
2. Naprawiony realny blocker w `createSklepikWorkflow`: druga próba założenia sklepiku dla tego samego kraju (`pl`) zawsze się wywalała ("already assigned to a region") — nowy krok `getOrCreateSklepikRegionStep` reużywa istniejący region zamiast tworzyć duplikat.
3. Statyczna strona `serowymichal.pl` (`/var/www/serowymichal/index.html`, nginx serwuje bezpośrednio, bez buildu/usługi) — formularz "Załóż sklepik" + link do logowania w istniejącym panelu admina.
4. Nginx vhost + `ADMIN_CORS`/`AUTH_CORS` rozszerzone o domenę. DNS w home.pl konfigurowany równolegle przez właściciela — na razie tylko HTTP, certbot do zrobienia po propagacji DNS.
5. Przetestowane end-to-end na żywo: rejestracja → self-signup → login → własny sklepik widoczny, cudzy (`Sklepik Testowy A`) **403**. Dane testowe posprzątane ręcznie SQL-em po teście, `Sklepik Testowy A` nietknięty.

Szczegóły: `docs/plans/multi-store-platform.md`, sekcja "Public self-signup + strona startowa serowymichal.pl".

**Stan na koniec:** `szopifaj.service` zdrowy (`/health` 200, restart wykonany dwukrotnie w trakcie iteracji), storefront nietknięty. Commity lokalne, niepushowane (jak zawsze).

**Co dalej:** certbot dla `serowymichal.pl` gdy DNS się rozpropaguje; ewentualny rate-limiting/captcha na self-signup, jeśli ruch to uzasadni.

