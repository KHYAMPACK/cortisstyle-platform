import { createOrderAdmin } from "@/lib/tr/orders";
import { getPublicBoutiqueBySlug } from "@/lib/tr/boutiques";
import {
  recordCampaignUsageIfNeeded,
  recordCodeUsageIfNeeded,
  resolveCheckoutFromCatalog,
  type CheckoutClientItem,
} from "@/lib/tr/checkoutValidate";
import { createOrderConfirmToken } from "@/lib/tr/orderConfirmToken";
import { sendOrderConfirmationEmailSafe } from "@/lib/tr/orderMail/sendOrderEmails";
import { isTrCheckoutSandboxMode } from "@/lib/tr/checkoutMode";
import {
  normalizeBuyerTaxId,
  validateCheckoutInvoiceFields,
} from "@/lib/tr/invoiceFields";
import { validateTurkeyShippingAddress } from "@/lib/tr/geo/turkeyAddress";
import {
  clientIpFromRequest,
  consumeRateLimit,
  rateLimitResponse,
} from "@/lib/tr/rateLimit";
import { CHECKOUT_RATE_LIMITS } from "@/lib/tr/rateLimitPolicies";
import { isValidNotifyEmail } from "@/lib/supabaseAdmin";
import {
  boutiqueOffersIyzicoCheckout,
  getIyzicoCredentials,
} from "@/lib/tr/payments/registry";
import { abandonUnpaidIyzicoOrder, abandonStaleIyzicoHolds } from "@/lib/tr/payments/abandonUnpaid";
import { startIyzicoCheckoutForm } from "@/lib/tr/payments/startCheckoutForm";
import { autoFulfillPaidShipment } from "@/lib/tr/shipping/ownerShipment";
import {
  quoteCheckoutShippingFee,
  shippingFeeConfigOf,
} from "@/lib/tr/shipping/quoteShipping";
import { boutiqueHasCarrierIntegration } from "@/lib/tr/shipping/registry";
import type {
  CreateTrOrderInput,
  TrBoutiquePublic,
  TrInvoiceType,
} from "@/types/tr-marketplace";

export const runtime = "nodejs";

type CheckoutBody = {
  boutiqueSlug?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress: CreateTrOrderInput["shippingAddress"];
  invoiceType?: TrInvoiceType | string;
  buyerTaxId?: string;
  buyerTaxOffice?: string;
  buyerTitle?: string;
  items: CheckoutClientItem[];
  discountCode?: string;
  /** Accept mesafeli satış + ön bilgilendirme */
  acceptedDistanceSales: boolean;
  acceptedKvkk: boolean;
};

function validateCustomerFields(body: CheckoutBody): string | null {
  if (!body.customerName?.trim() || body.customerName.trim().length < 2) {
    return "Geçerli bir ad soyad girin.";
  }
  const email = body.customerEmail?.trim().toLowerCase() ?? "";
  if (!isValidNotifyEmail(email)) {
    return "Geçerli bir e-posta girin.";
  }
  const phone = body.customerPhone?.trim() ?? "";
  if (phone.length < 10) {
    return "Geçerli bir telefon numarası girin.";
  }
  const addr = body.shippingAddress;
  if (!addr) {
    return "Teslimat adresini tamamlayın.";
  }
  const validated = validateTurkeyShippingAddress(addr);
  if (!validated.ok) return validated.error;
  body.shippingAddress = {
    line1: validated.address.line1,
    line2: validated.address.line2,
    city: validated.address.city,
    district: validated.address.district,
    postalCode: validated.address.postalCode,
    country: "TR",
  };
  return null;
}

/**
 * Boutique checkout — sandbox only when TR_CHECKOUT_SANDBOX=true;
 * otherwise creates pending orders (ready for iyzico capture).
 * POST /api/tr/checkout
 */
