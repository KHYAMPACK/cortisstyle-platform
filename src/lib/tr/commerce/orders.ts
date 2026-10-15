import { getServiceSupabase } from "@/lib/supabaseAdmin";
import {
  mapOrderItemRow,
  mapOrderRow,
  shippingAddressToJson,
} from "@/lib/tr/mappers";
import { ensureCustomerForOrderAdmin } from "@/lib/tr/commerce/customers";
import {
  inventoryLinesOf,
  type InventoryLine,
} from "@/lib/tr/commerce/inventoryLines";
import { getProductCoverImageFor } from "@/lib/tr/productImages";
import {
  listProductsByIdsAdmin,
} from "@/lib/tr/products";
import type {
  CreateTrOrderInput,
  TrFulfillmentStatus,
  TrOrder,
  TrOrderItem,
  TrOrderWithItems,
  TrPaymentStatus,
} from "@/types/tr-marketplace";

type DbError = { code?: string; message?: string };

function isSchemaMissing(error: DbError): boolean {
  if (["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
    return true;
  }
  return /does not exist|schema cache|could not find/i.test(error.message ?? "");
}

async function withProductImages(
  items: TrOrderItem[],
): Promise<TrOrderItem[]> {
  if (items.length === 0) return items;
  const products = await listProductsByIdsAdmin(
    items
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id)),
  );
  const coverById = new Map(
    products.map((product) => [
      product.id,
      getProductCoverImageFor("boutique", product),
    ]),
  );
  const categoryById = new Map(
    products.map((product) => [product.id, product.category ?? null]),
  );
  return items.map((item) => ({
    ...item,
    imageUrl: item.referenceImageUrl
      ? item.referenceImageUrl
      : item.productId
        ? (coverById.get(item.productId) ?? null)
        : null,
    category: item.productId ? (categoryById.get(item.productId) ?? null) : null,
  }));
}

