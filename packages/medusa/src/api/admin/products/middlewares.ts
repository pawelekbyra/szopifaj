import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework"
import { maybeApplyLinkFilter, MiddlewareRoute } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  FeatureFlag,
  PolicyOperation,
} from "@medusajs/framework/utils"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import multer from "multer"
import IndexEngineFeatureFlag from "../../../feature-flags/index-engine"
import { DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT } from "../../../utils/middlewares"
import { createBatchBody } from "../../utils/validators"
import { AdminGetProductVariantsParams } from "../product-variants/validators"
import * as QueryConfig from "./query-config"
import { Entities } from "./query-config"
import { maybeApplyPriceListsFilter } from "./utils"
import {
  AdminBatchCreateVariantInventoryItem,
  AdminBatchDeleteVariantInventoryItem,
  AdminBatchImageVariant,
  AdminBatchUpdateProduct,
  AdminBatchUpdateProductVariant,
  AdminBatchUpdateVariantInventoryItem,
  AdminBatchVariantImages,
  AdminCreateProduct,
  AdminCreateProductVariant,
  AdminCreateVariantInventoryItem,
  AdminGetProductOptionsParams,
  AdminGetProductParams,
  AdminGetProductsParams,
  AdminGetProductVariantParams,
  AdminImportProducts,
  AdminLinkProductOptions,
  AdminUpdateProduct,
  AdminUpdateProductVariant,
  AdminUpdateVariantInventoryItem,
  CreateProduct,
  CreateProductVariant,
} from "./validators"

const upload = multer({ storage: multer.memoryStorage() })

/**
 * Wyciąga sales_channel_id produktu na potrzeby scoped RBAC (multi-store,
 * patrz docs/plans/multi-store-platform.md). Produkt w naszym modelu należy
 * do jednego sklepiku (Key Decision 3 tamtego planu — osobny katalog per
 * admin, nie współdzielony), więc bierzemy pierwszy powiązany sales_channel;
 * link jest technicznie many-to-many w Medusie, ale ten produkt nie ma
 * dziś przypadku wielu sklepików na raz. Brak powiązania → brak resourceId →
 * dostęp tylko dla polityk globalnych (super-admin), co jest bezpiecznym
 * domyślnym zachowaniem dla produktu bez jednoznacznego właściciela.
 */
async function extractProductSalesChannelId(
  req: AuthenticatedMedusaRequest
): Promise<string | undefined> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "sales_channels.id"],
    filters: { id: req.params.id },
  })
  return data[0]?.sales_channels?.[0]?.id
}

