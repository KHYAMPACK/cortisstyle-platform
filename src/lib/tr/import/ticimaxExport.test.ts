import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanBrand,
  exportRowPrices,
  mergeDescriptions,
  parseCategoryPaths,
  readExportProducts,
} from "./ticimaxExport";

const HEADER = [
  "URUNKARTIID", "URUNID", "STOKKODU", "VARYASYONKODU", "BARKOD", "URUNADI", "ONYAZI", "ACIKLAMA",
  "KATEGORILER", "BREADCRUMBKAT", "SEO_SAYFABASLIK", "SEO_SAYFAACIKLAMA", "ANAHTARKELIME", "MARKA",
  "VITRIN", "YENIURUN", "UCRETSIZKARGO", "STOKADEDI", "PIYASAFIYATI", "SATISFIYATI", "INDIRIMLIFIYAT",
  "KDVORANI", "KARGOAGIRLIGI", "KARTAKTIF", "URUNAKTIF", "VARYASYON",
];

function row(values: Record<string, string>): string[] {
  return HEADER.map((name) => values[name] ?? "");
}

const base = {
  URUNKARTIID: "10", URUNID: "100", STOKKODU: "SKU-10", URUNADI: "Zeytin", MARKA: "TEOFARM",
  KATEGORILER: "Gıda;Gıda>Gıda Paketleri;Vitrin;", BREADCRUMBKAT: "Gıda>Gıda Paketleri",
  STOKADEDI: "9", SATISFIYATI: "600", INDIRIMLIFIYAT: "0", PIYASAFIYATI: "0", KDVORANI: "1",
  KARTAKTIF: "1", URUNAKTIF: "1", KARGOAGIRLIGI: "2", ANAHTARKELIME: "zeytin, halhalı, zeytin, a",
  YENIURUN: "1", VITRIN: "0", UCRETSIZKARGO: "0", ONYAZI: "<p>Kısa</p>", ACIKLAMA: "<p>Uzun metin</p>",
  SEO_SAYFABASLIK: "Zeytin | Teofarm",
};

describe("prices", () => {
  it("uses the sale price with the list price struck through", () => {
    assert.deepEqual(exportRowPrices({ SATISFIYATI: "450", INDIRIMLIFIYAT: "400", PIYASAFIYATI: "0" }), {
      priceKurus: 40000,
      compareAtPriceKurus: 45000,
    });
  });

  it("uses the market price as the old price when it is higher", () => {
    assert.deepEqual(exportRowPrices({ SATISFIYATI: "1500", INDIRIMLIFIYAT: "0", PIYASAFIYATI: "1800" }), {
      priceKurus: 150000,
      compareAtPriceKurus: 180000,
    });
    assert.equal(exportRowPrices({ SATISFIYATI: "600", INDIRIMLIFIYAT: "0", PIYASAFIYATI: "600" }).compareAtPriceKurus, null);
  });

  it("rounds odd decimals and ignores a discount that is not lower", () => {
    assert.equal(exportRowPrices({ SATISFIYATI: "2499.9999", INDIRIMLIFIYAT: "0", PIYASAFIYATI: "0" }).priceKurus, 250000);
    assert.deepEqual(exportRowPrices({ SATISFIYATI: "500", INDIRIMLIFIYAT: "500", PIYASAFIYATI: "0" }), {
      priceKurus: 50000,
      compareAtPriceKurus: null,
    });
  });
});

describe("descriptions", () => {
  it("joins the short line and the long text, without repeating", () => {
    assert.equal(mergeDescriptions("<p>Kısa</p>", "<p>Uzun</p>"), "<p>Kısa</p><p>Uzun</p>");
    assert.equal(mergeDescriptions("<p>Aynı</p>", "<div>Aynı metin burada</div>"), "<div>Aynı metin burada</div>");
    assert.equal(mergeDescriptions("", "<p>Sadece uzun</p>"), "<p>Sadece uzun</p>");
    assert.equal(mergeDescriptions(" ", "<p> </p>"), null);
  });
});

describe("categories", () => {
  it("keeps the most specific paths, the main path first, and drops non-categories", () => {
    assert.deepEqual(
      parseCategoryPaths(
        "Hediye Seçenekleri;Takı - Aksesuar;Takı - Aksesuar>Bileklik;Hediye Seçenekleri>Motif Serisi;Vitrin;Test Kategori;",
        "Takı - Aksesuar>Bileklik",
      ),
      [["Takı - Aksesuar", "Bileklik"], ["Hediye Seçenekleri", "Motif Serisi"]],
    );
  });

  it("keeps a top-level category when nothing deeper covers it", () => {
    assert.deepEqual(parseCategoryPaths("Kozmetik;", ""), [["Kozmetik"]]);
    assert.deepEqual(parseCategoryPaths("", ""), []);
  });
});

