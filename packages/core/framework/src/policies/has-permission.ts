import { MedusaContainer } from "@medusajs/types"
import {
  ContainerRegistrationKeys,
  useCache,
  WILDCARD,
} from "@medusajs/utils"
import { FlagRouter } from "../feature-flags/flag-router"

export type PermissionAction = {
  resource: string
  operation: string | string[]
}

/*
/**
 *
 * @property roles the role(s) to check. Can be a single string or an array of strings.
 * @property actions the action(s) to check. Can be a single `PermissionAction` or an array of `PermissionAction`s.
 * @property container the Medusa container
*/
export type HasPermissionInput = {
  roles: string | string[]
  actions: PermissionAction | PermissionAction[]
  container: MedusaContainer
}

export type ResolvePermissionsInput = {
  roles: string | string[]
  /**
   * The universe of `(resource, operation)` tuples to evaluate against the
   * actor's policies. The result is the subset of this universe that the
   * actor is granted, with wildcards (`*:*`, `*:op`, `resource:*`) expanded.
   */
  universe: { resource: string; operation: string }[]
  container: MedusaContainer
}

type RolePoliciesCache = Map<string, Map<string, Set<string>>>

/**
 * Applies wildcard-aware matching to decide whether any of the
 * supplied roles grants `(resource, operation)`. This is the single source of
 * truth for wildcard semantics used by both {@link hasPermission} and
 * {@link resolvePermissions}.
 */
function policyAllows(
  rolePoliciesMap: RolePoliciesCache,
  resource: string,
  operation: string
): boolean {
  for (const resourceMap of rolePoliciesMap.values()) {
    const allowedOps = new Set([
      ...(resourceMap.get(resource) || []),
      ...(resourceMap.get(WILDCARD) || []),
    ])
    if (allowedOps.has(operation) || allowedOps.has(WILDCARD)) {
      return true
    }
  }
  return false
}

/**
 * Checks if the given role(s) have permission to perform the specified action(s).
 *
 * @param input - The input containing roles, actions, and container
 * @returns true if all actions are permitted, false otherwise
 *
 * @example
 * ```ts
 * const canWrite = await hasPermission({
 *   roles: ['role_123'],
 *   actions: { resource: 'product', operation: 'write' },
 *   container
 * })
 *
 * const canDeleteAndWrite = await hasPermission({
 *   roles: ['role_123'],
 *   actions: { resource: 'product', operation: ['delete', 'write'] },
 *   container
 * })
 * ```
 */
export async function hasPermission(
  input: HasPermissionInput
): Promise<boolean> {
  const { roles, actions, container } = input

  const roleIds = Array.isArray(roles) ? roles : [roles]
  const actionList = Array.isArray(actions) ? actions : [actions]
  const ffRouter = container.resolve(
    ContainerRegistrationKeys.FEATURE_FLAG_ROUTER
  ) as FlagRouter

  const isDisabled = !ffRouter.isFeatureEnabled("rbac")
  if (isDisabled || !roleIds?.length || !actionList?.length) {
    return true
  }

  const rolePoliciesMap = await fetchRolePolicies(roleIds, container)

  for (const action of actionList) {
    const operations = Array.isArray(action.operation)
      ? action.operation
      : [action.operation]

    for (const op of operations) {
      if (!policyAllows(rolePoliciesMap, action.resource, op)) {
        return false
      }
    }
  }

  return true
}

/**
 * Resolves the actor's effective permission set: the subset of `universe` that
 * the actor is granted, with wildcards expanded against concrete entries.
 *
 * This is the "inverse" of {@link hasPermission}. It is intended for use by
 * endpoints that need to hand the client a flat permission list (so the client
 * can do literal lookups instead of duplicating wildcard semantics).
 *
 * @example
 * ```ts
 * const granted = await resolvePermissions({
 *   roles: ["role_super_admin"],
 *   universe: [
 *     { resource: "product", operation: "read" },
 *     { resource: "customer", operation: "create" },
 *   ],
 *   container,
 * })
 * // granted = Set { "product:read", "customer:create" }
 * ```
 */
export async function resolvePermissions(
  input: ResolvePermissionsInput
): Promise<Set<string>> {
  const { roles, universe, container } = input

  const roleIds = Array.isArray(roles) ? roles : [roles]
  const ffRouter = container.resolve(
    ContainerRegistrationKeys.FEATURE_FLAG_ROUTER
  ) as FlagRouter

  if (!ffRouter.isFeatureEnabled("rbac")) {
    return new Set(
      universe.map(({ resource, operation }) => `${resource}:${operation}`)
    )
  }

  if (!roleIds.length) {
    return new Set()
  }

  const rolePoliciesMap = await fetchRolePolicies(roleIds, container)
  const granted = new Set<string>()

  for (const { resource, operation } of universe) {
    if (policyAllows(rolePoliciesMap, resource, operation)) {
      granted.add(`${resource}:${operation}`)
    }
  }

  return granted
}

/**
 * Fetches a single role's policies from cache or database.
 */
