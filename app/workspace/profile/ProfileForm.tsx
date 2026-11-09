"use client";

import { useActionState } from "react";
import { saveProfile } from "./actions";

export type ProfileValues = { headline?: string | null; biography?: string | null; city?: string | null; categories?: string[]; skills?: string[]; languages?: string[]; availability?: string | null; indicativeRate?: number | null; platforms?: string[]; creatorCategories?: string[] };

export function ProfileForm({ profile, defaultContext = "SPECIALIST" }: { profile: ProfileValues; defaultContext?: "SPECIALIST" | "CREATOR" }) {
  const [state, action, pending] = useActionState(saveProfile, {});
  return <form action={action} className="panel form-panel">
    <div className="form-section"><h2>Professional profile</h2><p>Your profile is private while in progress. Kintovo does not claim that credentials or work have been verified until a reviewer records that decision.</p>
      <div className="field-grid">
        <label>Profile type<select name="context" defaultValue={defaultContext}><option value="SPECIALIST">Specialist</option><option value="CREATOR">Creator</option></select></label>
        <label>Professional headline<input name="headline" defaultValue={profile.headline ?? ""} placeholder="e.g. Brand designer for digital products" maxLength={140} /></label>
        <label className="span-two">About your work<textarea name="biography" defaultValue={profile.biography ?? ""} placeholder="Describe your contribution, experience, and the work you want to do." maxLength={3000} /></label>
        <label>City<input name="city" defaultValue={profile.city ?? ""} placeholder="e.g. Lagos" maxLength={100} /></label>
        <label>Availability<input name="availability" defaultValue={profile.availability ?? ""} placeholder="e.g. Open to projects from December" maxLength={160} /></label>
        <label>Categories, comma separated<input name="categories" defaultValue={(profile.categories ?? profile.creatorCategories ?? []).join(", ")} placeholder="Market research, Brand design" maxLength={1000} /></label>
        <label>Skills, comma separated<input name="skills" defaultValue={(profile.skills ?? []).join(", ")} placeholder="Audience research, Figma, interviews" maxLength={1000} /></label>
        <label>Languages, comma separated<input name="languages" defaultValue={(profile.languages ?? []).join(", ")} placeholder="English, Yoruba" maxLength={500} /></label>
        <label>Indicative rate in NGN<input type="number" name="rate" min="0" step="1" defaultValue={profile.indicativeRate ?? ""} placeholder="Optional" /></label>
        <label className="span-two">Publishing platforms, comma separated<input name="platforms" defaultValue={(profile.platforms ?? []).join(", ")} placeholder="For creator profiles; UGC production does not require an audience" maxLength={500} /></label>
      </div>
    </div>
    {state.error && <p className="form-alert" role="alert">{state.error}</p>}{state.success && <p className="form-success" role="status">{state.success}</p>}
    <div className="form-actions"><button className="button button-primary" disabled={pending}>{pending ? "Saving…" : "Save private profile"}</button></div>
  </form>;
}
