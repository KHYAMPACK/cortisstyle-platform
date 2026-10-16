/**
 * Connecting a store's own iyzico account from its owner panel: check the keys with
 * iyzico, store them encrypted (`tr_boutique_integrations`, the row checkout reads),
 * read back what the panel may show, disconnect. Server only. The keys are never
 * returned, logged or put in an error message.
 */
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from "@/lib/tr/payments/credentialEncryption";
import { iyzicoCheckCredentials } from "@/lib/tr/payments/iyzicoClient";
import {
  IYZICO_BASE_URL,
  lastFour,
  NOT_CONNECTED,
  type IyzicoKeysInput,
  type IyzicoMode,
  type IyzicoStatus,
} from "@/lib/tr/payments/iyzicoKeys";

export class IyzicoConnectionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "IyzicoConnectionError";
  }
}

type StoredCredentials = { apiKey: string; secretKey: string; baseUrl?: string };

/** iyzico's message as a finished sentence. */
function sentence(message: string): string {
  const text = message.trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function client() {
  const supabase = getServiceSupabase();
  if (!supabase) throw new IyzicoConnectionError("Sunucu yapılandırması eksik.", 503);
  return supabase;
}

/** What checkout would use for this store, as far as the panel may tell. */
export async function getIyzicoStatus(boutiqueId: string): Promise<IyzicoStatus> {
  const { data, error } = await client()
    .from("tr_boutique_integrations")
    .select("enabled, mode, credentials_encrypted")
    .eq("boutique_id", boutiqueId)
    .eq("provider", "iyzico")
    .maybeSingle();
  if (error) throw error;
  if (!data?.enabled || !data.credentials_encrypted) return NOT_CONNECTED;

  try {
    const stored = decryptIntegrationCredentials<StoredCredentials>(
      String(data.credentials_encrypted),
    );
    if (!stored.apiKey || !stored.secretKey) return NOT_CONNECTED;
    const mode: IyzicoMode = data.mode === "sandbox" ? "sandbox" : "live";
    return { connected: true, mode, apiKeyLast4: lastFour(stored.apiKey) || null };
  } catch {
    // Not decryptable means checkout cannot use it either: report it as not connected.
    console.error("[iyzico] stored credentials could not be read for", boutiqueId);
    return NOT_CONNECTED;
  }
}

/** Check the keys with iyzico, then store them and switch card payments on. */
export async function connectIyzico(
  boutiqueId: string,
  input: IyzicoKeysInput,
  /** Replaceable so tests need no real iyzico account. */
  checkCredentials: typeof iyzicoCheckCredentials = iyzicoCheckCredentials,
): Promise<IyzicoStatus> {
  const baseUrl = IYZICO_BASE_URL[input.mode];
  const check = await checkCredentials({
    apiKey: input.apiKey,
    secretKey: input.secretKey,
    baseUrl,
  });
  if (!check.ok) {
    throw new IyzicoConnectionError(
      input.mode === "sandbox"
        ? `iyzico deneme anahtarlarını kabul etmedi: ${sentence(check.message)}`
        : `iyzico anahtarları kabul etmedi: ${sentence(check.message)} Canlı (production) anahtarları kullandığınızdan ve eksiksiz kopyaladığınızdan emin olun.`,
      422,
    );
  }

  let encrypted: string;
  try {
    encrypted = encryptIntegrationCredentials({
      apiKey: input.apiKey,
      secretKey: input.secretKey,
      baseUrl,
    } satisfies StoredCredentials);
    const roundTrip = decryptIntegrationCredentials<StoredCredentials>(encrypted);
    if (roundTrip.apiKey !== input.apiKey || roundTrip.secretKey !== input.secretKey) {
      throw new Error("round trip mismatch");
    }
  } catch {
    throw new IyzicoConnectionError("Anahtarlar şifrelenemedi: sunucu yapılandırması eksik.", 500);
  }

  const supabase = client();
  const { data: existing, error: readError } = await supabase
    .from("tr_boutique_integrations")
    .select("id")
    .eq("boutique_id", boutiqueId)
    .eq("provider", "iyzico")
    .maybeSingle();
  if (readError) throw readError;

  // An existing row keeps its other settings (e.g. the buyer-protection badge).
  const { error: writeError } = existing
    ? await supabase
        .from("tr_boutique_integrations")
        .update({ mode: input.mode, enabled: true, credentials_encrypted: encrypted })
        .eq("id", existing.id)
    : await supabase.from("tr_boutique_integrations").insert({
        boutique_id: boutiqueId,
        provider: "iyzico",
        mode: input.mode,
        enabled: true,
        credentials_encrypted: encrypted,
        metadata: {},
      });
  if (writeError) throw writeError;

  const status = await getIyzicoStatus(boutiqueId);
  if (!status.connected) {
    throw new IyzicoConnectionError("Anahtarlar kaydedildi ama okunamadı; lütfen tekrar deneyin.", 500);
  }
  return status;
}

/** Switch card payments off and forget the keys. */
export async function disconnectIyzico(boutiqueId: string): Promise<IyzicoStatus> {
  const { error } = await client()
    .from("tr_boutique_integrations")
    .update({ enabled: false, credentials_encrypted: null })
    .eq("boutique_id", boutiqueId)
    .eq("provider", "iyzico");
  if (error) throw error;
  return NOT_CONNECTED;
}
