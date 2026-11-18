"use client";

import { useActionState } from "react";
import { FileInput, FileList, type FileChip } from "@/components/FileList";
import { FormStatus } from "@/components/FormStatus";
import { addPortfolioItem, deletePortfolioItem, setPortfolioVisibility } from "./portfolio-actions";

export type PortfolioEntry = {
  id: string; title: string; description: string | null; category: string | null; occurredAt: string | null;
  url: string | null; contribution: string | null; skills: string[]; isPublic: boolean; files: FileChip[];
};

export function PortfolioManager({ items }: { items: PortfolioEntry[] }) {
  const [state, action, pending] = useActionState(addPortfolioItem, {});
  return <section className="panel" id="portfolio" style={{ marginTop: 16 }}>
    <div className="panel-header"><div><h2>Portfolio</h2><span className="field-note">Items are your own claims until a reviewer assesses them. Private items are visible only to you and Kintovo reviewers.</span></div></div>
    <div className="panel-content">
      {items.length ? <ul className="review-history">{items.map((item) => <li key={item.id}><div>
        <strong>{item.title}</strong>
        <small>{[item.category, item.occurredAt, item.skills.join(", ")].filter(Boolean).join(" · ")}</small>
        {item.description && <small>{item.description}</small>}
        {item.contribution && <small>Your contribution: {item.contribution}</small>}
        {item.url && <small><a className="text-link" href={item.url} target="_blank" rel="noreferrer">External link</a></small>}
        <FileList files={item.files} label="Work sample files" />
        <div className="inline-form" style={{ marginTop: 8 }}>
          <form action={setPortfolioVisibility}><input type="hidden" name="itemId" value={item.id} /><button className="button button-secondary button-small" name="visibility" value={item.isPublic ? "PRIVATE" : "PUBLIC"}>{item.isPublic ? "Make private" : "Make public"}</button></form>
          <details><summary className="text-link">Delete</summary><form action={deletePortfolioItem} className="inline-form"><input type="hidden" name="itemId" value={item.id} /><label className="checkbox-row"><input type="checkbox" name="confirm" value="yes" required /> Permanently delete this item and its files</label><button className="button button-secondary button-small">Delete item</button></form></details>
        </div>
      </div><span className={`status-pill ${item.isPublic ? "green" : ""}`}>{item.isPublic ? "Public" : "Private"}</span></li>)}</ul> : <p className="field-note">No portfolio items yet. Add work samples that show your own contribution.</p>}
      <details className="workflow-details" open={!items.length}><summary>Add a portfolio item</summary>
        <form action={action} className="form-stack">
          <label>Title<input name="title" required minLength={3} maxLength={140} /></label>
          <label>Description<textarea name="description" maxLength={2000} /></label>
          <div className="field-grid"><label>Category<input name="category" maxLength={100} placeholder="Video editing" /></label><label>Completed (month)<input type="month" name="occurredAt" /></label><label>Visibility<select name="visibility" defaultValue="PRIVATE"><option value="PRIVATE">Private</option><option value="PUBLIC">Public to businesses</option></select></label></div>
          <label>Your contribution<textarea name="contribution" required minLength={10} maxLength={1000} placeholder="What you personally did on this work, and with whom." /></label>
          <label>Relevant skills (comma separated)<input name="skills" maxLength={500} /></label>
          <FileInput label="Work sample file" />
          <label>External link<input name="url" type="url" placeholder="https://…" /></label>
          <small className="field-note">Add a file, a link, or both. Only upload work you have permission to share.</small>
          <FormStatus error={state.error} success={state.success} />
          <button className="button button-primary button-small" disabled={pending}>{pending ? "Saving…" : "Add portfolio item"}</button>
        </form>
      </details>
    </div>
  </section>;
}
