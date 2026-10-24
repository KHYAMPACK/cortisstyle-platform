/**
 * Import a store's catalog from a Ticimax product export (Excel) plus its public pages.
 *
 *   npx tsx scripts/import-ticimax-export.mts --slug <store> --export TicimaxExport.xls \
 *     --site https://old-shop.example --config import-config.json --cache crawl-cache.json --dry-run
 *
 * The export gives everything except photos and web addresses; those are read from the
 * old shop's public product pages (matched by Ticimax's product id). Per published product:
 * name, KDV-included price (and old price), maker, real stock, merged description, SEO,
 * keywords as tags, SKU/barcode/desi, categories (all of them, the breadcrumb one as the
 * main), photos re-saved in our storage, the old address's last part as the slug, and
 * option variants (colour, size…) with their own price and stock. Sold-out products are
 * imported as "sold". Hidden products and test products are left out.
 *
 * Flags: --dry-run (read and report, write nothing), --replace-demo (first delete the
 * small demo batch tagged `ticimax-aktarim`, with its photos; refuses above 20 products,
 * because every product this script imports carries the same tag), --limit N (first N products only),
 * --include-hidden (also the products switched off on Ticimax; they have no public page,
 * so no photos). Re-running skips slugs already in the store.
 *
 * The config file (kept out of the repo, it is client data) holds:
 *   newCategories [{name, slug, parent}], categoryMap {"Parent>Child": "our-slug"},
 *   brandFixes {"lower-case raw": "Fixed" | null}, typeNames {"BASKI RENGİ": "Baskı rengi"},
 *   typeStyles {"Renk": {"style": "swatch", "role": "color"}}, colorHex {"Mavi": "#2f6db5"}.
 */
import "./nodeWebSocketStub.mts";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { encodeOpaqueWebp, ORIGINAL_MAX_EDGE_PX } from "../src/lib/tr/assets/encodeOpaqueImage";
import { TR_ASSETS_BUCKET } from "../src/lib/tr/assets/trAssetUrls";
import { uploadTrProductAsset } from "../src/lib/tr/assets/trAssetStorage";
import { getServerServiceSupabase } from "../src/lib/supabase/supabaseServer";
import { createCategory, listCategories, setProductCategories } from "../src/lib/tr/catalog/categories";
import { createProductAdmin, deleteProductAdmin } from "../src/lib/tr/catalog/products";
import { generateUniqueProductSlug } from "../src/lib/tr/catalog/productSlug";
import { saveProductVariants } from "../src/lib/tr/catalog/productVariants";
import { createVariantType, listVariantTypes } from "../src/lib/tr/catalog/variantTypes";
import { cleanBrand, readExportProducts, type ExportProduct } from "../src/lib/tr/import/ticimaxExport";
import { parseTicimaxProductPage } from "../src/lib/tr/import/ticimaxPage";
import { readXlsxFirstSheet } from "../src/lib/tr/import/xlsxRead";
import { richHtmlToPlainText } from "../src/lib/tr/richText";
import { sanitizeRichHtml } from "../src/lib/tr/richTextSanitize";
import { isValidSlug } from "../src/lib/tr/seo/slug";
import { labelKey, normalizeHex } from "../src/lib/tr/variants/typeRules";

const USER_AGENT = "cortisstyle-importer (moving this store's catalog with the owner's agreement)";
const PAUSE_MS = 350;
const DEMO_TAG = "ticimax-aktarim";
const MAX_DEMO_PRODUCTS = 20;
const MAX_PHOTOS_SIMPLE = 8;
const MAX_PHOTOS_ADVANCED = 12;

interface ImportConfig {
  newCategories?: Array<{ name: string; slug: string; parent: string | null }>;
  categoryMap: Record<string, string>;
  brandFixes?: Record<string, string | null>;
  typeNames?: Record<string, string>;
  typeStyles?: Record<string, { style: "list" | "swatch"; role: "size" | "color" | null }>;
  colorHex?: Record<string, string>;
}

interface CrawledPage {
  path: string;
  imageUrls: string[];
}

