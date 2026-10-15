import { isPlatformMailConfigured, sendPlatformEmail } from "@/lib/mail/sendPlatformEmail";
import { siteLegal } from "@/lib/platform/siteLegal";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { resolveBoutiqueAuthMailBrand } from "@/lib/tr/authMail/templates";
import { getBoutiqueByIdAdmin } from "@/lib/tr/boutiques";
import { resolveBoutiqueContactEmail } from "@/lib/tr/checkoutMode";
import { toOrderMailOrder } from "@/lib/tr/orderMail/mapOrder";
import {
  buildOrderConfirmationEmail,
  buildOwnerNewOrderEmail,
} from "@/lib/tr/orderMail/templates";
import { createOrderConfirmToken } from "@/lib/tr/orderConfirmToken";
import { getOrderByIdAdmin } from "@/lib/tr/orders";
import { trOrderConfirmationPath, trPanelOrderPath } from "@/lib/tr/paths";
import { storeAddress, storeCustomerPath } from "@/lib/tr/seo/storeAddress";
import type { TrBoutique, TrOrderWithItems } from "@/types/tr-marketplace";

/**
 * The two e-mails about a new order. Both are best-effort: an order must never fail
 * or slow down because mail is misconfigured, so every failure is logged and
 * swallowed. Test (sandbox) orders send nothing.
 */

async function loadOrderAndBoutique(
  orderId: string,
): Promise<{ order: TrOrderWithItems; boutique: TrBoutique } | null> {
  const order = await getOrderByIdAdmin(orderId);
  if (!order || order.isSandbox) return null;
  const boutiqueId = order.items[0]?.boutiqueId;
  if (!boutiqueId) return null;
  const boutique = await getBoutiqueByIdAdmin(boutiqueId);
  return boutique ? { order, boutique } : null;
}

/** The shopper's "siparişiniz alındı", with a link back to the order's page. */
export async function sendOrderConfirmationEmailSafe(orderId: string): Promise<void> {
  try {
    if (!isPlatformMailConfigured()) return;
    const loaded = await loadOrderAndBoutique(orderId);
    if (!loaded || !loaded.order.customerEmail) return;
    const { order, boutique } = loaded;

    const address = storeAddress({
      boutiqueSlug: boutique.slug,
      customDomain: boutique.customDomain,
    });
    const path = storeCustomerPath(
      boutique.slug,
      trOrderConfirmationPath({ boutique: boutique.slug }),
      address.mode,
    );
    const query = new URLSearchParams({
      order: order.id,
      token: createOrderConfirmToken(order.id),
    });

    const supportEmail = resolveBoutiqueContactEmail(boutique);
    const mail = buildOrderConfirmationEmail({
      brand: resolveBoutiqueAuthMailBrand(boutique),
      order: toOrderMailOrder(order, boutique.id),
      orderUrl: `${address.origin}${path}?${query.toString()}`,
      supportEmail,
    });

    await sendPlatformEmail({
      to: order.customerEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      fromName: boutique.name,
      replyTo: supportEmail,
    });
  } catch (error) {
    console.error("[tr/orderMail] confirmation e-mail failed:", error);
  }
}

async function ownerAlertRecipients(boutique: TrBoutique): Promise<string[]> {
  const recipients = new Set<string>();
  if (boutique.contactEmail?.trim()) recipients.add(boutique.contactEmail.trim().toLowerCase());
  if (boutique.ownerUserId) {
    const admin = getServiceSupabase();
    if (admin) {
      const { data } = await admin.auth.admin.getUserById(boutique.ownerUserId);
      const email = data.user?.email?.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }
  return [...recipients];
}

/** "Yeni sipariş" to the store's support address and its owner's login address. */
export async function sendOwnerNewOrderEmailSafe(orderId: string): Promise<void> {
  try {
    if (!isPlatformMailConfigured()) return;
    const loaded = await loadOrderAndBoutique(orderId);
    if (!loaded) return;
    const { order, boutique } = loaded;

    const recipients = await ownerAlertRecipients(boutique);
    if (recipients.length === 0) return;

    const mail = buildOwnerNewOrderEmail({
      brand: resolveBoutiqueAuthMailBrand(boutique),
      order: toOrderMailOrder(order, boutique.id),
      panelUrl: `${siteLegal.siteUrl.replace(/\/$/, "")}${trPanelOrderPath(order.id)}`,
    });

    await Promise.all(
      recipients.map((to) =>
        sendPlatformEmail({
          to,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          fromName: boutique.name,
        }),
      ),
    );
  } catch (error) {
    console.error("[tr/orderMail] owner e-mail failed:", error);
  }
}
