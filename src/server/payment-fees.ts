export type PaymentFeeBreakdown = {
  grossAmount: number;
  platformFee: number;
  providerFee: number;
  recipientAmount: number;
  currency: string;
};

export function calculatePaymentFeeBreakdown(input: {
  grossAmount: number;
  currency: string;
  platformFeeBps: number;
  providerFee: number;
  feePayer?: "BUSINESS" | "RECIPIENT";
}): PaymentFeeBreakdown {
  if (!Number.isSafeInteger(input.grossAmount) || input.grossAmount < 0) throw new Error("Gross amount must be a non-negative whole number.");
  if (!Number.isSafeInteger(input.platformFeeBps) || input.platformFeeBps < 0 || input.platformFeeBps > 10_000) throw new Error("Platform fee must be between 0 and 10000 basis points.");
  if (!Number.isSafeInteger(input.providerFee) || input.providerFee < 0) throw new Error("Provider fee must be a non-negative whole number.");
  const platformFee = Math.floor(input.grossAmount * input.platformFeeBps / 10_000);
  const recipientAmount = input.feePayer === "RECIPIENT"
    ? Math.max(0, input.grossAmount - input.providerFee - platformFee)
    : Math.max(0, input.grossAmount - input.providerFee);
  return { grossAmount: input.grossAmount, platformFee, providerFee: input.providerFee, recipientAmount, currency: input.currency };
}