function loadEnv(path: string) {
  try {
    for (const raw of readFileSync(resolve(process.cwd(), path), "utf8").split(/\r\n|\n|\r/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // variables may already be exported
  }
}

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1]?.trim() || null;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function getText(url: string): Promise<string> {
  await sleep(PAUSE_MS);
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.text();
}

async function getBytes(url: string): Promise<Buffer> {
  await sleep(PAUSE_MS);
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Product pages of the old shop, by Ticimax product id: address and photos. */
async function crawlPages(site: string, cachePath: string | null): Promise<Map<string, CrawledPage>> {
  const cache: Record<string, CrawledPage> =
    cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  const byPath = new Set(Object.values(cache).map((page) => page.path));

  const sitemap = await getText(`${site}/sitemap/products/0.xml`);
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1]!.replace(site, ""))
    .filter((path) => path.startsWith("/") && path.length > 1);
  console.log(`Old shop lists ${paths.length} product pages (${byPath.size} already cached).`);

  let done = 0;
  for (const path of paths) {
    if (byPath.has(path)) continue;
    try {
      const product = parseTicimaxProductPage(await getText(`${site}${path}`));
      if (product?.externalId) cache[product.externalId] = { path, imageUrls: product.imageUrls };
    } catch (error) {
      console.log(`  could not read ${path}: ${error instanceof Error ? error.message : error}`);
    }
    done += 1;
    if (done % 20 === 0) {
      console.log(`  …${done} pages read`);
      if (cachePath) writeFileSync(cachePath, JSON.stringify(cache));
    }
  }
  if (cachePath) writeFileSync(cachePath, JSON.stringify(cache));
  return new Map(Object.entries(cache));
}

const pathKey = (path: string[]) => path.map((part) => labelKey(part)).join(">");

