import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractDivById,
  extractJsonAssignment,
  parseTicimaxCategoryLinks,
  parseTicimaxProductPage,
  parseTrPriceKurus,
  titleCaseBrand,
} from "./ticimaxPage";

const model = {
  productId: 133,
  productName: "TOHUMLUKTAN &amp; TEOFARM Hatay Lezzetleri Paketi",
  productPriceKDVIncluded: 2750.0000400000004,
  brandName: "TEOFARM",
  totalStockAmount: 20,
  productVariantData: [],
  productImages: [
    { bigImagePath: "https://static.ticimax.cloud/60680/uploads/urunresimleri/buyuk/a.jpg" },
    { bigImagePath: "https://static.ticimax.cloud/60680/uploads/urunresimleri/buyuk/b.jpg" },
    { bigImagePath: "https://static.ticimax.cloud/60680/uploads/urunresimleri/buyuk/a.jpg" },
  ],
  breadCrumb: [{ tanim: "Gıda" }, { tanim: "Gıda Paketleri" }],
};

function page(overrides: Record<string, unknown> = {}, extra = ""): string {
  return `<html><head>
<meta property="og:title" content="Hatay&#39;ın Mirası Lezzet Sepeti" />
<meta property="og:description" content="Odun ateşinde nar ekşisi" />
</head><body>
<script>var other = {"a":1}; var productDetailModel = ${JSON.stringify({ ...model, ...overrides })};
var next = 1;</script>
<div class="Formline OnYaziContent" id="divOnyazi"><span><div class="inner"><p>Hatay&apos;ın <b>lezzetleri</b></p></div><p>İkinci</p></span></div>
<div id="after">sonra</div>${extra}</body></html>`;
}

describe("parseTicimaxProductPage", () => {
  it("reads name, price, maker, stock, photos, category and description", () => {
    const product = parseTicimaxProductPage(page())!;
    assert.equal(product.externalId, "133");
    assert.equal(product.name, "TOHUMLUKTAN & TEOFARM Hatay Lezzetleri Paketi");
    assert.equal(product.priceKurus, 275000);
    assert.equal(product.brand, "Teofarm");
    assert.equal(product.stock, 20);
    assert.equal(product.categoryName, "Gıda Paketleri");
    assert.equal(product.hasOptions, false);
    assert.deepEqual(product.imageUrls, [
      "https://static.ticimax.cloud/60680/uploads/urunresimleri/buyuk/a.jpg",
      "https://static.ticimax.cloud/60680/uploads/urunresimleri/buyuk/b.jpg",
    ]);
    assert.match(product.descriptionHtml!, /<p>İkinci<\/p>/);
    assert.doesNotMatch(product.descriptionHtml!, /sonra/);
    assert.equal(product.seoTitle, "Hatay'ın Mirası Lezzet Sepeti");
    assert.equal(product.seoDescription, "Odun ateşinde nar ekşisi");
  });

  it("notices options and an old price", () => {
    const html = page(
      { productVariantData: [{ id: 1 }], productPriceKDVIncluded: 400 },
      '<div class="Formline PiyasafiyatiContent"><span>Fiyat : ₺450,00</span><span>(KDV Dahil)</span></div>',
    );
    const product = parseTicimaxProductPage(html)!;
    assert.equal(product.hasOptions, true);
    assert.equal(product.priceKurus, 40000);
    assert.equal(product.compareAtPriceKurus, 45000);
  });

  it("ignores a placeholder maker", () => {
    assert.equal(parseTicimaxProductPage(page({ brandName: "Test Marka" }))!.brand, null);
    assert.equal(parseTicimaxProductPage(page({ brandName: "" }))!.brand, null);
  });

  it("returns null when it is not a product page", () => {
    assert.equal(parseTicimaxProductPage("<html><body>Merhaba</body></html>"), null);
    assert.equal(parseTicimaxProductPage('<script>var productDetailModel = {"x":1};</script>'), null);
  });
});

describe("pieces", () => {
  it("lists product links on a category page without repeats", () => {
    const html = `
      <a class="detailLink detailUrl" data-id="1" title="A" href='/urun-a'>A</a>
      <a href='/urun-a' class="detailUrl" data-id="1">img</a>
      <a class="detailLink detailUrl" data-id="2" title="B" href='/urun-b'>B</a>
      <a class="detailLink detailUrl" data-id="3" href='https://elsewhere.example/x'>X</a>`;
    assert.deepEqual(parseTicimaxCategoryLinks(html), ["/urun-a", "/urun-b"]);
  });

  it("extracts JSON by matching braces, even with braces inside strings", () => {
    const html = 'var a = 1; var m = {"t":"} {","n":{"k":[1,2]}}; var z = {"no":1};';
    assert.deepEqual(extractJsonAssignment(html, "m"), { t: "} {", n: { k: [1, 2] } });
    assert.equal(extractJsonAssignment(html, "missing"), null);
  });

  it("extracts a div by id including nested divs", () => {
    assert.equal(extractDivById('<div id="x"><div>a</div>b</div><div>c</div>', "x"), "<div>a</div>b");
    assert.equal(extractDivById("<div>no id</div>", "x"), null);
  });

  it("reads Turkish prices", () => {
    assert.equal(parseTrPriceKurus("₺2.750,00"), 275000);
    assert.equal(parseTrPriceKurus("499,90 TL"), 49990);
    assert.equal(parseTrPriceKurus("600"), 60000);
    assert.equal(parseTrPriceKurus("ücretsiz"), null);
  });

  it("title-cases upper-case maker names the Turkish way", () => {
    assert.equal(titleCaseBrand("TEOFARM"), "Teofarm");
    assert.equal(titleCaseBrand("DEFNE APOLLON İPEKÇİLİK"), "Defne Apollon İpekçilik");
    assert.equal(titleCaseBrand("Verdaa"), "Verdaa");
  });
});
