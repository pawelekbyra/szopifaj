import { model } from "@medusajs/framework/utils"

const RbacPolicy = model
  .define("rbac_policy", {
    id: model.id({ prefix: "rpol" }).primaryKey(),
    key: model.text().searchable(),
    resource: model.text().searchable(),
    operation: model.text().searchable(),
    // Zawężenie polityki do konkretnej instancji zasobu (np. sales_channel_id).
    // Puste = polityka globalna dla resource+operation (dotychczasowe zachowanie,
    // w tym wildcard "*:*" super-admina — bez zmian).
    // Dodane 2026-07-17 pod scoping wielosklepowy, patrz docs/plans/multi-store-platform.md.
    resource_id: model.text().nullable(),
    name: model.text().searchable().nullable(),
    description: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      on: ["key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      on: ["resource"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["operation"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["resource_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default RbacPolicy