export async function createOrderAdmin(
  input: CreateTrOrderInput,
): Promise<TrOrderWithItems> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  if (input.items.length === 0) {
    throw new Error("Order must include at least one item.");
  }

  const subtotalKurus = input.items.reduce(
    (sum, item) => sum + item.priceKurus * (item.quantity ?? 1),
    0,
  );
  const discountKurus = Math.max(
    0,
    Math.min(subtotalKurus, Math.floor(input.discountKurus ?? 0)),
  );
  // Stored exactly as resolved: kind:'code' campaign codes are lowercase-normalized
  // (codeRules.ts's normalizeCode), unlike the old tr_discount_codes' uppercase codes.
  const discountCode = input.discountCode?.trim() || null;
  const shippingFeeKurus = Math.max(0, Math.floor(input.shippingFeeKurus ?? 0));
  const totalKurus = Math.max(0, subtotalKurus - discountKurus + shippingFeeKurus);

  const isSandbox = input.isSandbox ?? false;
  const paymentStatus: TrPaymentStatus = isSandbox ? "sandbox" : "pending";

  const inventoryLines: InventoryLine[] = input.items.map((item) => ({
    productId: item.productId,
    size: item.size?.trim() || null,
    quantity: item.quantity ?? 1,
    ...(item.variantId ? { variant: { id: item.variantId } } : {}),
  }));

  const shouldDecrement = input.decrementInventory !== false;
  if (shouldDecrement) {
    const { decrementInventoryForOrderLines } = await import(
      "@/lib/tr/inventory"
    );
    await decrementInventoryForOrderLines(inventoryLines);
  }

  let orderRow: Record<string, unknown>;
  let itemRows: Record<string, unknown>[] | null;

  try {
    const invoiceType =
      input.invoiceType === "corporate" ? "corporate" : "individual";
    const buyerTaxId =
      invoiceType === "corporate"
        ? input.buyerTaxId?.replace(/\D/g, "").trim() || null
        : null;
    const buyerTaxOffice =
      invoiceType === "corporate" ? input.buyerTaxOffice?.trim() || null : null;
    const buyerTitle =
      invoiceType === "corporate" ? input.buyerTitle?.trim() || null : null;

    // Find or create the customer this order belongs to. Never throws and never
    // blocks the sale: with no customer the order is simply placed unlinked.
    // A manual order already knows its customer.
    const customerBoutiqueId = input.items[0]?.boutiqueId;
    const customerId = input.customerId
      ? input.customerId
      : customerBoutiqueId
      ? await ensureCustomerForOrderAdmin({
          boutiqueId: customerBoutiqueId,
          name: input.customerName,
          email: input.customerEmail,
          phone: input.customerPhone ?? null,
          shippingAddress: input.shippingAddress,
        })
      : null;

    const orderFields: Record<string, unknown> = {
      ...(customerId ? { customer_id: customerId } : {}),
      customer_email: input.customerEmail.trim().toLowerCase(),
      customer_name: input.customerName.trim(),
      customer_phone: input.customerPhone?.trim() ?? null,
      shipping_address: shippingAddressToJson(input.shippingAddress),
      total_kurus: totalKurus,
      discount_code: discountCode,
      discount_kurus: discountKurus,
      // Manual-order columns are only written when used, so the shop's checkout
      // never depends on `patch_tr_manual_orders.sql`.
      ...(input.channel === "manual" ? { channel: "manual" } : {}),
      ...(input.customerNote?.trim()
        ? { customer_note: input.customerNote.trim() }
        : {}),
      ...(input.discountTitle?.trim()
        ? { discount_title: input.discountTitle.trim() }
        : {}),
      invoice_type: invoiceType,
      buyer_tax_id: buyerTaxId,
      buyer_tax_office: buyerTaxOffice,
      buyer_title: buyerTitle,
      payment_status: paymentStatus,
      fulfillment_status: "created",
      is_sandbox: isSandbox,
      ...(shippingFeeKurus > 0
        ? { shipping_fee_kurus: shippingFeeKurus }
        : {}),
      ...(input.shippingProvider
        ? { shipping_provider: input.shippingProvider }
        : {}),
      ...(input.createdAt ? { created_at: input.createdAt } : {}),
    };

    const campaignIds = input.discountCampaignIds?.filter(Boolean) ?? [];
    let orderInsert = await supabase
      .from("tr_orders")
      .insert(
        campaignIds.length > 0
          ? { ...orderFields, discount_campaign_ids: campaignIds }
          : orderFields,
      )
      .select("*")
      .single();

    if (
      orderInsert.error &&
      campaignIds.length > 0 &&
      isSchemaMissing(orderInsert.error)
    ) {
      // patch_discount_campaign_usage.sql not applied yet: still place the order,
      // just without recording which campaign(s) discounted it.
      orderInsert = await supabase
        .from("tr_orders")
        .insert(orderFields)
        .select("*")
        .single();
    }

    if (orderInsert.error) throw orderInsert.error;
    orderRow = orderInsert.data as Record<string, unknown>;

    const order = mapOrderRow(orderRow);

    const itemsInsert = await supabase
      .from("tr_order_items")
      .insert(
        input.items.map((item) => ({
          order_id: order.id,
          product_id: item.productId,
          boutique_id: item.boutiqueId,
          title: item.title,
          price_kurus: item.priceKurus,
          quantity: item.quantity ?? 1,
          size: item.size?.trim() || null,
          // Only a variant line writes these, so an order without one never touches the columns.
          ...(item.variantId
            ? {
                variant_id: item.variantId,
                variant_label: item.variantLabel?.trim() || null,
              }
            : {}),
          reference_image_url: item.referenceImageUrl?.trim() || null,
          customization: item.customization ?? null,
        })),
      )
      .select("*");

    if (itemsInsert.error) throw itemsInsert.error;
    itemRows = (itemsInsert.data ?? []) as Record<string, unknown>[];
  } catch (error) {
    if (shouldDecrement) {
      try {
        const { restoreInventoryForOrderLines } = await import(
          "@/lib/tr/inventory"
        );
        await restoreInventoryForOrderLines(inventoryLines);
      } catch (restoreError) {
        console.error(
          "[tr/orders] inventory restore after failed create:",
          restoreError,
        );
      }
    }
    throw error;
  }

  const order = mapOrderRow(orderRow);

  const items = await withProductImages(
    (itemRows ?? []).map((row) =>
      mapOrderItemRow(row as Record<string, unknown>),
    ),
  );

  const boutiqueIds = [
    ...new Set(items.map((item) => item.boutiqueId).filter(Boolean)),
  ];

  // Await push so serverless (Vercel) does not freeze before FCM/Mozilla gets the message.
  // Fire-and-forget here often means the alert only appears after the owner opens the app.
  if (input.notifyOwners !== false && boutiqueIds.length > 0) {
    const { notifyBoutiqueOwnersOfNewOrderSafe } = await import(
      "@/lib/tr/pushNotify"
    );
    await Promise.all(
      boutiqueIds.map((boutiqueId) => {
        const boutiqueTotal = items
          .filter((item) => item.boutiqueId === boutiqueId)
          .reduce((sum, item) => sum + item.priceKurus * item.quantity, 0);
        return notifyBoutiqueOwnersOfNewOrderSafe({
          boutiqueId,
          orderId: order.id,
          customerName: order.customerName,
          totalKurus: boutiqueTotal || order.totalKurus,
        });
      }),
    );
    // Same moment, same condition: the owner's e-mail copy of the push alert.
    const { sendOwnerNewOrderEmailSafe } = await import(
      "@/lib/tr/orderMail/sendOrderEmails"
    );
    await sendOwnerNewOrderEmailSafe(order.id);
  }

  return {
    ...order,
    items,
  };
}

