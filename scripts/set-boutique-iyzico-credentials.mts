/**
 * Connect any boutique's own iyzico account: writes the encrypted
 * tr_boutique_integrations row that checkout reads (payments/registry.ts).
 *
 * Run locally, by whoever holds the client's keys. The keys are typed at a hidden
 * prompt (or read from IYZICO_API_KEY / IYZICO_SECRET_KEY) — never passed as
 * arguments, so they stay out of shell history, and never printed (only masked).
 *
 *   1. Pull the platform secrets (Supabase service role + encryption key):
 *        vercel env pull .env.production.local --environment=production
 *   2. Dry run — checks everything, including that iyzico accepts the keys:
 *        npx tsx scripts/set-boutique-iyzico-credentials.mts --slug <slug> --env-file .env.production.local --dry-run
 *   3. Write it:
 *        npx tsx scripts/set-boutique-iyzico-credentials.mts --slug <slug> --env-file .env.production.local
 *   4. Delete .env.production.local afterwards (it holds real secrets).
 *
 * Flags: --mode live|sandbox (default live), --replace (update an existing row),
 * --skip-verify (don't call iyzico), --dry-run (write nothing).
 */
import "./nodeWebSocketStub.mts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from "../src/lib/tr/payments/credentialEncryption";
import { iyzicoCheckCredentials } from "../src/lib/tr/payments/iyzicoClient";
import { getServerServiceSupabase } from "../src/lib/supabase/supabaseServer";

const LIVE_BASE = "https://api.iyzipay.com";
const SANDBOX_BASE = "https://sandbox-api.iyzipay.com";

type StoredCredentials = { apiKey: string; secretKey: string; baseUrl?: string };

function loadEnvFile(path: string) {
  const raw = readFileSync(resolve(process.cwd(), path), "utf8");
  for (const rawLine of raw.split(/\r\n|\n|\r/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let key = trimmed.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice("export ".length).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.replace(/\\n/g, "\n");
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

function mask(value: string): string {
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(value.length - 8)}${value.slice(-4)}`;
}

/** Reads a line without echoing it; handles paste. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolvePrompt, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error(
          "No terminal to prompt in. Set IYZICO_API_KEY and IYZICO_SECRET_KEY in the environment instead.",
        ),
      );
      return;
    }
    process.stdout.write(question);
    const typed: string[] = [];
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const finish = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          finish();
          process.exit(130);
        }
        if (char === "\r" || char === "\n") {
          finish();
          resolvePrompt(typed.join("").trim());
          return;
        }
        if (char === "\u007f" || char === "\b") typed.pop();
        else typed.push(char);
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const slug = arg("slug")?.toLowerCase();
  if (!slug) {
    console.error("Missing --slug <boutique-slug>.");
    process.exit(1);
  }
  const mode = arg("mode") ?? "live";
  if (mode !== "live" && mode !== "sandbox") {
    console.error('--mode must be "live" or "sandbox".');
    process.exit(1);
  }
  const dryRun = flag("dry-run");
  const replace = flag("replace");
  const skipVerify = flag("skip-verify");
  const envFile = arg("env-file") ?? ".env.local";

  console.log(`Loading platform env from ${envFile}${dryRun ? " (dry run)" : ""}...`);
  loadEnvFile(envFile);

  const missing = [
    "TR_INTEGRATION_ENCRYPTION_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error(`Missing in ${envFile}: ${missing.join(", ")}`);
    console.error("Pull them first: vercel env pull .env.production.local --environment=production");
    process.exit(1);
  }

  const apiKey =
    process.env.IYZICO_API_KEY?.trim() || (await promptHidden("iyzico API key: "));
  const secretKey =
    process.env.IYZICO_SECRET_KEY?.trim() || (await promptHidden("iyzico secret key: "));
  if (!apiKey || !secretKey) {
    console.error("Both the API key and the secret key are required.");
    process.exit(1);
  }
  const baseUrl = mode === "sandbox" ? SANDBOX_BASE : LIVE_BASE;

  console.log("Keys received (masked for confirmation only):");
  console.log(`  apiKey:    ${mask(apiKey)}`);
  console.log(`  secretKey: ${mask(secretKey)}`);
  console.log(`  mode:      ${mode} (${baseUrl})`);

  if (skipVerify) {
    console.log("Skipping the iyzico check (--skip-verify).");
  } else {
    const check = await iyzicoCheckCredentials({ apiKey, secretKey, baseUrl });
    if (!check.ok) {
      console.error(`iyzico did not accept these keys: ${check.message}`);
      console.error(
        `Check they are the ${mode} keys (sandbox and live keys differ), or re-run with --skip-verify to write them anyway.`,
      );
      process.exit(1);
    }
    console.log("iyzico accepted the keys.");
  }

  const supabase = getServerServiceSupabase();
  if (!supabase) {
    console.error("Supabase service role is not configured in the env file.");
    process.exit(1);
  }

  const { data: boutique, error: boutiqueError } = await supabase
    .from("tr_boutiques")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (boutiqueError) throw boutiqueError;
  if (!boutique) {
    console.error(`No boutique with slug "${slug}". Create it first (scripts/create-boutique.mts).`);
    process.exit(1);
  }

  const { data: existing } = await supabase
    .from("tr_boutique_integrations")
    .select("id, mode, enabled")
    .eq("boutique_id", boutique.id)
    .eq("provider", "iyzico")
    .maybeSingle();
  if (existing && !replace) {
    console.error(
      `${slug} already has an iyzico row (id ${existing.id}, mode ${existing.mode}, enabled ${existing.enabled}). Re-run with --replace to update its keys.`,
    );
    process.exit(1);
  }

  const credentialsEncrypted = encryptIntegrationCredentials({
    apiKey,
    secretKey,
    baseUrl,
  } satisfies StoredCredentials);
  const roundTrip = decryptIntegrationCredentials<StoredCredentials>(credentialsEncrypted);
  if (roundTrip.apiKey !== apiKey || roundTrip.secretKey !== secretKey) {
    console.error("Encryption round-trip failed — nothing written.");
    process.exit(1);
  }
  console.log("Encryption round-trip passed.");

  if (dryRun) {
    console.log(
      `Dry run — would ${existing ? "update" : "insert"} the iyzico row for ${boutique.name} (${slug}). Re-run without --dry-run to write it.`,
    );
    return;
  }

  const row = {
    boutique_id: boutique.id,
    provider: "iyzico",
    mode,
    enabled: true,
    credentials_encrypted: credentialsEncrypted,
  };
  const { data: written, error: writeError } = existing
    ? await supabase
        .from("tr_boutique_integrations")
        .update(row)
        .eq("id", existing.id)
        .select("id")
        .single()
    : await supabase.from("tr_boutique_integrations").insert(row).select("id").single();
  if (writeError) throw writeError;

  // Read it back the way checkout will, so a silent write problem shows up here.
  const { data: stored } = await supabase
    .from("tr_boutique_integrations")
    .select("credentials_encrypted, enabled")
    .eq("id", written.id)
    .single();
  const readBack = stored?.credentials_encrypted
    ? decryptIntegrationCredentials<StoredCredentials>(stored.credentials_encrypted)
    : null;
  if (!stored?.enabled || readBack?.apiKey !== apiKey) {
    console.error("Wrote the row but could not read the keys back correctly — check it in Supabase.");
    process.exit(1);
  }

  console.log(`${existing ? "Updated" : "Wrote"} the iyzico row ${written.id} for ${boutique.name} (${slug}), mode ${mode}.`);
  console.log("Next: place one real test order (then refund it in the iyzico panel) to confirm the payment form opens and the order is marked paid.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
