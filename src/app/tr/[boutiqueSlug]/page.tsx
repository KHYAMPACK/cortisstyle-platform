import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrBoutiqueEditorialHome } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialHome";
import {
  resolveBoutiqueDocumentDescription,
  resolveBoutiqueDocumentTitle,
} from "@/lib/tr/boutiqueBrand";
import { safeGetBoutiqueStorefront } from "@/lib/tr/publicData";

interface BoutiqueStorefrontPageProps {
  params: Promise<{ boutiqueSlug: string }>;
}

export async function generateMetadata({
  params,
}: BoutiqueStorefrontPageProps): Promise<Metadata> {
  const { boutiqueSlug } = await params;
  const storefront = await safeGetBoutiqueStorefront(boutiqueSlug);

  if (!storefront) {
    return { title: "Butik bulunamadı" };
  }

  const documentTitle = resolveBoutiqueDocumentTitle(
    storefront.slug,
    storefront.name,
    storefront.editorialContent,
  );

  return {
    title: {
      absolute: documentTitle,
    },
    description: resolveBoutiqueDocumentDescription(
      storefront.slug,
      storefront.description,
      storefront.name,
      storefront.editorialContent,
    ),
  };
}

export default async function BoutiqueStorefrontPage({
  params,
}: BoutiqueStorefrontPageProps) {
  const { boutiqueSlug } = await params;
  const storefront = await safeGetBoutiqueStorefront(boutiqueSlug);

  if (!storefront) {
    notFound();
  }

  return (
    <TrBoutiqueEditorialHome
      boutique={storefront}
      products={storefront.products}
    />
  );
}
