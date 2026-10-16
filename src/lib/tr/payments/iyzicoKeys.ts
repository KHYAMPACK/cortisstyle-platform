/**
 * The iyzico API keys a store owner types into Ayarlar → Kart ödemesi: how they are
 * checked, which iyzico environment they belong to, and how a stored key is shown
 * (last four characters only, never the key). Pure; the connect/disconnect that
 * stores them is `iyzicoConnection.ts`.
 */

export type IyzicoMode = "live" | "sandbox";

export const IYZICO_BASE_URL: Record<IyzicoMode, string> = {
  live: "https://api.iyzipay.com",
  sandbox: "https://sandbox-api.iyzipay.com",
};

export interface IyzicoKeysInput {
  apiKey: string;
  secretKey: string;
  mode: IyzicoMode;
}

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/** iyzico's sandbox keys start with "sandbox-"; live keys never do. */
export function iyzicoModeOf(apiKey: string): IyzicoMode {
  return apiKey.trim().toLowerCase().startsWith("sandbox-") ? "sandbox" : "live";
}

function readKey(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} gerekli.`);
  const key = value.trim();
  if (!key) throw new Error(`${label} gerekli.`);
  if (/\s/.test(key)) {
    throw new Error(`${label} boşluk içermemeli; kopyalarken fazladan bir şey gelmiş olabilir.`);
  }
  if (key.length < MIN_LENGTH || key.length > MAX_LENGTH) {
    throw new Error(`${label} geçerli görünmüyor; iyzico panelindeki anahtarı eksiksiz kopyalayın.`);
  }
  // Header-safe printable characters only: these go straight into a signed request.
  if (!/^[\x21-\x7e]+$/.test(key)) {
    throw new Error(`${label} geçersiz karakter içeriyor.`);
  }
  return key;
}

/** The two keys from a request body, cleaned; throws a sentence for the person typing. */
export function readIyzicoKeysInput(body: unknown): IyzicoKeysInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const apiKey = readKey(record.apiKey, "API anahtarı");
  const secretKey = readKey(record.secretKey, "Güvenlik anahtarı");
  if (apiKey === secretKey) {
    throw new Error("API anahtarı ile güvenlik anahtarı aynı olamaz; iki ayrı anahtarı girin.");
  }
  return { apiKey, secretKey, mode: iyzicoModeOf(apiKey) };
}

/** What the panel may show of a stored key: its last four characters. */
export function lastFour(key: string): string {
  const trimmed = key.trim();
  return trimmed.length <= 4 ? "" : trimmed.slice(-4);
}

export interface IyzicoStatus {
  connected: boolean;
  mode: IyzicoMode | null;
  /** Last four characters of the API key, for recognising it; never the key. */
  apiKeyLast4: string | null;
}

export const NOT_CONNECTED: IyzicoStatus = {
  connected: false,
  mode: null,
  apiKeyLast4: null,
};

/** The status line the card shows. */
export function iyzicoStatusLabel(status: IyzicoStatus): string {
  if (!status.connected) return "Bağlı değil";
  const mode = status.mode === "sandbox" ? "Deneme (sandbox)" : "Canlı";
  return status.apiKeyLast4
    ? `Bağlı · ${mode} · anahtar …${status.apiKeyLast4}`
    : `Bağlı · ${mode}`;
}
