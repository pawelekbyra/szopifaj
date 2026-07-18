# Audyt modułów: co w `packages/modules/*` jest realnie podłączone

**Status:** Complete — audyt gotowy, priorytetyzacja jasna; implementacja poszczególnych punktów nierozpoczęta.
**Target:** `packages/modules/*`, `packages/plugins/*`, `app/medusa-config.js`.
**Depends on:** [`product-2026-audit.md`](product-2026-audit.md) (tor "pojedynczy sklepik 10/10" — ten dokument dostarcza mu warstwę techniczną, weryfikuje kilka jego założeń kodem zamiast pamięcią z poprzedniej sesji), [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md) (moduł `tax` — zakres pracy tam, nie tutaj).
**Author:** agent (sesja 2026-07-18, na zlecenie roadmapy krok 2).
**Last updated:** 2026-07-18.

## Summary

Roadmapa (krok 2) prosiła o audyt: co z 35 modułów w `packages/modules/*` jest realnie podłączone w `app/medusa-config.js`, co jest tylko źródłem, czego brakuje do kompletnego sklepu. Naiwne czytanie samego `medusa-config.js` (4 wpisy w `modules: []` + 2 w `plugins: []`) sugerowałoby, że prawie nic nie jest podłączone. **To błędny wniosek** — kod frameworka (`packages/core/utils/src/common/define-config.ts`, funkcja `resolveModules`) pokazuje, że Medusa v2 ładuje domyślnie ok. 24 z 35 modułów zawsze, niezależnie od zawartości `medusa-config.js` — komentarz w kodzie wprost: *"The default set of modules to always use [...] end user can never remove a module from this list."* `medusa-config.js` w tym repo służy tylko do: (a) podmiany wariantów in-memory→Redis (cache/event-bus/workflow-engine), (b) włączenia modułu `rbac` (feature-flagged, domyślnie wyłączony), (c) rejestracji dwóch pluginów (`loyalty-plugin`, `draft-order`).

Kluczowe odkrycie, które koryguje wcześniejszy audyt w `product-2026-audit.md` (sesja 2026-07-17): **moduł `payment` jest załadowany, ale bez ani jednego prawdziwego providera płatności.** Jedyny aktywny provider to wbudowany `system` (`packages/modules/payment/src/providers/system.ts`) — no-op, który **zawsze automatycznie autoryzuje każdą płatność** (`authorizePayment` zwraca `AUTHORIZED` bezwarunkowo, bez pobrania choćby złotówki). Dzięki temu checkout "działa" end-to-end (da się złożyć zamówienie), ale **nikt nie może dziś zapłacić prawdziwymi pieniędzmi** — Stripe (mimo kompletnego kodu z wariantami P24/BLIK, patrz niżej) nie jest nigdzie zarejestrowany: brak klucza API w `.env`, brak wpisu w `medusa-config.js`. To jest najważniejszy pojedynczy wniosek tego audytu.

Podobnie: `notification` jest załadowany tylko z providerem `local` (kanał `feed` — powiadomienia wewnątrz panelu admina), **żaden e-mail do klienta nie jest dziś wysyłany** (SendGrid ma gotowy kod providera, ale zero konfiguracji w `.env`/`medusa-config.js`). `auth` działa w pełni dla e-mail/hasła, ale Google/GitHub (kod gotowy) nie są zarejestrowane. `file` zapisuje na lokalny dysk serwera (provider `file-local`), nie na S3 — działa dziś (widoczne zdjęcia produktów), ale ryzykowne dla trwałości/skalowania.

Weryfikacja kodem zamiast pamięcią potwierdziła też jedną rzecz na plus: `@medusajs/loyalty-plugin` **jest już aktywny** w `app/medusa-config.js` (linia 40) — `product-2026-audit.md` (z 2026-07-17, dzień przed tym audytem) wciąż mówi "zbudowany, ale nieaktywny". To się zmieniło w międzyczasie (prawdopodobnie przy okazji którejś z sesji multi-store 2026-07-18) i tamten dokument jest w tym jednym punkcie nieaktualny — do poprawienia przy najbliższej okazji pracy nad nim, nie w zakresie tego audytu.

