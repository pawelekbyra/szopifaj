import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260717180000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "rbac_policy" add column if not exists "resource_id" text null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rbac_policy_resource_id" ON "rbac_policy" ("resource_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_rbac_policy_resource_id";`);
    this.addSql(`alter table if exists "rbac_policy" drop column if exists "resource_id";`);
  }

}
