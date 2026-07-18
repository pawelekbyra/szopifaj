# Audyt: pojedynczy sklepik 10/10 na miarę 2026 roku

**Status:** Draft — audyt i priorytetyzacja gotowe, implementacja nierozpoczęta.
**Target:** cała platforma commerce (backend `szopifaj`, storefront, edytor personalizacji).
**Depends on:** [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md) (moduł fiskalny — część tej całości, nie osobny tor).
**Author:** właściciel + agent (sesja 2026-07-17, audyt kodu + research zewnętrzny).
**Last updated:** 2026-07-17.

## Summary

**🔄 Zmienione 2026-07-17 (ten sam dzień co powstanie tego dokumentu):** pierwotnie ten plan miał być priorytetem *zamiast* multi-sklepowości (którą właściciel na chwilę odłożył jako TODO). Właściciel **cofnął tę decyzję tego samego dnia** — multi-sklepowość ([`multi-store-platform.md`](multi-store-platform.md)) jest aktywnym priorytetem, konkretny cel: dać koledze dostęp do jego własnego sklepiku i pokazać, że działa. **Ten dokument nie jest już blokującym punktem wejścia** — jest ważnym, równoległym torem pracy: **pojedynczy sklepik ma być kompletny i "zajebisty" na miarę 2026 roku**, wszystkie funkcje poważnej platformy e-commerce, najlepsze praktyki techniczne — ale nie warunkuje startu prac nad multi-sklepowością.

Ten dokument łączy: (a) audyt modułów Medusy już w repo (co jest gotowe, co atrapą, czego brak — patrz sesja 2026-07-17), (b) audyt `edytor-sklepu` (osobne repo w ekosystemie, silnik personalizacji), (c) research zewnętrzny o stanie sztuki e-commerce 2026.

## Key Decisions (do not deviate without discussion)

1. **Kompletność funkcjonalna przed wyglądem.** Nie polerować frontendu kosztem brakujących modułów backendu (płatności PL, kurier, gift cards).
2. **Nie budować pełnej architektury MACH/mikroserwisowej.** Research 2026 wprost: "headless is a capability, not a default" — dla sklepów poniżej ~10 mln USD GMV monolityczny/lekko-headless stack (dokładnie to, co mamy: Medusa + Next.js) sprzedaje więcej na dolara wydany niż pełna kompozycja mikroserwisów. Nie przepisywać tego, co działa, w mikroserwisy na zapas.
3. **🔄 Zmienione 2026-07-17: `edytor-sklepu` wycofany z ekosystemu, wygląd piszemy bezpośrednio w kodzie.** Generyczny wizualny page builder (drag&drop dla nietechnicznych właścicieli sklepów) rozwiązywał problem self-serve personalizacji dla wielu nietechnicznych użytkowników — to nie jest nasz model nawet przy aktywnej multi-sklepowości ([`multi-store-platform.md`](multi-store-platform.md)): admini są zaufani, nie anonimowi. My umiemy kodować i kontrolujemy repo storefrontu — piszemy wygląd wprost, jako docelowe rozwiązanie, nie tymczasowe obejście. Lokalny klon usunięty; repo zostaje na GitHubie, poza aktywnym ekosystemem.
4. **AI-personalizacja (rekomendacje, inteligentne wyszukiwanie) to dziś oczekiwanie bazowe klientów (56% oczekuje personalizacji), nie funkcja premium** — ale nie budujemy własnego "AI checkout agenta" (rynek to już odrzucił, patrz `fiscal-compliance-poland.md` — ChatGPT Instant Checkout wycofany). Zamiast tego: dobre rekomendacje/wyszukiwanie + czyste product feedy pod przyszłe agentic-commerce (ChatGPT/Perplexity Shopping), tanie, nie spekulacyjne.

## Design Details — inwentarz: co mamy, co atrapa, czego brak

