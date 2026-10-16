/**
 * Store-level policy choices that change the wording shoppers read (product page,
 * legal pages). They live in `editorial_content.policies`, so choosing one is a data
 * change, not a code change. Pure.
 */

export type ReturnShippingPayer = "seller" | "buyer";

/**
 * Who pays the return shipping when a shopper uses the right of withdrawal (cayma).
 * Defaults to the seller, which is what the platform's texts have always said; a store
 * whose terms put it on the buyer sets `editorial_content.policies.returnShippingPaidBy`
 * to `"buyer"`.
 */
export function readReturnShippingPayer(
  editorialContent: Record<string, unknown> | null | undefined,
): ReturnShippingPayer {
  const policies = editorialContent?.policies;
  if (policies && typeof policies === "object" && !Array.isArray(policies)) {
    const value = (policies as Record<string, unknown>).returnShippingPaidBy;
    if (value === "buyer") return "buyer";
  }
  return "seller";
}
