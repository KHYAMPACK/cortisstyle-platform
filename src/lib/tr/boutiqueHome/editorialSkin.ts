export type TrEditorialSkinId = "classic" | "atelier" | "natural";

/**
 * Visual skin within the shared editorial shell (same commerce rails).
 * classic = Pervin today · atelier = Cecilie-structure calm + boutique brandify ·
 * natural = earthy cream/olive for handmade, food and producer-led stores
 */
const SLUG_SKINS: Partial<Record<string, TrEditorialSkinId>> = {
  lilabutik: "atelier",
  tohumluktan: "natural",
};

export function resolveEditorialSkin(
  boutiqueSlug: string,
): TrEditorialSkinId {
  const slug = boutiqueSlug.trim().toLowerCase();
  return SLUG_SKINS[slug] ?? "classic";
}

export function isAtelierEditorialSkin(boutiqueSlug: string): boolean {
  return resolveEditorialSkin(boutiqueSlug) === "atelier";
}

export function isNaturalEditorialSkin(boutiqueSlug: string): boolean {
  return resolveEditorialSkin(boutiqueSlug) === "natural";
}
