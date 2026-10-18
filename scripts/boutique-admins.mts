/**
 * Extra panel admins for a store (the people who can sign in to its panel besides the
 * owner). Matched by confirmed e-mail, so they can be added before they have an account:
 * access starts when they sign up on the store's /giris page and confirm the address.
 *
 *   npx tsx scripts/boutique-admins.mts --slug <slug> --list
 *   npx tsx scripts/boutique-admins.mts --slug <slug> --add a@x.com,b@y.com
 *   npx tsx scripts/boutique-admins.mts --slug <slug> --remove a@x.com
 *
 * Needs supabase/patch_tr_boutique_admins.sql applied first (the script says so if not).
 */
import "./nodeWebSocketStub.mts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getServerServiceSupabase } from "../src/lib/supabase/supabaseServer";
import {
  addBoutiqueAdmin,
  boutiqueAdminsTableExists,
  listBoutiqueAdminEmails,
  normalizeAdminEmail,
  removeBoutiqueAdmin,
} from "../src/lib/tr/panel/boutiqueAdmins";

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

function emails(value: string | null): string[] {
  if (!value) return [];
  return value.split(/[,;\s]+/).filter(Boolean).map((raw) => {
    const email = normalizeAdminEmail(raw);
    if (!email) throw new Error(`"${raw}" is not an e-mail address.`);
    return email;
  });
}

async function main() {
  loadEnv(arg("env-file") ?? ".env.local");
  const slug = arg("slug")?.toLowerCase();
  if (!slug) {
    console.error("Usage: --slug <store> (--list | --add a@x.com,b@y.com | --remove a@x.com)");
    process.exit(1);
  }

  if (!(await boutiqueAdminsTableExists())) {
    console.error(
      "The tr_boutique_admins table does not exist yet. Run supabase/patch_tr_boutique_admins.sql in the Supabase SQL editor first.",
    );
    process.exit(1);
  }

  const supabase = getServerServiceSupabase();
  if (!supabase) throw new Error("Supabase service role is not configured.");
  const { data: boutique, error } = await supabase
    .from("tr_boutiques")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!boutique) throw new Error(`No store with slug "${slug}".`);
  const boutiqueId = String(boutique.id);

  for (const email of emails(arg("add"))) {
    await addBoutiqueAdmin(boutiqueId, email);
    console.log(`added   ${email}`);
  }
  for (const email of emails(arg("remove"))) {
    await removeBoutiqueAdmin(boutiqueId, email);
    console.log(`removed ${email}`);
  }

  const current = await listBoutiqueAdminEmails(boutiqueId);
  console.log(`\nAdmins of ${boutique.name} (${slug}): ${current.length === 0 ? "none" : ""}`);
  for (const email of current) console.log(`  ${email}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
