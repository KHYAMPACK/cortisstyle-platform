import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { getBoutiqueByIdAdmin } from "@/lib/tr/boutiques";
import { isTrAdminAuthorized } from "@/lib/tr/adminAuth";
import { resolveBoutiqueContactEmail } from "@/lib/tr/commerce/checkoutMode";
import { boutiqueOffersIyzicoCheckout } from "@/lib/tr/payments/registry";
import { boutiqueHasCarrierIntegration } from "@/lib/tr/shipping/registry";
import { shippingFeeConfigOf } from "@/lib/tr/shipping/quoteShipping";
import { freeShippingPromoCopy, tlLabel } from "@/lib/tr/shipping/shippingCopy";
import { trackingToolNames } from "@/lib/tr/tracking/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckResult {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

async function fetchOk(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
    });
    return {
      ok: response.ok,
      detail: `${response.status} ${response.statusText}`.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "fetch failed",
    };
  }
}

/**
 * Per-boutique go-live readiness check — a plain pass/fail list to read
 * before telling a client "you're live". Distinct from
 * /api/tr/admin/boutique-health, which checks Supabase/RLS infra health,
 * not per-boutique readiness — see docs/phase1b-onboarding-tooling-plan.md §4.
 *
 * GET /api/tr/admin/boutiques/[id]/go-live-check
 * Authorization: Bearer {TR_ADMIN_SECRET}
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isTrAdminAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const boutique = await getBoutiqueByIdAdmin(id);
  if (!boutique) {
    return Response.json({ error: "Boutique not found." }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const checks: CheckResult[] = [];

  // 1. Has at least one product.
  const supabase = getServiceSupabase();
  let productCount = 0;
  if (supabase) {
    const { count } = await supabase
      .from("tr_products")
      .select("id", { count: "exact", head: true })
      .eq("boutique_id", boutique.id)
      .in("status", ["available", "sold"]);
    productCount = count ?? 0;
  }
  checks.push({
    id: "has_products",
    label: "Has at least one product",
    ok: productCount > 0,
    detail: `${productCount} product(s)`,
  });

  // 2. Storefront renders.
  const storefront = await fetchOk(`${origin}/tr/${boutique.slug}`);
  checks.push({
    id: "storefront_renders",
    label: "Storefront page loads",
    ok: storefront.ok,
    detail: storefront.detail,
  });

  // 3. Contact email is boutique-specific, not just the platform fallback.
  const contactEmail = resolveBoutiqueContactEmail(boutique);
  const usingPlatformFallback = contactEmail === "info@cortisstyle.com";
  checks.push({
    id: "contact_email",
    label: "Contact email set (not platform fallback)",
    ok: !usingPlatformFallback,
    detail: contactEmail,
  });

  // 4. Legal-page context fields populated (legal pages still render with these
  // empty, but read as generic/placeholder-ish without them).
  const legalFields: Array<[string, string | null]> = [
    ["legalName", boutique.legalName],
    ["physicalAddress", boutique.physicalAddress],
    ["vergiNo", boutique.vergiNo],
    ["vergiDairesi", boutique.vergiDairesi],
    ["whatsappPhone", boutique.whatsappPhone],
  ];
  const missingLegal = legalFields
    .filter(([, value]) => !value?.trim())
    .map(([field]) => field);
  checks.push({
    id: "legal_fields",
    label: "Legal-page fields populated",
    ok: missingLegal.length === 0,
    detail:
      missingLegal.length === 0
        ? "all set"
        : `missing: ${missingLegal.join(", ")}`,
  });

  // 4b. Company registry details — MERSİS / KEP apply to companies; informational.
  checks.push({
    id: "company_registry",
    label: "MERSİS / KEP on the künye page",
    ok: true,
    detail:
      [
        boutique.mersisNo ? "MERSİS set" : "no MERSİS",
        boutique.kepAddress ? "KEP set" : "no KEP",
      ].join(", ") + " (companies should have both)",
  });

  // 4c. Logo — shown in the header and in auth/order e-mails. Informational.
  checks.push({
    id: "logo",
    label: "Logo set",
    ok: Boolean(boutique.logoUrl?.trim()),
    detail: boutique.logoUrl?.trim() || "no logo — the header shows the name only",
  });

  // 4d. Ad / analytics tags — informational.
  const tools = trackingToolNames(boutique.tracking);
  checks.push({
    id: "tracking",
    label: "Ad / analytics tags configured",
    ok: true,
    detail: tools.length > 0 ? tools.join(", ") : "none — no conversion tracking",
  });

  // 5. Payment mode — informational, not a blocker either way.
  const iyzicoEnabled = await boutiqueOffersIyzicoCheckout(boutique.slug);
  checks.push({
    id: "payment_mode",
    label: "Payment mode decided",
    ok: true,
    detail: iyzicoEnabled
      ? "iyzico live checkout"
      : "manual (pending orders, owner marks paid)",
  });

  // 6. Shipping — informational, not a blocker either way. Two separate things:
  // whether a carrier is integrated, and what the shopper is charged.
  const carrierIntegrated = boutiqueHasCarrierIntegration(boutique.slug);
  checks.push({
    id: "shipping_mode",
    label: "Shipping mode decided",
    ok: true,
    detail: carrierIntegrated ? "live carrier" : "manual tracking",
  });
  const feeConfig = shippingFeeConfigOf(boutique);
  const promo = freeShippingPromoCopy(feeConfig);
  checks.push({
    id: "shipping_fee",
    label: "Shopper shipping fee set",
    ok: true,
    detail:
      feeConfig.feeKurus > 0
        ? `${tlLabel(feeConfig.feeKurus)}${promo ? `, ${promo}` : ""}`
        : "none — shoppers are not charged for shipping",
  });

  // 7. Custom domain resolves, if one is set.
  if (boutique.customDomain) {
    const domain = await fetchOk(`https://${boutique.customDomain}`);
    checks.push({
      id: "custom_domain",
      label: `Custom domain resolves (${boutique.customDomain})`,
      ok: domain.ok,
      detail: domain.detail,
    });
  }

  // 8. Google Merchant feed valid.
  const feedUrl = `${origin}/tr/${boutique.slug}/feeds/google-merchant.xml`;
  let feedOk = false;
  let feedDetail = "";
  try {
    const response = await fetch(feedUrl, { cache: "no-store" });
    const text = await response.text();
    feedOk = response.ok && /<\?xml|<rss/i.test(text.slice(0, 200));
    feedDetail = response.ok
      ? feedOk
        ? "valid XML"
        : "200 but doesn't look like XML"
      : `${response.status} ${response.statusText}`.trim();
  } catch (error) {
    feedDetail = error instanceof Error ? error.message : "fetch failed";
  }
  checks.push({
    id: "merchant_feed",
    label: "Google Merchant feed valid",
    ok: feedOk,
    detail: feedDetail,
  });

  const blockingChecks = checks.filter((c) =>
    ["has_products", "storefront_renders", "merchant_feed"].includes(c.id),
  );
  const readyToGoLive = blockingChecks.every((c) => c.ok);

  return Response.json({
    boutique: { id: boutique.id, slug: boutique.slug, name: boutique.name },
    readyToGoLive,
    checks,
  });
}
