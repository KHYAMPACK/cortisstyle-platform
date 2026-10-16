import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readReturnShippingPayer } from "./storePolicies";

describe("readReturnShippingPayer", () => {
  it("defaults to the seller", () => {
    assert.equal(readReturnShippingPayer(null), "seller");
    assert.equal(readReturnShippingPayer({}), "seller");
    assert.equal(readReturnShippingPayer({ policies: "buyer" }), "seller");
    assert.equal(readReturnShippingPayer({ policies: { returnShippingPaidBy: "other" } }), "seller");
  });

  it("is the buyer only when the store says so", () => {
    assert.equal(readReturnShippingPayer({ policies: { returnShippingPaidBy: "buyer" } }), "buyer");
  });
});
