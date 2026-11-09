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
