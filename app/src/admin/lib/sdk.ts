import Medusa from "@medusajs/js-sdk"

/**
 * Klient SDK dla rozszerzeń panelu admina (widget + custom route) —
 * ten sam wzorzec co w pluginach loyalty/draft-order. baseUrl "/" bo
 * panel i API są serwowane z tego samego hosta pod /admin/*.
 */
export const sdk = new Medusa({
  baseUrl: "/",
  auth: {
    type: "session",
  },
})
