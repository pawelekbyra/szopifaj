import { Modules } from "@medusajs/framework/utils"
import type { LinkDefinition } from "@medusajs/framework/types"
import {
  WorkflowData,
  WorkflowResponse,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createRbacPoliciesWorkflow,
  createRbacRolesWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/core-flows"
import { createRemoteLinkStep } from "@medusajs/core-flows"

/**
 * Zestaw operacji, które właściciel nowego sklepiku dostaje zawężone do
 * swojego sales_channel — patrz "RBAC / bezpieczeństwo" w
 * docs/plans/multi-store-platform.md. Świadomie tylko sales_channel+product
 * na start (zgodnie z Migration Path krok 3 tamtego planu); orders/customers
 * później, tym samym wzorcem.
 *
 * inventory_item/price dodane 2026-07-18 — bez nich POST /admin/products
 * odrzuca każdą próbę utworzenia produktu z wariantem (endpoint wymaga tych
 * dwóch polityk razem z product:create, patrz middlewares.ts). Te dwa
 * zasoby NIE są dziś zawężane do sales_channel nigdzie w kodzie (brak
 * bezpośredniego linku inventory_item/price → sales_channel, w
 * przeciwieństwie do product), więc to efektywnie uprawnienie globalne w
 * obrębie operacji create/read/update — właściciel jednego sklepiku mógłby
 * teoretycznie zobaczyć/edytować inventory_item lub price niepowiązane z
 * żadnym jego produktem, gdyby ktoś wywołał osobny endpoint tych zasobów
 * bezpośrednio. Zaakceptowany kompromis na start (bez tego rola jest
 * bezużyteczna — nie da się sprzedawać produktu bez ceny), do
 * doprecyzowania jeśli okaże się realnym problemem (patrz Open Questions
 * w multi-store-platform.md).
 */
const SKLEPIK_OWNER_PERMISSIONS: { resource: string; operation: string }[] = [
  { resource: "sales_channel", operation: "read" },
  { resource: "sales_channel", operation: "update" },
  { resource: "product", operation: "create" },
  { resource: "product", operation: "read" },
  { resource: "product", operation: "update" },
  { resource: "product", operation: "delete" },
  { resource: "inventory_item", operation: "create" },
  { resource: "inventory_item", operation: "read" },
  { resource: "inventory_item", operation: "update" },
  { resource: "price", operation: "create" },
  { resource: "price", operation: "read" },
  { resource: "price", operation: "update" },
]

/**
 * Zakłada nowy sklepik: sales_channel (jednostka "sklepik" w naszym modelu
 * multi-store, patrz docs/plans/multi-store-platform.md) + własny region
 * (waluta/kraj) + publishable API key scoped do tego sales_channel, i łączy
 * zalogowanego admina z nowym sklepikiem (link user_sales_channel).
 *
 * NIE tworzy nowej encji `Store` — świadomie odrzucona ścieżka, patrz plan.
 *
 * Nadaje właścicielowi zawężone uprawnienia RBAC (SKLEPIK_OWNER_PERMISSIONS
 * powyżej, resource_id = id nowego sales_channel) przez nową rolę
 * `Właściciel: {nazwa}` — bez tego admin mógłby założyć sklepik, ale nie
 * mógłby nim zarządzać (brak jakiejkolwiek roli RBAC). Nie przekazujemy
 * actor_id/actor do createRbacRolesWorkflow celowo — to systemowe nadanie
 * uprawnień w ramach kontrolowanego zakresu (tylko nowo utworzony
 * sales_channel), nie ogólne "użytkownik nadaje dowolne uprawnienia", więc
 * walidacja przeciw eskalacji uprawnień (validateUserPermissionsStep) nie ma
 * tu zastosowania — i blokowałaby całkiem pierwszego admina bez uprawnień.
 */

export type CreateSklepikWorkflowInput = {
  /** Nazwa sklepiku, widoczna w panelu i jako nazwa domyślnego sales_channel. */
  name: string
  /** Kod waluty regionu, domyślnie "pln". */
  currencyCode?: string
  /** Kod kraju regionu (ISO 3166-1 alfa-2, małe litery), domyślnie "pl". */
  countryCode?: string
  /** Id admina (User), który zakłada sklepik — zostanie z nim powiązany. */
  adminUserId: string
}

export type CreateSklepikWorkflowOutput = {
  salesChannelId: string
  regionId: string
  publishableApiKey: string
}

export const createSklepikWorkflowId = "create-sklepik"

export const createSklepikWorkflow = createWorkflow(
  createSklepikWorkflowId,
  (
    input: WorkflowData<CreateSklepikWorkflowInput>
  ): WorkflowResponse<CreateSklepikWorkflowOutput> => {
    const salesChannels = createSalesChannelsWorkflow.runAsStep({
      input: {
        salesChannelsData: [
          transform({ input }, (data) => ({ name: data.input.name })),
        ],
      },
    })

    const regions = createRegionsWorkflow.runAsStep({
      input: {
        regions: [
          transform({ input }, (data) => ({
            name: data.input.name,
            currency_code: data.input.currencyCode ?? "pln",
            countries: [data.input.countryCode ?? "pl"],
          })),
        ],
      },
    })

    const apiKeys = createApiKeysWorkflow.runAsStep({
      input: {
        api_keys: [
          transform({ input }, (data) => ({
            title: `${data.input.name} — publishable`,
            type: "publishable" as const,
            created_by: data.input.adminUserId,
          })),
        ],
      },
    })

    const salesChannel = transform(
      { salesChannels },
      (data) => data.salesChannels[0]
    )
    const region = transform({ regions }, (data) => data.regions[0])
    const apiKey = transform({ apiKeys }, (data) => data.apiKeys[0])

    linkSalesChannelsToApiKeyWorkflow.runAsStep({
      input: transform({ apiKey, salesChannel }, (data) => ({
        id: data.apiKey.id,
        add: [data.salesChannel.id],
      })),
    })

    const scopedPolicies = createRbacPoliciesWorkflow.runAsStep({
      input: transform({ salesChannel }, (data) => ({
        policies: SKLEPIK_OWNER_PERMISSIONS.map(({ resource, operation }) => ({
          key: `${resource}:${operation}:${data.salesChannel.id}`,
          resource,
          operation,
          resource_id: data.salesChannel.id,
          name: `${resource}:${operation} (${data.salesChannel.id})`,
          description: `Automatycznie utworzone przy zakładaniu sklepiku — zawężone do jednego sales_channel.`,
        })),
      })),
    })

    const ownerRole = createRbacRolesWorkflow.runAsStep({
      input: transform({ salesChannel, scopedPolicies, input }, (data) => ({
        roles: [
          {
            name: `Właściciel: ${data.input.name}`,
            description: `Automatycznie utworzona rola właściciela sklepiku "${data.input.name}" (${data.salesChannel.id}).`,
            policy_ids: data.scopedPolicies.map((p: { id: string }) => p.id),
          },
        ],
      })),
    })

    // Jedno wywołanie createRemoteLinkStep na workflow — to pojedynczy,
    // predefiniowany krok ("create-remote-links"), nie da się go użyć
    // dwukrotnie w tym samym workflow (kolizja id kroku).
    createRemoteLinkStep(
      transform({ salesChannel, ownerRole, input }, (data) => {
        const links: LinkDefinition[] = [
          {
            [Modules.USER]: { user_id: data.input.adminUserId },
            [Modules.SALES_CHANNEL]: { sales_channel_id: data.salesChannel.id },
          },
          {
            [Modules.USER]: { user_id: data.input.adminUserId },
            [Modules.RBAC]: { rbac_role_id: data.ownerRole[0].id },
          },
        ]
        return links
      })
    )

    return new WorkflowResponse(
      transform({ salesChannel, region, apiKey }, (data) => ({
        salesChannelId: data.salesChannel.id,
        regionId: data.region.id,
        publishableApiKey: data.apiKey.token,
      }))
    )
  }
)
