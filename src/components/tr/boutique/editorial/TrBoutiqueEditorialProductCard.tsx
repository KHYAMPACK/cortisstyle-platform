"use client";

import Image from "next/image";
import { TrFavoriteButton } from "@/components/tr/TrFavoriteButton";
import { TrQuickAddToCartButton } from "@/components/tr/TrQuickAddToCartButton";
import {
  TrEditorialSaleBadge,
  discountPercentFromPrices,
} from "@/components/tr/boutique/editorial/TrEditorialSaleBadge";
import { TrBoutiquePendingLink } from "@/components/tr/boutique/editorial/TrBoutiqueNavPending";
import { EDITORIAL_SALE_RED, isAtelierEditorialSkin } from "@/lib/tr/boutiqueHome";
import { trProductPath } from "@/lib/tr/paths";
import { resolveProductColors } from "@/lib/tr/productOptions";
import { EMPTY_TRACKING } from "@/lib/tr/tracking/config";
import {
  getProductCoverImageFor,
  getProductHoverImage,
  isCatalogCutoutImage,
} from "@/lib/tr/productImages";
import {
  formatTryFromKurus,
  type TrProduct,
  type TrProductWithBoutique,
} from "@/types/tr-marketplace";

interface TrBoutiqueEditorialProductCardProps {
  product: TrProduct;
  boutiqueSlug: string;
  boutiqueName: string;
  priority?: boolean;
  /** Tighter title block — used in home category marquees. */
  compact?: boolean;
  sizes?: string;
}

const DEFAULT_CARD_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

