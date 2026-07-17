import { Modules } from "@medusajs/framework/utils"
import {
  WorkflowData,
  WorkflowResponse,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/core-flows"
import { createRemoteLinkStep } from "@medusajs/core-flows"

/**
 * Zakłada nowy sklepik: sales_channel (jednostka "sklepik" w naszym modelu
 * multi-store, patrz docs/plans/multi-store-platform.md) + własny region
 * (waluta/kraj) + publishable API key scoped do tego sales_channel, i łączy
 * zalogowanego admina z nowym sklepikiem (link user_sales_channel).
 *
 * NIE tworzy nowej encji `Store` — świadomie odrzucona ścieżka, patrz plan.
 * NIE nadaje uprawnień RBAC do zarządzania sklepikiem — to osobny krok
 * (patrz packages/modules/rbac, rbac_policy.resource_id), bo scoping
 * uprawnień i widoczność sklepiku w panelu to dwie różne sprawy.
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

    createRemoteLinkStep(
      transform({ salesChannel, input }, (data) => [
        {
          [Modules.USER]: { user_id: data.input.adminUserId },
          [Modules.SALES_CHANNEL]: { sales_channel_id: data.salesChannel.id },
        },
      ])
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