## Key Decisions (do not deviate without discussion)

1. **Klasyfikacja: 4 kategorie statusu**, nie skala ciągła — żeby audyt dawał jasne, przeszukiwalne wnioski: `✅ podłączony+funkcjonalny`, `🟡 podłączony+szkielet` (zarejestrowany, ale główna funkcja realnie nie działa dla użytkownika końcowego), `🔴 niepodłączony-potrzebny`, `⚪ niepodłączony-nieistotny/redundantny`.
2. **Ten dokument nie duplikuje `tax`/fiskalność** — pełny zakres w `fiscal-compliance-poland.md`. Tu tylko status podłączenia modułu `tax` (podłączony, funkcjonalny na poziomie prostego kalkulatora — reszta pracy tam).
3. **Ten dokument nie duplikuje ogólnej priorytetyzacji produktowej** (Meilisearch, InPost, Przelewy24, Core Web Vitals) — to żyje w `product-2026-audit.md`. Tu: potwierdzenie/korekta stanu technicznego modułów z poziomu kodu, plus rekomendacje specyficzne dla warstwy modułów (które providery włączyć, które moduły włączyć/zignorować).
4. **`packages/modules/providers/` liczy się jako 1 z 35 katalogów, ale nie jest modułem domenowym** — to kontener 13 implementacji providerów (dla payment/auth/file/notification/locking/analytics/caching) używanych przez właściwe moduły. Traktowany osobno w tabeli niżej, nie wymuszony do 4 kategorii.

## Design Details

### Jak Medusa v2 faktycznie ładuje moduły (ustalenie kluczowe dla całego audytu)

`app/medusa-config.js` → `defineConfig()` → `packages/core/utils/src/common/define-config.ts`, funkcja `resolveModules()`. Tam `defaultModules` (ścieżka non-cloud, którą to repo faktycznie wykonuje — `isCloud` jest `true` tylko gdy `EXECUTION_CONTEXT=medusa-cloud`, u nas nieustawione) zawiera **na stałe**: `stock-location, inventory, product, pricing, promotion, customer, sales-channel, cart, region, api-key, store, tax, currency, payment, order, settings, auth (+emailpass), user, fulfillment (+manual), notification (+local), cache, event-bus, workflow-engine, locking, file (+local)`. Wpisy w `modules: []` w `medusa-config.js` **nadpisują** te domyślne (np. podmiana `cache`→`cache-redis`) albo dodają nowe (np. `rbac`, bo jest feature-flagged i domyślnie wyłączony) — nie da się niczego z tej listy "usunąć" przez brak wpisu.

### Tabela — wszystkie 35 wpisów w `packages/modules/*`

