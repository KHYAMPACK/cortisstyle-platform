import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cartLineToTrackedItem, orderItemToTrackedItem } from "./items";

describe("cartLineToTrackedItem", () => {
  it("is one unit, priced in TRY, with the variant label or the size", () => {
    assert.deepEqual(
      cartLineToTrackedItem({ productId: "p1", title: "Elbise", priceKurus: 129900, size: "M" }),
      { id: "p1", name: "Elbise", priceTry: 1299, quantity: 1, variant: "M" },
    );
    assert.equal(
      cartLineToTrackedItem({
        productId: "p1",
        title: "Elbise",
        priceKurus: 100,
        size: null,
        variantLabel: "Kırmızı / S",
      }).variant,
      "Kırmızı / S",
    );
  });

  it("has no variant when there is neither", () => {
    assert.equal(
      cartLineToTrackedItem({ productId: "p1", title: "X", priceKurus: 100 }).variant,
      null,
    );
  });
});

describe("orderItemToTrackedItem", () => {
  it("keeps the quantity, and falls back to the line id for a deleted product", () => {
    const item = orderItemToTrackedItem({
      id: "line-9",
      productId: null,
      title: "Eski ürün",
      priceKurus: 5050,
      quantity: 2,
    });
    assert.equal(item.id, "line-9");
    assert.equal(item.quantity, 2);
    assert.equal(item.priceTry, 50.5);
  });
});
