"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Heart,
  LogOut,
  MapPin,
  Package,
  Settings,
  ShoppingBag,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthPopup } from "@/components/AuthPopup";
import {
  useTrBoutiqueCommerceScope,
  useTrScopedFavorites,
} from "@/components/tr/boutique/TrBoutiqueCommerceScope";
import { TrBoutiqueEditorialProductCard } from "@/components/tr/boutique/editorial/TrBoutiqueEditorialProductCard";
import { TrBoutiquePersonalInfo } from "@/components/tr/boutique/TrBoutiquePersonalInfo";
import { useTrBoutiqueProductsOptional } from "@/components/tr/boutique/TrBoutiqueProductsContext";
import { useAuth } from "@/context/AuthContext";
import { isNaturalEditorialSkin } from "@/lib/tr/boutiqueHome";
import { resolveBoutiqueBrandLabel, resolveBoutiqueLogoUrl, resolveBoutiqueThemeAccent } from "@/lib/tr/boutiqueBrand";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  trBoutiqueAddressesPath,
  trBoutiqueAuthPath,
  trBoutiqueCartPath,
  trBoutiqueFavoritesPath,
  trBoutiqueLegalPath,
  trBoutiqueOrderTrackingPath,
  trBoutiqueOrdersPath,
  trBoutiquePath,
  trBoutiqueProductsPath,
} from "@/lib/tr/paths";
import { pickFavoriteProducts } from "@/lib/tr/recommendations";
import { getTrUserFirstName } from "@/lib/tr/userDisplayName";
import { DEMO_SHOPPER_SHIPPED_ORDER_ID } from "@/lib/tr/commerce/demoShopperOrders";
import { trPanelEase } from "@/components/tr/panel/TrPanelMotion";
import type { TrBoutiquePublic } from "@/types/tr-marketplace";

interface TrBoutiqueAuthPageContentProps {
  boutique: TrBoutiquePublic;
}

async function recordRegistrationSource(boutiqueSlug: string) {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch("/api/tr/customer/registration-source", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        boutiqueSlug,
        host: typeof window !== "undefined" ? window.location.host : null,
      }),
    });
  } catch {
    // Attribution is best-effort
  }
}

const ACTION =
  "flex items-center gap-3 border border-black/8 bg-white px-4 py-3.5 text-left transition-colors hover:border-brand-primary/40 hover:bg-brand-primary/[0.03]";

