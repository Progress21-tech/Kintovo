"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { saveProfile } from "./actions";

export type ProfileValues = {
  headline?: string | null; biography?: string | null; city?: string | null;
  categories?: string[]; skills?: string[]; languages?: string[]; availability?: string | null;
  indicativeRate?: number | null; yearsExperience?: number | null; marketExperience?: string | null;
  availabilityStatus?: string | null; availableFrom?: Date | null; preferredDuration?: string | null;
  preferredArrangement?: string | null; preferredEngagements?: string[];
  platforms?: string[]; creatorCategories?: string[]; audienceEvidence?: string | null;
  audienceSize?: number | null; audienceGeography?: string | null; portfolio?: string;
};

export function ProfileForm({ profile, context }: { profile: ProfileValues; context: "SPECIALIST" | "CREATOR" }) {
  const [state, action, pending] = useActionState(saveProfile, {});
  const isCreator = context === "CREATOR";
  return <form action={action} className="panel form-panel">
    <input type="hidden" name="context" value={context} />
    {isCreator ? <>
      <div className="form-section"><h2>Creator profile</h2><p>UGC production is welcome even when you do not publish to your own audience. Audience evidence is optional unless it is relevant to the work you want.</p>
        <div className="field-grid">
          <label className="span-two">About your work<textarea name="biography" defaultValue={profile.biography ?? ""} placeholder="Describe the content you create and the work you want to do." maxLength={3000} /></label>
          <label>Content categories<input name="categories" defaultValue={(profile.creatorCategories ?? profile.categories ?? []).join(", ")} placeholder="Beauty, food, technology" maxLength={1000} /></label>
          <label>Publishing platforms<input name="platforms" defaultValue={(profile.platforms ?? []).join(", ")} placeholder="Instagram, YouTube, TikTok" maxLength={500} /></label>
          <label>Approximate audience size<input type="number" name="audienceSize" min="0" step="1" defaultValue={profile.audienceSize ?? ""} placeholder="Optional" /></label>
          <label>Audience geography<input name="audienceGeography" defaultValue={profile.audienceGeography ?? ""} placeholder="e.g. Nigeria, Lagos" maxLength={500} /></label>
          <label className="span-two">Evidence link or context<textarea name="audienceEvidence" defaultValue={profile.audienceEvidence ?? ""} placeholder="Optional link to platform insights or a short note. Do not add passwords or private account credentials." maxLength={1500} /></label>
        </div>
      </div>
    </> : <>
      <div className="form-section"><h2>Professional profile</h2><p>Describe your experience and the work you can take on. Your profile stays private until a reviewer records a verification decision.</p>
        <div className="field-grid">
          <label>Professional headline<input name="headline" defaultValue={profile.headline ?? ""} placeholder="e.g. Brand designer for digital products" maxLength={140} /></label>
          <label>City<input name="city" defaultValue={profile.city ?? ""} placeholder="e.g. Lagos" maxLength={100} /></label>
          <label className="span-two">About your work<textarea name="biography" defaultValue={profile.biography ?? ""} placeholder="Describe your contribution, relevant experience, and the work you want to do." maxLength={3000} /></label>
          <label>Professional categories<input name="categories" defaultValue={(profile.categories ?? []).join(", ")} placeholder="Market research, Brand design" maxLength={1000} /></label>
          <label>Skills<input name="skills" defaultValue={(profile.skills ?? []).join(", ")} placeholder="Audience research, Figma, interviews" maxLength={1000} /></label>
          <label>Years of experience<input type="number" name="yearsExperience" min="0" max="80" step="1" defaultValue={profile.yearsExperience ?? ""} placeholder="Optional" /></label>
          <label>Languages<input name="languages" defaultValue={(profile.languages ?? []).join(", ")} placeholder="English, Yoruba" maxLength={500} /></label>
          <label>Relevant market experience<input name="marketExperience" defaultValue={profile.marketExperience ?? ""} placeholder="Markets or audience groups you know" maxLength={1000} /></label>
          <label>Availability<input name="availability" defaultValue={profile.availability ?? ""} placeholder="e.g. Available for projects from December" maxLength={160} /></label>
          <label>Availability status<select name="availabilityStatus" defaultValue={profile.availabilityStatus ?? "UNSET"}><option value="UNSET">Not set</option><option value="AVAILABLE">Available</option><option value="AVAILABLE_FROM">Available from a future date</option><option value="UNAVAILABLE">Unavailable</option></select></label>
          <label>Available from<input type="date" name="availableFrom" defaultValue={profile.availableFrom?.toISOString().slice(0, 10) ?? ""} /></label>
          <label>Preferred project duration<input name="preferredDuration" defaultValue={profile.preferredDuration ?? ""} placeholder="e.g. 2–4 weeks" maxLength={120} /></label>
          <label>Preferred working arrangement<input name="preferredArrangement" defaultValue={profile.preferredArrangement ?? ""} placeholder="Remote, hybrid, on-site" maxLength={120} /></label>
          <label className="span-two">Preferred engagement types<input name="preferredEngagements" defaultValue={(profile.preferredEngagements ?? []).join(", ")} placeholder="Team project, individual engagement" maxLength={300} /></label>
          <label>Indicative rate in NGN<input type="number" name="rate" min="0" step="1" defaultValue={profile.indicativeRate ?? ""} placeholder="Optional" /></label>
          <label className="span-two">Portfolio items <span className="field-note">One per line: title | https://link | your contribution | public. Items remain private unless you add “public”.</span><textarea name="portfolio" defaultValue={profile.portfolio ?? ""} placeholder={"Nigeria audience research | https://example.com/work | Led interviews and synthesis | public"} maxLength={5000} /></label>
        </div>
      </div>
    </>}
    <FormStatus error={state.error} success={state.success} />
    <div className="form-actions form-actions-split"><button className="button button-secondary" name="intent" value="SAVE" disabled={pending}>{pending ? "Saving…" : "Save private draft"}</button><button className="button button-primary" name="intent" value="SUBMIT" disabled={pending}>{pending ? "Saving…" : "Submit for human review"}</button></div>
    <p className="field-note">Submitting requests a human review. It does not automatically verify credentials, work samples, audience data, or identity.</p>
  </form>;
}
