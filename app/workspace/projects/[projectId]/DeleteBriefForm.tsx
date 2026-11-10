"use client";

import { deleteProjectBrief } from "@/app/workspace/actions";

export function DeleteBriefForm({ projectId }: { projectId: string }) {
  return <form action={deleteProjectBrief} onSubmit={(event) => {
    if (!window.confirm("Delete this draft brief permanently? This action cannot be undone.")) event.preventDefault();
  }}>
    <input type="hidden" name="projectId" value={projectId} />
    <button className="button button-danger button-wide" type="submit">Delete draft brief</button>
  </form>;
}
