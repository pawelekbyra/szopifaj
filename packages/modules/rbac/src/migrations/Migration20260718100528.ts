import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Koryguje polityki RLS z Migration20260718092554.ts — te oryginalne
 * (bez klauzuli FOR) domyślnie objęły też INSERT/UPDATE/DELETE tym samym
 * warunkiem co SELECT, co blokowało tworzenie produktu: w momencie
 * wstawiania wiersza `product` link `product_sales_channel` jeszcze nie
 * istnieje w tej samej transakcji, więc EXISTS w polityce nic nie
 * znajdował i Postgres odrzucał zapis nawet dla prawowitego właściciela.
 * Znalezione i naprawione **przed** podpięciem warstwy aplikacji (dzięki
 * czemu żaden prawdziwy request nigdy tego nie oberwał) — testowane
 * surowym SQL: INSERT+link w transakcji z ustawionym kontekstem przechodzi,
 * SELECT z innego kontekstu nadal poprawnie zwraca 0 wierszy.
 *
 * Ważna semantyka Postgresa, łatwa do przeoczenia: samo dodanie
 * `FOR SELECT` NIE oznacza "reszta komend bez ograniczeń" — gdy RLS jest
 * włączone i dla danej komendy nie ma ŻADNEJ pasującej polityki, domyślne
 * zachowanie to ODMOWA, nie przepuszczenie. Stąd jawne polityki
 * "passthrough" dla INSERT/UPDATE/DELETE (WITH CHECK true) — pisanie
 * pozostaje w całości pod kontrolą RBAC w kodzie aplikacji (już
 * przetestowane wcześniej tego dnia), RLS jest tu tylko dodatkową warstwą
 * dla ODCZYTU.
 */
export class Migration20260718100528 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`drop policy if exists "product_tenant_isolation" on "product";`);
    this.addSql(`
      create policy "product_tenant_isolation" on "product"
      for select
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
    this.addSql(`drop policy if exists "product_write_passthrough" on "product";`);
    this.addSql(`create policy "product_write_passthrough" on "product" for insert with check (true);`);
    this.addSql(`drop policy if exists "product_update_passthrough" on "product";`);
    this.addSql(`create policy "product_update_passthrough" on "product" for update using (true) with check (true);`);
    this.addSql(`drop policy if exists "product_delete_passthrough" on "product";`);
    this.addSql(`create policy "product_delete_passthrough" on "product" for delete using (true);`);

    this.addSql(`drop policy if exists "sales_channel_tenant_isolation" on "sales_channel";`);
    this.addSql(`
      create policy "sales_channel_tenant_isolation" on "sales_channel"
      for select
      using (
        current_setting('app.current_sales_channels', true) is null
        or current_setting('app.current_sales_channels', true) = ''
        or current_setting('app.current_sales_channels', true) = '*'
        or id = any(string_to_array(current_setting('app.current_sales_channels', true), ','))
      );
    `);
    this.addSql(`drop policy if exists "sales_channel_write_passthrough" on "sales_channel";`);
    this.addSql(`create policy "sales_channel_write_passthrough" on "sales_channel" for insert with check (true);`);
    this.addSql(`drop policy if exists "sales_channel_update_passthrough" on "sales_channel";`);
    this.addSql(`create policy "sales_channel_update_passthrough" on "sales_channel" for update using (true) with check (true);`);
    this.addSql(`drop policy if exists "sales_channel_delete_passthrough" on "sales_channel";`);
    this.addSql(`create policy "sales_channel_delete_passthrough" on "sales_channel" for delete using (true);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop policy if exists "sales_channel_delete_passthrough" on "sales_channel";`);
    this.addSql(`drop policy if exists "sales_channel_update_passthrough" on "sales_channel";`);
    this.addSql(`drop policy if exists "sales_channel_write_passthrough" on "sales_channel";`);
    this.addSql(`drop policy if exists "product_delete_passthrough" on "product";`);
    this.addSql(`drop policy if exists "product_update_passthrough" on "product";`);
    this.addSql(`drop policy if exists "product_write_passthrough" on "product";`);
    // Nie przywracamy oryginalnej (błędnej) polityki FOR ALL w down() — patrz
    // Migration20260718092554.ts down() dla pełnego wyłączenia RLS.
  }

}
