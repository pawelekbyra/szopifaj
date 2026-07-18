import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * PostgreSQL Row-Level Security (RLS) jako warstwa obrony w głębi dla
 * scopingu multi-store — patrz docs/plans/multi-store-platform.md, sekcja
 * "Row-Level Security". Cel: nawet gdy w kodzie aplikacji (RBAC, middleware)
 * jest błąd — a trzy takie błędy znaleziono i naprawiono 2026-07-18 — baza
 * danych fizycznie odmawia zwrócenia wiersza spoza dozwolonego zakresu.
 *
 * Umyślnie w module rbac (nie product/sales-channel), mimo że dotyka tabel
 * należących do innych modułów — RLS jest częścią funkcji multi-store
 * zbudowanej w tym module, analogicznie do wcześniejszej migracji
 * resource_id (Migration20260718073940.ts).
 *
 * Model kontekstu: sesyjna zmienna Postgresa `app.current_sales_channels`
 * (lista id oddzielona przecinkami, albo "*"/puste = brak ograniczenia).
 * Brak ustawionej wartości = tryb systemowy (migracje, joby w tle,
 * super-admin) — pełny dostęp, RLS nic nie filtruje. Wartość ustawiona
 * przez middleware aplikacji tylko dla żądań zidentyfikowanych jako
 * zawężony (nie super-admin) admin — patrz warstwa aplikacji, osobny
 * commit/PR.
 *
 * Wymóg krytyczny: RLS jest całkowicie ignorowane dla superusera Postgresa.
 * Rola `szopifaj_app` (nieuprzywilejowana, utworzona ręcznie 2026-07-18,
 * NIE przez tę migrację — zarządzanie rolami wykracza poza zakres migracji
 * Medusy) musi być rolą, jaką łączy się uruchomiona aplikacja. Migracje
 * nadal wymagają uprzywilejowanej roli (MIGRATION_DATABASE_URL w app/.env).
 *
 * product: brak bezpośredniej kolumny sales_channel_id — powiązanie przez
 * product_sales_channel (many-to-many), stąd EXISTS zamiast prostego
 * porównania kolumny.
 */
export class Migration20260718092554 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "product" enable row level security;`);
    this.addSql(`drop policy if exists "product_tenant_isolation" on "product";`);
    this.addSql(`
      create policy "product_tenant_isolation" on "product"
      using (
        current_setting('app.current_sales_channels', true) is null
        or current_setting('app.current_sales_channels', true) = ''
        or current_setting('app.current_sales_channels', true) = '*'
        or exists (
          select 1 from "product_sales_channel" psc
          where psc.product_id = "product".id
          and psc.deleted_at is null
          and psc.sales_channel_id = any(string_to_array(current_setting('app.current_sales_channels', true), ','))
        )
      );
    `);

    this.addSql(`alter table if exists "sales_channel" enable row level security;`);
    this.addSql(`drop policy if exists "sales_channel_tenant_isolation" on "sales_channel";`);
    this.addSql(`
      create policy "sales_channel_tenant_isolation" on "sales_channel"
      using (
        current_setting('app.current_sales_channels', true) is null
        or current_setting('app.current_sales_channels', true) = ''
        or current_setting('app.current_sales_channels', true) = '*'
        or id = any(string_to_array(current_setting('app.current_sales_channels', true), ','))
      );
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop policy if exists "sales_channel_tenant_isolation" on "sales_channel";`);
    this.addSql(`alter table if exists "sales_channel" disable row level security;`);
    this.addSql(`drop policy if exists "product_tenant_isolation" on "product";`);
    this.addSql(`alter table if exists "product" disable row level security;`);
  }

}
