import { MiddlewareRoute } from "@medusajs/framework/http"
import { authenticate } from "../../../utils/middlewares/authenticate-middleware"

/**
 * /admin/sklepiki/self-signup jest publiczny (bez zaproszenia) — przyjmuje
 * actorless token z POST /auth/user/emailpass/register, stąd
 * allowUnregistered: true (ten sam wzorzec co /admin/invites/accept).
 * Reszta endpointów pod /admin/sklepiki (GET, POST bez /self-signup)
 * zostaje na domyślnym, pełnym uwierzytelnieniu admina.
 */
export const adminSklepikiRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: "POST",
    matcher: "/admin/sklepiki/self-signup",
    middlewares: [
      authenticate("user", ["bearer"], { allowUnregistered: true }),
    ],
  },
]
