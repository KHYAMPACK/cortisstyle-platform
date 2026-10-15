import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrPurchaseTracker } from "@/components/tr/boutique/TrTrackingEvents";
import { TrIyzicoResumePay } from "@/components/tr/commerce/TrIyzicoResumePay";
import { TrIyzicoCheckoutHoldEffects } from "@/components/tr/commerce/TrIyzicoCheckoutHoldEffects";
import { resolveBoutiqueBrandLabel } from "@/lib/tr/boutiqueBrand";
import { orderItemOption } from "@/lib/tr/orderItemOption";
import { verifyOrderConfirmToken } from "@/lib/tr/orderConfirmToken";
import { getOrderByIdAdmin } from "@/lib/tr/orders";
import { boutiqueOffersIyzicoCheckout } from "@/lib/tr/payments/registry";
import { trBoutiqueOrderTrackingPath, trBoutiquePath } from "@/lib/tr/paths";
import { safeGetPublicBoutique } from "@/lib/tr/publicData";
import { formatTryFromKurus, type TrOrderItem } from "@/types/tr-marketplace";

/** "Beden: M" or "Varyant: Kırmızı / S", or null when the line has neither. */
function optionOf(item: TrOrderItem): string | null {
  const option = orderItemOption(item);
  return option ? `${option.label}: ${option.value}` : null;
}

interface BoutiqueOrderConfirmationPageProps {
  params: Promise<{ boutiqueSlug: string }>;
  searchParams: Promise<{
    demo?: string;
    order?: string;
    sandbox?: string;
    token?: string;
    unpaid?: string;
  }>;
}

export async function generateMetadata({
  params,
}: BoutiqueOrderConfirmationPageProps): Promise<Metadata> {
  const { boutiqueSlug } = await params;
  const boutique = await safeGetPublicBoutique(boutiqueSlug);
  if (!boutique) return { title: "Sipariş onayı" };
  return {
    title: "Sipariş onayı",
  };
}

