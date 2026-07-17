import { ModuleJoinerConfig } from "@medusajs/framework/types"
import { LINKS, Modules } from "@medusajs/framework/utils"

/**
 * Który admin (User) zarządza którym sklepikiem (SalesChannel).
 * Dodane 2026-07-17 pod multi-sklepowość — patrz docs/plans/multi-store-platform.md.
 * Wzorowane na user-rbac-role.ts. Odpowiada za widoczność sklepików w panelu
 * ("moje sklepiki"), NIE za autoryzację operacji — to osobna sprawa
 * (patrz rozszerzenie rbac_policy.resource_id w packages/modules/rbac).
 */
export const UserSalesChannel: ModuleJoinerConfig = {
  serviceName: LINKS.UserSalesChannel,
  isLink: true,
  databaseConfig: {
    tableName: "user_sales_channel",
    idPrefix: "usersc",
  },
  alias: [
    {
      name: "user_sales_channel",
    },
    {
      name: "user_sales_channels",
    },
  ],
  primaryKeys: ["id", "user_id", "sales_channel_id"],
  relationships: [
    {
      serviceName: Modules.USER,
      entity: "User",
      primaryKey: "id",
      foreignKey: "user_id",
      alias: "user",
      args: {
        methodSuffix: "Users",
      },
      hasMany: true,
    },
    {
      serviceName: Modules.SALES_CHANNEL,
      entity: "SalesChannel",
      primaryKey: "id",
      foreignKey: "sales_channel_id",
      alias: "sales_channel",
      args: {
        methodSuffix: "SalesChannels",
      },
      hasMany: true,
    },
  ],
  extends: [
    {
      serviceName: Modules.USER,
      entity: "User",
      fieldAlias: {
        sales_channels: {
          path: "sales_channels_link.sales_channel",
          isList: true,
        },
      },
      relationship: {
        serviceName: LINKS.UserSalesChannel,
        primaryKey: "user_id",
        foreignKey: "id",
        alias: "sales_channels_link",
        isList: true,
      },
    },
    {
      serviceName: Modules.SALES_CHANNEL,
      entity: "SalesChannel",
      fieldAlias: {
        users: {
          path: "users_link.user",
          isList: true,
        },
      },
      relationship: {
        serviceName: LINKS.UserSalesChannel,
        primaryKey: "sales_channel_id",
        foreignKey: "id",
        alias: "users_link",
        isList: true,
      },
    },
  ],
}