### ✅ Gotowe, solidne (z audytu modułów, sesja 2026-07-17)
- `promotion` — kody rabatowe, promocje automatyczne, kampanie z budżetami, reguły targetowania. Kompletne.
- `inventory`/`stock-location` — multi-magazyn, automatyczna rezerwacja. Kompletne.
- **`@medusajs/loyalty-plugin`** (`packages/plugins/loyalty`) — **poprawka do wcześniejszego audytu**: program lojalnościowy + **karty podarunkowe** (`workflows/gift-cards`) + store credit, pełny kod (admin UI, API store+admin, joby, subskrybery). Zbudowany, ale **nieaktywny** — nie jest wpisany do `plugins[]` w `medusa-config.js`. To jest "włącz, nie buduj od zera".
- `@medusajs/draft-order` (`packages/plugins/draft-order`) — tworzenie zamówień przez admina w imieniu klienta (przydatne dla obsługi telefonicznej/B2B). Zbudowany, nieaktywny.
- Auth: email/hasło, Google, GitHub — prod-ready.
- Pliki: integracja S3 (działa z R2/MinIO) — prod-ready.

### 🟡 Prod-ready, ale wąskie — trzeba rozszerzyć
- **Płatności: tylko Stripe — ale koryguje to research 2026-07-17: kod już ma warianty `stripe-przelewy24.ts`/`stripe-blik.ts`** (`packages/modules/providers/payment-stripe/src/services/`) — to nie osobne bramki, tylko Stripe'owe `payment_method_types: ["p24"]`/`["blik"]` na tym samym providerze. Do sprawdzenia w Stripe Dashboard, czy te metody są aktywowane, zanim inwestujemy w osobną integrację. Jeśli nie wystarczy: Przelewy24, patrz [`Migration Path`](#migration-path--priorytetyzacja).
- **Powiadomienia: tylko e-mail (Sendgrid).** Brak SMS.

### ❌ Atrapa / brak — realna praca
- **Fulfillment: tylko ręczne.** Zero integracji z kurierem. InPost potwierdzony researchem jako pierwszy kandydat — community plugin istnieje jako punkt startowy (`medusa-inpost-fulfillment`), patrz Migration Path.
- **Tax: prosty kalkulator systemowy.** Właściwy zakres pracy opisany w [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md), nie duplikować tu.
- **Wyszukiwanie i rekomendacje AI: nie istnieje.** Rozstrzygnięte researchem 2026-07-17: Meilisearch + oficjalny plugin Medusa v2, patrz Migration Path Etap 3. Rekomendacje na start: reguły na kategoriach/tagach, nie ML.
- **Porzucone koszyki (abandoned cart recovery)** — brak automatyzacji przypominania o niedokończonym zamówieniu. Częściowo możliwe do zbudowania na już istniejącym `event-bus`+`notification`.
- **Redis niewykorzystany w pełni** — serwer ma Redis, ale `event-bus`/`cache`/`workflow-engine` chodzą na wariantach in-memory. Tania, szybka poprawka (pół godziny, zero decyzji biznesowych) — podnosi niezawodność (przeżywa restart) i gotowość pod skalowanie.

### 🎨 Personalizacja — `edytor-sklepu` WYCOFANY z ekosystemu (decyzja 2026-07-17)
`edytor-sklepu` (osobne repo, wizualny edytor stron/motywów, 8/12 etapów gotowych) był zaprojektowany pod stary `sklepik`/Spree, pod scenariusz "wielu anonimowych, nietechnicznych właścicieli sklepów samodzielnie edytuje swój wygląd". Nasz model multi-sklepowości ([`multi-store-platform.md`](multi-store-platform.md), dziś aktywny priorytet) zakłada zaufanych adminów, nie anonimowych nietechnicznych użytkowników — więc ten scenariusz nas nie dotyczy niezależnie od statusu multi-sklepowości.

**Decyzja właściciela:** generyczny page builder to rozwiązywanie problemu, którego jeszcze nie mamy — budowanie na zapas, i źródło konfuzji przy pracy nad projektem. Lokalny klon usunięty z maszyny deweloperskiej (2026-07-17) — repo bezpiecznie na GitHubie (`github.com/pawelekbyra/edytor-sklepu`, czyste, wypchnięte), więc nic nie zginęło, ale **przestaje być częścią aktywnego ekosystemu**. Zamiast tego: **każdy sklepik dostaje wygląd pisany bezpośrednio w kodzie** (pełna kontrola nad Next.js storefrontem, docelowe rozwiązanie, nie tymczasowe obejście) — patrz [`CLAUDE.md`](../../CLAUDE.md).

