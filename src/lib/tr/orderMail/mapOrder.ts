import { orderItemOption } from "@/lib/tr/orderItemOption";
import type { OrderMailOrder } from "@/lib/tr/orderMail/templates";
import type { TrOrderWithItems } from "@/types/tr-marketplace";

/** The shipping address as printed lines, skipping what's blank. */
function addressLines(order: Pick<TrOrderWithItems, "shippingAddress">): string[] {
  const address = order.shippingAddress;
  if (!address) return [];
  const place = [address.postalCode, address.district && address.city ? `${address.district} / ${address.city}` : address.city || address.district]
    .filter(Boolean)
    .join(" ");
  return [address.line1, address.line2, place]
    .map((line) => line?.trim() ?? "")
    .filter(Boolean);
}

/** An order as the e-mail templates read it; only the lines belonging to `boutiqueId`. */
export function toOrderMailOrder(order: TrOrderWithItems, boutiqueId: string): OrderMailOrder {
  const lines = order.items
    .filter((item) => item.boutiqueId === boutiqueId)
    .map((item) => {
      const option = orderItemOption(item);
      return {
        title: item.title,
        option: option ? `${option.label}: ${option.value}` : null,
        quantity: item.quantity,
        priceKurus: item.priceKurus,
      };
    });
  return {
    number: order.id.slice(0, 8).toUpperCase(),
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone?.trim() || null,
    lines,
    discountKurus: order.discountKurus,
    discountLabel: order.discountTitle ?? (order.discountCode ? `İndirim (${order.discountCode})` : null),
    shippingKurus: order.shipment.feeKurus,
    totalKurus: order.totalKurus,
    addressLines: addressLines(order),
    paid: order.paymentStatus === "paid",
  };
}
