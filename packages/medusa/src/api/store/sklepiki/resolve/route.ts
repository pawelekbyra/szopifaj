import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Rozwiązuje identyfikator subdomeny sklepiku (`handle`, zapisany w
 * sales_channel.metadata przy zakładaniu — patrz create-sklepik.ts) na
 * dane potrzebne storefrontowi do obsłużenia tego sklepiku: id sales
 * channel i jego publishable API key. Patrz docs/plans/multi-store-platform.md,
 * sekcja "Storefront".
 *
 * Świadomie pod /store/* (wymaga jakiegokolwiek ważnego publishable key w
 * nagłówku — dowolnego, nie musi być "tego właściwego" — middleware
 * ensurePublishableApiKeyMiddleware sprawdza tylko czy klucz istnieje i nie
 * jest odwołany, nie ogranicza co endpoint może zwrócić). To zamierzone
 * obejście problemu "z czym pytać o właściwy klucz, zanim się go zna" —
 * storefront używa jednego, znanego z góry klucza ("bootstrap") tylko do
 * tego jednego zapytania.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const handle = req.query.handle
  if (typeof handle !== "string" || !handle) {
    res.status(400).json({ message: "Parametr 'handle' jest wymagany" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "sales_channel",
    fields: [
      "id",
      "name",
      "metadata",
      "publishable_api_keys.id",
      "publishable_api_keys.token",
    ],
    filters: { metadata: { handle } } as any,
  })

  const salesChannel = data[0]
  const publishableKey = salesChannel?.publishable_api_keys?.[0]?.token

  if (!salesChannel || !publishableKey) {
    res.status(404).json({ message: "Nie znaleziono sklepiku dla podanej subdomeny" })
    return
  }

  res.json({
    sales_channel_id: salesChannel.id,
    name: salesChannel.name,
    publishable_key: publishableKey,
    // /store/regions zwraca regiony wszystkich sklepików niezależnie od
    // klucza (sprawdzone empirycznie 2026-07-18) — storefront potrzebuje
    // tej wartości wprost, patrz komentarz w create-sklepik.ts.
    default_country_code: (salesChannel.metadata as { default_country_code?: string } | null)
      ?.default_country_code,
  })
}