async function main() {
  const slug = arg("slug")?.toLowerCase();
  const exportFile = arg("export");
  const site = arg("site")?.replace(/\/$/, "");
  const configFile = arg("config");
  if (!slug || !exportFile || !site || !configFile) {
    console.error("Usage: --slug <store> --export file.xls --site https://old-shop --config config.json [--cache file.json] [--dry-run] [--replace-demo] [--limit N] [--include-hidden]");
    process.exit(1);
  }
  const dryRun = flag("dry-run");
  const limit = Number(arg("limit")) || Infinity;
  loadEnv(arg("env-file") ?? ".env.local");
  const config = JSON.parse(readFileSync(resolve(process.cwd(), configFile), "utf8")) as ImportConfig;
  const categoryMap = new Map(Object.entries(config.categoryMap).map(([path, target]) => [path.split(">").map(labelKey).join(">"), target]));

  // 1. The export.
  const all = readExportProducts(readXlsxFirstSheet(readFileSync(resolve(process.cwd(), exportFile))));
  const wanted = all.filter((product) => !product.isTest && (product.published || flag("include-hidden")));
  console.log(`Export: ${all.length} products — ${all.filter((p) => p.isTest).length} test, ${all.filter((p) => !p.isTest && !p.published).length} hidden; importing ${wanted.length}.`);

  // 2. The old shop's pages (photos + addresses).
  const pages = await crawlPages(site, arg("cache"));
  const missingPages = wanted.filter((product) => !pages.has(product.cardId));
  if (missingPages.length > 0) {
    console.log(`No public page for ${missingPages.length} product(s): ${missingPages.slice(0, 8).map((p) => p.name).join("; ")}${missingPages.length > 8 ? "…" : ""}`);
  }

  // 3. Report what will happen.
  const brandOf = (product: ExportProduct) => cleanBrand(product.brand, config.brandFixes);
  const unmapped = new Map<string, number>();
  const perCategory = new Map<string, number>();
  for (const product of wanted) {
    for (const path of product.categoryPaths) {
      const target = categoryMap.get(pathKey(path));
      if (!target) unmapped.set(path.join(">"), (unmapped.get(path.join(">")) ?? 0) + 1);
      else perCategory.set(target, (perCategory.get(target) ?? 0) + 1);
    }
  }
  const brands = new Map<string, number>();
  for (const product of wanted) {
    const label = `${product.brand ?? "—"} → ${brandOf(product) ?? "(no maker)"}`;
    brands.set(label, (brands.get(label) ?? 0) + 1);
  }
  const optionTypes = new Map<string, Set<string>>();
  for (const product of wanted) {
    if (!product.optionType) continue;
    const set = optionTypes.get(product.optionType) ?? new Set<string>();
    for (const variant of product.variants) if (variant.value) set.add(variant.value);
    optionTypes.set(product.optionType, set);
  }
  const soldOut = wanted.filter((p) => p.variants.filter((v) => v.active).every((v) => v.stock <= 0));
  const withPhotos = wanted.filter((p) => (pages.get(p.cardId)?.imageUrls.length ?? 0) > 0);
  console.log(
    `\nSold out (imported as "sold"): ${soldOut.length}. With options: ${wanted.filter((p) => p.optionType).length}. ` +
      `With photos found: ${withPhotos.length} of ${wanted.length}.`,
  );
  const noPhotos = wanted.filter((p) => !withPhotos.includes(p));
  if (noPhotos.length > 0) console.log(`No photos for: ${noPhotos.map((p) => p.name).join("; ")}`);
  for (const product of wanted) {
    for (const warning of product.warnings) console.log(`Note — ${product.name}: ${warning}`);
  }
  const unpriced = wanted.filter((p) => p.variants.some((v) => v.active && v.priceKurus <= 0));
  if (unpriced.length > 0) console.log(`Price 0 or missing on: ${unpriced.map((p) => p.name).join("; ")}`);
  const dearer = wanted.filter((p) => new Set(p.variants.filter((v) => v.active).map((v) => v.priceKurus)).size > 1);
  if (dearer.length > 0) console.log(`Options with their own price: ${dearer.length} product(s)`);
  const skus = new Map<string, number>();
  for (const p of wanted) for (const v of p.variants) if (v.sku) skus.set(v.sku, (skus.get(v.sku) ?? 0) + 1);
  const dupSkus = [...skus].filter(([, count]) => count > 1).length;
  if (dupSkus > 0) console.log(`Stock codes used more than once: ${dupSkus}`);
  console.log("\nMakers:");
  for (const [label, count] of [...brands].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)}  ${label}`);
  console.log("\nOptions:");
  for (const [type, values] of optionTypes) console.log(`  ${type} → ${config.typeNames?.[type] ?? type}: ${[...values].join(", ")}`);
  const styleOf = (rawType: string) =>
    config.typeStyles?.[rawType] ?? config.typeStyles?.[config.typeNames?.[rawType] ?? rawType] ?? { style: "list" as const, role: null };
  const missingHex: string[] = [];
  for (const [rawType, values] of optionTypes) {
    if (styleOf(rawType).style !== "swatch") continue;
    for (const value of values) if (!normalizeHex(config.colorHex?.[value])) missingHex.push(value);
  }
  if (missingHex.length > 0) console.log(`  swatch values without a valid colour: ${missingHex.join(", ")}`);
  console.log("\nCategories (our slug: products):");
  for (const [target, count] of [...perCategory].sort()) console.log(`  ${String(count).padStart(3)}  ${target}`);
  if (unmapped.size > 0) {
    console.log("\nUNMAPPED category paths (add them to categoryMap):");
    for (const [path, count] of unmapped) console.log(`  ${count}  ${path}`);
  }

  // Every category the products map to must exist in the store (or be created by the config).
  const supabase = getServerServiceSupabase();
  if (!supabase) throw new Error("Supabase service role is not configured.");
  const { data: boutique, error } = await supabase.from("tr_boutiques").select("id, owner_user_id").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!boutique) throw new Error(`No store with slug "${slug}".`);
  const boutiqueId = String(boutique.id);
  const uploaderId = boutique.owner_user_id ? String(boutique.owner_user_id) : boutiqueId;

  const knownCategories = new Set((config.newCategories ?? []).map((entry) => entry.slug));
  for (const category of await listCategories(boutiqueId)) knownCategories.add(category.slug);
  const missingTargets = [...perCategory.keys()].filter((target) => !knownCategories.has(target));
  if (missingTargets.length > 0) {
    console.log(`\nMAPPED TO CATEGORIES THAT DO NOT EXIST: ${missingTargets.join(", ")}`);
  }
  const blocked = unmapped.size > 0 || missingHex.length > 0 || missingTargets.length > 0;

  if (dryRun) {
    console.log("\nDry run — nothing written.");
    if (blocked) process.exitCode = 2;
    return;
  }
  if (blocked) {
    console.error("\nFix the config first (see the problems above).");
    process.exit(2);
  }

  // 4. Write.

  if (flag("replace-demo")) {
    const { data: demo } = await supabase.from("tr_products").select("id, title, images").eq("boutique_id", boutiqueId).contains("tags", [DEMO_TAG]);
    // A full import carries this tag too, so on a store that already has its catalog this
    // would delete the real products. Only the small demo batch is meant to go.
    if ((demo?.length ?? 0) > MAX_DEMO_PRODUCTS) {
      throw new Error(
        `--replace-demo would delete ${demo!.length} products tagged "${DEMO_TAG}" — that is the real catalog, not a demo batch. Nothing was changed.`,
      );
    }
    console.log(`\nRemoving ${demo?.length ?? 0} earlier demo product(s)…`);
    for (const row of demo ?? []) {
      const paths = ((row.images as string[] | null) ?? [])
        .map((url) => url.split(`/${TR_ASSETS_BUCKET}/`)[1])
        .filter((path): path is string => Boolean(path));
      await deleteProductAdmin(String(row.id));
      if (paths.length > 0) await supabase.storage.from(TR_ASSETS_BUCKET).remove(paths);
    }
  }

  // Categories.
  let categories = await listCategories(boutiqueId);
  for (const entry of config.newCategories ?? []) {
    if (categories.some((category) => category.slug === entry.slug)) continue;
    const parent = entry.parent ? categories.find((category) => category.slug === entry.parent) : null;
    if (entry.parent && !parent) throw new Error(`Parent category "${entry.parent}" of "${entry.slug}" does not exist.`);
    await createCategory(boutiqueId, { name: entry.name, slug: entry.slug, parentId: parent?.id ?? null });
    console.log(`  + category ${entry.name}`);
    categories = await listCategories(boutiqueId);
  }
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

  // Variant types (one per option name, all values at once).
  let types = await listVariantTypes(boutiqueId);
  const typeIdFor = new Map<string, { id: string; values: Map<string, string> }>();
  for (const [rawType, values] of optionTypes) {
    const name = config.typeNames?.[rawType] ?? rawType;
    let type = types.find((candidate) => labelKey(candidate.name) === labelKey(name));
    if (!type) {
      const style = styleOf(rawType);
      type = await createVariantType(boutiqueId, {
        name,
        selectionStyle: style.style,
        role: style.role,
        values: [...values].map((label) => ({
          label,
          ...(style.style === "swatch" ? { hex: normalizeHex(config.colorHex?.[label]) } : {}),
        })),
      });
      console.log(`  + option type ${name} (${values.size} values)`);
      types = await listVariantTypes(boutiqueId);
    }
    const byLabel = new Map(type.values.map((value) => [labelKey(value.label), value.id]));
    for (const label of values) {
      if (!byLabel.has(labelKey(label))) throw new Error(`Option type "${name}" has no value "${label}"; add it in Tanımlamalar first.`);
    }
    typeIdFor.set(rawType, { id: type.id, values: byLabel });
  }

  // Products: showcase first, then the export's order.
  const ordered = [...wanted].sort((a, b) => Number(b.isShowcase) - Number(a.isShowcase)).slice(0, limit);
  let created = 0;
  let skipped = 0;
  const problems: string[] = [];
  const claimedSlugs = new Set<string>();
  for (const [index, product] of ordered.entries()) {
    const page = pages.get(product.cardId);
    // The old address's last part keeps old links redirectable; a product with no public
    // page (or an unusable address) gets a slug from its name.
    const oldSlug = page ? decodeURIComponent(page.path.replace(/^\//, "").split(/[?#]/)[0]!) : null;
    if (oldSlug && isValidSlug(oldSlug)) {
      const { data: existing } = await supabase.from("tr_products").select("id").eq("boutique_id", boutiqueId).eq("slug", oldSlug).maybeSingle();
      if (existing) {
        skipped += 1;
        continue;
      }
    }

    let createdId: string | null = null;
    try {
      const productSlug =
        oldSlug && isValidSlug(oldSlug) && !claimedSlugs.has(oldSlug)
          ? oldSlug
          : await generateUniqueProductSlug(boutiqueId, product.name, claimedSlugs);
      claimedSlugs.add(productSlug);
      const hasOptions = Boolean(product.optionType);
      const photoLimit = hasOptions ? MAX_PHOTOS_ADVANCED : MAX_PHOTOS_SIMPLE;
      const images: string[] = [];
      for (const url of (page?.imageUrls ?? []).slice(0, photoLimit)) {
        const encoded = await encodeOpaqueWebp(await getBytes(url), ORIGINAL_MAX_EDGE_PX);
        const stored = await uploadTrProductAsset({ userId: uploaderId, boutiqueId, bytes: encoded.bytes, contentType: encoded.contentType, kind: "original" });
        images.push(stored.url);
      }
      if (images.length === 0) problems.push(`${product.name}: no photos found`);

      const activeVariants = product.variants.filter((variant) => variant.active);
      const priced = activeVariants.length > 0 ? activeVariants : product.variants;
      const base = priced.reduce((lowest, variant) => (variant.priceKurus < lowest.priceKurus ? variant : lowest), priced[0]!);
      const stock = activeVariants.reduce((sum, variant) => sum + variant.stock, 0);
      const html = sanitizeRichHtml(product.descriptionHtml);
      const tags = [DEMO_TAG, ...product.keywords].slice(0, 20);

      const productCategorySlugs = [...new Set(product.categoryPaths.map((path) => categoryMap.get(pathKey(path))!))];
      const row = await createProductAdmin({
        boutiqueId,
        title: product.name.slice(0, 200),
        category: productCategorySlugs[0] ?? null,
        description: html ? richHtmlToPlainText(html).slice(0, 5000) : null,
        descriptionHtml: html,
        brand: brandOf(product),
        tags,
        sku: product.sku?.slice(0, 64) ?? null,
        barcode: hasOptions ? null : product.barcode,
        desi: product.desi,
        priceKurus: base.priceKurus,
        compareAtPriceKurus: base.compareAtPriceKurus,
        conditionLabel: product.isNew ? "Yeni" : null,
        images,
        stock,
        status: stock > 0 ? "available" : "sold",
        sortOrder: index,
        productType: hasOptions ? "advanced" : "simple",
        fulfillmentType: "physical",
        slug: productSlug,
        seo: {
          ...(product.seoTitle ? { title: product.seoTitle.slice(0, 256) } : {}),
          ...(product.seoDescription ? { description: product.seoDescription.slice(0, 320) } : {}),
        },
      });

      createdId = row.id;
      const ids = productCategorySlugs.map((target) => categoryBySlug.get(target)?.id).filter((id): id is string => Boolean(id));
      if (ids.length > 0) {
        await setProductCategories({ productId: row.id, boutiqueId, categoryIds: ids, primaryId: ids[0] });
      }

      if (hasOptions) {
        const type = typeIdFor.get(product.optionType!)!;
        await saveProductVariants({
          productId: row.id,
          boutiqueId,
          productImages: images,
          input: {
            typeIds: [type.id],
            variants: product.variants.map((variant) => ({
              optionValueIds: [type.values.get(labelKey(variant.value ?? ""))!],
              // A code shared with the product itself says nothing about the option.
              sku: variant.sku && variant.sku !== product.sku ? variant.sku.slice(0, 64) : null,
              barcode: variant.barcode,
              priceKurus: variant.priceKurus === base.priceKurus ? null : variant.priceKurus,
              stock: variant.stock,
              images: [],
              active: variant.active,
            })),
          },
        });
      }
      created += 1;
      console.log(`  ${String(created).padStart(3)}. ${product.name}${hasOptions ? ` (${product.variants.length} options)` : ""} — ${images.length} photo(s)`);
    } catch (productError) {
      // A half-made product would be skipped on the next run: remove it so a re-run retries.
      if (createdId) await deleteProductAdmin(createdId).catch(() => undefined);
      problems.push(`${product.name}: ${productError instanceof Error ? productError.message : productError}`);
      console.log(`  ✗ ${product.name}: ${productError instanceof Error ? productError.message : productError}`);
    }
  }
  console.log(`\nDone: ${created} added, ${skipped} already there, ${problems.length} problem(s).`);
  for (const problem of problems) console.log(`  - ${problem}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
