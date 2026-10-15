import type { TrFashionProductFeatures } from "@/lib/tr/fashion/types";
import type { TrCustomArtProductFeatures } from "@/lib/tr/customArt/types";
import type { TrSeo } from "@/lib/tr/seo/seoFields";
import type { TrBoutiqueTracking } from "@/lib/tr/tracking/config";

export type TrBoutiqueStatus = "draft" | "pending" | "verified" | "suspended";
export type TrProductStatus = "available" | "sold" | "hidden";
/**
 * Which editor a product opens in. `fashion` = the garment flows (AI catalog,
 * size charts, takım); `simple` = one price and one stock count.
 */
export type TrProductType = "simple" | "advanced" | "fashion";
/** Informational for now — a digital product still uses normal checkout and shipping. */
export type TrFulfillmentType = "physical" | "digital";
/** Unit of a product's content, for the unit price (see `productUnits.ts`). */
export type TrUnitType = "g" | "kg" | "ml" | "l" | "cm" | "m" | "m2" | "adet";
export type TrPaymentStatus = "sandbox" | "pending" | "paid" | "failed" | "refunded";
/** Ikas-like owner fulfillment pipeline (separate from payment). */
export type TrFulfillmentStatus =
  | "created"
  | "ready"
  | "shipped"
  | "delivered"
  | "cancelled";

/** Buyer invoice party at checkout (seller = boutique). */
export type TrInvoiceType = "individual" | "corporate";
/** Offline registry until GİB; no fake auto-issue. */
export type TrInvoiceStatus = "draft" | "issued_offline" | "void";

/** Per-boutique carrier adapter. Null on the order = shipped outside the app. */
export type TrShippingProviderId = "basitkargo";

export type TrShippingTrace = {
  status: string;
  time: string;
  location: string | null;
};

export type TrOrderShipment = {
  provider: TrShippingProviderId | null;
  externalId: string | null;
  barcode: string | null;
  carrierCode: string | null;
  carrierName: string | null;
  trackingCode: string | null;
  status: string | null;
  traces: TrShippingTrace[];
  feeKurus: number | null;
  /** Why auto-buy stopped. Only address_rejected unlocks address edit. */
  block: "address_rejected" | "insufficient_balance" | "provider_error" | null;
  addressRetryUsed: boolean;
  lastError: string | null;
};

/** Common garment categories for outfit builder filtering (free text in DB). */
export type TrGarmentCategory =
  | "top"
  | "bottom"
  | "dress"
  | "outerwear"
  | "shoes"
  | "bag"
  | "accessory"
  | "other";

export type TrCatalogProfileId = "fashion" | "custom_art";