describe("readExportProducts", () => {
  it("reads a simple product", () => {
    const [product] = readExportProducts([HEADER, row(base)]);
    assert.ok(product);
    assert.equal(product.cardId, "10");
    assert.equal(product.optionType, null);
    assert.equal(product.variants.length, 1);
    assert.equal(product.variants[0]!.value, null);
    assert.equal(product.variants[0]!.stock, 9);
    assert.deepEqual(product.categoryPaths, [["Gıda", "Gıda Paketleri"]]);
    assert.deepEqual(product.keywords, ["zeytin", "halhalı"]);
    assert.equal(product.isNew, true);
    assert.equal(product.desi, 2);
    assert.equal(product.kdvRate, 1);
    assert.equal(product.published, true);
    assert.equal(product.isTest, false);
    assert.equal(product.descriptionHtml, "<p>Kısa</p><p>Uzun metin</p>");
  });

  it("groups option rows into one product", () => {
    const products = readExportProducts([
      HEADER,
      row({ ...base, URUNKARTIID: "20", URUNID: "1", VARYASYON: "Renk;Mavi", STOKADEDI: "2" }),
      row({ ...base, URUNKARTIID: "20", URUNID: "2", VARYASYON: "Renk;Mor", STOKADEDI: "0", SATISFIYATI: "700", URUNAKTIF: "0" }),
    ]);
    assert.equal(products.length, 1);
    assert.equal(products[0]!.optionType, "Renk");
    assert.deepEqual(products[0]!.variants.map((v) => [v.value, v.stock, v.priceKurus, v.active]), [
      ["Mavi", 2, 60000, true],
      ["Mor", 0, 70000, false],
    ]);
  });

  it("flags test products and hidden ones, and reports multi-option rows", () => {
    const products = readExportProducts([
      HEADER,
      row({ ...base, URUNKARTIID: "1", URUNADI: "Test Ürünü" }),
      row({ ...base, URUNKARTIID: "4", MARKA: "Test Marka" }),
      row({ ...base, URUNKARTIID: "2", KARTAKTIF: "0" }),
      row({ ...base, URUNKARTIID: "3", VARYASYON: "Renk;Mavi;Beden;S" }),
      row({ ...base, URUNKARTIID: "3", URUNID: "5", VARYASYON: "Renk;Mor;Beden;S" }),
    ]);
    assert.equal(products[0]!.isTest, true);
    // A placeholder maker alone does not make a product a test.
    assert.equal(products[1]!.isTest, false);
    assert.equal(products[2]!.published, false);
    assert.equal(products[3]!.warnings.length > 0, true);
  });

  it("treats several rows with no option names as one item, like the shop does", () => {
    const [product] = readExportProducts([
      HEADER,
      row({ ...base, URUNKARTIID: "6", URUNID: "6", STOKADEDI: "1", SATISFIYATI: "5500" }),
      row({ ...base, URUNKARTIID: "6", URUNID: "59", STOKADEDI: "3", SATISFIYATI: "2200" }),
    ]);
    assert.equal(product!.optionType, null);
    assert.equal(product!.variants.length, 1);
    assert.deepEqual(
      [product!.variants[0]!.value, product!.variants[0]!.priceKurus, product!.variants[0]!.stock],
      [null, 550000, 4],
    );
    assert.equal(product!.warnings.length, 1);
  });

  it("refuses a file that is not a Ticimax export", () => {
    assert.throws(() => readExportProducts([["a", "b"], ["1", "2"]]), /URUNKARTIID/);
  });
});

describe("cleanBrand", () => {
  it("cases upper-case makers, drops placeholders and applies the client's fixes", () => {
    assert.equal(cleanBrand("TEOFARM"), "Teofarm");
    assert.equal(cleanBrand("Tohumluk Vakfı"), "Tohumluk Vakfı");
    assert.equal(cleanBrand("Test Marka"), null);
    assert.equal(cleanBrand("  "), null);
    assert.equal(cleanBrand("Marbling Desing", { "marbling desing": "Marbling Design" }), "Marbling Design");
  });
});
