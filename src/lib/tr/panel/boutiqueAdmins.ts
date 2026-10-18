/**
 * Extra panel admins for a store, matched by confirmed e-mail
 * (`tr_boutique_admins`, `supabase/patch_tr_boutique_admins.sql`). The owner login is
 * still `tr_boutiques.owner_user_id`; this adds people with the same panel access to
 * that one store. Server only, except the pure helpers.
 */
import type { User } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

/** A cleaned, lower-case address, or null when it does not look like one. */
export function normalizeAdminEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/**
 * The address a signed-in user may be matched on: only an address the person has
 * confirmed (an unconfirmed sign-up with someone else's address must not get access).
 */
export function confirmedEmailOf(
  user: Pick<User, "email" | "email_confirmed_at">,
): string | null {
  if (!user.email_confirmed_at) return null;
  return normalizeAdminEmail(user.email);
}

/** The table is not there yet (patch not applied): treated as "no admins". */
function isTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    text.includes("could not find the table") ||
    text.includes("does not exist")
  );
}

/** Ids of the stores this confirmed address is an admin of. */
export async function listBoutiqueIdsAdministeredBy(email: string): Promise<string[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tr_boutique_admins")
    .select("boutique_id")
    .eq("email", email);
  if (error) {
    if (isTableMissing(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => String(row.boutique_id));
}

/** The admin addresses of one store. */
export async function listBoutiqueAdminEmails(boutiqueId: string): Promise<string[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tr_boutique_admins")
    .select("email")
    .eq("boutique_id", boutiqueId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isTableMissing(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => String(row.email));
}

export async function addBoutiqueAdmin(boutiqueId: string, email: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase service role is not configured.");
  const { error } = await supabase
    .from("tr_boutique_admins")
    .upsert({ boutique_id: boutiqueId, email }, { onConflict: "boutique_id,email" });
  if (error) throw error;
}

export async function removeBoutiqueAdmin(boutiqueId: string, email: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase service role is not configured.");
  const { error } = await supabase
    .from("tr_boutique_admins")
    .delete()
    .eq("boutique_id", boutiqueId)
    .eq("email", email);
  if (error) throw error;
}

/** True when the table exists (the patch has been applied). */
export async function boutiqueAdminsTableExists(): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("tr_boutique_admins").select("id").limit(1);
  return !isTableMissing(error);
}
