# Platforma multi-sklepowa: jeden admin, wiele sklepików

**Status:** 🟢 **Scoping RBAC faktycznie działa i zweryfikowany end-to-end (2026-07-18).** Poprzedni wpis statusu (2026-07-17) ogłaszał to samo, ale było to nieprawdą — w bazie nie istniała wtedy ani jedna zawężona (`resource_id`) polityka, więc "end-to-end" nigdy realnie nie przetestowało tego, co miało chronić. Sesja 2026-07-18 znalazła i naprawiła trzy niezależne błędy, które razem czyniły scoping martwym kodem (szczegóły w sekcji "RBAC / bezpieczeństwo" i `## Log` w `roadmap.md`). Po naprawie: `createSklepikWorkflow` nadaje właścicielowi zawężoną rolę, a próba dostępu do cudzego `sales_channel`/`product` faktycznie kończy się 403 (potwierdzone testem na żywym serwerze, nie tylko czytaniem kodu). Pozostaje: widget "przełącznik sklepiku" w panelu admina (topbar), rozszerzenie scoped policies na `orders`, uzupełnienie uprawnień właściciela o `inventory_item`/`price` (dziś nie może tworzyć wariantów z cenami — patrz Log).
**Target:** `packages/modules/rbac`, `packages/modules/sales-channel`, nowy moduł kontrolny (homepage/panel "moje sklepiki"), storefront.
**Depends on:** [`roadmap.md`](roadmap.md) (krok 3 — multi-tenant).
**Author:** właściciel + agent (sesja 2026-07-17, po audycie kodu i researchu zewnętrznym; poprawki i realna weryfikacja 2026-07-18).
**Last updated:** 2026-07-18.

## Summary

Właściciel chce platformę, gdzie zaufani administratorzy (nie anonimowa publiczna rejestracja) logują się na stronie głównej i zarządzają **kilkoma niezależnymi sklepikami** z jednego konta — każdy sklepik ma własny katalog produktów, zamówienia, walutę/region, własną subdomenę/branding.

Pierwsza koncepcja (osobna baza Postgres + osobny proces Medusy per sklepik) została odrzucona jako nadmiarowa po doprecyzowaniu: to nie jest platforma dla wzajemnie nieufających obcych — to kilku-kilkunastu zaufanych adminów. Druga koncepcja (pełny retrofit `store_id` w całym rdzeniu Medusy) została odrzucona po audycie kodu jako zbyt ryzykowna — Medusa ma zahardkodowane założenie "dokładnie jeden `Store`" w wielu wewnętrznych przepływach (koszyk, domyślny kanał sprzedaży), a przepisanie tego to w praktyce poważny fork z realnym ryzykiem wycieku danych między sklepami przy każdym przeoczonym miejscu.

**Rozwiązanie: sklepik = `sales_channel`, nie nowy `Store`.** To mechanizm, który Medusa faktycznie wspiera z pudełka (wiele kanałów sprzedaży, każdy z własnym regionem/walutą/kluczem API), i który ma już częściowo gotowe okablowanie w bazie (linki `product-sales-channel`, `order-sales-channel` istnieją).

## Key Decisions (do not deviate without discussion)

