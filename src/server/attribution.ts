/**
 * Creator-campaign attribution rules. Last-click attribution only: a conversion is
 * credited to a creator when that creator's tracked link was clicked within the
 * campaign's attribution window before the conversion. Multi-touch attribution is
 * intentionally not offered.
 */

export const compensationModels = ["FIXED", "HYBRID", "COMMISSION_ONLY"] as const;
export type CompensationModel = typeof compensationModels[number];
export const refundTreatments = ["EXCLUDE_REFUNDED", "INCLUDE_REFUNDED"] as const;
export type RefundTreatment = typeof refundTreatments[number];

/** Validates that the fee structure matches the chosen arrangement. */
export function validateCompensation(model: CompensationModel, fixedFee: number, bonusRateBps: number): string | null {
  if (!Number.isSafeInteger(fixedFee) || fixedFee < 0 || !Number.isSafeInteger(bonusRateBps) || bonusRateBps < 0 || bonusRateBps > 10_000) return "Enter whole-number fees and a bonus rate between 0 and 10,000 basis points.";
  if (model === "FIXED" && bonusRateBps !== 0) return "A fixed-fee arrangement has no performance bonus. Choose hybrid to add one.";
  if (model === "FIXED" && fixedFee <= 0) return "Enter the fixed fee for the agreed deliverables.";
  if (model === "HYBRID" && (fixedFee <= 0 || bonusRateBps <= 0)) return "A hybrid arrangement needs both a fixed fee and a bonus rate.";
  if (model === "COMMISSION_ONLY" && (fixedFee !== 0 || bonusRateBps <= 0)) return "Commission-only means no fixed fee and a bonus rate above zero.";
  return null;
}

export type ConversionInput = {
  eventType: "LEAD" | "ORDER";
  occurredAt: Date;
  lastClickAt: Date | null;
  windowDays: number;
  campaignStartsAt: Date | null;
  campaignEndsAt: Date | null;
};

export type ConversionDecision = { eligible: true } | { eligible: false; reason: string };

/** Decides whether an event can be credited. Clicks alone are never conversions. */
export function evaluateConversion(input: ConversionInput): ConversionDecision {
  if (input.campaignStartsAt && input.occurredAt < input.campaignStartsAt) return { eligible: false, reason: "Event occurred before the campaign started." };
  // Allow conversions within the window after the campaign ends, but no later.
  if (input.campaignEndsAt && input.occurredAt.getTime() > input.campaignEndsAt.getTime() + input.windowDays * 86_400_000) return { eligible: false, reason: "Event occurred after the campaign's attribution period." };
  if (!input.lastClickAt) return { eligible: false, reason: "No tracked click from this creator preceded the event." };
  if (input.lastClickAt > input.occurredAt) return { eligible: false, reason: "The only tracked click came after the event." };
  const ageDays = (input.occurredAt.getTime() - input.lastClickAt.getTime()) / 86_400_000;
  if (ageDays > input.windowDays) return { eligible: false, reason: `The last tracked click was ${Math.floor(ageDays)} days earlier, outside the ${input.windowDays}-day attribution window.` };
  return { eligible: true };
}

/** Whether a refunded or cancelled conversion still counts, per the agreed refund treatment. */
export function countsAfterRefund(treatment: RefundTreatment) { return treatment === "INCLUDE_REFUNDED"; }

export type CampaignReportInput = {
  fixedFees: number;
  attributions: { status: string; eventType: string; amount: number; bonusAmount: number; simulated: boolean }[];
  clicks: number;
  approvedContent: number;
  publishedContent: number;
};

/** Transparent campaign totals, computed only from recorded events. */
export function summariseCampaign(input: CampaignReportInput) {
  const orders = input.attributions.filter((item) => item.eventType === "ORDER");
  const eligible = orders.filter((item) => item.status === "APPROVED");
  const earnedBonuses = eligible.reduce((sum, item) => sum + item.bonusAmount, 0);
  return {
    clicks: input.clicks,
    leads: input.attributions.filter((item) => item.eventType === "LEAD" && item.status !== "REJECTED").length,
    pendingConversions: orders.filter((item) => item.status === "PENDING").length,
    eligibleConversions: eligible.length,
    rejectedConversions: orders.filter((item) => item.status === "REJECTED").length,
    refunds: orders.filter((item) => item.status === "REFUNDED").length,
    attributedRevenue: eligible.reduce((sum, item) => sum + item.amount, 0),
    fixedFees: input.fixedFees,
    earnedBonuses,
    expenditure: input.fixedFees + earnedBonuses,
    approvedContent: input.approvedContent,
    publishedContent: input.publishedContent,
    includesSimulatedData: input.attributions.some((item) => item.simulated),
  };
}
