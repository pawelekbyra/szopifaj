# Platforma multi-sklepowa: jeden admin, wiele sklepików

**Status:** 🟢 **Fundament zaimplementowany i zweryfikowany end-to-end (2026-07-17).** RBAC scoping (`resource_id` na `rbac_policy`), link `user_sales_channel`, `createSklepikWorkflow`, endpoint `POST/GET /admin/sklepiki` — wszystko działa na serwerze, przetestowane: utworzenie sklepiku, lista "moje sklepiki", scoped policy check na `/admin/sales-channels/:id` (GET/POST/DELETE). Pozostaje: widget "przełącznik sklepiku" w panelu admina (topbar), rozszerzenie scoped policies na `products`/`orders` (dziś tylko `sales-channels`).
**Target:** `packages/modules/rbac`, `packages/modules/sales-channel`, nowy moduł kontrolny (homepage/panel "moje sklepiki"), storefront.
**Depends on:** [`roadmap.md`](roadmap.md) (krok 3 — multi-tenant).
**Author:** właściciel + agent (sesja 2026-07-17, po audycie kodu i researchu zewnętrznym).
**Last updated:** 2026-07-17.

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

## Design Details

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

## Migration Path

1. Migracja: `resource_id` nullable na `rbac_policy` + nowy link `user_sales_channel` (wzorem `user-rbac-role.ts`).
2. Rozszerzyć `hasPermission()`/`policyAllows()` o dopasowanie `resource_id`, dodać `wrapWithScopedPoliciesCheck` (obok istniejącego mechanizmu, patrz Design Details/RBAC).
3. Zastosować scoped policies na `products` i `sales-channels` w `api/admin/*/middlewares.ts` (pierwsze dwa endpointy, wzorzec do powielenia na resztę).
4. Napisać `createSklepikWorkflow` (sales_channel + region + api_key + link admina do `user_sales_channel`).
5. Widget w strefie `topbar` panelu admina (przełącznik sklepiku) + custom route na "nowy sklepik" — rozszerzenie wbudowanego panelu, nie nowa aplikacja.
6. Zrobić middleware storefrontu resolvujący subdomenę → sales_channel/publishable key, zastąpić dzisiejszy pojedynczy hardkodowany klucz w `.env.local`.
7. Przetestować end-to-end: dwóch adminów, dwa sklepiki, weryfikacja że żaden nie widzi danych drugiego — także bezpośrednim wywołaniem API, nie tylko przez UI panelu.

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