1. **Jedna instalacja Medusy, jedna baza danych.** Żadnej orkiestracji osobnych procesów/baz per sklepik — nie ma takiej potrzeby przy skali "kilkanaście-kilkadziesiąt sklepów" (patrz [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md)).
2. **Sklepik = `sales_channel` + własny `region` + własny publishable API key + własna subdomena storefrontu.** Nie nowa encja `Store` — audyt kodu pokazał, że wielość `Store` jest ślepą uliczką w obecnym stanie Medusy.
3. **Produkty scoped per sklepik** przez istniejący link `product-sales-channel` — każdy admin ma osobny katalog, nie współdzielony.
4. **Zamówienia automatycznie scoped po `sales_channel`** — istniejący link `order-sales-channel`, zero nowej pracy.
5. **Klienci (customers) są globalni w całej instalacji** (świadoma decyzja na start — patrz Open Questions). Jedno konto klienta działa na wszystkich sklepikach. Do rewizji, jeśli okaże się problemem produktowym.
6. **Nowa praca: powiązanie admin ↔ sales_channel + zawężenie RBAC do instancji zasobu.** Rozszerzenie modułu `rbac` — patrz szczegółowy plan implementacyjny w Design Details/Migration Path (doprecyzowane 2026-07-17 audytem kodu, koryguje wcześniejsze, zbyt ogólne sformułowanie tego punktu).
7. **Rejestracja zamknięta/zaproszeniowa na start**, nie w pełni otwarta publiczna — zgodnie z założeniem "zaufani admini". Może się to zmienić później, ale nie blokuje tego planu.
8. **🔄 Skorygowane 2026-07-17 (audyt kodu): rola super-admina — NIE przez dziedziczenie ról.** Pierwotna wersja tej decyzji (ten sam dzień) zakładała `rbac_role_parent`/dziedziczenie — **błędne założenie, kod pokazuje coś innego i prostszego**. Super-admin **już istnieje** w kodzie (`packages/medusa/src/loaders/initial-data.ts`, rola `role_super_admin`) jako zwykła rola z jedną policy `key: "*:*"` (wildcard resource+operation). Właściciel platformy dostaje tę istniejącą rolę — nic nowego nie trzeba budować dla samego super-admina. Dziedziczenie ról (`rbac_role_parent`) zostaje dostępne jako ogólny mechanizm modułu, ale nie jest potrzebne do tego konkretnego celu.
9. **🔄 Nowe 2026-07-18 (research + decyzja właściciela): docelowa warstwa bezpieczeństwa to PostgreSQL Row-Level Security (RLS), nie tylko RBAC w kodzie aplikacji.** Kontekst: właściciel wprost zapytał, czy model "zaufani admini + RBAC" to nie skrót kosztem solidności — słuszne pytanie. Research (SaaS best practices 2026 + istniejący, udokumentowany przepis dla Medusa+MikroORM konkretnie) potwierdza: RLS to faktyczny standard branżowy dla obrony w głębi (defense in depth) — baza danych **fizycznie odmawia** zwrócenia cudzych wierszy, nawet gdy w kodzie aplikacji jest błąd (a trzy takie błędy znaleziono i naprawiono tego samego dnia w warstwie RBAC, patrz `## Log` w `roadmap.md`). Wzorzec wtyczki marketplace (pełna separacja modułowa + impersonacja) był rozważany jako alternatywa — odrzucony nie dlatego, że RLS/separacja jest gorsza koncepcyjnie, tylko dlatego że **RLS daje ten sam poziom twardej izolacji dużo taniej**, bez budowania osobnego panelu vendora/impersonacji, których nie potrzebujemy przy tej skali. RBAC w kodzie **zostaje** — RLS to dodatkowa warstwa pod spodem, nie zamiennik (jeśli oba są potrzebne, oba działają; jeśli RBAC ma błąd, RLS i tak zatrzyma wyciek).

### Model danych
- `sales_channel` (istniejący moduł) = jednostka "sklepik". Pola: `name`, `description`, `is_disabled` — bez zmian w schemacie tego modułu.
- Nowy link `user_sales_channel` (albo rozszerzenie RBAC) — który `User` (admin) zarządza którym `sales_channel`. Wzorowane na istniejącym `user_rbac_role` (już w bazie, patrz `rbac` audyt).
- `region` — jeden per sklepik (waluta, stawki VAT), tworzony razem ze sklepikiem.
- `api_key` (publishable) — jeden per sklepik, scoped do jego `sales_channel` (istniejący mechanizm `publishable-api-key-sales-channel` link).

### Przepływ "załóż nowy sklepik"
Nowy workflow (wzorowany na `createVendorWorkflow` z oficjalnego przepisu Medusy na marketplace):
1. Utworzenie `sales_channel`.
2. Utworzenie `region` dla sklepiku (domyślnie Polska/PLN, konfigurowalne).
3. Utworzenie publishable `api_key`, link do `sales_channel`.
4. Link admina (zalogowanego usera) do `sales_channel` (nowy `user_sales_channel` albo RBAC policy `sales_channel:{id}`).
5. Zwrócenie danych startowych (subdomena, klucz publishable) do panelu.

### Panel "moje sklepiki" (homepage) — 🔄 doprecyzowane 2026-07-17 (audyt kodu)
**Decyzja: rozszerzyć wbudowany panel Medusy, nie budować osobnej aplikacji.** Panel admina to czysty SPA (React+Vite) pobierający dane z `/admin/*` API, z **dojrzałym, oficjalnym systemem rozszerzeń** — widgets (wstrzykiwanie UI w konkretne strefy, w tym gotowa strefa `topbar`) i custom routes, bez forkowania całości. Konkretny plan: widget w strefie `topbar` = przełącznik sklepiku (czyta `user.sales_channels` przez nowy link, patrz niżej), custom route `/app/sklepiki/nowy` dla workflow zakładania.

