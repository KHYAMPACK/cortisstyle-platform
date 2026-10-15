"use client";

import { useTrScopedCart } from "@/components/tr/boutique/TrBoutiqueCommerceScope";
import { TrBoutiqueModelMeasurements } from "@/components/tr/fashion/pdp/TrBoutiqueModelMeasurements";
import { TrBoutiquePdpInfoSections } from "@/components/tr/boutique/pdp/TrBoutiquePdpInfoSections";
import { TrBackButton } from "@/components/tr/TrBackButton";
import {
  TrEditorialSaleBadge,
  discountPercentFromPrices,
} from "@/components/tr/boutique/editorial/TrEditorialSaleBadge";
import { TrFavoriteButton } from "@/components/tr/TrFavoriteButton";
import { TrMobileBuyBar } from "@/components/tr/TrMobileBuyBar";
import { TrProductColorPicker } from "@/components/tr/TrProductColorPicker";
import { TrProductColorSiblings } from "@/components/tr/product/TrProductColorSiblings";
import { TrVariantPicker, usePdpVariants } from "@/components/tr/product/TrPdpVariants";
import { TrVariantGateSheet } from "@/components/tr/commerce/TrVariantGateSheet";
import { TrProductPurchasePanel } from "@/components/tr/TrProductPurchasePanel";
import { TrProductSizePicker } from "@/components/tr/TrProductSizePicker";
import { TrPurchaseActions } from "@/components/tr/TrPurchaseActions";
import { TrSizeGateSheet } from "@/components/tr/TrSizeGateSheet";
import { TrSoftNavLink } from "@/components/tr/TrSoftNavLink";
import { useStorefrontTaxonomy } from "@/components/tr/boutique/TrBoutiqueTaxonomy";
import { EDITORIAL_SALE_RED, isAtelierEditorialSkin } from "@/lib/tr/boutiqueHome";
import { beginBuyNowCheckout, type TrPurchaseIntent } from "@/lib/tr/buyNow";
import { getProductCoverImageFor } from "@/lib/tr/productImages";
import {
  resolveProductColors,
  resolveProductSizes,
} from "@/lib/tr/productOptions";
import { resolveProductModelScale } from "@/lib/tr/fashion/modelMeasurements";
import { isSizeInStock } from "@/lib/tr/sizeStocks";
import { trBoutiquePath, trBoutiqueProductsPath } from "@/lib/tr/paths";
import { resolveBoutiqueThemeAccent } from "@/lib/tr/boutiqueBrand";
import { useTrAddedToCartStore } from "@/store/trAddedToCartStore";
import { priceRange, publicVariantLabel } from "@/lib/tr/variants/storefront";
import { formatTryFromKurus } from "@/types/tr-marketplace";
import type { TrProductWithBoutique } from "@/types/tr-marketplace";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface TrProductDetailPanelProps {
  product: TrProductWithBoutique;
  branded: boolean;
  colorSiblings?: TrProductWithBoutique[];
  iyzicoCheckout?: boolean;
}

