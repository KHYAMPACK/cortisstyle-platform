/**
 * schema.org Product data for a product page, so search engines can show price and
 * availability in results. Pure; the page renders it with `jsonLdScript`.
 */
import type { TrProduct } from "@/types/tr-marketplace";

export interface ProductJsonLdInput {
  product: Pick<
    TrProduct,
    "title" | "description" | "priceKurus" | "status" | "stock" | "images" | "brand" | "sku"
  >;
  /** The product's canonical address (https://…). */
  url: string;
  /** The store's origin, used to make relative picture paths absolute. */
  origin: string;
  sellerName: string;
  /** For a product sold by variant: the lowest and highest variant price, in kuruş. */
  variantPrices?: { min: number; max: number; count: number } | null;
}

function absolute(src: string, origin: string): string | null {
  const value = src.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return `${origin}${value}`;
  return null;
}

function lira(kurus: number): string {
  return (Math.round(kurus) / 100).toFixed(2);
}

export function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const { product, url, origin, sellerName, variantPrices } = input;
  const inStock = product.status === "available" && (product.stock ?? 1) > 0;
  const availability = inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const images = product.images
    .map((src) => absolute(src, origin))
    .filter((src): src is string => src !== null)
    .slice(0, 6);
  const seller = { "@type": "Organization", name: sellerName };

  const offers =
    variantPrices && variantPrices.max > variantPrices.min
      ? {
          "@type": "AggregateOffer",
          url,
          priceCurrency: "TRY",
          lowPrice: lira(variantPrices.min),
          highPrice: lira(variantPrices.max),
          offerCount: variantPrices.count,
          availability,
          seller,
        }
      : {
          "@type": "Offer",
          url,
          priceCurrency: "TRY",
          price: lira(variantPrices?.min ?? product.priceKurus),
          availability,
          itemCondition: "https://schema.org/NewCondition",
          seller,
        };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    url,
    ...(images.length > 0 ? { image: images } : {}),
    ...(product.description?.trim() ? { description: product.description.trim().slice(0, 5000) } : {}),
    ...(product.brand?.trim() ? { brand: { "@type": "Brand", name: product.brand.trim() } } : {}),
    ...(product.sku?.trim() ? { sku: product.sku.trim() } : {}),
    offers,
  };
}

/** JSON for a `<script type="application/ld+json">`, safe against `</script>` in the text. */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