### 📈 Best practices 2026 — z researchu zewnętrznego
- **Core Web Vitals / INP** (nie FID — zmiana od 2023) — LCP/CLS/INP jako twardy wymóg, nie "nice to have". Amazon: 100ms opóźnienia = -1% sprzedaży. Rakuten: +33% konwersji po optymalizacji CWV.
- **PWA "static-first"** — szkielet strony przez SSG/SSR natychmiast, personalizacja doklejana JS-em po pierwszym renderze. Standardowy starter Next.js Medusy (już wdrożony jako demo) częściowo to daje z pudełka — wymaga audytu/dostrojenia, nie budowy od zera.
- **SEO** — starter ma już `next-sitemap.js`, trzeba skonfigurować i zweryfikować metadane/strukturalne dane produktowe.
- **Agentic-commerce readiness** (2026, nowy trend) — czyste, ustrukturyzowane product feedy i API pod boty zakupowe (ChatGPT/Perplexity Shopping). Tanie do zrobienia (dobry schema.org/JSON-LD na stronach produktowych, porządne Store API), nie wymaga budowy własnego agenta AI.
- **Social commerce (TikTok Shop, Instagram Checkout)** — realny kanał przychodu wg researchu, ale **nie blokujące** dla MVP przy naszej skali — nice-to-have, later.

## Migration Path — priorytetyzacja

**Etap 1 (tanie, wysoka wartość, brak zależności biznesowych):**
1. Włączyć `@medusajs/loyalty-plugin` (gift cards + loyalty + store credit) w `medusa-config.js` — kod już istnieje.
2. Dopiąć Redis do `event-bus`/`cache`/`workflow-engine` zamiast in-memory.
3. Skonfigurować SEO (`next-sitemap.js`, metadane, JSON-LD produktowe) na storefroncie.
4. Audyt Core Web Vitals na już wdrożonym storefroncie demo, poprawki.

**Etap 2 (doprecyzowane researchem 2026-07-17 — patrz Open Questions po szczegóły):**
5. **Płatności PL** — najpierw sprawdzić w Stripe Dashboard, czy P24/BLIK są już aktywowane na koncie (kod już ma warianty `stripe-przelewy24.ts`/`stripe-blik.ts` — może zamknąć część luki bez nowego providera). Jeśli nie: **Przelewy24**, z audytem/przepisaniem istniejącego community pluginu (`@gmisoftware/przelewy24-payments-medusa`) jako punktu startowego, nie wdrożeniem 1:1.
6. **Kurier: InPost.** Community plugin (`medusa-inpost-fulfillment`) jako szkielet/referencja do audytu, nie gotowa zależność. Szacunek: 1,5-2,5 tyg. na podstawowy flow (paczkomat+kurier, geowidget w checkoucie), 4-6 tyg. z pełnym zakresem (zwroty, webhooki).

**Etap 3 (doprecyzowane researchem 2026-07-17):**
7. **Wyszukiwanie: Meilisearch** (nie Typesense/Algolia) — self-hosted za darmo na już posiadanym serwerze, oficjalny i aktywnie utrzymywany plugin Medusa v2 (`@rokmohar/medusa-plugin-meilisearch`), synchronizacja katalogu event-driven. Rekomendacje produktowe na start: proste reguły po kategoriach/tagach, nie ML/embeddingi.
8. Abandoned cart recovery na `event-bus`+`notification`.

**Etap 4 (personalizacja, wygląd — na końcu, zgodnie z `roadmap.md`):**
9. Wygląd storefrontu pisany bezpośrednio w kodzie (Next.js) — **nie przez `edytor-sklepu`**, patrz sekcja "Personalizacja" wyżej. Kierunek/branding do ustalenia z właścicielem przed startem tej pracy.

## Constraints on Current Work

