"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Heart, Menu, Search, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useTrBoutiqueCommerceScope,
  useTrScopedFavorites,
} from "@/components/tr/boutique/TrBoutiqueCommerceScope";
import { TrBoutiquePendingLink } from "@/components/tr/boutique/editorial/TrBoutiqueNavPending";
import { TrNaturalWordmark } from "@/components/tr/boutique/natural/TrNaturalArt";
import { useStorefrontTaxonomy } from "@/components/tr/boutique/TrBoutiqueTaxonomy";
import { TrCartLink } from "@/components/tr/TrCartLink";
import { useAuth } from "@/context/AuthContext";
import { readNaturalOverrides } from "@/lib/tr/boutiqueHome/naturalContent";
import { resolveBoutiqueLogoUrl } from "@/lib/tr/boutiqueBrand";
import {
  trBoutiqueAuthPath,
  trBoutiquePath,
  trBoutiqueProductsPath,
} from "@/lib/tr/paths";
import { shippingFeeConfigOf } from "@/lib/tr/shipping/quoteShipping";
import { freeShippingPromoCopy } from "@/lib/tr/shipping/shippingCopy";
import { getTrAccountChromeLabel } from "@/lib/tr/userDisplayName";
import type { TrBoutiquePublic } from "@/types/tr-marketplace";

const ICON_BUTTON =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[color:var(--nat-olive-deep)] transition-colors hover:bg-[color:var(--nat-cream)]";

