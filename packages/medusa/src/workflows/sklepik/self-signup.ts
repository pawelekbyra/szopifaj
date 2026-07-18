import type { UserDTO } from "@medusajs/framework/types"
import {
  WorkflowData,
  WorkflowResponse,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { createUsersWorkflow, setAuthAppMetadataStep } from "@medusajs/core-flows"
import {
  createSklepikWorkflow,
  CreateSklepikWorkflowOutput,
} from "./create-sklepik"

/**
 * Publiczny self-signup (bez zaproszenia) — patrz
 * docs/plans/multi-store-platform.md, Key Decision 7 (zaktualizowane
 * 2026-07-18: rejestracja otwarta publicznie na stronie startowej
 * serowymichal.pl, nie tylko zamknięta/zaproszeniowa jak pierwotnie
 * zakładano). Łączy utworzenie User z już istniejącą (actorless) tożsamością
 * auth — powstałą przez POST /auth/user/emailpass/register — z założeniem
 * sklepiku (createSklepikWorkflow), tak jak acceptInviteWorkflow łączy
 * przyjęcie zaproszenia z utworzeniem User, tylko bez kroku walidacji
 * tokenu zaproszenia (świadomie pominięty — to jest właśnie otwarta,
 * bezzaproszeniowa ścieżka).
 */
export type SelfSignupWorkflowInput = {
  email: string
  firstName?: string
  lastName?: string
  /** Id tożsamości auth utworzonej przez /auth/user/emailpass/register. */
  authIdentityId: string
  shopName: string
  currencyCode?: string
  countryCode?: string
}

export type SelfSignupWorkflowOutput = {
  user: UserDTO
  sklepik: CreateSklepikWorkflowOutput
}

export const selfSignupWorkflowId = "sklepik-self-signup"

export const selfSignupWorkflow = createWorkflow(
  selfSignupWorkflowId,
  (
    input: WorkflowData<SelfSignupWorkflowInput>
  ): WorkflowResponse<SelfSignupWorkflowOutput> => {
    const createUserInput = transform({ input }, ({ input }) => [
      {
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
      },
    ])

    const users = createUsersWorkflow.runAsStep({
      input: { users: createUserInput },
    })

    const authUserInput = transform({ input, users }, ({ input, users }) => ({
      authIdentityId: input.authIdentityId,
      actorType: "user",
      value: users[0].id,
    }))

    setAuthAppMetadataStep(authUserInput)

    const sklepikInput = transform({ input, users }, ({ input, users }) => ({
      name: input.shopName,
      currencyCode: input.currencyCode,
      countryCode: input.countryCode,
      adminUserId: users[0].id,
    }))

    const sklepik = createSklepikWorkflow.runAsStep({ input: sklepikInput })

    return new WorkflowResponse(
      transform({ users, sklepik }, ({ users, sklepik }) => ({
        user: users[0],
        sklepik,
      }))
    )
  }
)