| # | Moduł | Status | Notatka |
|---|-------|--------|---------|
| 1 | `product` | ✅ funkcjonalny | domyślny, zawsze ładowany |
| 2 | `pricing` | ✅ funkcjonalny | domyślny |
| 3 | `promotion` | ✅ funkcjonalny | domyślny — kody rabatowe, kampanie, reguły (potwierdza `product-2026-audit.md`) |
| 4 | `customer` | ✅ funkcjonalny | domyślny |
| 5 | `sales-channel` | ✅ funkcjonalny | domyślny, rdzeń mechanizmu multi-sklepowości |
| 6 | `cart` | ✅ funkcjonalny | domyślny |
| 7 | `region` | ✅ funkcjonalny | domyślny |
| 8 | `api-key` | ✅ funkcjonalny | domyślny |
| 9 | `store` | ✅ funkcjonalny | domyślny |
| 10 | `currency` | ✅ funkcjonalny | domyślny |
| 11 | `order` | ✅ funkcjonalny | domyślny |
| 12 | `inventory` | ✅ funkcjonalny | domyślny — multi-magazyn, rezerwacje (potwierdza `product-2026-audit.md`) |
| 13 | `stock-location` | ✅ funkcjonalny | domyślny |
| 14 | `user` | ✅ funkcjonalny | domyślny |
| 15 | `settings` | ✅ funkcjonalny | domyślny — user preferences, view configs (drobna funkcja adminowa) |
| 16 | `rbac` | ✅ funkcjonalny | jedyny moduł domenowy jawnie włączony w `medusa-config.js` (feature-flagged domyślnie wyłączony) — najintensywniej przetestowany moduł w repo (patrz `roadmap.md`, sesje multi-store 2026-07-18: naprawione 2 systemowe błędy scopingu, przetestowane end-to-end na żywym serwerze) |
| 17 | `tax` | ✅ funkcjonalny, wąski zakres | domyślny, prosty kalkulator systemowy — właściwy zakres rozbudowy w `fiscal-compliance-poland.md`, nie tu |
| 18 | `auth` | ✅ funkcjonalny, wąski zakres | domyślny, ale **tylko provider `emailpass`** — Google/GitHub mają gotowy kod (`packages/modules/providers/auth-google`, `auth-github`), niezarejestrowane, brak `CLIENT_ID`/`CLIENT_SECRET` w `.env` |
| 19 | `file` | ✅ funkcjonalny, ryzykowny | domyślny, ale **tylko provider `file-local`** (dysk lokalny serwera) — `file-s3` ma gotowy kod, niepodłączony, brak zmiennych `S3_*` w `.env`. Ryzyko utraty zdjęć produktów przy awarii/migracji serwera, brak CDN |
| 20 | `cache-redis` | ✅ funkcjonalny | jawnie w `medusa-config.js`, podmienia domyślny in-memory |
| 21 | `event-bus-redis` | ✅ funkcjonalny | jawnie w `medusa-config.js`, podmienia domyślny in-memory |
| 22 | `workflow-engine-redis` | ✅ funkcjonalny | jawnie w `medusa-config.js`, podmienia domyślny in-memory |
| 23 | `locking` | ✅ funkcjonalny, wąski zakres | domyślny, ale bez jawnej konfiguracji providera używa **wbudowanego in-memory provider** modułu (nie `locking-postgres`/`locking-redis` z `providers/`) — wystarczające przy `workerMode: "shared"` (jeden proces), stanie się problemem przy skalowaniu do wielu instancji |
| 24 | `link-modules` | ✅ funkcjonalny | nie jest to "moduł domenowy" tylko wewnętrzny mechanizm łączenia modułów (linki jak product↔sales_channel) — zawsze aktywny, część rdzenia, nie podlega włączaniu/wyłączaniu przez config |
| 25 | `payment` | 🟡 **szkielet** | domyślny, ale jedyny aktywny provider to wbudowany `system` — **no-op, zawsze autoryzuje płatność bez pobrania pieniędzy** (`packages/modules/payment/src/providers/system.ts`). Realny gateway (Stripe) ma kompletny kod providera z wariantami metod (`packages/modules/providers/payment-stripe/src/services/`: `stripe-provider.ts`, `stripe-przelewy24.ts`, `stripe-blik.ts`, `stripe-ideal.ts`, `stripe-bancontact.ts`, `stripe-giropay.ts`, `stripe-oxxo.ts`, `stripe-promptpay.ts` — 15 plików TS łącznie), ale **nigdzie niezarejestrowany**: brak `STRIPE_API_KEY` w `.env`, brak wpisu `payment.providers` w `medusa-config.js`. **Dziś nikt nie może zapłacić prawdziwymi pieniędzmi.** |
| 26 | `notification` | 🟡 **szkielet** | domyślny, ale jedyny aktywny provider to `local` (kanał `feed`, tylko wewnątrz panelu admina) — **żaden e-mail do klienta nie jest wysyłany**. `notification-sendgrid` ma gotowy kod (`packages/modules/providers/notification-sendgrid/`), niezarejestrowany, brak `SENDGRID_API_KEY` w `.env` |
| 27 | `fulfillment` | 🟡 **szkielet** | domyślny, ale jedyny aktywny provider to `manual` — zero integracji z kurierem, zgodne z ustaleniem `product-2026-audit.md` ("Fulfillment: tylko ręczne" → tam już zaklasyfikowane jako "❌ atrapa"), InPost zaplanowany w tamtym dokumencie (Etap 2) |
| 28 | `analytics` | 🔴 niepodłączony, potrzebny (niski priorytet) | **jedyny moduł, który nie ma żadnego wpisu domyślnego w `resolveModules()`** — całkowicie opcjonalny, wymaga jawnej rejestracji. Ma gotowe providery `analytics-local` i `analytics-posthog` w `providers/`. Telemetria zdarzeń sklepu — przydatna, niekrytyczna |
| 29 | `translation` | 🔴 niepodłączony, potrzebny (przyszłościowo) | feature-flagged (`MEDUSA_FF_TRANSLATION`), domyślnie wyłączony, nie ustawiony u nas. Wielojęzyczność produktów/treści — istotne dopiero jeśli/gdy sklep(y) mają obsługiwać więcej niż jeden język |
| 30 | `index` | 🔴 niepodłączony, potrzebny (niski priorytet) | feature-flagged (`MEDUSA_FF_INDEX_ENGINE`), domyślnie wyłączony. Silnik szybkiego wyszukiwania/filtrowania w adminie — nice-to-have, nie blokuje niczego dziś (Meilisearch dla storefrontu to osobna sprawa, patrz `product-2026-audit.md`) |
| 31 | `caching` (nowy moduł, odrębny od `cache`) | ⚪ nieistotny/redundantny | feature-flagged (`MEDUSA_FF_CACHING`), sam Medusa oznacza go jako `[WIP]` we własnym opisie flagi — nie warto włączać produkcyjnie, `cache-redis` już pokrywa tę potrzebę |
| 32 | `cache-inmemory` | ⚪ nieistotny/redundantny | domyślny wariant `cache`, u nas **nadpisany** przez `cache-redis` — obecny jako źródło/fallback frameworka, nieużywany w tym wdrożeniu |
| 33 | `event-bus-local` | ⚪ nieistotny/redundantny | jw., nadpisany przez `event-bus-redis` |
| 34 | `workflow-engine-inmemory` | ⚪ nieistotny/redundantny | jw., nadpisany przez `workflow-engine-redis` |
| 35 | `providers` | ⚫ nie jest modułem domenowym | kontener 13 pod-pakietów providerów: `auth-emailpass` ✅aktywny, `auth-github`/`auth-google` 🔴niepodłączone, `fulfillment-manual` ✅aktywny, `file-local` ✅aktywny, `file-s3` 🔴niepodłączony, `notification-local` ✅aktywny, `notification-sendgrid` 🔴niepodłączony, `payment-stripe` 🔴niepodłączony (najbardziej dopracowany kod ze wszystkich niepodłączonych — 15 plików, warianty metod płatności PL/EU), `locking-postgres`/`locking-redis` 🔴niepodłączone (używany wbudowany in-memory), `caching-redis` 🔴niepodłączony (moduł `caching` sam nieaktywny), `analytics-local`/`analytics-posthog` 🔴niepodłączone (moduł `analytics` sam nieaktywny) |

