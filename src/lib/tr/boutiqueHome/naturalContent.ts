/**
 * What the "natural" skin's homepage shows, worked out from the store's own data
 * (categories, products, shipping rules) plus optional copy from the store's
 * `editorial_content.natural`. Pure: no React, no I/O.
 *
 * Everything has a sensible default, so a store with no copy and no products still
 * renders a complete page; copy the owner or Cortisstyle sets only replaces a default.
 */
import type { TrStorefrontTaxonomy } from "@/lib/tr/categories/taxonomy";
import { shippingFeeConfigOf } from "@/lib/tr/shipping/quoteShipping";
import { shippingHomeBody } from "@/lib/tr/shipping/shippingCopy";
import type { TrBoutiquePublic, TrProduct } from "@/types/tr-marketplace";

export interface NaturalStoryOverride {
  eyebrow: string | null;
  title: string;
  body: string;
  ctaLabel: string | null;
  /** A path on the store ("/tr/<slug>/yasal/kunye") or an https address. */
  ctaHref: string | null;
}

/** Text above the seller details on the store's "Hakkımızda" page (the old shop's own about text). */
export interface NaturalAboutIntro {
  title: string | null;
  paragraphs: string[];
  /** "Sevgi ve saygımızla;" — shown after the text, before the picture. */
  signoff: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface NaturalOverrides {
  announcement: string | null;
  /** Where the top bar leads (an https address opens in a new tab). */
  announcementHref: string | null;
  aboutIntro: NaturalAboutIntro | null;
  heroEyebrow: string | null;
  heroTitle: string | null;
  heroBody: string | null;
  heroPrimaryLabel: string | null;
  heroImage: string | null;
  usps: string[];
  producersTitle: string | null;
  producersBody: string | null;
  story: NaturalStoryOverride | null;
}

export const EMPTY_NATURAL_OVERRIDES: NaturalOverrides = {
  announcement: null,
  announcementHref: null,
  aboutIntro: null,
  heroEyebrow: null,
  heroTitle: null,
  heroBody: null,
  heroPrimaryLabel: null,
  heroImage: null,
  usps: [],
  producersTitle: null,
  producersBody: null,
  story: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

/** A path on the same site or an https address; anything else (javascript:, data:) is dropped. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (href.startsWith("/") && !href.startsWith("//")) return href.slice(0, 300);
  if (/^https:\/\/[^\s]+$/i.test(href)) return href.slice(0, 300);
  return null;
}

/** The `natural` block of a store's editorial content, cleaned and length-limited. */
export function readNaturalOverrides(
  editorialContent: Record<string, unknown> | null | undefined,
): NaturalOverrides {
  const raw = editorialContent?.natural;
  if (!isRecord(raw)) return EMPTY_NATURAL_OVERRIDES;

  const hero = isRecord(raw.hero) ? raw.hero : {};
  const producers = isRecord(raw.producers) ? raw.producers : {};
  const storyRaw = isRecord(raw.story) ? raw.story : null;
  const storyTitle = text(storyRaw?.title, 120);
  const storyBody = text(storyRaw?.body, 700);

  const aboutRaw = isRecord(raw.aboutIntro) ? raw.aboutIntro : null;
  const aboutParagraphs = Array.isArray(aboutRaw?.paragraphs)
    ? aboutRaw.paragraphs
        .map((entry) => text(entry, 2500))
        .filter((entry): entry is string => entry !== null)
        .slice(0, 8)
    : [];

  return {
    announcement: text(raw.announcement, 140),
    announcementHref: safeHref(raw.announcementHref),
    aboutIntro:
      aboutRaw && aboutParagraphs.length > 0
        ? {
            title: text(aboutRaw.title, 80),
            paragraphs: aboutParagraphs,
            signoff: text(aboutRaw.signoff, 80),
            imageUrl: safeHref(aboutRaw.imageUrl),
            imageAlt: text(aboutRaw.imageAlt, 120),
          }
        : null,
    heroEyebrow: text(hero.eyebrow, 60),
    heroTitle: text(hero.title, 140),
    heroBody: text(hero.body, 260),
    heroPrimaryLabel: text(hero.primaryLabel, 30),
    heroImage: safeHref(hero.image),
    usps: Array.isArray(raw.usps)
      ? raw.usps
          .map((entry) => text(entry, 60))
          .filter((entry): entry is string => entry !== null)
          .slice(0, 4)
      : [],
    producersTitle: text(producers.title, 80),
    producersBody: text(producers.body, 220),
    story:
      storyRaw && storyTitle && storyBody
        ? {
            eyebrow: text(storyRaw.eyebrow, 50),
            title: storyTitle,
            body: storyBody,
            ctaLabel: text(storyRaw.ctaLabel, 30),
            ctaHref: safeHref(storyRaw.ctaHref),
          }
        : null,
  };
}

export interface NaturalProducer {
  name: string;
  count: number;
}

/** The distinct `brand` values of the products (the makers), most products first. */
export function listProducers(products: readonly Pick<TrProduct, "brand">[]): NaturalProducer[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    const name = product.brand?.replace(/\s+/g, " ").trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"));
}

export interface NaturalCategoryTile {
  id: string;
  label: string;
  count: number;
  image: string | null;
}

export interface NaturalRail {
  id: string;
  title: string;
  /** The category the "Tümünü gör" link opens; null = the whole shop. */
  categoryId: string | null;
  products: TrProduct[];
}

export interface NaturalHome {
  announcement: string | null;
  hero: {
    eyebrow: string | null;
    title: string;
    body: string | null;
    primaryLabel: string;
    /** Up to three pictures for the hero; empty = the page draws the dandelion instead. */
    images: string[];
  };
  usps: string[];
  categoryTiles: NaturalCategoryTile[];
  rails: NaturalRail[];
  producers: { title: string; body: string | null; list: NaturalProducer[] };
  story: NaturalStoryOverride | null;
  /** True when the store has no sellable product yet. */
  empty: boolean;
}

type HomeTaxonomy = Pick<TrStorefrontTaxonomy, "roots" | "imageUrl" | "rootId" | "label">;

const SMALL_CATALOG = 8;
const RAIL_SIZE = 4;
const MAX_RAILS = 3;

/** The first sentence of a description, for use as a headline. */
function firstSentence(description: string | null): { head: string; rest: string | null } | null {
  const clean = description?.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const match = clean.match(/^(.+?[.!?])(\s+|$)/);
  const head = (match ? match[1]! : clean).replace(/[.]$/, "").trim();
  const rest = match ? clean.slice(match[0].length).trim() : "";
  return { head, rest: rest || null };
}

export function buildNaturalHome(input: {
  boutique: Pick<
    TrBoutiquePublic,
    | "name"
    | "description"
    | "editorialContent"
    | "shippingFeeKurus"
    | "freeShippingMinItems"
    | "freeShippingMinSubtotalKurus"
  >;
  products: readonly TrProduct[];
  taxonomy: HomeTaxonomy;
  /** A product's cover picture, or null. Passed in to keep this module free of image rules. */
  coverOf: (product: TrProduct) => string | null;
}): NaturalHome {
  const { boutique, taxonomy, coverOf } = input;
  const overrides = readNaturalOverrides(boutique.editorialContent);
  const available = input.products.filter((product) => product.status === "available");

  const sentence = firstSentence(boutique.description);
  const withCover = available.filter((product) => coverOf(product));

  const heroImages = overrides.heroImage
    ? [overrides.heroImage]
    : withCover
        .slice(0, 3)
        .map((product) => coverOf(product))
        .filter((src): src is string => Boolean(src));

  const shippingBody = shippingHomeBody(shippingFeeConfigOf(boutique));
  const usps =
    overrides.usps.length > 0
      ? overrides.usps
      : [
          ...(shippingBody ? [shippingBody.replace(/\.\s*Türkiye geneline gönderim\.$/, "")] : []),
          "14 gün içinde cayma hakkı",
          "Güvenli ödeme",
        ].slice(0, 4);

  const roots = taxonomy.roots();
  const countByRoot = new Map<string, number>();
  const firstCoverByRoot = new Map<string, string>();
  for (const product of available) {
    const root = taxonomy.rootId(product.category);
    if (!root) continue;
    countByRoot.set(root, (countByRoot.get(root) ?? 0) + 1);
    const cover = coverOf(product);
    if (cover && !firstCoverByRoot.has(root)) firstCoverByRoot.set(root, cover);
  }
  const allTiles: NaturalCategoryTile[] = roots.map((root) => ({
    id: root.id,
    label: root.label,
    count: countByRoot.get(root.id) ?? 0,
    image: taxonomy.imageUrl(root.id) ?? firstCoverByRoot.get(root.id) ?? null,
  }));
  const stocked = allTiles.filter((tile) => tile.count > 0);
  const categoryTiles = (stocked.length > 0 ? stocked : allTiles).slice(0, 8);

  const rails: NaturalRail[] = [];
  const ordered = [...available].sort((a, b) => a.sortOrder - b.sortOrder);
  if (ordered.length > 0 && ordered.length <= SMALL_CATALOG) {
    rails.push({ id: "all", title: "Ürünlerimiz", categoryId: null, products: ordered });
  } else if (ordered.length > SMALL_CATALOG) {
    const newest = [...available]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, RAIL_SIZE);
    rails.push({ id: "new", title: "Yeni gelenler", categoryId: null, products: newest });
    const byRoot = [...stocked].sort((a, b) => b.count - a.count).slice(0, MAX_RAILS);
    for (const tile of byRoot) {
      const inRoot = ordered
        .filter((product) => taxonomy.rootId(product.category) === tile.id)
        .slice(0, RAIL_SIZE);
      if (inRoot.length >= 2) {
        rails.push({ id: tile.id, title: tile.label, categoryId: tile.id, products: inRoot });
      }
    }
  }

  const producerList = listProducers(available);

  return {
    announcement: overrides.announcement,
    hero: {
      eyebrow: overrides.heroEyebrow,
      title: overrides.heroTitle ?? sentence?.head ?? boutique.name,
      body: overrides.heroBody ?? (overrides.heroTitle ? null : (sentence?.rest ?? null)),
      primaryLabel: overrides.heroPrimaryLabel ?? "Alışverişe başla",
      images: heroImages,
    },
    usps,
    categoryTiles,
    rails,
    producers: {
      title: overrides.producersTitle ?? "Üreticilerimiz",
      body: overrides.producersBody,
      list: producerList.length >= 2 ? producerList.slice(0, 12) : [],
    },
    story: overrides.story,
    empty: available.length === 0,
  };
}
