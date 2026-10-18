import { createClient, type User } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { mapBoutiqueRow } from "@/lib/tr/mappers";
import {
  confirmedEmailOf,
  listBoutiqueIdsAdministeredBy,
} from "@/lib/tr/panel/boutiqueAdmins";
import type { TrBoutique } from "@/types/tr-marketplace";

export interface TrOwnerAuthContext {
  user: User;
  accessToken: string;
  boutiques: TrBoutique[];
  /** True when the session email is in TR_PANEL_STAFF_EMAILS (all-tenant access). */
  isStaff: boolean;
}

function normalizeEmail(email: string | undefined | null): string {
  return (email ?? "").trim().toLowerCase();
}

/** Platform operators who may open every boutique in /tr/panel. Server-only. */
export function isTrPanelStaffEmail(email: string | undefined | null): boolean {
  const needle = normalizeEmail(email);
  if (!needle) return false;
  const raw = process.env.TR_PANEL_STAFF_EMAILS?.trim() ?? "";
  if (!raw) return false;
  const allowed = raw
    .split(/[,;\s]+/)
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
  return allowed.includes(needle);
}

function isConfirmedStaffUser(user: User): boolean {
  if (!user.email_confirmed_at) return false;
  return isTrPanelStaffEmail(user.email);
}

function parseBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function listBoutiquesOwnedByUser(
  userId: string,
): Promise<TrBoutique[]> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("tr_boutiques")
    .select("*")
    .eq("owner_user_id", userId)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => mapBoutiqueRow(row as Record<string, unknown>));
}

/**
 * The stores a signed-in user may open: the ones they own, plus the ones whose admin
 * list (`tr_boutique_admins`) has their confirmed e-mail address.
 */
export async function listBoutiquesForUser(user: User): Promise<TrBoutique[]> {
  const owned = await listBoutiquesOwnedByUser(user.id);
  const email = confirmedEmailOf(user);
  if (!email) return owned;

  const adminIds = (await listBoutiqueIdsAdministeredBy(email)).filter(
    (id) => !owned.some((boutique) => boutique.id === id),
  );
  if (adminIds.length === 0) return owned;

  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }
  const { data, error } = await supabase
    .from("tr_boutiques")
    .select("*")
    .in("id", adminIds);
  if (error) throw error;

  const administered = (data ?? []).map((row) =>
    mapBoutiqueRow(row as Record<string, unknown>),
  );
  return [...owned, ...administered].sort((a, b) =>
    a.name.localeCompare(b.name, "tr"),
  );
}

export async function listAllBoutiques(): Promise<TrBoutique[]> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("tr_boutiques")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => mapBoutiqueRow(row as Record<string, unknown>));
}

export async function requireTrOwner(
  request: Request,
): Promise<
  | { ok: true; auth: TrOwnerAuthContext }
  | { ok: false; response: Response }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      ok: false,
      response: Response.json(
        { error: "Supabase sunucuda yapılandırılmamış." },
        { status: 503 },
      ),
    };
  }

  const accessToken = parseBearerToken(request);
  if (!accessToken) {
    return {
      ok: false,
      response: Response.json({ error: "Oturum gerekli." }, { status: 401 }),
    };
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return {
      ok: false,
      response: Response.json({ error: "Oturum geçersiz." }, { status: 401 }),
    };
  }

  try {
    const isStaff = isConfirmedStaffUser(user);
    const boutiques = isStaff
      ? await listAllBoutiques()
      : await listBoutiquesForUser(user);

    return {
      ok: true,
      auth: { user, accessToken, boutiques, isStaff },
    };
  } catch (listError) {
    console.error("[tr/ownerAuth] boutique list failed:", listError);
    return {
      ok: false,
      response: Response.json(
        { error: "Butik bilgileri yüklenemedi." },
        { status: 500 },
      ),
    };
  }
}

export function requireOwnedBoutique(
  auth: TrOwnerAuthContext,
  boutiqueId: string,
): TrBoutique | null {
  return auth.boutiques.find((boutique) => boutique.id === boutiqueId) ?? null;
}

export async function requireOwnedProductBoutique(
  auth: TrOwnerAuthContext,
  productId: string,
): Promise<{ boutique: TrBoutique; productBoutiqueId: string } | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("tr_products")
    .select("id, boutique_id")
    .eq("id", productId)
    .maybeSingle();

  if (error || !data) return null;

  const boutiqueId = data.boutique_id as string;
  const boutique = requireOwnedBoutique(auth, boutiqueId);
  if (!boutique) return null;

  return { boutique, productBoutiqueId: boutiqueId };
}
