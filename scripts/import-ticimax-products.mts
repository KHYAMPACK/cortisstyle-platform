/**
 * Copy products from a store's public Ticimax site into its store here.
 *
 *   npx tsx scripts/import-ticimax-products.mts --slug tohumluktan \
 *     --site https://tohumluktan.com.tr --pick gida-paketleri:4,kolye:2,sabun:4 --dry-run
 *
 * --pick lists "category-slug:how-many". The slug is used on both sides: the Ticimax
 * category page is `<site>/<slug>` and the product is filed under the store's category
 * with the same slug (so keep the old Ticimax category slugs when you build the tree).
 *
 * Per product it takes name, price (KDV included), old price, maker, real stock, the
 * description (cleaned to the rich-text subset) and up to 4 photos (re-saved in our own
 * storage, not linked), keeps the old address's last part as the product slug (so old
 * links can be redirected), and tags it `ticimax-aktarim`. Products sold by option (size,
 * colour…) and products out of stock are skipped: they need variants / are not for sale.
 * A product whose slug already exists in the store is skipped, so re-running is safe.
 *
 * Only for a store whose owner has agreed to the move; it reads public pages politely
 * (one request at a time, with a pause).
 */
import "./nodeWebSocketStub.mts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeOpaqueWebp, ORIGINAL_MAX_EDGE_PX } from "../src/lib/tr/assets/encodeOpaqueImage";
import { uploadTrProductAsset } from "../src/lib/tr/assets/trAssetStorage";
import { getServerServiceSupabase } from "../src/lib/supabase/supabaseServer";
import { listCategories, setProductCategories } from "../src/lib/tr/catalog/categories";
import { createProductAdmin } from "../src/lib/tr/catalog/products";
import {
  parseTicimaxCategoryLinks,
  parseTicimaxProductPage,
  type TicimaxProduct,
} from "../src/lib/tr/import/ticimaxPage";
import { richHtmlToPlainText } from "../src/lib/tr/richText";
import { sanitizeRichHtml } from "../src/lib/tr/richTextSanitize";
import { isValidSlug } from "../src/lib/tr/seo/slug";

const USER_AGENT = "cortisstyle-importer (moving this store's catalog with the owner's agreement)";
const PAUSE_MS = 400;
const MAX_PHOTOS = 4;

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

async function main() {
  const slug = arg("slug")?.toLowerCase();
  const site = arg("site")?.replace(/\/$/, "");
  const pickArg = arg("pick");
  if (!slug || !site || !pickArg) {
    console.error("Usage: --slug <store> --site https://old-shop.example --pick category:count,… [--dry-run]");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  loadEnv(arg("env-file") ?? ".env.local");

  const picks = pickArg.split(",").map((entry) => {
    const [category, count] = entry.split(":");
    return { category: category!.trim(), count: Math.max(1, Number(count) || 1) };
  });

  const supabase = getServerServiceSupabase();
  if (!supabase) throw new Error("Supabase service role is not configured.");
  const { data: boutique, error } = await supabase
    .from("tr_boutiques")
    .select("id, name, owner_user_id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!boutique) throw new Error(`No store with slug "${slug}".`);
  const boutiqueId = String(boutique.id);
  const uploaderId = boutique.owner_user_id ? String(boutique.owner_user_id) : boutiqueId;

  const categories = await listCategories(boutiqueId);
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

  let sortOrder = 0;
  let created = 0;
  for (const pick of picks) {
    const category = categoryBySlug.get(pick.category);
    if (!category) {
      console.error(`Store has no category "${pick.category}" — skipped.`);
      continue;
    }
    console.log(`\n== ${category.name} (${pick.category}) — want ${pick.count}`);
    const links = parseTicimaxCategoryLinks(await getText(`${site}/${pick.category}`));
    console.log(`   ${links.length} products listed on the old site`);

    let taken = 0;
    for (const href of links) {
      if (taken >= pick.count) break;
      const productSlug = decodeURIComponent(href.replace(/^\//, "").split(/[?#]/)[0]!);
      if (!isValidSlug(productSlug)) {
        console.log(`   skip ${href}: not a usable slug`);
        continue;
      }
      const { data: existing } = await supabase
        .from("tr_products")
        .select("id")
        .eq("boutique_id", boutiqueId)
        .eq("slug", productSlug)
        .maybeSingle();
      if (existing) {
        console.log(`   skip ${productSlug}: already in the store`);
        taken += 1;
        continue;
      }

      let product: TicimaxProduct | null;
      try {
        product = parseTicimaxProductPage(await getText(`${site}${href}`));
      } catch (fetchError) {
        console.log(`   skip ${productSlug}: ${fetchError instanceof Error ? fetchError.message : fetchError}`);
        continue;
      }
      if (!product) {
        console.log(`   skip ${productSlug}: not a product page`);
        continue;
      }
      if (product.hasOptions) {
        console.log(`   skip ${productSlug}: sold by option (needs variants)`);
        continue;
      }
      if (product.stock <= 0 || product.imageUrls.length === 0 || /\btest\b/i.test(product.name)) {
        console.log(`   skip ${productSlug}: no stock, no photo, or a test product`);
        continue;
      }

      const descriptionHtml = sanitizeRichHtml(product.descriptionHtml);
      console.log(
        `   ${dryRun ? "would add" : "adding"} ${product.name} — ₺${(product.priceKurus / 100).toFixed(2)}` +
          `${product.compareAtPriceKurus ? ` (was ₺${(product.compareAtPriceKurus / 100).toFixed(2)})` : ""}` +
          `, ${product.brand ?? "no maker"}, stock ${product.stock}, ${Math.min(product.imageUrls.length, MAX_PHOTOS)} photo(s)`,
      );
      taken += 1;
      if (dryRun) continue;

      const images: string[] = [];
      for (const url of product.imageUrls.slice(0, MAX_PHOTOS)) {
        const encoded = await encodeOpaqueWebp(await getBytes(url), ORIGINAL_MAX_EDGE_PX);
        const stored = await uploadTrProductAsset({
          userId: uploaderId,
          boutiqueId,
          bytes: encoded.bytes,
          contentType: encoded.contentType,
          kind: "original",
        });
        images.push(stored.url);
      }

      const row = await createProductAdmin({
        boutiqueId,
        title: product.name,
        description: descriptionHtml ? richHtmlToPlainText(descriptionHtml) : null,
        descriptionHtml,
        brand: product.brand,
        tags: ["ticimax-aktarim"],
        priceKurus: product.priceKurus,
        compareAtPriceKurus: product.compareAtPriceKurus,
        images,
        category: category.slug,
        stock: product.stock,
        sortOrder: sortOrder++,
        productType: "simple",
        fulfillmentType: "physical",
        slug: productSlug,
        seo: {
          ...(product.seoTitle ? { title: product.seoTitle.slice(0, 256) } : {}),
          ...(product.seoDescription ? { description: product.seoDescription.slice(0, 320) } : {}),
        },
      });
      await setProductCategories({
        productId: row.id,
        boutiqueId,
        categoryIds: [category.id],
        primaryId: category.id,
      });
      created += 1;
    }
  }
  console.log(dryRun ? "\nDry run — nothing written." : `\nDone: ${created} product(s) added.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
