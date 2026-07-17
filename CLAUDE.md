# szopifaj — platforma commerce: zasady dla agentów

## Kontekst projektu (przeczytaj najpierw)

To repozytorium jest **nowym, docelowym backendem** ekosystemu Sklepik — zastępuje fork Spree Commerce w repo `pawelekbyra/sklepik`. Kod źródłowy wywodzi się z Medusa.js (`packages/`, skopiowane 2026-07-17 z github.com/medusajs/medusa, licencja MIT — patrz `LICENSE`), ale **to nie jest fork i nie jest zależnością npm od `@medusajs/*`**. Historia gita zaczyna się od zera, dokumentacja Medusy jest w całości zastąpiona tą tutaj. Nie śledzimy release'ów upstreamu — świadoma decyzja, konsekwencje opisane w `pawelekbyra/sklepik/docs/plans/medusa-migration.md`.

Ekosystem: `pawelekbyra/sklepik` (stary backend Spree, żywa produkcja Kakałowego Sklepika do czasu cutover), `pawelekbyra/sklepikFront` (storefront Next.js), `pawelekbyra/edytor-sklepu` (silnik edytora wizualnego, pakiety `@pawelekbyra/*`), **`pawelekbyra/szopifaj` (to repo — nowy backend)**.

Obowiązkowa lektura przed pracą:

- `pawelekbyra/sklepik/docs/plans/medusa-migration.md` — kanon decyzji o migracji, uzasadnienie, plan.
- `pawelekbyra/sklepik/docs/plans/fiscal-compliance-poland.md` — moduł fiskalny (KSeF/VAT/kasa fiskalna), budowany od razu na tym repo, główna przewaga różnicująca projektu.
- [`docs/plans/vision-2026.md`](docs/plans/vision-2026.md) — azymut: dokąd zmierza ten produkt, nie tylko co robi dziś.

## Filozofia: nie fork, nie zależność — własność

Kod Medusy jest punktem startowym, nie ograniczeniem. Gdzie architektura/konwencje Medusy nie pasują do celu (zgodność fiskalna, jakość dla pracy agentów AI, głębia funkcjonalna), **przepisujemy, nie naginamy się do ich wzorców**. Priorytet: trzy moduły decydują o tym, czy ten produkt wygrywa — `tax` (silnik fiskalny), `rbac` (dostęp wielosklepowy/księgowa), `order`+workflow orchestration (widoczna, godna zaufania oś czasu zamówienia). Reszta pakietów (`cart`, `pricing`, `product`, `region`, `currency`...) zostaje bliska oryginałowi, dopóki nie ma konkretnego powodu, żeby to zmienić — nie przepisujemy wszystkiego naraz na zapas.

## Protokół dokumentacji (obowiązkowy, częściowo zautomatyzowany)

Dokumentacja ma **zawsze odzwierciedlać rzeczywisty stan projektu**. Mechanizm częściowo automatyczny (patrz `.github/workflows/docs-sync.yml`): przy PR-ach dotykających `packages/*/src/**` Claude analizuje diff i proponuje aktualizacje dokumentacji jako część tego samego PR-a — **zawsze wymaga review człowieka przed merge, nigdy auto-commit na `main`**. To pomaga, nie zwalnia z odpowiedzialności:

1. Po każdym zakończonym zadaniu zweryfikuj, czy proponowane przez automatyzację zmiany dokumentacji są trafne — nie akceptuj ślepo.
2. Jeśli zadanie było z roadmapy (`medusa-migration.md`/`fiscal-compliance-poland.md`) — zmień jego status tam.
3. Większe decyzje architektoniczne: nowy plik w `docs/plans/` wg wzorca już ustalonego w `sklepik/docs/plans/_template.md`.
4. Nie twórz nowych plików-notatek poza tym wzorcem. Aktualizuj istniejące dokumenty.
5. **Sprawdzaj kod zamiast ufać opisom** — w tej sesji już kilka razy dokumentacja rozjechała się z kodem w innych repo tego ekosystemu; ten mechanizm ma to ograniczyć, nie wyeliminować potrzebę weryfikacji.

## Struktura (dziedziczona z Medusy, patrz `package.json` workspaces)

`packages/core/*` — silnik (orchestration/workflow engine, framework, types, utils). `packages/modules/*` — 35 modułów domenowych (cart, order, tax, payment, rbac, itd. — każdy z własnym `providers/` jako punkt rozszerzeń). `packages/medusa` — główny pakiet spinający moduły w aplikację. `packages/admin` — panel administracyjny. `packages/cli` — narzędzia deweloperskie.

## Testowanie i budowanie

Odziedziczone z Medusy — `yarn test`, `yarn build` (Turborepo). Do zweryfikowania w kolejnej sesji: czy `yarn install` w ogóle przechodzi czysto na tym wycinku (bez `www/`, `integration-tests/`), zanim cokolwiek się zacznie zmieniać. Nie zakładaj, że działa — sprawdź.

## Zasady twarde

- Nie commituj sekretów.
- Commity małe i logiczne, po polsku lub angielsku, bez detali implementacyjnych w treści — uzasadnienie "dlaczego", nie "jak".
- Zachowaj notę copyright MIT w `LICENSE` (wymóg licencji źródła) — nie usuwaj.
- Nazwa "Medusa"/ich logo nie może być używana jako nasza marka (kwestia znaku towarowego) — w kodzie/identyfikatorach to nieistotne, w publicznej twarzy produktu ważne.
