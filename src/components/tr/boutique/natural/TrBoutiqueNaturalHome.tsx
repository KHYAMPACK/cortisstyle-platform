"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { TrBoutiqueEditorialProductCard } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialProductCard";
import { TrNaturalDandelion } from "@/components/tr/boutique/natural/TrNaturalArt";
import { useStorefrontTaxonomy } from "@/components/tr/boutique/TrBoutiqueTaxonomy";
import { buildNaturalHome } from "@/lib/tr/boutiqueHome/naturalContent";
import { trBoutiqueProductsPath } from "@/lib/tr/paths";
import { getProductCoverImageFor } from "@/lib/tr/productImages";
import type { TrBoutiquePublic, TrProduct } from "@/types/tr-marketplace";

interface TrBoutiqueNaturalHomeProps {
  boutique: TrBoutiquePublic;
  products: TrProduct[];
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string | null;
  title: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <p className="nat-eyebrow">{eyebrow}</p> : null}
        <h2 className="nat-display mt-1 text-[2rem] leading-tight md:text-[2.4rem]">{title}</h2>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="nat-link inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.12em] text-[color:var(--nat-olive)] uppercase"
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      ) : null}
    </div>
  );
}

export function TrBoutiqueNaturalHome({ boutique, products }: TrBoutiqueNaturalHomeProps) {
  const taxonomy = useStorefrontTaxonomy();
  const slug = boutique.slug;
  const home = useMemo(
    () =>
      buildNaturalHome({
        boutique,
        products,
        taxonomy,
        coverOf: (product) => getProductCoverImageFor("boutique", product) ?? null,
      }),
    [boutique, products, taxonomy],
  );
  const shopHref = trBoutiqueProductsPath(slug);
  const [first, second] = home.hero.images;

  return (
    <div className="w-full min-w-0 bg-[color:var(--nat-paper)]">
      <section className="relative overflow-hidden bg-[color:var(--nat-cream)]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
          <div className="relative z-10">
            {home.hero.eyebrow ? <p className="nat-eyebrow">{home.hero.eyebrow}</p> : null}
            <h1 className="nat-display mt-3 text-[2.6rem] leading-[1.04] md:text-[3.7rem]">
              {home.hero.title}
            </h1>
            {home.hero.body ? (
              <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-neutral-700 md:text-[17px]">
                {home.hero.body}
              </p>
            ) : null}
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={shopHref} className="nat-btn">
                {home.hero.primaryLabel}
              </Link>
              <a href="#kategoriler" className="nat-btn-ghost">
                Kategoriler
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[34rem]">
            {first ? (
              <div className="relative grid grid-cols-[1.25fr_1fr] items-end gap-4">
                <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] bg-[color:var(--nat-sand)]">
                  <Image src={first} alt="" fill unoptimized sizes="320px" className="object-cover" priority />
                </div>
                {second ? (
                  <div className="relative mb-10 aspect-[3/4] overflow-hidden rounded-t-[999px] bg-[color:var(--nat-sand)]">
                    <Image src={second} alt="" fill unoptimized sizes="240px" className="object-cover" />
                  </div>
                ) : (
                  <TrNaturalDandelion className="mb-6 h-56 w-full text-[color:var(--nat-olive)] opacity-80" />
                )}
              </div>
            ) : (
              <div className="relative mx-auto flex aspect-square max-w-[26rem] items-center justify-center rounded-full bg-[color:var(--nat-sand)]">
                <TrNaturalDandelion className="h-[88%] w-[88%] text-[color:var(--nat-olive)]" stem />
                <span
                  aria-hidden
                  className="absolute top-[9%] right-[12%] h-5 w-5 rounded-full bg-[color:var(--nat-sun)]"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        aria-label="Öne çıkanlar"
        className="border-y border-[color:var(--nat-line)] bg-[color:var(--nat-paper)]"
      >
        <ul className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-5 py-4 md:px-8">
          {home.usps.map((label) => (
            <li key={label} className="flex items-center gap-2.5 text-[13px] text-neutral-700">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--nat-sun)]" />
              {label}
            </li>
          ))}
        </ul>
      </section>

      {home.categoryTiles.length > 0 ? (
        <section id="kategoriler" className="mx-auto max-w-7xl scroll-mt-32 px-5 py-16 md:px-8 md:py-20">
          <SectionHeading eyebrow="Keşfedin" title="Kategoriler" />
          <ul className="flex flex-wrap justify-center gap-4">
            {home.categoryTiles.map((tile) => (
              <li key={tile.id} className="w-full min-w-0 sm:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.75rem)]">
                <Link
                  href={trBoutiqueProductsPath(slug, { kategori: tile.id })}
                  className="group relative block aspect-[4/3] overflow-hidden rounded-[2px] bg-[color:var(--nat-sand)]"
                >
                  {tile.image ? (
                    <Image
                      src={tile.image}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <TrNaturalDandelion className="absolute -top-4 -right-4 h-44 w-40 text-[color:var(--nat-olive)] opacity-25 transition-opacity duration-300 group-hover:opacity-40" />
                  )}
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 bottom-0 h-2/3 ${
                      tile.image ? "bg-gradient-to-t from-[#2a2b1d]/85 via-[#2a2b1d]/40 to-transparent" : ""
                    }`}
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                    <span
                      className={`font-serif text-[1.55rem] leading-tight font-medium ${
                        tile.image ? "text-white" : "text-[color:var(--nat-olive-deep)]"
                      }`}
                    >
                      {tile.label}
                    </span>
                    {tile.count > 0 ? (
                      <span
                        className={`shrink-0 pb-1 text-[12px] ${
                          tile.image ? "text-white/85" : "text-neutral-600"
                        }`}
                      >
                        {tile.count} ürün
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {home.empty ? (
        <section className="mx-auto max-w-3xl px-5 pb-20 text-center md:px-8">
          <p className="nat-display text-[1.6rem]">Ürünlerimiz çok yakında burada</p>
          <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
            Mağazamıza ürünler ekleniyor. Bizi takip etmeye devam edin.
          </p>
        </section>
      ) : null}

      {home.rails.map((rail) => (
        <section key={rail.id} className="mx-auto max-w-7xl px-5 pb-16 md:px-8 md:pb-20">
          <SectionHeading
            title={rail.title}
            action={{
              label: "Tümünü gör",
              href: rail.categoryId ? trBoutiqueProductsPath(slug, { kategori: rail.categoryId }) : shopHref,
            }}
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-6">
            {rail.products.map((product, index) => (
              <TrBoutiqueEditorialProductCard
                key={product.id}
                product={product}
                boutiqueSlug={slug}
                boutiqueName={boutique.name}
                priority={rail.id === home.rails[0]?.id && index < 4}
              />
            ))}
          </div>
        </section>
      ))}

      {home.producers.list.length > 0 ? (
        <section className="relative overflow-hidden bg-[color:var(--nat-olive)] text-[#f3eee2]">
          <TrNaturalDandelion className="pointer-events-none absolute -bottom-16 -left-10 h-72 w-64 text-[#f3eee2] opacity-[0.09]" stem />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-16 md:px-8 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:gap-14">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[color:var(--nat-sun)] uppercase">
                Üretici ve atölyeler
              </p>
              <h2 className="mt-2 font-serif text-[2.1rem] leading-tight font-medium text-white md:text-[2.5rem]">
                {home.producers.title}
              </h2>
              {home.producers.body ? (
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#e4ddca]">{home.producers.body}</p>
              ) : null}
            </div>
            <ul className="flex flex-wrap gap-2.5">
              {home.producers.list.map((producer) => (
                <li key={producer.name}>
                  <Link
                    href={`${shopHref}?marka=${encodeURIComponent(producer.name)}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[#f3eee2]/45 px-4 py-2 text-[13px] transition-colors hover:border-[color:var(--nat-sun)] hover:bg-[color:var(--nat-sun)] hover:text-[color:var(--nat-olive-deep)]"
                  >
                    {producer.name}
                    <span className="text-[11px] opacity-70">{producer.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {home.story ? (
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <TrNaturalDandelion className="mx-auto h-64 w-60 text-[color:var(--nat-olive)] opacity-90 lg:h-80 lg:w-72" stem />
          <div>
            {home.story.eyebrow ? <p className="nat-eyebrow">{home.story.eyebrow}</p> : null}
            <h2 className="nat-display mt-2 text-[2rem] leading-tight md:text-[2.6rem]">{home.story.title}</h2>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-neutral-700">{home.story.body}</p>
            {home.story.ctaLabel && home.story.ctaHref ? (
              <Link href={home.story.ctaHref} className="nat-btn-ghost mt-8">
                {home.story.ctaLabel}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
