import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readSeoOverride,
  resolveBoutiqueDocumentDescription,
  resolveBoutiqueDocumentTitle,
} from "./boutiqueBrand";

describe("a store's own page title and description", () => {
  it("reads them from editorial_content.seo, cleaned and limited", () => {
    const seo = readSeoOverride({
      seo: { title: "  Tohumluktan |  Doğal ürünler ", description: "x".repeat(300) },
    });
    assert.equal(seo.title, "Tohumluktan | Doğal ürünler");
    assert.equal(seo.description?.length, 170);
  });

  it("ignores anything that is not text", () => {
    assert.deepEqual(readSeoOverride({ seo: { title: 5, description: [] } }), {
      title: null,
      description: null,
    });
    assert.deepEqual(readSeoOverride({ seo: "no" }), { title: null, description: null });
    assert.deepEqual(readSeoOverride(null), { title: null, description: null });
  });

  it("wins over the defaults, and changes nothing when absent", () => {
    assert.equal(
      resolveBoutiqueDocumentTitle("ornek", "Örnek", { seo: { title: "Özel başlık" } }),
      "Özel başlık",
    );
    assert.equal(resolveBoutiqueDocumentTitle("ornek", "Örnek"), "Örnek");
    assert.equal(
      resolveBoutiqueDocumentDescription("ornek", "Mağaza açıklaması", "Örnek", {
        seo: { description: "Kendi açıklaması" },
      }),
      "Kendi açıklaması",
    );
    assert.equal(
      resolveBoutiqueDocumentDescription("ornek", "Mağaza açıklaması", "Örnek"),
      "Mağaza açıklaması",
    );
  });
});
