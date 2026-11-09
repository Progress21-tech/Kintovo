"use client";

import { useActionState } from "react";
import { saveWorkstreamEdits } from "@/app/workspace/actions";

type Stream = { id: string; name: string; description: string; capabilities: string[] };

export function PlanEditor({ projectId, streams }: { projectId: string; streams: Stream[] }) {
  const [state, action, pending] = useActionState(saveWorkstreamEdits, {});
  return <form action={action} className="panel-content">
    <input type="hidden" name="projectId" value={projectId} />
    {streams.length ? <div className="workstream-list">{streams.map((stream) => <div className="workstream" key={stream.id}>
      <input type="hidden" name="streamId" value={stream.id} />
      <label>Workstream name<input name={`name_${stream.id}`} defaultValue={stream.name} maxLength={120} required /></label>
      <label style={{ marginTop: 10 }}>Description<textarea name={`description_${stream.id}`} defaultValue={stream.description} maxLength={1000} required /></label>
      <span className="field-note">Suggested capabilities: {stream.capabilities.join(" · ")}</span>
    </div>)}</div> : <p className="field-note">No workstreams were suggested for this brief. You can still submit it for review.</p>}
    {state.error && <p className="form-alert" role="alert" style={{ marginTop: 12 }}>{state.error}</p>}
    {state.success && <p className="form-success" role="status" style={{ marginTop: 12 }}>{state.success}</p>}
    <div className="form-actions"><button className="button button-secondary" disabled={pending}>{pending ? "Saving…" : "Save plan edits"}</button></div>
  </form>;
}
