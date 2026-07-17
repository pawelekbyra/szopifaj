import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createSklepikWorkflow } from "../../../workflows/sklepik/create-sklepik"

type CreateSklepikBody = {
  name: string
  currency_code?: string
  country_code?: string
}

/**
 * Zakłada nowy sklepik dla zalogowanego admina.
 * Patrz docs/plans/multi-store-platform.md — sklepik = sales_channel,
 * nie nowa encja Store.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<CreateSklepikBody>,
  res: MedusaResponse
) => {
  const { name, currency_code, country_code } = req.body

  const { result } = await createSklepikWorkflow(req.scope).run({
    input: {
      name,
      currencyCode: currency_code,
      countryCode: country_code,
      adminUserId: req.auth_context.actor_id,
    },
  })

  res.status(201).json({ sklepik: result })
}

/**
 * Lista sklepików zalogowanego admina ("moje sklepiki").
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "user",
    fields: ["id", "sales_channels.id", "sales_channels.name"],
    filters: { id: req.auth_context.actor_id },
  })

  res.status(200).json({ sklepiki: data[0]?.sales_channels ?? [] })
}
