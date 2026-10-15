import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_TRACKING } from "./config";
import {
  buildGa4Event,
  buildMetaEvent,
  dispatchTrackingEvent,
  kurusToTry,
  type TrackedItem,
  type TrackingWindow,
} from "./events";

const item: TrackedItem = { id: "p1", name: "Çanta", priceTry: 1250.5, quantity: 1, variant: "Kırmızı / S" };

function fakeWindow() {
  const calls: Array<{ fn: string; args: unknown[] }> = [];
  const win: TrackingWindow = {
    gtag: (...args) => calls.push({ fn: "gtag", args }),
    fbq: (...args) => calls.push({ fn: "fbq", args }),
  };
  return { win, calls };
}

describe("kurusToTry", () => {
  it("converts without floating-point noise", () => {
    assert.equal(kurusToTry(125050), 1250.5);
    assert.equal(kurusToTry(10), 0.1);
  });
});

describe("buildGa4Event", () => {
  it("uses GA4's ecommerce shape", () => {
    const event = buildGa4Event({ type: "add_to_cart", item });
    assert.equal(event.name, "add_to_cart");
    assert.deepEqual(event.params, {
      currency: "TRY",
      value: 1250.5,
      items: [
        { item_id: "p1", item_name: "Çanta", price: 1250.5, quantity: 1, item_variant: "Kırmızı / S" },
      ],
    });
  });

  it("carries the transaction id and shipping on a purchase", () => {
    const event = buildGa4Event({
      type: "purchase",
      transactionId: "ORD-1",
      valueTry: 1370.5,
      shippingTry: 120,
      items: [item],
    });
    assert.equal(event.params.transaction_id, "ORD-1");
    assert.equal(event.params.shipping, 120);
    assert.equal(event.params.value, 1370.5);
  });
});

describe("buildMetaEvent", () => {
  it("maps to Meta's standard events", () => {
    assert.equal(buildMetaEvent({ type: "view_item", item })?.name, "ViewContent");
    assert.equal(buildMetaEvent({ type: "add_to_cart", item })?.name, "AddToCart");
    assert.equal(
      buildMetaEvent({ type: "begin_checkout", valueTry: 1250.5, items: [item] })?.name,
      "InitiateCheckout",
    );
  });

  it("gives a purchase an event id for de-duplication", () => {
    const meta = buildMetaEvent({
      type: "purchase",
      transactionId: "ORD-1",
      valueTry: 1250.5,
      shippingTry: 0,
      items: [item],
    });
    assert.equal(meta?.name, "Purchase");
    assert.equal(meta?.eventId, "ORD-1");
    assert.equal(meta?.params.currency, "TRY");
  });
});

describe("dispatchTrackingEvent", () => {
  it("does nothing for a store with no tags", () => {
    const { win, calls } = fakeWindow();
    dispatchTrackingEvent({ type: "page_view", path: "/" }, EMPTY_TRACKING, win);
    assert.equal(calls.length, 0);
  });

  it("sends GA4 through gtag and Meta through fbq", () => {
    const { win, calls } = fakeWindow();
    dispatchTrackingEvent(
      { type: "view_item", item },
      { ...EMPTY_TRACKING, ga4Id: "G-ABCDE12345", metaPixelId: "1234567890123456" },
      win,
    );
    assert.deepEqual(
      calls.map((call) => `${call.fn}:${String(call.args[1])}`),
      ["gtag:view_item", "fbq:ViewContent"],
    );
  });

  it("reports the Google Ads conversion on a purchase only, with the label", () => {
    const { win, calls } = fakeWindow();
    const config = { ...EMPTY_TRACKING, googleAdsId: "AW-123456789", googleAdsPurchaseLabel: "AbCdEfGhIj" };
    dispatchTrackingEvent({ type: "view_item", item }, config, win);
    assert.equal(calls.length, 0);
    dispatchTrackingEvent(
      { type: "purchase", transactionId: "ORD-1", valueTry: 99, shippingTry: 0, items: [item] },
      config,
      win,
    );
    const conversion = calls.find((call) => call.args[1] === "conversion");
    assert.deepEqual(conversion?.args[2], {
      send_to: "AW-123456789/AbCdEfGhIj",
      value: 99,
      currency: "TRY",
      transaction_id: "ORD-1",
    });
  });

  it("uses the data layer, not gtag, when Google Tag Manager is configured", () => {
    const { win, calls } = fakeWindow();
    dispatchTrackingEvent(
      { type: "add_to_cart", item },
      { ...EMPTY_TRACKING, gtmId: "GTM-ABC1234", ga4Id: "G-ABCDE12345" },
      win,
    );
    assert.equal(calls.filter((call) => call.fn === "gtag").length, 0);
    const layer = win.dataLayer as Array<Record<string, unknown>>;
    assert.deepEqual(layer[0], { ecommerce: null });
    assert.equal(layer[1]?.event, "add_to_cart");
  });
});
