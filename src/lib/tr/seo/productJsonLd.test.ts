import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProductJsonLd, jsonLdScript } from "./productJsonLd";

const base = {
  product: {
    title: "Hatay Lezzetleri Paketi",
    description: "Sepet içeriği: zeytinyağı, salça.",
    priceKurus: 275_000,
    status: "available" as const,
    stock: 4,
    images: ["https://cdn.example/a.jpg", "/tr/img/b.jpg", "data:image/png;base64,xx", ""],
    brand: "Teofarm",
    sku: "HLP-1",
  },
  url: "https://tohumluktan.com.tr/urun/hatay-lezzetleri-paketi",
  origin: "https://tohumluktan.com.tr",
  sellerName: "Tohumluktan",
};

describe("buildProductJsonLd", () => {
  it("describes a product with price, availability, maker and absolute pictures", () => {
    const data = buildProductJsonLd(base) as Record<string, unknown>;
    assert.equal(data["@type"], "Product");
    assert.deepEqual(data.image, [
      "https://cdn.example/a.jpg",
      "https://tohumluktan.com.tr/tr/img/b.jpg",
    ]);
    assert.deepEqual(data.brand, { "@type": "Brand", name: "Teofarm" });
    const offers = data.offers as Record<string, unknown>;
    assert.equal(offers.price, "2750.00");
    assert.equal(offers.priceCurrency, "TRY");
    assert.equal(offers.availability, "https://schema.org/InStock");
  });

  it("marks sold or empty products out of stock", () => {
    const sold = buildProductJsonLd({ ...base, product: { ...base.product, status: "sold" } }) as {
      offers: { availability: string };
    };
    assert.equal(sold.offers.availability, "https://schema.org/OutOfStock");
    const empty = buildProductJsonLd({ ...base, product: { ...base.product, stock: 0 } }) as {
      offers: { availability: string };
    };
    assert.equal(empty.offers.availability, "https://schema.org/OutOfStock");
  });

  it("uses a price range for a product sold by variant", () => {
    const data = buildProductJsonLd({
      ...base,
      variantPrices: { min: 20_000, max: 45_050, count: 3 },
    }) as { offers: Record<string, unknown> };
    assert.equal(data.offers["@type"], "AggregateOffer");
    assert.equal(data.offers.lowPrice, "200.00");
    assert.equal(data.offers.highPrice, "450.50");
    assert.equal(data.offers.offerCount, 3);
  });

  it("leaves out what the product doesn't have", () => {
    const data = buildProductJsonLd({
      ...base,
      product: { ...base.product, brand: null, sku: null, description: null, images: [] },
    });
    for (const key of ["brand", "sku", "description", "image"]) {
      assert.equal(key in data, false, key);
    }
  });
});

describe("jsonLdScript", () => {
  it("cannot close the script tag from inside the data", () => {
    const text = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    assert.equal(text.includes("</script>"), false);
    assert.equal(JSON.parse(text).name, "</script><script>alert(1)</script>");
  });
});
