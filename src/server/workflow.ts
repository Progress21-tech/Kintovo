export type TaskState = "TODO" | "IN_PROGRESS" | "BLOCKED" | "SUBMITTED" | "APPROVED" | "CANCELLED";
export type MilestoneState = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "IN_REVIEW" | "REVISION_REQUESTED" | "APPROVED" | "DISPUTED";

const taskTransitions: Record<TaskState, readonly TaskState[]> = {
  TODO: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "SUBMITTED", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  SUBMITTED: ["APPROVED", "IN_PROGRESS"],
  APPROVED: [],
  CANCELLED: [],
};

const milestoneTransitions: Record<MilestoneState, readonly MilestoneState[]> = {
  NOT_STARTED: ["IN_PROGRESS", "DISPUTED"],
  IN_PROGRESS: ["SUBMITTED", "DISPUTED"],
  SUBMITTED: ["IN_REVIEW", "DISPUTED"],
  IN_REVIEW: ["APPROVED", "REVISION_REQUESTED", "DISPUTED"],
  REVISION_REQUESTED: ["SUBMITTED", "DISPUTED"],
  APPROVED: [],
  DISPUTED: [],
};

export function canTransitionTask(from: TaskState, to: TaskState) { return taskTransitions[from].includes(to); }
export function canTransitionMilestone(from: MilestoneState, to: MilestoneState) { return milestoneTransitions[from].includes(to); }

/**
 * Partial settlement: the buyer may propose settling a submitted, in-review, or
 * disputed milestone for less than the agreed amount. It only takes effect when the
 * assigned professional accepts, and it never exceeds the agreed amount.
 */
export function canProposeSettlement(status: MilestoneState) { return status === "SUBMITTED" || status === "IN_REVIEW" || status === "DISPUTED"; }

export function validateSettlementAmount(amount: number, agreedAmount: number): string | null {
  if (!Number.isSafeInteger(amount) || amount <= 0) return "Enter a whole settlement amount greater than zero.";
  if (amount >= agreedAmount) return "A partial settlement must be less than the agreed milestone amount. Approve the milestone to settle in full.";
  return null;
}

/** A revision request is allowed only while the agreed revision allowance remains. */
export function canRequestRevision(revisionCount: number, revisionAllowance: number) { return revisionCount < revisionAllowance; }
