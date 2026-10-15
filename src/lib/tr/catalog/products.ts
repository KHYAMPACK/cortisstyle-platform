import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicBoutiqueById, getPublicBoutiqueBySlug } from "@/lib/tr/boutiques";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import {
  getPublicCatalogSupabase,
  getServerServiceSupabase,
} from "@/lib/supabase/supabaseServer";
import { mapProductRow } from "@/lib/tr/mappers";
import {
  DETAIL_COLUMNS,
  DETAILS_PATCH_MISSING,
  detailRow,
  hasDetailValue,
  isEmptyDetail,
  withoutDetailColumns,
} from "@/lib/tr/catalog/productDetailColumns";
import { sanitizeProductFeatures } from "@/lib/tr/catalog/productFeatures";
import { sanitizeRichHtml } from "@/lib/tr/richTextSanitize";
import type {
  CreateTrProductInput,
  TrProduct,
  TrProductStatus,
  TrProductWithBoutique,
  UpdateTrProductInput,
} from "@/types/tr-marketplace";

const PRODUCT_COLUMNS_CORE =
  "id, boutique_id, title, description, price_kurus, compare_at_price_kurus, size, sizes, colors, condition_label, category, images, marketplace_images, storefront_images, lifestyle_images, catalog_background_id, status, stock, sort_order, created_at, updated_at";

const PRODUCT_COLUMNS_CORE_PRE_STOREFRONT =
  "id, boutique_id, title, description, price_kurus, compare_at_price_kurus, size, sizes, colors, condition_label, category, images, marketplace_images, lifestyle_images, catalog_background_id, status, stock, sort_order, created_at, updated_at";

/** Includes size_stocks + features when those migrations have been applied. */
const PUBLIC_PRODUCT_COLUMNS = `${PRODUCT_COLUMNS_CORE}, size_stocks, features`;

/**
 * Anon product RLS historically referenced `tr_boutiques` after anon SELECT was
 * revoked → empty catalogs. Prefer anon; if empty/error, retry service role
 * (bypasses RLS). Permanent fix: patch_tr_products_public_read_via_view.sql.
 */
function resolvePublicProductClients(
  client?: SupabaseClient,
): SupabaseClient[] {
  if (client) return [client];
  const clients: SupabaseClient[] = [];
  try {
    clients.push(getPublicCatalogSupabase());
  } catch {
    // fall through to service
  }
  const service = getServerServiceSupabase();
  if (service && !clients.includes(service)) {
    clients.push(service);
  }
  if (clients.length === 0) {
    throw new Error(
      "Supabase is not configured for public product reads.",
    );
  }
  return clients;
}

function isMissingColumnError(
  error: {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  },
  column?: string,
): boolean {
  const blob = [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const looksMissing =
    blob.includes("does not exist") ||
    blob.includes("schema cache") ||
    blob.includes("could not find") ||
    blob.includes("pgrst204");
  if (!looksMissing) return false;
  if (!column) return true;
  return blob.includes(column.toLowerCase());
}

function isMissingSizeStocksColumn(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): boolean {
  return isMissingColumnError(error, "size_stocks");
}

/** PostgREST: "Could not find the 'col' column of 'tr_products' in the schema cache" */
function missingColumnFromError(error: {
  message?: string;
}): string | null {
  const match = error.message?.match(
    /could not find the '([^']+)' column/i,
  );
  return match?.[1] ?? null;
}

