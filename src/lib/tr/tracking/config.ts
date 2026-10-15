/**
 * A store's ad / analytics IDs (Meta Pixel, GA4, Google Tag Manager, Google Ads).
 * Public identifiers only. They end up inside script tags on the store's pages, so
 * every value is checked against its exact ID format and nothing else is accepted.
 * Pure — the storefront runtime is `components/tr/boutique/TrBoutiqueTracker.tsx`.
 */

export interface TrBoutiqueTracking {
  /** Meta (Facebook) Pixel ID, digits only. */
  metaPixelId: string | null;
  /** Google Analytics 4 measurement ID, `G-XXXXXXXXXX`. */
  ga4Id: string | null;
  /** Google Tag Manager container, `GTM-XXXXXXX`. Replaces the direct IDs when set. */
  gtmId: string | null;
  /** Google Ads conversion tracking ID, `AW-123456789`. */
  googleAdsId: string | null;
  /** The Google Ads purchase conversion's label (the part after the slash). */
  googleAdsPurchaseLabel: string | null;
}

export const EMPTY_TRACKING: TrBoutiqueTracking = {
  metaPixelId: null,
  ga4Id: null,
  gtmId: null,
  googleAdsId: null,
  googleAdsPurchaseLabel: null,
};

interface FieldRule {
  key: keyof TrBoutiqueTracking;
  label: string;
  pattern: RegExp;
  example: string;
  upper: boolean;
}

const FIELDS: readonly FieldRule[] = [
  { key: "metaPixelId", label: "Meta Pixel ID", pattern: /^\d{8,20}$/, example: "1234567890123456", upper: false },
  { key: "ga4Id", label: "GA4 ölçüm kimliği", pattern: /^G-[A-Z0-9]{6,14}$/, example: "G-ABCDE12345", upper: true },
  { key: "gtmId", label: "Google Tag Manager kimliği", pattern: /^GTM-[A-Z0-9]{4,10}$/, example: "GTM-ABC1234", upper: true },
  { key: "googleAdsId", label: "Google Ads kimliği", pattern: /^AW-\d{6,15}$/, example: "AW-123456789", upper: true },
  {
    key: "googleAdsPurchaseLabel",
    label: "Google Ads satın alma etiketi",
    pattern: /^[A-Za-z0-9_-]{6,40}$/,
    example: "AbC-dEfGhIjKlMn",
    upper: false,
  },
];

function normalize(raw: unknown, rule: FieldRule): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) return null;
  return rule.upper ? trimmed.toUpperCase() : trimmed;
}

/** Reads the stored JSON; anything malformed is dropped rather than trusted. */
export function readTrackingConfig(value: unknown): TrBoutiqueTracking {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const result: TrBoutiqueTracking = { ...EMPTY_TRACKING };
  for (const rule of FIELDS) {
    const normalized = normalize(record[rule.key], rule);
    if (normalized && rule.pattern.test(normalized)) result[rule.key] = normalized;
  }
  return result;
}

/**
 * Validates what an owner or the intake submits: a blank value clears the field, a
 * filled one must match its ID format. Throws a sentence for the person entering it.
 */
export function readTrackingInput(value: unknown): TrBoutiqueTracking {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const result: TrBoutiqueTracking = { ...EMPTY_TRACKING };
  for (const rule of FIELDS) {
    const normalized = normalize(record[rule.key], rule);
    if (!normalized) continue;
    if (!rule.pattern.test(normalized)) {
      throw new Error(`${rule.label} geçersiz. Örnek: ${rule.example}`);
    }
    result[rule.key] = normalized;
  }
  if (result.googleAdsPurchaseLabel && !result.googleAdsId) {
    throw new Error("Satın alma etiketi için Google Ads kimliği de girilmeli.");
  }
  return result;
}

/** What gets stored: only the IDs that are set. */
export function trackingToJson(tracking: TrBoutiqueTracking): Record<string, string> {
  const json: Record<string, string> = {};
  for (const rule of FIELDS) {
    const value = tracking[rule.key];
    if (value) json[rule.key] = value;
  }
  return json;
}

/** The tools a store loads, by name — for the cookie policy text. */
export function trackingToolNames(tracking: TrBoutiqueTracking): string[] {
  const names: string[] = [];
  if (tracking.metaPixelId) names.push("Meta Pixel");
  if (tracking.ga4Id) names.push("Google Analytics 4");
  if (tracking.gtmId) names.push("Google Tag Manager");
  if (tracking.googleAdsId) names.push("Google Ads");
  return names;
}

/** Any tag at all — the storefront then asks for cookie consent before loading it. */
export function hasTracking(tracking: TrBoutiqueTracking): boolean {
  return FIELDS.some((rule) => Boolean(tracking[rule.key]));
}
