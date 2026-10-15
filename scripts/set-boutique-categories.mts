/**
 * Give a boutique its own category tree, replacing the ready-made one.
 *
 * A boutique created with catalogProfile "fashion" is seeded with the fashion tree
 * (Elbise, Üst giyim, Alt giyim, Aksesuar, Ev…). For any other kind of store, run this
 * right after `create-boutique.mts` — before products exist — to swap in the store's
 * real categories. It refuses to touch a boutique whose categories already hold
 * products unless --force is given (deleting a category removes its product links).
 *
 *   npx tsx scripts/set-boutique-categories.mts --slug <slug> --tree path/to/tree.json --dry-run
 *   npx tsx scripts/set-boutique-categories.mts --slug <slug> --tree path/to/tree.json
 *
 * The tree file is JSON, in menu order; slugs are optional (made from the name):
 *   { "categories": [ { "name": "Gıda", "slug": "gida", "children": [ { "name": "Gıda paketleri" } ] } ] }
 *
 * Reads the platform env from .env.local (or --env-file).
 */
import "./nodeWebSocketStub.mts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getServerServiceSupabase } from "../src/lib/supabase/supabaseServer";
import { isValidSlug, slugify } from "../src/lib/tr/seo/slug";

interface TreeNode {
  name: string;
  slug?: string;
  children?: TreeNode[];
}

interface FlatEntry {
  name: string;
  slug: string;
  parentSlug: string | null;
}

function loadEnvFile(path: string) {
  try {
    const raw = readFileSync(resolve(process.cwd(), path), "utf8");
    for (const rawLine of raw.split(/\r\n|\n|\r/)) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional when the variables are already exported
  }
}

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  return process.argv[index + 1]?.trim() || null;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function flatten(nodes: TreeNode[], parentSlug: string | null, out: FlatEntry[]) {
  for (const node of nodes) {
    const name = node.name?.trim();
    if (!name) throw new Error("Every category needs a name.");
    const slug = (node.slug?.trim() || slugify(name)).toLowerCase();
    if (!isValidSlug(slug)) {
      throw new Error(`"${name}": "${slug}" is not a valid slug (a-z, 0-9 and single hyphens).`);
    }
    if (out.some((entry) => entry.slug === slug)) {
      throw new Error(`Slug "${slug}" is used twice in the tree.`);
    }
    out.push({ name, slug, parentSlug });
    if (node.children?.length) flatten(node.children, slug, out);
  }
}

async function main() {
  const slug = arg("slug")?.toLowerCase();
  const treePath = arg("tree");
  if (!slug || !treePath) {
    console.error("Usage: --slug <boutique-slug> --tree <file.json> [--dry-run] [--force]");
    process.exit(1);
  }
  const dryRun = flag("dry-run");
  const force = flag("force");
  loadEnvFile(arg("env-file") ?? ".env.local");

  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), treePath), "utf8")) as {
    categories?: TreeNode[];
  };
  if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
    console.error('The tree file needs a non-empty "categories" array.');
    process.exit(1);
  }
  const entries: FlatEntry[] = [];
  flatten(parsed.categories, null, entries);

  const supabase = getServerServiceSupabase();
  if (!supabase) {
    console.error("Supabase service role is not configured (.env.local).");
    process.exit(1);
  }

  const { data: boutique, error: boutiqueError } = await supabase
    .from("tr_boutiques")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (boutiqueError) throw boutiqueError;
  if (!boutique) {
    console.error(`No boutique with slug "${slug}".`);
    process.exit(1);
  }

  const { data: existing, error: existingError } = await supabase
    .from("tr_categories")
    .select("id")
    .eq("boutique_id", boutique.id);
  if (existingError) throw existingError;
  const existingIds = (existing ?? []).map((row) => String(row.id));

  let linked = 0;
  if (existingIds.length > 0) {
    const { count, error } = await supabase
      .from("tr_product_categories")
      .select("product_id", { count: "exact", head: true })
      .in("category_id", existingIds);
    if (error) throw error;
    linked = count ?? 0;
  }
  if (linked > 0 && !force) {
    console.error(
      `${boutique.name} has ${linked} product link(s) in its current categories. Re-run with --force to delete them anyway.`,
    );
    process.exit(1);
  }

  console.log(
    `${boutique.name} (${slug}): ${existingIds.length} existing categor${existingIds.length === 1 ? "y" : "ies"} will be replaced by ${entries.length}:`,
  );
  for (const entry of entries) {
    console.log(`  ${entry.parentSlug ? "    " : ""}${entry.name}  /kategori/${entry.slug}`);
  }
  if (dryRun) {
    console.log("Dry run — nothing written.");
    return;
  }

  if (existingIds.length > 0) {
    // Products keep their own `category` column; only the category rows (and their
    // product links, by cascade) go.
    const { error } = await supabase.from("tr_categories").delete().in("id", existingIds);
    if (error) throw error;
  }

  const idBySlug = new Map<string, string>();
  for (const [index, entry] of entries.entries()) {
    const { data, error } = await supabase
      .from("tr_categories")
      .insert({
        boutique_id: boutique.id,
        parent_id: entry.parentSlug ? (idBySlug.get(entry.parentSlug) ?? null) : null,
        name: entry.name,
        slug: entry.slug,
        sort_order: index,
        seo: {},
      })
      .select("id")
      .single();
    if (error) throw error;
    idBySlug.set(entry.slug, String((data as { id: unknown }).id));
  }
  console.log(`Done: ${idBySlug.size} categories written.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
