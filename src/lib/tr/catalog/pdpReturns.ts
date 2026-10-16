import { readReturnShippingPayer } from "@/lib/tr/catalog/storePolicies";
import { boutiqueHasCarrierIntegration } from "@/lib/tr/shipping/registry";
import { trBoutiqueLegalPath } from "@/lib/tr/paths";
import { shippingFeeConfigOf } from "@/lib/tr/shipping/quoteShipping";
import { tlLabel } from "@/lib/tr/shipping/shippingCopy";
import type { TrBoutiquePublic } from "@/types/tr-marketplace";

export type TrPdpPolicyRun = {
  text: string;
  strong?: boolean;
};

export type TrPdpDeliverySummary = {
  paragraphs: TrPdpPolicyRun[][];
  legalHref: string | null;
};

function strong(text: string): TrPdpPolicyRun {
  return { text, strong: true };
}

function paragraph(
  ...runs: Array<string | TrPdpPolicyRun>
): TrPdpPolicyRun[] {
  return runs.map((run) => (typeof run === "string" ? { text: run } : run));
}

/**
 * PDP “Teslimat ve İade” copy. The fee sentence comes from the boutique's own
 * shipping settings; the dispatch/returns wording differs only for boutiques with
 * a carrier integration (Lila). No carrier names.
 */
export function getPdpDeliverySummary(
  boutique?: Pick<
    TrBoutiquePublic,
    | "slug"
    | "name"
    | "shippingFeeKurus"
    | "freeShippingMinItems"
    | "freeShippingMinSubtotalKurus"
  > &
    // A store known to have no WhatsApp number must not be told to "write on WhatsApp".
    Partial<Pick<TrBoutiquePublic, "whatsappPhone" | "editorialContent">> | null,
): TrPdpDeliverySummary {
  const boutiqueSlug = boutique?.slug ?? null;
  const phone = boutique?.whatsappPhone;
  const noWhatsapp = phone !== undefined && !(phone ?? "").trim();
  const returnCost =
    readReturnShippingPayer(boutique?.editorialContent) === "buyer"
      ? "Cayma kapsamındaki iade kargo ücreti size aittir"
      : "Cayma kapsamındaki iade kargo ücreti bize aittir";
  const writeUs = noWhatsapp
    ? "Sipariş numaranızla bize e-posta ile yazmanız yeterlidir."
    : "WhatsApp’tan sipariş numaranızla yazmanız yeterlidir.";
  const legalHref = boutiqueSlug
    ? trBoutiqueLegalPath(boutiqueSlug, "iade")
    : null;
  const brand = boutique?.name?.trim() || "Mağazamız";
  const config = shippingFeeConfigOf(boutique ?? {});
  const carrier = boutiqueSlug
    ? boutiqueHasCarrierIntegration(boutiqueSlug)
    : false;

  const paragraphs: TrPdpPolicyRun[][] = [];

  if (config.feeKurus > 0) {
    const fee = strong(tlLabel(config.feeKurus));
    if (config.freeMinItems !== null) {
      paragraphs.push(
        paragraph(
          `${brand} üzerinden verilen siparişlerde kargo ücreti `,
          fee,
          "’dir. ",
          strong(`${config.freeMinItems} ürün`),
          " ve üzeri alışverişlerde kargo ücretsizdir.",
        ),
      );
    } else if (config.freeMinSubtotalKurus !== null) {
      paragraphs.push(
        paragraph(
          `${brand} üzerinden verilen siparişlerde kargo ücreti `,
          fee,
          "’dir. ",
          strong(tlLabel(config.freeMinSubtotalKurus)),
          " ve üzeri alışverişlerde kargo ücretsizdir.",
        ),
      );
    } else {
      paragraphs.push(
        paragraph(
          `${brand} üzerinden verilen siparişlerde kargo ücreti `,
          fee,
          "’dir.",
        ),
      );
    }
  }

  paragraphs.push(
    carrier
      ? paragraph(
          "Siparişler ödeme onayından sonra ",
          strong("1–5 iş günü"),
          " içerisinde kargo firmasına teslim edilir. Türkiye geneline gönderim yapılır.",
        )
      : paragraph(
          "Sipariş sonrası kargo bilgisi paylaşılır. Türkiye geneline gönderim yapılır.",
        ),
    paragraph(
      "Teslimden itibaren ",
      strong("14 gün"),
      carrier
        ? ` içinde cayma hakkınızı kullanabilirsiniz. ${writeUs} ${returnCost}; yeniden stoklama ücreti alınmaz. Ürünü kullanılmamış ve orijinal ambalajında gönderin.`
        : ` içinde cayma hakkınızı kullanabilirsiniz. ${writeUs} ${returnCost}; yeniden stoklama ücreti alınmaz.`,
    ),
    paragraph(
      noWhatsapp
        ? "Değişim için bize yazın. Talepler "
        : "Beden veya model değişimi için WhatsApp’tan yazın. Talepler ",
      strong("stok durumuna göre"),
      " değerlendirilir.",
    ),
  );

  return { legalHref, paragraphs };
}
