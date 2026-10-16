import { getSupabaseClient } from "@/lib/supabaseClient";
import type { SizeRenameOffer } from "@/lib/tr/variants/sizeRenames";
import { prepareOwnerUploadFile } from "@/lib/tr/prepareOwnerUploadFile";
import type { TrOwnerProductOriginals } from "@/lib/tr/catalog/products";
import {
  cachedOwnerFetch,
  invalidateOwnerCache,
  ownerCacheKeys,
  peekOwnerCache,
} from "@/lib/tr/panel/ownerCache";
import type { TrOwnerDashboard } from "@/lib/tr/panel/dashboardMetrics";
import type { TrDashboardRangeId } from "@/lib/tr/panel/dashboardRange";
import {
  wrapShipmentLabelHtml,
  wrapShipmentLabelsHtml,
} from "@/lib/tr/shipping/labelHtml";
import type { TrSeo } from "@/lib/tr/seo/seoFields";
import type { TrCategorySortCriterion } from "@/lib/tr/categories/sortCriteria";
import type {
  TrCategory,
  TrCategoryListEntry,
  TrProductCategories,
} from "@/lib/tr/categories/types";
import type { TrBoutiqueTracking } from "@/lib/tr/tracking/config";
import type { IyzicoStatus } from "@/lib/tr/payments/iyzicoKeys";
import type {
  TrDiscountCampaign,
  TrDiscountCampaignCode,
} from "@/lib/tr/discounts/types";
import {
  EMPTY_PRODUCT_VARIANTS,
  type TrProductVariant,
  type TrProductVariants,
  type TrVariantTypeImportOffer,
  type TrVariantType,
  type TrVariantTypeListEntry,
} from "@/lib/tr/variants/types";
import type {
  TrAttributeDefinition,
  TrAttributeListEntry,
  TrProductKind,
  TrProductKindListEntry,
} from "@/lib/tr/productKinds/types";
import type { ManualOrderDraft } from "@/lib/tr/orders/manualOrder";
import type { TrOrderDraft } from "@/lib/tr/orders/orderDraft";
import type { TrShippingRate } from "@/lib/tr/shipping/types";
import {
  EMPTY_PRODUCT_PRIVATE,
  type TrBoutiqueCustomer,
  type TrBoutiqueCustomerAddress,
  type TrInvoice,
  type TrInvoiceStatus,
  type TrOrderWithItems,
  type TrProduct,
  type TrProductColor,
  type TrFulfillmentType,
  type TrProductFeatures,
  type TrProductPrivate,
  type TrProductStatus,
  type TrProductType,
  type TrUnitPrice,
} from "@/types/tr-marketplace";
import type { TrProductFacets } from "@/lib/tr/catalog/productFacets";

export interface TrOwnerBoutiqueSummary {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  themeAccent?: string | null;
  status?: string;
  catalogProfile?: "fashion" | "custom_art";
  /** Address shown on the storefront (Ayarlar → Adres). */
  physicalAddress?: string | null;
  shippingAddress?: string | null;
  /** Own domain, when connected (`tr_boutiques.custom_domain`). */
  customDomain?: string | null;
  offersIyzicoCheckout?: boolean;
}

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();
  return session?.access_token ?? null;
}

async function ownerFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Oturum gerekli.");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(path, { ...init, headers });
}

