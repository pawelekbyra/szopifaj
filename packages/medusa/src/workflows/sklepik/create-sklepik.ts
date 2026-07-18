import { Modules } from "@medusajs/framework/utils"
import type { IRegionModuleService, LinkDefinition } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowData,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createRbacPoliciesWorkflow,
  createRbacRolesWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/core-flows"
import { createRemoteLinkStep } from "@medusajs/core-flows"
import { randomBytes } from "node:crypto"

/**
 * Identyfikator subdomeny sklepiku (np. "moj-sklepik-a1b2c3" →
 * moj-sklepik-a1b2c3.szopifaj...) — patrz docs/plans/multi-store-platform.md,
 * sekcja "Storefront". Losowy sufiks zamiast sprawdzania unikalności przez
 * zapytanie-potem-zapis (wyścig przy równoczesnym zakładaniu dwóch
 * sklepików o tej samej nazwie) — prostsze i wystarczające przy skali
 * "kilkanaście-kilkadziesiąt sklepów".
 */
function generateSklepikHandle(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // usuń znaki diakrytyczne (ą→a itd.)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  const suffix = randomBytes(3).toString("hex")
  return slug ? `${slug}-${suffix}` : suffix
}

/**
 * Region w Medusie wymaga unikalnego przypisania kraju — dwa regiony nie
 * mogą dzielić tego samego kraju (np. "pl"). Ponieważ region i tak nie ma
 * formalnego powiązania z sales_channel (patrz "Ważne odkrycie" w
 * docs/plans/multi-store-platform.md — /store/regions zwraca regiony
 * wszystkich sklepików niezależnie od klucza; storefront rozstrzyga
 * kraj/walutę wprost z metadanych sales_channel, nie przez region), każdy
 * kolejny sklepik dla tego samego kraju może bezpiecznie **reużyć**
 * istniejący region zamiast próbować utworzyć duplikat, który i tak
 * Medusa odrzuci błędem "already assigned to a region". Bez tego kroku
 * drugi (i każdy kolejny) sklepik dla Polski nie dał się założyć — a to
 * jest dokładnie oczekiwany, najczęstszy przypadek self-signup na
 * serowymichal.pl.
 */
const getOrCreateSklepikRegionStep = createStep(
  "get-or-create-sklepik-region",
  async (
    data: { name: string; currencyCode: string; countryCode: string },
    { container }
  ) => {
    const service = container.resolve<IRegionModuleService>(Modules.REGION)

    const existingRegions = await service.listRegions(
      {},
      { relations: ["countries"] }
    )
    const existing = existingRegions.find((region) =>
      region.countries?.some((country) => country.iso_2 === data.countryCode)
    )

    if (existing) {
      // Nic nowego nie utworzone — nie ma czego cofać przy kompensacji.
      return new StepResponse(existing, null)
    }

    const [created] = await service.createRegions([
      {
        name: data.name,
        currency_code: data.currencyCode,
        countries: [data.countryCode],
      },
    ])

    return new StepResponse(created, created.id)
  },
  async (createdRegionId, { container }) => {
    if (!createdRegionId) {
      return
    }

    const service = container.resolve<IRegionModuleService>(Modules.REGION)
    await service.deleteRegions([createdRegionId])
  }
)

/**
 * Zestaw operacji, które właściciel nowego sklepiku dostaje zawężone do
 * swojego sales_channel — patrz "RBAC / bezpieczeństwo" w
 * docs/plans/multi-store-platform.md.
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
 *
 * order:read dodane 2026-07-18 — właściciel widzi tylko zamówienia z
 * własnego sklepiku (order ma bezpośrednią kolumnę sales_channel_id,
 * scoping prostszy niż dla product). Świadomie tylko odczyt na start —
 * edycja/anulowanie zamówień (order:update i pokrewne) to osobna decyzja
 * produktowa, nie dodana tutaj bez wyraźnej potrzeby.
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
  { resource: "order", operation: "read" },
]

/**
 * Zakłada nowy sklepik: sales_channel (jednostka "sklepik" w naszym modelu
 * multi-store, patrz docs/plans/multi-store-platform.md) + region (waluta/
 * kraj — reużyty, jeśli kraj już ma jakiś region, patrz
 * getOrCreateSklepikRegionStep powyżej) + publishable API key scoped do
 * tego sales_channel, i łączy zalogowanego admina z nowym sklepikiem (link
 * user_sales_channel).
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
  handle: string
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
          transform({ input }, (data) => ({
            name: data.input.name,
            metadata: {
              handle: generateSklepikHandle(data.input.name),
              // Zapisane bezpośrednio z inputu (nie z utworzonego regionu)
              // — sales_channel i region nie mają formalnego powiązania w
              // Medusie (/store/regions zwraca WSZYSTKIE regiony ze
              // wszystkich sklepików niezależnie od klucza — sprawdzone
              // empirycznie 2026-07-18), więc storefront potrzebuje tej
              // wartości wprost, żeby wiedzieć który kraj/region pokazać
              // domyślnie dla tej subdomeny. Patrz
              // docs/plans/multi-store-platform.md, sekcja "Storefront".
              default_country_code: data.input.countryCode ?? "pl",
            },
          })),
        ],
      },
    })

    const region = getOrCreateSklepikRegionStep(
      transform({ input }, (data) => ({
        name: data.input.name,
        currencyCode: data.input.currencyCode ?? "pln",
        countryCode: data.input.countryCode ?? "pl",
      }))
    )

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
        handle: (data.salesChannel.metadata as { handle?: string } | null)
          ?.handle as string,
      }))
    )
  }
)
