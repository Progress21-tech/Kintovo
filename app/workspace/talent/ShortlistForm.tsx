"use client";

import { useActionState } from "react";
import { shortlistTalent } from "./actions";

export function ShortlistForm({ profileId, projects }: { profileId: string; projects: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(shortlistTalent, {});
  if (!projects.length) return <p className="field-note">Create a brief before shortlisting candidates.</p>;
  return <form action={action} className="shortlist-form">
    <input type="hidden" name="profileId" value={profileId} />
    <label className="sr-only" htmlFor={`shortlist-${profileId}`}>Project for shortlist</label>
    <select id={`shortlist-${profileId}`} name="projectId" aria-label="Project for shortlist">{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
    <button className="button button-secondary button-small" disabled={pending}>{pending ? "Saving…" : "Shortlist"}</button>
    {state.error && <span className="form-alert" role="alert">{state.error}</span>}
    {state.success && <span className="form-success" role="status">{state.success}</span>}
  </form>;
}