function productInsertRow(
  input: CreateTrProductInput,
  omitColumns: ReadonlySet<string> = new Set(),
) {
  const row: Record<string, unknown> = {
    boutique_id: input.boutiqueId,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    price_kurus: input.priceKurus,
    compare_at_price_kurus: input.compareAtPriceKurus ?? null,
    size: input.size?.trim() ?? null,
    sizes: input.sizes ?? [],
    colors: input.colors ?? [],
    condition_label: input.conditionLabel?.trim() ?? null,
    category: input.category?.trim() ?? null,
    images: input.images ?? [],
    marketplace_images: input.marketplaceImages ?? [],
    storefront_images: input.storefrontImages ?? [],
    lifestyle_images: input.lifestyleImages ?? [],
    catalog_background_id: input.catalogBackgroundId?.trim() || null,
    features: sanitizeProductFeatures(input.features),
    status: input.status ?? "available",
    stock: input.stock ?? 1,
    size_stocks: input.sizeStocks ?? {},
    sort_order: input.sortOrder ?? 0,
    product_type: input.productType ?? "fashion",
    fulfillment_type: input.fulfillmentType ?? "physical",
  };
  // Only sent when there is something to store, so creating a garment product
  // never touches (or depends on) the SEO columns.
  if (input.slug) row.slug = input.slug;
  if (input.seo && Object.keys(input.seo).length > 0) row.seo = input.seo;
  // Only sent when set, so a database without patch_product_kinds.sql still takes products.
  if (input.kindId) row.kind_id = input.kindId;
  for (const [column, value] of Object.entries(detailRow(input))) {
    if (!isEmptyDetail(value)) row[column] = value;
  }
  for (const column of omitColumns) {
    delete row[column];
  }
  return row;
}

export async function listPublicProductsByBoutiqueSlug(
  boutiqueSlug: string,
  client?: SupabaseClient,
): Promise<TrProductWithBoutique[]> {
  const boutique = await getPublicBoutiqueBySlug(boutiqueSlug, client);
  if (!boutique) return [];

  return listPublicProductsByBoutiqueId(boutique.id, boutique, client);
}

const PRODUCT_SELECT_CANDIDATES: readonly string[] = [
  // product_type tells the shop which products sell by variant (quick-add, the cart);
  // brand (the maker) is short and shows on cards and the maker filter.
  `${PUBLIC_PRODUCT_COLUMNS}, product_type, brand`,
  `${PUBLIC_PRODUCT_COLUMNS}, product_type`,
  PUBLIC_PRODUCT_COLUMNS,
  `${PRODUCT_COLUMNS_CORE}, size_stocks`,
  PRODUCT_COLUMNS_CORE,
  `${PRODUCT_COLUMNS_CORE_PRE_STOREFRONT}, size_stocks, features`,
  `${PRODUCT_COLUMNS_CORE_PRE_STOREFRONT}, size_stocks`,
  PRODUCT_COLUMNS_CORE_PRE_STOREFRONT,
  // Minimal set if older prod DBs lack marketplace/lifestyle/catalog columns.
  "id, boutique_id, title, description, price_kurus, size, category, images, status, sort_order, created_at, updated_at",
];

async function queryProductsByBoutiqueId(
  supabase: SupabaseClient,
  boutiqueId: string,
  boutique: TrProductWithBoutique["boutique"],
): Promise<TrProductWithBoutique[]> {
  let lastError: { message?: string; code?: string } | null = null;

  for (const columns of PRODUCT_SELECT_CANDIDATES) {
    const { data, error } = await supabase
      .from("tr_products")
      .select(columns as typeof PUBLIC_PRODUCT_COLUMNS)
      .eq("boutique_id", boutiqueId)
      .in("status", ["available", "sold"])
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error) {
      return (data ?? []).map((row) => ({
        ...mapProductRow(row as unknown as Record<string, unknown>),
        boutique,
      }));
    }

    lastError = error;
    const missing = missingColumnFromError(error);
    if (missing || isMissingColumnError(error)) {
      continue;
    }
    throw error;
  }

  if (lastError) throw lastError;
  return [];
}

export async function listPublicProductsByBoutiqueId(
  boutiqueId: string,
  boutique: TrProductWithBoutique["boutique"],
  client?: SupabaseClient,
): Promise<TrProductWithBoutique[]> {
  const clients = resolvePublicProductClients(client);
  let lastError: unknown = null;

  for (let i = 0; i < clients.length; i += 1) {
    try {
      const rows = await queryProductsByBoutiqueId(
        clients[i]!,
        boutiqueId,
        boutique,
      );
      if (rows.length > 0 || i === clients.length - 1) {
        if (i > 0 && rows.length > 0) {
          console.warn(
            `Public products for boutique ${boutiqueId} required service-role fallback (anon RLS empty/broken). Apply supabase/patch_tr_products_public_read_via_view.sql`,
          );
        }
        return rows;
      }
      // Anon returned [] — try service before concluding catalog is empty.
    } catch (error) {
      lastError = error;
      if (i === clients.length - 1) throw error;
      console.error(
        `Public product read failed (client ${i}); retrying fallback:`,
        error,
      );
    }
  }

  if (lastError) throw lastError;
  return [];
}

