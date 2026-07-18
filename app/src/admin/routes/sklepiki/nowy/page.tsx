import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Buildings } from "@medusajs/icons"
import { Button, Container, Heading, Input, Label, Text } from "@medusajs/ui"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { sdk } from "../../../lib/sdk"

type CreateSklepikResponse = {
  sklepik: {
    salesChannelId: string
    regionId: string
    publishableApiKey: string
    handle: string
  }
}

/**
 * Custom route "/sklepiki/nowy" — formularz zakładania nowego sklepiku,
 * woła POST /admin/sklepiki (create-sklepik.ts w szopifaj). Patrz
 * docs/plans/multi-store-platform.md, sekcja "Panel moje sklepiki".
 */
const NowySklepikPage = () => {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [countryCode, setCountryCode] = useState("pl")
  const [currencyCode, setCurrencyCode] = useState("pln")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateSklepikResponse["sklepik"] | null>(
    null
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await sdk.client.fetch<CreateSklepikResponse>(
        "/admin/sklepiki",
        {
          method: "POST",
          body: {
            name,
            country_code: countryCode,
            currency_code: currencyCode,
          },
        }
      )
      setResult(res.sklepik)
    } catch (err: any) {
      setError(
        err?.message ??
          "Nie udało się założyć sklepiku. Sprawdź czy kraj nie jest już przypisany do innego regionu."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (result) {
    return (
      <Container className="max-w-lg">
        <Heading level="h1" className="mb-2">
          Sklepik założony 🎉
        </Heading>
        <Text className="text-ui-fg-subtle mb-4">
          "{name}" jest gotowy. Zapisz te dane — nie pokażemy klucza ponownie.
        </Text>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm mb-6">
          <dt className="text-ui-fg-subtle">Identyfikator (handle)</dt>
          <dd className="font-mono">{result.handle}</dd>
          <dt className="text-ui-fg-subtle">Publishable API key</dt>
          <dd className="font-mono break-all">{result.publishableApiKey}</dd>
        </dl>
        <Button
          onClick={() =>
            navigate(`/settings/sales-channels/${result.salesChannelId}`)
          }
        >
          Przejdź do ustawień sklepiku
        </Button>
      </Container>
    )
  }

  return (
    <Container className="max-w-lg">
      <Heading level="h1" className="mb-4">
        Nowy sklepik
      </Heading>
      <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="name">Nazwa</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="np. Kwiaciarnia Ala"
          />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="countryCode">Kod kraju (ISO 3166-1 alfa-2)</Label>
          <Input
            id="countryCode"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toLowerCase())}
            required
            maxLength={2}
            placeholder="pl"
          />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="currencyCode">Waluta</Label>
          <Input
            id="currencyCode"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value.toLowerCase())}
            required
            maxLength={3}
            placeholder="pln"
          />
        </div>
        {error && (
          <Text size="small" className="text-ui-fg-error">
            {error}
          </Text>
        )}
        <Button type="submit" isLoading={isSubmitting}>
          Załóż sklepik
        </Button>
      </form>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Nowy sklepik",
  icon: Buildings,
})

export default NowySklepikPage