/** Public-safe boutique fields (no iban / commission). Vergi no is on künye by design. */
export interface TrBoutiquePublic {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  description: string | null;
  logoUrl: string | null;
  whatsappPhone: string | null;
  instagramHandle: string | null;
  themeAccent: string | null;
  shippingNote: string | null;
  exchangePolicy: string | null;
  physicalAddress: string | null;
  /** Custom host e.g. pervinsoysal.com */
  customDomain: string | null;
  /** Tax id for künye / legal pages (not IBAN). */
  vergiNo: string | null;
  /** Tax office, shown next to the tax id on the künye page and contracts. */
  vergiDairesi: string | null;
  /** MERSİS number for the künye page. */
  mersisNo: string | null;
  /** KEP (registered e-mail) address for the künye page. */
  kepAddress: string | null;
  /** The store's ad / analytics IDs (public identifiers only). */
  tracking: TrBoutiqueTracking;
  /** Editorial homepage JSON; null → code defaults for that boutique. */
  editorialContent: Record<string, unknown> | null;
  /** Vertical: fashion catalog vs print-on-demand custom art. */
  catalogProfile: TrCatalogProfileId;
  /** Public storefront contact email override. Null → info@{customDomain} or platform mailbox. */
  contactEmail: string | null;
  /** Flat shipping fee charged per order, kuruş. 0 = no shipping charge. */
  shippingFeeKurus: number;
  /** Orders with at least this many items ship free. Null = no item threshold. */
  freeShippingMinItems: number | null;
  /** Orders whose items subtotal reaches this (kuruş) ship free. Null = no amount threshold. */
  freeShippingMinSubtotalKurus: number | null;
  status: TrBoutiqueStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TrProductColor {
  name: string;
  hex: string;
}

/**
 * AI/owner-filled PDP specs. Empty keys are omitted.
 * Composed from per-vertical modules — see `src/lib/tr/fashion/types.ts` and
 * `src/lib/tr/customArt/types.ts` for the actual field definitions.
 */
export type TrProductFeatures = TrFashionProductFeatures & TrCustomArtProductFeatures;

export type TrOrderItemCustomization = {
  styleOption?: string | null;
  referenceId?: string | null;
};

/** Full boutique record — service role / admin only. */
export interface TrBoutique extends TrBoutiquePublic {
  iban: string | null;
  commissionBps: number;
  ownerUserId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  shippingAddress: string | null;
  returnAddress: string | null;
}

/** "Birim fiyat": the price per kg / l / m…, worked out from the content amount. */
export interface TrUnitPrice {
  enabled: boolean;
  /** How much the product contains, in `type` units (500 for a 500 g pack). */
  amount: number | null;
  type: TrUnitType | null;
}

/**
 * Public-safe fields the Basit ürün editor adds (Ürün detayı, Envanter, Stok, Birim
 * fiyat; `supabase/patch_product_details.sql`). Present on owner/admin reads
 * (`select *`) once the patch is applied; owner-only data (supplier, HS code) is
 * `TrProductPrivate` instead.
 */
export interface TrProductDetails {
  /** Sanitized rich-text description; `description` holds its plain-text form. */
  descriptionHtml: string | null;
  brand: string | null;
  tags: string[];
  /** Free text the Google Merchant feed can emit as google_product_category. */
  googleCategory: string | null;
  sku: string | null;
  barcode: string | null;
  /** Shipping volume weight; the carrier label will use it. */
  desi: number | null;
  /** Keep selling at zero stock. Stored; the storefront does not act on it yet. */
  continueSelling: boolean;
  unitPrice: TrUnitPrice | null;
}

export interface TrProduct extends Partial<TrProductDetails> {
  id: string;
  boutiqueId: string;
  title: string;
  description: string | null;
  priceKurus: number;
  /** Original price before discount — demo/editorial use; live rows leave null. */
  compareAtPriceKurus: number | null;
  size: string | null;
  sizes: string[];
  colors: TrProductColor[];
  conditionLabel: string | null;
  category: string | null;
  /** Boutique gallery — original owner uploads. */
  images: string[];
  /** Marketplace / catalog cutouts (BG removed + normalized). */
  marketplaceImages: string[];
  /** Leftover flattened WebP copies. Boutique display uses marketplace PNGs, not these. */
  storefrontImages: string[];
  /** AI on-model / lifestyle shots (content packs + PDP). */
  lifestyleImages: string[];
  /** Premade catalog backdrop id (one per product). */
  catalogBackgroundId: string | null;
  /** PDP “Ürün özellikleri” — filled by catalog AI, editable in panel. */
  features: TrProductFeatures;
  status: TrProductStatus;
  stock: number;
  /** Per-size units. Empty when product has no sizes (then `stock` is the single count). */
  sizeStocks: Record<string, number>;
  sortOrder: number;
  /**
   * Set on owner/admin reads (`select *`) only; the storefront's explicit column
   * lists don't carry it. Treat a missing value as `fashion`.
   */
  productType?: TrProductType;
  fulfillmentType?: TrFulfillmentType;
  /** The product's kind (`tr_product_kinds`); owner/admin reads only, `null` = none. */
  kindId?: string | null;
  /** Owner/admin reads only (the storefront reads slug and SEO through `productSlug.ts`). */
  slug?: string | null;
  seo?: TrSeo;
  createdAt: string;
  updatedAt: string;
}

/**
 * Owner-only product data (`tr_product_private`). Returned by the owner API next
 * to the product, never part of `TrProduct`: the products table is publicly readable.
 */
export interface TrProductPrivate {
  costPriceKurus: number | null;
  /** Free text; stored only. */
  supplier: string | null;
  /** Gümrük tarife (GTİP) code; stored only. */
  hsCode: string | null;
}

export const EMPTY_PRODUCT_PRIVATE: TrProductPrivate = {
  costPriceKurus: null,
  supplier: null,
  hsCode: null,
};

export interface TrProductWithBoutique extends TrProduct {
  boutique: TrBoutiquePublic;
}

/** Boutique storefront — product catalog only (not outfit bundles). */
export interface TrBoutiqueStorefront extends TrBoutiquePublic {
  products: TrProduct[];
}

export interface TrShippingAddress {
  line1: string;
  line2?: string;
  district: string;
  city: string;
  postalCode: string;
  country: string;
}

/** Saved shopper address book entry (platform account, all boutiques). */
export interface TrCustomerAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  district: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TrCustomerAddressInput = {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  district: string;
  city: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
};

export type TrCustomerAddressPatch = Partial<TrCustomerAddressInput>;

/** Where an order came from: the shop's checkout, or the owner creating it in the panel. */
export type TrOrderChannel = "storefront" | "manual";

export interface TrOrder {
  id: string;
  /** `manual` = created by the owner in the panel (Sipariş Oluştur). */
  channel: TrOrderChannel;
  /** The owner's "Müşteri Notu" on a manual order. */
  customerNote: string | null;
  /** The boutique customer record this order belongs to; null on orders that predate customers. */
  customerId: string | null;
  customerEmail: string;
  customerName: string;
  customerPhone: string | null;
  shippingAddress: TrShippingAddress;
  totalKurus: number;
  /** Coupon code applied at checkout, if any. */
  discountCode: string | null;
  /** Amount subtracted from line subtotal (kuruş). */
  discountKurus: number;
  /** Name of a manual price reduction ("Arkadaş indirimi"); a coupon uses `discountCode`. */
  discountTitle: string | null;
  invoiceType: TrInvoiceType;
  buyerTaxId: string | null;
  buyerTaxOffice: string | null;
  buyerTitle: string | null;
  paymentStatus: TrPaymentStatus;
  fulfillmentStatus: TrFulfillmentStatus;
  isSandbox: boolean;
  iyzicoPaymentId: string | null;
  iyzicoConversationId: string | null;
  shipment: TrOrderShipment;
  createdAt: string;
  updatedAt: string;
}

export interface TrInvoiceLineSummary {
  title: string;
  quantity: number;
  priceKurus: number;
  size: string | null;
}

export interface TrInvoice {
  id: string;
  boutiqueId: string;
  orderId: string;
  status: TrInvoiceStatus;
  buyerName: string;
  buyerEmail: string;
  invoiceType: TrInvoiceType;
  buyerTaxId: string | null;
  buyerTaxOffice: string | null;
  buyerTitle: string | null;
  totalKurus: number;
  lineSummary: TrInvoiceLineSummary[];
  externalInvoiceNo: string | null;
  issuedAt: string | null;
  notes: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrDiscountCode {
  id: string;
  boutiqueId: string;
  code: string;
  percentOff: number | null;
  amountOffKurus: number | null;
  active: boolean;
  usageLimit: number | null;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
}

/** One saved delivery address on a boutique customer. */
export interface TrBoutiqueCustomerAddress {
  id: string;
  /** What the owner calls it: "Ev", "İş", "Teslimat adresi". */
  title: string;
  /** Who receives the parcel. */
  name: string;
  line1: string;
  line2: string;
  district: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

/** A person who buys from one boutique (or was added by its owner). Personal data. */
export interface TrBoutiqueCustomer {
  id: string;
  boutiqueId: string;
  name: string;
  /** Lower-cased; unique per boutique. */
  email: string;
  phone: string | null;
  note: string | null;
  addresses: TrBoutiqueCustomerAddress[];
  createdAt: string;
  updatedAt: string;
}

export interface TrOrderItem {
  id: string;
  orderId: string;
  /** Null when the catalog product was deleted after the order. */
  productId: string | null;
  boutiqueId: string;
  title: string;
  priceKurus: number;
  quantity: number;
  /** Selected beden at purchase; null when product has no sizes. */
  size: string | null;
  /** The variant sold (Gelişmiş ürün); null without variants or once that variant was removed. */
  variantId: string | null;
  /** "Kırmızı / S" as it read at purchase; null for products without variants. */
  variantLabel: string | null;
  /** Customer source photo for custom_art orders. */
  referenceImageUrl: string | null;
  customization: TrOrderItemCustomization | null;
  createdAt: string;
  /** Cover for packing UI — resolved from live product when available. */
  imageUrl: string | null;
  /** Category of the live product; null when unknown or the product was deleted. */
  category?: string | null;
}

export interface TrOrderWithItems extends TrOrder {
  items: TrOrderItem[];
}

export interface CreateTrBoutiqueInput {
  slug: string;
  name: string;
  legalName?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  whatsappPhone?: string | null;
  instagramHandle?: string | null;
  themeAccent?: string | null;
  shippingNote?: string | null;
  exchangePolicy?: string | null;
  physicalAddress?: string | null;
  customDomain?: string | null;
  editorialContent?: Record<string, unknown> | null;
  catalogProfile?: TrCatalogProfileId;
  vergiNo?: string | null;
  vergiDairesi?: string | null;
  mersisNo?: string | null;
  kepAddress?: string | null;
  tracking?: TrBoutiqueTracking;
  iban?: string | null;
  commissionBps?: number;
  shippingFeeKurus?: number;
  freeShippingMinItems?: number | null;
  freeShippingMinSubtotalKurus?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  shippingAddress?: string | null;
  returnAddress?: string | null;
  status?: TrBoutiqueStatus;
}

export interface CreateTrProductInput extends Partial<TrProductDetails> {
  boutiqueId: string;
  title: string;
  description?: string | null;
  priceKurus: number;
  compareAtPriceKurus?: number | null;
  size?: string | null;
  sizes?: string[];
  colors?: TrProductColor[];
  conditionLabel?: string | null;
  category?: string | null;
  images?: string[];
  marketplaceImages?: string[];
  storefrontImages?: string[];
  lifestyleImages?: string[];
  catalogBackgroundId?: string | null;
  features?: TrProductFeatures;
  status?: TrProductStatus;
  stock?: number;
  sizeStocks?: Record<string, number>;
  sortOrder?: number;
  /** Defaults to `fashion` (every programmatic caller is a garment flow). */
  productType?: TrProductType;
  fulfillmentType?: TrFulfillmentType;
  /** The product's kind; omitted = none (and the column isn't written). */
  kindId?: string | null;
  /** A valid, already-unique slug (see `generateUniqueProductSlug`). */
  slug?: string | null;
  seo?: TrSeo;
}

export interface UpdateTrProductInput extends Partial<TrProductDetails> {
  title?: string;
  description?: string | null;
  priceKurus?: number;
  compareAtPriceKurus?: number | null;
  size?: string | null;
  sizes?: string[];
  colors?: TrProductColor[];
  conditionLabel?: string | null;
  category?: string | null;
  images?: string[];
  marketplaceImages?: string[];
  storefrontImages?: string[];
  lifestyleImages?: string[];
  catalogBackgroundId?: string | null;
  features?: TrProductFeatures;
  status?: TrProductStatus;
  stock?: number;
  sizeStocks?: Record<string, number>;
  sortOrder?: number;
  fulfillmentType?: TrFulfillmentType;
  /** `null` clears the kind; omitted leaves it. */
  kindId?: string | null;
  /** The slug itself changes through `setProductSlugAdmin`, which also records the redirect. */
  seo?: TrSeo;
}

export interface CreateTrOrderInput {
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
  shippingAddress: TrShippingAddress;
  invoiceType?: TrInvoiceType;
  buyerTaxId?: string | null;
  buyerTaxOffice?: string | null;
  buyerTitle?: string | null;
  isSandbox?: boolean;
  /** Optional override for demo seeding historical orders. */
  createdAt?: string;
  discountCode?: string | null;
  discountKurus?: number;
  /** When true (default for live checkout), decrement stock after insert. */
  decrementInventory?: boolean;
  /** A manual price reduction's name; set with `discountKurus` instead of a coupon code. */
  discountTitle?: string | null;
  /** Automatic discount campaigns (tr_discount_campaigns) applied to this order. */
  discountCampaignIds?: string[];
  /** Default `storefront`. `manual` = an owner-created order (see `patch_tr_manual_orders.sql`). */
  channel?: TrOrderChannel;
  /** The owner's note on a manual order. */
  customerNote?: string | null;
  /** The customer record this order is for; skips the find-or-create by e-mail. */
  customerId?: string | null;
  /** Customer-paid shipping (kuruş). Server-quoted; never trust the client. */
  shippingFeeKurus?: number;
  shippingProvider?: TrOrder["shipment"]["provider"];
  /** Default true. Card-capture holds skip push until iyzico SUCCESS. */
  notifyOwners?: boolean;
  items: Array<{
    productId: string;
    boutiqueId: string;
    title: string;
    priceKurus: number;
    quantity?: number;
    size?: string | null;
    /** A Gelişmiş ürün's variant: its id and the label to keep on the order. */
    variantId?: string | null;
    variantLabel?: string | null;
    referenceImageUrl?: string | null;
    customization?: TrOrderItemCustomization | null;
  }>;
}

/** Whole lira render without decimals (₺3.500); a non-zero kuruş part shows both (₺89,90). */
export function formatTryFromKurus(kurus: number): string {
  const wholeLira = Math.round(kurus) % 100 === 0;
  const digits = wholeLira ? 0 : 2;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(kurus / 100);
}

export function parseTryToKurus(amount: string | number): number {
  if (typeof amount === "number") {
    return Math.round(amount * 100);
  }

  const normalized = amount.replace(/[^\d,.-]/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid TRY amount.");
  }

  return Math.round(value * 100);
}
