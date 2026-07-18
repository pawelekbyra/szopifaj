import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework"
import { MiddlewareRoute } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, PolicyOperation } from "@medusajs/framework/utils"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import * as QueryConfig from "./query-config"
import { Entities } from "./query-config"
import {
  AdminAuthorizeOrderPaymentSession,
  AdminCompleteOrder,
  AdminCreateOrderCreditLines,
  AdminGetOrderShippingOptionList,
  AdminGetOrdersOrderItemsParams,
  AdminGetOrdersOrderParams,
  AdminGetOrdersParams,
  AdminMarkOrderFulfillmentAsDelivered,
  AdminOrderCancelFulfillment,
  AdminOrderChangesParams,
  AdminOrderCreateFulfillment,
  AdminOrderCreateShipment,
  AdminTransferOrder,
  AdminTransferOrderToGuest,
  AdminUpdateOrder,
} from "./validators"

/**
 * Wyciąga sales_channel_id zamówienia na potrzeby scoped RBAC (multi-store,
 * patrz docs/plans/multi-store-platform.md). W przeciwieństwie do produktu,
 * order ma bezpośrednią kolumnę sales_channel_id (nie tabelę linkującą) —
 * prostszy przypadek.
 */
async function extractOrderSalesChannelId(
  req: AuthenticatedMedusaRequest
): Promise<string | undefined> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "sales_channel_id"],
    filters: { id: req.params.id },
  })
  return data[0]?.sales_channel_id ?? undefined
}

export const adminOrderRoutesMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/orders/*",
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.read,
      },
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/orders",
    middlewares: [
      validateAndTransformQuery(
        AdminGetOrdersParams,
        QueryConfig.listTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.read,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/export",
    middlewares: [
      validateAndTransformQuery(
        AdminGetOrdersParams,
        QueryConfig.exportTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.read,
      },
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/orders/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    // Zawężenie do sklepików admina — dodane 2026-07-18 (multi-store, patrz
    // docs/plans/multi-store-platform.md). Polityka globalna (brak
    // resource_id, np. wildcard super-admina) nadal przechodzi zawsze.
    scopedPolicies: {
      policies: [{ resource: Entities.order, operation: PolicyOperation.read }],
      resourceIdField: "id",
      resourceIdExtractor: extractOrderSalesChannelId,
    },
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id",
    middlewares: [
      validateAndTransformBody(AdminUpdateOrder),
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.update,
      },
    ],
    scopedPolicies: {
      policies: [{ resource: Entities.order, operation: PolicyOperation.update }],
      resourceIdField: "id",
      resourceIdExtractor: extractOrderSalesChannelId,
    },
  },
  {
    method: ["GET"],
    matcher: "/admin/orders/:id/line-items",
    middlewares: [
      validateAndTransformQuery(
        AdminGetOrdersOrderItemsParams,
        QueryConfig.listOrderItemsQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/orders/:id/shipping-options",
    middlewares: [
      validateAndTransformQuery(
        AdminGetOrderShippingOptionList,
        QueryConfig.listShippingOptionsQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/orders/:id/changes",
    middlewares: [
      validateAndTransformQuery(
        AdminOrderChangesParams,
        QueryConfig.retrieveOrderChangesTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/orders/:id/preview",
    middlewares: [
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/archive",
    middlewares: [
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.update,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/cancel",
    middlewares: [
      // validateAndTransformBody(),
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.update,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/complete",
    middlewares: [
      validateAndTransformBody(AdminCompleteOrder),
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.update,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/payment-sessions/authorize",
    middlewares: [
      validateAndTransformBody(AdminAuthorizeOrderPaymentSession),
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.update,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/credit-lines",
    middlewares: [
      validateAndTransformBody(AdminCreateOrderCreditLines),
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.credit_line,
        operation: PolicyOperation.create,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/fulfillments",
    middlewares: [
      validateAndTransformBody(AdminOrderCreateFulfillment),
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.fulfillment,
        operation: PolicyOperation.create,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/cancel",
    middlewares: [
      validateAndTransformBody(AdminOrderCancelFulfillment),
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.fulfillment,
        operation: PolicyOperation.update,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/shipments",
    middlewares: [
      validateAndTransformBody(AdminOrderCreateShipment),
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.fulfillment,
        operation: PolicyOperation.update,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/mark-as-delivered",
    middlewares: [
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
      validateAndTransformBody(AdminMarkOrderFulfillmentAsDelivered),
    ],
    policies: [
      {
        resource: Entities.fulfillment,
        operation: PolicyOperation.update,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/transfer",
    middlewares: [
      validateAndTransformBody(AdminTransferOrder),
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.update,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/transfer/guest",
    middlewares: [
      validateAndTransformBody(AdminTransferOrderToGuest),
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.update,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/transfer/cancel",
    middlewares: [
      validateAndTransformQuery(
        AdminGetOrdersOrderParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.order,
        operation: PolicyOperation.update,
      },
    ],
  },
]
