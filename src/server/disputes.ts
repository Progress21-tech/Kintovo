export type DisputeState = "OPEN" | "AWAITING_EVIDENCE" | "UNDER_REVIEW" | "AWAITING_RESPONSE" | "RESOLVED" | "ESCALATED" | "CLOSED";

const disputeTransitions: Record<DisputeState, readonly DisputeState[]> = {
  OPEN: ["AWAITING_EVIDENCE", "UNDER_REVIEW", "AWAITING_RESPONSE", "ESCALATED", "RESOLVED", "CLOSED"],
  AWAITING_EVIDENCE: ["UNDER_REVIEW", "AWAITING_RESPONSE", "ESCALATED", "RESOLVED", "CLOSED"],
  UNDER_REVIEW: ["AWAITING_EVIDENCE", "AWAITING_RESPONSE", "ESCALATED", "RESOLVED", "CLOSED"],
  AWAITING_RESPONSE: ["AWAITING_EVIDENCE", "UNDER_REVIEW", "ESCALATED", "RESOLVED", "CLOSED"],
  ESCALATED: ["UNDER_REVIEW", "AWAITING_EVIDENCE", "RESOLVED", "CLOSED"],
  // A resolved dispute can only be formally closed; closed is final.
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

/** Central dispute lifecycle. Reviewers cannot reopen a closed case or skip back from resolution. */
export function canTransitionDispute(from: DisputeState, to: DisputeState) {
  return disputeTransitions[from].includes(to);
}
