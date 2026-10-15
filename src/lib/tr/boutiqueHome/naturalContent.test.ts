import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customTaxonomy, type TrTaxonomyNode } from "@/lib/tr/categories/taxonomy";
import type { TrProduct } from "@/types/tr-marketplace";
import {
  buildNaturalHome,
  listProducers,
  readNaturalOverrides,
  safeHref,
} from "./naturalContent";

const NODES: TrTaxonomyNode[] = [
  { id: "gida", label: "Gıda", parentId: null, shopAllLabel: "Tüm gıda", imageUrl: null },
  { id: "gida-paketleri", label: "Gıda paketleri", parentId: "gida", shopAllLabel: "Tüm paketler", imageUrl: null },
  { id: "taki", label: "Takı", parentId: null, shopAllLabel: "Tüm takılar", imageUrl: "/tr/img/taki.jpg" },
  { id: "kozmetik", label: "Kozmetik", parentId: null, shopAllLabel: "Tüm kozmetik", imageUrl: null },
];
const taxonomy = customTaxonomy(NODES);

function product(
  id: string,
  category: string | null,
  extra: Partial<TrProduct> = {},
): TrProduct {
  return {
    id,
    boutiqueId: "b1",
    title: `Ürün ${id}`,
    description: null,
    priceKurus: 10_000,
    compareAtPriceKurus: null,
    images: [`/img/${id}.jpg`],
    category,
    status: "available",
    sortOrder: Number(id.replace(/\D/g, "")) || 0,
    createdAt: `2026-10-${String(10 + (Number(id.replace(/\D/g, "")) || 0)).padStart(2, "0")}T00:00:00Z`,
    updatedAt: "2026-10-15T00:00:00Z",
    ...extra,
  } as TrProduct;
}

const boutique = {
  name: "Tohumluktan",
  description:
    "Hatay'ın bereketli topraklarından doğal ürünler. Bir vakıf kuruluşudur.",
  editorialContent: null,
  shippingFeeKurus: 0,
  freeShippingMinItems: null,
  freeShippingMinSubtotalKurus: null,
};
const coverOf = (p: TrProduct) => p.images[0] ?? null;

describe("readNaturalOverrides", () => {
  it("returns empty overrides for anything that is not the expected shape", () => {
    assert.equal(readNaturalOverrides(null).heroTitle, null);
    assert.equal(readNaturalOverrides({ natural: "x" }).story, null);
    assert.deepEqual(readNaturalOverrides({ natural: { usps: "no" } }).usps, []);
  });

  it("cleans, limits and keeps only safe links", () => {
    const o = readNaturalOverrides({
      natural: {
        announcement: "  Hoş   geldiniz  ",
        hero: { title: "Başlık", image: "javascript:alert(1)" },
        usps: ["a", "", "b", "c", "d", "e"],
        story: { title: "T", body: "B", ctaLabel: "Git", ctaHref: "//evil.example" },
      },
    });
    assert.equal(o.announcement, "Hoş geldiniz");
    assert.equal(o.heroImage, null);
    assert.deepEqual(o.usps, ["a", "b", "c", "d"]);
    assert.equal(o.story?.ctaHref, null);
  });

  it("drops a story without a title or a body", () => {
    assert.equal(readNaturalOverrides({ natural: { story: { title: "T" } } }).story, null);
  });
});

describe("safeHref", () => {
  it("allows same-site paths and https only", () => {
    assert.equal(safeHref("/tr/x/yasal/kunye"), "/tr/x/yasal/kunye");
    assert.equal(safeHref("https://a.example/b"), "https://a.example/b");
    assert.equal(safeHref("http://a.example"), null);
    assert.equal(safeHref("//a.example"), null);
    assert.equal(safeHref("data:text/html,x"), null);
  });
});

describe("listProducers", () => {
  it("counts distinct makers, most products first", () => {
    const list = listProducers([
      { brand: "Teofarm" },
      { brand: " Verdaa " },
      { brand: "Teofarm" },
      { brand: null },
      {},
    ]);
    assert.deepEqual(list, [
      { name: "Teofarm", count: 2 },
      { name: "Verdaa", count: 1 },
    ]);
  });
});