export default async function BoutiqueOrderConfirmationPage({
  params,
  searchParams,
}: BoutiqueOrderConfirmationPageProps) {
  const { boutiqueSlug } = await params;
  const query = await searchParams;
  const boutique = await safeGetPublicBoutique(boutiqueSlug);

  if (!boutique) notFound();

  const demo = query.demo === "1";
  const unpaid = query.unpaid === "1";
  const orderId = query.order?.trim() || null;
  const tokenOk =
    orderId && verifyOrderConfirmToken(orderId, query.token ?? null);
  const brandTitle = resolveBoutiqueBrandLabel(boutique.slug, boutique.name);
  const iyzicoCheckout = await boutiqueOffersIyzicoCheckout(boutique.slug);

  const order =
    !demo && orderId && tokenOk
      ? await getOrderByIdAdmin(orderId).catch(() => null)
      : null;

  const boutiqueItems =
    order?.items.filter((item) => item.boutiqueId === boutique.id) ?? [];
  const orderBelongs = Boolean(order && boutiqueItems.length > 0);
  const iyzicoHoldPhase =
    orderBelongs && order && iyzicoCheckout && !order.isSandbox
      ? order.paymentStatus === "paid"
        ? "paid"
        : order.paymentStatus === "pending" ||
            order.paymentStatus === "failed" ||
            unpaid
          ? "unpaid"
          : null
      : null;

  return (
    <div className="mx-auto max-w-xl px-5 py-12 md:px-8 md:py-16">
      {iyzicoHoldPhase ? (
        <TrIyzicoCheckoutHoldEffects
          boutiqueSlug={boutique.slug}
          phase={iyzicoHoldPhase}
        />
      ) : null}
      {orderBelongs && order && order.paymentStatus === "paid" && !order.isSandbox ? (
        <TrPurchaseTracker
          orderId={order.id}
          totalKurus={order.totalKurus}
          shippingKurus={order.shipment.feeKurus ?? 0}
          items={boutiqueItems.map((item) => ({
            id: item.id,
            productId: item.productId,
            title: item.title,
            priceKurus: item.priceKurus,
            quantity: item.quantity,
            size: item.size,
            variantLabel: item.variantLabel,
          }))}
        />
      ) : null}
      <div className="text-center">
        <p className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase">
          Sipariş
        </p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight text-neutral-950 md:text-4xl">
          {demo ||
          (orderBelongs &&
            order &&
            (order.isSandbox ||
              order.paymentStatus === "paid" ||
              order.paymentStatus === "sandbox"))
            ? "Siparişiniz alındı"
            : orderBelongs &&
                order?.paymentStatus === "pending" &&
                !order.isSandbox
              ? "Ödeme bekleniyor"
              : "Sipariş onayı"}
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-neutral-600">
          {demo
            ? `Teşekkürler — ${brandTitle} vitrininde demo sipariş tamamlandı. Gerçek ödeme alınmadı.`
            : orderBelongs && order
              ? order.paymentStatus === "pending" && !order.isSandbox
                ? unpaid || iyzicoCheckout
                  ? `Kart ödemesi alınmadı. ${brandTitle} siparişiniz bekliyor — ödemeyi tamamlayınca kargoya çıkar.`
                  : `Teşekkürler ${order.customerName.split(" ")[0] ?? ""} — ${brandTitle} siparişiniz kaydedildi. Kart ödemesi yakında; ödeme onayı sonrası kargoya çıkar.`
                : `Teşekkürler ${order.customerName.split(" ")[0] ?? ""} — ${brandTitle} siparişiniz kaydedildi.`
              : orderId
                ? "Bu sipariş bulunamadı veya bağlantı geçersiz."
                : `Teşekkürler — ${brandTitle}. Sipariş özeti için ödeme sonrası gelen onay linkini kullanın.`}
        </p>
      </div>

      {orderBelongs && order ? (
        <div className="mt-10 space-y-6 border border-black/10 bg-white p-5 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] tracking-[0.16em] text-neutral-500 uppercase">
                Sipariş no
              </p>
              <p className="mt-1 font-mono text-[12px] text-neutral-800">
                {order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            {order.isSandbox || query.sandbox === "1" ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-900">
                Sandbox · kart ödemesi yok
              </span>
            ) : order.paymentStatus === "pending" ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-900">
                Ödeme bekleniyor
              </span>
            ) : null}
          </div>

          <ul className="divide-y divide-black/5">
            {boutiqueItems.map((item) => (
              <li key={item.id} className="flex gap-3 py-3">
                <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-neutral-100">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-neutral-900">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {optionOf(item) ? `${optionOf(item)} · ` : null}
                    Adet: {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-[13px] tabular-nums text-neutral-800">
                  {formatTryFromKurus(item.priceKurus * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          {order.discountKurus > 0 ? (
            <div className="flex justify-between text-[13px] text-neutral-600">
              <span>
                İndirim
                {order.discountCode ? ` (${order.discountCode})` : ""}
              </span>
              <span>−{formatTryFromKurus(order.discountKurus)}</span>
            </div>
          ) : null}

          {order.shipment.feeKurus != null && order.shipment.feeKurus > 0 ? (
            <div className="flex justify-between text-[13px] text-neutral-600">
              <span>Kargo</span>
              <span>{formatTryFromKurus(order.shipment.feeKurus)}</span>
            </div>
          ) : order.shipment.feeKurus === 0 ? (
            <div className="flex justify-between text-[13px] text-neutral-600">
              <span>Kargo</span>
              <span>Ücretsiz</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-black/5 pt-4">
            <span className="text-[10px] tracking-[0.16em] text-neutral-500 uppercase">
              Toplam
            </span>
            <span className="font-serif text-xl text-neutral-950">
              {formatTryFromKurus(order.totalKurus)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-10 text-center space-y-4">
        {orderBelongs &&
        order &&
        iyzicoCheckout &&
        !order.isSandbox &&
        (order.paymentStatus === "pending" ||
          order.paymentStatus === "failed") &&
        query.token ? (
          <TrIyzicoResumePay
            boutiqueSlug={boutique.slug}
            orderId={order.id}
            confirmToken={query.token}
          />
        ) : null}
        {orderBelongs && order?.shipment.externalId && query.token ? (
          <p>
            <Link
              href={trBoutiqueOrderTrackingPath(boutique.slug, order.id, {
                token: query.token,
              })}
              className="text-[13px] underline underline-offset-2"
            >
              Kargo takip
            </Link>
          </p>
        ) : null}
        <Link
          href={trBoutiquePath(boutique.slug)}
          className={
            orderBelongs &&
            order &&
            iyzicoCheckout &&
            !order.isSandbox &&
            order.paymentStatus === "pending"
              ? "inline-flex min-h-12 items-center justify-center px-6 py-3.5 text-[13px] underline underline-offset-2"
              : "btn-primary inline-flex items-center justify-center px-6 py-4 text-[11px] tracking-[0.2em]"
          }
        >
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}