### Podsumowanie liczbowe

- ✅ Podłączone i funkcjonalne (w tym z zawężonym zakresem opisanym w notatce): **24** — `product, pricing, promotion, customer, sales-channel, cart, region, api-key, store, currency, order, inventory, stock-location, user, settings, rbac, tax, auth, file, cache-redis, event-bus-redis, workflow-engine-redis, locking, link-modules`.
- 🟡 Podłączone, ale szkielet (zarejestrowane, główna funkcja realnie nie działa): **3** — `payment, notification, fulfillment`.
- 🔴 Niepodłączone, ale potrzebne (różny priorytet): **3** — `analytics, translation, index`.
- ⚪ Niepodłączone, nieistotne/redundantne: **4** — `caching, cache-inmemory, event-bus-local, workflow-engine-inmemory`.
- ⚫ Nie jest modułem domenowym (kontener providerów): **1** — `providers` (zawiera 13 pod-pakietów, z których 8 jest niepodłączonych mimo gotowego kodu).

**35 razem**, zgodnie z liczbą katalogów w `packages/modules/*`.

### Pluginy (`packages/plugins/*`) — dla porównania, precedens formatu

- `@medusajs/loyalty-plugin` — ✅ **aktywny** w `medusa-config.js` (linia 40). Program lojalnościowy, gift cards, store credit. Koryguje `product-2026-audit.md` (z 2026-07-17), który wciąż mówi "nieaktywny" — stan zmienił się między sesjami, dokument nie został zaktualizowany w tym jednym punkcie.
- `@medusajs/draft-order` — ✅ aktywny, ale **z innego powodu niż loyalty**: to jeden z domyślnych pluginów Medusy (`resolvePlugins()` w `define-config.ts` ma wbudowaną mapę `defaultPlugins` zawierającą `@medusajs/draft-order` zawsze, niezależnie od configu) — wpis w `medusa-config.js` jest więc nadmiarowy/jawny-ale-niepotrzebny, nie błędny.

