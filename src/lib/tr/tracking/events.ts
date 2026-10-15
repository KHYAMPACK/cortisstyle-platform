import type { TrBoutiqueTracking } from "./config";

/**
 * Storefront conversion events, in one neutral shape, translated for each tool
 * (GA4 / Google Tag Manager's data layer, Meta Pixel, Google Ads). The builders are
 * pure; `dispatchTrackingEvent` only talks to whatever the page's tags put on
 * `window`, so with no tags (or no cookie consent) nothing at all happens.
 */

export interface TrackedItem {
  id: string;
  name: string;
  /** Unit price in TRY (not kuruş) — what the ad tools expect. */
  priceTry: number;
  quantity: number;
  variant?: string | null;
}

export type TrackingEvent =
  | { type: "page_view"; path: string }
  | { type: "view_item"; item: TrackedItem }
  | { type: "add_to_cart"; item: TrackedItem }
  | { type: "begin_checkout"; valueTry: number; items: TrackedItem[] }
  | {
      type: "purchase";
      transactionId: string;
      valueTry: number;
      shippingTry: number;
      items: TrackedItem[];
    };

export const TRACKING_CURRENCY = "TRY";

/** kuruş → TRY, rounded to the kuruş so floating-point never shows up in a report. */
export function kurusToTry(kurus: number): number {
  return Math.round(kurus) / 100;
}

function ga4Item(item: TrackedItem) {
  return {
    item_id: item.id,
    item_name: item.name,
    price: item.priceTry,
    quantity: item.quantity,
    ...(item.variant ? { item_variant: item.variant } : {}),
  };
}

function itemsValue(items: TrackedItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.priceTry * item.quantity, 0) * 100) / 100;
}

/** GA4's name and parameters for an event (the same payload goes to GTM's data layer). */
export function buildGa4Event(
  event: TrackingEvent,
): { name: string; params: Record<string, unknown> } {
  switch (event.type) {
    case "page_view":
      return { name: "page_view", params: { page_path: event.path } };
    case "view_item":
      return {
        name: "view_item",
        params: {
          currency: TRACKING_CURRENCY,
          value: event.item.priceTry,
          items: [ga4Item(event.item)],
        },
      };
    case "add_to_cart":
      return {
        name: "add_to_cart",
        params: {
          currency: TRACKING_CURRENCY,
          value: event.item.priceTry * event.item.quantity,
          items: [ga4Item(event.item)],
        },
      };
    case "begin_checkout":
      return {
        name: "begin_checkout",
        params: {
          currency: TRACKING_CURRENCY,
          value: event.valueTry,
          items: event.items.map(ga4Item),
        },
      };
    case "purchase":
      return {
        name: "purchase",
        params: {
          transaction_id: event.transactionId,
          currency: TRACKING_CURRENCY,
          value: event.valueTry,
          shipping: event.shippingTry,
          items: event.items.map(ga4Item),
        },
      };
  }
}

/** Meta Pixel's standard event for ours, or `null` when it has no use for it. */
export function buildMetaEvent(
  event: TrackingEvent,
): { name: string; params: Record<string, unknown>; eventId?: string } | null {
  const contents = (items: TrackedItem[]) =>
    items.map((item) => ({ id: item.id, quantity: item.quantity, item_price: item.priceTry }));
  switch (event.type) {
    case "page_view":
      return { name: "PageView", params: {} };
    case "view_item":
      return {
        name: "ViewContent",
        params: {
          content_ids: [event.item.id],
          content_type: "product",
          content_name: event.item.name,
          value: event.item.priceTry,
          currency: TRACKING_CURRENCY,
        },
      };
    case "add_to_cart":
      return {
        name: "AddToCart",
        params: {
          content_ids: [event.item.id],
          content_type: "product",
          content_name: event.item.name,
          contents: contents([event.item]),
          value: event.item.priceTry * event.item.quantity,
          currency: TRACKING_CURRENCY,
        },
      };
    case "begin_checkout":
      return {
        name: "InitiateCheckout",
        params: {
          content_ids: event.items.map((item) => item.id),
          content_type: "product",
          contents: contents(event.items),
          num_items: event.items.reduce((sum, item) => sum + item.quantity, 0),
          value: event.valueTry,
          currency: TRACKING_CURRENCY,
        },
      };
    case "purchase":
      return {
        name: "Purchase",
        params: {
          content_ids: event.items.map((item) => item.id),
          content_type: "product",
          contents: contents(event.items),
          num_items: event.items.reduce((sum, item) => sum + item.quantity, 0),
          value: event.valueTry,
          currency: TRACKING_CURRENCY,
        },
        // The same id lets Meta drop a duplicate if the page is ever reported twice.
        eventId: event.transactionId,
      };
  }
}

/** What the page's tags put on `window`; every entry is optional because tags load late. */
export interface TrackingWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
}

/**
 * Sends one event to every tool the store configured. With Google Tag Manager the
 * GA4-shaped event goes to the data layer (the container's tags pick it up);
 * otherwise GA4 and the Google Ads purchase conversion are sent through gtag.
 */
export function dispatchTrackingEvent(
  event: TrackingEvent,
  config: TrBoutiqueTracking,
  win: TrackingWindow,
): void {
  const ga4 = buildGa4Event(event);

  if (config.gtmId) {
    win.dataLayer = win.dataLayer ?? [];
    if (ga4.params.items) win.dataLayer.push({ ecommerce: null });
    win.dataLayer.push({
      event: ga4.name,
      ...(ga4.params.items ? { ecommerce: ga4.params } : ga4.params),
    });
  } else if (win.gtag) {
    if (config.ga4Id) win.gtag("event", ga4.name, ga4.params);
    if (event.type === "purchase" && config.googleAdsId && config.googleAdsPurchaseLabel) {
      win.gtag("event", "conversion", {
        send_to: `${config.googleAdsId}/${config.googleAdsPurchaseLabel}`,
        value: event.valueTry,
        currency: TRACKING_CURRENCY,
        transaction_id: event.transactionId,
      });
    }
  }

  if (config.metaPixelId && win.fbq) {
    const meta = buildMetaEvent(event);
    if (meta) {
      if (meta.eventId) win.fbq("track", meta.name, meta.params, { eventID: meta.eventId });
      else win.fbq("track", meta.name, meta.params);
    }
  }
}

export { itemsValue as trackedItemsValue };