export function TrProductDetailPanel({
  product,
  branded,
  colorSiblings = [],
  iyzicoCheckout = false,
}: TrProductDetailPanelProps) {
  const sizes = useMemo(() => resolveProductSizes(product), [product]);
  const inStockSizes = useMemo(
    () => sizes.filter((size) => isSizeInStock(product.sizeStocks, size)),
    [sizes, product.sizeStocks],
  );
  const colors = useMemo(() => resolveProductColors(product), [product]);
  const accent = resolveBoutiqueThemeAccent(product.boutique);
  const atelier = isAtelierEditorialSkin(product.boutique.slug);
  const categoryLabel = useStorefrontTaxonomy().label(product.category);
  const isAvailable = product.status === "available";
  const cart = useTrScopedCart();
  const router = useRouter();
  // A product with variants sells by variant: the picker replaces colours and sizes.
  const pdp = usePdpVariants();
  const variant = pdp?.variant ?? null;
  const range = pdp ? priceRange(pdp.data) : null;
  const variantImage = variant?.images[0] ?? null;
  const chosenVariant =
    pdp && variant && pdp.label
      ? {
          id: variant.id,
          label: pdp.label,
          priceKurus: variant.priceKurus,
          image: variantImage ?? getProductCoverImageFor("marketplace", product),
        }
      : null;

  const [selectedSize, setSelectedSize] = useState<string | null>(
    inStockSizes.length === 1 ? inStockSizes[0]! : null,
  );
  const [selectedColor, setSelectedColor] = useState(
    colors.length === 1 ? colors[0]! : (colors[0] ?? null),
  );
  const [sizeSheetOpen, setSizeSheetOpen] = useState(false);
  const [sizeGateIntent, setSizeGateIntent] = useState<TrPurchaseIntent>("add");
  const modelScale = useMemo(
    () =>
      resolveProductModelScale({
        sizes,
        features: product.features,
      }),
    [sizes, product.features],
  );

  const openAddedSheet = useTrAddedToCartStore((state) => state.open);

  const sizeRequired = !pdp && sizes.length > 0;
  const selectionRequired = pdp ? !variant : sizeRequired && !selectedSize;
  const sizeOutOfStock =
    !pdp &&
    Boolean(selectedSize) &&
    !isSizeInStock(product.sizeStocks, selectedSize!);
  const canOrder = pdp
    ? isAvailable && Boolean(variant && variant.stock > 0)
    : isAvailable &&
      (!sizeRequired || (Boolean(selectedSize) && !sizeOutOfStock));

  const backFallback = trBoutiquePath(product.boutique.slug);
  const backClass = branded
    ? "text-[11px] tracking-[0.12em] text-neutral-600 uppercase transition-colors hover:text-neutral-900"
    : "text-meta text-[10px] tracking-[0.22em] uppercase transition-colors hover:text-jet-black";

  // With variants: the chosen variant's price, else the cheapest ("…'den başlayan").
  const shownPrice = variant?.priceKurus ?? range?.min ?? product.priceKurus;
  const compareAt = pdp ? (variant?.compareAtPriceKurus ?? null) : product.compareAtPriceKurus;
  // Until a variant is chosen, a price that differs per option says so.
  const priceVaries = Boolean(pdp && !variant && range?.varies);
  const onSale =
    branded &&
    typeof compareAt === "number" &&
    compareAt > shownPrice;
  const salePct = onSale
    ? discountPercentFromPrices(shownPrice, compareAt)
    : 0;

  const openSizeGate = (intent: TrPurchaseIntent = "add") => {
    setSizeGateIntent(intent);
    setSizeSheetOpen(true);
  };

  const addWithSize = (size: string) => {
    if (!isSizeInStock(product.sizeStocks, size)) {
      setSelectedSize(size);
      setSizeSheetOpen(false);
      return;
    }
    setSelectedSize(size);
    setSizeSheetOpen(false);
    const image = getProductCoverImageFor("marketplace", product);
    const line = {
      productId: product.id,
      boutiqueId: product.boutiqueId,
      boutiqueName: product.boutique.name,
      boutiqueSlug: product.boutique.slug,
      title: product.title,
      priceKurus: product.priceKurus,
      image,
      size,
    };
    cart.addItem(line);
    if (sizeGateIntent === "buyNow") {
      router.push(beginBuyNowCheckout(line));
      return;
    }
    openAddedSheet({
      productId: product.id,
      title: product.title,
      priceKurus: product.priceKurus,
      image,
      size,
      color: selectedColor?.name ?? null,
      boutiqueName: product.boutique.name,
    });
  };

  return (
    <>
      <div className="pb-24 md:pb-0">
        <TrBackButton fallbackHref={backFallback} className={backClass} />

        {!branded ? (
          <p className="text-meta mt-6 text-[9px] tracking-[0.5em] uppercase">
            [ ÜRÜN ]
          </p>
        ) : null}

        {branded && !atelier && product.brand ? (
          <p className="mt-5 text-[11px] font-semibold tracking-[0.16em] text-[color:var(--nat-bark,#52525b)] uppercase">
            <TrSoftNavLink
              href={`${trBoutiqueProductsPath(product.boutique.slug)}?marka=${encodeURIComponent(product.brand)}`}
              className="transition-opacity hover:opacity-70"
            >
              {product.brand}
            </TrSoftNavLink>
          </p>
        ) : null}

        <div
          className={`flex items-start justify-between gap-4 ${
            branded ? (product.brand && !atelier ? "mt-2" : "mt-4") : "mt-3"
          }`}
        >
          <h1
            className={
              branded
                ? atelier
                  ? "font-serif text-[1.85rem] leading-tight font-light tracking-[-0.01em] text-neutral-950 md:text-[2.35rem]"
                  : "font-serif text-3xl tracking-tight text-neutral-950 md:text-4xl"
                : "font-serif text-3xl leading-none tracking-[-0.03em] text-neutral-950 md:text-4xl"
            }
          >
            {product.title}
          </h1>
          <TrFavoriteButton
            product={product}
            className="h-9 w-9 shrink-0"
            size="md"
          />
        </div>

        {onSale ? (
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className="text-[15px] tracking-[-0.01em] text-neutral-400 line-through md:text-[16px]">
              {formatTryFromKurus(compareAt)}
            </span>
            <span
              className="text-[1.65rem] font-medium tracking-[-0.02em] md:text-[1.85rem]"
              style={{ color: atelier ? accent : EDITORIAL_SALE_RED }}
            >
              {formatTryFromKurus(shownPrice)}
            </span>
            {salePct > 0 ? (
              <TrEditorialSaleBadge percent={salePct} size="md" />
            ) : null}
          </div>
        ) : (
          <p
            className={
              branded
                ? atelier
                  ? "mt-4 text-[1.65rem] font-medium tracking-[-0.02em] text-neutral-950 md:text-[1.85rem]"
                  : "mt-4 text-[1.65rem] font-semibold tracking-[-0.02em] text-neutral-950 md:text-[1.85rem]"
                : "mt-4 font-serif text-2xl tracking-[-0.02em] text-brand-primary"
            }
          >
            {formatTryFromKurus(shownPrice)}
            {priceVaries ? (
              <span className="ml-2 text-[12px] font-normal tracking-normal text-neutral-500">
                seçeneğe göre değişir
              </span>
            ) : null}
          </p>
        )}

        {pdp ? (
          <TrVariantPicker
            data={pdp.data}
            selection={pdp.selection}
            onPick={pdp.pick}
            accentColor={accent}
          />
        ) : colorSiblings.length >= 2 ? (
          <TrProductColorSiblings
            product={product}
            siblings={colorSiblings}
            accentColor={accent}
          />
        ) : (
          <TrProductColorPicker
            colors={colors}
            selectedColor={selectedColor}
            onChange={setSelectedColor}
            accentColor={accent}
          />
        )}

        {pdp ? null : (
        <TrProductSizePicker
          sizes={sizes}
          selectedSize={selectedSize}
          onChange={setSelectedSize}
          sizeStocks={product.sizeStocks}
          productTitle={product.title}
          whatsappPhone={product.boutique.whatsappPhone}
          accentColor={accent}
        />
        )}

        {modelScale ? (
          <TrBoutiqueModelMeasurements scale={modelScale} />
        ) : null}

        <dl
          className={`mt-6 space-y-3 text-[12px] ${
            branded
              ? "border-t border-black/5 pt-6"
              : "border-t border-blueprint-border pt-6"
          }`}
        >
          {!branded ? (
            <div className="flex gap-4">
              <dt className="text-meta w-28 shrink-0 tracking-[0.12em] uppercase">
                Satıcı
              </dt>
              <dd>
                <TrSoftNavLink
                  href={trBoutiquePath(product.boutique.slug)}
                  className="text-jet-black underline underline-offset-2"
                >
                  {product.boutique.name}
                </TrSoftNavLink>
              </dd>
            </div>
          ) : null}
          {product.conditionLabel ? (
            <div className="flex gap-4">
              <dt
                className={
                  branded
                    ? "w-28 shrink-0 text-neutral-500"
                    : "text-meta w-28 shrink-0 tracking-[0.12em] uppercase"
                }
              >
                Durum
              </dt>
              <dd>{product.conditionLabel}</dd>
            </div>
          ) : null}
          {categoryLabel ? (
            <div className="flex gap-4">
              <dt
                className={
                  branded
                    ? "w-28 shrink-0 text-neutral-500"
                    : "text-meta w-28 shrink-0 tracking-[0.12em] uppercase"
                }
              >
                Kategori
              </dt>
              <dd>{categoryLabel}</dd>
            </div>
          ) : null}
          <div className="flex gap-4">
            <dt
              className={
                branded
                  ? "w-28 shrink-0 text-neutral-500"
                  : "text-meta w-28 shrink-0 tracking-[0.12em] uppercase"
              }
            >
              Stok
            </dt>
            <dd>
              {pdp && variant && variant.stock <= 0
                ? `${pdp.label} stokta yok`
                : sizeOutOfStock
                  ? `${selectedSize} stokta yok`
                  : isAvailable
                    ? "Satışta"
                    : "Satıldı"}
            </dd>
          </div>
        </dl>

        {product.descriptionHtml && !atelier ? (
          <div
            className={`mt-6 pt-6 ${
              branded
                ? "border-t border-black/5"
                : "border-t border-blueprint-border"
            }`}
          >
            <p className="text-[11px] tracking-[0.1em] text-neutral-500 uppercase">
              Ürün detay
            </p>
            <div
              className="rich-prose mt-3 text-[14px] leading-relaxed text-neutral-800"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          </div>
        ) : product.description ? (
          <div
            className={`mt-6 pt-6 ${
              branded
                ? "border-t border-black/5"
                : "border-t border-blueprint-border"
            }`}
          >
            {!branded ? (
              <p className="text-meta text-[10px] tracking-[0.18em] uppercase">
                Ürün Detay
              </p>
            ) : (
              <p className="text-[11px] tracking-[0.1em] text-neutral-500 uppercase">
                Ürün Detay
              </p>
            )}
            <p className="mt-3 text-[13px] leading-relaxed text-neutral-800">
              {product.description}
            </p>
          </div>
        ) : null}

        <TrProductPurchasePanel
          product={product}
          selectedSize={selectedSize}
          selectedColor={selectedColor?.name ?? null}
          canOrder={canOrder}
          selectionRequired={selectionRequired}
          sizeOutOfStock={sizeOutOfStock}
          onRequestSelection={openSizeGate}
          variant={chosenVariant}
          className="hidden md:block"
          iyzicoCheckout={iyzicoCheckout}
        />

        <TrProductPurchasePanel
          product={product}
          selectedSize={selectedSize}
          selectedColor={selectedColor?.name ?? null}
          canOrder={canOrder}
          selectionRequired={selectionRequired}
          sizeOutOfStock={sizeOutOfStock}
          onRequestSelection={openSizeGate}
          variant={chosenVariant}
          hideActions
          className="md:hidden"
          iyzicoCheckout={iyzicoCheckout}
        />

        <TrBoutiquePdpInfoSections product={product} branded={branded} />
      </div>

      {isAvailable ? (
        <TrMobileBuyBar>
          <TrPurchaseActions
            productId={product.id}
            boutiqueId={product.boutiqueId}
            boutiqueName={product.boutique.name}
            boutiqueSlug={product.boutique.slug}
            title={product.title}
            priceKurus={chosenVariant?.priceKurus ?? product.priceKurus}
            image={chosenVariant?.image ?? getProductCoverImageFor("marketplace", product)}
            size={pdp ? null : selectedSize}
            variantId={chosenVariant?.id ?? null}
            variantLabel={chosenVariant?.label ?? null}
            color={pdp ? null : (selectedColor?.name ?? null)}
            status={product.status}
            selectionRequired={selectionRequired}
            onRequestSelection={openSizeGate}
            sizeOutOfStock={sizeOutOfStock}
            whatsappPhone={product.boutique.whatsappPhone}
          />
        </TrMobileBuyBar>
      ) : null}

      {pdp ? (
        <TrVariantGateSheet
          open={sizeSheetOpen}
          onClose={() => setSizeSheetOpen(false)}
          data={pdp.data}
          initial={pdp.selection}
          accentColor={accent}
          confirmLabel={sizeGateIntent === "buyNow" ? "Hemen al" : "Sepete ekle"}
          onConfirm={(picked, selection) => {
            for (const [typeId, valueId] of Object.entries(selection)) {
              pdp.pick(typeId, valueId);
            }
            setSizeSheetOpen(false);
            const label = publicVariantLabel(pdp.data, picked);
            const image = picked.images[0] ?? getProductCoverImageFor("marketplace", product);
            const line = {
              productId: product.id,
              boutiqueId: product.boutiqueId,
              boutiqueName: product.boutique.name,
              boutiqueSlug: product.boutique.slug,
              title: product.title,
              priceKurus: picked.priceKurus,
              image,
              size: null,
              variantId: picked.id,
              variantLabel: label,
            };
            cart.addItem(line);
            if (sizeGateIntent === "buyNow") {
              router.push(beginBuyNowCheckout(line));
              return;
            }
            openAddedSheet({
              productId: product.id,
              title: product.title,
              priceKurus: picked.priceKurus,
              image,
              size: label,
              color: null,
              boutiqueName: product.boutique.name,
            });
          }}
        />
      ) : (
      <TrSizeGateSheet
        open={sizeSheetOpen}
        onClose={() => setSizeSheetOpen(false)}
        sizes={sizes}
        initialSize={selectedSize}
        sizeStocks={product.sizeStocks}
        productTitle={product.title}
        whatsappPhone={product.boutique.whatsappPhone}
        accentColor={accent}
        confirmLabel={sizeGateIntent === "buyNow" ? "Hemen al" : "Sepete ekle"}
        onConfirm={addWithSize}
      />
      )}

    </>
  );
}
