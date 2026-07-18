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

**https://store.141-253-103-172.nip.io** — standardowy [Medusa Next.js starter](https://github.com/medusajs/nextjs-starter-medusa) (MIT), sklonowany bez modyfikacji, podłączony do backendu powyżej przez publishable API key. **To nie jest kod ekosystemu Sklepik** — świadoma decyzja (patrz sesja 2026-07-17), żeby szybko zweryfikować że backend faktycznie obsługuje realny storefront. Docelowo do zastąpienia przez `sklepikFront` podłączony do tego backendu, albo do usunięcia, gdy `sklepikFront` przejmie tę rolę.

- Kod na serwerze: `~/szopifaj-storefront` (osobne repo, sklonowane bezpośrednio z GitHuba Medusy, nie jest częścią tego repo ani zapisane nigdzie w kontroli wersji tego ekosystemu)
- `.env.local` na serwerze: `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BASE_URL=https://store.141-253-103-172.nip.io`, `NEXT_PUBLIC_DEFAULT_REGION=pl`
- Usługa systemd: `szopifaj-storefront.service` (`next start -p 8000`), zależna od `szopifaj.service`
- Nginx + osobny certyfikat Let's Encrypt dla `store.141-253-103-172.nip.io` (wykorzystuje wildcard DNS `nip.io` — dowolna subdomena tej postaci rozwiązuje się na ten sam adres IP)

**Nie zrobione / do zrobienia:** katalog produktów pusty (0 produktów) — sklep renderuje się, ale nie ma czego kupić. Storefront demo nie jest podłączony do żadnej bramki płatności. Docelowa integracja z `sklepikFront` i modułem fiskalnym — patrz [`docs/plans/vision-2026.md`](docs/plans/vision-2026.md).

Licencja: MIT (odziedziczona z Medusa.js, patrz [`LICENSE`](LICENSE)).