async function fetchSingleRolePolicies(
  roleId: string,
  container: MedusaContainer
): Promise<Map<string, Set<string>>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const tags: string[] = []
  return await useCache<Map<string, Set<string>>>(
    async () => {
      const { data: roles } = await query.graph({
        entity: "rbac_role",
        fields: ["id", "policies.*"],
        filters: { id: roleId },
      })

      const role = roles[0]
      const resourceMap = new Map<string, Set<string>>()

      tags.push(`rbac_role:${roleId}`)
      if (role?.policies && Array.isArray(role.policies)) {
        const policyIds: string[] = []

        for (const policy of role.policies) {
          policyIds.push(policy.id)

          if (!resourceMap.has(policy.resource)) {
            resourceMap.set(policy.resource, new Set())
          }
          resourceMap.get(policy.resource)!.add(policy.operation)

          tags.push(`rbac_policy:${policy.id}`)
        }
      }

      return resourceMap
    },
    {
      container,
      key: roleId,
      tags,
      ttl: 60 * 60 * 24 * 7,
      providers: ["cache-memory"],
    }
  )
}

/**
 * Fetches policies for multiple roles by composing individually cached role queries.
 */
async function fetchRolePolicies(
  roleIds: string[],
  container: MedusaContainer
): Promise<RolePoliciesCache> {
  const rolePoliciesMap: RolePoliciesCache = new Map()

  await Promise.all(
    roleIds.map(async (roleId) => {
      const resourceMap = await fetchSingleRolePolicies(roleId, container)
      rolePoliciesMap.set(roleId, resourceMap)
    })
  )

  return rolePoliciesMap
}

/**
 * ---------------------------------------------------------------------------
 * Scoped permissions (multi-store, dodane 2026-07-17)
 * ---------------------------------------------------------------------------
 *
 * Rozszerzenie o sprawdzanie *instancji* zasobu (np. konkretnego
 * `sales_channel_id`), nie tylko `resource:operation`. Celowo osobna
 * funkcja/ścieżka danych od {@link hasPermission} — nie modyfikujemy
 * istniejącego, używanego w ~30 miejscach mechanizmu, żeby nie ryzykować
 * regresji. Patrz docs/plans/multi-store-platform.md.
 *
 * Semantyka `rbac_policy.resource_id`:
 * - `null`/brak → polityka globalna dla resource+operation (np. wildcard
 *   super-admina `*:*`) — przechodzi zawsze, niezależnie od żądanego
 *   `resourceId`.
 * - konkretna wartość → polityka dotyczy tylko tej instancji zasobu
 *   (np. `sales_channel_id` sklepiku, którym admin zarządza).
 */

export type ScopedPermissionAction = {
  resource: string
  operation: string | string[]
  /**
   * Id instancji zasobu, którego dotyczy żądanie (np. sales_channel_id
   * wyciągnięty z requestu). Jeśli nie podane, zachowuje się jak
   * {@link hasPermission} (tylko resource+operation).
   */
  resourceId?: string
}

export type HasScopedPermissionInput = {
  roles: string | string[]
  actions: ScopedPermissionAction | ScopedPermissionAction[]
  container: MedusaContainer
}

type ScopedPolicy = {
  resource: string
  operation: string
  resource_id: string | null
}

function scopedPolicyAllows(
  policies: ScopedPolicy[],
  resource: string,
  operation: string,
  resourceId: string | undefined
): boolean {
  for (const policy of policies) {
    const resourceMatches =
      policy.resource === resource || policy.resource === WILDCARD
    if (!resourceMatches) continue

    const operationMatches =
      policy.operation === operation || policy.operation === WILDCARD
    if (!operationMatches) continue

    // Polityka globalna (brak resource_id) — zawsze przechodzi.
    if (!policy.resource_id) return true

    // Polityka zawężona — musi się zgadzać z żądanym resourceId.
    if (resourceId && policy.resource_id === resourceId) return true
  }
  return false
}

async function fetchSingleRoleScopedPolicies(
  roleId: string,
  container: MedusaContainer
): Promise<ScopedPolicy[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  return await useCache<ScopedPolicy[]>(
    async () => {
      const { data: roles } = await query.graph({
        entity: "rbac_role",
        fields: ["id", "policies.*"],
        filters: { id: roleId },
      })

      const role = roles[0]
      if (!role?.policies || !Array.isArray(role.policies)) {
        return []
      }

      return role.policies.map((policy: any) => ({
        resource: policy.resource,
        operation: policy.operation,
        resource_id: policy.resource_id ?? null,
      }))
    },
    {
      container,
      key: `scoped:${roleId}`,
      tags: [`rbac_role:${roleId}`],
      ttl: 60 * 60 * 24 * 7,
      providers: ["cache-memory"],
    }
  )
}

/**
 * Instance-aware wariant {@link hasPermission} — sprawdza nie tylko czy rola
 * może wykonać `operation` na `resource`, ale też (jeśli polityka jest
 * zawężona) czy dotyczy konkretnej instancji `resourceId`.
 */
export async function hasScopedPermission(
  input: HasScopedPermissionInput
): Promise<boolean> {
  const { roles, actions, container } = input

  const roleIds = Array.isArray(roles) ? roles : [roles]
  const actionList = Array.isArray(actions) ? actions : [actions]
  const ffRouter = container.resolve(
    ContainerRegistrationKeys.FEATURE_FLAG_ROUTER
  ) as FlagRouter

  const isDisabled = !ffRouter.isFeatureEnabled("rbac")
  if (isDisabled || !roleIds?.length || !actionList?.length) {
    return true
  }

  const policiesPerRole = await Promise.all(
    roleIds.map((roleId) => fetchSingleRoleScopedPolicies(roleId, container))
  )
  const allPolicies = policiesPerRole.flat()

  for (const action of actionList) {
    const operations = Array.isArray(action.operation)
      ? action.operation
      : [action.operation]

    for (const op of operations) {
      if (
        !scopedPolicyAllows(allPolicies, action.resource, op, action.resourceId)
      ) {
        return false
      }
    }
  }

  return true
}
