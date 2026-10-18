/**
 * Reading a Ticimax storefront's public pages, for moving a store's catalog to this
 * platform. Pure: takes HTML text, returns data. A Ticimax product page embeds the
 * product as JSON (`var productDetailModel = {…}`: name, price, brand, stock, photos,
 * options) and holds the long description in `#divOnyazi`; a category page lists
 * product links as `<a class="detailLink detailUrl" href='/slug'>`.
 */

export interface TicimaxProduct {
  /** Ticimax's own product id. */
  externalId: string;
  name: string;
  /** What the shopper pays, KDV included. */
  priceKurus: number;
  /** The struck-through old price when the product is on sale. */
  compareAtPriceKurus: number | null;
  brand: string | null;
  stock: number;
  categoryName: string | null;
  /** The raw description markup (not yet cleaned). */
  descriptionHtml: string | null;
  /** Full-size photo addresses, main photo first. */
  imageUrls: string[];
  /** True when the product is sold by option (size, colour…): needs variants here. */
  hasOptions: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

/** The JSON object assigned to `var <name> = {…};`, found by matching braces. */
export function extractJsonAssignment(html: string, name: string): Record<string, unknown> | null {
  const marker = html.indexOf(`var ${name} = `);
  if (marker < 0) return null;
  const start = html.indexOf("{", marker);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(html.slice(start, index + 1));
          return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** The inside of the `<div … id="…">` element, found by matching nested divs. */
export function extractDivById(html: string, id: string): string | null {
  const open = new RegExp(`<div\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i").exec(html);
  if (!open) return null;
  const from = open.index + open[0].length;
  const tag = /<(\/?)div\b[^>]*>/gi;
  tag.lastIndex = from;
  let depth = 1;
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(from, match.index);
  }
  return null;
}

/** "₺2.750,00" or "2.750,00" → 275000 kuruş. */
export function parseTrPriceKurus(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/);
  if (!match) return null;
  const lira = Number(match[1]!.replace(/\./g, ""));
  const cents = Number((match[2] ?? "0").padEnd(2, "0"));
  if (!Number.isFinite(lira)) return null;
  return lira * 100 + cents;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function metaContent(html: string, property: string): string | null {
  const match = html.match(
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"),
  );
  const value = match ? decodeEntities(match[1]!).trim() : "";
  return value || null;
}

/** "TEOFARM" → "Teofarm", "DEFNE APOLLON İPEKÇİLİK" → "Defne Apollon İpekçilik". */
export function titleCaseBrand(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (trimmed !== trimmed.toLocaleUpperCase("tr")) return trimmed; // already mixed case
  return trimmed
    .toLocaleLowerCase("tr")
    .split(" ")
    .map((word) => word.charAt(0).toLocaleUpperCase("tr") + word.slice(1))
    .join(" ");
}

/** Product links on a Ticimax category page, in page order, without repeats. */
export function parseTicimaxCategoryLinks(html: string): string[] {
  const links: string[] = [];
  const pattern = /<a\s[^>]*class=["'][^"']*\bdetailLink\b[^"']*["'][^>]*href=['"]([^'"]+)['"]/gi;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    const href = match[1]!.trim();
    if (href.startsWith("/") && !links.includes(href)) links.push(href);
  }
  return links;
}

/** The maker, nicely cased; null for none or a placeholder like "Test Marka". */
function realBrand(name: string | null): string | null {
  if (!name || /\btest\b/i.test(name)) return null;
  return titleCaseBrand(name);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** One Ticimax product page, or null when it is not a product page. */
export function parseTicimaxProductPage(html: string): TicimaxProduct | null {
  const model = extractJsonAssignment(html, "productDetailModel");
  if (!model) return null;

  const name = str(model.productName);
  const priceRaw = typeof model.productPriceKDVIncluded === "number" ? model.productPriceKDVIncluded : null;
  if (!name || priceRaw === null) return null;
  const priceKurus = Math.round(priceRaw * 100);

  const imageUrls: string[] = [];
  if (Array.isArray(model.productImages)) {
    for (const image of model.productImages) {
      const url = str((image as Record<string, unknown>)?.bigImagePath);
      if (url && /^https:\/\//.test(url) && !imageUrls.includes(url)) imageUrls.push(url);
    }
  }

  const crumbs = Array.isArray(model.breadCrumb) ? model.breadCrumb : [];
  const lastCrumb = crumbs.length > 0 ? (crumbs[crumbs.length - 1] as Record<string, unknown>) : null;

  const oldPriceBlock = html.match(/PiyasafiyatiContent[^>]*>([\s\S]{0,300}?)<\/div>/i);
  const oldPrice = oldPriceBlock ? parseTrPriceKurus(oldPriceBlock[1]!.replace(/<[^>]+>/g, " ")) : null;

  const description = extractDivById(html, "divOnyazi");
  const options = Array.isArray(model.productVariantData) ? model.productVariantData.length : 0;
  const stock = typeof model.totalStockAmount === "number" ? model.totalStockAmount : 0;

  return {
    externalId: String(model.productId ?? ""),
    name: decodeEntities(name),
    priceKurus,
    compareAtPriceKurus: oldPrice !== null && oldPrice > priceKurus ? oldPrice : null,
    // Ticimax shops often keep a placeholder maker ("Test Marka") on products: not a real maker.
    brand: realBrand(str(model.brandName)),
    stock: Math.max(0, Math.floor(stock)),
    categoryName: lastCrumb ? str(lastCrumb.tanim) : null,
    descriptionHtml: description && description.replace(/<[^>]+>/g, "").trim() ? description : null,
    imageUrls,
    hasOptions: options > 0,
    seoTitle: metaContent(html, "og:title"),
    seoDescription: metaContent(html, "og:description"),
  };
}