### Oficjalne/community pluginy Medusy warte rozważenia (poza tym, co już opisuje `product-2026-audit.md`)

`product-2026-audit.md` już rekomenduje `@rokmohar/medusa-plugin-meilisearch` (wyszukiwanie), `medusa-inpost-fulfillment` (kurier), `@gmisoftware/przelewy24-payments-medusa`/community Przelewy24 (płatności) — nie duplikuję tu. Dodatkowa obserwacja z tego audytu: **oficjalny `@medusajs/payment-stripe` nie jest potrzebny jako osobna zależność** — kod providera Stripe już istnieje w tym repo (`packages/modules/providers/payment-stripe/`), łącznie z wariantami P24/BLIK/iDEAL/Bancontact/Giropay/OXXO/PromptPay. To nie jest luka w kodzie, to luka w **konfiguracji** (klucz API + wpis w `modules: []`).

## Migration Path — priorytetyzacja "co zrobić dalej"

1. **[KRYTYCZNE] Podłączyć prawdziwego payment providera.** Kod Stripe (z wariantami PL: BLIK, Przelewy24) już istnieje i jest najbardziej dopracowanym z niepodłączonych providerów. Potrzebne: klucz Stripe API (właściciel — sprawdzić, czy ma już konto, patrz `product-2026-audit.md` Open Questions), wpis w `app/medusa-config.js` (`modules: [{resolve: "@medusajs/medusa/payment", options: {providers: [...]}}]`), zdjęcie zależności od domyślnego no-op `system` providera dla realnych transakcji. Bez tego kroku **żadna z pozostałych funkcji sklepu (fulfillment, tax/fiskalizacja) nie ma sensu biznesowego** — nie ma z czego rozliczać VAT ani co wysyłać, jeśli nikt nie zapłacił.
2. **[WYSOKIE] Podłączyć realny kanał e-mail (`notification-sendgrid`).** Kod gotowy, potrzebny `SENDGRID_API_KEY`. Bez tego klienci nie dostają potwierdzeń zamówień ani resetu hasła mailem — podstawowa funkcja każdego sklepu.
3. **[WYSOKIE] Fulfillment: kurier automatyczny.** Już zaplanowane szczegółowo w `product-2026-audit.md` (Etap 2, InPost) — ten audyt tylko potwierdza z poziomu kodu, że dziś jest wyłącznie `fulfillment-manual`.
4. **[ŚREDNIE] Trwałe przechowywanie plików (`file-s3`).** Kod gotowy (`packages/modules/providers/file-s3/`), potrzebne dane dostępowe do R2/S3/MinIO + zmienne `S3_*`. Zdjęcia produktów dziś leżą na lokalnym dysku serwera — ryzyko utraty przy awarii/migracji, brak CDN.
5. **[ŚREDNIE] Social login (Google/GitHub).** Kod gotowy (`auth-google`, `auth-github`), potrzebne `CLIENT_ID`/`CLIENT_SECRET` z odpowiednich konsol deweloperskich.
6. **[NISKIE, dopiero przy skalowaniu] `locking-redis`/`locking-postgres` zamiast wbudowanego in-memory.** Krytyczne dopiero gdy `workerMode` przestanie być `"shared"` (jeden proces) — dziś niekrytyczne, ale tanie do zrobienia razem z resztą redis-owych podmian.
7. **[NISKIE, warunkowe] `translation`, jeśli/gdy sklep(y) mają być wielojęzyczne** — nie teraz, świadome odłożenie.
8. **[NISKIE] `analytics` (PostHog)** — telemetria zdarzeń, przydatna dla decyzji produktowych, niekrytyczna.
9. **[DROBNE, dokumentacyjne] Poprawić `product-2026-audit.md`** w punkcie o `@medusajs/loyalty-plugin` (dziś mówi "nieaktywny", stan zmienił się od 2026-07-17) — poza zakresem tego dokumentu, zostawione jako TODO dla następnej sesji dotykającej tamten plik.