describe("buildNaturalHome", () => {
  it("renders a complete page for a store with no products", () => {
    const home = buildNaturalHome({ boutique, products: [], taxonomy, coverOf });
    assert.equal(home.empty, true);
    assert.equal(home.hero.title, "Hatay'ın bereketli topraklarından doğal ürünler");
    assert.equal(home.hero.body, "Bir vakıf kuruluşudur.");
    assert.deepEqual(home.hero.images, []);
    // No product anywhere: every top-level category still shows as a tile.
    assert.deepEqual(
      home.categoryTiles.map((t) => t.id),
      ["gida", "taki", "kozmetik"],
    );
    assert.deepEqual(home.rails, []);
    assert.deepEqual(home.producers.list, []);
    assert.deepEqual(home.usps, ["14 gün içinde cayma hakkı", "Güvenli ödeme"]);
  });

  it("shows only categories that have products, with their own picture first", () => {
    const home = buildNaturalHome({
      boutique,
      products: [product("1", "gida-paketleri"), product("2", "taki")],
      taxonomy,
      coverOf,
    });
    assert.deepEqual(
      home.categoryTiles.map((t) => [t.id, t.count, t.image]),
      [
        ["gida", 1, "/img/1.jpg"],
        ["taki", 1, "/tr/img/taki.jpg"],
      ],
    );
    assert.deepEqual(home.hero.images, ["/img/1.jpg", "/img/2.jpg"]);
  });

  it("uses one rail for a small catalog and per-category rails for a big one", () => {
    const small = buildNaturalHome({
      boutique,
      products: [product("1", "gida-paketleri"), product("2", "taki")],
      taxonomy,
      coverOf,
    });
    assert.deepEqual(small.rails.map((r) => r.id), ["all"]);

    const many = Array.from({ length: 12 }, (_, i) =>
      product(String(i + 1), i < 7 ? "gida-paketleri" : "taki"),
    );
    const big = buildNaturalHome({ boutique, products: many, taxonomy, coverOf });
    assert.deepEqual(big.rails.map((r) => r.id), ["new", "gida", "taki"]);
    assert.equal(big.rails[0]!.products[0]!.id, "12");
    assert.equal(big.rails[1]!.products.length, 4);
  });

  it("ignores sold products and lists makers only when there are at least two", () => {
    const home = buildNaturalHome({
      boutique,
      products: [
        product("1", "taki", { brand: "Teofarm" }),
        product("2", "taki", { brand: "Teofarm", status: "sold" }),
      ],
      taxonomy,
      coverOf,
    });
    assert.deepEqual(home.producers.list, []);

    const two = buildNaturalHome({
      boutique,
      products: [
        product("1", "taki", { brand: "Teofarm" }),
        product("2", "taki", { brand: "Verdaa" }),
      ],
      taxonomy,
      coverOf,
    });
    assert.deepEqual(two.producers.list.map((p) => p.name), ["Teofarm", "Verdaa"]);
  });

  it("lets the store's own copy replace the defaults", () => {
    const home = buildNaturalHome({
      boutique: {
        ...boutique,
        editorialContent: {
          natural: {
            hero: { title: "Kendi başlığımız", primaryLabel: "Keşfet" },
            usps: ["Bir", "İki"],
            story: { title: "Hikâye", body: "Metin" },
          },
        },
      },
      products: [],
      taxonomy,
      coverOf,
    });
    assert.equal(home.hero.title, "Kendi başlığımız");
    assert.equal(home.hero.body, null);
    assert.equal(home.hero.primaryLabel, "Keşfet");
    assert.deepEqual(home.usps, ["Bir", "İki"]);
    assert.equal(home.story?.title, "Hikâye");
  });

  it("states the shipping rule when the store charges shipping", () => {
    const home = buildNaturalHome({
      boutique: { ...boutique, shippingFeeKurus: 8_990, freeShippingMinSubtotalKurus: 200_000 },
      products: [],
      taxonomy,
      coverOf,
    });
    assert.equal(home.usps[0], "2000 TL ve üzeri kargo ücretsiz. Altındaki siparişlerde 89,90 TL");
  });
});
