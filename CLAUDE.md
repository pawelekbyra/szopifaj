# szopifaj — platforma commerce: zasady dla agentów

## Kontekst projektu (przeczytaj najpierw)

To repozytorium jest **jedynym aktywnym backendem** ekosystemu Sklepik. Kod źródłowy wywodzi się z Medusa.js (`packages/`, skopiowane 2026-07-17 z github.com/medusajs/medusa, licencja MIT — patrz `LICENSE`), ale **to nie jest fork i nie jest zależnością npm od `@medusajs/*`**. Historia gita zaczyna się od zera, dokumentacja Medusy jest w całości zastąpiona tą tutaj. Nie śledzimy release'ów upstreamu.

`pawelekbyra/sklepik` (stary backend Spree) to **porzucony eksperyment, nie żywa produkcja i nie zależność** — świadoma decyzja właściciela, nie tymczasowy stan do ochrony. Nie czytać go, nie pracować nad nim, nie traktować jako źródła prawdy o czymkolwiek bieżącym. Reszta ekosystemu: `pawelekbyra/sklepikFront` (storefront Next.js, dziś zbudowany pod API Spree — status podłączenia do tego backendu: patrz `docs/plans/roadmap.md`).

**`pawelekbyra/edytor-sklepu` (silnik edytora wizualnego) jest wycofany z ekosystemu (2026-07-17).** Rozwiązywał problem self-serve personalizacji dla wielu nietechnicznych właścicieli sklepów. Decyzja o wycofaniu stoi niezależnie od statusu multi-sklepowości (patrz `docs/plans/multi-store-platform.md` — dziś aktywny priorytet): admini w naszym modelu to zaufane osoby, nie anonimowi nietechniczni użytkownicy, więc generyczny page builder nadal nie jest potrzebny — wygląd sklepu piszemy bezpośrednio w kodzie storefrontu. Repo istnieje nadal na GitHubie, ale nie jest częścią aktywnej pracy — nie klonować, nie podłączać, nie traktować jako zależności.

Obowiązkowa lektura przed pracą — wszystko w tym repo, nic zewnętrznego:

- [`docs/plans/roadmap.md`](docs/plans/roadmap.md) — aktywny status: co zrobione, co dalej, otwarte decyzje.
- [`docs/plans/fiscal-compliance-poland.md`](docs/plans/fiscal-compliance-poland.md) — moduł fiskalny (KSeF/VAT/kasa fiskalna), główna przewaga różnicująca projektu.
- [`docs/plans/vision-2026.md`](docs/plans/vision-2026.md) — azymut: dokąd zmierza ten produkt, nie tylko co robi dziś.
- [`README.md`](README.md) — stan wdrożenia serwera, na bieżąco.

## Filozofia: nie fork, nie zależność — własność

**🔄 Zmienione 2026-07-17 (odwraca wcześniejsze podejście "reszta zostaje bliska oryginałowi"):** cel to **kompletna, nowoczesna platforma commerce** — wszystkie moduły, jakich potrzebuje poważny sklep internetowy (płatności, promocje, inventory, fulfillment, gift cards, itd.) realnie podłączone i działające — plus **multi-sklepowość**. Moduł fiskalny (`tax`, patrz [`docs/plans/fiscal-compliance-poland.md`](docs/plans/fiscal-compliance-poland.md)) jest jedną z ważnych części tej całości, **nie jest jedynym celem ani punktem wyjścia priorytetów** — nie traktować go jako "sedna" kosztem reszty funkcjonalności.

**Aktywny priorytet (potwierdzone 2026-07-17, po chwilowym odłożeniu i cofnięciu tej decyzji tego samego dnia): multi-sklepowość.** Konkretny, namacalny cel właściciela: móc dać koledze dostęp do jego własnego sklepiku i pokazać, że to realnie działa. Plan: [`docs/plans/multi-store-platform.md`](docs/plans/multi-store-platform.md). Kompletność funkcjonalna pojedynczego sklepu ([`docs/plans/product-2026-audit.md`](docs/plans/product-2026-audit.md)) to ważny, równoległy tor pracy — nie blokuje startu prac nad multi-sklepowością.

Kod Medusy jest punktem startowym, nie ograniczeniem, i **nie jest traktowany jako gotowy, zaufany fundament tylko dlatego, że istnieje.** Audytujemy każdy moduł, który dotykamy — jeśli implementacja jest słaba, prowizoryczna albo da się zrobić lepiej, **przepisujemy, nie kopiujemy bezmyślnie**. To nie jest fork trzymany blisko oryginału z automatu; to nasz kod, za który bierzemy pełną odpowiedzialność jakościową, niezależnie od tego, czy dany fragment akurat wymaga zmiany czy nie.

**Doprecyzowane 2026-07-17: to nie jest wyłącznie reaktywny audyt "sprawdź, gdy akurat dotykasz".** Przy każdym istotnym mechanizmie (nie tylko tam, gdzie już wiemy, że coś jest słabe) aktywnie sprawdzamy, czy podejście Medusy jest najlepszym dostępnym rozwiązaniem dla naszego konkretnego modelu danych/problemu, czy jest coś, co realnie lepiej/szybciej/solidniej rozwiązuje ten sam problem — i wtedy to wdrażamy, niezależnie od tego, czy pasuje do wzorca Medusy. **Nie trzymamy się Medusy w każdym kroku z automatu** — to punkt wyjścia do audytu, nie domyślna odpowiedź.