export function TrBoutiqueNaturalHeader({ boutique }: { boutique: TrBoutiquePublic }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const commerce = useTrBoutiqueCommerceScope();
  const favorites = useTrScopedFavorites();
  const taxonomy = useStorefrontTaxonomy();
  const logoUrl = resolveBoutiqueLogoUrl(boutique);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slug = boutique.slug;
  const roots = taxonomy.roots();
  const favCount = favorites.hydrated ? favorites.itemCount : 0;
  const accountLabel = getTrAccountChromeLabel(user, isAuthenticated);
  const onCheckout = /\/odeme(\/|$)/.test(pathname);
  const announcement =
    readNaturalOverrides(boutique.editorialContent).announcement ??
    freeShippingPromoCopy(shippingFeeConfigOf(boutique));

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const open = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenId(id);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenId(null), 140);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    router.push(trBoutiqueProductsPath(slug, q ? { q } : undefined));
  };

  const logo = (
    <TrBoutiquePendingLink
      href={trBoutiquePath(slug)}
      kind="home"
      aria-label={boutique.name}
      className="flex shrink-0 items-center"
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={boutique.name}
          width={220}
          height={64}
          unoptimized
          priority
          className="h-11 w-auto object-contain md:h-12"
        />
      ) : (
        <TrNaturalWordmark
          name={boutique.name}
          className="font-sans text-[1.7rem] leading-none font-light tracking-[-0.01em] text-[color:var(--nat-olive)] md:text-[2rem]"
        />
      )}
    </TrBoutiquePendingLink>
  );

  const openRoot = openId ? roots.find((root) => root.id === openId) : null;
  const openChildren = openRoot ? taxonomy.navChildren(openRoot.id) : [];

  // Opened by a click, so this only runs in the browser: `document` exists.
  const drawer =
    menuOpen
      ? createPortal(
          <div data-editorial-skin="natural" className="fixed inset-0 z-[100]">
            <button
              type="button"
              aria-label="Menüyü kapat"
              className="absolute inset-0 bg-black/30"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-[min(24rem,92vw)] flex-col bg-[color:var(--nat-paper)] shadow-xl">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-[color:var(--nat-line)] px-4">
                {logo}
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label="Menüyü kapat"
                  onClick={() => setMenuOpen(false)}
                >
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
              <nav aria-label="Kategoriler" className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                <ul>
                  {roots.map((root) => {
                    const children = taxonomy.navChildren(root.id);
                    const expanded = expandedId === root.id;
                    return (
                      <li key={root.id} className="border-b border-[color:var(--nat-line)]">
                        <div className="flex items-center justify-between">
                          <TrBoutiquePendingLink
                            href={trBoutiqueProductsPath(slug, { kategori: root.id })}
                            kind="products"
                            onNavigate={() => setMenuOpen(false)}
                            className="flex-1 py-4 font-serif text-[1.35rem] font-medium text-[color:var(--nat-olive-deep)]"
                          >
                            {root.label}
                          </TrBoutiquePendingLink>
                          {children.length > 0 ? (
                            <button
                              type="button"
                              className={ICON_BUTTON}
                              aria-label={`${root.label} alt kategorileri`}
                              aria-expanded={expanded}
                              onClick={() => setExpandedId(expanded ? null : root.id)}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                                strokeWidth={1.5}
                              />
                            </button>
                          ) : null}
                        </div>
                        {expanded ? (
                          <ul className="pb-3 pl-3">
                            {children.map((child) => (
                              <li key={child.id}>
                                <TrBoutiquePendingLink
                                  href={trBoutiqueProductsPath(slug, { kategori: child.id })}
                                  kind="products"
                                  onNavigate={() => setMenuOpen(false)}
                                  className="block py-2 text-[14px] text-neutral-600"
                                >
                                  {child.label}
                                </TrBoutiquePendingLink>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <div className="py-5">
                  <TrBoutiquePendingLink
                    href={trBoutiqueAuthPath(slug)}
                    kind="account"
                    onNavigate={() => setMenuOpen(false)}
                    className="block py-2 text-[13px] tracking-[0.08em] text-neutral-600 uppercase"
                  >
                    {isAuthenticated ? accountLabel : "Giriş / Üye ol"}
                  </TrBoutiquePendingLink>
                </div>
              </nav>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--nat-line)] bg-[color:var(--nat-paper)]/95 backdrop-blur-md">
      {announcement && !onCheckout ? (
        <p className="truncate bg-[color:var(--nat-olive-deep)] px-3 py-2 text-center text-[11px] tracking-[0.14em] text-[#f3eee2] uppercase">
          {announcement}
        </p>
      ) : null}

      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 md:h-[4.75rem] md:gap-8 md:px-8">
        <button
          type="button"
          className={`${ICON_BUTTON} lg:hidden`}
          aria-label="Menüyü aç"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {logo}

        <form
          onSubmit={submitSearch}
          role="search"
          className="relative ml-auto hidden max-w-md flex-1 lg:ml-6 lg:block"
        >
          <label className="sr-only" htmlFor="nat-search">
            Ürün ara
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-neutral-500"
            strokeWidth={1.5}
          />
          <input
            id="nat-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ürün, kategori veya üretici ara"
            className="h-11 w-full rounded-full border border-[color:var(--nat-line)] bg-[color:var(--nat-cream)] pr-4 pl-11 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-500 focus:border-[color:var(--nat-olive)] focus:bg-white"
          />
        </form>

        <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
          <TrBoutiquePendingLink
            href={trBoutiqueProductsPath(slug)}
            kind="products"
            className={`${ICON_BUTTON} lg:hidden`}
            aria-label="Ürünlerde ara"
          >
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </TrBoutiquePendingLink>
          <TrBoutiquePendingLink
            href={trBoutiqueAuthPath(slug)}
            kind="account"
            className={ICON_BUTTON}
            aria-label={accountLabel}
          >
            <User className="h-5 w-5" strokeWidth={1.5} />
          </TrBoutiquePendingLink>
          <button
            type="button"
            className={`relative ${ICON_BUTTON}`}
            aria-label={favCount > 0 ? `Favoriler (${favCount})` : "Favoriler"}
            onClick={() => commerce.openPanel("favorites")}
          >
            <Heart className="h-5 w-5" strokeWidth={1.5} />
            {favCount > 0 ? (
              <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-primary px-1 text-[9px] text-white">
                {favCount}
              </span>
            ) : null}
          </button>
          <TrCartLink size="lg" />
        </div>
      </div>

      <div className="relative hidden border-t border-[color:var(--nat-line)] lg:block" onMouseLeave={scheduleClose}>
        <nav aria-label="Kategoriler">
          <ul className="mx-auto flex max-w-7xl items-center justify-center gap-x-9 px-8 py-3">
            {roots.map((root) => {
              const isOpen = openId === root.id;
              return (
                <li key={root.id} onMouseEnter={() => open(root.id)}>
                  <TrBoutiquePendingLink
                    href={trBoutiqueProductsPath(slug, { kategori: root.id })}
                    kind="products"
                    onNavigate={() => setOpenId(null)}
                    className={`relative text-[13px] font-medium tracking-[0.04em] text-[color:var(--nat-olive-deep)] after:absolute after:inset-x-0 after:-bottom-1.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-[color:var(--nat-sun)] after:transition-transform after:duration-300 hover:after:scale-x-100 ${
                      isOpen ? "after:scale-x-100" : ""
                    }`}
                  >
                    {root.label}
                  </TrBoutiquePendingLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {openRoot && openChildren.length > 0 ? (
          <div
            role="region"
            aria-label={`${openRoot.label} menüsü`}
            onMouseEnter={() => open(openRoot.id)}
            className="absolute inset-x-0 top-full z-40 border-b border-[color:var(--nat-line)] bg-[color:var(--nat-paper)] shadow-[0_18px_40px_rgba(63,64,42,0.08)]"
          >
            <div className="mx-auto grid max-w-7xl grid-cols-[14rem_1fr] gap-10 px-8 py-8">
              <div>
                <p className="nat-display text-[1.7rem] leading-tight">{openRoot.label}</p>
                <TrBoutiquePendingLink
                  href={trBoutiqueProductsPath(slug, { kategori: openRoot.id })}
                  kind="products"
                  onNavigate={() => setOpenId(null)}
                  className="nat-link mt-3 inline-block text-[12px] font-semibold tracking-[0.12em] text-[color:var(--nat-olive)] uppercase"
                >
                  {taxonomy.shopAllLabel(openRoot.id)}
                </TrBoutiquePendingLink>
              </div>
              <ul className="grid grid-cols-3 gap-x-8 gap-y-3">
                {openChildren.map((child) => (
                  <li key={child.id}>
                    <TrBoutiquePendingLink
                      href={trBoutiqueProductsPath(slug, { kategori: child.id })}
                      kind="products"
                      onNavigate={() => setOpenId(null)}
                      className="text-[14px] text-neutral-700 transition-colors hover:text-[color:var(--nat-olive)]"
                    >
                      {child.label}
                    </TrBoutiquePendingLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      {drawer}
    </header>
  );
}
