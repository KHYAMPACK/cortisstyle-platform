"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  TrSandboxBanner,
  cartHasDemoItems,
} from "@/components/tr/TrSandboxBanner";
import { TrIyzicoCheckoutBadge } from "@/components/tr/TrIyzicoPaymentBadges";
import { useTrackingActive } from "@/components/tr/boutique/TrTrackingEvents";
import { kurusToTry } from "@/lib/tr/tracking/events";
import { cartLineToTrackedItem } from "@/lib/tr/tracking/items";
import { trackEvent } from "@/lib/tr/tracking/runtime";
import { TrFreeShippingNudge } from "@/components/tr/commerce/TrFreeShippingNudge";
import { TrCheckoutAddressPicker } from "@/components/tr/commerce/TrCheckoutAddressPicker";
import {
  TrTurkeyAddressFields,
  turkeyAddressClientError,
} from "@/components/tr/commerce/TrTurkeyAddressFields";
import { isValidCustomerPhone } from "@/lib/auth/customerProfileFields";
import { useAtelierFabBottomInset } from "@/lib/tr/useAtelierFabBottomInset";
import { useAuth } from "@/context/AuthContext";
import {
  applyCustomerAddressToCheckoutForm,
  createCustomerAddressRequest,
  fetchCustomerAddresses,
} from "@/lib/tr/commerce/customerAddressesClient";
import { TR_CUSTOMER_ADDRESS_MAX } from "@/lib/tr/commerce/customerAddressLimits";
import {
  loadSavedCheckoutProfile,
  saveCheckoutProfile,
} from "@/lib/tr/checkoutProfile";
import {
  loadBoutiqueCheckoutSelection,
  removeBoutiqueCheckedOutCartLines,
} from "@/lib/tr/checkoutSelection";
import { isTrCheckoutEnabled } from "@/lib/tr/platform";
import {
  isBackForwardNavigation,
  releaseIyzicoCheckoutHold,
  saveIyzicoCheckoutHold,
} from "@/lib/tr/payments/iyzicoCheckoutHold";
import {
  NO_SHIPPING_FEE,
  freeShippingProgress,
  quoteCheckoutShippingFee,
  type ShippingFeeConfig,
} from "@/lib/tr/shipping/quoteShipping";
import {
  trBoutiqueCartPath,
  trBoutiqueLegalPath,
  trBoutiquePath,
  trBoutiqueProductsPath,
  trCartPath,
  trOrderConfirmationPath,
} from "@/lib/tr/paths";
import { getTrUserFirstName } from "@/lib/tr/userDisplayName";
import { getTrBoutiqueLocalCartStore } from "@/store/trBoutiqueLocalCartStore";
import {
  cartLineKey,
  cartTotalKurus,
  EMPTY_CHECKOUT_FORM,
  groupCartItemsByBoutique,
  type TrCartLineItem,
  type TrCheckoutFormData,
} from "@/types/tr-cart";
import {
  formatTryFromKurus,
  type TrCustomerAddress,
} from "@/types/tr-marketplace";

const inputClassName =
  "w-full border border-black/10 bg-white px-3 py-3 text-[13px] text-jet-black outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30";

const labelClassName = "text-[10px] tracking-[0.16em] text-neutral-500 uppercase";

type CheckoutStep = "contact" | "address" | "review";

const stickyBackClassName =
  "inline-flex min-h-12 shrink-0 items-center justify-center border border-black/15 px-5 py-3.5 text-[11px] tracking-[0.16em] uppercase";

const stickyPrimaryClassName =
  "btn-primary inline-flex min-h-12 min-w-0 flex-1 items-center justify-center px-6 py-3.5 text-[11px] tracking-[0.18em] disabled:opacity-60";