/**
 * What the product page reads for one product, richest first: the type, the maker and
 * the rich description (one row, so the long text costs nothing). A database without a
 * column falls back to the next set.
 */
const PDP_COLUMN_CANDIDATES: readonly string[] = [
  `${PUBLIC_PRODUCT_COLUMNS}, product_type, brand, description_html`,
  `${PUBLIC_PRODUCT_COLUMNS}, product_type`,
  PUBLIC_PRODUCT_COLUMNS,
  PRODUCT_COLUMNS_CORE,
];

export async function getPublicProductById(
  productId: string,
  client?: SupabaseClient,
): Promise<TrProductWithBoutique | null> {
  const clients = resolvePublicProductClients(client);
  let lastError: unknown = null;

  for (let i = 0; i < clients.length; i += 1) {
    try {
      const supabase = clients[i]!;
      let result: { data: unknown; error: { message?: string; code?: string; details?: string; hint?: string } | null } | null = null;
      for (const columns of PDP_COLUMN_CANDIDATES) {
        const attempt = await supabase
          .from("tr_products")
          .select(columns as typeof PUBLIC_PRODUCT_COLUMNS)
          .eq("id", productId)
          .in("status", ["available", "sold"])
          .maybeSingle();
        result = attempt;
        if (!attempt.error) break;
        if (!(missingColumnFromError(attempt.error) || isMissingColumnError(attempt.error))) break;
      }
      if (!result) throw new Error("Product query did not run.");

      if (result.error) throw result.error;
      if (!result.data) {
        if (i === clients.length - 1) return null;
        continue;
      }

      const product = mapProductRow(
        result.data as unknown as Record<string, unknown>,
      );
      // Stored text was cleaned when it was saved; clean it again before it can be shown.
      if (product.descriptionHtml) {
        product.descriptionHtml = sanitizeRichHtml(product.descriptionHtml);
      }
      const boutique = await getPublicBoutiqueById(product.boutiqueId);
      if (!boutique) return null;

      return { ...product, boutique };
    } catch (error) {
      lastError = error;
      if (i === clients.length - 1) throw error;
    }
  }

  if (lastError) throw lastError;
  return null;
}

/** All available items from verified boutiques — for marketplace browse / outfit builder. */
export async function listPublicAvailableProducts(
  client?: SupabaseClient,
): Promise<TrProductWithBoutique[]> {
  const clients = resolvePublicProductClients(client);
  let lastError: unknown = null;

  for (let i = 0; i < clients.length; i += 1) {
    try {
      const supabase = clients[i]!;
      const primary = await supabase
        .from("tr_products")
        .select(PUBLIC_PRODUCT_COLUMNS)
        .eq("status", "available")
        .order("created_at", { ascending: false });

      const result =
        primary.error && isMissingSizeStocksColumn(primary.error)
          ? await supabase
              .from("tr_products")
              .select(PRODUCT_COLUMNS_CORE)
              .eq("status", "available")
              .order("created_at", { ascending: false })
          : primary;

      if (result.error) throw result.error;

      const products: TrProductWithBoutique[] = [];
      for (const row of result.data ?? []) {
        const product = mapProductRow(
          row as unknown as Record<string, unknown>,
        );
        const boutique = await getPublicBoutiqueById(product.boutiqueId);
        if (boutique) {
          products.push({ ...product, boutique });
        }
      }

      if (products.length > 0 || i === clients.length - 1) {
        if (i > 0 && products.length > 0) {
          console.warn(
            "listPublicAvailableProducts used service-role fallback — apply supabase/patch_tr_products_public_read_via_view.sql",
          );
        }
        return products;
      }
    } catch (error) {
      lastError = error;
      if (i === clients.length - 1) throw error;
    }
  }

  if (lastError) throw lastError;
  return [];
}