export function TrBoutiqueAuthPageContent({
  boutique,
}: TrBoutiqueAuthPageContentProps) {
  const { user, isAuthenticated, isInitializing, needsPasswordSetup, signOut } = useAuth();
  const commerce = useTrBoutiqueCommerceScope();
  const favorites = useTrScopedFavorites();
  const boutiqueProducts = useTrBoutiqueProductsOptional();
  const [authOpen, setAuthOpen] = useState(false);
  // A store with its own skin and domain is not presented as one shop of a platform, and
  // opens the sign-in / sign-up form straight away instead of behind a "Devam et" button.
  const ownBrand = isNaturalEditorialSkin(boutique.slug);
  const autoOpened = useRef(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accent = resolveBoutiqueThemeAccent(boutique);
  const logoUrl = resolveBoutiqueLogoUrl(boutique);
  const firstName = getTrUserFirstName(user);
  const brandTitle = resolveBoutiqueBrandLabel(boutique.slug, boutique.name);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#favoriler") return;
    const el = document.getElementById("favoriler");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isAuthenticated, favorites.items.length]);

  useEffect(() => {
    if (!ownBrand || autoOpened.current || isInitializing || isAuthenticated) return;
    autoOpened.current = true;
    setAuthOpen(true);
  }, [ownBrand, isInitializing, isAuthenticated]);

  // Incomplete signup (OTP done, no password): keep the auth modal open.
  useEffect(() => {
    if (needsPasswordSetup) {
      setAuthOpen(true);
    }
  }, [needsPasswordSetup]);

  const favoriteProducts = useMemo(() => {
    const catalog = boutiqueProducts?.products ?? [];
    return pickFavoriteProducts({
      catalog,
      favoriteIds: favorites.items.map((item) => item.productId),
      limit: 12,
    });
  }, [boutiqueProducts?.products, favorites.items]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const requestAccountDeletion = () => {
    setDeleteConfirm(false);
    commerce.openPanel("report");
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Link
        href={trBoutiquePath(boutique.slug)}
        className="mb-8 flex flex-col items-center gap-3"
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={boutique.name}
            width={200}
            height={80}
            className="h-14 w-auto object-contain md:h-16"
            unoptimized
            priority
          />
        ) : (
          <span className="font-serif text-2xl tracking-[0.18em] uppercase">
            {brandTitle}
          </span>
        )}
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: trPanelEase }}
      >
        <h1 className="text-center font-serif text-2xl tracking-tight text-neutral-950 md:text-3xl">
          {isAuthenticated ? "Hesabım" : "Giriş / Üyelik"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-[14px] leading-relaxed text-neutral-600">
          {isAuthenticated
            ? firstName
              ? `Merhaba ${firstName}. ${brandTitle} mağaza hesabınız — sipariş ve favorileriniz bu mağazaya özeldir.`
              : `${brandTitle} mağaza hesabınız. Sipariş ve favorileriniz bu mağazaya özeldir.`
            : ownBrand
              ? "Giriş yapın veya üye olun."
              : `Giriş yapın veya üye olun. Aynı e-posta ile platformdaki diğer mağazalarda da giriş yapabilirsiniz; siparişleriniz her mağazada ayrı tutulur.`}
        </p>
      </motion.div>

      {!isAuthenticated ? (
        <>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="editorial-promo-cta mt-8 w-full px-5 py-3.5 text-[11px] tracking-[0.18em] text-white uppercase transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            Devam et
          </button>
          <p className="mt-6 text-center text-[12px] leading-relaxed text-neutral-500">
            Devam ederek{" "}
            <Link
              href={trBoutiqueLegalPath(boutique.slug, "uyelik")}
              className="underline underline-offset-2"
            >
              site kullanım şartları ve üyelik sözleşmesini
            </Link>{" "}
            ve{" "}
            <Link
              href={trBoutiqueLegalPath(boutique.slug, "kvkk")}
              className="underline underline-offset-2"
            >
              KVKK aydınlatmasını
            </Link>{" "}
            kabul etmiş olursunuz.
          </p>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: trPanelEase, delay: 0.05 }}
          className="mt-8 space-y-10"
        >
          {user ? (
            <TrBoutiquePersonalInfo user={user} accent={accent} />
          ) : null}

          <section aria-label="Hızlı işlemler">
            <p className="mb-3 text-[10px] tracking-[0.22em] text-neutral-500 uppercase">
              Hızlı işlemler
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Link href={trBoutiqueCartPath(boutique.slug)} className={ACTION}>
                <ShoppingBag className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="text-[12px] tracking-[0.12em] uppercase">
                  Sepet
                </span>
              </Link>
              <Link href={trBoutiqueFavoritesPath(boutique.slug)} className={ACTION}>
                <Heart className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="text-[12px] tracking-[0.12em] uppercase">
                  Favoriler
                  {favorites.itemCount > 0
                    ? ` (${favorites.itemCount})`
                    : ""}
                </span>
              </Link>
              <Link
                href={trBoutiqueOrderTrackingPath(
                  boutique.slug,
                  DEMO_SHOPPER_SHIPPED_ORDER_ID,
                )}
                className={ACTION}
              >
                <Truck className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="text-[12px] tracking-[0.12em] uppercase">
                  Kargo takip
                </span>
              </Link>
              <Link href={trBoutiqueOrdersPath(boutique.slug)} className={ACTION}>
                <Package className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="text-[12px] tracking-[0.12em] uppercase">
                  Siparişler
                </span>
              </Link>
              <Link href={trBoutiqueAddressesPath(boutique.slug)} className={ACTION}>
                <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="text-[12px] tracking-[0.12em] uppercase">
                  Adreslerim
                </span>
              </Link>
            </div>
          </section>

          <section id="favoriler" aria-label="Favorileriniz" className="scroll-mt-24">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase">
                  Favorileriniz
                </p>
                <p className="mt-1 text-[13px] text-neutral-600">
                  Beğendiğiniz parçalar burada.
                </p>
              </div>
              <Link
                href={trBoutiqueProductsPath(boutique.slug)}
                className="shrink-0 text-[11px] tracking-[0.14em] text-brand-primary uppercase underline-offset-4 hover:underline"
              >
                Alışverişe dön
              </Link>
            </div>

            {favoriteProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-px bg-black/5 md:grid-cols-3">
                {favoriteProducts.map((product, index) => (
                  <div key={product.id} className="bg-white">
                    <TrBoutiqueEditorialProductCard
                      product={product}
                      boutiqueSlug={boutique.slug}
                      boutiqueName={boutique.name}
                      priority={index < 3}
                    />
                  </div>
                ))}
              </div>
            ) : favorites.items.length > 0 ? (
              <ul className="divide-y divide-black/5 border border-black/8">
                {favorites.items.map((item) => (
                  <li key={item.productId} className="flex gap-3 px-3 py-3">
                    <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-neutral-100">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] text-neutral-900">
                        {item.title}
                      </p>
                      <button
                        type="button"
                        onClick={() => favorites.removeItem(item.productId)}
                        className="mt-1 text-[11px] text-neutral-500 underline-offset-2 hover:underline"
                      >
                        Kaldır
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border border-dashed border-black/15 px-4 py-10 text-center">
                <Heart
                  className="mx-auto h-6 w-6 text-neutral-300"
                  strokeWidth={1.25}
                />
                <p className="mt-3 text-[13px] text-neutral-600">
                  Henüz favori ürün yok.
                </p>
                <Link
                  href={trBoutiqueProductsPath(boutique.slug)}
                  className="mt-4 inline-flex text-[11px] tracking-[0.16em] text-brand-primary uppercase underline underline-offset-4"
                >
                  Keşfet
                </Link>
              </div>
            )}
          </section>

          <section aria-label="Hesap yönetimi">
            <p className="mb-3 text-[10px] tracking-[0.22em] text-neutral-500 uppercase">
              Hesap yönetimi
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className={ACTION + " w-full"}
              >
                <Settings className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] tracking-[0.12em] uppercase">
                    Hesabı yönet
                  </span>
                  <span className="mt-0.5 block text-[11px] normal-case tracking-normal text-neutral-500">
                    Şifre sıfırlama / tekrar giriş
                  </span>
                </span>
                <UserRound className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.5} />
              </button>

              <button
                type="button"
                onClick={() => commerce.openPanel("report")}
                className={ACTION + " w-full"}
              >
                <Package className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="text-[12px] tracking-[0.12em] uppercase">
                  Destek / sorun bildir
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className={ACTION + " w-full"}
              >
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="text-[12px] tracking-[0.12em] uppercase">
                  {signingOut ? "Çıkış yapılıyor…" : "Çıkış yap"}
                </span>
              </button>

              {!deleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="flex w-full items-center gap-3 border border-transparent px-4 py-3.5 text-left text-neutral-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="text-[12px] tracking-[0.12em] uppercase">
                    Hesabı sil
                  </span>
                </button>
              ) : (
                <div className="border border-red-200 bg-red-50 px-4 py-4">
                  <p className="text-[13px] leading-relaxed text-red-900">
                    Hesap silme talebi destek ekibine iletilir. Onaylıyor
                    musunuz?
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={requestAccountDeletion}
                      className="bg-red-700 px-4 py-2.5 text-[11px] tracking-[0.14em] text-white uppercase"
                    >
                      Talebi gönder
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      className="border border-neutral-300 bg-white px-4 py-2.5 text-[11px] tracking-[0.14em] text-neutral-800 uppercase"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <p className="text-center text-[11px] leading-relaxed text-neutral-500">
            <Link
              href={trBoutiqueLegalPath(boutique.slug, "kvkk")}
              className="underline underline-offset-2"
            >
              KVKK
            </Link>
            {" · "}
            <Link
              href={trBoutiqueLegalPath(boutique.slug, "gizlilik")}
              className="underline underline-offset-2"
            >
              Gizlilik
            </Link>
            {" · "}
            <Link
              href={trBoutiqueLegalPath(boutique.slug, "uyelik")}
              className="underline underline-offset-2"
            >
              Kullanım şartları
            </Link>
          </p>
        </motion.div>
      )}

      <AuthPopup
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={async (meta) => {
          if (meta?.isNewAccount) {
            await recordRegistrationSource(boutique.slug);
          }
          setAuthOpen(false);
        }}
        description={
          ownBrand
            ? `${brandTitle} için giriş yapın veya üye olun.`
            : `${brandTitle} için giriş yapın veya üye olun. Aynı e-posta ile platformdaki diğer mağazalarda da giriş yapabilirsiniz.`
        }
        brand={{
          logoUrl,
          logoAlt: boutique.name,
          eyebrow: brandTitle,
          successHref: trBoutiqueAuthPath(boutique.slug),
          termsHref: trBoutiqueLegalPath(boutique.slug, "uyelik"),
          privacyHref: trBoutiqueLegalPath(boutique.slug, "gizlilik"),
          locale: "tr",
          accent,
          boutiqueSlug: boutique.slug,
        }}
      />
    </div>
  );
}
