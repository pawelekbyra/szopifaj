import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { selfSignupWorkflow } from "../../../../workflows/sklepik/self-signup"

type SelfSignupBody = {
  first_name?: string
  last_name?: string
  email?: string
  shop_name?: string
  currency_code?: string
  country_code?: string
}

/**
 * Publiczny self-signup: zakłada User + sklepik na podstawie actorless
 * tokenu z POST /auth/user/emailpass/register. Patrz
 * docs/plans/multi-store-platform.md, Key Decision 7.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<SelfSignupBody>,
  res: MedusaResponse
) => {
  if (req.auth_context.actor_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Ten token jest już powiązany z kontem — zaloguj się zamiast zakładać nowe."
    )
  }

  const {
    first_name,
    last_name,
    email,
    shop_name,
    currency_code,
    country_code,
  } = req.body

  if (!email || !shop_name) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "email i shop_name są wymagane"
    )
  }

  const { result } = await selfSignupWorkflow(req.scope).run({
    input: {
      email,
      firstName: first_name,
      lastName: last_name,
      authIdentityId: req.auth_context.auth_identity_id,
      shopName: shop_name,
      currencyCode: currency_code,
      countryCode: country_code,
    },
  })

  res.status(201).json(result)
}

export const AUTHENTICATE = false
