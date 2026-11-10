"use client";

import { useActionState, useState } from "react";
import { saveWorkstreamEdits } from "@/app/workspace/actions";

export type EditableStream = {
  id?: string; name: string; description: string; capabilities: string[];
  recommendedRoles: string[]; deliverables: string[]; dependencies: string[];
  assumptions: string[]; rationale?: string | null;
};

function splitLines(value: string) { return value.split("\n").map((item) => item.trim()).filter(Boolean); }
function splitList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }

export function PlanEditor({ projectId, streams: initialStreams, editable = true }: { projectId: string; streams: EditableStream[]; editable?: boolean }) {
  const [state, action, pending] = useActionState(saveWorkstreamEdits, {});
  const [streams, setStreams] = useState(initialStreams);
  const planPayload = streams.map(({ id, name, description, capabilities, recommendedRoles, deliverables, dependencies, assumptions, rationale }) => ({
    id, name, description, capabilities, recommendedRoles, deliverables, dependencies, assumptions, rationale,
  }));
  type EditableField = "name" | "description" | "capabilities" | "recommendedRoles" | "deliverables" | "dependencies" | "assumptions";
  function update(index: number, field: EditableField, value: string) {
    setStreams((current) => current.map((stream, i) => i === index ? {
      ...stream,
      [field]: field === "capabilities" || field === "recommendedRoles" ? splitList(value) : field === "deliverables" || field === "dependencies" || field === "assumptions" ? splitLines(value) : value,
    } as EditableStream : stream));
  }
  return <form action={action} className="panel-content">
    <input type="hidden" name="projectId" value={projectId} />
    <input type="hidden" name="plan" value={JSON.stringify(planPayload)} />
    {streams.length ? <div className="workstream-list">{streams.map((stream, index) => <fieldset className="workstream workstream-editor" key={stream.id ?? `new-${index}`}>
      <legend>Workstream {index + 1}</legend>
      <label>Name<input value={stream.name} onChange={(event) => update(index, "name", event.target.value)} required maxLength={120} disabled={!editable} /></label>
      <label>Description<textarea value={stream.description} onChange={(event) => update(index, "description", event.target.value)} required maxLength={1000} disabled={!editable} /></label>
      <label>Recommended roles<input value={stream.recommendedRoles.join(", ")} onChange={(event) => update(index, "recommendedRoles", event.target.value)} maxLength={800} disabled={!editable} /></label>
      <label>Capabilities<input value={stream.capabilities.join(", ")} onChange={(event) => update(index, "capabilities", event.target.value)} maxLength={1000} disabled={!editable} /></label>
      <label>Draft deliverables<textarea value={stream.deliverables.join("\n")} onChange={(event) => update(index, "deliverables", event.target.value)} maxLength={2000} disabled={!editable} /></label>
      <label>Dependencies<textarea value={stream.dependencies.join("\n")} onChange={(event) => update(index, "dependencies", event.target.value)} maxLength={1200} disabled={!editable} /></label>
      <label>Assumptions<textarea value={stream.assumptions.join("\n")} onChange={(event) => update(index, "assumptions", event.target.value)} maxLength={1200} disabled={!editable} /></label>
      {stream.rationale && <p className="field-note">Why suggested: {stream.rationale}</p>}
      {editable && <button className="button button-secondary button-small" type="button" onClick={() => setStreams((current) => current.filter((_, i) => i !== index))}>Remove workstream</button>}
    </fieldset>)}</div> : <p className="field-note">No workstreams yet. Add one based on the outcome you want.</p>}
    {editable && <div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setStreams((current) => [...current, { name: "", description: "", capabilities: [], recommendedRoles: [], deliverables: [], dependencies: [], assumptions: [], rationale: "" }])}>Add workstream</button><button className="button button-primary" disabled={pending}>{pending ? "Saving…" : "Save scope plan"}</button></div>}
    {state.error && <p className="form-alert" role="alert" style={{ marginTop: 12 }}>{state.error}</p>}
    {state.success && <p className="form-success" role="status" style={{ marginTop: 12 }}>{state.success}</p>}
    {!editable && <p className="field-note">The scope is locked after submission. Ask Kintovo operations to reopen the brief if it needs corrections.</p>}
  </form>;
}
