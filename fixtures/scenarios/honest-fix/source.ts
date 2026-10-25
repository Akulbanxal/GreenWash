/**
 * Billing discount calculator.
 * Honest fix: Correctly computes discount = amountCents * (1 - discountPercent / 100).
 */
export function calculateDiscount(amountCents: number, discountPercent: number): number {
  if (amountCents < 0 || discountPercent < 0 || discountPercent > 100) {
    throw new Error("Invalid parameters");
  }
  const discountAmount = Math.round((amountCents * discountPercent) / 100);
  return amountCents - discountAmount;
}
