import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEditorialContent, type EditorialTaxonomy } from "./editorialContent";
import { EMPTY_TRACKING } from "@/lib/tr/tracking/config";
import type { TrBoutiquePublic } from "@/types/tr-marketplace";

function boutique(overrides: Partial<TrBoutiquePublic> = {}): TrBoutiquePublic {
  return {
    id: "b1",
    slug: "ornek",
    name: "Örnek Mağaza",
    legalName: null,
    description: null,
    logoUrl: null,
    whatsappPhone: null,
    instagramHandle: null,
    themeAccent: "#0F766E",
    shippingNote: null,
    exchangePolicy: null,
    physicalAddress: null,
    customDomain: null,
    vergiNo: null,
    vergiDairesi: null,
    mersisNo: null,
    kepAddress: null,
    tracking: EMPTY_TRACKING,
    editorialContent: null,
    catalogProfile: "fashion",
    contactEmail: null,
    shippingFeeKurus: 0,
    freeShippingMinItems: null,
    freeShippingMinSubtotalKurus: null,
    status: "verified",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function taxonomy(
  roots: Array<{ id: string; label: string }>,
  images: Record<string, string> = {},
): EditorialTaxonomy {
  return {
    roots: () => roots,
    imageUrl: (id: string) => images[id] ?? null,
  } as unknown as EditorialTaxonomy;
}

const THREE = [
  { id: "mutfak", label: "Mutfak" },
  { id: "banyo", label: "Banyo" },
  { id: "salon", label: "Salon" },
];

describe("a classic-skin store with no homepage of its own", () => {
  it("builds the nav from its own categories", () => {
    const content = getEditorialContent(boutique(), taxonomy(THREE));
    assert.deepEqual(
      content.nav.map((item) => item.label),
      ["Yeni", "Mutfak", "Banyo", "Salon", "İndirim"],
    );
  });

  it("builds the category panels from its categories, with only their own pictures", () => {
    const content = getEditorialContent(
      boutique(),
      taxonomy(THREE, { mutfak: "https://cdn.example/mutfak.jpg" }),
    );
    assert.deepEqual(
      content.featuredPair.map((panel) => [panel.label, panel.image]),
      [
        ["Mutfak", "https://cdn.example/mutfak.jpg"],
        ["Banyo", ""],
      ],
    );
    assert.deepEqual(content.categoryTiles.map((tile) => tile.label), ["Salon"]);
  });

  it("shows no fashion demo content and no stock photos", () => {
    const text = JSON.stringify(getEditorialContent(boutique(), taxonomy(THREE)));
    assert.doesNotMatch(text, /demo-maya/);
    assert.doesNotMatch(text, /Elbise|Üst giyim|Alt giyim|Dış giyim/);
  });

  it("opens with one welcome slide on the accent colour, linking to every category", () => {
    const content = getEditorialContent(
      boutique({ description: "Ev ve yaşam ürünleri" }),
      taxonomy(THREE),
    );
    assert.equal(content.heroPromotions?.length, 1);
    const hero = content.heroPromotions![0]!;
    assert.equal(hero.template, "campaign");
    assert.equal(hero.image, undefined);
    assert.equal(hero.subText, "Ev ve yaşam ürünleri");
    assert.deepEqual(
      hero.actions?.map((action) => action.label),
      ["Tüm ürünler", "Mutfak", "Banyo", "Salon"],
    );
  });

  it("states the shipping rule in the promo bar when the store has one", () => {
    const withShipping = getEditorialContent(
      boutique({ shippingFeeKurus: 12000, freeShippingMinItems: 2 }),
      taxonomy(THREE),
    );
    assert.match(withShipping.promoBar.text, /120/);
    const without = getEditorialContent(boutique(), taxonomy(THREE));
    assert.equal(without.promoBar.text, "Örnek Mağaza mağazasına hoş geldiniz");
  });

  it("has no Instagram strip without a handle, and uses the handle when there is one", () => {
    assert.equal(getEditorialContent(boutique(), taxonomy(THREE)).instagram.handle, "");
    assert.equal(
      getEditorialContent(boutique({ instagramHandle: "@ornekmagaza" }), taxonomy(THREE))
        .instagram.handle,
      "ornekmagaza",
    );
  });

  it("copes with a store that has no categories yet", () => {
    const content = getEditorialContent(boutique(), taxonomy([]));
    assert.deepEqual(content.nav.map((item) => item.label), ["Yeni", "İndirim"]);
    assert.deepEqual(content.featuredPair, []);
    assert.deepEqual(
      content.heroPromotions![0]!.actions?.map((action) => action.label),
      ["Tüm ürünler"],
    );
  });

  it("lets the store's own editorial content win", () => {
    const content = getEditorialContent(
      boutique({
        editorialContent: {
          nav: [{ id: "x", label: "Özel", categoryId: null }],
          promoBar: { text: "Yaz fırsatları", cta: "Gör" },
        },
      }),
      taxonomy(THREE),
    );
    assert.deepEqual(content.nav.map((item) => item.label), ["Özel"]);
    assert.equal(content.promoBar.text, "Yaz fırsatları");
  });
});

describe("the atelier skin (lilabutik) is left exactly as it was", () => {
  it("still uses its own hero photos and category pictures path", () => {
    const content = getEditorialContent(
      boutique({ slug: "lilabutik", name: "Lila Butik" }),
      taxonomy(THREE),
    );
    assert.match(JSON.stringify(content.heroPromotions), /\/tr\/boutiques\/lilabutik\/hero\/kesfet\.jpg/);
    assert.match(
      JSON.stringify(content.featuredPair),
      /\/tr\/boutiques\/lilabutik\/categories\/mutfak\.jpg/,
    );
    assert.deepEqual(
      content.nav.map((item) => item.label),
      ["Yeni", "Mutfak", "Banyo", "Salon", "İndirim"],
    );
  });
});
