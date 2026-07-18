import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Wymusza unikalność `sales_channel.metadata->>'handle'` na poziomie bazy —
 * bez tego `createSklepikWorkflow` nie miał żadnej gwarancji, że dwa
 * sklepiki nie dostaną tej samej subdomeny (patrz `create-sklepik.ts`,
 * `generateSklepikHandle` — dotąd zawsze doklejał losowy sufiks właśnie
 * dlatego, że nic nie pilnowało unikalności w bazie). Ten indeks pozwala
 * teraz próbować czystego sluga (bez sufiksu) i dopiero przy realnej
 * kolizji dokładać sufiks — patrz getOrCreateSklepikSalesChannelStep.
 */
export class Migration20260718170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create unique index if not exists "IDX_sales_channel_handle_unique" on "sales_channel" ((metadata->>'handle')) where ("deleted_at" is null and metadata->>'handle' is not null);`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_sales_channel_handle_unique";`);
  }
}
