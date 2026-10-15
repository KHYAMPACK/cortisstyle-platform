"use client";

import { useEffect, useSyncExternalStore } from "react";
import { kurusToTry } from "@/lib/tr/tracking/events";
import { orderItemToTrackedItem } from "@/lib/tr/tracking/items";
import {
  isTrackingActive,
  subscribeTrackingActive,
  trackEvent,
} from "@/lib/tr/tracking/runtime";

/** True once the shell's tracker has switched tracking on (tags configured + consent). */
export function useTrackingActive(): boolean {
  return useSyncExternalStore(subscribeTrackingActive, isTrackingActive, () => false);
}

/** Reports a product page view (once per product, as soon as tracking is on). */
export function TrTrackViewItem({
  productId,
  name,
  priceKurus,
}: {
  productId: string;
  name: string;
  priceKurus: number;
}) {
  const active = useTrackingActive();
  useEffect(() => {
    if (!active) return;
    trackEvent({
      type: "view_item",
      item: { id: productId, name, priceTry: kurusToTry(priceKurus), quantity: 1 },
    });
  }, [active, productId, name, priceKurus]);
  return null;
}

const PURCHASE_KEY_PREFIX = "cortis-tr-purchase-tracked:";

/**
 * Reports a paid order once. The order id is remembered on this device, so reloading
 * the confirmation page (or coming back to it) never counts the sale twice.
 */
export function TrPurchaseTracker({
  orderId,
  totalKurus,
  shippingKurus,
  items,
}: {
  orderId: string;
  totalKurus: number;
  shippingKurus: number;
  items: Array<{
    id: string;
    productId: string | null;
    title: string;
    priceKurus: number;
    quantity: number;
    size: string | null;
    variantLabel: string | null;
  }>;
}) {
  const active = useTrackingActive();
  useEffect(() => {
    if (!active) return;
    const key = `${PURCHASE_KEY_PREFIX}${orderId}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // Storage blocked: report anyway — Meta de-duplicates on the order id.
    }
    trackEvent({
      type: "purchase",
      transactionId: orderId,
      valueTry: kurusToTry(totalKurus),
      shippingTry: kurusToTry(shippingKurus),
      items: items.map(orderItemToTrackedItem),
    });
  }, [active, orderId, totalKurus, shippingKurus, items]);
  return null;
}
