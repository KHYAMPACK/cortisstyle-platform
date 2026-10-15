import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTrLegalDoc, type TrLegalBoutiqueContext } from "./docs";

function ctx(overrides: Partial<TrLegalBoutiqueContext> = {}): TrLegalBoutiqueContext {
  return {
    name: "Örnek Mağaza",
    legalName: "Örnek Ticaret A.Ş.",
    slug: "ornek",
    physicalAddress: "Atatürk Cd. No:1, Merkezefendi/Denizli",
    whatsappPhone: "905551112233",
    email: "info@ornek.com",
    exchangePolicy: null,
    shippingNote: null,
    customDomain: "www.ornek.com",
    vergiNo: "1234567890",
    vergiDairesi: null,
    kepAddress: null,
    mersisNo: null,
    trackingTools: [],
    marketingEnabled: true,
    ...overrides,
  };
}

function allText(doc: ReturnType<typeof getTrLegalDoc>): string {
  return doc.sections.flatMap((section) => section.paragraphs).join("\n");
}

describe("the künye page", () => {
  it("prints MERSİS, KEP and the tax office when the store has them", () => {
    const text = allText(
      getTrLegalDoc(
        "kunye",
        ctx({
          vergiDairesi: "Pamukkale",
          mersisNo: "0123456789012345",
          kepAddress: "ornek@hs01.kep.tr",
        }),
      ),
    );
    assert.match(text, /Vergi dairesi \/ vergi kimlik no: Pamukkale \/ 1234567890/);
    assert.match(text, /MERSİS: 0123456789012345/);
    assert.match(text, /KEP: ornek@hs01\.kep\.tr/);
  });

  it("drops the 'şahıs işletmesi olabilir' hedge once a MERSİS number is given", () => {
    assert.match(allText(getTrLegalDoc("kunye", ctx())), /şahıs işletmesi olabilir/);
    assert.doesNotMatch(
      allText(getTrLegalDoc("kunye", ctx({ mersisNo: "0123456789012345" }))),
      /şahıs işletmesi olabilir/,
    );
  });

  it("describes the store neutrally, not as a fashion boutique", () => {
    assert.doesNotMatch(allText(getTrLegalDoc("kunye", ctx())), /moda/i);
  });
});

describe("the tax line in the contracts", () => {
  it("includes the tax office when set", () => {
    const text = allText(getTrLegalDoc("mesafeli-satis", ctx({ vergiDairesi: "Pamukkale" })));
    assert.match(text, /Pamukkale \/ 1234567890/);
  });
});

describe("the cookie policy", () => {
  it("names the ad and analytics tools only when the store uses them", () => {
    assert.doesNotMatch(allText(getTrLegalDoc("cerez", ctx())), /Bu Site’de/);
    const text = allText(
      getTrLegalDoc("cerez", ctx({ trackingTools: ["Meta Pixel", "Google Analytics 4"] })),
    );
    assert.match(text, /Bu Site’de Meta Pixel, Google Analytics 4 kullanılmaktadır/);
    assert.match(text, /Tümünü kabul et/);
  });
});
