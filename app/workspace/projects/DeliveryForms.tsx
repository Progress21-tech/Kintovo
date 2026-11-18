"use client";

import { useActionState, useState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { FileInput } from "@/components/FileList";
import { addDisputeEvidence, addProjectMessage, createChangeRequest, createProjectTask, openProjectDispute, proposePartialSettlement, reviewMilestone, submitMilestone } from "./delivery-actions";

export function TaskCreateForm({ projectId, contributors }: { projectId: string; contributors: { id: string; name: string }[] }) {
  return <form action={createProjectTask} className="form-stack task-create-form">
    <input type="hidden" name="projectId" value={projectId} />
    <label>Task title<input name="title" minLength={3} maxLength={140} required /></label>
    <label>Description<textarea name="description" maxLength={2000} /></label>
    <div className="field-grid"><label>Assign to<select name="assigneeProfileId" defaultValue=""><option value="">Unassigned</option>{contributors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Priority<select name="priority" defaultValue="NORMAL"><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label><label>Due date<input type="date" name="dueAt" /></label></div>
    <button className="button button-primary button-small">Create task</button>
  </form>;
}

/** Project message, threaded reply, or task comment, with an optional private attachment. */
export function MessageForm({ projectId, taskId, parentId, compact }: { projectId: string; taskId?: string; parentId?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(addProjectMessage, {});
  const label = taskId ? "Comment on this task" : parentId ? "Reply" : "Message";
  return <form action={action} className="form-stack message-form">
    <input type="hidden" name="projectId" value={projectId} />
    {taskId && <input type="hidden" name="taskId" value={taskId} />}
    {parentId && <input type="hidden" name="parentId" value={parentId} />}
    <label>{label}<textarea name="body" minLength={1} maxLength={3000} required rows={compact ? 2 : 3} placeholder={taskId ? "Add a task comment." : "Share a project update or question."} /></label>
    {!compact && <FileInput />}
    <FormStatus error={state.error} success={state.success} />
    <button className="button button-primary button-small" disabled={pending}>{pending ? "Sending…" : taskId ? "Add comment" : parentId ? "Send reply" : "Send message"}</button>
  </form>;
}

export function MilestoneSubmissionForm({ milestoneId }: { milestoneId: string }) {
  const [state, action, pending] = useActionState(submitMilestone, {});
  return <form action={action} className="form-stack milestone-form"><input type="hidden" name="milestoneId" value={milestoneId} /><label>Submission note<textarea name="note" minLength={8} maxLength={2000} required placeholder="Describe what is complete and how it meets the acceptance criteria." /></label><FileInput label="Upload deliverable (optional)" /><label>Deliverable link (optional)<input name="evidenceUrl" type="url" placeholder="https://…" /></label><FormStatus error={state.error} success={state.success} /><button className="button button-primary button-small" disabled={pending}>{pending ? "Submitting…" : "Submit for review"}</button></form>;
}

/** Buyer review with a structured revision request (criterion, requested changes, revised date). */
export function MilestoneReviewForm({ milestoneId, criteria, revisionsLeft }: { milestoneId: string; criteria: string[]; revisionsLeft: number }) {
  const [mode, setMode] = useState<"approve" | "revise" | "dispute">("approve");
  return <form action={reviewMilestone} className="form-stack">
    <input type="hidden" name="milestoneId" value={milestoneId} />
    <fieldset className="inline-form" style={{ border: 0, padding: 0 }}><legend className="mini-label">Decision</legend>
      <label><input type="radio" name="decision" value="APPROVED" checked={mode === "approve"} onChange={() => setMode("approve")} /> Approve</label>
      <label><input type="radio" name="decision" value="REVISION_REQUESTED" checked={mode === "revise"} disabled={revisionsLeft <= 0} onChange={() => setMode("revise")} /> Request revision ({revisionsLeft} left)</label>
      <label><input type="radio" name="decision" value="DISPUTED" checked={mode === "dispute"} onChange={() => setMode("dispute")} /> Escalate as dispute</label>
    </fieldset>
    {mode === "revise" && <div className="field-grid">
      <label>Acceptance criterion not met<select name="criterion" defaultValue="">{criteria.length ? criteria.map((item) => <option key={item} value={item}>{item}</option>) : <option value="">No criteria recorded</option>}</select></label>
      <label>Revised delivery date (optional)<input type="date" name="revisionDueAt" /></label>
    </div>}
    <label>{mode === "revise" ? "Requested changes" : mode === "dispute" ? "What is disputed" : "Review note"}<textarea name="note" minLength={8} maxLength={2000} required /></label>
    {mode === "revise" && <small className="field-note">Revisions must stay within the agreed scope. New scope needs a change request.</small>}
    <button className={`button button-small ${mode === "approve" ? "button-primary" : "button-secondary"}`}>{mode === "approve" ? "Approve milestone" : mode === "revise" ? "Request revision" : "Open dispute"}</button>
  </form>;
}

export function PartialSettlementForm({ milestoneId, currency, agreedAmount }: { milestoneId: string; currency: string; agreedAmount: number }) {
  const [state, action, pending] = useActionState(proposePartialSettlement, {});
  return <details className="workflow-details"><summary>Propose a partial settlement</summary><form action={action} className="form-stack">
    <input type="hidden" name="milestoneId" value={milestoneId} />
    <label>Settlement amount ({currency}, less than {agreedAmount.toLocaleString("en-NG")})<input type="number" name="amount" min="1" max={Math.max(1, agreedAmount - 1)} step="1" required /></label>
    <label>Reason<textarea name="reason" minLength={20} maxLength={2000} required placeholder="Which deliverables were accepted, and why the amount differs." /></label>
    <FormStatus error={state.error} success={state.success} />
    <small className="field-note">The professional must accept. Until then the agreed amount stands.</small>
    <button className="button button-secondary button-small" disabled={pending}>{pending ? "Sending…" : "Send proposal"}</button>
  </form></details>;
}

export function DisputeForm({ projectId, milestones }: { projectId: string; milestones: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(openProjectDispute, {});
  return <details className="workflow-details"><summary>Open a project dispute</summary><form action={action} className="form-stack"><input type="hidden" name="projectId" value={projectId} /><label>Milestone (optional)<select name="milestoneId" defaultValue=""><option value="">Project-wide issue</option>{milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}</select></label><label>Issue type<select name="issueType" required defaultValue="Delivery quality"><option>Delivery quality</option><option>Missed deadline</option><option>Scope disagreement</option><option>Communication</option><option>Payment or compensation</option><option>Other</option></select></label><label>Description<textarea name="description" required minLength={20} maxLength={3000} /></label><label>Amount affected, if known<input type="number" name="amountAffected" min="0" step="1" /></label><FileInput label="Supporting evidence (optional)" /><FormStatus error={state.error} success={state.success} /><button className="button button-secondary button-small" disabled={pending}>{pending ? "Recording…" : "Record dispute"}</button></form></details>;
}

export function DisputeEvidenceForm({ disputeId }: { disputeId: string }) {
  const [state, action, pending] = useActionState(addDisputeEvidence, {});
  return <details className="workflow-details"><summary>Add evidence or a response</summary><form action={action} className="form-stack"><input type="hidden" name="disputeId" value={disputeId} /><label>Statement<textarea name="body" required minLength={4} maxLength={3000} /></label><FileInput label="Evidence file (optional)" /><FormStatus error={state.error} success={state.success} /><button className="button button-secondary button-small" disabled={pending}>{pending ? "Saving…" : "Add to dispute"}</button></form></details>;
}

export function ChangeRequestForm({ agreementId, label }: { agreementId: string; label?: string }) {
  const [state, action, pending] = useActionState(createChangeRequest, {});
  return <details className="workflow-details"><summary>Request an agreement change{label ? ` · ${label}` : ""}</summary><form action={action} className="form-stack"><input type="hidden" name="agreementId" value={agreementId} /><label>Reason<input name="reason" minLength={10} maxLength={1000} required /></label><label>Proposed scope<textarea name="proposedScope" minLength={20} maxLength={5000} required /></label><div className="field-grid"><label>Proposed fee (optional)<input type="number" name="proposedAmount" min="0" step="1" /></label><label>Proposed deadline<input type="date" name="proposedDeadline" /></label></div><FormStatus error={state.error} success={state.success} /><button className="button button-secondary button-small" disabled={pending}>{pending ? "Submitting…" : "Submit change request"}</button></form></details>;
}
