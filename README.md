# szopifaj

Backend commerce ekosystemu Sklepik. Kod źródłowy wywodzi się z [Medusa.js](https://github.com/medusajs/medusa) (MIT), skopiowany 2026-07-17 jako punkt startowy — nie fork, nie zależność npm śledząca upstream. Od tej chwili w pełni własny kod, własna dokumentacja, własny kierunek.

Zasady pracy, kontekst ekosystemu i protokół dokumentacji: [`CLAUDE.md`](CLAUDE.md).

Dokąd to zmierza: [`docs/plans/vision-2026.md`](docs/plans/vision-2026.md).

## Serwer deweloperski

Backend jest wdrażany na Oracle Cloud (Ampere A1, Frankfurt, host `krokodyl`).

- Adres: `141.253.103.172` (albo `141-253-103-172.nip.io` dla HTTPS)
- SSH user: `ubuntu`
- Klucz SSH: `Desktop/kakałowy sklepik/ssh-key-2026-07-08.key` (na maszynie lokalnej, nie w repo)
- Kod repo na serwerze: `~/szopifaj`
- Połączenie: `ssh -i "Desktop/kakałowy sklepik/ssh-key-2026-07-08.key" ubuntu@141.253.103.172`
- Build: `yarn build` (Turborepo, `~/szopifaj`) — cache w `node_modules/.cache/turbo`

### Stan wdrożenia (od 2026-07-17)

Backend faktycznie działa na serwerze, publicznie po HTTPS: **https://141-253-103-172.nip.io** (panel admina pod `/app`, API pod `/admin`, `/store`, `/auth`).

`packages/medusa` to sam framework, nie uruchamialny projekt — na serwerze istnieje osobny katalog `~/szopifaj/app` (poza workspace'ami yarn, nieskomitowany), zawierający `medusa-config.js`, `.env` z sekretami i zbudowany panel admina (`app/public/admin`, wygenerowany przez `medusa build`). Ten katalog trzeba odtworzyć ręcznie na każdym nowym serwerze — nie jest częścią repo.

Stack na serwerze:
- Postgres 16 + Redis 7 jako kontenery Docker (`szopifaj-postgres`, `szopifaj-redis`), związane wyłącznie z `127.0.0.1` — nie wystawione na zewnątrz.
- **Dwie role Postgresa (od 2026-07-18, pod Row-Level Security — patrz `docs/plans/multi-store-platform.md`):** `szopifaj` (superuser, tylko do migracji/DDL) i `szopifaj_app` (nieuprzywilejowana, używana przez działającą usługę — `DATABASE_URL` w `app/.env`). RLS jest całkowicie ignorowane dla superusera, więc usługa **musi** łączyć się jako `szopifaj_app`, inaczej cała warstwa RLS jest martwa bez błędu. Obie role i grant'y **nie są w git** (jak reszta `app/`) — do odtworzenia ręcznie na nowym serwerze, opis w `multi-store-platform.md`.
- Aplikacja (`medusa start`) jako usługa systemd `szopifaj.service` (`WorkingDirectory=~/szopifaj/app`), włączona na starcie systemu, restart automatyczny przy awarii. Logi: `~/szopifaj/app/server.log` (na serwerze), status: `sudo systemctl status szopifaj`.
- Nginx jako reverse proxy (`/etc/nginx/sites-available/szopifaj.conf`) terminujący TLS certyfikatem Let's Encrypt dla `141-253-103-172.nip.io` (ważny do 2026-10-07, auto-renewal przez istniejący `certbot` timer — nie zakładano nowego).
- Firewall (`iptables`) miał już otwarte porty 80/443 z poprzedniego (porzuconego) deploymentu Spree — nie wymagało zmian.

Utworzono jednego użytkownika-admina (`admin@szopifaj.pl`) — hasło wygenerowane losowo, nieprzechowywane w repo (patrz sesja, w której powstało, albo zresetuj przez panel).

Minimalne dane sklepu założone ręcznie przez Admin API: region "Polska" (kraj `pl`, waluta `pln`, ustawiony jako domyślny), domyślny sales channel i publishable API key powstały automatycznie przy pierwszej migracji.

### Storefront demonstracyjny (od 2026-07-17)

**https://store.141-253-103-172.nip.io** — standardowy [Medusa Next.js starter](https://github.com/medusajs/nextjs-starter-medusa) (MIT), sklonowany bez modyfikacji (poza middleware'em opisanym niżej), podłączony do backendu powyżej. **To nie jest kod ekosystemu Sklepik** — świadoma decyzja (patrz sesja 2026-07-17), żeby szybko zweryfikować że backend faktycznie obsługuje realny storefront. Docelowo do zastąpienia przez `sklepikFront` podłączony do tego backendu, albo do usunięcia, gdy `sklepikFront` przejmie tę rolę.

- Kod na serwerze: `~/szopifaj-storefront` (osobne repo, sklonowane bezpośrednio z GitHuba Medusy, nie jest częścią tego repo ani zapisane nigdzie w kontroli wersji tego ekosystemu)
- `.env.local` na serwerze: `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BASE_URL=https://store.141-253-103-172.nip.io`, `NEXT_PUBLIC_DEFAULT_REGION=pl`
- Usługa systemd: `szopifaj-storefront.service` (`next start -p 8000`), zależna od `szopifaj.service`
- Nginx + osobny certyfikat Let's Encrypt dla `store.141-253-103-172.nip.io` (wykorzystuje wildcard DNS `nip.io` — dowolna subdomena tej postaci rozwiązuje się na ten sam adres IP)
- **Od 2026-07-18: ten sam proces obsługuje też każdy sklepik pod `serowymichal.pl`** (patrz sekcja niżej) — middleware (`src/middleware.ts`) rozpoznaje sklepik po pierwszym segmencie hosta i dociąga właściwy publishable key przez `GET /store/sklepiki/resolve`, patrz `docs/plans/multi-store-platform.md`.

**Nie zrobione / do zrobienia:** katalog produktów pusty (0 produktów) na sklepikach demo/testowych — sklep renderuje się, ale nie ma czego kupić. Storefront nie jest podłączony do żadnej bramki płatności (potwierdzone też `docs/plans/module-audit-2026.md` — jedyny aktywny payment provider to no-op `system`, nikt nie może dziś realnie zapłacić). Docelowa integracja z `sklepikFront` i modułem fiskalnym — patrz [`docs/plans/vision-2026.md`](docs/plans/vision-2026.md).

### Domena `serowymichal.pl` (od 2026-07-18)

Publiczna domena (home.pl), rozdzielona nginx-em na trzy warstwy — szczegóły techniczne i historia decyzji w `docs/plans/multi-store-platform.md`, sekcja "Public self-signup":

- **`serowymichal.pl` / `www.serowymichal.pl`** — statyczna wizytówka (dziś: tytuł + adres firmy), katalog `~/serowymichal-www` na serwerze, bez backendu.
- **`sklepiki.serowymichal.pl`** — publiczny formularz zakładania sklepiku/logowania (statyczny HTML/CSS/JS, katalog `~/sklepiki`, woła bezpośrednio API backendu z przeglądarki). Zakładanie konta jest **otwarte publicznie**, bez zaproszenia (`POST /admin/sklepiki/self-signup`) — świadoma zmiana wcześniejszej decyzji "zamknięta/zaproszeniowa".
- **`nazwa-sklepiku.serowymichal.pl`** (dowolna inna subdomena) — proxy do storefrontu (port 8000, patrz wyżej), jeden wspólny proces obsługuje wszystkie sklepiki.
- DNS: rekordy A dla `@`, `www`, i wildcard `*` → `141.253.103.172`.
- SSL: certyfikat wildcard Let's Encrypt (`serowymichal-wildcard`, DNS-01) obejmujący `serowymichal.pl` + `*.serowymichal.pl`, ważny do 2026-10-16. **Odnawianie nie jest automatyczne** (wydany przez `certbot --manual`, wymaga ręcznego powtórzenia z nowym rekordem TXT).

Licencja: MIT (odziedziczona z Medusa.js, patrz [`LICENSE`](LICENSE)).
