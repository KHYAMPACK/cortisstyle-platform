import { getSiteUrl } from "@/lib/authRedirect";
import { resolveBoutiqueBrandLabel, resolveBoutiqueLogoUrl } from "@/lib/tr/boutiqueBrand";
import type { TrBoutiquePublic } from "@/types/tr-marketplace";

export type BoutiqueAuthMailBrand = {
  name: string;
  logoAbsoluteUrl: string | null;
};

/** Public origin for email <img> — never localhost (clients cannot fetch it). */
function resolveEmailAssetBaseUrl(): string {
  const site = getSiteUrl().replace(/\/$/, "");
  if (
    /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(site) ||
    site.startsWith("http://192.") ||
    site.startsWith("http://10.")
  ) {
    return "https://www.cortisstyle.com";
  }
  // Prefer www so static public/ assets resolve on production.
  if (site === "https://cortisstyle.com") {
    return "https://www.cortisstyle.com";
  }
  return site;
}

/** Many email clients block SVG, so an SVG logo is left out of the email. */
function isSvgPath(path: string): boolean {
  return /\.svg$/i.test(path.split(/[?#]/)[0] ?? "");
}

/**
 * Name and logo for a boutique's auth emails. The logo is the storefront logo
 * (`resolveBoutiqueLogoUrl`: code override, else `tr_boutiques.logo_url`) unless it
 * is an SVG; a store with only an SVG logo is asked for a PNG at onboarding.
 */
export function resolveBoutiqueAuthMailBrand(
  boutique: Pick<TrBoutiquePublic, "slug" | "name" | "logoUrl">,
): BoutiqueAuthMailBrand {
  const name = resolveBoutiqueBrandLabel(boutique.slug, boutique.name);
  const storefrontLogo = resolveBoutiqueLogoUrl(boutique);
  const logoPath =
    storefrontLogo && !isSvgPath(storefrontLogo) ? storefrontLogo : null;

  const base = resolveEmailAssetBaseUrl();
  const logoAbsoluteUrl = logoPath
    ? logoPath.startsWith("http")
      ? logoPath
      : `${base}${logoPath.startsWith("/") ? "" : "/"}${logoPath}`
    : null;

  return { name, logoAbsoluteUrl };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The branded frame every store e-mail shares (auth codes, order confirmations, …). */
export function shell(input: {
  brand: BoutiqueAuthMailBrand;
  title: string;
  bodyHtml: string;
}): string {
  const name = escapeHtml(input.brand.name);
  const logoBlock = input.brand.logoAbsoluteUrl
    ? `<img src="${escapeHtml(input.brand.logoAbsoluteUrl)}" alt="${name}" width="180" height="72" style="display:block;margin:0 auto 12px;max-width:180px;max-height:72px;width:auto;height:auto;border:0;outline:none;text-decoration:none;" />
       <p style="margin:0 0 24px;text-align:center;font-family:Georgia,serif;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#666;">${name}</p>`
    : `<p style="margin:0 0 24px;text-align:center;font-family:Georgia,serif;font-size:22px;letter-spacing:0.08em;text-transform:uppercase;color:#111;">${name}</p>`;

  return `<!DOCTYPE html>
<html lang="tr">
<body style="margin:0;padding:0;background:#f6f4f2;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4f2;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #e8e4e0;padding:36px 28px;">
          <tr><td align="center">${logoBlock}</td></tr>
          <tr>
            <td style="font-family:Georgia,serif;font-size:22px;line-height:1.3;text-align:center;color:#111;">
              ${escapeHtml(input.title)}
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#444;text-align:center;">
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding-top:28px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#888;text-align:center;">
              Bu e-posta ${name} adına Cortisstyle üzerinden gönderilmiştir.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildSignupOtpEmail(input: {
  brand: BoutiqueAuthMailBrand;
  otp: string;
}): { subject: string; html: string; text: string } {
  const otp = input.otp.trim();
  const name = input.brand.name;
  const subject = `${name} — hoş geldiniz`;
  const html = shell({
    brand: input.brand,
    title: `${name}'a hoş geldiniz`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Sizi aramızda görmekten mutluluk duyuyoruz. Üyeliğinizi tamamlamak için doğrulama kodunuz:</p>
      <p style="margin:0 0 16px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:28px;letter-spacing:0.35em;font-weight:700;color:#111;">${escapeHtml(otp)}</p>
      <p style="margin:0;color:#777;font-size:12px;">Kod kısa süre içinde geçerliliğini yitirir. Bu talebi siz oluşturmadıysanız e-postayı yok sayabilirsiniz.</p>
    `,
  });
  const text = `${name}'a hoş geldiniz\n\nSizi aramızda görmekten mutluluk duyuyoruz. Üyeliğinizi tamamlamak için doğrulama kodunuz: ${otp}\n\nBu e-posta ${name} adına Cortisstyle üzerinden gönderilmiştir.`;

  return { subject, html, text };
}

export function buildPasswordResetEmail(input: {
  brand: BoutiqueAuthMailBrand;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const url = input.resetUrl.trim();
  const subject = `${input.brand.name} — şifre sıfırlama`;
  const safeUrl = escapeHtml(url);
  const html = shell({
    brand: input.brand,
    title: "Şifre sıfırlama",
    bodyHtml: `
      <p style="margin:0 0 20px;">Şifrenizi yenilemek için aşağıdaki bağlantıya tıklayın. Yeni şifre platformdaki tüm mağazalar için geçerli olur.</p>
      <p style="margin:0 0 20px;">
        <a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Şifreyi sıfırla</a>
      </p>
      <p style="margin:0;color:#777;font-size:12px;word-break:break-all;">Bağlantı çalışmazsa: ${safeUrl}</p>
    `,
  });
  const text = `${input.brand.name} şifre sıfırlama\n\nBağlantı: ${url}\n\nYeni şifre tüm mağazalar için geçerli olur.\nBu e-posta ${input.brand.name} adına Cortisstyle üzerinden gönderilmiştir.`;

  return { subject, html, text };
}
