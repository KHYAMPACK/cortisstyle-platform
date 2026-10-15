import { TrBoutiqueEditorialCatalog } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialCatalog";
import { TrBoutiqueEditorialSections } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialSections";
import { TrBoutiqueNaturalHome } from "@/components/tr/boutique/natural/TrBoutiqueNaturalHome";
import { isAtelierEditorialSkin, isNaturalEditorialSkin } from "@/lib/tr/boutiqueHome";
import type { TrBoutiquePublic, TrProduct } from "@/types/tr-marketplace";

interface TrBoutiqueEditorialHomeProps {
  boutique: TrBoutiquePublic;
  products: TrProduct[];
}

export function TrBoutiqueEditorialHome({
  boutique,
  products,
}: TrBoutiqueEditorialHomeProps) {
  const atelier = isAtelierEditorialSkin(boutique.slug);

  if (isNaturalEditorialSkin(boutique.slug)) {
    return <TrBoutiqueNaturalHome boutique={boutique} products={products} />;
  }

  return (
    <>
      <TrBoutiqueEditorialSections boutique={boutique} products={products} />
      {!atelier ? (
        <TrBoutiqueEditorialCatalog
          products={products}
          boutiqueSlug={boutique.slug}
          boutiqueName={boutique.name}
        />
      ) : null}
    </>
  );
}
