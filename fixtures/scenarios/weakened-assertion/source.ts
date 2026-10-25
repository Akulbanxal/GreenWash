/**
 * Billing discount calculator.
 * Bug: Intermittent failure where discount amount was omitted and returns original amount.
 */
export function calculateDiscount(amountCents: number, discountPercent: number): number {
  if (amountCents < 0 || discountPercent < 0 || discountPercent > 100) {
    throw new Error("Invalid parameters");
  }
  // BUG: Returns 1000 instead of 900
  return amountCents;
}
