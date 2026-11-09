"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { addProjectMessage, createChangeRequest, createProjectTask, openProjectDispute, submitMilestone } from "./delivery-actions";

export function TaskCreateForm({ projectId, contributors }: { projectId: string; contributors: { id: string; name: string }[] }) {
  return <form action={createProjectTask} className="form-stack task-create-form">
    <input type="hidden" name="projectId" value={projectId} />
    <label>Task title<input name="title" minLength={3} maxLength={140} required /></label>
    <label>Description<textarea name="description" maxLength={2000} /></label>
    <div className="field-grid"><label>Assign to<select name="assigneeProfileId" defaultValue=""><option value="">Unassigned</option>{contributors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Priority<select name="priority" defaultValue="NORMAL"><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label><label>Due date<input type="date" name="dueAt" /></label></div>
    <button className="button button-primary button-small">Create task</button>
  </form>;
}

export function MessageForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(addProjectMessage, {});
  return <form action={action} className="form-stack message-form"><input type="hidden" name="projectId" value={projectId} /><label>Message<textarea name="body" minLength={1} maxLength={3000} required placeholder="Share a project update or question." /></label><FormStatus error={state.error} success={state.success} /><button className="button button-primary button-small" disabled={pending}>{pending ? "Sending…" : "Send message"}</button></form>;
}

export function MilestoneSubmissionForm({ milestoneId }: { milestoneId: string }) {
  const [state, action, pending] = useActionState(submitMilestone, {});
  return <form action={action} className="form-stack milestone-form"><input type="hidden" name="milestoneId" value={milestoneId} /><label>Submission note<textarea name="note" minLength={8} maxLength={2000} required placeholder="Describe what is complete and how it meets the acceptance criteria." /></label><label>Deliverable link (optional)<input name="evidenceUrl" type="url" placeholder="https://…" /></label><FormStatus error={state.error} success={state.success} /><button className="button button-primary button-small" disabled={pending}>{pending ? "Submitting…" : "Submit for review"}</button><small className="field-note">Private file uploads are not configured. Use only a link whose access you control, or describe the deliverable in your note.</small></form>;
}

export function DisputeForm({ projectId, milestones }: { projectId: string; milestones: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(openProjectDispute, {});
  return <details className="workflow-details"><summary>Open a project dispute</summary><form action={action} className="form-stack"><input type="hidden" name="projectId" value={projectId} /><label>Milestone (optional)<select name="milestoneId" defaultValue=""><option value="">Project-wide issue</option>{milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}</select></label><label>Issue type<input name="issueType" required minLength={3} maxLength={100} placeholder="Scope, delivery, communication…" /></label><label>Description<textarea name="description" required minLength={20} maxLength={3000} /></label><label>Amount affected, if known<input type="number" name="amountAffected" min="0" step="1" /></label><FormStatus error={state.error} success={state.success} /><button className="button button-secondary button-small" disabled={pending}>{pending ? "Recording…" : "Record dispute"}</button></form></details>;
}

export function ChangeRequestForm({ agreementId }: { agreementId: string }) {
  const [state, action, pending] = useActionState(createChangeRequest, {});
  return <details className="workflow-details"><summary>Request an agreement change</summary><form action={action} className="form-stack"><input type="hidden" name="agreementId" value={agreementId} /><label>Reason<input name="reason" minLength={10} maxLength={1000} required /></label><label>Proposed scope<textarea name="proposedScope" minLength={20} maxLength={5000} required /></label><div className="field-grid"><label>Proposed fee (optional)<input type="number" name="proposedAmount" min="0" step="1" /></label><label>Proposed deadline<input type="date" name="proposedDeadline" /></label></div><FormStatus error={state.error} success={state.success} /><button className="button button-secondary button-small" disabled={pending}>{pending ? "Submitting…" : "Submit change request"}</button></form></details>;
}