async function parseOwnerJson(response: Response): Promise<unknown> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
    throw new Error(
      response.status === 404
        ? "Panel API bulunamadı. Sayfayı yenileyin; devam ederse dev sunucusunu yeniden başlatın."
        : `Beklenmeyen sunucu yanıtı (${response.status}).`,
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Beklenmeyen sunucu yanıtı (${response.status}).`);
  }
}

function invalidateProductLists(): void {
  invalidateOwnerCache("products:");
  // Each product's kind (the Ürünler list's Tür column) and the kinds' product counts.
  invalidateOwnerCache("product-kinds:");
  invalidateOwnerCache("categories:");
  invalidateOwnerCache("product-facets:");
  invalidateOwnerCache("product-originals:");
  invalidateOwnerCache("product-variants:");
  invalidateOwnerCache("summary:");
  invalidateOwnerCache("dashboard:");
}

function invalidateOrderLists(): void {
  invalidateOwnerCache("orders:");
  invalidateOwnerCache("summary:");
  invalidateOwnerCache("dashboard:");
  // Placing an order can create the customer.
  invalidateOwnerCache("customers:");
}

export async function fetchOwnerBoutiques(): Promise<{
  boutiques: TrOwnerBoutiqueSummary[];
  isStaff: boolean;
}> {
  return cachedOwnerFetch(ownerCacheKeys.boutiques, async () => {
    const response = await ownerFetch("/api/tr/owner/boutiques");
    const data = (await parseOwnerJson(response)) as {
      boutiques?: TrOwnerBoutiqueSummary[];
      isStaff?: boolean;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Butikler yüklenemedi.");
    }
    return {
      boutiques: data.boutiques ?? [],
      isStaff: Boolean(data.isStaff),
    };
  });
}

export function peekOwnerProducts(boutiqueId: string):
  | { boutique: TrOwnerBoutiqueSummary; products: TrProduct[] }
  | undefined {
  return peekOwnerCache(ownerCacheKeys.products(boutiqueId));
}

export function peekOwnerOrders(
  boutiqueId: string,
): TrOrderWithItems[] | undefined {
  return peekOwnerCache(ownerCacheKeys.orders(boutiqueId));
}

export function peekOwnerSummary(
  boutiqueId: string,
  range: "today" | "7d" | "30d" | "all" = "today",
): TrOwnerSummaryResponse | undefined {
  return peekOwnerCache(ownerCacheKeys.summary(boutiqueId, range));
}

export function peekOwnerCustomers(
  boutiqueId: string,
): TrBoutiqueCustomer[] | undefined {
  return peekOwnerCache(ownerCacheKeys.customers(boutiqueId));
}

export function prefetchOwnerProducts(boutiqueId: string): void {
  void fetchOwnerProducts(boutiqueId);
}

export function prefetchOwnerOrders(boutiqueId: string): void {
  void fetchOwnerOrders(boutiqueId);
}

export async function fetchOwnerProducts(boutiqueId: string): Promise<{
  boutique: TrOwnerBoutiqueSummary;
  products: TrProduct[];
}> {
  return cachedOwnerFetch(ownerCacheKeys.products(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/products?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = (await parseOwnerJson(response)) as {
      boutique?: TrOwnerBoutiqueSummary;
      products?: TrProduct[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Ürünler yüklenemedi.");
    }
    if (!data.boutique) {
      throw new Error("Butik bulunamadı.");
    }
    return { boutique: data.boutique, products: data.products ?? [] };
  });
}

export type { TrOwnerProductOriginals };

export async function fetchOwnerProductOriginals(
  boutiqueId: string,
): Promise<TrOwnerProductOriginals[]> {
  return cachedOwnerFetch(
    ownerCacheKeys.productOriginals(boutiqueId),
    async () => {
      const response = await ownerFetch(
        `/api/tr/owner/products/originals?boutiqueId=${encodeURIComponent(boutiqueId)}`,
      );
      if (response.status === 404) {
        return [];
      }
      const data = (await parseOwnerJson(response)) as {
        products?: TrOwnerProductOriginals[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Orijinal fotoğraflar yüklenemedi.");
      }
      return data.products ?? [];
    },
  );
}

export async function fetchOwnerProduct(productId: string): Promise<{
  product: TrProduct;
  boutique: TrOwnerBoutiqueSummary;
  /** Owner-only data (cost price). */
  ownerOnly: TrProductPrivate;
  /** The product's categories (a boutique in `custom` category mode). */
  categories: TrProductCategories;
  /** A Gelişmiş product's option types and variants (empty for every other product). */
  variants: TrProductVariants;
}> {
  const response = await ownerFetch(
    `/api/tr/owner/products/${encodeURIComponent(productId)}`,
  );
  const data = (await parseOwnerJson(response)) as {
    product?: TrProduct;
    boutique?: TrOwnerBoutiqueSummary;
    private?: TrProductPrivate;
    categories?: TrProductCategories;
    variants?: TrProductVariants;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Ürün yüklenemedi.");
  }
  if (!data.product || !data.boutique) {
    throw new Error("Ürün bulunamadı.");
  }
  return {
    product: data.product,
    boutique: data.boutique,
    ownerOnly: data.private ?? EMPTY_PRODUCT_PRIVATE,
    categories: data.categories ?? { ids: [], primaryId: null },
    variants: data.variants ?? EMPTY_PRODUCT_VARIANTS,
  };
}

export interface TrOwnerProductPayload {
  boutiqueId: string;
  title: string;
  description?: string | null;
  priceTry: number;
  compareAtPriceTry?: number | null;
  sizes: string[];
  colors: TrProductColor[];
  category: string | null;
  images: string[];
  marketplaceImages?: string[];
  lifestyleImages?: string[];
  catalogBackgroundId?: string | null;
  features?: TrProductFeatures;
  stock?: number;
  sizeStocks?: Record<string, number>;
  conditionLabel?: string | null;
  status?: TrProductStatus;
  /** `simple` or `advanced` (variants); omitted = `fashion`, kept only for old products. */
  productType?: TrProductType;
  /** The product's kind (Ürün türü); `null` clears it. */
  kindId?: string | null;
  fulfillmentType?: TrFulfillmentType;
  /** Owner-only. `null` clears it. */
  costPriceTry?: number | string | null;
  /** URL slug; on create, omitted = the server derives one from the title (Basit ürün). */
  slug?: string | null;
  seo?: TrSeo;
  /** The product's categories (all it is filed under, and the primary one). */
  categories?: TrProductCategories;
  /** Rich-text description (HTML); the server sanitizes it and derives `description`. */
  descriptionHtml?: string | null;
  brand?: string | null;
  tags?: string[];
  googleCategory?: string | null;
  sku?: string | null;
  barcode?: string | null;
  desi?: number | null;
  continueSelling?: boolean;
  unitPrice?: TrUnitPrice;
  /** Owner-only, like `costPriceTry`. */
  supplier?: string | null;
  hsCode?: string | null;
  /** Gelişmiş ürün: the option types and variant rows (`variantsBody`). */
  variants?: Record<string, unknown> | null;
}

/** What an owner can set on a category. */
export interface TrOwnerCategoryInput {
  name?: string;
  parentId?: string | null;
  slug?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  sortCriterion?: TrCategorySortCriterion | null;
  seo?: TrSeo;
}

function invalidateCategories(): void {
  invalidateOwnerCache("categories:");
  invalidateProductLists();
}

async function readApiResponse<T>(
  response: Response,
  fallbackError: string,
): Promise<T> {
  const data = (await parseOwnerJson(response)) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? fallbackError);
  }
  return data;
}

export async function fetchOwnerCategories(boutiqueId: string): Promise<{
  categories: TrCategoryListEntry[];
  /** The fashion starter tree can be added ("Hazır kategorileri içe aktar"). */
  importable: boolean;
}> {
  return cachedOwnerFetch(ownerCacheKeys.categories(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/categories?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = await readApiResponse<{
      categories?: TrCategoryListEntry[];
      importable?: boolean;
    }>(response, "Kategoriler yüklenemedi.");
    return {
      categories: data.categories ?? [],
      importable: data.importable === true,
    };
  });
}

/** "Hazır kategorileri içe aktar": copies the built-in tree into the boutique's categories. */
export async function importOwnerCategoryTemplate(
  boutiqueId: string,
): Promise<{ created: number; assigned: number }> {
  const response = await ownerFetch("/api/tr/owner/categories/import", {
    method: "POST",
    body: JSON.stringify({ boutiqueId }),
  });
  const data = await readApiResponse<{ created?: number; assigned?: number }>(
    response,
    "Hazır kategoriler aktarılamadı.",
  );
  invalidateOwnerCache(ownerCacheKeys.categories(boutiqueId));
  return { created: data.created ?? 0, assigned: data.assigned ?? 0 };
}

/** Brands, tags and suppliers the boutique already uses (suggestions for the creatable fields). */
export async function fetchOwnerProductFacets(
  boutiqueId: string,
): Promise<TrProductFacets> {
  return cachedOwnerFetch(ownerCacheKeys.productFacets(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/products/facets?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = await readApiResponse<Partial<TrProductFacets>>(
      response,
      "Öneriler yüklenemedi.",
    );
    return {
      brands: data.brands ?? [],
      tags: data.tags ?? [],
      suppliers: data.suppliers ?? [],
    };
  });
}

export async function fetchOwnerCategory(categoryId: string): Promise<TrCategory> {
  const response = await ownerFetch(
    `/api/tr/owner/categories/${encodeURIComponent(categoryId)}`,
  );
  const data = await readApiResponse<{ category?: TrCategory }>(
    response,
    "Kategori yüklenemedi.",
  );
  if (!data.category) throw new Error("Kategori bulunamadı.");
  return data.category;
}

export async function createOwnerCategory(
  boutiqueId: string,
  input: TrOwnerCategoryInput,
): Promise<TrCategory> {
  const response = await ownerFetch("/api/tr/owner/categories", {
    method: "POST",
    body: JSON.stringify({ boutiqueId, ...input }),
  });
  const data = await readApiResponse<{ category?: TrCategory }>(
    response,
    "Kategori oluşturulamadı.",
  );
  if (!data.category) throw new Error("Kategori oluşturulamadı.");
  invalidateCategories();
  return data.category;
}

export async function updateOwnerCategory(
  categoryId: string,
  input: TrOwnerCategoryInput,
): Promise<TrCategory> {
  const response = await ownerFetch(
    `/api/tr/owner/categories/${encodeURIComponent(categoryId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  const data = await readApiResponse<{ category?: TrCategory }>(
    response,
    "Kategori güncellenemedi.",
  );
  if (!data.category) throw new Error("Kategori güncellenemedi.");
  invalidateCategories();
  return data.category;
}

export async function deleteOwnerCategory(categoryId: string): Promise<void> {
  const response = await ownerFetch(
    `/api/tr/owner/categories/${encodeURIComponent(categoryId)}`,
    { method: "DELETE" },
  );
  await readApiResponse<{ ok?: boolean }>(response, "Kategori silinemedi.");
  invalidateCategories();
}

function invalidateDiscountCampaigns(): void {
  invalidateOwnerCache("discount-campaigns:");
}

/** The boutique's discount campaigns (automatic and code), newest first. */
export async function fetchOwnerDiscountCampaigns(
  boutiqueId: string,
): Promise<TrDiscountCampaign[]> {
  return cachedOwnerFetch(ownerCacheKeys.discountCampaigns(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/discount-campaigns?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = await readApiResponse<{ campaigns?: TrDiscountCampaign[] }>(
      response,
      "Kampanyalar yüklenemedi.",
    );
    return data.campaigns ?? [];
  });
}

export async function fetchOwnerDiscountCampaign(
  campaignId: string,
): Promise<TrDiscountCampaign> {
  const response = await ownerFetch(
    `/api/tr/owner/discount-campaigns/${encodeURIComponent(campaignId)}`,
  );
  const data = await readApiResponse<{ campaign?: TrDiscountCampaign }>(
    response,
    "Kampanya yüklenemedi.",
  );
  if (!data.campaign) throw new Error("Kampanya bulunamadı.");
  return data.campaign;
}

export async function createOwnerDiscountCampaign(
  boutiqueId: string,
  body: Record<string, unknown>,
): Promise<TrDiscountCampaign> {
  const response = await ownerFetch("/api/tr/owner/discount-campaigns", {
    method: "POST",
    body: JSON.stringify({ boutiqueId, ...body }),
  });
  const data = await readApiResponse<{ campaign?: TrDiscountCampaign }>(
    response,
    "Kampanya oluşturulamadı.",
  );
  if (!data.campaign) throw new Error("Kampanya oluşturulamadı.");
  invalidateDiscountCampaigns();
  return data.campaign;
}

export async function updateOwnerDiscountCampaign(
  campaignId: string,
  body: Record<string, unknown>,
): Promise<TrDiscountCampaign> {
  const response = await ownerFetch(
    `/api/tr/owner/discount-campaigns/${encodeURIComponent(campaignId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  const data = await readApiResponse<{ campaign?: TrDiscountCampaign }>(
    response,
    "Kampanya güncellenemedi.",
  );
  if (!data.campaign) throw new Error("Kampanya güncellenemedi.");
  invalidateDiscountCampaigns();
  return data.campaign;
}

export async function deleteOwnerDiscountCampaign(campaignId: string): Promise<void> {
  const response = await ownerFetch(
    `/api/tr/owner/discount-campaigns/${encodeURIComponent(campaignId)}`,
    { method: "DELETE" },
  );
  await readApiResponse<{ ok?: boolean }>(response, "Kampanya silinemedi.");
  invalidateDiscountCampaigns();
}

/** A `kind: 'code'` campaign's Kuponlar tab: its codes, oldest first. */
export async function fetchOwnerCampaignCodes(
  campaignId: string,
): Promise<TrDiscountCampaignCode[]> {
  const response = await ownerFetch(
    `/api/tr/owner/discount-campaigns/${encodeURIComponent(campaignId)}/codes`,
  );
  const data = await readApiResponse<{ codes?: TrDiscountCampaignCode[] }>(
    response,
    "Kuponlar yüklenemedi.",
  );
  return data.codes ?? [];
}

/** "Özel Kupon": one code. `body` is `readCustomCodeBody`'s shape plus `mode: 'custom'`. */
export async function addOwnerCampaignCode(
  campaignId: string,
  body: Record<string, unknown>,
): Promise<TrDiscountCampaignCode> {
  const response = await ownerFetch(
    `/api/tr/owner/discount-campaigns/${encodeURIComponent(campaignId)}/codes`,
    { method: "POST", body: JSON.stringify({ mode: "custom", ...body }) },
  );
  const data = await readApiResponse<{ code?: TrDiscountCampaignCode }>(
    response,
    "Kupon oluşturulamadı.",
  );
  if (!data.code) throw new Error("Kupon oluşturulamadı.");
  return data.code;
}

/** "Otomatik Kod Üret": a prefixed batch. `body` is `readGenerateCodesBody`'s shape. */
export async function generateOwnerCampaignCodes(
  campaignId: string,
  body: Record<string, unknown>,
): Promise<TrDiscountCampaignCode[]> {
  const response = await ownerFetch(
    `/api/tr/owner/discount-campaigns/${encodeURIComponent(campaignId)}/codes`,
    { method: "POST", body: JSON.stringify({ mode: "generate", ...body }) },
  );
  const data = await readApiResponse<{ codes?: TrDiscountCampaignCode[] }>(
    response,
    "Kupon kodları oluşturulamadı.",
  );
  return data.codes ?? [];
}

export async function deleteOwnerCampaignCode(
  campaignId: string,
  codeId: string,
): Promise<void> {
  const response = await ownerFetch(
    `/api/tr/owner/discount-campaigns/${encodeURIComponent(campaignId)}/codes/${encodeURIComponent(codeId)}`,
    { method: "DELETE" },
  );
  await readApiResponse<{ ok?: boolean }>(response, "Kupon silinemedi.");
}

/** The boutique's variant types, and the built-in size types it could still import. */
export async function fetchOwnerVariantTypes(boutiqueId: string): Promise<{
  types: TrVariantTypeListEntry[];
  importable: TrVariantTypeImportOffer;
}> {
  return cachedOwnerFetch(ownerCacheKeys.variantTypes(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/variant-types?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = await readApiResponse<{
      types?: TrVariantTypeListEntry[];
      importable?: TrVariantTypeImportOffer;
    }>(response, "Varyant türleri yüklenemedi.");
    return {
      types: data.types ?? [],
      importable: { sizeTypes: data.importable?.sizeTypes ?? [] },
    };
  });
}

export async function createOwnerVariantType(
  boutiqueId: string,
  body: Record<string, unknown>,
): Promise<TrVariantType> {
  const response = await ownerFetch("/api/tr/owner/variant-types", {
    method: "POST",
    body: JSON.stringify({ boutiqueId, ...body }),
  });
  const data = await readApiResponse<{ type?: TrVariantType }>(
    response,
    "Varyant türü oluşturulamadı.",
  );
  if (!data.type) throw new Error("Varyant türü oluşturulamadı.");
  invalidateOwnerCache("variant-types:");
  return data.type;
}

/**
 * Saves a type. `sizeRenames` lists renamed sizes of a Beden type that products still
 * carry, for the "update the products too?" offer.
 */
export async function updateOwnerVariantType(
  typeId: string,
  body: Record<string, unknown>,
): Promise<{ type: TrVariantType; sizeRenames: SizeRenameOffer[] }> {
  const response = await ownerFetch(
    `/api/tr/owner/variant-types/${encodeURIComponent(typeId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  const data = await readApiResponse<{
    type?: TrVariantType;
    sizeRenames?: SizeRenameOffer[];
  }>(response, "Varyant türü güncellenemedi.");
  if (!data.type) throw new Error("Varyant türü güncellenemedi.");
  invalidateOwnerCache("variant-types:");
  return { type: data.type, sizeRenames: data.sizeRenames ?? [] };
}

/** Renames sizes on the boutique's products after they were renamed in a Beden type. */
export async function renameOwnerProductSizes(
  typeId: string,
  renames: ReadonlyArray<{ from: string; to: string }>,
): Promise<number> {
  const response = await ownerFetch(
    `/api/tr/owner/variant-types/${encodeURIComponent(typeId)}/rename-sizes`,
    { method: "POST", body: JSON.stringify({ renames }) },
  );
  const data = await readApiResponse<{ updated?: number }>(
    response,
    "Ürünlerdeki bedenler güncellenemedi.",
  );
  invalidateProductLists();
  return data.updated ?? 0;
}

export async function deleteOwnerVariantType(typeId: string): Promise<void> {
  const response = await ownerFetch(
    `/api/tr/owner/variant-types/${encodeURIComponent(typeId)}`,
    { method: "DELETE" },
  );
  await readApiResponse<{ ok?: boolean }>(response, "Varyant türü silinemedi.");
  invalidateOwnerCache("variant-types:");
}

/** "Hazır bedenleri içe aktar": creates the built-in size types (Beden, Pantolon bedeni). */
export async function importOwnerSizeTypes(
  boutiqueId: string,
): Promise<TrVariantType[]> {
  const response = await ownerFetch("/api/tr/owner/variant-types/import", {
    method: "POST",
    body: JSON.stringify({ boutiqueId }),
  });
  const data = await readApiResponse<{ types?: TrVariantType[] }>(
    response,
    "İçe aktarılamadı.",
  );
  invalidateOwnerCache("variant-types:");
  return data.types ?? [];
}

/**
 * The boutique's product kinds, each product's kind (`null` = none), and whether the
 * starter kinds can be imported.
 */
export async function fetchOwnerProductKinds(boutiqueId: string): Promise<{
  kinds: TrProductKindListEntry[];
  productKinds: Record<string, string | null>;
  importable: boolean;
}> {
  return cachedOwnerFetch(ownerCacheKeys.productKinds(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/product-kinds?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = await readApiResponse<{
      kinds?: TrProductKindListEntry[];
      productKinds?: Record<string, string | null>;
      importable?: boolean;
    }>(response, "Ürün türleri yüklenemedi.");
    return {
      kinds: data.kinds ?? [],
      productKinds: data.productKinds ?? {},
      importable: data.importable === true,
    };
  });
}

function invalidateProductKinds(): void {
  invalidateOwnerCache("product-kinds:");
  invalidateOwnerCache("attributes:");
}

export async function createOwnerProductKind(
  boutiqueId: string,
  body: Record<string, unknown>,
): Promise<TrProductKind> {
  const response = await ownerFetch("/api/tr/owner/product-kinds", {
    method: "POST",
    body: JSON.stringify({ boutiqueId, ...body }),
  });
  const data = await readApiResponse<{ kind?: TrProductKind }>(
    response,
    "Ürün türü oluşturulamadı.",
  );
  if (!data.kind) throw new Error("Ürün türü oluşturulamadı.");
  invalidateProductKinds();
  return data.kind;
}

export async function updateOwnerProductKind(
  kindId: string,
  body: Record<string, unknown>,
): Promise<TrProductKind> {
  const response = await ownerFetch(
    `/api/tr/owner/product-kinds/${encodeURIComponent(kindId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  const data = await readApiResponse<{ kind?: TrProductKind }>(
    response,
    "Ürün türü güncellenemedi.",
  );
  if (!data.kind) throw new Error("Ürün türü güncellenemedi.");
  invalidateProductKinds();
  return data.kind;
}

export async function deleteOwnerProductKind(kindId: string): Promise<void> {
  const response = await ownerFetch(
    `/api/tr/owner/product-kinds/${encodeURIComponent(kindId)}`,
    { method: "DELETE" },
  );
  await readApiResponse<{ ok?: boolean }>(response, "Ürün türü silinemedi.");
  invalidateProductKinds();
}

/** "Hazır türleri içe aktar": the starter kinds and fields, and products filed under them. */
export async function importOwnerProductKinds(
  boutiqueId: string,
): Promise<{ kinds: number; attributes: number; assigned: number }> {
  const response = await ownerFetch("/api/tr/owner/product-kinds/import", {
    method: "POST",
    body: JSON.stringify({ boutiqueId }),
  });
  const data = await readApiResponse<{ kinds?: number; attributes?: number; assigned?: number }>(
    response,
    "Hazır türler aktarılamadı.",
  );
  invalidateProductKinds();
  return { kinds: data.kinds ?? 0, attributes: data.attributes ?? 0, assigned: data.assigned ?? 0 };
}

/** Bulk: set (or clear, with `null`) the kind of some products. */
export async function assignOwnerProductKind(
  boutiqueId: string,
  kindId: string | null,
  productIds: string[],
): Promise<void> {
  const response = await ownerFetch("/api/tr/owner/product-kinds/assign", {
    method: "POST",
    body: JSON.stringify({ boutiqueId, kindId, productIds }),
  });
  await readApiResponse<{ ok?: boolean }>(response, "Ürün türü atanamadı.");
  invalidateProductKinds();
}

/** The boutique's product fields (Özellikler). */
export async function fetchOwnerAttributes(boutiqueId: string): Promise<TrAttributeListEntry[]> {
  return cachedOwnerFetch(ownerCacheKeys.attributes(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/attributes?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = await readApiResponse<{ attributes?: TrAttributeListEntry[] }>(
      response,
      "Özellikler yüklenemedi.",
    );
    return data.attributes ?? [];
  });
}

export async function createOwnerAttribute(
  boutiqueId: string,
  body: Record<string, unknown>,
): Promise<TrAttributeDefinition> {
  const response = await ownerFetch("/api/tr/owner/attributes", {
    method: "POST",
    body: JSON.stringify({ boutiqueId, ...body }),
  });
  const data = await readApiResponse<{ attribute?: TrAttributeDefinition }>(
    response,
    "Özellik oluşturulamadı.",
  );
  if (!data.attribute) throw new Error("Özellik oluşturulamadı.");
  invalidateProductKinds();
  return data.attribute;
}

export async function updateOwnerAttribute(
  attributeId: string,
  body: Record<string, unknown>,
): Promise<TrAttributeDefinition> {
  const response = await ownerFetch(
    `/api/tr/owner/attributes/${encodeURIComponent(attributeId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  const data = await readApiResponse<{ attribute?: TrAttributeDefinition }>(
    response,
    "Özellik güncellenemedi.",
  );
  if (!data.attribute) throw new Error("Özellik güncellenemedi.");
  invalidateProductKinds();
  return data.attribute;
}

export async function deleteOwnerAttribute(attributeId: string): Promise<void> {
  const response = await ownerFetch(
    `/api/tr/owner/attributes/${encodeURIComponent(attributeId)}`,
    { method: "DELETE" },
  );
  await readApiResponse<{ ok?: boolean }>(response, "Özellik silinemedi.");
  invalidateProductKinds();
}

/** Bulk: add products to a category, keeping the categories they already have. */
export async function addOwnerProductsToCategory(
  categoryId: string,
  productIds: string[],
): Promise<void> {
  const response = await ownerFetch(
    `/api/tr/owner/categories/${encodeURIComponent(categoryId)}/products`,
    { method: "POST", body: JSON.stringify({ productIds }) },
  );
  await readApiResponse<{ ok?: boolean }>(
    response,
    "Ürünler kategoriye eklenemedi.",
  );
  invalidateCategories();
}

/**
 * Like `createOwnerProduct`, but also returns the API's `warning` (the product was
 * created but something secondary, such as the cost price, was not stored).
 */
export async function createOwnerProductDetailed(
  payload: TrOwnerProductPayload,
): Promise<{ product: TrProduct; warning?: string }> {
  const response = await ownerFetch("/api/tr/owner/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = (await parseOwnerJson(response)) as {
    product?: TrProduct;
    warning?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Ürün oluşturulamadı.");
  }
  if (!data.product) throw new Error("Ürün oluşturulamadı.");
  invalidateProductLists();
  return { product: data.product, warning: data.warning };
}

export async function createOwnerProduct(
  payload: TrOwnerProductPayload,
): Promise<TrProduct> {
  return (await createOwnerProductDetailed(payload)).product;
}

/** Partial product fields for PATCH — API merges; full create still uses TrOwnerProductPayload. */
export type TrOwnerProductPatch = Partial<
  Omit<TrOwnerProductPayload, "boutiqueId">
> & {
  boutiqueId?: string;
};

export async function updateOwnerProduct(
  productId: string,
  payload: TrOwnerProductPatch,
): Promise<TrProduct> {
  const response = await ownerFetch(
    `/api/tr/owner/products/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  const data = (await parseOwnerJson(response)) as { product?: TrProduct; error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Ürün güncellenemedi.");
  }
  if (!data.product) throw new Error("Ürün güncellenemedi.");
  invalidateProductLists();
  return data.product;
}

export async function setOwnerColorGroup(input: {
  boutiqueId: string;
  anchorProductId: string;
  productIds: string[];
}): Promise<TrProduct> {
  const response = await ownerFetch("/api/tr/owner/products/color-group", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = (await parseOwnerJson(response)) as {
    product?: TrProduct;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Renk grubu kaydedilemedi.");
  }
  if (!data.product) throw new Error("Renk grubu kaydedilemedi.");
  invalidateProductLists();
  return data.product;
}

export interface OwnerProductImageUploadResult {
  url: string;
}

export async function uploadOwnerProductImage(
  boutiqueId: string,
  file: File,
): Promise<OwnerProductImageUploadResult> {
  const prepared = await prepareOwnerUploadFile(file);
  const formData = new FormData();
  formData.set("boutiqueId", boutiqueId);
  formData.set("file", prepared);

  const response = await ownerFetch("/api/tr/owner/upload", {
    method: "POST",
    body: formData,
  });

  if (response.status === 413) {
    throw new Error(
      "Fotoğraf çok büyük. Daha küçük bir görsel deneyin (yaklaşık 10 MB altı).",
    );
  }

  let data: { url?: string; error?: string };
  try {
    data = (await parseOwnerJson(response)) as typeof data;
  } catch {
    throw new Error(
      response.ok
        ? "Fotoğraf yanıtı okunamadı."
        : "Fotoğraf yüklenemedi.",
    );
  }

  if (!response.ok) {
    throw new Error(data.error ?? "Fotoğraf yüklenemedi.");
  }
  if (!data.url) throw new Error("Fotoğraf yüklenemedi.");

  return { url: data.url };
}

export interface TrOwnerSummaryResponse {
  checkoutEnabled: boolean;
  inventory: {
    available: number;
    sold: number;
    hidden: number;
    total: number;
    lowStock?: number;
  };
  period?: {
    range: string;
    orderCount: number;
    revenueKurus: number;
    pendingFulfillment: number;
    topProducts: Array<{
      title: string;
      quantity: number;
      revenueKurus: number;
    }>;
  } | null;
  today: {
    orderCount: number;
    revenueKurus: number;
  } | null;
}

export async function fetchOwnerSummary(
  boutiqueId: string,
  range: "today" | "7d" | "30d" | "all" = "today",
): Promise<TrOwnerSummaryResponse> {
  return cachedOwnerFetch(ownerCacheKeys.summary(boutiqueId, range), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/summary?boutiqueId=${encodeURIComponent(boutiqueId)}&range=${range}`,
    );
    const data = (await parseOwnerJson(response)) as {
      summary?: TrOwnerSummaryResponse;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Özet yüklenemedi.");
    }
    if (!data.summary) throw new Error("Özet yüklenemedi.");
    return data.summary;
  });
}

export type { TrOwnerDashboard } from "@/lib/tr/panel/dashboardMetrics";

export interface TrOwnerDashboardQuery {
  range: TrDashboardRangeId;
  /** YYYY-MM-DD, only for range "custom". */
  from?: string;
  to?: string;
}

export function peekOwnerDashboard(
  boutiqueId: string,
  query: TrOwnerDashboardQuery,
): TrOwnerDashboard | undefined {
  return peekOwnerCache(
    ownerCacheKeys.dashboard(boutiqueId, query.range, query.from, query.to),
  );
}

export async function fetchOwnerDashboard(
  boutiqueId: string,
  query: TrOwnerDashboardQuery,
): Promise<TrOwnerDashboard> {
  return cachedOwnerFetch(
    ownerCacheKeys.dashboard(boutiqueId, query.range, query.from, query.to),
    async () => {
      const params = new URLSearchParams({
        boutiqueId,
        range: query.range,
      });
      if (query.range === "custom") {
        if (query.from) params.set("from", query.from);
        if (query.to) params.set("to", query.to);
      }
      const response = await ownerFetch(
        `/api/tr/owner/dashboard?${params.toString()}`,
      );
      const data = (await parseOwnerJson(response)) as {
        dashboard?: TrOwnerDashboard;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Özet yüklenemedi.");
      }
      if (!data.dashboard) throw new Error("Özet yüklenemedi.");
      return data.dashboard;
    },
  );
}

export async function deleteOwnerProduct(
  productId: string,
): Promise<{ mode: "deleted" | "hidden"; message?: string }> {
  const response = await ownerFetch(
    `/api/tr/owner/products/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
  );
  let data: { error?: string; mode?: "deleted" | "hidden"; message?: string };
  try {
    data = (await parseOwnerJson(response)) as typeof data;
  } catch {
    throw new Error(
      response.ok ? "Silme yanıtı okunamadı." : "Ürün silinemedi.",
    );
  }
  if (!response.ok) {
    throw new Error(data.error ?? "Ürün silinemedi.");
  }
  invalidateProductLists();
  return {
    mode: data.mode === "hidden" ? "hidden" : "deleted",
    message: data.message,
  };
}

export async function duplicateOwnerProduct(
  productId: string,
): Promise<TrProduct> {
  const response = await ownerFetch(
    `/api/tr/owner/products/${encodeURIComponent(productId)}`,
    {
      method: "POST",
      body: JSON.stringify({ action: "duplicate" }),
    },
  );
  const data = (await parseOwnerJson(response)) as { product?: TrProduct; error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Ürün kopyalanamadı.");
  }
  if (!data.product) throw new Error("Ürün kopyalanamadı.");
  invalidateProductLists();
  return data.product;
}

export async function fetchOwnerOrders(boutiqueId: string) {
  return cachedOwnerFetch(
    ownerCacheKeys.orders(boutiqueId),
    async () => {
      const response = await ownerFetch(
        `/api/tr/owner/orders?boutiqueId=${encodeURIComponent(boutiqueId)}`,
      );
      const data = (await parseOwnerJson(response)) as {
        orders?: import("@/types/tr-marketplace").TrOrderWithItems[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Siparişler yüklenemedi.");
      }
      return data.orders ?? [];
    },
    0,
  );
}

export async function fetchOwnerOrder(boutiqueId: string, orderId: string) {
  const response = await ownerFetch(
    `/api/tr/owner/orders/${encodeURIComponent(orderId)}?boutiqueId=${encodeURIComponent(boutiqueId)}`,
  );
  const data = (await parseOwnerJson(response)) as {
    order?: import("@/types/tr-marketplace").TrOrderWithItems;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Sipariş yüklenemedi.");
  }
  if (!data.order) throw new Error("Sipariş yüklenemedi.");
  return data.order;
}

export async function updateOwnerOrderFulfillment(
  boutiqueId: string,
  orderId: string,
  fulfillmentStatus: import("@/types/tr-marketplace").TrFulfillmentStatus,
) {
  const response = await ownerFetch(
    `/api/tr/owner/orders/${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ boutiqueId, fulfillmentStatus }),
    },
  );
  const data = (await parseOwnerJson(response)) as {
    order?: import("@/types/tr-marketplace").TrOrderWithItems;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Sipariş güncellenemedi.");
  }
  if (!data.order) throw new Error("Sipariş güncellenemedi.");
  invalidateOrderLists();
  return data.order;
}

/** Mark pending order as paid (manual until iyzico). */
export async function updateOwnerOrderPaymentPaid(
  boutiqueId: string,
  orderId: string,
) {
  const response = await ownerFetch(
    `/api/tr/owner/orders/${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ boutiqueId, paymentStatus: "paid" }),
    },
  );
  const data = (await parseOwnerJson(response)) as {
    order?: import("@/types/tr-marketplace").TrOrderWithItems;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Ödeme durumu güncellenemedi.");
  }
  if (!data.order) throw new Error("Ödeme durumu güncellenemedi.");
  invalidateOrderLists();
  return data.order;
}

export async function fulfillOwnerShipment(boutiqueId: string, orderId: string) {
  const response = await ownerFetch(
    `/api/tr/owner/orders/${encodeURIComponent(orderId)}/shipment`,
    {
      method: "POST",
      body: JSON.stringify({ boutiqueId, action: "fulfill" }),
    },
  );
  return parseShipmentResponse(response, "Etiket üretilemedi.");
}

export async function retryOwnerShipmentAddress(
  boutiqueId: string,
  orderId: string,
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    district: string;
    postalCode: string;
    country: string;
  },
) {
  const response = await ownerFetch(
    `/api/tr/owner/orders/${encodeURIComponent(orderId)}/shipment`,
    {
      method: "POST",
      body: JSON.stringify({
        boutiqueId,
        action: "retry-address",
        shippingAddress,
      }),
    },
  );
  return parseShipmentResponse(response, "Adres kaydedilemedi.");
}

/** Boutiques without a carrier integration: record the carrier and tracking code, mark shipped. */
export async function saveOwnerManualShipment(
  boutiqueId: string,
  orderId: string,
  input: { carrierName: string; trackingCode: string },
) {
  const response = await ownerFetch(
    `/api/tr/owner/orders/${encodeURIComponent(orderId)}/shipment`,
    {
      method: "POST",
      body: JSON.stringify({ boutiqueId, action: "manual-ship", ...input }),
    },
  );
  const result = await parseShipmentResponse(
    response,
    "Kargo bilgisi kaydedilemedi.",
  );
  invalidateOrderLists();
  return result;
}

export async function createOwnerShipment(boutiqueId: string, orderId: string) {
  const response = await ownerFetch(
    `/api/tr/owner/orders/${encodeURIComponent(orderId)}/shipment`,
    {
      method: "POST",
      body: JSON.stringify({ boutiqueId, action: "create" }),
    },
  );
  return parseShipmentResponse(response, "Kargo oluşturulamadı.");
}

export async function fetchOwnerShipmentRates(
  boutiqueId: string,
  orderId: string,
) {
  const response = await ownerFetch(
    `/api/tr/owner/orders/${encodeURIComponent(orderId)}/shipment`,
    {
      method: "POST",
      body: JSON.stringify({ boutiqueId, action: "rates" }),
    },
  );
  return parseShipmentResponse(response, "Kargo fiyatları alınamadı.");
}

export async function cancelOwnerShipmentBarcode(
  boutiqueId: string,
  orderId: string,
) {
  const response = await ownerFetch(
    `/api/tr/owner/orders/${encodeURIComponent(orderId)}/shipment`,
    {
      method: "POST",
      body: JSON.stringify({ boutiqueId, action: "cancel" }),
    },
  );
  return parseShipmentResponse(response, "Kargo kodu iptal edilemedi.");
}

export class OwnerShipmentStaleError extends Error {
  readonly order: TrOrderWithItems;

  constructor(message: string, order: TrOrderWithItems) {
    super(message);
    this.name = "OwnerShipmentStaleError";
    this.order = order;
  }
}

export async function fetchOwnerShipmentLabel(
  boutiqueId: string,
  orderId: string,
): Promise<string> {
  const response = await ownerFetch(
    `/api/tr/owner/orders/${encodeURIComponent(orderId)}/shipment/label?boutiqueId=${encodeURIComponent(boutiqueId)}`,
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      stale?: boolean;
      order?: TrOrderWithItems;
    };
    if (data.stale && data.order) {
      invalidateOrderLists();
      throw new OwnerShipmentStaleError(
        data.error ?? "Etiket Basit Kargo’da iptal edildi.",
        data.order,
      );
    }
    throw new Error(data.error ?? "Etiket alınamadı.");
  }
  const svg = await response.text();
  if (!svg.includes("<svg")) {
    throw new Error("Etiket alınamadı.");
  }
  return svg;
}

export function openOwnerShipmentLabel(svg: string) {
  const html = wrapShipmentLabelHtml(svg);
  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Opens the print tab straight away — inside the click that asked for it — and
 * fills it once every etiket has been fetched. A tab opened after awaiting network
 * calls is blocked by browsers, and a batch takes a while. Null when blocked.
 */
export function beginOwnerLabelPrint(): {
  show: (svgs: string[]) => void;
  abort: () => void;
} | null {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return null;
  printWindow.document.title = "Etiketler hazırlanıyor…";
  printWindow.document.body.textContent = "Etiketler hazırlanıyor…";
  return {
    show(svgs) {
      const url = URL.createObjectURL(
        new Blob([wrapShipmentLabelsHtml(svgs)], {
          type: "text/html;charset=utf-8",
        }),
      );
      printWindow.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    abort() {
      printWindow.close();
    },
  };
}

async function parseShipmentResponse(
  response: Response,
  fallback: string,
): Promise<{
  order: TrOrderWithItems;
  rates?: TrShippingRate[];
  trackingPath?: string | null;
}> {
  const data = (await parseOwnerJson(response)) as {
    order?: TrOrderWithItems;
    rates?: TrShippingRate[];
    trackingPath?: string | null;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? fallback);
  }
  if (!data.order) throw new Error(fallback);
  return {
    order: data.order,
    rates: data.rates,
    trackingPath: data.trackingPath,
  };
}

export async function fetchOwnerCustomers(
  boutiqueId: string,
): Promise<TrBoutiqueCustomer[]> {
  return cachedOwnerFetch(ownerCacheKeys.customers(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/customers?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = (await parseOwnerJson(response)) as {
      customers?: TrBoutiqueCustomer[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Müşteriler yüklenemedi.");
    }
    return data.customers ?? [];
  });
}

/** What the customer form sends. */
export interface OwnerCustomerPayload {
  name: string;
  email: string;
  phone: string;
  note: string;
  addresses: TrBoutiqueCustomerAddress[];
}

/** Another customer already has that e-mail; carries their id so the form can link to them. */
export class OwnerCustomerEmailTakenError extends Error {
  constructor(
    message: string,
    readonly existingCustomerId: string | null,
  ) {
    super(message);
    this.name = "OwnerCustomerEmailTakenError";
  }
}

async function readCustomerResponse(
  response: Response,
  fallback: string,
): Promise<TrBoutiqueCustomer> {
  const data = (await parseOwnerJson(response)) as {
    customer?: TrBoutiqueCustomer;
    existingCustomerId?: string | null;
    error?: string;
  };
  if (response.status === 409) {
    throw new OwnerCustomerEmailTakenError(
      data.error ?? fallback,
      data.existingCustomerId ?? null,
    );
  }
  if (!response.ok) throw new Error(data.error ?? fallback);
  if (!data.customer) throw new Error(fallback);
  invalidateOwnerCache("customers:");
  return data.customer;
}

export async function createOwnerCustomer(
  boutiqueId: string,
  payload: OwnerCustomerPayload,
): Promise<TrBoutiqueCustomer> {
  const response = await ownerFetch("/api/tr/owner/customers", {
    method: "POST",
    body: JSON.stringify({ boutiqueId, ...payload }),
  });
  return readCustomerResponse(response, "Müşteri kaydedilemedi.");
}

export async function updateOwnerCustomer(
  boutiqueId: string,
  customerId: string,
  payload: OwnerCustomerPayload,
): Promise<TrBoutiqueCustomer> {
  const response = await ownerFetch(
    `/api/tr/owner/customers/${encodeURIComponent(customerId)}`,
    { method: "PATCH", body: JSON.stringify({ boutiqueId, ...payload }) },
  );
  return readCustomerResponse(response, "Müşteri kaydedilemedi.");
}

export async function deleteOwnerCustomer(
  boutiqueId: string,
  customerId: string,
): Promise<void> {
  const response = await ownerFetch(
    `/api/tr/owner/customers/${encodeURIComponent(customerId)}?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const data = (await parseOwnerJson(response)) as { error?: string };
    throw new Error(data.error ?? "Müşteri silinemedi.");
  }
  invalidateOwnerCache("customers:");
}

/** The variants of the boutique's Gelişmiş products, with the label of each value. */
export interface OwnerProductVariants {
  variants: Record<string, TrProductVariant[]>;
  labels: Record<string, string>;
}

export function peekOwnerProductVariants(
  boutiqueId: string,
): OwnerProductVariants | undefined {
  return peekOwnerCache(ownerCacheKeys.productVariants(boutiqueId));
}

export async function fetchOwnerProductVariants(
  boutiqueId: string,
): Promise<OwnerProductVariants> {
  return cachedOwnerFetch(ownerCacheKeys.productVariants(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/product-variants?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = (await parseOwnerJson(response)) as Partial<OwnerProductVariants> & {
      error?: string;
    };
    if (!response.ok) throw new Error(data.error ?? "Varyantlar yüklenemedi.");
    return { variants: data.variants ?? {}, labels: data.labels ?? {} };
  });
}

/** One variant's stock (the Stok page); returns the product's new stock. */
export async function updateOwnerVariantStock(
  boutiqueId: string,
  variantId: string,
  stock: number,
): Promise<{ variant: TrProductVariant; productId: string; productStock: number }> {
  const response = await ownerFetch(
    `/api/tr/owner/product-variants/${encodeURIComponent(variantId)}`,
    { method: "PATCH", body: JSON.stringify({ boutiqueId, stock }) },
  );
  const data = (await parseOwnerJson(response)) as {
    variant?: TrProductVariant;
    productId?: string;
    productStock?: number;
    error?: string;
  };
  if (!response.ok || !data.variant || !data.productId) {
    throw new Error(data.error ?? "Stok güncellenemedi.");
  }
  invalidateProductLists();
  return { variant: data.variant, productId: data.productId, productStock: data.productStock ?? 0 };
}

/**
 * Creates an order by hand. `draftId` is the draft it was made from, which the server
 * deletes. Placing an order moves stock, so the product lists are refreshed too.
 */
export async function createOwnerOrder(
  boutiqueId: string,
  order: ManualOrderDraft,
  draftId?: string | null,
): Promise<TrOrderWithItems> {
  const response = await ownerFetch("/api/tr/owner/orders", {
    method: "POST",
    body: JSON.stringify({ boutiqueId, draftId: draftId ?? undefined, ...order }),
  });
  const data = (await parseOwnerJson(response)) as {
    order?: TrOrderWithItems;
    error?: string;
  };
  if (!response.ok || !data.order) {
    throw new Error(data.error ?? "Sipariş oluşturulamadı.");
  }
  invalidateOrderLists();
  invalidateProductLists();
  invalidateOwnerCache("order-drafts:");
  return data.order;
}

export function peekOwnerOrderDrafts(boutiqueId: string): TrOrderDraft[] | undefined {
  return peekOwnerCache(ownerCacheKeys.orderDrafts(boutiqueId));
}

export async function fetchOwnerOrderDrafts(boutiqueId: string): Promise<TrOrderDraft[]> {
  return cachedOwnerFetch(ownerCacheKeys.orderDrafts(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/order-drafts?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = (await parseOwnerJson(response)) as {
      drafts?: TrOrderDraft[];
      error?: string;
    };
    if (!response.ok) throw new Error(data.error ?? "Taslaklar yüklenemedi.");
    return data.drafts ?? [];
  });
}

async function readDraftResponse(response: Response, fallback: string): Promise<TrOrderDraft> {
  const data = (await parseOwnerJson(response)) as { draft?: TrOrderDraft; error?: string };
  if (!response.ok || !data.draft) throw new Error(data.error ?? fallback);
  invalidateOwnerCache("order-drafts:");
  return data.draft;
}

export async function createOwnerOrderDraft(
  boutiqueId: string,
  order: ManualOrderDraft,
): Promise<TrOrderDraft> {
  const response = await ownerFetch("/api/tr/owner/order-drafts", {
    method: "POST",
    body: JSON.stringify({ boutiqueId, ...order }),
  });
  return readDraftResponse(response, "Taslak kaydedilemedi.");
}

export async function updateOwnerOrderDraft(
  boutiqueId: string,
  draftId: string,
  order: ManualOrderDraft,
): Promise<TrOrderDraft> {
  const response = await ownerFetch(
    `/api/tr/owner/order-drafts/${encodeURIComponent(draftId)}`,
    { method: "PATCH", body: JSON.stringify({ boutiqueId, ...order }) },
  );
  return readDraftResponse(response, "Taslak kaydedilemedi.");
}

export async function deleteOwnerOrderDraft(
  boutiqueId: string,
  draftId: string,
): Promise<void> {
  const response = await ownerFetch(
    `/api/tr/owner/order-drafts/${encodeURIComponent(draftId)}?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const data = (await parseOwnerJson(response)) as { error?: string };
    throw new Error(data.error ?? "Taslak silinemedi.");
  }
  invalidateOwnerCache("order-drafts:");
}

export interface TrOwnerBoutiqueSettings {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  description: string | null;
  logoUrl: string | null;
  whatsappPhone: string | null;
  instagramHandle: string | null;
  shippingNote: string | null;
  exchangePolicy: string | null;
  physicalAddress: string | null;
  themeAccent: string | null;
  vergiNo: string | null;
  vergiDairesi: string | null;
  mersisNo: string | null;
  kepAddress: string | null;
  /** Support address shown to shoppers; reply-to of order e-mails. */
  contactEmail: string | null;
  tracking: TrBoutiqueTracking;
  iban: string | null;
  status: string;
}

export async function fetchOwnerBoutiqueSettings(
  boutiqueId: string,
): Promise<TrOwnerBoutiqueSettings> {
  return cachedOwnerFetch(ownerCacheKeys.settings(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/boutiques/${encodeURIComponent(boutiqueId)}`,
    );
    const data = (await parseOwnerJson(response)) as {
      boutique?: TrOwnerBoutiqueSettings;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Butik yüklenemedi.");
    }
    if (!data.boutique) throw new Error("Butik yüklenemedi.");
    return data.boutique;
  });
}

export async function updateOwnerBoutiqueSettings(
  boutiqueId: string,
  payload: Partial<
    Pick<
      TrOwnerBoutiqueSettings,
      | "description"
      | "logoUrl"
      | "whatsappPhone"
      | "instagramHandle"
      | "shippingNote"
      | "exchangePolicy"
      | "physicalAddress"
      | "themeAccent"
      | "legalName"
      | "vergiNo"
      | "vergiDairesi"
      | "mersisNo"
      | "kepAddress"
      | "contactEmail"
      | "tracking"
      | "iban"
    >
  >,
): Promise<TrOwnerBoutiqueSettings> {
  const response = await ownerFetch(
    `/api/tr/owner/boutiques/${encodeURIComponent(boutiqueId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  const data = (await parseOwnerJson(response)) as {
    boutique?: TrOwnerBoutiqueSettings;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Butik güncellenemedi.");
  }
  if (!data.boutique) throw new Error("Butik güncellenemedi.");
  invalidateOwnerCache(ownerCacheKeys.boutiques);
  invalidateOwnerCache(ownerCacheKeys.settings(boutiqueId));
  return data.boutique;
}

export async function fetchOwnerInvoices(
  boutiqueId: string,
): Promise<TrInvoice[]> {
  return cachedOwnerFetch(ownerCacheKeys.invoices(boutiqueId), async () => {
    const response = await ownerFetch(
      `/api/tr/owner/invoices?boutiqueId=${encodeURIComponent(boutiqueId)}`,
    );
    const data = (await parseOwnerJson(response)) as {
      invoices?: TrInvoice[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Faturalar yüklenemedi.");
    }
    return data.invoices ?? [];
  });
}

export async function createOwnerInvoiceDraft(
  boutiqueId: string,
  orderId: string,
): Promise<TrInvoice> {
  const response = await ownerFetch(`/api/tr/owner/invoices`, {
    method: "POST",
    body: JSON.stringify({ boutiqueId, orderId }),
  });
  const data = (await parseOwnerJson(response)) as {
    invoice?: TrInvoice;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Fatura kaydı oluşturulamadı.");
  }
  if (!data.invoice) throw new Error("Fatura kaydı oluşturulamadı.");
  return data.invoice;
}

export async function updateOwnerInvoice(
  invoiceId: string,
  payload: {
    boutiqueId: string;
    status?: TrInvoiceStatus;
    externalInvoiceNo?: string | null;
    notes?: string | null;
  },
): Promise<TrInvoice> {
  const response = await ownerFetch(
    `/api/tr/owner/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  const data = (await parseOwnerJson(response)) as {
    invoice?: TrInvoice;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Fatura güncellenemedi.");
  }
  if (!data.invoice) throw new Error("Fatura güncellenemedi.");
  return data.invoice;
}

// --------------------------------------------------------------- card payments (iyzico)

async function iyzicoRequest(
  boutiqueId: string,
  init: RequestInit | undefined,
  failure: string,
): Promise<IyzicoStatus> {
  const response = await ownerFetch(
    `/api/tr/owner/boutiques/${encodeURIComponent(boutiqueId)}/iyzico`,
    init,
  );
  const data = (await parseOwnerJson(response)) as { status?: IyzicoStatus; error?: string };
  if (!response.ok) throw new Error(data.error ?? failure);
  if (!data.status) throw new Error(failure);
  // The storefront and the panel summary now offer (or stop offering) card payments.
  invalidateOwnerCache("summary:");
  return data.status;
}

export function fetchOwnerIyzicoStatus(boutiqueId: string): Promise<IyzicoStatus> {
  return iyzicoRequest(boutiqueId, undefined, "Ödeme durumu okunamadı.");
}

/** Checks the keys with iyzico and stores them encrypted; they are never returned. */
export function connectOwnerIyzico(
  boutiqueId: string,
  keys: { apiKey: string; secretKey: string },
): Promise<IyzicoStatus> {
  return iyzicoRequest(
    boutiqueId,
    { method: "PUT", body: JSON.stringify(keys) },
    "iyzico bağlanamadı.",
  );
}

export function disconnectOwnerIyzico(boutiqueId: string): Promise<IyzicoStatus> {
  return iyzicoRequest(boutiqueId, { method: "DELETE" }, "Bağlantı kaldırılamadı.");
}
