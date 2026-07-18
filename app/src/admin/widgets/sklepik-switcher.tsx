import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DropdownMenu, IconButton, Text } from "@medusajs/ui"
import { Buildings, Plus } from "@medusajs/icons"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { sdk } from "../lib/sdk"

type Sklepik = { id: string; name: string }

/**
 * Widget w strefie topbar — lista "moich sklepików" (sales_channels
 * powiązanych z zalogowanym adminem przez user_sales_channel, patrz
 * GET /admin/sklepiki w szopifaj) + skrót do założenia nowego. Patrz
 * docs/plans/multi-store-platform.md, sekcja "Panel moje sklepiki".
 *
 * Świadomie NIE filtruje widoku produktów/zamówień po kliknięciu — to
 * wymagałoby głębszej integracji z istniejącymi filtrami list w panelu,
 * nierozstrzygnięte jeszcze jak. Dziś to nawigacja: pokazuje które
 * sklepiki widzisz i prowadzi do ich stron ustawień/nowego sklepiku.
 * Samo UI niczego nie zabezpiecza — to robi RBAC po stronie API (już
 * przetestowane), zgodnie z zastrzeżeniem w multi-store-platform.md.
 */
const SklepikSwitcherWidget = () => {
  const [sklepiki, setSklepiki] = useState<Sklepik[] | null>(null)

  useEffect(() => {
    let cancelled = false
    sdk.client
      .fetch<{ sklepiki: Sklepik[] }>("/admin/sklepiki")
      .then((res) => {
        if (!cancelled) {
          setSklepiki(res.sklepiki)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSklepiki([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (sklepiki === null) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton size="small" variant="transparent">
          <Buildings />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label>
          <Text size="small" weight="plus">
            Moje sklepiki
          </Text>
        </DropdownMenu.Label>
        <DropdownMenu.Separator />
        {sklepiki.length === 0 && (
          <div className="px-2 py-1.5">
            <Text size="small" className="text-ui-fg-subtle">
              Nie masz jeszcze żadnego sklepiku.
            </Text>
          </div>
        )}
        {sklepiki.map((sklepik) => (
          <DropdownMenu.Item key={sklepik.id} asChild>
            <Link to={`/settings/sales-channels/${sklepik.id}`}>
              {sklepik.name}
            </Link>
          </DropdownMenu.Item>
        ))}
        <DropdownMenu.Separator />
        <DropdownMenu.Item asChild>
          <Link to="/sklepiki/nowy" className="flex items-center gap-x-2">
            <Plus />
            Nowy sklepik
          </Link>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}

export const config = defineWidgetConfig({
  zone: "topbar",
})

export default SklepikSwitcherWidget
