import {
  escapeHtml,
  shell,
  type BoutiqueAuthMailBrand,
} from "@/lib/tr/authMail/templates";
import { formatTryFromKurus } from "@/types/tr-marketplace";

/**
 * The e-mails a store sends about an order: the shopper's confirmation and the
 * owner's "new order" alert. Pure — `sendOrderEmails.ts` loads the order and sends.
 * They reuse the auth e-mails' frame (`shell`), so a store's mail looks like one brand.
 */

export interface OrderMailLine {
  title: string;
  /** "Beden: M" / "Varyant: Kırmızı / S", or null. */
  option: string | null;
  quantity: number;
  priceKurus: number;
}

export interface OrderMailOrder {
  /** The short number shoppers and owners see, e.g. "A1B2C3D4". */
  number: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  lines: OrderMailLine[];
  discountKurus: number;
  discountLabel: string | null;
  /** null = not known; 0 = free shipping. */
  shippingKurus: number | null;
  totalKurus: number;
  /** Shipping address as printed lines. */
  addressLines: string[];
  /** The card payment went through (or the order needs none). */
  paid: boolean;
}

const cell = "padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333;vertical-align:top;";

function linesTable(order: OrderMailOrder): string {
  const rows = order.lines
    .map(
      (line) => `
      <tr>
        <td style="${cell}text-align:left;">
          ${escapeHtml(line.title)}${
            line.option
              ? `<br /><span style="color:#888;font-size:12px;">${escapeHtml(line.option)}</span>`
              : ""
          }
          <span style="color:#888;font-size:12px;"> × ${line.quantity}</span>
        </td>
        <td style="${cell}text-align:right;white-space:nowrap;">${escapeHtml(
          formatTryFromKurus(line.priceKurus * line.quantity),
        )}</td>
      </tr>`,
    )
    .join("");

  const extra: string[] = [];
  if (order.discountKurus > 0) {
    extra.push(
      `<tr><td style="${cell}text-align:left;color:#666;">${escapeHtml(order.discountLabel ?? "İndirim")}</td><td style="${cell}text-align:right;color:#666;">−${escapeHtml(formatTryFromKurus(order.discountKurus))}</td></tr>`,
    );
  }
  if (order.shippingKurus !== null) {
    extra.push(
      `<tr><td style="${cell}text-align:left;color:#666;">Kargo</td><td style="${cell}text-align:right;color:#666;">${
        order.shippingKurus > 0 ? escapeHtml(formatTryFromKurus(order.shippingKurus)) : "Ücretsiz"
      }</td></tr>`,
    );
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e8e4e0;border-bottom:1px solid #e8e4e0;margin:8px 0 0;">
      ${rows}
      ${extra.join("")}
      <tr>
        <td style="${cell}text-align:left;font-weight:700;color:#111;border-top:1px solid #e8e4e0;">Toplam</td>
        <td style="${cell}text-align:right;font-weight:700;color:#111;border-top:1px solid #e8e4e0;">${escapeHtml(formatTryFromKurus(order.totalKurus))}</td>
      </tr>
    </table>`;
}

function linesText(order: OrderMailOrder): string {
  const rows = order.lines.map(
    (line) =>
      `- ${line.title}${line.option ? ` (${line.option})` : ""} x${line.quantity}: ${formatTryFromKurus(line.priceKurus * line.quantity)}`,
  );
  if (order.discountKurus > 0) {
    rows.push(`${order.discountLabel ?? "İndirim"}: -${formatTryFromKurus(order.discountKurus)}`);
  }
  if (order.shippingKurus !== null) {
    rows.push(`Kargo: ${order.shippingKurus > 0 ? formatTryFromKurus(order.shippingKurus) : "Ücretsiz"}`);
  }
  rows.push(`Toplam: ${formatTryFromKurus(order.totalKurus)}`);
  return rows.join("\n");
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(label)}</a></p>`;
}

function addressBlock(order: OrderMailOrder): string {
  if (order.addressLines.length === 0) return "";
  return `<p style="margin:18px 0 0;font-size:12px;color:#777;text-align:left;"><strong style="color:#444;">Teslimat adresi</strong><br />${order.addressLines
    .map(escapeHtml)
    .join("<br />")}</p>`;
}

/** What the shopper receives once an order is placed (or paid). */
export function buildOrderConfirmationEmail(input: {
  brand: BoutiqueAuthMailBrand;
  order: OrderMailOrder;
  /** The confirmation page for this order (with its token). */
  orderUrl: string | null;
  /** The store's support address, offered for questions. */
  supportEmail: string;
}): { subject: string; html: string; text: string } {
  const { brand, order } = input;
  const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";
  const title = order.paid ? "Siparişiniz alındı" : "Siparişiniz kaydedildi";
  const intro = order.paid
    ? `Merhaba ${firstName}, siparişiniz için teşekkürler. Hazırlayıp kargoya verdiğimizde size tekrar yazacağız.`
    : `Merhaba ${firstName}, siparişiniz kaydedildi. Ödemeniz onaylandığında hazırlayıp kargoya vereceğiz.`;
  const subject = `${brand.name} — ${title.toLocaleLowerCase("tr")} (#${order.number})`;

  const html = shell({
    brand,
    title,
    bodyHtml: `
      <p style="margin:0 0 6px;">${escapeHtml(intro)}</p>
      <p style="margin:0 0 4px;color:#888;font-size:12px;">Sipariş no: <strong style="color:#444;">#${escapeHtml(order.number)}</strong></p>
      ${linesTable(order)}
      ${addressBlock(order)}
      ${input.orderUrl ? button(input.orderUrl, "Siparişimi görüntüle") : ""}
      <p style="margin:20px 0 0;color:#777;font-size:12px;">Sorularınız için ${escapeHtml(input.supportEmail)} adresine yazabilirsiniz.</p>
    `,
  });

  const text = [
    `${brand.name} — ${title}`,
    "",
    intro,
    `Sipariş no: #${order.number}`,
    "",
    linesText(order),
    "",
    order.addressLines.length > 0 ? `Teslimat adresi:\n${order.addressLines.join("\n")}\n` : "",
    input.orderUrl ? `Siparişinizi görüntüleyin: ${input.orderUrl}` : "",
    `Sorularınız için: ${input.supportEmail}`,
  ]
    .filter((part, index, all) => part !== "" || all[index - 1] !== "")
    .join("\n");

  return { subject, html, text };
}

/** What the store's owner receives when an order comes in. */
export function buildOwnerNewOrderEmail(input: {
  brand: BoutiqueAuthMailBrand;
  order: OrderMailOrder;
  /** The order's page in the owner panel. */
  panelUrl: string;
}): { subject: string; html: string; text: string } {
  const { brand, order } = input;
  const state = order.paid ? "Ödendi" : "Ödeme bekleniyor";
  const subject = `Yeni sipariş #${order.number} — ${formatTryFromKurus(order.totalKurus)}`;

  const html = shell({
    brand,
    title: "Yeni sipariş",
    bodyHtml: `
      <p style="margin:0 0 6px;">${escapeHtml(order.customerName)} sipariş verdi.</p>
      <p style="margin:0 0 4px;color:#888;font-size:12px;">#${escapeHtml(order.number)} · ${escapeHtml(state)}</p>
      <p style="margin:0 0 4px;color:#888;font-size:12px;">${escapeHtml(order.customerEmail)}${
        order.customerPhone ? ` · ${escapeHtml(order.customerPhone)}` : ""
      }</p>
      ${linesTable(order)}
      ${addressBlock(order)}
      ${button(input.panelUrl, "Siparişi aç")}
    `,
  });

  const text = [
    `Yeni sipariş #${order.number} (${state})`,
    `${order.customerName} · ${order.customerEmail}${order.customerPhone ? ` · ${order.customerPhone}` : ""}`,
    "",
    linesText(order),
    "",
    order.addressLines.length > 0 ? `Teslimat adresi:\n${order.addressLines.join("\n")}\n` : "",
    `Siparişi aç: ${input.panelUrl}`,
  ]
    .filter((part, index, all) => part !== "" || all[index - 1] !== "")
    .join("\n");

  return { subject, html, text };
}
