"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useMemo } from "react";
import { TrBoutiqueEditorialProductCard } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialProductCard";
import { useStorefrontTaxonomy } from "@/components/tr/boutique/TrBoutiqueTaxonomy";
import { plpCategory, plpHref } from "@/lib/tr/catalog/plpLocation";
import { listProducers } from "@/lib/tr/boutiqueHome/naturalContent";
import { trBoutiquePath, trBoutiqueProductsPath } from "@/lib/tr/paths";
import type { TrBoutiquePublic, TrProduct } from "@/types/tr-marketplace";

type SortId = "default" | "price-asc" | "price-desc" | "new";

interface TrBoutiqueNaturalPlpProps {
  boutique: TrBoutiquePublic;
  products: TrProduct[];
  categoryId?: string | null;
  categoryScope?: { ids: string[]; ordered: boolean } | null;
  intro?: string | null;
}

function isOnSale(product: TrProduct): boolean {
  return (
    typeof product.compareAtPriceKurus === "number" &&
    product.compareAtPriceKurus > product.priceKurus
  );
}

const SIDE_HEADING = "text-[11px] font-semibold tracking-[0.18em] text-[color:var(--nat-bark)] uppercase";

export function TrBoutiqueNaturalPlp({
  boutique,
  products,
  categoryId = null,
  categoryScope = null,
  intro = null,
}: TrBoutiqueNaturalPlpProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taxonomy = useStorefrontTaxonomy();
  const slug = boutique.slug;

  const kategori = plpCategory(categoryId, searchParams);
  const saleOnly = searchParams.get("indirim") === "1" || kategori === "sale";
  const categoryFilter = saleOnly ? null : kategori;
  const q = searchParams.get("q")?.trim().toLocaleLowerCase("tr") || "";
  const marka = searchParams.get("marka")?.trim() || "";
  const sira = (searchParams.get("sira")?.trim() || "default") as SortId;

  const scopeIndex = useMemo(
    () =>
      categoryScope ? new Map(categoryScope.ids.map((id, index) => [id, index])) : null,
    [categoryScope],
  );

  const available = useMemo(
    () => products.filter((product) => product.status === "available"),
    [products],
  );

  // Everything the category / search / sale filters allow, before the maker filter,
  // so the maker list shows what is actually on this page.
  const inScope = useMemo(() => {
    let list = available;
    if (saleOnly) list = list.filter(isOnSale);
    else if (categoryFilter && scopeIndex && categoryFilter === categoryId) {
      list = list.filter((p) => scopeIndex.has(p.id));
    } else if (categoryFilter) {
      list = list.filter((p) => taxonomy.isMatch(p.category, categoryFilter));
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLocaleLowerCase("tr").includes(q) ||
          (p.brand ?? "").toLocaleLowerCase("tr").includes(q),
      );
    }
    return list;
  }, [available, categoryFilter, categoryId, q, saleOnly, scopeIndex, taxonomy]);

  const producers = useMemo(() => listProducers(inScope), [inScope]);

  const filtered = useMemo(() => {
    const list = marka ? inScope.filter((p) => p.brand?.trim() === marka) : inScope;
    const sorted = [...list];
    switch (sira) {
      case "price-asc":
        sorted.sort((a, b) => a.priceKurus - b.priceKurus);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.priceKurus - a.priceKurus);
        break;
      case "new":
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      default:
        if (scopeIndex && categoryScope?.ordered && categoryFilter === categoryId) {
          sorted.sort((a, b) => (scopeIndex.get(a.id) ?? 0) - (scopeIndex.get(b.id) ?? 0));
        } else {
          sorted.sort((a, b) => a.sortOrder - b.sortOrder);
        }
    }
    return sorted;
  }, [categoryFilter, categoryId, categoryScope, inScope, marka, scopeIndex, sira]);

  const href = (patch: Record<string, string | null>) =>
    plpHref({
      pathname,
      search: searchParams.toString(),
      routeCategory: categoryId,
      patch,
    });

  const roots = taxonomy.roots();
  const activeRoot = categoryFilter ? taxonomy.rootId(categoryFilter) : null;
  const countIn = (id: string) => available.filter((p) => taxonomy.isMatch(p.category, id)).length;

  const parentId = categoryFilter ? (taxonomy.rootId(categoryFilter) ?? null) : null;
  const title = saleOnly
    ? "İndirimdekiler"
    : categoryFilter
      ? (taxonomy.label(categoryFilter) ?? categoryFilter)
      : q
        ? `“${searchParams.get("q")?.trim()}” için sonuçlar`
        : marka
          ? marka
          : "Tüm ürünler";

  return (
    <div className="bg-[color:var(--nat-paper)] pb-20">
      <div className="mx-auto max-w-7xl px-5 pt-8 md:px-8 md:pt-10">
        <nav aria-label="Sayfa yolu" className="text-[12px] text-neutral-500">
          <Link href={trBoutiquePath(slug)} className="transition-colors hover:text-[color:var(--nat-olive)]">
            Anasayfa
          </Link>
          {parentId && parentId !== categoryFilter ? (
            <>
              <span className="mx-2">/</span>
              <Link
                href={trBoutiqueProductsPath(slug, { kategori: parentId })}
                className="transition-colors hover:text-[color:var(--nat-olive)]"
              >
                {taxonomy.label(parentId)}
              </Link>
            </>
          ) : null}
          <span className="mx-2">/</span>
          <span className="text-neutral-900">{title}</span>
        </nav>

        <header className="mt-5 max-w-3xl">
          <h1 className="nat-display text-[2.4rem] leading-tight md:text-[3rem]">{title}</h1>
          {intro?.trim() && categoryFilter === categoryId ? (
            <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-neutral-700">
              {intro.trim()}
            </p>
          ) : null}
        </header>

        <div className="mt-8 grid gap-10 border-t border-[color:var(--nat-line)] pt-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
          <aside className="space-y-9">
            <section aria-label="Kategoriler">
              <h2 className={SIDE_HEADING}>Kategoriler</h2>
              <ul className="mt-4 space-y-1">
                <li>
                  <Link
                    href={trBoutiqueProductsPath(slug)}
                    className={`block py-1 text-[14px] ${
                      !categoryFilter && !saleOnly
                        ? "font-semibold text-[color:var(--nat-olive)]"
                        : "text-neutral-700 hover:text-[color:var(--nat-olive)]"
                    }`}
                  >
                    Tümü
                  </Link>
                </li>
                {roots.map((root) => {
                  const open = activeRoot === root.id;
                  const children = taxonomy.navChildren(root.id);
                  return (
                    <li key={root.id}>
                      <Link
                        href={trBoutiqueProductsPath(slug, { kategori: root.id })}
                        className={`flex items-baseline justify-between gap-2 py-1 text-[14px] ${
                          categoryFilter === root.id
                            ? "font-semibold text-[color:var(--nat-olive)]"
                            : open
                              ? "font-medium text-neutral-900"
                              : "text-neutral-700 hover:text-[color:var(--nat-olive)]"
                        }`}
                      >
                        <span>{root.label}</span>
                        <span className="text-[11px] text-neutral-400">{countIn(root.id) || ""}</span>
                      </Link>
                      {open && children.length > 0 ? (
                        <ul className="mt-1 mb-2 ml-3 space-y-0.5 border-l border-[color:var(--nat-line)] pl-3">
                          {children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={trBoutiqueProductsPath(slug, { kategori: child.id })}
                                className={`flex items-baseline justify-between gap-2 py-1 text-[13px] ${
                                  categoryFilter === child.id
                                    ? "font-semibold text-[color:var(--nat-olive)]"
                                    : "text-neutral-600 hover:text-[color:var(--nat-olive)]"
                                }`}
                              >
                                <span>{child.label}</span>
                                <span className="text-[11px] text-neutral-400">{countIn(child.id) || ""}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>

            {producers.length > 0 ? (
              <section aria-label="Üretici">
                <h2 className={SIDE_HEADING}>Üretici</h2>
                <ul className="mt-4 space-y-1">
                  {producers.map((producer) => (
                    <li key={producer.name}>
                      <Link
                        href={href({ marka: marka === producer.name ? null : producer.name })}
                        scroll={false}
                        className={`flex items-baseline justify-between gap-2 py-1 text-[14px] ${
                          marka === producer.name
                            ? "font-semibold text-[color:var(--nat-olive)]"
                            : "text-neutral-700 hover:text-[color:var(--nat-olive)]"
                        }`}
                      >
                        <span>{producer.name}</span>
                        <span className="text-[11px] text-neutral-400">{producer.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] text-neutral-600">{filtered.length} ürün</p>
                {q ? (
                  <Link
                    href={href({ q: null })}
                    scroll={false}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--nat-line)] px-3 py-1 text-[12px] text-neutral-700 hover:border-[color:var(--nat-olive)]"
                  >
                    “{searchParams.get("q")?.trim()}” <X className="h-3 w-3" aria-hidden />
                    <span className="sr-only">aramayı kaldır</span>
                  </Link>
                ) : null}
                {marka ? (
                  <Link
                    href={href({ marka: null })}
                    scroll={false}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--nat-line)] px-3 py-1 text-[12px] text-neutral-700 hover:border-[color:var(--nat-olive)]"
                  >
                    {marka} <X className="h-3 w-3" aria-hidden />
                    <span className="sr-only">üretici filtresini kaldır</span>
                  </Link>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-[13px] text-neutral-600">
                <span className="sr-only">Sıralama</span>
                <select
                  value={sira}
                  onChange={(event) =>
                    router.replace(href({ sira: event.target.value === "default" ? null : event.target.value }), {
                      scroll: false,
                    })
                  }
                  className="rounded-[2px] border border-[color:var(--nat-line)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[color:var(--nat-olive)]"
                >
                  <option value="default">Önerilen sıralama</option>
                  <option value="new">En yeniler</option>
                  <option value="price-asc">Fiyat: düşükten yükseğe</option>
                  <option value="price-desc">Fiyat: yüksekten düşüğe</option>
                </select>
              </label>
            </div>

            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:gap-x-6">
                {filtered.map((product, index) => (
                  <TrBoutiqueEditorialProductCard
                    key={product.id}
                    product={product}
                    boutiqueSlug={slug}
                    boutiqueName={boutique.name}
                    priority={index < 3}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[2px] bg-[color:var(--nat-cream)] px-6 py-14 text-center">
                <p className="nat-display text-[1.5rem]">Bu sayfada ürün yok</p>
                <p className="mt-2 text-[14px] text-neutral-600">
                  Filtreleri kaldırmayı veya başka bir kategoriye bakmayı deneyin.
                </p>
                <Link href={trBoutiqueProductsPath(slug)} className="nat-btn-ghost mt-6">
                  Tüm ürünler
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
