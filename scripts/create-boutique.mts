/**
 * Create or update a boutique from a client intake JSON file — Phase 1B-T1.
 * Calls the existing POST /api/tr/admin/seed route over HTTP (no duplicated
 * logic) so this always matches whatever that route actually does.
 *
 * Usage:
 *   npx tsx scripts/create-boutique.mts --intake path/to/client.json
 *   npx tsx scripts/create-boutique.mts --intake path/to/client.json --dry-run
 *   npx tsx scripts/create-boutique.mts --intake path/to/client.json --base-url http://localhost:3000
 *
 * Intake file shape: see docs/tr-boutique-intake-template.md. Only `slug`
 * and `name` are strictly required; everything else is optional but
 * strongly recommended (this script warns, not fails, if the recommended
 * fields are missing — the underlying route accepts a minimal payload).
 *
 * Does NOT create or link the owner's login — that's still
 * scripts/link-tr-boutique-owner.mts, run after the client signs up
 * themselves. See docs/agent-handoffs/03-multi-tenant-boutiques.md.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RECOMMENDED_FIELDS = [
  "legalName",
  "vergiNo",
  "vergiDairesi",
  "contactEmail",
  "whatsappPhone",
  "physicalAddress",
] as const;

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r\n|\n|\r/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional when vars are exported some other way
  }
}

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1]?.trim() || null;
}

interface BoutiqueIntake {
  slug: string;
  name: string;
  legalName?: string;
  vergiNo?: string;
  /** Tax office, MERSİS number (16 digits) and KEP address — shown on the künye page. */
  vergiDairesi?: string;
  mersisNo?: string;
  kepAddress?: string;
  /** Ad / analytics IDs: metaPixelId, ga4Id, gtmId, googleAdsId, googleAdsPurchaseLabel. */
  tracking?: Record<string, string>;
  iban?: string;
  contactEmail?: string;
  description?: string;
  logoUrl?: string;
  whatsappPhone?: string;
  instagramHandle?: string;
  themeAccent?: string;
  shippingNote?: string;
  exchangePolicy?: string;
  physicalAddress?: string;
  customDomain?: string;
  /** Flat fee shoppers pay per order, in TRY (e.g. 120). Omit = shoppers are not charged for shipping. */
  shippingFeeTry?: number;
  /** Orders with at least this many items ship free (use this OR freeShippingMinSubtotalTry). */
  freeShippingMinItems?: number;
  /** Orders whose items subtotal reaches this many TRY ship free. */
  freeShippingMinSubtotalTry?: number;
  catalogProfile?: "fashion" | "custom_art";
  status?: "draft" | "pending" | "verified" | "suspended";
  products?: Array<{
    title: string;
    description?: string;
    priceTry: number;
    sizes?: string[];
    colors?: Array<{ name: string; hex: string }>;
    category?: string;
    images?: string[];
    stock?: number;
  }>;
}

async function main() {
  loadEnvLocal();

  const intakePath = arg("intake");
  const dryRun = process.argv.includes("--dry-run");
  const baseUrl = (
    arg("base-url") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");

  if (!intakePath) {
    console.error("Missing --intake <path-to-json>");
    console.error("See docs/tr-boutique-intake-template.md for the shape.");
    process.exit(1);
  }

  let intake: BoutiqueIntake;
  try {
    const raw = readFileSync(resolve(process.cwd(), intakePath), "utf8");
    intake = JSON.parse(raw) as BoutiqueIntake;
  } catch (error) {
    console.error(
      `Could not read/parse ${intakePath}: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1);
  }

  if (!intake.slug?.trim() || !intake.name?.trim()) {
    console.error("Intake file must have at least 'slug' and 'name'.");
    process.exit(1);
  }

  const missingRecommended = RECOMMENDED_FIELDS.filter(
    (field) => !intake[field]?.trim(),
  );
  if (missingRecommended.length > 0) {
    console.log(
      `Note: recommended fields not set (will fall back to platform defaults): ${missingRecommended.join(", ")}`,
    );
  }

  if (intake.shippingFeeTry === undefined) {
    console.log(
      "Note: no shippingFeeTry set — shoppers will NOT be charged for shipping. Set it (and optionally freeShippingMinItems or freeShippingMinSubtotalTry) if this store charges kargo.",
    );
  }

  console.log(`Boutique: ${intake.slug} (${intake.name})`);
  console.log(`Target:   ${baseUrl}/api/tr/admin/seed`);

  if (dryRun) {
    console.log("Dry run — not calling the API. Intake file is valid.");
    return;
  }

  const secret = process.env.TR_ADMIN_SECRET?.trim();
  if (!secret) {
    console.error("Missing TR_ADMIN_SECRET (check .env.local).");
    process.exit(1);
  }

  const response = await fetch(`${baseUrl}/api/tr/admin/seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ boutiques: [intake] }),
  });

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    boutiques?: Array<{
      id: string;
      slug: string;
      status: string;
      updated: boolean;
    }>;
  } | null;

  if (!response.ok || !body?.ok) {
    console.error(
      `Seed request failed (${response.status}): ${body?.error ?? "unknown error"}`,
    );
    process.exit(1);
  }

  const result = body.boutiques?.[0];
  console.log(
    result?.updated
      ? "Updated existing boutique:"
      : "Created new boutique:",
  );
  console.log(`  id:         ${result?.id}`);
  console.log(`  slug:       ${result?.slug}`);
  console.log(`  status:     ${result?.status}`);
  console.log(`  storefront: ${baseUrl}/tr/${result?.slug}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Have the client sign up at /giris on the storefront above.");
  console.log(
    `  2. Link their account: npx tsx scripts/link-tr-boutique-owner.mts --email <their-email> --slug ${result?.slug}`,
  );
  console.log(
    "  3. Log the time from \"yes\" to this point in docs/onboarding-time-log.md.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