export async function listProductsByBoutiqueIdAdmin(
  boutiqueId: string,
): Promise<TrProduct[]> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("tr_products")
    .select("*")
    .eq("boutique_id", boutiqueId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapProductRow(row as Record<string, unknown>));
}

const PANEL_LIST_COLUMNS =
  "id, boutique_id, title, price_kurus, compare_at_price_kurus, sizes, category, images, marketplace_images, storefront_images, status, stock, size_stocks, sort_order, created_at, updated_at";

const PANEL_LIST_COLUMNS_LEGACY =
  "id, boutique_id, title, price_kurus, compare_at_price_kurus, sizes, category, images, marketplace_images, status, stock, size_stocks, sort_order, created_at, updated_at";

function firstUrl(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const url = value.find(
    (entry): entry is string =>
      typeof entry === "string" && Boolean(entry.trim()),
  );
  return url ? [url.trim()] : [];
}

/** Panel list/stock/campaigns — one cover URL per gallery, no description/features. */
export async function listOwnerProductsLiteAdmin(
  boutiqueId: string,
): Promise<TrProduct[]> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const withStorefront = await supabase
    .from("tr_products")
    .select(PANEL_LIST_COLUMNS)
    .eq("boutique_id", boutiqueId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  let data: unknown[] | null = withStorefront.data ?? null;
  if (withStorefront.error) {
    if (
      !isMissingColumnError(withStorefront.error, "storefront_images") &&
      missingColumnFromError(withStorefront.error) !== "storefront_images"
    ) {
      throw withStorefront.error;
    }
    const legacy = await supabase
      .from("tr_products")
      .select(PANEL_LIST_COLUMNS_LEGACY)
      .eq("boutique_id", boutiqueId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (legacy.error) throw legacy.error;
    data = legacy.data ?? [];
  }

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return mapProductRow({
      ...record,
      images: firstUrl(record.images),
      marketplace_images: firstUrl(record.marketplace_images),
      storefront_images: firstUrl(record.storefront_images),
      lifestyle_images: [],
      description: null,
      colors: [],
      features: {},
    });
  });
}

export type TrOwnerProductOriginals = {
  id: string;
  title: string;
  images: string[];
  marketplaceImages: string[];
};

function readUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string =>
      typeof entry === "string" && Boolean(entry.trim()),
  );
}

/** Full original galleries for the staff originals browser. */
export async function listOwnerProductOriginalsAdmin(
  boutiqueId: string,
): Promise<TrOwnerProductOriginals[]> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("tr_products")
    .select("id, title, images, marketplace_images")
    .eq("boutique_id", boutiqueId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id ?? ""),
      title: typeof record.title === "string" ? record.title : "",
      images: readUrlList(record.images),
      marketplaceImages: readUrlList(record.marketplace_images),
    };
  });
}

export async function listOwnerProductInventoryAdmin(boutiqueId: string): Promise<
  Array<{ status: TrProductStatus; stock: number }>
> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("tr_products")
    .select("status, stock")
    .eq("boutique_id", boutiqueId);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    status: row.status as TrProductStatus,
    stock: typeof row.stock === "number" ? row.stock : 0,
  }));
}

export async function createProductAdmin(
  input: CreateTrProductInput,
): Promise<TrProduct> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const omitColumns = new Set<string>();
  // Optional columns that older DBs may not have yet.
  const optionalRetryBudget = 6;

  for (let attempt = 0; attempt < optionalRetryBudget; attempt += 1) {
    const { data, error } = await supabase
      .from("tr_products")
      .insert(productInsertRow(input, omitColumns))
      .select("*")
      .single();

    if (!error) {
      return mapProductRow(data as Record<string, unknown>);
    }

    const missing = missingColumnFromError(error);
    if (missing && DETAIL_COLUMNS.has(missing) && isMissingColumnError(error, missing)) {
      throw new Error(DETAILS_PATCH_MISSING);
    }
    if (missing && isMissingColumnError(error, missing)) {
      console.warn(
        `[tr/products] column '${missing}' missing — saving without it. Apply matching supabase/patch_*.sql when ready.`,
      );
      omitColumns.add(missing);
      continue;
    }

    throw error;
  }

  throw new Error("Ürün oluşturulamadı (şema uyumsuzluğu).");
}