- **Nie klonować ani nie podłączać `edytor-sklepu`** — świadomie wycofany z ekosystemu (patrz sekcja "Personalizacja" wyżej i `CLAUDE.md`), nie przywracać bez nowej decyzji.
- Nie budować nowego generycznego page buildera — wygląd każdego sklepiku piszemy bezpośrednio w kodzie storefrontu, to jest docelowe podejście, nie tymczasowe.
- Nie projektować pod pełną architekturę mikroserwisową/MACH — nieadekwatne do skali.
- Moduł fiskalny (`tax`) rozwijać wyłącznie wg [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md), nie tutaj.

## Open Questions

- ✅ **Rozstrzygnięte researchem 2026-07-17 — płatności PL:** sprawdzić najpierw Stripe Dashboard (P24/BLIK mogą już działać przez istniejący provider); jeśli nie, Przelewy24 jako pierwszy wybór (patrz Migration Path Etap 2). Nadal otwarte: czy właściciel ma już konto u któregokolwiek dostawcy.
- ✅ **Rozstrzygnięte researchem 2026-07-17 — kurier:** InPost (patrz Migration Path Etap 2). Nadal otwarte: czy jest już umowa z innym przewoźnikiem, co by to zmieniło.
- ✅ **Rozstrzygnięte researchem 2026-07-17 — wyszukiwanie:** Meilisearch, nie Algolia/Typesense (patrz Migration Path Etap 3).
- Kierunek/branding wyglądu storefrontu (Etap 4) — do ustalenia z właścicielem przed startem tej pracy, nie rozstrzygnięte tutaj.
- **Do zbadania przy pracy nad `fiscal-compliance-poland.md` (zanotowane 2026-07-18, jeszcze nierozstrzygnięte):** integracja z **Odoo (ERP)** — oficjalna wtyczka Medusy synchronizuje produkty/zamówienia/magazyn. Ciekawe konkretnie dlatego, że styka się z głównym wyróżnikiem projektu (fiskalność/księgowość) — może zamknąć część zakresu `fiscal-compliance-poland.md` gotową integracją zamiast budowania własnego raportowania księgowego od zera. Nieprzebadane głębiej — sprawdzić przy starcie prac nad modułem fiskalnym, nie teraz.

## References

- [`multi-store-platform.md`](multi-store-platform.md) — aktywny priorytet (patrz Summary wyżej); ten dokument to równoległy, niebolokujący tor pracy.
- [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md) — moduł fiskalny jako część tej całości.
- [`roadmap.md`](roadmap.md) — status ogólny.
- Audyt modułów Medusy, sesja 2026-07-17 (payment/fulfillment/notification/tax/rbac — w tej sesji, nie osobny plik).
- `github.com/pawelekbyra/edytor-sklepu` — silnik personalizacji, wycofany z ekosystemu 2026-07-17 (lokalny klon usunięty), zapis historyczny tylko na GitHubie.
- Research 2026-07-17: [Shopify — 11 Best Ecommerce Platforms 2026](https://www.shopify.com/blog/best-ecommerce-platforms), [Algolia — Monolithic vs headless vs composable 2026](https://www.algolia.com/blog/ecommerce/monolithic-headless-composable), [Shopify — AI Recommendation Systems Guide 2026](https://www.shopify.com/blog/ai-recommendation-system), [Core Web Vitals 2026 guide](https://skyseodigital.com/core-web-vitals-optimization-complete-guide-for-2026/), [Shopify Enterprise — Ecommerce Platform Comparison 2026](https://www.shopify.com/enterprise/blog/ecommerce-platform-comparison).
- Research 2026-07-17 (drugi audyt tego samego dnia — płatności/kurier/wyszukiwanie): [Przelewy24 developers](https://developers.przelewy24.pl/extended/index.php?en=), [@ingameltd/node-przelewy24](https://www.npmjs.com/package/@ingameltd/node-przelewy24), [InPost ShipX API](https://dokumentacja-inpost.atlassian.net/wiki/spaces/PL/pages/622754/API+ShipX), [medusa-inpost-fulfillment](https://github.com/Bystrol/medusa-inpost-fulfillment), [Integrate Meilisearch with Medusa](https://docs.medusajs.com/resources/integrations/guides/meilisearch), [Meilisearch vs Typesense](https://www.meilisearch.com/docs/resources/comparisons/typesense).