Dlaczego nie osobna aplikacja (wzorem Mercur Vendor Panel): ten wzorzec ma sens przy setkach nieufających sobie zewnętrznych sprzedawców — nie przy naszej skali "kilkanaście-kilkadziesiąt zaufanych adminów". Rozszerzenie wbudowanego panelu reużywa cały gotowy UI produktów/zamówień/klientów za darmo.

**Krytyczne zastrzeżenie (potwierdzone audytem):** sam widget/UI **niczego nie zabezpiecza** — filtrowanie musi być wymuszone na poziomie API (patrz RBAC niżej), inaczej admin może np. bezpośrednio wywołać `/admin/products` i zobaczyć produkty cudzego sklepiku mimo że UI pokazuje tylko swoje.

- Logowanie/rejestracja (istniejący `auth-emailpass`, prod-ready z audytu modułów) — to już panel logowania Medusy, nie nowy mechanizm.
- Lista sklepików admina (query po nowym linku `user_sales_channel`), przycisk "nowy sklepik" (workflow niżej), przełączanie kontekstu.

### Storefront
- **Jedna aplikacja Next.js** (nie N osobnych deploymentów) — middleware rozwiązuje subdomenę → `sales_channel`/publishable key przy każdym requeście, zamiast stawiać osobny proces na sklepik. Lżejsze operacyjnie niż N wdrożeń.
- Subdomeny: `nazwa-sklepiku.szopifaj...` (wzorem dzisiejszego `store.141-253-103-172.nip.io`), custom domain jako rozszerzenie później.

### ⚠️ Pułapka wdrożeniowa: kolejność ładowania feature flagi `rbac` (znalezione i naprawione 2026-07-17)

Sam `MEDUSA_FF_RBAC=true` w `.env` **nie wystarczy** — moduł RBAC pozostaje nieaktywny (brak tabel `rbac_role`/`rbac_policy` w bazie) mimo poprawnie ustawionej flagi. Przyczyna: w `packages/medusa/src/loaders/index.ts` `featureFlagsLoader` dla katalogu frameworka (gdzie leży definicja flagi `rbac` w `packages/medusa/src/feature-flags/rbac.ts`) uruchamia się **po** `configLoader` (który ewaluuje `medusa-config.js`, w tym `disable: !FeatureFlag.isFeatureEnabled("rbac")` dla domyślnego wpisu modułu RBAC w `packages/core/utils/src/common/define-config.ts`). W momencie tej ewaluacji flaga jeszcze nie jest zarejestrowana → zawsze `disable: true`, niezależnie od env/`.env`.

**Działająca poprawka** (zastosowana w `~/szopifaj/app/medusa-config.js` na serwerze): trzy rzeczy naraz, dla pewności:
1. `process.env.MEDUSA_FF_RBAC = "true"` jako **pierwsza linia pliku**, przed jakimkolwiek `require`.
2. `featureFlags: { rbac: true }` w obiekcie configu.
3. Jawny wpis w `modules: [{ resolve: "@medusajs/medusa/rbac", disable: false }]`, nadpisujący domyślny (późniejsze wpisy w tablicy `modules` nadpisują wcześniejsze o tym samym kluczu — potwierdzone czytaniem `transformModules()`).

Punkt 1 sam w sobie wystarczył w testach — punkty 2-3 zostawione jako dodatkowe zabezpieczenie.

**Druga pułapka, ta sama sesja:** skrypt migracyjny `create-super-admin-role.js` **oznacza się jako wykonany** w tabeli `script_migrations` nawet gdy wewnętrznie nic nie zrobił (bo moduły USER/AUTH/RBAC nie były jeszcze zainstalowane) — kolejne uruchomienie `db:migrate` go pomija. Trzeba ręcznie skasować wiersz (`delete from script_migrations where script_name like '%super-admin%'`) i uruchomić migrację ponownie, żeby admin faktycznie dostał rolę Super Admin.

### RBAC / bezpieczeństwo — 🔄 doprecyzowane 2026-07-17 (audyt kodu)

