import type { TrBoutiquePublic } from "@/types/tr-marketplace";

const DEFAULT_THEME_ACCENT = "#C2185B";
const DEFAULT_BOUTIQUE_BG = "#FFFBFC";

/** Known accents when DB row is not loaded (auth pages, emails). */
const THEME_ACCENT_OVERRIDES: Partial<Record<string, string>> = {
  lilabutik: "#9B7EBD",
};

/** Known storefront logo overrides (e.g. after recreating assets before DB re-seed). */
const LOGO_OVERRIDES: Partial<Record<string, string>> = {
  lilabutik: "/tr/boutiques/lilabutik/logo.png?v=4",
};

/** Light / white marks for dark or accent campaign backgrounds. */
const LOGO_ON_DARK_OVERRIDES: Partial<Record<string, string>> = {
  lilabutik: "/tr/boutiques/lilabutik/logo-white.png?v=1",
};

/** High-contrast favicons (tab icons) — prefer readable marks over dark-on-dark logos. */
const FAVICON_OVERRIDES: Partial<Record<string, string>> = {
  lilabutik: "/tr/boutiques/lilabutik/favicon.png?v=2",
  // The dandelion bloom of the logo on its own (the wordmark is unreadable at tab size).
  tohumluktan: "/tr/boutiques/tohumluktan/favicon.png?v=1",
};

const INTRO_BRAND_LABELS: Partial<Record<string, string>> = {
  lilabutik: "Lila Boutique",
};

/** Browser / SEO document titles (home). Keep UI labels shorter via `resolveBoutiqueBrandLabel`. */
const DOCUMENT_TITLES: Partial<Record<string, string>> = {
  lilabutik: "Lila Butik | Kadın Giyim",
};

const DOCUMENT_DESCRIPTIONS: Partial<Record<string, string>> = {
  lilabutik:
    "Lila Butik’te kadın giyim — elbise, üst giyim, çanta ve aksesuar. Denizli’den online butik.",
};

/** Human-facing boutique label for auth/legal copy. */
export function resolveBoutiqueBrandLabel(
  slug: string,
  fallbackName?: string | null,
): string {
  const override = INTRO_BRAND_LABELS[slug.trim().toLowerCase()];
  if (override) return override;
  const name = fallbackName?.trim();
  if (name) return name;
  return slug;
}

/**
 * A store's own page title and description, from `editorial_content.seo`
 * (`{ "title": "…", "description": "…" }`). Either may be missing.
 */
export function readSeoOverride(
  editorialContent: Record<string, unknown> | null | undefined,
): { title: string | null; description: string | null } {
  const raw = editorialContent?.seo;
  const seo =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const clean = (value: unknown, max: number) => {
    if (typeof value !== "string") return null;
    const text = value.replace(/\s+/g, " ").trim();
    return text ? text.slice(0, max) : null;
  };
  return { title: clean(seo.title, 70), description: clean(seo.description, 170) };
}

/** Full SEO title for the boutique home / default document title. */
export function resolveBoutiqueDocumentTitle(
  slug: string,
  fallbackName?: string | null,
  editorialContent?: Record<string, unknown> | null,
): string {
  const key = slug.trim().toLowerCase();
  return (
    readSeoOverride(editorialContent).title ??
    DOCUMENT_TITLES[key] ??
    resolveBoutiqueBrandLabel(slug, fallbackName)
  );
}

/** SEO meta description for boutique storefronts. */
export function resolveBoutiqueDocumentDescription(
  slug: string,
  fallbackDescription?: string | null,
  fallbackName?: string | null,
  editorialContent?: Record<string, unknown> | null,
): string {
  const key = slug.trim().toLowerCase();
  const own = readSeoOverride(editorialContent).description;
  if (own) return own;
  const override = DOCUMENT_DESCRIPTIONS[key];
  if (override) return override;
  const fromBoutique = fallbackDescription?.trim();
  if (fromBoutique) return fromBoutique;
  const brand = resolveBoutiqueBrandLabel(slug, fallbackName);
  return `${brand} — online alışveriş. Ürünleri inceleyin, güvenle sipariş verin.`;
}

/** Boutiques with logo or accent get the branded shell. */
export function hasBoutiqueBrand(boutique: TrBoutiquePublic): boolean {
  return Boolean(boutique.logoUrl?.trim() || boutique.themeAccent?.trim());
}

export function resolveBoutiqueThemeAccent(boutique: TrBoutiquePublic): string {
  return (
    boutique.themeAccent?.trim() ||
    THEME_ACCENT_OVERRIDES[boutique.slug] ||
    DEFAULT_THEME_ACCENT
  );
}

export function resolveBoutiqueThemeAccentBySlug(slug: string): string {
  return THEME_ACCENT_OVERRIDES[slug.trim().toLowerCase()] || DEFAULT_THEME_ACCENT;
}

export function resolveBoutiqueBackground(): string {
  return DEFAULT_BOUTIQUE_BG;
}

/** Prefer known PNG monograms over stale SVG text marks in DB. */
export function resolveBoutiqueLogoUrl(
  boutique: Pick<TrBoutiquePublic, "slug" | "logoUrl">,
): string | null {
  const override = LOGO_OVERRIDES[boutique.slug];
  if (override) return override;
  return boutique.logoUrl?.trim() || null;
}

/** White/light logo for accent or dark campaign surfaces. Falls back to standard logo. */
export function resolveBoutiqueLogoOnDarkUrl(
  boutique: Pick<TrBoutiquePublic, "slug" | "logoUrl">,
): string | null {
  const override = LOGO_ON_DARK_OVERRIDES[boutique.slug];
  if (override) return override;
  return resolveBoutiqueLogoUrl(boutique);
}

/** Browser tab / apple touch icon for white-label boutique hosts. */
export function resolveBoutiqueFaviconUrl(
  boutique: Pick<TrBoutiquePublic, "slug" | "logoUrl">,
): string | null {
  const override = FAVICON_OVERRIDES[boutique.slug];
  if (override) return override;
  return resolveBoutiqueLogoUrl(boutique);
}

/** Public file path for a boutique favicon (no cache-buster query). */
export function resolveBoutiqueFaviconFilePath(slug: string): string | null {
  const override = FAVICON_OVERRIDES[slug.trim().toLowerCase()];
  if (!override) return null;
  return override.split("?")[0] || null;
}

/** Logo + label for custom-domain intro mask (no DB round-trip). */
export function resolveBoutiqueIntroBrand(slug: string): {
  logoUrl: string;
  label: string;
} | null {
  const logoUrl = LOGO_OVERRIDES[slug];
  if (!logoUrl) return null;
  return {
    logoUrl,
    label: INTRO_BRAND_LABELS[slug] ?? slug,
  };
}