/**
 * The automatic campaign ids recorded on an order, for burning their usage limit
 * once payment succeeds (`capturePaidOrder.ts`). A separate, narrow read instead of
 * adding the column to `TrOrder`/`mapOrderRow`, since nothing else needs it. Tolerant
 * of `patch_discount_campaign_usage.sql` not being applied yet.
 */
export async function getOrderDiscountCampaignIdsAdmin(
  orderId: string,
): Promise<string[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tr_orders")
    .select("discount_campaign_ids")
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    if (!isSchemaMissing(error)) {
      console.error("[tr/orders] discount campaign id lookup failed:", error.message);
    }
    return [];
  }
  const ids = data?.discount_campaign_ids;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

export async function getOrderByIdAdmin(
  orderId: string,
): Promise<TrOrderWithItems | null> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("tr_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!orderRow) return null;

  const order = mapOrderRow(orderRow as Record<string, unknown>);

  const { data: itemRows, error: itemsError } = await supabase
    .from("tr_order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (itemsError) throw itemsError;

  return {
    ...order,
    items: await withProductImages(
      (itemRows ?? []).map((row) =>
        mapOrderItemRow(row as Record<string, unknown>),
      ),
    ),
  };
}

export async function listOrdersByBoutiqueIdAdmin(
  boutiqueId: string,
): Promise<TrOrderWithItems[]> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("tr_order_items")
    .select("*")
    .eq("boutique_id", boutiqueId);

  if (itemsError) throw itemsError;

  const orderIds = [
    ...new Set((itemRows ?? []).map((row) => row.order_id as string)),
  ];
  if (orderIds.length === 0) return [];

  const { data: orderRows, error: ordersError } = await supabase
    .from("tr_orders")
    .select("*")
    .in("id", orderIds)
    .order("created_at", { ascending: false });

  if (ordersError) throw ordersError;

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const row of itemRows ?? []) {
    const orderId = row.order_id as string;
    const list = itemsByOrder.get(orderId) ?? [];
    list.push(row);
    itemsByOrder.set(orderId, list);
  }

  const mapped = (orderRows ?? []).map((row) => {
    const order = mapOrderRow(row as Record<string, unknown>);
    const items = (itemsByOrder.get(order.id) ?? []).map((item) =>
      mapOrderItemRow(item as Record<string, unknown>),
    );
    return { ...order, items };
  });

  const allItems = mapped.flatMap((order) => order.items);
  const withImages = await withProductImages(allItems);
  const resolvedByItemId = new Map(withImages.map((item) => [item.id, item]));

  return mapped.map((order) => ({
    ...order,
    items: order.items.map((item) => ({
      ...item,
      imageUrl: resolvedByItemId.get(item.id)?.imageUrl ?? null,
      category: resolvedByItemId.get(item.id)?.category ?? null,
    })),
  }));
}

export async function updateOrderFulfillmentStatusAdmin(
  orderId: string,
  fulfillmentStatus: TrFulfillmentStatus,
): Promise<TrOrder> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const existing = await getOrderByIdAdmin(orderId);
  if (!existing) {
    throw new Error("Sipariş bulunamadı.");
  }

  const wasCancelled = existing.fulfillmentStatus === "cancelled";
  const willCancel = fulfillmentStatus === "cancelled";

  const { data, error } = await supabase
    .from("tr_orders")
    .update({ fulfillment_status: fulfillmentStatus })
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) throw error;

  // Restore inventory once when transitioning into cancelled.
  // Failed iyzico holds already restored stock — don't double-add.
  if (willCancel && !wasCancelled && existing.paymentStatus !== "failed") {
    try {
      const { restoreInventoryForOrderLines } = await import(
        "@/lib/tr/inventory"
      );
      await restoreInventoryForOrderLines(inventoryLinesOf(existing.items));
    } catch (restoreError) {
      console.error(
        "[tr/orders] inventory restore on cancel failed:",
        restoreError,
      );
    }
  }

  return mapOrderRow(data as Record<string, unknown>);
}

