import {
  requireOwnedBoutique,
  requireTrOwner,
} from "@/lib/tr/ownerAuth";
import {
  getBoutiqueByIdAdmin,
  updateBoutiqueBrandAdmin,
  type UpdateTrBoutiqueBrandInput,
} from "@/lib/tr/boutiques";
import {
  normalizeContactEmail,
  normalizeKepAddress,
  normalizeMersisNo,
  normalizeVergiDairesi,
} from "@/lib/tr/company";
import { validateShippingSettings } from "@/lib/tr/shipping/settings";
import { readTrackingInput } from "@/lib/tr/tracking/config";
import type { TrBoutique } from "@/types/tr-marketplace";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** What the owner's Ayarlar page sees of a store. */
function settingsPayload(boutique: TrBoutique) {
  return {
    id: boutique.id,
    slug: boutique.slug,
    name: boutique.name,
    legalName: boutique.legalName,
    description: boutique.description,
    logoUrl: boutique.logoUrl,
    whatsappPhone: boutique.whatsappPhone,
    instagramHandle: boutique.instagramHandle,
    shippingNote: boutique.shippingNote,
    exchangePolicy: boutique.exchangePolicy,
    physicalAddress: boutique.physicalAddress,
    themeAccent: boutique.themeAccent,
    vergiNo: boutique.vergiNo,
    vergiDairesi: boutique.vergiDairesi,
    mersisNo: boutique.mersisNo,
    kepAddress: boutique.kepAddress,
    contactEmail: boutique.contactEmail,
    tracking: boutique.tracking,
    iban: boutique.iban,
    shippingFeeKurus: boutique.shippingFeeKurus,
    freeShippingMinItems: boutique.freeShippingMinItems,
    freeShippingMinSubtotalKurus: boutique.freeShippingMinSubtotalKurus,
    status: boutique.status,
  };
}

/**
 * GET /api/tr/owner/boutiques/[id]
 * PATCH /api/tr/owner/boutiques/[id] — brand/contact fields only
 */
export async function GET(request: Request, context: RouteContext) {
  const authResult = await requireTrOwner(request);
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  const owned = requireOwnedBoutique(authResult.auth, id);
  if (!owned) {
    return Response.json({ error: "Butik bulunamadı." }, { status: 404 });
  }

  const boutique = await getBoutiqueByIdAdmin(id);
  if (!boutique) {
    return Response.json({ error: "Butik bulunamadı." }, { status: 404 });
  }

  return Response.json({ boutique: settingsPayload(boutique) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireTrOwner(request);
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  const owned = requireOwnedBoutique(authResult.auth, id);
  if (!owned) {
    return Response.json({ error: "Butik bulunamadı." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const patch: UpdateTrBoutiqueBrandInput = {};
  const stringOrNull = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === "string") return value;
    return undefined;
  };

  const description = stringOrNull(body.description);
  if (description !== undefined) patch.description = description;
  const logoUrl = stringOrNull(body.logoUrl);
  if (logoUrl !== undefined) patch.logoUrl = logoUrl;
  const whatsappPhone = stringOrNull(body.whatsappPhone);
  if (whatsappPhone !== undefined) patch.whatsappPhone = whatsappPhone;
  const instagramHandle = stringOrNull(body.instagramHandle);
  if (instagramHandle !== undefined) patch.instagramHandle = instagramHandle;
  const shippingNote = stringOrNull(body.shippingNote);
  if (shippingNote !== undefined) patch.shippingNote = shippingNote;
  const exchangePolicy = stringOrNull(body.exchangePolicy);
  if (exchangePolicy !== undefined) patch.exchangePolicy = exchangePolicy;
  const physicalAddress = stringOrNull(body.physicalAddress);
  if (physicalAddress !== undefined) patch.physicalAddress = physicalAddress;
  const themeAccent = stringOrNull(body.themeAccent);
  if (themeAccent !== undefined) patch.themeAccent = themeAccent;
  const legalName = stringOrNull(body.legalName);
  if (legalName !== undefined) patch.legalName = legalName;
  const vergiNo = stringOrNull(body.vergiNo);
  if (vergiNo !== undefined) patch.vergiNo = vergiNo;
  const iban = stringOrNull(body.iban);
  if (iban !== undefined) patch.iban = iban;

  // Checked here (not just where they're saved) so a typo answers 400 with a sentence.
  try {
    const contactEmail = stringOrNull(body.contactEmail);
    if (contactEmail !== undefined) {
      patch.contactEmail = normalizeContactEmail(contactEmail);
    }
    const vergiDairesi = stringOrNull(body.vergiDairesi);
    if (vergiDairesi !== undefined) {
      patch.vergiDairesi = normalizeVergiDairesi(vergiDairesi);
    }
    const mersisNo = stringOrNull(body.mersisNo);
    if (mersisNo !== undefined) patch.mersisNo = normalizeMersisNo(mersisNo);
    const kepAddress = stringOrNull(body.kepAddress);
    if (kepAddress !== undefined) patch.kepAddress = normalizeKepAddress(kepAddress);
    if (body.tracking !== undefined) patch.tracking = readTrackingInput(body.tracking);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Geçersiz değer." },
      { status: 400 },
    );
  }

  const shipping = validateShippingSettings({
    shippingFeeKurus: body.shippingFeeKurus,
    freeShippingMinItems: body.freeShippingMinItems,
    freeShippingMinSubtotalKurus: body.freeShippingMinSubtotalKurus,
  });
  if (!shipping.ok) {
    return Response.json({ error: shipping.error }, { status: 400 });
  }
  Object.assign(patch, shipping.value);

  try {
    const boutique = await updateBoutiqueBrandAdmin(id, patch);
    return Response.json({ boutique: settingsPayload(boutique) });
  } catch (error) {
    console.error("[tr/owner/boutiques/[id]] patch failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Butik güncellenemedi.",
      },
      { status: 500 },
    );
  }
}
