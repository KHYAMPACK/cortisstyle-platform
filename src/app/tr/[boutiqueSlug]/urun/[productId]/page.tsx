import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { TrTrackViewItem } from "@/components/tr/boutique/TrTrackingEvents";
import { TrBoutiqueProductPage } from "@/components/tr/boutique/pdp/TrBoutiqueProductPage";
import { getProductSlugSeo } from "@/lib/tr/catalog/productSlug";
import { loadPublicProductVariants } from "@/lib/tr/catalog/publicVariants";
import { boutiqueOffersIyzicoCheckout } from "@/lib/tr/payments/registry";
import {
  safeGetPublicColorSiblings,
  safeResolvePublicProduct,
} from "@/lib/tr/publicData";
import { isSeoEmpty } from "@/lib/tr/seo/seoFields";
import {
  storeAddress,
  storeCustomerPath,
  storeProductUrl,
} from "@/lib/tr/seo/storeAddress";
import { resolveSeoHostContext } from "@/lib/tr/seo/storefrontSeo";
import { trBoutiqueProductPath } from "@/lib/tr/paths";

interface BoutiqueProductPageProps {
  params: Promise<{ boutiqueSlug: string; productId: string }>;
}

// The page and its metadata both need the product: resolve it once per request.
const resolveProduct = cache(safeResolvePublicProduct);
const loadSlugSeo = cache(getProductSlugSeo);

export async function generateMetadata({
  params,
}: BoutiqueProductPageProps): Promise<Metadata> {
  const { boutiqueSlug, productId } = await params;
  const result = await resolveProduct(boutiqueSlug, productId);

  if (result.kind !== "found") {
    return { title: "Ürün bulunamadı" };
  }
  const { product } = result;

  const fallback: Metadata = {
    title: product.title,
    description:
      product.description ?? `${product.title} — ${product.boutique.name}`,
  };

  // Products with no slug and no SEO overrides (every product that predates the
  // SEO card) keep exactly the metadata they always had.
  const { slug, seo } = await loadSlugSeo(product.id);
  if (!slug && isSeoEmpty(seo)) return fallback;

  const address = {
    boutiqueSlug: product.boutique.slug,
    customDomain: product.boutique.customDomain,
  };
  const canonical = seo.canonical
    ? `${storeAddress(address).origin}${seo.canonical}`
    : storeProductUrl({ ...address, slugOrId: slug ?? product.id });

  return {
    ...fallback,
    title: seo.title || fallback.title,
    description: seo.description || fallback.description,
    alternates: { canonical },
    ...(seo.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BoutiqueProductPage({
  params,
}: BoutiqueProductPageProps) {
  const { boutiqueSlug, productId } = await params;
  const result = await resolveProduct(boutiqueSlug, productId);

  if (result.kind === "missing") {
    notFound();
  }

  // An old slug, or a colour merged into another product (F6): send the visitor (and search engines) to the product's current address.
  if (result.kind === "redirect") {
    const host = await resolveSeoHostContext();
    const path = storeCustomerPath(
      boutiqueSlug,
      trBoutiqueProductPath(boutiqueSlug, result.toParam),
      host.kind === "boutique" ? "boutique-domain" : "platform",
    );
    permanentRedirect(result.query ? `${path}?${result.query}` : path);
  }

  const { product } = result;
  const colorSiblings = await safeGetPublicColorSiblings(product);
  // A product with variants sells by variant; a failed read shows it like before
  // (checkout still requires a variant, so nothing can be bought wrongly).
  const variants = await loadPublicProductVariants(product).catch((error: unknown) => {
    console.error("[tr/pdp] variants failed:", error);
    return null;
  });
  const iyzicoCheckout = await boutiqueOffersIyzicoCheckout(
    product.boutique.slug,
  );

  return (
    <>
      <TrTrackViewItem
        productId={product.id}
        name={product.title}
        priceKurus={product.priceKurus}
      />
      <TrBoutiqueProductPage
        product={product}
        colorSiblings={colorSiblings}
        variants={variants}
        iyzicoCheckout={iyzicoCheckout}
      />
    </>
  );
}
