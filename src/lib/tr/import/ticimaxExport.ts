/**
 * A Ticimax product export (the Excel file from Ürünler → Dışa aktar), turned into
 * products for this platform. Pure: takes the sheet's rows, returns data.
 *
 * One row per sellable item: a product card with options (colour, size…) has one row per
 * option value, all sharing the card id (URUNKARTIID). Prices include KDV. The file has no
 * photos and no web addresses — those come from the shop's public pages.
 */

export interface ExportVariant {
  /** The option value ("Mavi", "M"); null for a product with no options. */
  value: string | null;
  sku: string | null;
  barcode: string | null;
  /** What the shopper pays, in kuruş. */
  priceKurus: number;
  /** The struck-through old price, when there is one. */
  compareAtPriceKurus: number | null;
  stock: number;
  active: boolean;
}

export interface ExportProduct {
  /** Ticimax's product card id: also the id on the public product page. */
  cardId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  /** The maker as typed in Ticimax (not yet cleaned). */
  brand: string | null;
  descriptionHtml: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  keywords: string[];
  /**
   * The categories as paths ("Giyim>Gömlek"), most specific only (a parent that a deeper
   * path already covers is dropped). The first is the main one.
   */
  categoryPaths: string[][];
  isNew: boolean;
  isShowcase: boolean;
  freeShipping: boolean;
  kdvRate: number | null;
  desi: number | null;
  /** The option's name ("Renk", "Beden"); null = no options. */
  optionType: string | null;
  variants: ExportVariant[];
  /** On the public shop: the card is on and at least one row is active. */
  published: boolean;
  isTest: boolean;
  warnings: string[];
}

type Row = Record<string, string>;

function text(row: Row, key: string): string {
  return (row[key] ?? "").toString().trim();
}

function num(row: Row, key: string): number {
  const value = Number(text(row, key).replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}

const toKurus = (lira: number) => Math.round(lira * 100);

/** Selling price and old price of one row, in kuruş. */
export function exportRowPrices(row: Row): { priceKurus: number; compareAtPriceKurus: number | null } {
  const list = num(row, "SATISFIYATI");
  const discounted = num(row, "INDIRIMLIFIYAT");
  const market = num(row, "PIYASAFIYATI");
  if (discounted > 0 && discounted < list) {
    return { priceKurus: toKurus(discounted), compareAtPriceKurus: toKurus(list) };
  }
  return {
    priceKurus: toKurus(list),
    compareAtPriceKurus: market > list ? toKurus(market) : null,
  };
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The short line (ÖNYAZI) and the long text (AÇIKLAMA) as one description. */
export function mergeDescriptions(onYazi: string, aciklama: string): string | null {
  const short = onYazi.trim();
  const long = aciklama.trim();
  const shortText = stripTags(short);
  const longText = stripTags(long);
  if (!shortText && !longText) return null;
  if (!shortText) return long;
  if (!longText) return short;
  if (longText.includes(shortText)) return long;
  if (shortText.includes(longText)) return short;
  return `${short}${long}`;
}

/**
 * Category paths from the export's two columns: the full list (KATEGORILER, ";"-separated,
 * "Parent>Child") and the main path (BREADCRUMBKAT). Ancestors covered by a deeper path
 * and non-categories ("Vitrin", test categories) are dropped; the main path comes first.
 */
export function parseCategoryPaths(kategoriler: string, breadcrumb: string): string[][] {
  const toPath = (raw: string) =>
    raw
      .split(">")
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  const wanted = (path: string[]) =>
    path.length > 0 && path[0]!.toLocaleLowerCase("tr") !== "vitrin" && !/\btest\b/i.test(path.join(" "));

  const all = kategoriler.split(";").map(toPath).filter(wanted);
  const main = toPath(breadcrumb);
  const list = wanted(main) ? [main, ...all] : all;

  const key = (path: string[]) => path.join(">").toLocaleLowerCase("tr");
  const unique: string[][] = [];
  for (const path of list) if (!unique.some((other) => key(other) === key(path))) unique.push(path);

  const covered = (path: string[]) =>
    unique.some(
      (other) =>
        other.length > path.length && key(other.slice(0, path.length)) === key(path),
    );
  return unique.filter((path) => !covered(path));
}

function keywordsOf(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\n]/)) {
    const word = part.replace(/\s+/g, " ").trim();
    if (word.length >= 2 && word.length <= 40) seen.add(word);
  }
  return [...seen];
}

function toRows(rows: string[][]): Row[] {
  const header = rows[0];
  if (!header || !header.includes("URUNKARTIID")) {
    throw new Error("This does not look like a Ticimax product export (no URUNKARTIID column).");
  }
  return rows.slice(1).map((cells) => {
    const row: Row = {};
    header.forEach((name, index) => {
      row[name] = cells[index] ?? "";
    });
    return row;
  });
}