export async function getProductByIdAdmin(
  productId: string,
): Promise<TrProduct | null> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("tr_products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapProductRow(data as Record<string, unknown>);
}

export async function listProductsByIdsAdmin(
  productIds: string[],
): Promise<TrProduct[]> {
  const unique = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("tr_products")
    .select("*")
    .in("id", unique);

  if (error) throw error;
  return (data ?? []).map((row) => mapProductRow(row as Record<string, unknown>));
}

function productUpdateRow(input: UpdateTrProductInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (input.title !== undefined) row.title = input.title.trim();
  if (input.description !== undefined) {
    row.description = input.description?.trim() ?? null;
  }
  if (input.priceKurus !== undefined) row.price_kurus = input.priceKurus;
  if (input.compareAtPriceKurus !== undefined) {
    row.compare_at_price_kurus = input.compareAtPriceKurus;
  }
  if (input.size !== undefined) row.size = input.size?.trim() ?? null;
  if (input.sizes !== undefined) row.sizes = input.sizes;
  if (input.colors !== undefined) row.colors = input.colors;
  if (input.conditionLabel !== undefined) {
    row.condition_label = input.conditionLabel?.trim() ?? null;
  }
  if (input.category !== undefined) {
    row.category = input.category?.trim() ?? null;
  }
  if (input.images !== undefined) row.images = input.images;
  if (input.marketplaceImages !== undefined) {
    row.marketplace_images = input.marketplaceImages;
  }
  if (input.storefrontImages !== undefined) {
    row.storefront_images = input.storefrontImages;
  }
  if (input.lifestyleImages !== undefined) {
    row.lifestyle_images = input.lifestyleImages;
  }
  if (input.catalogBackgroundId !== undefined) {
    row.catalog_background_id = input.catalogBackgroundId?.trim() || null;
  }
  if (input.features !== undefined) {
    row.features = sanitizeProductFeatures(input.features);
  }
  if (input.status !== undefined) row.status = input.status;
  if (input.stock !== undefined) row.stock = input.stock;
  if (input.sizeStocks !== undefined) row.size_stocks = input.sizeStocks;
  if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
  if (input.fulfillmentType !== undefined) {
    row.fulfillment_type = input.fulfillmentType;
  }
  if (input.seo !== undefined) row.seo = input.seo;
  if (input.kindId !== undefined) row.kind_id = input.kindId;
  Object.assign(row, detailRow(input));

  return row;
}

export async function updateProductAdmin(
  productId: string,
  input: UpdateTrProductInput,
): Promise<TrProduct> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const row = productUpdateRow(input);

  // Restocking a sold-out product should make it buyable again.
  if (
    input.status === undefined &&
    (input.stock !== undefined || input.sizeStocks !== undefined)
  ) {
    const existing = await getProductByIdAdmin(productId);
    if (!existing) throw new Error("Product not found.");
    const nextStock =
      input.stock !== undefined
        ? input.stock
        : input.sizeStocks !== undefined
          ? Object.values(input.sizeStocks).reduce((sum, n) => sum + n, 0)
          : existing.stock;
    if (nextStock > 0 && existing.status === "sold") {
      row.status = "available";
    }
    if (nextStock <= 0 && existing.status === "available") {
      row.status = "sold";
    }
  }

  if (Object.keys(row).length === 0) {
    const existing = await getProductByIdAdmin(productId);
    if (!existing) throw new Error("Product not found.");
    return existing;
  }

  const { data, error } = await supabase
    .from("tr_products")
    .update(row)
    .eq("id", productId)
    .select("*")
    .single();

  if (error) {
    const missing = missingColumnFromError(error);
    if (missing && DETAIL_COLUMNS.has(missing) && isMissingColumnError(error, missing)) {
      // Nothing to store in them: save the rest. A real value would be lost, so say so.
      if (hasDetailValue(row)) throw new Error(DETAILS_PATCH_MISSING);
      const rest = withoutDetailColumns(row);
      if (Object.keys(rest).length === 0) return (await getProductByIdAdmin(productId))!;
      const retry = await supabase
        .from("tr_products")
        .update(rest)
        .eq("id", productId)
        .select("*")
        .single();
      if (retry.error) throw retry.error;
      return mapProductRow(retry.data as Record<string, unknown>);
    }
    if (missing && missing in row && isMissingColumnError(error, missing)) {
      console.warn(
        `[tr/products] column '${missing}' missing on update — applying without it.`,
      );
      const { [missing]: _omit, ...rest } = row;
      const retry = await supabase
        .from("tr_products")
        .update(rest)
        .eq("id", productId)
        .select("*")
        .single();
      if (retry.error) throw retry.error;
      return mapProductRow(retry.data as Record<string, unknown>);
    }
    throw error;
  }

  return mapProductRow(data as Record<string, unknown>);
}

