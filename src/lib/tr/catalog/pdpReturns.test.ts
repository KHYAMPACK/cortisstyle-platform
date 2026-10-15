import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPdpDeliverySummary } from "./pdpReturns";

const s = (text: string) => ({ text, strong: true });
const p = (text: string) => ({ text });

const RETURNS_SHORT =
  " içinde cayma hakkınızı kullanabilirsiniz. WhatsApp’tan sipariş numaranızla yazmanız yeterlidir. Cayma kapsamındaki iade kargo ücreti bize aittir; yeniden stoklama ücreti alınmaz.";
const RETURNS_LONG = `${RETURNS_SHORT} Ürünü kullanılmamış ve orijinal ambalajında gönderin.`;
const EXCHANGE = [
  p("Beden veya model değişimi için WhatsApp’tan yazın. Talepler "),
  s("stok durumuna göre"),
  p(" değerlendirilir."),
];

describe("getPdpDeliverySummary", () => {
  it("renders lilabutik's copy exactly as before (120 TL, free at 2+ items, carrier)", () => {
    const summary = getPdpDeliverySummary({
      slug: "lilabutik",
      name: "Lila Butik",
      shippingFeeKurus: 12_000,
      freeShippingMinItems: 2,
      freeShippingMinSubtotalKurus: null,
    });
    assert.equal(summary.legalHref, "/tr/lilabutik/yasal/iade");
    assert.deepEqual(summary.paragraphs, [
      [
        p("Lila Butik üzerinden verilen siparişlerde kargo ücreti "),
        s("120 TL"),
        p("’dir. "),
        s("2 ürün"),
        p(" ve üzeri alışverişlerde kargo ücretsizdir."),
      ],
      [
        p("Siparişler ödeme onayından sonra "),
        s("1–5 iş günü"),
        p(
          " içerisinde kargo firmasına teslim edilir. Türkiye geneline gönderim yapılır.",
        ),
      ],
      [p("Teslimden itibaren "), s("14 gün"), p(RETURNS_LONG)],
      EXCHANGE,
    ]);
  });

  it("renders the no-shipping-fee copy exactly as the old manual-shipping branch", () => {
    const summary = getPdpDeliverySummary({
      slug: "deneme-butik",
      name: "Deneme Butik",
      shippingFeeKurus: 0,
      freeShippingMinItems: null,
      freeShippingMinSubtotalKurus: null,
    });
    assert.deepEqual(summary.paragraphs, [
      [
        p(
          "Sipariş sonrası kargo bilgisi paylaşılır. Türkiye geneline gönderim yapılır.",
        ),
      ],
      [p("Teslimden itibaren "), s("14 gün"), p(RETURNS_SHORT)],
      EXCHANGE,
    ]);
  });

  it("states a configured fee for a boutique without a carrier integration", () => {
    const summary = getPdpDeliverySummary({
      slug: "deneme-butik",
      name: "Deneme Butik",
      shippingFeeKurus: 8_990,
      freeShippingMinItems: null,
      freeShippingMinSubtotalKurus: 50_000,
    });
    assert.deepEqual(summary.paragraphs[0], [
      p("Deneme Butik üzerinden verilen siparişlerde kargo ücreti "),
      s("89,90 TL"),
      p("’dir. "),
      s("500 TL"),
      p(" ve üzeri alışverişlerde kargo ücretsizdir."),
    ]);
    // No carrier: generic dispatch wording, not Lila's "1–5 iş günü" promise.
    assert.deepEqual(summary.paragraphs[1], [
      p(
        "Sipariş sonrası kargo bilgisi paylaşılır. Türkiye geneline gönderim yapılır.",
      ),
    ]);
  });

  it("doesn't send a store without a WhatsApp number to WhatsApp", () => {
    const summary = getPdpDeliverySummary({
      slug: "ornek",
      name: "Örnek",
      shippingFeeKurus: 0,
      freeShippingMinItems: null,
      freeShippingMinSubtotalKurus: null,
      whatsappPhone: null,
    });
    const text = JSON.stringify(summary.paragraphs);
    assert.doesNotMatch(text, /WhatsApp/);
    assert.match(text, /e-posta ile yazmanız yeterlidir/);
    assert.match(text, /Değişim için bize yazın/);
    // A store that does have one keeps the exact wording above.
    const withWhatsapp = JSON.stringify(
      getPdpDeliverySummary({
        slug: "ornek",
        name: "Örnek",
        shippingFeeKurus: 0,
        freeShippingMinItems: null,
        freeShippingMinSubtotalKurus: null,
        whatsappPhone: "905551112233",
      }).paragraphs,
    );
    assert.match(withWhatsapp, /WhatsApp/);
  });

  it("handles a missing boutique", () => {
    const summary = getPdpDeliverySummary(null);
    assert.equal(summary.legalHref, null);
    assert.equal(summary.paragraphs.length, 3);
  });
});
