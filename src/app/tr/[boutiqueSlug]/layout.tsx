import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loadStorefrontTaxonomyNodes } from "@/lib/tr/catalog/categories";
import { fashionShopAllLabelFor } from "@/lib/tr/fashion/categoryTemplate";
import { TrBoutiqueEditorialShell } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialShell";
import { TrIyzicoBuyerProtection } from "@/components/tr/commerce/TrIyzicoBuyerProtection";
import { getIyzicoBuyerProtection } from "@/lib/tr/payments/registry";
import {
  resolveBoutiqueBrandLabel,
  resolveBoutiqueDocumentDescription,
  resolveBoutiqueDocumentTitle,
  resolveBoutiqueFaviconUrl,
} from "@/lib/tr/boutiqueBrand";
import { BOUTIQUE_SLUG_HEADER } from "@/lib/introLoader";
import {
  safeGetBoutiqueStorefront,
  safeGetPublicBoutique,
} from "@/lib/tr/publicData";
import { siteLegal } from "@/lib/siteLegal";
import { normalizeBoutiqueHost } from "@/lib/tr/customDomain";
import { trBoutiquePath } from "@/lib/tr/paths";

/** Static marketplace segments — must not be captured by [boutiqueSlug]. */
const RESERVED_BOUTIQUE_SLUGS = new Set([
  "ara",
  "urunler",
  "favoriler",
  "butikler",
  "kombin",
  "kombinler",
  "parca",
  "sepet",
  "odeme",
  "cart",
  "checkout",
  "siparis-onay",
  "siparisler",
  "yakinda",
  "shop",
  "panel",
  "dev",
]);

/** Never cache empty/404 boutique lookups — storefronts are DB-backed. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface BoutiqueLayoutProps {
  children: React.ReactNode;
  params: Promise<{ boutiqueSlug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ boutiqueSlug: string }>;
}): Promise<Metadata> {
  const { boutiqueSlug } = await params;
  if (RESERVED_BOUTIQUE_SLUGS.has(boutiqueSlug)) {
    return {};
  }

  const boutique = await safeGetPublicBoutique(boutiqueSlug);
  if (!boutique) {
    return { title: "Butik bulunamadı" };
  }

  const favicon = resolveBoutiqueFaviconUrl(boutique);
  const brandTitle = resolveBoutiqueBrandLabel(boutique.slug, boutique.name);
  const documentTitle = resolveBoutiqueDocumentTitle(
    boutique.slug,
    boutique.name,
    boutique.editorialContent,
  );
  const documentDescription = resolveBoutiqueDocumentDescription(
    boutique.slug,
    boutique.description,
    boutique.name,
    boutique.editorialContent,
  );

  const headerList = await headers();
  const requestHost = normalizeBoutiqueHost(
    headerList.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      headerList.get("host") ||
      "",
  );
  const hostSlug = headerList.get(BOUTIQUE_SLUG_HEADER)?.trim() || null;
  const onBoutiqueDomain = hostSlug === boutique.slug;
  const metadataBase = new URL(
    onBoutiqueDomain && requestHost
      ? `https://${requestHost}`
      : siteLegal.siteUrl,
  );
  const canonicalPath = onBoutiqueDomain
    ? "/"
    : trBoutiquePath(boutique.slug);

  return {
    // `absolute` + local template so parent `/tr` “— Cortisstyle” does not leak onto white-label boutiques.
    metadataBase,
    title: {
      absolute: documentTitle,
      default: documentTitle,
      template: `%s · ${brandTitle}`,
    },
    description: documentDescription,
    alternates: {
      canonical: canonicalPath,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      locale: "tr_TR",
      siteName: brandTitle,
      title: documentTitle,
      description: documentDescription,
      url: canonicalPath,
    },
    icons: favicon
      ? {
          icon: [{ url: favicon, type: "image/png", sizes: "96x96" }],
          shortcut: [{ url: favicon, type: "image/png" }],
          apple: [{ url: favicon, type: "image/png", sizes: "180x180" }],
        }
      : undefined,
  };
}

export default async function BoutiqueLayout({
  children,
  params,
}: BoutiqueLayoutProps) {
  const { boutiqueSlug } = await params;

  if (RESERVED_BOUTIQUE_SLUGS.has(boutiqueSlug)) {
    notFound();
  }

  const boutique = await safeGetPublicBoutique(boutiqueSlug);

  if (!boutique) {
    notFound();
  }

  const storefront = await safeGetBoutiqueStorefront(boutiqueSlug);
  // A boutique on its own categories: the menu, filters and labels use them.
  const categoryNodes = await loadStorefrontTaxonomyNodes(
    boutique.id,
    boutique.catalogProfile === "fashion" ? fashionShopAllLabelFor : undefined,
  );
  const shell = (
    <TrBoutiqueEditorialShell
      boutique={boutique}
      products={storefront?.products ?? []}
      categoryNodes={categoryNodes}
    >
      {children}
    </TrBoutiqueEditorialShell>
  );

  const buyerProtection = await getIyzicoBuyerProtection(boutique.slug);

  return (
    <>
      <TrIyzicoBuyerProtection
        boutiqueSlug={boutique.slug}
        config={buyerProtection}
      />
      {shell}
    </>
  );
}
