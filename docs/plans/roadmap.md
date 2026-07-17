# Roadmap: od pustej instalacji Medusy do realnego sklepu

**Status:** In Progress.
**Target:** całe repo `szopifaj` + serwer produkcyjny.
**Depends on:** [`fiscal-compliance-poland.md`](fiscal-compliance-poland.md) (krok 3 poniżej).
**Author:** właściciel + agent.
**Last updated:** 2026-07-17.

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
3. 🟢 **AKTYWNY PRIORYTET (2026-07-17, potwierdzone dwukrotnie tego samego dnia — patrz Key Decision 4):** model wielosklepowy — jeden admin, wiele sklepików, właściciel jako super-admin z pełnym wglądem. Plan zaprojektowany i zatwierdzony: [`multi-store-platform.md`](multi-store-platform.md). Implementacja jeszcze nierozpoczęta — następny konkretny krok pracy.
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