function isForeignKeyViolation(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  if (error.code === "23503") return true;
  const blob = [error.message, error.details].filter(Boolean).join(" ").toLowerCase();
  return (
    blob.includes("foreign key") ||
    blob.includes("violates foreign key") ||
    blob.includes("tr_order_items")
  );
}

export type DeleteProductResult = {
  /** Hard-removed from DB. */
  mode: "deleted" | "hidden";
};

/**
 * Remove a product from the catalog.
 * - Prefer hard delete (order lines detach when SQL patch is applied).
 * - If past orders still block the FK, hide the product so the storefront is clear.
 */
export async function deleteProductAdmin(
  productId: string,
): Promise<DeleteProductResult> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  // Best-effort detach when product_id is nullable (patch_tr_order_items_product_on_delete.sql).
  const { error: detachError } = await supabase
    .from("tr_order_items")
    .update({ product_id: null })
    .eq("product_id", productId);
  if (detachError) {
    // Expected before the SQL patch (NOT NULL / FK). Hard delete or soft-hide handles next.
  }

  const { error: deleteError } = await supabase
    .from("tr_products")
    .delete()
    .eq("id", productId);

  if (!deleteError) {
    return { mode: "deleted" };
  }

  if (!isForeignKeyViolation(deleteError)) {
    throw deleteError;
  }

  const { error: hideError } = await supabase
    .from("tr_products")
    .update({ status: "hidden", stock: 0 })
    .eq("id", productId);

  if (hideError) throw hideError;

  return { mode: "hidden" };
}

export async function duplicateProductAdmin(
  productId: string,
): Promise<TrProduct> {
  const existing = await getProductByIdAdmin(productId);
  if (!existing) throw new Error("Product not found.");

  return createProductAdmin({
    boutiqueId: existing.boutiqueId,
    title: `${existing.title} (kopya)`,
    description: existing.description,
    priceKurus: existing.priceKurus,
    compareAtPriceKurus: existing.compareAtPriceKurus,
    size: existing.size,
    sizes: existing.sizes,
    colors: existing.colors,
    conditionLabel: existing.conditionLabel,
    category: existing.category,
    images: existing.images,
    marketplaceImages: existing.marketplaceImages,
    storefrontImages: existing.storefrontImages,
    lifestyleImages: existing.lifestyleImages,
    catalogBackgroundId: existing.catalogBackgroundId,
    features: existing.features,
    status: "hidden",
    stock: existing.stock,
    sizeStocks: existing.sizeStocks,
    sortOrder: existing.sortOrder,
    productType: existing.productType,
    fulfillmentType: existing.fulfillmentType,
    kindId: existing.kindId ?? null,
    // Copies keep the descriptive details; SKU and barcode identify one product, so
    // they stay empty.
    descriptionHtml: existing.descriptionHtml,
    brand: existing.brand,
    tags: existing.tags,
    googleCategory: existing.googleCategory,
    desi: existing.desi,
    continueSelling: existing.continueSelling,
    unitPrice: existing.unitPrice,
  });
}

export async function updateProductStatusAdmin(
  productId: string,
  status: TrProductStatus,
): Promise<TrProduct> {
  return updateProductAdmin(productId, { status });
}

export async function markProductsSoldAdmin(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;

  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { error } = await supabase
    .from("tr_products")
    .update({ status: "sold" })
    .in("id", productIds)
    .eq("status", "available");

  if (error) throw error;
}