function TrCheckoutStickyActions({
  children,
  onBack,
  shippingNudge,
}: {
  children: ReactNode;
  onBack?: () => void;
  shippingNudge?: ReactNode;
}) {
  const stickyBottomRef = useAtelierFabBottomInset();

  return (
    <div
      ref={stickyBottomRef}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/80 bg-white/95 backdrop-blur-sm"
    >
      <div
        className="mx-auto flex max-w-3xl flex-col gap-3 px-5 pt-3 md:px-10"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {shippingNudge}
        <div className="flex items-stretch gap-3">
          {onBack ? (
            <button type="button" onClick={onBack} className={stickyBackClassName}>
              Geri
            </button>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

function useCheckoutCart(boutiqueSlug: string | null): {
  items: TrCartLineItem[];
  allItems: TrCartLineItem[];
  clearCheckedOut: () => void;
  hydrated: boolean;
} {
  const [localItems, setLocalItems] = useState<TrCartLineItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[] | null>(null);
  const [hydrated, setHydrated] = useState(!boutiqueSlug);

  useEffect(() => {
    if (!boutiqueSlug) {
      setHydrated(true);
      return;
    }

    const store = getTrBoutiqueLocalCartStore(boutiqueSlug);
    const sync = () => {
      setLocalItems(store.getState().items);
      setSelectedKeys(loadBoutiqueCheckoutSelection(boutiqueSlug));
    };
    sync();

    const unsub = store.subscribe(sync);
    const finish = store.persist?.onFinishHydration(() => {
      sync();
      setHydrated(true);
    });
    if (store.persist?.hasHydrated()) {
      setHydrated(true);
    }

    return () => {
      unsub();
      finish?.();
    };
  }, [boutiqueSlug]);

  if (boutiqueSlug) {
    const selected =
      selectedKeys && selectedKeys.length > 0
        ? localItems.filter((item) =>
            selectedKeys.includes(cartLineKey(item)),
          )
        : localItems;
    return {
      items: selected.length > 0 ? selected : localItems,
      allItems: localItems,
      clearCheckedOut: () => removeBoutiqueCheckedOutCartLines(boutiqueSlug),
      hydrated,
    };
  }

  return {
    items: [],
    allItems: [],
    clearCheckedOut: () => {},
    hydrated: true,
  };
}

function stepTitle(step: CheckoutStep): string {
  switch (step) {
    case "contact":
      return "İletişim";
    case "address":
      return "Adres";
    case "review":
      return "Onay";
  }
}

function TrCheckoutForm({
  boutiqueSlug,
  iyzicoCheckout,
  shipping,
}: {
  boutiqueSlug: string | null;
  iyzicoCheckout: boolean;
  shipping: ShippingFeeConfig;
}) {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing } = useAuth();
  const { items, clearCheckedOut, hydrated } = useCheckoutCart(boutiqueSlug);
  const [form, setForm] = useState<TrCheckoutFormData>(EMPTY_CHECKOUT_FORM);
  const [step, setStep] = useState<CheckoutStep | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedDistance, setAcceptedDistance] = useState(false);
  const [acceptedKvkk, setAcceptedKvkk] = useState(false);
  const [saveProfile, setSaveProfile] = useState(true);
  const [saveToBook, setSaveToBook] = useState(true);
  const [saveToBookLabel, setSaveToBookLabel] = useState("Ev");
  const [saveToBookDefault, setSaveToBookDefault] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<TrCustomerAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<
    string | "new" | null
  >(null);
  const [contactFields, setContactFields] = useState({
    needsPhone: true,
    needsIdentity: true,
  });
  const [discountCode, setDiscountCode] = useState("");

  const profileScope = boutiqueSlug?.trim() || "marketplace";
  const authEmail = user?.email?.trim() || "";
  const authPhone = user?.phone?.trim() || "";
  const authFullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const authNameHint = authFullName || getTrUserFirstName(user);
  const authName =
    authNameHint
      ? authNameHint
          .toLocaleLowerCase("tr-TR")
          .replace(/(^|\s)\S/g, (char) => char.toLocaleUpperCase("tr-TR"))
      : "";

  const needsContact = contactFields.needsPhone || contactFields.needsIdentity;

  const steps = useMemo(() => {
    const list: CheckoutStep[] = [];
    if (needsContact) list.push("contact");
    list.push("address", "review");
    return list;
  }, [needsContact]);

  // Ad / analytics: the shopper reached checkout with these items (once per visit).
  const trackingActive = useTrackingActive();
  const beginCheckoutSent = useRef(false);
  useEffect(() => {
    if (!trackingActive || !hydrated || items.length === 0 || beginCheckoutSent.current) {
      return;
    }
    beginCheckoutSent.current = true;
    trackEvent({
      type: "begin_checkout",
      valueTry: kurusToTry(cartTotalKurus(items)),
      items: items.map(cartLineToTrackedItem),
    });
  }, [trackingActive, hydrated, items]);

  useEffect(() => {
    if (isInitializing) return;
    let cancelled = false;

    async function hydrate() {
      const saved = loadSavedCheckoutProfile(profileScope);
      let next = { ...EMPTY_CHECKOUT_FORM, ...(saved ?? {}) };
      if (authEmail && !next.customerEmail.trim()) {
        next.customerEmail = authEmail;
      }
      if (authName && !next.customerName.trim()) {
        next.customerName = authName;
      }
      if (authPhone && !next.customerPhone.trim()) {
        next.customerPhone = authPhone;
      }

      let book: TrCustomerAddress[] = [];
      let selected: string | "new" | null = null;
      if (isAuthenticated) {
        setAddressesLoading(true);
        try {
          const listed = await fetchCustomerAddresses();
          if (cancelled) return;
          if (listed.ok) {
            book = listed.addresses;
            const preferred =
              book.find((address) => address.isDefault) ?? book[0] ?? null;
            if (preferred) {
              next = applyCustomerAddressToCheckoutForm(next, preferred);
              selected = preferred.id;
            } else {
              selected = "new";
            }
          } else {
            selected = "new";
          }
        } catch {
          if (cancelled) return;
          selected = "new";
        }
        setAddressesLoading(false);
      }

      if (cancelled) return;
      setSavedAddresses(book);
      setSelectedAddressId(selected);
      setForm(next);
      setContactFields({
        needsPhone: !isValidCustomerPhone(next.customerPhone),
        needsIdentity: !next.customerName.trim() || !next.customerEmail.trim(),
      });
      setProfileReady(true);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    authEmail,
    authName,
    authPhone,
    profileScope,
    isAuthenticated,
    isInitializing,
  ]);

  useEffect(() => {
    if (!boutiqueSlug || !iyzicoCheckout) return;

    const unlockSubmit = () => {
      submitLock.current = false;
      setSubmitting(false);
    };

    const releaseHold = () => {
      void releaseIyzicoCheckoutHold(boutiqueSlug).then((result) => {
        if (result === "paid") {
          removeBoutiqueCheckedOutCartLines(boutiqueSlug);
        }
        unlockSubmit();
      });
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted || isBackForwardNavigation()) {
        releaseHold();
        return;
      }
      unlockSubmit();
    };
    window.addEventListener("pageshow", onPageShow);
    if (isBackForwardNavigation()) {
      releaseHold();
    }
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [boutiqueSlug, iyzicoCheckout]);

  useEffect(() => {
    if (!profileReady) return;
    setStep((current) => {
      if (current !== null && steps.includes(current)) return current;
      return steps[0] ?? "address";
    });
  }, [profileReady, steps]);

  const grouped = groupCartItemsByBoutique(items);
  const totalKurus = cartTotalKurus(items);
  const demoCart = cartHasDemoItems(items);
  const boutiqueCheckout = Boolean(boutiqueSlug);
  const hasShippingFee = shipping.feeKurus > 0 && !demoCart;
  const shippingProgress = hasShippingFee
    ? freeShippingProgress(shipping, items)
    : null;
  const shippingFeeKurus = hasShippingFee
    ? (quoteCheckoutShippingFee(shipping, items)?.feeKurus ?? 0)
    : 0;
  const payableKurus = totalKurus + shippingFeeKurus;
  const shippingNudge = shippingProgress ? (
    <TrFreeShippingNudge
      progress={shippingProgress}
      shopHref={
        !shippingProgress.free && boutiqueSlug
          ? trBoutiqueProductsPath(boutiqueSlug)
          : undefined
      }
    />
  ) : null;
  const canSubmit =
    demoCart || boutiqueCheckout || isTrCheckoutEnabled();

  if (!hydrated || !profileReady || step === null) {
    return (
      <div className="px-5 py-10 text-[13px] text-neutral-600 md:px-10">
        <span className="inline-block h-3 w-24 animate-pulse bg-neutral-200" />
        <p className="mt-3">Ödeme hazırlanıyor…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6 px-5 py-10 md:px-10">
        <TrSandboxBanner demo={demoCart} iyzicoCheckout={iyzicoCheckout} />
        <p className="max-w-xl text-[12px] leading-relaxed text-neutral-600">
          Ödeme için önce sepetinize ürün ekleyin.
        </p>
        <Link
          href={boutiqueSlug ? trBoutiquePath(boutiqueSlug) : trCartPath()}
          className="btn-primary inline-flex items-center justify-center px-6 py-4 text-[11px] tracking-[0.2em]"
        >
          {boutiqueSlug ? "Mağazaya dön" : "Sepete dön"}
        </Link>
      </div>
    );
  }

  const updateField = (field: keyof TrCheckoutFormData, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const usingNewAddress =
    !isAuthenticated ||
    selectedAddressId === "new" ||
    selectedAddressId === null ||
    savedAddresses.length === 0;
  const showAddressForm = usingNewAddress && !addressesLoading;
  const canSaveToBook =
    isAuthenticated &&
    usingNewAddress &&
    savedAddresses.length < TR_CUSTOMER_ADDRESS_MAX;

  const pickSavedAddress = (id: string | "new") => {
    setSelectedAddressId(id);
    setError(null);
    if (id === "new") {
      setForm((current) => ({
        ...current,
        line1: "",
        line2: "",
        district: "",
        city: "",
        postalCode: "",
      }));
      return;
    }
    const found = savedAddresses.find((address) => address.id === id);
    if (found) {
      setForm((current) => applyCustomerAddressToCheckoutForm(current, found));
    }
  };

  const goNext = () => {
    setError(null);
    const index = steps.indexOf(step);
    const next = steps[index + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    setError(null);
    const index = steps.indexOf(step);
    const prev = steps[index - 1];
    if (prev) setStep(prev);
  };

  const validateCurrentStep = (): boolean => {
    if (step === "contact") {
      if (contactFields.needsPhone && !isValidCustomerPhone(form.customerPhone)) {
        setError("Geçerli bir telefon numarası girin.");
        return false;
      }
      if (
        contactFields.needsIdentity &&
        (!form.customerName.trim() || !form.customerEmail.trim())
      ) {
        setError("Ad soyad ve e-posta gerekli.");
        return false;
      }
    }
    if (step === "address") {
      const addressError = turkeyAddressClientError(form);
      if (addressError) {
        setError(addressError);
        return false;
      }
      if (form.invoiceType === "corporate") {
        if (!form.buyerTitle.trim()) {
          setError("Kurumsal fatura için unvan gerekli.");
          return false;
        }
        const vkn = form.buyerTaxId.replace(/\D/g, "");
        if (vkn.length !== 10) {
          setError("Kurumsal fatura için 10 haneli VKN girin.");
          return false;
        }
        if (!form.buyerTaxOffice.trim()) {
          setError("Kurumsal fatura için vergi dairesi gerekli.");
          return false;
        }
      }
    }
    return true;
  };

  const handleStepContinue = (event: FormEvent) => {
    event.preventDefault();
    if (!validateCurrentStep()) return;
    goNext();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting || submitLock.current) return;
    if (!acceptedDistance || !acceptedKvkk) {
      setError("Sözleşmeleri onaylamanız gerekir.");
      return;
    }
      const addressError = turkeyAddressClientError(form);
      if (
        !isValidCustomerPhone(form.customerPhone) ||
        !form.customerName.trim() ||
        !form.customerEmail.trim() ||
        addressError
      ) {
        setError(addressError ?? "Eksik bilgi var — önceki adımları kontrol edin.");
        return;
      }

    submitLock.current = true;
    setSubmitting(true);
    setError(null);

    try {
      if (saveProfile || isAuthenticated) {
        saveCheckoutProfile(profileScope, form);
      }

      if (canSaveToBook && saveToBook) {
        try {
          await createCustomerAddressRequest({
            label: saveToBookLabel.trim() || "Ev",
            recipientName: form.customerName,
            phone: form.customerPhone,
            line1: form.line1,
            line2: form.line2 || undefined,
            district: form.district,
            city: form.city,
            postalCode: form.postalCode,
            country: form.country || "TR",
            isDefault: saveToBookDefault || savedAddresses.length === 0,
          });
        } catch {
          // Address book save is best-effort — do not block checkout.
        }
      }

      if (demoCart) {
        clearCheckedOut();
        const base = trOrderConfirmationPath(
          boutiqueSlug ? { boutique: boutiqueSlug } : undefined,
        );
        router.push(`${base}${base.includes("?") ? "&" : "?"}demo=1`);
        return;
      }

      const response = await fetch("/api/tr/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boutiqueSlug: boutiqueSlug ?? undefined,
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerPhone: form.customerPhone || undefined,
          shippingAddress: {
            line1: form.line1,
            line2: form.line2 || undefined,
            district: form.district,
            city: form.city,
            postalCode: form.postalCode,
            country: form.country || "TR",
          },
          invoiceType: form.invoiceType,
          buyerTaxId:
            form.invoiceType === "corporate"
              ? form.buyerTaxId.replace(/\D/g, "") || undefined
              : undefined,
          buyerTaxOffice:
            form.invoiceType === "corporate"
              ? form.buyerTaxOffice.trim() || undefined
              : undefined,
          buyerTitle:
            form.invoiceType === "corporate"
              ? form.buyerTitle.trim() || undefined
              : undefined,
          items: items.map((item) => ({
            productId: item.productId,
            boutiqueId: item.boutiqueId,
            size: item.size,
            variantId: item.variantId ?? null,
            quantity: 1,
            referenceImageUrl: item.referenceImageUrl ?? null,
            referenceId: item.referenceId ?? null,
            styleOption: item.styleOption ?? null,
          })),
          discountCode: boutiqueSlug
            ? discountCode.trim() || undefined
            : undefined,
          acceptedDistanceSales: acceptedDistance,
          acceptedKvkk,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        orderId?: string;
        confirmToken?: string;
        sandbox?: boolean;
        paymentPageUrl?: string | null;
        checkoutToken?: string | null;
        error?: string;
      };

      if (!response.ok || !data.orderId) {
        throw new Error(data.error ?? "Sipariş oluşturulamadı.");
      }

      if (data.paymentPageUrl) {
        if (boutiqueSlug && data.confirmToken) {
          saveIyzicoCheckoutHold(boutiqueSlug, {
            orderId: data.orderId,
            confirmToken: data.confirmToken,
            checkoutToken: data.checkoutToken?.trim() || undefined,
          });
        }
        window.location.assign(data.paymentPageUrl);
        return;
      }

      if (boutiqueSlug && iyzicoCheckout && !data.sandbox) {
        throw new Error(
          "Kart ödemesi başlatılamadı. Sepetiniz duruyor — tekrar deneyin.",
        );
      }

      clearCheckedOut();
      const confirm = trOrderConfirmationPath(
        boutiqueSlug ? { boutique: boutiqueSlug } : undefined,
      );
      const token = data.confirmToken
        ? `&token=${encodeURIComponent(data.confirmToken)}`
        : "";
      router.push(
        `${confirm}${confirm.includes("?") ? "&" : "?"}order=${encodeURIComponent(data.orderId)}${
          data.sandbox ? "&sandbox=1" : ""
        }${token}`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Sipariş oluşturulamadı.",
      );
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const legalSlug = boutiqueSlug ?? grouped[0]?.boutiqueSlug;
  const stepIndex = steps.indexOf(step);

  return (
    <div className="px-5 py-8 pb-36 md:px-10 md:py-10 md:pb-40">
      <TrSandboxBanner
        className="mb-8"
        demo={demoCart}
        iyzicoCheckout={iyzicoCheckout}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
        <div>
          <div className="mb-6 flex flex-wrap gap-2">
            {steps.map((id, index) => (
              <span
                key={id}
                className={`px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase ${
                  index === stepIndex
                    ? "bg-brand-primary text-white"
                    : index < stepIndex
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {index + 1} · {stepTitle(id)}
              </span>
            ))}
          </div>

          {user?.email ? (
            <p className="mb-4 text-[12px] text-neutral-600">
              Hesap: <span className="text-neutral-900">{user.email}</span>
              {form.customerName ? ` · ${form.customerName}` : ""}
            </p>
          ) : null}

          {step === "contact" ? (
            <form
              onSubmit={handleStepContinue}
              className="space-y-5 border border-black/10 bg-white p-5"
            >
              <h2 className="font-serif text-xl tracking-tight text-neutral-950">
                {contactFields.needsPhone && !contactFields.needsIdentity
                  ? "Telefon numaranız"
                  : "İletişim bilgileri"}
              </h2>
              <p className="text-[13px] text-neutral-600">
                {contactFields.needsPhone && !contactFields.needsIdentity
                  ? "Sipariş ve kargo bilgilendirmesi için kullanacağız."
                  : "Sipariş onayı ve kargo bilgilendirmesi için kullanacağız."}
              </p>
              {contactFields.needsPhone ? (
                <label className="block">
                  <span className={labelClassName}>Telefon</span>
                  <input
                    required
                    value={form.customerPhone}
                    onChange={(event) =>
                      updateField("customerPhone", event.target.value)
                    }
                    className={`${inputClassName} mt-2`}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="05xx xxx xx xx"
                    autoFocus
                  />
                </label>
              ) : null}
              {contactFields.needsIdentity ? (
                <>
                  <label className="block">
                    <span className={labelClassName}>Ad soyad</span>
                    <input
                      required
                      value={form.customerName}
                      onChange={(event) =>
                        updateField("customerName", event.target.value)
                      }
                      className={`${inputClassName} mt-2`}
                      autoComplete="name"
                      autoFocus={!contactFields.needsPhone}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClassName}>E-posta</span>
                    <input
                      required
                      type="email"
                      value={form.customerEmail}
                      onChange={(event) =>
                        updateField("customerEmail", event.target.value)
                      }
                      className={`${inputClassName} mt-2`}
                      autoComplete="email"
                    />
                  </label>
                </>
              ) : null}
              {error ? (
                <p className="text-[13px] text-red-700">{error}</p>
              ) : null}
              <TrCheckoutStickyActions shippingNudge={shippingNudge}>
                <button type="submit" className={stickyPrimaryClassName}>
                  Devam et
                </button>
              </TrCheckoutStickyActions>
            </form>
          ) : null}

          {step === "address" ? (
            <form
              onSubmit={handleStepContinue}
              className="space-y-5 border border-black/10 bg-white p-5"
            >
              <h2 className="font-serif text-xl tracking-tight text-neutral-950">
                Teslimat adresi
              </h2>
              {isAuthenticated ? (
                <TrCheckoutAddressPicker
                  addresses={savedAddresses}
                  selectedId={selectedAddressId}
                  loading={addressesLoading}
                  onSelect={pickSavedAddress}
                />
              ) : null}
              {showAddressForm ? (
                <TrTurkeyAddressFields
                  city={form.city}
                  district={form.district}
                  line1={form.line1}
                  line2={form.line2}
                  postalCode={form.postalCode}
                  autoFocusStreet
                  onChange={(patch) =>
                    setForm((current) => ({ ...current, ...patch }))
                  }
                />
              ) : null}

              <div className="space-y-4 border-t border-black/10 pt-5">
                <h3 className="font-serif text-lg tracking-tight text-neutral-950">
                  Fatura bilgileri
                </h3>
                <p className="text-[12px] text-neutral-600">
                  Bireysel faturada teslimat adresi kullanılır; TCKN
                  istenmez. Kurumsal için VKN ve unvan gerekir.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        invoiceType: "individual",
                        buyerTaxId: "",
                        buyerTaxOffice: "",
                        buyerTitle: "",
                      }))
                    }
                    className={`px-3 py-2 text-[11px] tracking-[0.14em] uppercase ${
                      form.invoiceType === "individual"
                        ? "bg-neutral-950 text-white"
                        : "border border-black/15 text-neutral-700"
                    }`}
                  >
                    Bireysel
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        invoiceType: "corporate",
                      }))
                    }
                    className={`px-3 py-2 text-[11px] tracking-[0.14em] uppercase ${
                      form.invoiceType === "corporate"
                        ? "bg-neutral-950 text-white"
                        : "border border-black/15 text-neutral-700"
                    }`}
                  >
                    Kurumsal
                  </button>
                </div>
                {form.invoiceType === "corporate" ? (
                  <>
                    <label className="block">
                      <span className={labelClassName}>Ünvan</span>
                      <input
                        required
                        value={form.buyerTitle}
                        onChange={(event) =>
                          updateField("buyerTitle", event.target.value)
                        }
                        className={`${inputClassName} mt-2`}
                      />
                    </label>
                    <label className="block sm:max-w-xs">
                      <span className={labelClassName}>VKN (10 hane)</span>
                      <input
                        required
                        value={form.buyerTaxId}
                        onChange={(event) =>
                          updateField("buyerTaxId", event.target.value)
                        }
                        className={`${inputClassName} mt-2`}
                        inputMode="numeric"
                        autoComplete="off"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClassName}>Vergi dairesi</span>
                      <input
                        required
                        value={form.buyerTaxOffice}
                        onChange={(event) =>
                          updateField("buyerTaxOffice", event.target.value)
                        }
                        className={`${inputClassName} mt-2`}
                      />
                    </label>
                  </>
                ) : (
                  <p className="text-[13px] text-neutral-600">
                    Fatura adresi teslimat adresi ile aynıdır.
                  </p>
                )}
              </div>

              {error ? (
                <p className="text-[13px] text-red-700">{error}</p>
              ) : null}
              <TrCheckoutStickyActions
                onBack={stepIndex > 0 ? goBack : undefined}
                shippingNudge={shippingNudge}
              >
                <button type="submit" className={stickyPrimaryClassName}>
                  Devam et
                </button>
              </TrCheckoutStickyActions>
            </form>
          ) : null}

          {step === "review" ? (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 border border-black/10 bg-white p-5"
            >
              <h2 className="font-serif text-xl tracking-tight text-neutral-950">
                Sipariş onayı
              </h2>

              <dl className="space-y-3 text-[13px] text-neutral-700">
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Telefon</dt>
                  <dd>{form.customerPhone}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Ad soyad</dt>
                  <dd className="text-right">{form.customerName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">E-posta</dt>
                  <dd className="text-right break-all">{form.customerEmail}</dd>
                </div>
                <div className="flex justify-between gap-4 pt-1">
                  <dt className="text-neutral-500">Adres</dt>
                  <dd className="text-right">
                    {form.line1}
                    {form.line2 ? `, ${form.line2}` : ""}
                    <br />
                    {form.district} / {form.city} {form.postalCode}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 pt-1">
                  <dt className="text-neutral-500">Fatura</dt>
                  <dd className="text-right">
                    {form.invoiceType === "corporate"
                      ? `Kurumsal · ${form.buyerTitle || "—"}`
                      : "Bireysel · teslimat adresi"}
                    {form.invoiceType === "corporate" &&
                    form.buyerTaxId.replace(/\D/g, "")
                      ? ` · ${form.buyerTaxId.replace(/\D/g, "")}`
                      : ""}
                  </dd>
                </div>
              </dl>

              {boutiqueSlug ? (
                <label className="block space-y-2">
                  <span className={labelClassName}>Kupon kodu (opsiyonel)</span>
                  <input
                    value={discountCode}
                    onChange={(event) => setDiscountCode(event.target.value)}
                    className={inputClassName}
                    placeholder="Örn. YAZ10"
                    autoComplete="off"
                  />
                </label>
              ) : null}

              {!isAuthenticated ? (
                <label className="flex items-start gap-3 border border-black/5 bg-neutral-50 px-3 py-3 text-[13px]">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={saveProfile}
                    onChange={(event) => setSaveProfile(event.target.checked)}
                  />
                  <span>
                    Bu bilgileri sonraki siparişler için kaydet
                    <span className="mt-0.5 block text-[11px] text-neutral-500">
                      Yalnızca bu cihazda saklanır.
                    </span>
                  </span>
                </label>
              ) : canSaveToBook ? (
                <div className="space-y-3 border border-black/5 bg-neutral-50 px-3 py-3">
                  <label className="flex items-start gap-3 text-[13px]">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={saveToBook}
                      onChange={(event) => setSaveToBook(event.target.checked)}
                    />
                    <span>
                      Adres defterine kaydet
                      <span className="mt-0.5 block text-[11px] text-neutral-500">
                        Sonraki siparişlerde seçebilirsiniz.
                      </span>
                    </span>
                  </label>
                  {saveToBook ? (
                    <>
                      <label className="block">
                        <span className={labelClassName}>Adres adı</span>
                        <input
                          value={saveToBookLabel}
                          onChange={(event) =>
                            setSaveToBookLabel(event.target.value)
                          }
                          className={`${inputClassName} mt-2`}
                          placeholder="Ev, İş…"
                          autoComplete="off"
                        />
                      </label>
                      <label className="flex min-h-11 items-start gap-3 text-[13px] text-neutral-800">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={saveToBookDefault}
                          onChange={(event) =>
                            setSaveToBookDefault(event.target.checked)
                          }
                        />
                        <span>Varsayılan teslimat adresi</span>
                      </label>
                    </>
                  ) : null}
                </div>
              ) : isAuthenticated &&
                usingNewAddress &&
                savedAddresses.length >= TR_CUSTOMER_ADDRESS_MAX ? (
                <p className="text-[12px] text-neutral-500">
                  Adres defteri dolu ({TR_CUSTOMER_ADDRESS_MAX}). Hesabım’dan
                  bir adres silebilirsiniz.
                </p>
              ) : null}

              <div className="space-y-3 text-[12px] leading-relaxed text-neutral-800">
                <label className="flex items-start gap-3">
                  <input
                    required
                    type="checkbox"
                    className="mt-1"
                    checked={acceptedDistance}
                    onChange={(event) =>
                      setAcceptedDistance(event.target.checked)
                    }
                  />
                  <span>
                    {legalSlug ? (
                      <>
                        <Link
                          href={trBoutiqueLegalPath(legalSlug, "mesafeli-satis")}
                          className="underline underline-offset-2"
                          target="_blank"
                        >
                          Mesafeli satış sözleşmesi
                        </Link>
                        {" ve "}
                        <Link
                          href={trBoutiqueLegalPath(
                            legalSlug,
                            "on-bilgilendirme",
                          )}
                          className="underline underline-offset-2"
                          target="_blank"
                        >
                          ön bilgilendirme formunu
                        </Link>{" "}
                        okudum, kabul ediyorum.
                      </>
                    ) : (
                      "Mesafeli satış sözleşmesi ve ön bilgilendirme formunu okudum, kabul ediyorum."
                    )}
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    required
                    type="checkbox"
                    className="mt-1"
                    checked={acceptedKvkk}
                    onChange={(event) => setAcceptedKvkk(event.target.checked)}
                  />
                  <span>
                    {legalSlug ? (
                      <>
                        <Link
                          href={trBoutiqueLegalPath(legalSlug, "kvkk")}
                          className="underline underline-offset-2"
                          target="_blank"
                        >
                          KVKK aydınlatma metnini
                        </Link>{" "}
                        okudum.
                      </>
                    ) : (
                      "KVKK aydınlatma metnini okudum."
                    )}
                  </span>
                </label>
              </div>

              {error ? (
                <p className="border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                  {error}
                </p>
              ) : null}

              <TrIyzicoCheckoutBadge className="border border-black/5 bg-neutral-50 px-4 py-3" />

              <TrCheckoutStickyActions
                onBack={stepIndex > 0 ? goBack : undefined}
                shippingNudge={shippingNudge}
              >
                {canSubmit ? (
                  <button
                    type="submit"
                    disabled={submitting}
                    className={stickyPrimaryClassName}
                  >
                    {submitting
                      ? iyzicoCheckout
                        ? "Yönlendiriliyor…"
                        : "Tamamlanıyor…"
                      : demoCart && !boutiqueCheckout
                        ? "Demo siparişi tamamla"
                        : iyzicoCheckout
                          ? "Kart ile öde"
                          : "Siparişi tamamla"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-12 flex-1 cursor-not-allowed items-center justify-center border border-black/10 bg-neutral-100 px-6 py-3.5 text-[11px] tracking-[0.18em] text-neutral-400 uppercase"
                  >
                    Ödeme yakında
                  </button>
                )}
              </TrCheckoutStickyActions>
            </form>
          ) : null}
        </div>

        <aside className="border border-black/10 bg-white p-5 lg:sticky lg:top-24">
          <p className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase">
            Sipariş özeti
          </p>
          <div className="mt-4 space-y-4">
            {grouped.map((group) => (
              <div key={group.boutiqueId}>
                {!boutiqueSlug ? (
                  <p className="text-[10px] tracking-[0.16em] text-neutral-500 uppercase">
                    {group.boutiqueName}
                  </p>
                ) : null}
                <ul className="mt-2 space-y-1 text-[12px] text-neutral-800">
                  {group.items.map((item) => (
                    <li
                      key={cartLineKey(item)}
                      className="flex justify-between gap-3"
                    >
                      <span className="truncate">
                        {item.title}
                        {item.variantLabel || item.size ? (
                          <span className="text-neutral-500">
                            {" "}
                            · {item.variantLabel || item.size}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-brand-primary">
                        {formatTryFromKurus(item.priceKurus)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-black/5 pt-4 space-y-2">
            {hasShippingFee ? (
              <>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-neutral-500">Ürünler</span>
                  <span>{formatTryFromKurus(totalKurus)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-neutral-500">Kargo</span>
                  <span>
                    {shippingFeeKurus === 0
                      ? "Ücretsiz"
                      : formatTryFromKurus(shippingFeeKurus)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.16em] text-neutral-500 uppercase">
                Toplam
              </span>
              <span className="font-serif text-xl text-brand-primary">
                {formatTryFromKurus(payableKurus)}
              </span>
            </div>
          </div>
          <Link
            href={
              boutiqueSlug ? trBoutiqueCartPath(boutiqueSlug) : trCartPath()
            }
            className="mt-5 inline-block text-[10px] tracking-[0.22em] text-neutral-500 uppercase underline underline-offset-2"
          >
            ← Sepete dön
          </Link>
        </aside>
      </div>
    </div>
  );
}

function TrCheckoutPageInner({
  boutiqueSlug: boutiqueSlugProp = null,
  iyzicoCheckout = false,
  shipping,
}: {
  boutiqueSlug?: string | null;
  iyzicoCheckout?: boolean;
  shipping: ShippingFeeConfig;
}) {
  const searchParams = useSearchParams();
  const boutiqueSlug =
    boutiqueSlugProp?.trim() ||
    searchParams.get("boutique")?.trim() ||
    null;
  return (
    <TrCheckoutForm
      boutiqueSlug={boutiqueSlug}
      iyzicoCheckout={iyzicoCheckout}
      shipping={shipping}
    />
  );
}

export function TrCheckoutPageContent({
  boutiqueSlug = null,
  iyzicoCheckout = false,
  shipping = NO_SHIPPING_FEE,
}: {
  boutiqueSlug?: string | null;
  /** The boutique's shipping fee rules, resolved server-side and passed down (display only — the server re-quotes at checkout). */
  shipping?: ShippingFeeConfig;
  /** Resolved server-side (registry.ts is DB-backed and can't run client-side). Defaults false when unknown, e.g. the marketplace-wide checkout which doesn't offer card payment. */
  iyzicoCheckout?: boolean;
} = {}) {
  return (
    <Suspense
      fallback={
        <div className="px-5 py-10 text-[13px] text-neutral-600 md:px-10">
          Ödeme yükleniyor…
        </div>
      }
    >
      <TrCheckoutPageInner
        boutiqueSlug={boutiqueSlug}
        iyzicoCheckout={iyzicoCheckout}
        shipping={shipping}
      />
    </Suspense>
  );
}
