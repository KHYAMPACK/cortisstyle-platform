"use client";

import { useEffect } from "react";
import { TrBoutiqueCatalogProvider } from "@/components/tr/boutique/TrBoutiqueCatalogContext";
import {
  TrBoutiqueTaxonomyProvider,
  useStorefrontTaxonomy,
} from "@/components/tr/boutique/TrBoutiqueTaxonomy";
import { TrBoutiqueCommerceScopeProvider } from "@/components/tr/boutique/TrBoutiqueCommerceScope";
import { TrBoutiqueCookieNotice } from "@/components/tr/boutique/TrBoutiqueCookieNotice";
import { TrBoutiqueTracker } from "@/components/tr/boutique/TrBoutiqueTracker";
import { TrBoutiqueEditorialCommercePanels } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialCommercePanels";
import { TrBoutiqueEditorialFooter } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialFooter";
import { TrBoutiqueEditorialHeader } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialHeader";
import { TrBoutiqueEditorialHelpFab } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialHelpFab";
import {
  TrBoutiqueNavPendingProvider,
  TrBoutiquePendingMain,
} from "@/components/tr/boutique/editorial/TrBoutiqueNavPending";
import { TrBoutiqueProductsProvider } from "@/components/tr/boutique/TrBoutiqueProductsContext";
import { TrAddedToCartSheet } from "@/components/tr/TrAddedToCartSheet";
import { resolveBoutiqueThemeAccent } from "@/lib/tr/boutiqueBrand";
import { resolveEditorialSkin } from "@/lib/tr/boutiqueHome";
import { trBoutiqueLegalPath } from "@/lib/tr/paths";
import { hasTracking } from "@/lib/tr/tracking/config";
import type { TrTaxonomyNode } from "@/lib/tr/categories/taxonomy";
import type { TrBoutiquePublic, TrProduct } from "@/types/tr-marketplace";

interface TrBoutiqueEditorialShellProps {
  boutique: TrBoutiquePublic;
  products?: TrProduct[];
  /** The boutique's categories, as storefront nodes (see `loadStorefrontTaxonomyNodes`). */
  categoryNodes?: TrTaxonomyNode[];
  children: React.ReactNode;
}

export function TrBoutiqueEditorialShell({
  boutique,
  products = [],
  categoryNodes = [],
  children,
}: TrBoutiqueEditorialShellProps) {
  return (
    <TrBoutiqueTaxonomyProvider nodes={categoryNodes}>
      <EditorialShell boutique={boutique} products={products}>
        {children}
      </EditorialShell>
    </TrBoutiqueTaxonomyProvider>
  );
}

function EditorialShell({
  boutique,
  products,
  children,
}: {
  boutique: TrBoutiquePublic;
  products: TrProduct[];
  children: React.ReactNode;
}) {
  const categories = useStorefrontTaxonomy().forProducts(products);
  const accent = resolveBoutiqueThemeAccent(boutique);
  const skin = resolveEditorialSkin(boutique.slug);

  // Portaled sheets (size gate, etc.) render outside the shell — sync brand vars on <html>.
  useEffect(() => {
    const root = document.documentElement;
    const prevPrimary = root.style.getPropertyValue("--brand-primary");
    const prevHover = root.style.getPropertyValue("--brand-primary-hover");
    const prevMuted = root.style.getPropertyValue("--brand-primary-muted");

    root.style.setProperty("--brand-primary", accent);
    root.style.setProperty(
      "--brand-primary-hover",
      `color-mix(in srgb, ${accent} 82%, black)`,
    );
    root.style.setProperty(
      "--brand-primary-muted",
      `color-mix(in srgb, ${accent} 12%, transparent)`,
    );

    return () => {
      if (prevPrimary) root.style.setProperty("--brand-primary", prevPrimary);
      else root.style.removeProperty("--brand-primary");
      if (prevHover) root.style.setProperty("--brand-primary-hover", prevHover);
      else root.style.removeProperty("--brand-primary-hover");
      if (prevMuted) root.style.setProperty("--brand-primary-muted", prevMuted);
      else root.style.removeProperty("--brand-primary-muted");
    };
  }, [accent]);

  return (
    <TrBoutiqueCommerceScopeProvider
      boutiqueSlug={boutique.slug}
      boutiqueName={boutique.name}
    >
      <TrBoutiqueProductsProvider boutique={boutique} products={products}>
        <TrBoutiqueCatalogProvider categories={categories}>
          <div
            data-editorial-skin={skin}
            className={`flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-clip text-neutral-900 ${
              skin === "atelier" ? "bg-[#FAFAF8]" : "bg-white"
            }`}
            style={
              {
                "--boutique-accent": accent,
                "--boutique-sale":
                  skin === "atelier" ? accent : "#C41E3A",
                "--brand-primary": accent,
                "--brand-primary-hover": `color-mix(in srgb, ${accent} 82%, black)`,
                "--brand-primary-muted": `color-mix(in srgb, ${accent} 12%, transparent)`,
              } as React.CSSProperties
            }
          >
            <TrBoutiqueNavPendingProvider>
              <TrBoutiqueEditorialHeader boutique={boutique} />
              <main className="min-w-0 flex-1 overflow-x-clip">
                <TrBoutiquePendingMain>{children}</TrBoutiquePendingMain>
              </main>
            </TrBoutiqueNavPendingProvider>
            <TrBoutiqueEditorialFooter boutique={boutique} />
            <TrBoutiqueEditorialHelpFab />
            <TrBoutiqueEditorialCommercePanels />
            <TrAddedToCartSheet />
            <TrBoutiqueCookieNotice
              privacyHref={trBoutiqueLegalPath(boutique.slug, "cerez")}
              usesTracking={hasTracking(boutique.tracking)}
            />
            <TrBoutiqueTracker tracking={boutique.tracking} />
          </div>
        </TrBoutiqueCatalogProvider>
      </TrBoutiqueProductsProvider>
    </TrBoutiqueCommerceScopeProvider>
  );
}
