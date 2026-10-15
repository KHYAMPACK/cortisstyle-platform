"use client";

import { TrPanelLink as Link } from "@/components/tr/panel/TrPanelLink";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TrOwnerPanelGate } from "@/components/tr/panel/TrOwnerPanelGate";
import { TrCampaignTypeChooser } from "@/components/tr/panel/discounts/TrCampaignTypeChooser";
import {
  TrPanelDataTable,
  TrPanelDataTableCell,
  TrPanelDataTableRow,
} from "@/components/tr/panel/TrPanelDataTable";
import {
  panelBackLinkClass,
  panelEmptyClass,
  panelErrorClass,
  panelPageTitleClass,
  panelPrimaryBtnClass,
  panelSecondaryBtnClass,
} from "@/components/tr/panel/panelUi";
import {
  TrPanelFadeIn,
  TrPanelListSkeleton,
} from "@/components/tr/panel/TrPanelMotion";
import {
  fetchOwnerDiscountCampaigns,
  fetchOwnerProducts,
  peekOwnerProducts,
  updateOwnerProduct,
} from "@/lib/tr/ownerClient";
import type { TrDiscountCampaign } from "@/lib/tr/discounts/types";
import {
  trPanelEditCampaignPath,
  trPanelEditProductPath,
  trPanelPath,
} from "@/lib/tr/paths";
import { formatTryFromKurus, type TrProduct } from "@/types/tr-marketplace";

function campaignSummary(campaign: TrDiscountCampaign): string {
  if (campaign.discountType === "percent") return `%${campaign.percentOff} indirim`;
  if (campaign.discountType === "fixed") {
    return `${formatTryFromKurus(campaign.amountOffKurus ?? 0)} indirim`;
  }
  return "Ücretsiz kargo";
}

function CampaignsList({ boutiqueId }: { boutiqueId: string }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<TrDiscountCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOwnerDiscountCampaigns(boutiqueId)
      .then((result) => {
        if (!cancelled) setCampaigns(result);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Kampanyalar yüklenemedi.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boutiqueId]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[19px] font-semibold text-neutral-900">Kampanyalar</h3>
        <button
          type="button"
          onClick={() => setChooserOpen(true)}
          className={panelPrimaryBtnClass}
        >
          Kampanya Ekle
        </button>
      </div>

      {error && !campaigns ? (
        <p className={panelErrorClass}>{error}</p>
      ) : !campaigns ? (
        <TrPanelListSkeleton rows={3} label="Kampanyalar yükleniyor" />
      ) : campaigns.length === 0 ? (
        <div className={panelEmptyClass}>
          <p className="font-semibold text-neutral-900">Henüz kampanya eklemediniz.</p>
          <p className="mt-1">Koşullara göre otomatik uygulanan bir indirim oluşturun.</p>
        </div>
      ) : (
        <TrPanelFadeIn>
          <TrPanelDataTable headers={["Kampanya", "İndirim", "Durum"]}>
            {campaigns.map((campaign) => {
              const href = trPanelEditCampaignPath(campaign.id);
              return (
                <TrPanelDataTableRow
                  key={campaign.id}
                  onActivate={() => router.push(href)}
                  onPointerEnter={() => router.prefetch(href)}
                >
                  <TrPanelDataTableCell>
                    <div className="min-w-0">
                      <Link
                        href={href}
                        className="max-w-[320px] truncate font-semibold text-neutral-900 hover:underline"
                      >
                        {campaign.title}
                      </Link>
                      <p className="truncate text-[12px] text-neutral-500">
                        {campaign.kind === "automatic" ? "Otomatik İndirim" : "İndirim Kodu"}
                      </p>
                    </div>
                  </TrPanelDataTableCell>
                  <TrPanelDataTableCell>
                    <span className="rounded-lg bg-[color:var(--panel-accent-soft)] px-2.5 py-1 text-[13px] font-semibold text-neutral-800">
                      {campaignSummary(campaign)}
                    </span>
                  </TrPanelDataTableCell>
                  <TrPanelDataTableCell>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[13px] font-semibold ${
                        campaign.active
                          ? "bg-emerald-50 text-emerald-900"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {campaign.active ? "Aktif" : "Pasif"}
                    </span>
                  </TrPanelDataTableCell>
                </TrPanelDataTableRow>
              );
            })}
          </TrPanelDataTable>
        </TrPanelFadeIn>
      )}

      <TrCampaignTypeChooser open={chooserOpen} onClose={() => setChooserOpen(false)} />
    </section>
  );
}

function ProductSalesList({ boutiqueId }: { boutiqueId: string }) {
  const cached = peekOwnerProducts(boutiqueId);
  const [products, setProducts] = useState<TrProduct[]>(cached?.products ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOwnerProducts(boutiqueId)
      .then((result) => {
        if (!cancelled) setProducts(result.products);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Ürün indirimleri yüklenemedi.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boutiqueId]);

  const onSale = products.filter(
    (product) =>
      typeof product.compareAtPriceKurus === "number" &&
      product.compareAtPriceKurus > product.priceKurus,
  );

  const clearSale = async (product: TrProduct) => {
    setSaving(true);
    setError(null);
    try {
      await updateOwnerProduct(product.id, { compareAtPriceTry: null });
      const result = await fetchOwnerProducts(boutiqueId);
      setProducts(result.products);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "İndirim kaldırılamadı.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[19px] font-semibold text-neutral-900">Ürün indirimleri</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
          Ürün düzenlerken eski fiyat girerek indirim açın.
        </p>
      </div>

      {error ? <p className={panelErrorClass}>{error}</p> : null}

      {loading && products.length === 0 ? (
        <TrPanelListSkeleton rows={2} label="Ürün indirimleri yükleniyor" />
      ) : onSale.length === 0 ? (
        <p className={panelEmptyClass}>Aktif ürün indirimi yok.</p>
      ) : (
        <TrPanelFadeIn>
          <TrPanelDataTable headers={["Ürün", "Fiyat", ""]}>
            {onSale.map((product) => {
              const href = trPanelEditProductPath(product.id);
              return (
                <TrPanelDataTableRow key={product.id}>
                  <TrPanelDataTableCell>
                    <Link
                      href={href}
                      className="max-w-[320px] truncate font-semibold text-neutral-900 hover:underline"
                    >
                      {product.title}
                    </Link>
                  </TrPanelDataTableCell>
                  <TrPanelDataTableCell>
                    {formatTryFromKurus(product.priceKurus)}
                    {product.compareAtPriceKurus ? (
                      <span className="ml-2 text-neutral-400 line-through">
                        {formatTryFromKurus(product.compareAtPriceKurus)}
                      </span>
                    ) : null}
                  </TrPanelDataTableCell>
                  <TrPanelDataTableCell className="text-right">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void clearSale(product)}
                      className={panelSecondaryBtnClass}
                    >
                      İndirimi kaldır
                    </button>
                  </TrPanelDataTableCell>
                </TrPanelDataTableRow>
              );
            })}
          </TrPanelDataTable>
        </TrPanelFadeIn>
      )}
    </section>
  );
}

export function TrOwnerCampaignsPage() {
  return (
    <TrOwnerPanelGate>
      {({ activeBoutique }) => (
        <div className="space-y-6">
          <div>
            <Link href={trPanelPath()} className={panelBackLinkClass}>
              ← Giriş
            </Link>
            <h2 className={panelPageTitleClass}>İndirimler</h2>
          </div>
          <CampaignsList boutiqueId={activeBoutique.id} />
          <ProductSalesList boutiqueId={activeBoutique.id} />
        </div>
      )}
    </TrOwnerPanelGate>
  );
}
