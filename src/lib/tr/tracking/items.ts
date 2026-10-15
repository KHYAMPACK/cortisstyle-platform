import { kurusToTry, type TrackedItem } from "./events";

/** How a cart line or order line reads in an ad tool's report. */
function variantOf(line: { variantLabel?: string | null; size?: string | null }): string | null {
  return line.variantLabel?.trim() || line.size?.trim() || null;
}

/** A cart row (always one unit). */
export function cartLineToTrackedItem(line: {
  productId: string;
  title: string;
  priceKurus: number;
  size?: string | null;
  variantLabel?: string | null;
}): TrackedItem {
  return {
    id: line.productId,
    name: line.title,
    priceTry: kurusToTry(line.priceKurus),
    quantity: 1,
    variant: variantOf(line),
  };
}

/** A placed order's line. A product deleted since the order falls back to the line id. */
export function orderItemToTrackedItem(line: {
  id: string;
  productId: string | null;
  title: string;
  priceKurus: number;
  quantity: number;
  size?: string | null;
  variantLabel?: string | null;
}): TrackedItem {
  return {
    id: line.productId ?? line.id,
    name: line.title,
    priceTry: kurusToTry(line.priceKurus),
    quantity: Math.max(1, line.quantity),
    variant: variantOf(line),
  };
}