Kolejność pracy: **najpierw kompletność funkcjonalna** (wszystkie moduły realnie działające + multi-tenant), **wygląd/UI na końcu**. Nie polerować frontendu/storefrontu kosztem brakujących modułów backendu.

## Protokół dokumentacji (obowiązkowy, częściowo zautomatyzowany)

Dokumentacja ma **zawsze odzwierciedlać rzeczywisty stan projektu**. Mechanizm częściowo automatyczny (patrz `.github/workflows/docs-sync.yml`): przy PR-ach dotykających `packages/*/src/**` Claude analizuje diff i proponuje aktualizacje dokumentacji jako część tego samego PR-a — **zawsze wymaga review człowieka przed merge, nigdy auto-commit na `main`**. To pomaga, nie zwalnia z odpowiedzialności:

1. Po każdym zakończonym zadaniu zweryfikuj, czy proponowane przez automatyzację zmiany dokumentacji są trafne — nie akceptuj ślepo.
2. Jeśli zadanie było z roadmapy (`docs/plans/roadmap.md`/`docs/plans/fiscal-compliance-poland.md`) — zmień jego status tam.
3. Większe decyzje architektoniczne: nowy plik w `docs/plans/` wg wzorca już ustalonego w [`docs/plans/_template.md`](docs/plans/_template.md).
4. Nie twórz nowych plików-notatek poza tym wzorcem. Aktualizuj istniejące dokumenty.
5. **Sprawdzaj kod zamiast ufać opisom** — w tej sesji już kilka razy dokumentacja rozjechała się z kodem w innych repo tego ekosystemu; ten mechanizm ma to ograniczyć, nie wyeliminować potrzebę weryfikacji.

## Struktura (dziedziczona z Medusy, patrz `package.json` workspaces)

`packages/core/*` — silnik (orchestration/workflow engine, framework, types, utils). `packages/modules/*` — 35 modułów domenowych (cart, order, tax, payment, rbac, itd. — każdy z własnym `providers/` jako punkt rozszerzeń). `packages/medusa` — główny pakiet spinający moduły w aplikację. `packages/admin` — panel administracyjny. `packages/cli` — narzędzia deweloperskie.

## Testowanie i budowanie

Odziedziczone z Medusy — `yarn test`, `yarn build` (Turborepo). Do zweryfikowania w kolejnej sesji: czy `yarn install` w ogóle przechodzi czysto na tym wycinku (bez `www/`, `integration-tests/`), zanim cokolwiek się zacznie zmieniać. Nie zakładaj, że działa — sprawdź.

## Autonomia operacyjna (potwierdzone przez właściciela, 2026-07-18)

**Projekt jest w całości w budowie — zero prawdziwych klientów, zero ruchu produkcyjnego, który mógłby ucierpieć.** To tylko kod i infrastruktura testowa. Konsekwencja: agent (interaktywny i zaplanowany/cron) **nie musi pytać właściciela przed operacyjnie ryzykownymi, ale odwracalnymi działaniami** na serwerze `krokodyl` — restart usługi (`systemctl restart szopifaj`/`szopifaj-storefront`), zmiana roli/uprawnień bazy danych, migracje, przełączanie connection stringów, tymczasowa niedostępność serwisu w trakcie deployu. Żadne z tych działań nic nie niszczy — nie ma danych klientów ani ciągłości biznesowej do ochrony.

**Co dalej wymaga jednak wyraźnej zgody, nawet przy tym założeniu:**
- `git push` (i tak niemożliwe bez danych logowania na serwerze, ale gdyby się pojawiły — nadal pytać).
- Operacje `git` mogące zgubić pracę bez kopii zapasowej (`git reset --hard`, `git clean`, nadpisanie niezacommitowanych zmian) — nie dlatego że są ryzykowne dla klientów, tylko dlatego że mogą zgubić pracę właściciela/agenta.
- Nieodwracalne usunięcie danych z bazy (`DROP TABLE`, hard delete zamiast soft-delete) — nie ze względu na klientów, tylko bo to niepotrzebnie nieostrożne, gdy soft-delete/backup są tańsze.
- Cokolwiek dotyczące pieniędzy/płatności prawdziwych (nie ma ich dziś, ale gdyby się pojawiły).

## Zasady twarde

- Nie commituj sekretów.
- Commity małe i logiczne, po polsku lub angielsku, bez detali implementacyjnych w treści — uzasadnienie "dlaczego", nie "jak".
- Zachowaj notę copyright MIT w `LICENSE` (wymóg licencji źródła) — nie usuwaj.
- Nazwa "Medusa"/ich logo nie może być używana jako nasza marka (kwestia znaku towarowego) — w kodzie/identyfikatorach to nieistotne, w publicznej twarzy produktu ważne.
