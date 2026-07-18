import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Zmienia format `rbac_policy.key` z `resource:operation` na
 * `resource:operation:resource_id` (fallback "*" = globalna/niezawężona
 * polityka) — plan opisany w docs/plans/multi-store-platform.md, nigdy
 * wcześniej nie zastosowany mimo dodania kolumny `resource_id`
 * (Migration20260717180000).
 *
 * Powód: unikalny indeks na samym `key` (bez `resource_id`) uniemożliwiał
 * utworzenie zawężonej polityki dla resource:operation, które już ma
 * politykę globalną (np. nie dało się dodać "product:read" zawężonego do
 * jednego sklepiku, bo globalne "product:read" już zajmowało ten klucz).
 * Wszystkie dzisiejsze polityki mają resource_id=NULL, więc migracja jest
 * bezpieczna — dopisuje ":*" do każdej z nich.
 */
export class Migration20260718073940 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`update "rbac_policy" set "key" = "key" || ':*' where "resource_id" is null and "deleted_at" is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`update "rbac_policy" set "key" = regexp_replace("key", ':\\*$', '') where "resource_id" is null and "deleted_at" is null;`);
  }

}