const BARCODE = /^[0-9A-Za-z._-]{1,64}$/;

/** Every product card of the export (published or not; test products flagged). */
export function readExportProducts(rows: string[][]): ExportProduct[] {
  const cards = new Map<string, Row[]>();
  for (const row of toRows(rows)) {
    const id = text(row, "URUNKARTIID");
    if (!id) continue;
    const list = cards.get(id);
    if (list) list.push(row);
    else cards.set(id, [row]);
  }

  const products: ExportProduct[] = [];
  for (const [cardId, group] of cards) {
    const first = group[0]!;
    const warnings: string[] = [];

    // One option axis per product is what Ticimax shops here use; more is reported.
    let optionType: string | null = null;
    // Several rows but no option names at all: Ticimax shows such a card as one item (the
    // first row's price, the stock added up). It is not a choice the shopper can make.
    const unnamedRows = group.length > 1 && group.every((row) => !text(row, "VARYASYON"));
    let variants: ExportVariant[] = group.map((row, index) => {
      const parts = text(row, "VARYASYON").split(";").map((part) => part.trim());
      if (parts.length > 2) warnings.push(`more than one option on one row ("${text(row, "VARYASYON")}")`);
      const type = parts[0] || null;
      const value = parts[1] || null;
      if (group.length > 1 && type) optionType ??= type;
      const prices = exportRowPrices(row);
      const barcode = text(row, "BARKOD");
      return {
        value: group.length > 1 && !unnamedRows ? (value ?? `Seçenek ${index + 1}`) : null,
        sku: text(row, "VARYASYONKODU") || text(row, "STOKKODU") || null,
        barcode: BARCODE.test(barcode) ? barcode : null,
        stock: Math.max(0, Math.floor(num(row, "STOKADEDI"))),
        active: text(row, "URUNAKTIF") === "1",
        ...prices,
      };
    });
    if (unnamedRows) {
      const prices = [...new Set(variants.map((variant) => variant.priceKurus / 100))];
      if (prices.length > 1) {
        warnings.push(
          `${group.length} rows without option names and different prices (₺${prices.join(" / ₺")}); imported as one item at the first row's price`,
        );
      }
      variants = [
        {
          ...variants[0]!,
          stock: variants.reduce((sum, variant) => sum + (variant.active ? variant.stock : 0), 0),
          active: variants.some((variant) => variant.active),
        },
      ];
    } else if (group.length > 1 && !optionType) {
      optionType = "Seçenek";
    }

    const name = text(first, "URUNADI");
    const brand = text(first, "MARKA") || null;
    const categoryPaths = parseCategoryPaths(text(first, "KATEGORILER"), text(first, "BREADCRUMBKAT"));
    const barcode = text(first, "BARKOD");
    const desi = num(first, "KARGOAGIRLIGI");

    products.push({
      cardId,
      name,
      sku: text(first, "STOKKODU") || null,
      barcode: BARCODE.test(barcode) ? barcode : null,
      brand,
      descriptionHtml: mergeDescriptions(text(first, "ONYAZI"), text(first, "ACIKLAMA")),
      seoTitle: text(first, "SEO_SAYFABASLIK") || null,
      seoDescription: text(first, "SEO_SAYFAACIKLAMA") || null,
      keywords: keywordsOf(text(first, "ANAHTARKELIME")),
      categoryPaths,
      isNew: text(first, "YENIURUN") === "1",
      isShowcase: text(first, "VITRIN") === "1",
      freeShipping: text(first, "UCRETSIZKARGO") === "1",
      kdvRate: num(first, "KDVORANI") || null,
      desi: desi > 0 && desi <= 9999 ? desi : null,
      optionType,
      variants,
      published: group.some((row) => text(row, "KARTAKTIF") === "1") && variants.some((v) => v.active),
      // A placeholder maker ("Test Marka") is common on real products: only the name, the
      // stock code and the categories say that a product is a test.
      isTest: /\btest\b/i.test(`${name} ${text(first, "STOKKODU")} ${text(first, "KATEGORILER")}`),
      warnings,
    });
  }
  return products;
}

/** "TEOFARM" → "Teofarm"; fixes from the client's own list win; placeholders → null. */
export function cleanBrand(raw: string | null, fixes: Record<string, string | null> = {}): string | null {
  const name = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  const fixed = fixes[name.toLocaleLowerCase("tr")];
  if (fixed !== undefined) return fixed;
  if (/\btest\b/i.test(name)) return null;
  if (name !== name.toLocaleUpperCase("tr")) return name;
  return name
    .toLocaleLowerCase("tr")
    .split(" ")
    .map((word) => word.charAt(0).toLocaleUpperCase("tr") + word.slice(1))
    .join(" ");
}
