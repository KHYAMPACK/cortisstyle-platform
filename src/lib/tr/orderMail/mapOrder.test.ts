import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toOrderMailOrder } from "./mapOrder";
import type { TrOrderWithItems } from "@/types/tr-marketplace";

function order(overrides: Record<string, unknown> = {}): TrOrderWithItems {
  return {
    id: "abcdef12-3456-7890-abcd-ef1234567890",
    customerName: "Ayşe Yılmaz",
    customerEmail: "ayse@example.com",
    customerPhone: " 05551112233 ",
    shippingAddress: {
      line1: "Atatürk Cd. No:1",
      line2: "",
      district: "Merkezefendi",
      city: "Denizli",
      postalCode: "20100",
      country: "TR",
    },
    discountKurus: 0,
    discountCode: null,
    discountTitle: null,
    totalKurus: 125000,
    paymentStatus: "paid",
    shipment: { feeKurus: 0 },
    items: [
      { boutiqueId: "b1", title: "Çanta", quantity: 1, priceKurus: 125000, size: null, variantLabel: null },
      { boutiqueId: "b2", title: "Başka mağaza", quantity: 1, priceKurus: 100, size: null, variantLabel: null },
      { boutiqueId: "b1", title: "Elbise", quantity: 1, priceKurus: 100, size: "M", variantLabel: null },
    ],
    ...overrides,
  } as unknown as TrOrderWithItems;
}

describe("toOrderMailOrder", () => {
  it("keeps only the store's own lines, with option labels", () => {
    const mapped = toOrderMailOrder(order(), "b1");
    assert.deepEqual(
      mapped.lines.map((line) => [line.title, line.option]),
      [
        ["Çanta", null],
        ["Elbise", "Beden: M"],
      ],
    );
  });

  it("shortens the order number and prints the address without blank lines", () => {
    const mapped = toOrderMailOrder(order(), "b1");
    assert.equal(mapped.number, "ABCDEF12");
    assert.deepEqual(mapped.addressLines, [
      "Atatürk Cd. No:1",
      "20100 Merkezefendi / Denizli",
    ]);
    assert.equal(mapped.customerPhone, "05551112233");
  });

  it("labels a code discount, prefers a campaign title, and reads paid from the payment status", () => {
    assert.equal(
      toOrderMailOrder(order({ discountKurus: 100, discountCode: "yaz10" }), "b1").discountLabel,
      "İndirim (yaz10)",
    );
    assert.equal(
      toOrderMailOrder(order({ discountKurus: 100, discountTitle: "Yaz İndirimi" }), "b1").discountLabel,
      "Yaz İndirimi",
    );
    assert.equal(toOrderMailOrder(order({ paymentStatus: "pending" }), "b1").paid, false);
  });
});