export const adminProductRoutesMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/products/*",
    policies: [
      {
        resource: Entities.product,
        operation: PolicyOperation.read,
      },
    ],
  },
  {
    matcher: "/admin/products/*/variants/*",
    policies: [
      {
        resource: Entities.product_variant,
        operation: PolicyOperation.read,
      },
    ],
  },
  {
    matcher: "/admin/products/*/options/*",
    policies: [
      {
        resource: Entities.product_option,
        operation: PolicyOperation.read,
      },
    ],
  },
  {
    matcher: "/admin/products/*/variants/*/inventory-items/*",
    policies: [
      {
        resource: Entities.inventory_item,
        operation: PolicyOperation.read,
      },
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/products",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductsParams,
        QueryConfig.listProductQueryConfig
      ),
      (req, res, next) => {
        if (FeatureFlag.isFeatureEnabled(IndexEngineFeatureFlag.key)) {
          return next()
        }

        return maybeApplyLinkFilter({
          entryPoint: "product_sales_channel",
          resourceId: "product_id",
          filterableField: "sales_channel_id",
        })(req, res, next)
      },
      maybeApplyPriceListsFilter(),
    ],
    policies: [
      {
        resource: Entities.product,
        operation: PolicyOperation.read,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/products",
    middlewares: [
      validateAndTransformBody(AdminCreateProduct),
      validateAndTransformQuery(
        AdminGetProductParams,
        QueryConfig.retrieveProductQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.product,
        operation: PolicyOperation.create,
      },
      {
        resource: Entities.inventory_item,
        operation: PolicyOperation.create,
      },
      {
        resource: Entities.price,
        operation: PolicyOperation.create,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/batch",
    bodyParser: {
      sizeLimit: DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
    },
    middlewares: [
      validateAndTransformBody(
        createBatchBody(CreateProduct, AdminBatchUpdateProduct)
      ),
      validateAndTransformQuery(
        AdminGetProductParams,
        QueryConfig.retrieveProductQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.product,
        operation: [PolicyOperation.create, PolicyOperation.update],
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/export",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductsParams,
        QueryConfig.listProductQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/import",
    middlewares: [upload.single("file")],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/imports",
    middlewares: [validateAndTransformBody(AdminImportProducts)],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/import/:transaction_id/confirm",
    middlewares: [],
  },
  {
    method: ["GET"],
    matcher: "/admin/products/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductParams,
        QueryConfig.retrieveProductQueryConfig
      ),
    ],
    // Zawężenie do sklepików admina — dodane 2026-07-18 (multi-store, patrz
    // docs/plans/multi-store-platform.md). Polityka globalna (brak
    // resource_id, np. wildcard super-admina) nadal przechodzi zawsze.
    scopedPolicies: {
      policies: [{ resource: Entities.product, operation: PolicyOperation.read }],
      resourceIdField: "id",
      resourceIdExtractor: extractProductSalesChannelId,
    },
  },
  {
    method: ["POST"],
    matcher: "/admin/products/:id",
    middlewares: [
      validateAndTransformBody(AdminUpdateProduct),
      validateAndTransformQuery(
        AdminGetProductParams,
        QueryConfig.retrieveProductQueryConfig
      ),
    ],
    scopedPolicies: {
      policies: [{ resource: Entities.product, operation: PolicyOperation.update }],
      resourceIdField: "id",
      resourceIdExtractor: extractProductSalesChannelId,
    },
  },
  {
    method: ["DELETE"],
    matcher: "/admin/products/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductParams,
        QueryConfig.retrieveProductQueryConfig
      ),
    ],
    scopedPolicies: {
      policies: [{ resource: Entities.product, operation: PolicyOperation.delete }],
      resourceIdField: "id",
      resourceIdExtractor: extractProductSalesChannelId,
    },
    policies: [
      {
        resource: Entities.product,
        operation: PolicyOperation.delete,
      },
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/products/:id/variants",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductVariantsParams,
        QueryConfig.listVariantConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/:id/variants",
    middlewares: [
      validateAndTransformBody(AdminCreateProductVariant),
      validateAndTransformQuery(
        AdminGetProductParams,
        QueryConfig.retrieveProductQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.product_variant,
        operation: PolicyOperation.create,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/:id/variants/batch",
    bodyParser: {
      sizeLimit: DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
    },
    middlewares: [
      validateAndTransformBody(
        createBatchBody(CreateProductVariant, AdminBatchUpdateProductVariant)
      ),
      validateAndTransformQuery(
        AdminGetProductVariantParams,
        QueryConfig.retrieveVariantConfig
      ),
    ],
    policies: [
      {
        resource: Entities.product_variant,
        operation: [
          PolicyOperation.create,
          PolicyOperation.update,
          PolicyOperation.delete,
        ],
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/:id/images/:image_id/variants/batch",
    bodyParser: {
      sizeLimit: DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
    },
    middlewares: [validateAndTransformBody(AdminBatchImageVariant)],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/:id/variants/:variant_id/images/batch",
    bodyParser: {
      sizeLimit: DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
    },
    middlewares: [validateAndTransformBody(AdminBatchVariantImages)],
  },
  // Note: New endpoint in v2
  {
    method: ["GET"],
    matcher: "/admin/products/:id/variants/:variant_id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductVariantParams,
        QueryConfig.retrieveVariantConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/:id/variants/:variant_id",
    middlewares: [
      validateAndTransformBody(AdminUpdateProductVariant),
      validateAndTransformQuery(
        AdminGetProductParams,
        QueryConfig.retrieveProductQueryConfig
      ),
    ],
  },
  {
    method: ["DELETE"],
    matcher: "/admin/products/:id/variants/:variant_id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductParams,
        QueryConfig.retrieveProductQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.product_variant,
        operation: PolicyOperation.delete,
      },
    ],
  },

  // Note: New endpoint in v2
  {
    method: ["GET"],
    matcher: "/admin/products/:id/options",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductOptionsParams,
        QueryConfig.listOptionConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/:id/options/batch",
    middlewares: [
      validateAndTransformBody(AdminLinkProductOptions),
      validateAndTransformQuery(
        AdminGetProductParams,
        QueryConfig.retrieveProductQueryConfig
      ),
    ],
    policies: [
      {
        resource: Entities.product_option,
        operation: [
          PolicyOperation.delete,
          PolicyOperation.create,
          PolicyOperation.update,
        ],
      },
    ],
  },

  // Variant inventory item endpoints
  {
    method: ["POST"],
    matcher: "/admin/products/:id/variants/inventory-items/batch",
    bodyParser: {
      sizeLimit: DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
    },
    middlewares: [
      validateAndTransformBody(
        createBatchBody(
          AdminBatchCreateVariantInventoryItem,
          AdminBatchUpdateVariantInventoryItem,
          AdminBatchDeleteVariantInventoryItem
        )
      ),
      validateAndTransformQuery(
        AdminGetProductVariantParams,
        QueryConfig.retrieveVariantConfig
      ),
    ],
    policies: [
      {
        resource: Entities.inventory_item,
        operation: [
          PolicyOperation.create,
          PolicyOperation.update,
          PolicyOperation.delete,
        ],
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/:id/variants/:variant_id/inventory-items",
    middlewares: [
      validateAndTransformBody(AdminCreateVariantInventoryItem),
      validateAndTransformQuery(
        AdminGetProductVariantParams,
        QueryConfig.retrieveVariantConfig
      ),
    ],
    policies: [
      {
        resource: Entities.inventory_item,
        operation: PolicyOperation.create,
      },
    ],
  },
  {
    method: ["POST"],
    matcher:
      "/admin/products/:id/variants/:variant_id/inventory-items/:inventory_item_id",
    middlewares: [
      validateAndTransformBody(AdminUpdateVariantInventoryItem),
      validateAndTransformQuery(
        AdminGetProductVariantParams,
        QueryConfig.retrieveVariantConfig
      ),
    ],
    policies: [
      {
        resource: Entities.inventory_item,
        operation: PolicyOperation.update,
      },
    ],
  },
  {
    method: ["DELETE"],
    matcher:
      "/admin/products/:id/variants/:variant_id/inventory-items/:inventory_item_id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductVariantParams,
        QueryConfig.retrieveVariantConfig
      ),
    ],
    policies: [
      {
        resource: Entities.inventory_item,
        operation: PolicyOperation.delete,
      },
    ],
  },
]
