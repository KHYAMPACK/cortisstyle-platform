import { requireOwnedBoutique, requireTrOwner } from "@/lib/tr/ownerAuth";
import {
  connectIyzico,
  disconnectIyzico,
  getIyzicoStatus,
  IyzicoConnectionError,
} from "@/lib/tr/payments/iyzicoConnection";
import { readIyzicoKeysInput } from "@/lib/tr/payments/iyzicoKeys";
import { consumeRateLimit } from "@/lib/tr/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Keys travel in these requests: nothing here may be cached or echoed. */
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

async function authorize(request: Request, context: RouteContext) {
  const authResult = await requireTrOwner(request);
  if (!authResult.ok) return { response: authResult.response } as const;
  const { id } = await context.params;
  if (!requireOwnedBoutique(authResult.auth, id)) {
    return { response: json({ error: "Butik bulunamadı." }, 404) } as const;
  }
  return { id, userId: authResult.auth.user.id } as const;
}

/** GET: whether card payments are connected, and which key (last four characters). */
export async function GET(request: Request, context: RouteContext) {
  const access = await authorize(request, context);
  if ("response" in access) return access.response;
  try {
    return json({ status: await getIyzicoStatus(access.id) });
  } catch (error) {
    console.error("[tr/owner/iyzico] status failed:", error instanceof Error ? error.message : "error");
    return json({ error: "Durum okunamadı." }, 500);
  }
}

/** PUT { apiKey, secretKey }: check the keys with iyzico, store them encrypted. */
export async function PUT(request: Request, context: RouteContext) {
  const access = await authorize(request, context);
  if ("response" in access) return access.response;

  const limited = consumeRateLimit({
    key: `iyzico-connect:${access.id}:${access.userId}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return json(
      { error: `Çok fazla deneme yaptınız. ${limited.retryAfterSec} saniye sonra tekrar deneyin.` },
      429,
    );
  }

  let keys;
  try {
    keys = readIyzicoKeysInput(await request.json());
  } catch (error) {
    // A parse error or a validation sentence; neither contains the keys.
    return json({ error: error instanceof Error && error.name !== "SyntaxError" ? error.message : "Geçersiz istek." }, 400);
  }

  try {
    return json({ status: await connectIyzico(access.id, keys) });
  } catch (error) {
    if (error instanceof IyzicoConnectionError) return json({ error: error.message }, error.status);
    console.error("[tr/owner/iyzico] connect failed:", error instanceof Error ? error.message : "error");
    return json({ error: "iyzico bağlanamadı. Lütfen tekrar deneyin." }, 500);
  }
}

/** DELETE: switch card payments off and forget the keys. */
export async function DELETE(request: Request, context: RouteContext) {
  const access = await authorize(request, context);
  if ("response" in access) return access.response;
  try {
    return json({ status: await disconnectIyzico(access.id) });
  } catch (error) {
    console.error("[tr/owner/iyzico] disconnect failed:", error instanceof Error ? error.message : "error");
    return json({ error: "Bağlantı kaldırılamadı." }, 500);
  }
}