**Ważna korekta wcześniejszego założenia: RBAC middleware JEST już wpięte w API**, nie trzeba budować wpięcia od zera. Router (`packages/core/framework/src/http/router.ts`) automatycznie owija handlery `wrapWithPoliciesCheck`, gdy endpoint ma zdefiniowane `policies: [{resource, operation}]` — wzorzec obecny w każdym `packages/medusa/src/api/admin/*/middlewares.ts`. Realny check: `hasPermission()` w `packages/core/framework/src/policies/has-permission.ts`, rolę bierze z JWT (`auth_context.app_metadata.roles`).

**Rzeczywista luka:** dzisiejszy mechanizm sprawdza tylko "czy rola może robić `operation` na `resource`" (np. "czy może `update` `product`) — **bez sprawdzania instancji zasobu** (którego konkretnie produktu, z którego sklepiku). To jest dokładnie brakujący element, nie brak middleware jako takiego.

**Konkretny plan implementacji:**
1. Dodać nullable `resource_id text` do `rbac_policy` (migracja wzorem istniejących w module) — `key` z `resource:operation` na `resource:operation:resource_id` (fallback `*` = globalne/nieswężone, co zachowuje działanie dzisiejszego super-admina `*:*` bez zmian).
2. Rozszerzyć `hasPermission()`/`policyAllows()` o dopasowanie po `resource_id` (dziś mapuje tylko `resource→operations`).
3. Nowa funkcja `wrapWithScopedPoliciesCheck` (obok istniejącej `wrapWithPoliciesCheck`, nie zamiast niej — żeby nie przepisywać od razu ~30 istniejących miejsc) — dociąga `sales_channel_id` z requestu (param/query/body) przed sprawdzeniem uprawnień.
4. Zastosować `scopedPolicies` na start tylko na endpointach `products` i `sales-channels` w `packages/medusa/src/api/admin/*/middlewares.ts` — reszta (orders, customers) później, tym samym wzorcem.
5. Nowy link `user_sales_channel` (`packages/modules/link-modules/src/definitions/`), 1:1 wzorem istniejącego `user-rbac-role.ts` — do "które sklepiki widzi admin w panelu" (osobna sprawa od autoryzacji operacji w punktach 1-4).

**Uwaga do naprawienia przy okazji (bug znaleziony audytem, niezwiązany bezpośrednio z multi-store ale wpłynie na testy):** endpoint `/admin/rbac/me/permissions` pomija dziedziczenie ról (`rbac_role_parent`) przy budowaniu listy uprawnień zwracanej do panelu — do poprawki, gdy będziemy tam pracować.

**Zignorować tabelę `rbac_role_inheritance`** (migracja `Migration20260624200000.ts`) — martwy, nieużywany duplikat koncepcyjny `rbac_role_parent`, nie budować na niej.

### ⚠️ Trzy błędy, przez które scoping nigdy realnie nie działał (znalezione i naprawione 2026-07-18)

Plan powyżej został wdrożony 2026-07-17 i opisany jako "zweryfikowany end-to-end" — nieprawdziwie. W bazie nie istniała wtedy żadna polityka z ustawionym `resource_id` (weryfikacja: `createSklepikWorkflow` jawnie NIE nadawał uprawnień, patrz commit `aac37ea`), więc żaden z trzech poniższych błędów nie miał szans zostać wykryty — ścieżka kodu z prawdziwym `resource_id` po prostu nigdy się nie wykonała.

1. **Unikalny indeks na `rbac_policy.key`** (samo `resource:operation`, bez `resource_id`) uniemożliwiał fizycznie utworzenie zawężonej polityki dla zasobu, który już ma politykę globalną. Naprawa: migracja `Migration20260718073940.ts` zmienia istniejące klucze na `resource:operation:*`, `RbacModuleService.syncRegisteredPolicies` i loader super-admina generują ten format dalej. **Ryzyko dla przyszłych zmian:** jeśli ktoś doda nowy sposób tworzenia polityk globalnych z pominięciem `RbacModuleService`, musi ręcznie dopisać `:*` do klucza, inaczej kolejna próba utworzenia zawężonej polityki dla tego samego resource+operation znowu się wysypie.
2. **`MiddlewareFileLoader` (`packages/core/framework/src/http/middleware-file-loader.ts`) gubił pole `scopedPolicies`** przy przepisywaniu `MiddlewareRoute` na `MiddlewareDescriptor` — sprawdzał tylko `route.middlewares || route.policies`, a obiekt wynikowy nie miał w ogóle `scopedPolicies`. Efekt: `router.ts`'s `if (route.scopedPolicies && isRbacEnabled)` nigdy nie było prawdziwe, bo `route.scopedPolicies` docierało jako `undefined`, niezależnie od tego co deklarował plik `middlewares.ts`. To był błąd systemowy — dotyczył **każdego** endpointu próbującego użyć `scopedPolicies`, nie tylko sales-channels.
3. **`RbacRepository.listPoliciesForRoles`** (surowe SQL, `packages/modules/rbac/src/repositories/rbac.ts`) — zapytanie `SELECT` napisane przed dodaniem kolumny `resource_id` nigdy nie zostało zaktualizowane. Każda polityka wracała z `resource_id: null`, więc `scopedPolicyAllows()` traktował ją jak globalną (`if (!policy.resource_id) return true`) i przepuszczał każde żądanie, niezależnie od faktycznego zakresu.

**Metoda znalezienia:** żaden z trzech błędów nie był widoczny w przeglądzie kodu — wszystkie trzy funkcje osobno wyglądają poprawnie. Ujawniły się dopiero przy realnym teście end-to-end: utworzenie drugiego admina, usunięcie mu roli super-admina, założenie sklepiku przez API, próba dostępu do **cudzego** `sales_channel`/`product` z jego tokenem. Wniosek praktyczny: "kod wygląda dobrze" i "zweryfikowane end-to-end" to nie to samo — bez faktycznego requestu z ograniczonym kontem żaden z tych błędów by nie wypłynął.

**Naprawione 2026-07-18:** `SKLEPIK_OWNER_PERMISSIONS` w `create-sklepik.ts` rozszerzone o `inventory_item`/`price` (create/read/update) — bez tego POST /admin/products odrzucał każdą próbę stworzenia wycenionego produktu. Świadomy kompromis: te dwa zasoby nie mają dziś bezpośredniego linku do `sales_channel`, więc uprawnienie jest efektywnie globalne w zakresie create/read/update (nie zawężone jak product/sales_channel) — właściciel sklepiku mógłby teoretycznie zobaczyć/edytować inventory_item lub price niepowiązane z żadnym jego produktem, gdyby ktoś wywołał te zasoby bezpośrednio przez osobny endpoint. Zaakceptowane jako rozsądny kompromis (bez tego rola była bezużyteczna), przetestowane end-to-end (nowy admin → nowy sklepik → utworzenie i usunięcie własnego wycenionego produktu, izolacja między sklepikami nadal działa). Do doprecyzowania jeśli okaże się realnym problemem.

**Dodatkowo znaleziona, nienaprawiona jeszcze luka (2026-07-18):** zawężenie działa dziś tylko na endpointach `:id` (pojedynczy zasób) — **listy** (`GET /admin/products` bez id) nie są zawężone, przechodzą przez zgrubny check "czy w ogóle może czytać produkty". Właściciel sklepiku może dziś zobaczyć listę/tytuły produktów z cudzych sklepików (nie może ich dotknąć, ale może je zobaczyć). Kandydat do naprawy przy okazji pracy nad RLS niżej — RLS zamyka to z automatu, bez osobnej łatki na liście.

### Row-Level Security (RLS) — docelowa warstwa obrony w głębi (Key Decision 9, 2026-07-18)

**Cel:** nawet gdy w kodzie aplikacji (RBAC, middleware, scoping) jest błąd — a trzy takie błędy znaleziono tego samego dnia — baza danych **fizycznie nie zwróci** wiersza spoza sklepiku, do którego zapytanie ma prawo. To zamyka też lukę z list endpointów opisaną wyżej, bez osobnej łatki na każdym z nich.

**Dlaczego nie "patch" jak w typowych wdrożeniach Medusy:** większość przewodników RLS dla Medusy wymaga łatania skompilowanego `node_modules/@medusajs/framework` (kruche, wymaga ponownego patchowania przy każdym upgrade). **My tego problemu nie mamy** — `packages/core/framework` to nasz własny fork, hak na połączenie z bazą wpinamy bezpośrednio w źródło, czysto, zgodnie z filozofią "przepisujemy, nie kopiujemy bezmyślnie" z `CLAUDE.md`.

**Architektura (trzy warstwy, wzorem sprawdzonego przepisu dla Medusa+MikroORM):**
1. **Middleware HTTP** — wyciąga z JWT (`auth_context`) listę `sales_channel_id`, do których zalogowany admin ma dostęp (przez `user_sales_channel` + `rbac_policy.resource_id`), zapisuje w `AsyncLocalStorage`. Super-admin (`*:*`) dostaje specjalną wartość oznaczającą "bez ograniczeń".
2. **Hak na połączenie z bazą** (`packages/core/framework`, warstwa Knex/MikroORM) — przed każdym zapytaniem ustawia sesyjną zmienną Postgresa (`SELECT set_config('app.current_sales_channels', ..., false)`) na podstawie kontekstu z warstwy 1.
3. **Polityki RLS na tabelach** — Postgres automatycznie filtruje wiersze wg tej zmiennej. U nas **nie** prosty `tenant_id = current_setting(...)` jak w generycznych poradnikach — `product` nie ma bezpośredniej kolumny `sales_channel_id`, jest powiązany przez tabelę linkującą `product_sales_channel`, więc polityka potrzebuje `EXISTS (SELECT 1 FROM product_sales_channel WHERE product_id = product.id AND sales_channel_id = ANY(current_setting(...)))` (albo `current_setting = '*'` dla super-admina).

**Wymóg krytyczny:** RLS jest **całkowicie ignorowane dla superusera Postgresa**. Dzisiejsza rola aplikacji (`szopifaj`) **jest superuserem** (zweryfikowane 2026-07-18: `rolsuper=t`, `rolbypassrls=t`) — to breaking change infrastrukturalny, wymaga nowej, nieuprzywilejowanej roli do połączenia aplikacji, z osobną rolą (dzisiejszą, superuser) zarezerwowaną do migracji/DDL.

**Zakres tabel — węziej niż generyczny poradnik:** typowy przepis RLS dla SaaS nakłada `tenant_id` na wszystkie ~44 tabele Medusy. U nas realnie potrzebne od razu: `product` (przez link), `sales_channel` (już ma scoping w RBAC, RLS to wzmacnia). `order`/`customer` — gdy powstanie scoping RBAC dla zamówień (patrz Migration Path niżej), rozszerzyć RLS w tym samym momencie, nie osobno.

**Znane pułapki z researchu, do przetestowania explicité:**
- Kontekst musi przetrwać `AsyncLocalStorage` przez cały łańcuch async (workflow engine Medusy używa własnej orkiestracji kroków — sprawdzić, czy kontekst nie gubi się między krokami workflow).
- Zapytania bez ustawionego kontekstu (joby w tle, migracje, skrypty CLI) muszą jawnie działać w trybie "system/bez ograniczeń", nie przypadkiem dziedziczyć kontekst poprzedniego żądania z puli połączeń.
- Testować przez **surowe SQL z rolą aplikacji**, nie tylko przez API — to jedyny sposób żeby faktycznie zweryfikować, że baza sama odmawia, niezależnie od kodu aplikacji.

**Szacunek pracy:** poradnik referencyjny (prostszy model, kolumna `tenant_id` bezpośrednio) szacuje 4-6h dla kogoś znającego Medusę i Postgresa. U nas realistycznie więcej — model przez tabelę linkującą jest bardziej złożony niż prosta kolumna, plus musimy to wpiąć we własny fork frameworka zamiast gotowego patcha.

**Postęp (2026-07-18):**
- ✅ **Warstwa 3 (polityki RLS) gotowa i przetestowana** — `Migration20260718092554.ts`, włączone i zweryfikowane na `product`+`sales_channel`. Test **surowym SQL jako rola aplikacji**, ręcznie ustawianym `SET app.current_sales_channels`: kontekst = sklepik A → widzi tylko swój produkt; kontekst = sklepik B → 0 wierszy (poprawnie, nie widzi cudzego); brak kontekstu → widzi wszystko (tryb systemowy). Wszystkie trzy przypadki potwierdzone empirycznie, nie tylko przez czytanie polityki.
- ✅ **Nowa nieuprzywilejowana rola bazodanowa `szopifaj_app`** utworzona i aktywna — `DATABASE_URL` działającej usługi już na nią przełączony (potwierdzone: usługa zdrowa, `/health`+`/app` 200, po restarcie). Rola `szopifaj` (superuser) zarezerwowana wyłącznie do migracji, przez tymczasową podmianę `DATABASE_URL` w `app/.env` na wartość z `MIGRATION_DATABASE_URL` (nadpisanie przez zmienną środowiskową w shellu **nie działa** z tym CLI — obserwacja z tej sesji, proces wisi bez błędu; podmiana pliku działa niezawodnie).
- ⬜ **Warstwy 1+2 (middleware + hak na Knex) próbowane 2026-07-18, cofnięte.** Zaimplementowane w pełni: `AsyncLocalStorage` (`packages/core/framework/src/rls/tenant-context.ts`), rozstrzyganie kontekstu z ról admina (`resolveTenantContext` w `has-permission.ts`), hak na `client.acquireConnection` we wspólnym `pgConnectionLoader` ustawiający `set_config` na każdym wziętym z puli połączeniu, wpięte w `wrapWithPoliciesCheck`. Zbudowane, wdrożone, i **złamało tworzenie produktu** dla właściciela sklepiku (500: "Cannot read properties of undefined"). Przyczyna: `createProductsWorkflow` (głęboko w rdzeniu Medusy, `@medusajs/core-flows`) **sam wewnętrznie odczytuje z powrotem dopiero co utworzony produkt** jako część własnych kroków, zanim link `product_sales_channel` istnieje — z aktywnym kontekstem RLS ten wewnętrzny odczyt widzi 0 wierszy, workflow zwraca pusty wynik, endpoint się wywala na `result[0].id`. To nie błąd w naszym kodzie — to fundamentalne napięcie między "RLS dla `product` przez tabelę linkującą" a "generyczne workflow Medusy zakładają że własny zapis jest natychmiast w pełni widoczny sobie samemu". **Cofnięte w całości i zweryfikowane** (tworzenie produktu ponownie działa, `git status` czysty, dokładnie ten sam commit co przed próbą) — polityki z warstwy 3 (`product`/`sales_channel`, SELECT-only) zostają, nieaktywne i bezpieczne, dokładnie jak przed tą próbą.
  - **Do rozwiązania w kolejnej próbie:** albo (a) tymczasowo podnosić kontekst do "systemowy" (`*`) na czas wykonania samego workflow tworzącego, ufając że zewnętrzne endpointy `POST`/`PUT` i tak są już chronione przez RBAC w kodzie (przetestowane, działa) — RLS wtedy chroni tylko odczyty inicjowane bezpośrednio przez usera (GET/list), nie odczyty wewnętrzne wewnątrz jednego requesta; albo (b) zbadać czy `createProductsWorkflow` da się skonfigurować/przeciążyć żeby swój wewnętrzny odczyt robił z pominięciem RLS (np. osobna rola/connection dla operacji wewnątrz-workflow); (a) jest prostsze i prawdopodobnie wystarczające — do zweryfikowania.
- ⚠️ **Ważne dla kolejnej sesji/agenta:** `app/.env` **nie jest w git** (patrz README) — powyższy stan (nowy `DATABASE_URL`, `MIGRATION_DATABASE_URL`) i sama rola `szopifaj_app` w Postgresie **nie są odtwarzalne z repo**. Jeśli serwer padnie/zostanie odtworzony, trzeba je odtworzyć ręcznie wg tego opisu, inaczej usługa nie połączy się z bazą.

## Migration Path

1. Migracja: `resource_id` nullable na `rbac_policy` + nowy link `user_sales_channel` (wzorem `user-rbac-role.ts`).
2. Rozszerzyć `hasPermission()`/`policyAllows()` o dopasowanie `resource_id`, dodać `wrapWithScopedPoliciesCheck` (obok istniejącego mechanizmu, patrz Design Details/RBAC).
3. Zastosować scoped policies na `products` i `sales-channels` w `api/admin/*/middlewares.ts` (pierwsze dwa endpointy, wzorzec do powielenia na resztę).
4. Napisać `createSklepikWorkflow` (sales_channel + region + api_key + link admina do `user_sales_channel`).
5. Widget w strefie `topbar` panelu admina (przełącznik sklepiku) + custom route na "nowy sklepik" — rozszerzenie wbudowanego panelu, nie nowa aplikacja.
6. ✅ **Zrobione (2026-07-18).** Middleware storefrontu (`szopifaj-storefront/src/middleware.ts`) resolvuje subdomenę → sales_channel/publishable key przez nowy backendowy endpoint `GET /store/sklepiki/resolve?handle=X` (świadomie pod `/store/*`, autoryzowany "bootstrap" kluczem — dowolnym znanym z góry, nie musi być "tym właściwym", patrz komentarz w route.ts). `createSklepikWorkflow` generuje unikalny `handle` (slug + losowy sufiks) i `default_country_code` w `sales_channel.metadata` przy zakładaniu.
   - **Ważne odkrycie po drodze:** `GET /store/regions` zwraca regiony **wszystkich** sklepików niezależnie od użytego klucza — `sales_channel` i `region` nie mają formalnego powiązania w Medusie. Naiwna implementacja (wyliczanie kraju z pierwszego pasującego regionu) wyglądałaby na działającą (200, bez błędów) ale cicho zawsze pokazywałaby ten sam, najstarszy region. Naprawione: `default_country_code` zapisywany wprost w metadanych i zwracany przez `resolve`, storefront używa go bezpośrednio zamiast zgadywać.
   - **Przetestowane end-to-end** (żądania z ręcznie ustawianym nagłówkiem `Host`, bezpośrednio na port Next.js — patrz ograniczenie niżej): domyślna domena nadal trafia na `/pl` (brak regresji), testowy sklepik z regionem Portugalia poprawnie trafia na `/pt`.
   - **Ograniczenie infrastrukturalne, nie kodowe:** dowolne subdomeny na żywo (bez ręcznego ustawiania nagłówka `Host`) wymagają certyfikatu SSL typu wildcard, a ten wymaga weryfikacji DNS-01 — niemożliwej z `nip.io` (nie kontrolujemy jego DNS). Mechanizm w kodzie jest gotowy i poprawny; do realnego użycia na żywo potrzebna własna domena (z kontrolą nad DNS) albo osobne certyfikaty per-sklepik zakładane ręcznie (jak dziś dla `store`/`demo`).
7. Przetestować end-to-end: dwóch adminów, dwa sklepiki, weryfikacja że żaden nie widzi danych drugiego — także bezpośrednim wywołaniem API, nie tylko przez UI panelu. Częściowo zrobione (patrz sesje 2026-07-18 w `roadmap.md` — testy RBAC scoping dla product/sales-channel/order), ale nie przez UI panelu (jeszcze niezrobione, patrz krok 5 wyżej).

## Constraints on Current Work

- Nie budować nowej encji `Store` per sklepik — to świadomie odrzucona ścieżka (patrz Summary).
- Każdy nowy endpoint w `api/admin` dotykający produktów/zamówień/klientów musi od razu uwzględniać filtrowanie po `sales_channel_id` admina, żeby nie trzeba było tego retrofitować.

## Open Questions

- Czy klienci (customers) powinni pozostać globalni, czy jednak scoped per sklepik? Dziś: globalni (Key Decision 5). Do rewizji, jeśli okaże się problemem (np. właściciel sklepiku A chce mieć wyłączny wgląd w swoją bazę klientów).
- Rejestracja: zamknięta/zaproszeniowa na start (Key Decision 7) — kiedy i czy w ogóle otworzyć publicznie, nierozstrzygnięte.
- Custom domain per sklepik (nie tylko subdomena `*.szopifaj...`) — nie blokuje MVP, do zaprojektowania later.

## References

- [`roadmap.md`](roadmap.md) — status ogólny, krok 3.
- [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md) — audyt modułu `rbac`, na którym opiera się ten plan.
- Oficjalny przepis Medusy na marketplace (wzorzec `createVendorWorkflow`, `actor_type`): [docs.medusajs.com/resources/recipes/marketplace/examples/vendors](https://docs.medusajs.com/resources/recipes/marketplace/examples/vendors)
- Oficjalne stanowisko Medusy nt. multi-store vs multi-tenant: [medusajs.com/blog/multi-tenant-rigby](https://medusajs.com/blog/multi-tenant-rigby/)
- Mercur (wzorzec osobnego Vendor Panel, świadomie NIE naśladowany tutaj — inna skala): [github.com/mercurjs/mercur](https://github.com/mercurjs/mercur)
- Customizing Admin Panel for Vendors — oficjalna dyskusja Medusy potwierdzająca brak natywnego multi-tenant scoping w panelu: [medusajs/medusa#9458](https://github.com/medusajs/medusa/discussions/9458)
- Audyt kodu 2026-07-17 (sesja, w której powstał ten plan) — ustalenie że `store` jest ślepą uliczką, `sales_channel` jest właściwym mechanizmem; drugi audyt tego samego dnia doprecyzował dokładny plan RBAC i skorygował błędne założenie o dziedziczeniu ról dla super-admina.
