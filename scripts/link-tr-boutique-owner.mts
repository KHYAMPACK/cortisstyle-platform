/**
 * Link a boutique owner by email + custom domain or slug.
 * Usage: npx tsx scripts/link-tr-boutique-owner.mts --email owner@example.com --domain example.com
 *    or: npx tsx scripts/link-tr-boutique-owner.mts --email owner@example.com --slug lilabutik
 */
import "./nodeWebSocketStub.mts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setBoutiqueOwnerAdmin } from "../src/lib/tr/catalog/boutiques";
import { getServerServiceSupabase } from "../src/lib/supabase/supabaseServer";

function getServiceSupabase() {
  return getServerServiceSupabase();
}

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
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
    // optional when vars are exported
  }
}

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1]?.trim() || null;
}

async function findAuthUserByEmail(email: string) {
  const admin = getServiceSupabase();
  if (!admin) throw new Error("Supabase service role is not configured.");

  const normalized = email.trim().toLowerCase();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalized,
    );
    if (match) return match;

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

async function findBoutique(opts: { domain?: string | null; slug?: string | null }) {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  if (opts.slug) {
    const { data, error } = await supabase
      .from("tr_boutiques")
      .select("id, slug, name, custom_domain, owner_user_id")
      .eq("slug", opts.slug.trim().toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const domain = opts.domain?.trim().toLowerCase().replace(/^www\./, "") ?? "";
  if (!domain) throw new Error("Provide --domain or --slug.");

  const { data, error } = await supabase
    .from("tr_boutiques")
    .select("id, slug, name, custom_domain, owner_user_id")
    .or(`custom_domain.eq.${domain},custom_domain.eq.www.${domain}`)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: bySlug, error: slugError } = await supabase
    .from("tr_boutiques")
    .select("id, slug, name, custom_domain, owner_user_id")
    .eq("slug", domain.split(".")[0] ?? domain)
    .maybeSingle();

  if (slugError) throw slugError;
  return bySlug;
}

async function listBoutiques() {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const { data, error } = await supabase
    .from("tr_boutiques")
    .select("id, slug, name, custom_domain, owner_user_id")
    .order("slug");
  if (error) throw error;
  for (const row of data ?? []) {
    console.log(
      `${row.slug}\t${row.custom_domain ?? "-"}\t${row.owner_user_id ? "linked" : "no owner"}\t${row.name}`,
    );
  }
}

async function main() {
  loadEnvLocal();

  if (process.argv.includes("--list")) {
    await listBoutiques();
    return;
  }

  const email = arg("email");
  const domain = arg("domain");
  const slug = arg("slug");

  if (!email) {
    console.error("Missing --email");
    process.exit(1);
  }
  if (!domain && !slug) {
    console.error("Missing --domain or --slug");
    process.exit(1);
  }

  const boutique = await findBoutique({ domain, slug });
  if (!boutique) {
    console.error(
      `No boutique found for ${domain ? `domain ${domain}` : `slug ${slug}`}.`,
    );
    process.exit(1);
  }

  const user = await findAuthUserByEmail(email);
  if (!user) {
    console.error(
      `No auth user for ${email}. Owner must sign up first (e.g. /tr/panel or boutique login).`,
    );
    process.exit(1);
  }

  const updated = await setBoutiqueOwnerAdmin(boutique.id, user.id);

  console.log("Linked owner:");
  console.log(`  boutique: ${updated.slug} (${updated.id})`);
  console.log(`  domain:   ${updated.customDomain ?? "(none)"}`);
  console.log(`  owner:    ${email} (${user.id})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
