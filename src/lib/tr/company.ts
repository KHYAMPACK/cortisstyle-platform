/**
 * Cleaning up the company details a registered seller shows on its künye page. Each
 * takes whatever was typed and returns the stored form (`null` = blank), or throws a
 * sentence for the person typing. Pure.
 */

function text(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
}

/** The tax office, e.g. "Pamukkale". */
export function normalizeVergiDairesi(raw: unknown): string | null {
  const value = text(raw);
  if (!value) return null;
  if (value.length > 80) throw new Error("Vergi dairesi en fazla 80 karakter olabilir.");
  return value;
}

/** The 16-digit MERSİS number; spaces and dashes are ignored. */
export function normalizeMersisNo(raw: unknown): string | null {
  const value = text(raw).replace(/[\s-]/g, "");
  if (!value) return null;
  if (!/^\d{16}$/.test(value)) {
    throw new Error("MERSİS numarası 16 haneli olmalı.");
  }
  return value;
}

/** The KEP (kayıtlı elektronik posta) address. */
export function normalizeKepAddress(raw: unknown): string | null {
  const value = text(raw).toLowerCase();
  if (!value) return null;
  if (value.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("KEP adresi geçerli bir e-posta adresi olmalı.");
  }
  return value;
}

/** The support address shown to shoppers and used as the reply-to of order e-mails. */
export function normalizeContactEmail(raw: unknown): string | null {
  const value = text(raw).toLowerCase();
  if (!value) return null;
  if (value.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("İletişim e-postası geçerli bir e-posta adresi olmalı.");
  }
  return value;
}