export async function POST(request: Request) {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return Response.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const ip = clientIpFromRequest(request);
  const ipLimit = consumeRateLimit({
    key: `checkout:ip:${ip}`,
    ...CHECKOUT_RATE_LIMITS.perIp,
  });
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.retryAfterSec);

  if (!body.acceptedDistanceSales || !body.acceptedKvkk) {
    return Response.json(
      { error: "Sözleşmeleri onaylamanız gerekir." },
      { status: 400 },
    );
  }

  const fieldError = validateCustomerFields(body);
  if (fieldError) {
    return Response.json({ error: fieldError }, { status: 400 });
  }

  const invoiceError = validateCheckoutInvoiceFields({
    invoiceType: body.invoiceType,
    buyerTaxId: body.buyerTaxId,
    buyerTaxOffice: body.buyerTaxOffice,
    buyerTitle: body.buyerTitle,
  });
  if (invoiceError) {
    return Response.json({ error: invoiceError }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "Sepet boş." }, { status: 400 });
  }

  const boutiqueSlug = body.boutiqueSlug?.trim().toLowerCase() || null;
  let expectedBoutiqueId: string | null = null;
  let boutique: TrBoutiquePublic | null = null;

  if (boutiqueSlug) {
    const boutiqueLimit = consumeRateLimit({
      key: `checkout:boutique:${boutiqueSlug}`,
      ...CHECKOUT_RATE_LIMITS.perBoutique,
    });
    if (!boutiqueLimit.ok) return rateLimitResponse(boutiqueLimit.retryAfterSec);

    boutique = await getPublicBoutiqueBySlug(boutiqueSlug);
    if (!boutique) {
      return Response.json({ error: "Butik bulunamadı." }, { status: 404 });
    }
    expectedBoutiqueId = boutique.id;
  }

  try {
    const resolved = await resolveCheckoutFromCatalog({
      items: body.items,
      expectedBoutiqueId,
      discountCode: body.discountCode,
      customerEmail: body.customerEmail,
    });

    if (!resolved.ok) {
      return Response.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }

    const { checkout } = resolved;

    const sandbox = isTrCheckoutSandboxMode();
    const wantsIyzico =
      Boolean(boutiqueSlug) &&
      !sandbox &&
      (await boutiqueOffersIyzicoCheckout(boutiqueSlug));
    if (wantsIyzico && !(await getIyzicoCredentials(boutiqueSlug!))) {
      return Response.json(
        { error: "Kart ödemesi şu an alınamıyor. Biraz sonra tekrar deneyin." },
        { status: 503 },
      );
    }

    const invoiceType: TrInvoiceType =
      body.invoiceType === "corporate" ? "corporate" : "individual";

    let shippingFeeKurus = 0;
    let shippingProvider: CreateTrOrderInput["shippingProvider"] = null;
    if (boutique) {
      // Server-side only: the fee comes from the boutique's own settings and the
      // re-priced catalog lines, never from anything the client sent. A matching
      // free-shipping campaign overrides it.
      shippingFeeKurus = checkout.freeShipping
        ? 0
        : (quoteCheckoutShippingFee(shippingFeeConfigOf(boutique), checkout.lines)
            ?.feeKurus ?? 0);
      if (boutiqueSlug && boutiqueHasCarrierIntegration(boutiqueSlug)) {
        shippingProvider = "basitkargo";
      }
    }

    if (wantsIyzico && boutique) {
      try {
        await abandonStaleIyzicoHolds(boutique.id);
      } catch (staleError) {
        console.error("[tr/checkout] stale iyzico hold cleanup failed:", staleError);
      }
    }

    const order = await createOrderAdmin({
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      shippingAddress: body.shippingAddress,
      invoiceType,
      buyerTaxId:
        invoiceType === "corporate"
          ? normalizeBuyerTaxId(body.buyerTaxId)
          : null,
      buyerTaxOffice:
        invoiceType === "corporate" ? body.buyerTaxOffice : undefined,
      buyerTitle: invoiceType === "corporate" ? body.buyerTitle : undefined,
      items: checkout.lines.map((line) => ({
        productId: line.productId,
        boutiqueId: line.boutiqueId,
        title: line.title,
        priceKurus: line.priceKurus,
        quantity: line.quantity,
        size: line.size,
        variantId: line.variantId,
        variantLabel: line.variantLabel,
        referenceImageUrl: line.referenceImageUrl,
        customization: line.customization,
      })),
      discountCode: checkout.discountCode,
      discountKurus: checkout.discountKurus,
      discountTitle: checkout.discountTitle,
      discountCampaignIds: checkout.appliedCampaigns.map((campaign) => campaign.id),
      shippingFeeKurus,
      shippingProvider,
      isSandbox: sandbox,
      decrementInventory: !checkout.skipInventoryDecrement,
      notifyOwners: !wantsIyzico,
    });

    // Card capture: burn the coupon/campaigns only after iyzico SUCCESS.
    if (!wantsIyzico) {
      try {
        await recordCodeUsageIfNeeded(checkout.appliedCode);
      } catch (couponError) {
        console.error("[tr/checkout] coupon usage increment failed:", couponError);
      }
      try {
        await recordCampaignUsageIfNeeded(checkout.appliedCampaigns);
      } catch (campaignError) {
        console.error("[tr/checkout] campaign usage increment failed:", campaignError);
      }
      // No card payment to wait for: the order is final now. (A card order's
      // confirmation goes out when iyzico reports it paid — capturePaidOrder.)
      await sendOrderConfirmationEmailSafe(order.id);
    }

    const confirmToken = createOrderConfirmToken(order.id);

    if (
      sandbox &&
      boutiqueSlug &&
      expectedBoutiqueId &&
      boutiqueHasCarrierIntegration(boutiqueSlug)
    ) {
      await autoFulfillPaidShipment(
        { id: expectedBoutiqueId, slug: boutiqueSlug },
        order.id,
      );
    }

    let paymentPageUrl: string | null = null;
    let checkoutToken: string | null = null;
    if (wantsIyzico && boutique) {
      try {
        const started = await startIyzicoCheckoutForm({
          boutiqueSlug: boutique.slug,
          boutiqueCustomDomain: boutique.customDomain,
          order,
          buyerIp: ip,
        });
        paymentPageUrl = started.paymentPageUrl;
        checkoutToken = started.token;
      } catch (iyzicoError) {
        console.error("[tr/checkout] iyzico initialize failed:", iyzicoError);
        try {
          await abandonUnpaidIyzicoOrder(order);
        } catch (abandonError) {
          console.error("[tr/checkout] abandon after init fail:", abandonError);
        }
        return Response.json(
          {
            error:
              "Kart ödemesi başlatılamadı. Sepetiniz duruyor — tekrar deneyin.",
          },
          { status: 502 },
        );
      }
    }

    return Response.json({
      ok: true,
      orderId: order.id,
      confirmToken,
      sandbox,
      totalKurus: order.totalKurus,
      discountKurus: order.discountKurus,
      paymentPageUrl,
      checkoutToken,
    });
  } catch (error) {
    console.error("TR checkout failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Sipariş oluşturulamadı.",
      },
      { status: 500 },
    );
  }
}
