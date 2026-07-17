import { MedusaError } from "@medusajs/utils"
import { hasPermission, hasScopedPermission } from "../../policies/has-permission"
import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
  MiddlewareFunction,
} from "../types"

export type PolicyAction = {
  resource: string
  operation: string | string[]
}

/**
 * Core permission checking logic for middleware and routes
 */
async function checkPermissions(
  policies: PolicyAction | PolicyAction[],
  req: AuthenticatedMedusaRequest
): Promise<void> {
  // Normalize policies to array
  const policyList = Array.isArray(policies) ? policies : [policies]

  if (!policyList.length) {
    return
  }

  const authContext = req.auth_context
  // Get roles from JWT token's app_metadata
  const roleIds = (authContext?.app_metadata?.roles as string[]) || []

  if (!roleIds.length) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "Forbidden")
  }

  const hasAccess = await hasPermission({
    roles: roleIds,
    actions: policyList,
    container: req.scope,
  })

  if (!hasAccess) {
    const policyKeys = policyList
      .map((p) => `${p.resource}:${p.operation}`)
      .join(", ")

    throw new MedusaError(
      MedusaError.Types.FORBIDDEN,
      `Insufficient permissions. Required policies: ${policyKeys}`
    )
  }
}

/**
 * Wraps a middleware or route handler with RBAC permission checking.
 * Checks if the authenticated user has the required policies before executing the handler.
 *
 * @param handler - The original middleware or route handler to wrap
 * @param policies - Single policy or array of policies to check
 * @returns Wrapped middleware or route function that checks permissions first
 */
export function wrapWithPoliciesCheck(
  handler: MiddlewareFunction,
  policies: PolicyAction | PolicyAction[]
): MiddlewareFunction {
  return async (
    req: AuthenticatedMedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      req.policies ??= []
      req.policies.push(...(Array.isArray(policies) ? policies : [policies]))

      await checkPermissions(policies, req)
      return handler(req, res, next)
    } catch (error) {
      return next(error)
    }
  }
}

/**
 * ---------------------------------------------------------------------------
 * Scoped policies (multi-store, dodane 2026-07-17)
 * ---------------------------------------------------------------------------
 * Osobna funkcja obok {@link wrapWithPoliciesCheck} (nie zamiast niej) — patrz
 * uzasadnienie w packages/core/framework/src/policies/has-permission.ts i
 * docs/plans/multi-store-platform.md. Używana tam, gdzie dostęp admina ma być
 * dodatkowo zawężony do konkretnej instancji zasobu (np. jego sklepiku).
 */

/**
 * Wyciąga id instancji zasobu (np. `sales_channel_id`) z requestu, żeby
 * przekazać go do {@link hasScopedPermission}. Domyślnie sprawdza (w tej
 * kolejności) query string, potem body — pasuje do typowych list/create
 * endpointów Medusy. Endpointy o innym kształcie (np. `sales_channel_id`
 * trzeba dociągnąć z encji po jej własnym `id` w URL) powinny podać własny
 * `resourceIdExtractor`.
 */
const defaultResourceIdExtractor = (
  req: AuthenticatedMedusaRequest,
  field: string
): string | undefined => {
  const fromQuery = (req.query as Record<string, unknown> | undefined)?.[
    field
  ]
  if (typeof fromQuery === "string") return fromQuery

  const fromBody = (req.body as Record<string, unknown> | undefined)?.[field]
  if (typeof fromBody === "string") return fromBody

  return undefined
}

async function checkScopedPermissions(
  policies: PolicyAction | PolicyAction[],
  resourceIdField: string,
  req: AuthenticatedMedusaRequest,
  resourceIdExtractor?: (
    req: AuthenticatedMedusaRequest
  ) => string | undefined | Promise<string | undefined>
): Promise<void> {
  const policyList = Array.isArray(policies) ? policies : [policies]

  if (!policyList.length) {
    return
  }

  const authContext = req.auth_context
  const roleIds = (authContext?.app_metadata?.roles as string[]) || []

  if (!roleIds.length) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "Forbidden")
  }

  const resourceId = resourceIdExtractor
    ? await resourceIdExtractor(req)
    : defaultResourceIdExtractor(req, resourceIdField)

  const hasAccess = await hasScopedPermission({
    roles: roleIds,
    actions: policyList.map((p) => ({ ...p, resourceId })),
    container: req.scope,
  })

  if (!hasAccess) {
    const policyKeys = policyList
      .map((p) => `${p.resource}:${p.operation}`)
      .join(", ")

    throw new MedusaError(
      MedusaError.Types.FORBIDDEN,
      `Insufficient permissions for this ${resourceIdField}. Required policies: ${policyKeys}`
    )
  }
}

/**
 * Wariant {@link wrapWithPoliciesCheck} zawężony do instancji zasobu.
 *
 * @param handler - oryginalny handler do owinięcia
 * @param policies - polityki (resource+operation) do sprawdzenia
 * @param resourceIdField - nazwa pola niosącego id instancji (np. "sales_channel_id")
 * @param resourceIdExtractor - opcjonalna własna funkcja wyciągająca id z requestu,
 *   gdy domyślne query/body nie pasuje (np. trzeba dociągnąć z bazy po `req.params.id`)
 */
export function wrapWithScopedPoliciesCheck(
  handler: MiddlewareFunction,
  policies: PolicyAction | PolicyAction[],
  resourceIdField: string,
  resourceIdExtractor?: (
    req: AuthenticatedMedusaRequest
  ) => string | undefined | Promise<string | undefined>
): MiddlewareFunction {
  return async (
    req: AuthenticatedMedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      req.policies ??= []
      req.policies.push(...(Array.isArray(policies) ? policies : [policies]))

      await checkScopedPermissions(
        policies,
        resourceIdField,
        req,
        resourceIdExtractor
      )
      return handler(req, res, next)
    } catch (error) {
      return next(error)
    }
  }
}