export function TrBoutiqueEditorialProductCard({
  product,
  boutiqueSlug,
  boutiqueName,
  priority = false,
  compact = false,
  sizes = DEFAULT_CARD_SIZES,
}: TrBoutiqueEditorialProductCardProps) {
  const packshotImage = getProductCoverImageFor("boutique", product);
  const modelImage = getProductHoverImage(product);
  const packshotIsCutout = isCatalogCutoutImage(packshotImage);
  const colors = resolveProductColors(product);
  const isSold = product.status === "sold";
  const isNew = product.conditionLabel?.toLocaleLowerCase("tr").includes("yeni");
  const compareAt = product.compareAtPriceKurus;
  const onSale = typeof compareAt === "number" && compareAt > product.priceKurus;
  const pct = onSale
    ? discountPercentFromPrices(product.priceKurus, compareAt)
    : 0;
  const productHref = trProductPath(product.id, boutiqueSlug);
  const atelier = isAtelierEditorialSkin(boutiqueSlug);
  const saleColor = atelier ? "var(--boutique-accent)" : EDITORIAL_SALE_RED;

  const withBoutique: TrProductWithBoutique = {
    ...product,
    boutique: {
      id: product.boutiqueId,
      slug: boutiqueSlug,
      name: boutiqueName,
      legalName: null,
      description: null,
      logoUrl: null,
      whatsappPhone: null,
      instagramHandle: null,
      themeAccent: "#111111",
      catalogProfile: "fashion",
      shippingNote: null,
      exchangePolicy: null,
      physicalAddress: null,
      customDomain: null,
      vergiNo: null,
      vergiDairesi: null,
      mersisNo: null,
      kepAddress: null,
      tracking: EMPTY_TRACKING,
      editorialContent: null,
      contactEmail: null,
      shippingFeeKurus: 0,
      freeShippingMinItems: null,
      freeShippingMinSubtotalKurus: null,
      status: "verified",
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    },
  };

  return (
    <article
      className={`group relative ${atelier ? "bg-transparent" : "bg-white"}`}
    >
      <div
        className={`relative overflow-hidden ${
          atelier ? "aspect-[3/4.2]" : "aspect-[3/4]"
        } ${packshotIsCutout || atelier ? "bg-white" : "bg-neutral-100"}`}
      >
        <TrBoutiquePendingLink
          href={productHref}
          kind="product"
          className="absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          aria-label={product.title}
        >
          {modelImage && packshotImage ? (
            <>
              <Image
                src={modelImage}
                alt=""
                fill
                priority={priority}
                sizes={sizes}
                className={`object-cover transition-opacity duration-500 group-hover:opacity-0 ${
                  isSold ? "opacity-60" : ""
                }`}
              />
              <Image
                src={packshotImage}
                alt=""
                fill
                sizes={sizes}
                className={`${
                  packshotIsCutout ? "object-contain p-3" : "object-cover"
                } opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${
                  isSold ? "!opacity-60" : ""
                }`}
              />
            </>
          ) : packshotImage ? (
            <Image
              src={packshotImage}
              alt=""
              fill
              priority={priority}
              sizes={sizes}
              className={`${
                packshotIsCutout ? "object-contain p-3" : "object-cover"
              } transition-transform duration-700 group-hover:scale-[1.02] ${
                isSold ? "opacity-60" : ""
              }`}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-neutral-400">
              {product.title}
            </div>
          )}
        </TrBoutiquePendingLink>

        {onSale && pct > 0 && !isSold ? (
          <TrEditorialSaleBadge
            percent={pct}
            className="pointer-events-none absolute top-2.5 left-2.5 z-10"
          />
        ) : isNew && !isSold ? (
          <span
            className={
              atelier
                ? "pointer-events-none absolute top-2.5 left-2.5 z-10 bg-white/85 px-2 py-1 text-[9px] tracking-[0.16em] text-neutral-800 uppercase backdrop-blur-[2px]"
                : "pointer-events-none absolute top-2 left-2 z-10 bg-neutral-500/90 px-2 py-1 text-[9px] tracking-[0.06em] text-white"
            }
          >
            Yeni
          </span>
        ) : null}

        {isSold ? (
          <span className="pointer-events-none absolute top-2 left-2 z-10 bg-white px-2 py-1 text-[9px] tracking-[0.12em] text-neutral-900 uppercase">
            Satıldı
          </span>
        ) : null}

        <TrFavoriteButton
          product={product}
          boutiqueSlug={boutiqueSlug}
          boutiqueName={boutiqueName}
          className={
            atelier
              ? "absolute top-2.5 right-2.5 z-10 h-8 w-8 bg-white/70 backdrop-blur-[2px]"
              : "absolute top-2 right-2 z-10 h-8 w-8 bg-white/80"
          }
        />

        {!isSold ? (
          <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <TrQuickAddToCartButton product={withBoutique} iconOnly />
          </div>
        ) : null}

        {colors.length > 1 ? (
          <span className="pointer-events-none absolute right-2 bottom-2 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[9px] text-neutral-800">
            <span
              className="h-2.5 w-2.5 rounded-full border border-black/10"
              style={{
                background: `conic-gradient(${colors
                  .slice(0, 4)
                  .map((c, i) => `${c.hex} ${i * 25}% ${(i + 1) * 25}%`)
                  .join(", ")})`,
              }}
              aria-hidden
            />
            {colors.length}
          </span>
        ) : null}
      </div>

      <TrBoutiquePendingLink
        href={productHref}
        kind="product"
        className={`block text-left outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ${
          atelier
            ? compact
              ? "px-0.5 pt-3 pb-1 md:px-1"
              : "px-0.5 pt-4 pb-8 md:px-1"
            : "px-1 pt-3 pb-5 md:px-1.5"
        }`}
      >
        <h3
          className={`line-clamp-2 leading-snug text-neutral-900 ${
            atelier
              ? "font-serif text-[15px] font-light tracking-[0.01em] md:text-[16px]"
              : "text-[12px] md:text-[13px]"
          }`}
        >
          {product.title}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {onSale ? (
            <>
              <span className="text-[12px] text-neutral-400 line-through">
                {formatTryFromKurus(compareAt)}
              </span>
              <span
                className={`tracking-[-0.01em] ${
                  atelier
                    ? "text-[14px] font-medium md:text-[15px]"
                    : "text-[13px] font-semibold"
                }`}
                style={{ color: saleColor }}
              >
                {formatTryFromKurus(product.priceKurus)}
              </span>
              {!atelier && pct > 0 ? (
                <TrEditorialSaleBadge percent={pct} />
              ) : null}
            </>
          ) : (
            <span
              className={`tracking-[-0.01em] text-neutral-950 ${
                atelier
                  ? "text-[14px] font-medium md:text-[15px]"
                  : "text-[13px] font-semibold"
              }`}
            >
              {formatTryFromKurus(product.priceKurus)}
            </span>
          )}
        </div>
      </TrBoutiquePendingLink>
    </article>
  );
}