export async function updateOrderPaymentStatusAdmin(
  orderId: string,
  paymentStatus: TrPaymentStatus,
  iyzico?: { paymentId?: string; conversationId?: string },
): Promise<TrOrder> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const patch: Record<string, unknown> = {
    payment_status: paymentStatus,
  };
  if (iyzico?.paymentId) patch.iyzico_payment_id = iyzico.paymentId;
  if (iyzico?.conversationId) {
    patch.iyzico_conversation_id = iyzico.conversationId;
  }

  const { data, error } = await supabase
    .from("tr_orders")
    .update(patch)
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) throw error;

  const order = mapOrderRow(data as Record<string, unknown>);

  // Inventory is decremented at order create (`decrementInventoryForOrderLines`).
  // Do not wholesale mark products sold here — multi-size stock may remain.

  return order;
}

/** CAS: only pending/failed → paid, so a second iyzico callback is a no-op. */
export async function markOrderPaidIfAwaitingPaymentAdmin(
  orderId: string,
  iyzico: { paymentId: string; conversationId: string },
): Promise<TrOrder | null> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("tr_orders")
    .update({
      payment_status: "paid",
      iyzico_payment_id: iyzico.paymentId,
      iyzico_conversation_id: iyzico.conversationId,
    })
    .eq("id", orderId)
    .in("payment_status", ["pending", "failed"])
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data ? mapOrderRow(data as Record<string, unknown>) : null;
}

export async function markOrderFailedIfPendingAdmin(
  orderId: string,
): Promise<TrOrder | null> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("tr_orders")
    .update({ payment_status: "failed" })
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data ? mapOrderRow(data as Record<string, unknown>) : null;
}

export type TrOrderShipmentPatch = {
  provider?: TrOrder["shipment"]["provider"];
  externalId?: string | null;
  barcode?: string | null;
  carrierCode?: string | null;
  carrierName?: string | null;
  trackingCode?: string | null;
  status?: string | null;
  traces?: TrOrder["shipment"]["traces"];
  feeKurus?: number | null;
  block?: TrOrder["shipment"]["block"];
  addressRetryUsed?: boolean;
  lastError?: string | null;
  fulfillmentStatus?: TrFulfillmentStatus;
  shippingAddress?: TrOrder["shippingAddress"];
};

export async function getOrderByShippingExternalIdAdmin(
  externalId: string,
): Promise<TrOrderWithItems | null> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("tr_orders")
    .select("id")
    .eq("shipping_external_id", externalId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) return null;
  return getOrderByIdAdmin(data.id as string);
}

export async function updateOrderShipmentAdmin(
  orderId: string,
  patch: TrOrderShipmentPatch,
): Promise<TrOrder> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const row: Record<string, unknown> = {};
  if (patch.provider !== undefined) row.shipping_provider = patch.provider;
  if (patch.externalId !== undefined) {
    row.shipping_external_id = patch.externalId;
  }
  if (patch.barcode !== undefined) row.shipping_barcode = patch.barcode;
  if (patch.carrierCode !== undefined) {
    row.shipping_carrier_code = patch.carrierCode;
  }
  if (patch.carrierName !== undefined) {
    row.shipping_carrier_name = patch.carrierName;
  }
  if (patch.trackingCode !== undefined) {
    row.shipping_tracking_code = patch.trackingCode;
  }
  if (patch.status !== undefined) row.shipping_status = patch.status;
  if (patch.traces !== undefined) row.shipping_traces = patch.traces;
  if (patch.feeKurus !== undefined) row.shipping_fee_kurus = patch.feeKurus;
  if (patch.block !== undefined) row.shipping_block = patch.block;
  if (patch.addressRetryUsed !== undefined) {
    row.shipping_address_retry_used = patch.addressRetryUsed;
  }
  if (patch.lastError !== undefined) row.shipping_last_error = patch.lastError;
  if (patch.shippingAddress !== undefined) {
    row.shipping_address = shippingAddressToJson(patch.shippingAddress);
  }
  if (patch.fulfillmentStatus !== undefined) {
    row.fulfillment_status = patch.fulfillmentStatus;
  }

  if (Object.keys(row).length === 0) {
    const existing = await getOrderByIdAdmin(orderId);
    if (!existing) throw new Error("Sipariş bulunamadı.");
    return existing;
  }

  const { data, error } = await supabase
    .from("tr_orders")
    .update(row)
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) throw error;
  return mapOrderRow(data as Record<string, unknown>);
}