## Constraints on Current Work

- Ten audyt jest analizą, nie implementacją — żaden z powyższych punktów Migration Path nie został wykonany w tej sesji, kod produkcyjny niezmieniony.
- Nie duplikować zakresu `fiscal-compliance-poland.md` (moduł `tax`) ani ogólnej priorytetyzacji produktowej `product-2026-audit.md` — ten dokument to warstwa techniczna pod nimi, referuj zamiast kopiować przy przyszłych aktualizacjach.
- Przy podłączaniu payment/notification providerów: żadnych prawdziwych kluczy/sekretów w commitach (zgodnie z `CLAUDE.md`, "Zasady twarde").

## Open Questions

- Czy właściciel ma już konto Stripe (i ewentualnie aktywowane metody P24/BLIK) — patrz `product-2026-audit.md` Open Questions, nierozstrzygnięte tam, wciąż aktualne tutaj jako blocker punktu 1 Migration Path.
- Czy `caching` (nowy moduł, `[WIP]` wg samej Medusy) ma sens kiedykolwiek włączać, czy `cache-redis` (obecny, stabilny) pozostaje wystarczający na stałe — do rewizji, gdy Medusa oznaczy `caching` jako stabilny (nie dziś).
- Docelowa architektura wieloinstancyjna (kilka procesów `szopifaj` za load balancerem) nie jest dziś planowana — jeśli się pojawi, punkt 6 Migration Path (`locking-redis`) staje się krytyczny, nie tylko "niski priorytet".

## References

- [`product-2026-audit.md`](product-2026-audit.md) — równoległy tor: kompletność produktowa pojedynczego sklepu, priorytetyzacja płatności PL/kurier/wyszukiwarka.
- [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md) — pełny zakres modułu `tax`/fiskalności.
- [`roadmap.md`](roadmap.md) — status ogólny, ten dokument zamyka krok 2.
- `packages/core/utils/src/common/define-config.ts` — źródło ustalenia, które moduły są domyślnie ładowane (funkcja `resolveModules`, `sharedModules`/`defaultModules`/`resolvePlugins`).
- `packages/modules/payment/src/providers/system.ts` — kod no-op payment providera, dowód na "checkout działa, ale nikt nie płaci".
- `packages/modules/providers/payment-stripe/src/services/` — gotowy, niepodłączony kod Stripe z wariantami PL/EU.
- `app/medusa-config.js` — jedyne miejsce jawnej konfiguracji modułów/pluginów w tym wdrożeniu.
