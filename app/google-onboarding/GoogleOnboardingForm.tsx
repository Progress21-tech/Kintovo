"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Clapperboard, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { completeGoogleOnboarding } from "./actions";

type AccountContext = "BUSINESS" | "SPECIALIST" | "CREATOR";

const accountTypes: { value: AccountContext; title: string; description: string; Icon: LucideIcon }[] = [
  { value: "BUSINESS", title: "Business", description: "Create an organisation and start planning work.", Icon: BriefcaseBusiness },
  { value: "SPECIALIST", title: "Specialist", description: "Build a professional profile and find project work.", Icon: UserRound },
  { value: "CREATOR", title: "Creator", description: "Share your channels and the content you create.", Icon: Clapperboard },
];

export function GoogleOnboardingForm() {
  const [state, action, pending] = useActionState(completeGoogleOnboarding, {});
  const [context, setContext] = useState<AccountContext | null>(null);
  const [step, setStep] = useState<"role" | "details">("role");
  const selectedType = accountTypes.find((type) => type.value === context);
  const SelectedIcon = selectedType?.Icon;

  return <form action={action} className="form-stack google-onboarding-form">
    {step === "role" ? <>
      <fieldset className="account-type-fieldset">
        <legend>How will you use Kintovo?</legend>
        <p className="field-note">Choose the account type that best fits you. You can add other workspaces later.</p>
        <div className="account-type-options">
          {accountTypes.map(({ value, title, description, Icon }) => <label className={`account-type-option${context === value ? " selected" : ""}`} key={value}>
            <input type="radio" name="account-type" value={value} checked={context === value} onChange={() => setContext(value)} />
            <span className="account-type-icon"><Icon size={19} aria-hidden="true" /></span>
            <span className="account-type-copy"><strong>{title}</strong><small>{description}</small></span>
            <span className="account-type-radio" aria-hidden="true" />
          </label>)}
        </div>
      </fieldset>
      {state.error && <p className="form-alert" role="alert">{state.error}</p>}
      <button className="button button-primary button-wide" type="button" disabled={!context} onClick={() => setStep("details")}>Continue <ArrowRight size={16} aria-hidden="true" /></button>
    </> : <>
      <input type="hidden" name="context" value={context ?? ""} />
      <div className="selected-account-type"><span className="selected-account-icon">{SelectedIcon && <SelectedIcon size={17} aria-hidden="true" />}</span><span><small>Creating a</small><strong>{selectedType?.title} account</strong></span><button className="change-account-type" type="button" onClick={() => setStep("role")}><ArrowLeft size={14} aria-hidden="true" /> Change</button></div>

      {context === "BUSINESS" && <div className="form-stack onboarding-role-fields">
        <p className="onboarding-form-intro">Set up your organisation workspace. You can add more details later.</p>
        <label>Organisation name<span className="field-note">Required</span><input name="organisation" autoComplete="organization" required minLength={2} maxLength={120} /></label>
        <label>Website <span className="field-note">Optional</span><input name="website" type="url" placeholder="https://example.com" autoComplete="url" /></label>
        <label>Industry <span className="field-note">Optional</span><input name="industry" placeholder="e.g. Digital products" maxLength={120} /></label>
        <label>Business model <span className="field-note">Optional</span><input name="model" placeholder="e.g. Subscription software" maxLength={120} /></label>
        <label>Product or service <span className="field-note">Optional</span><input name="product" placeholder="What does your business offer?" maxLength={300} /></label>
        <label>Business location <span className="field-note">Optional</span><input name="location" placeholder="City, country" maxLength={120} /></label>
      </div>}

      {context === "SPECIALIST" && <div className="form-stack onboarding-role-fields">
        <p className="onboarding-form-intro">Start your professional profile. You can add skills, experience, and portfolio details from your workspace.</p>
        <label>About your work <span className="field-note">Optional</span><textarea name="biography" maxLength={3000} placeholder="Describe the work you do and the problems you help solve." /></label>
        <label>Professional categories <span className="field-note">Optional · separate with commas</span><input name="categories" placeholder="Brand design, research, product strategy" maxLength={1000} /></label>
      </div>}

      {context === "CREATOR" && <div className="form-stack onboarding-role-fields">
        <p className="onboarding-form-intro">Start your creator profile. You can add portfolio and audience details from your workspace.</p>
        <label>About your work <span className="field-note">Optional</span><textarea name="biography" maxLength={3000} placeholder="What kind of content do you create?" /></label>
        <label>Publishing platforms <span className="field-note">Optional · separate with commas</span><input name="platforms" placeholder="Instagram, YouTube, TikTok" maxLength={500} /></label>
        <label>Content categories <span className="field-note">Optional · separate with commas</span><input name="categories" placeholder="Food, technology, culture" maxLength={1000} /></label>
      </div>}

      <label className="legal-consent"><input type="checkbox" name="acceptTerms" required /><span>I agree to the <Link href="/terms" target="_blank">Terms of Service</Link>.</span></label>
      <label className="legal-consent"><input type="checkbox" name="acceptPrivacy" required /><span>I acknowledge the <Link href="/privacy" target="_blank">Privacy Notice</Link>.</span></label>

      {state.error && <p className="form-alert" role="alert">{state.error}</p>}
      <button className="button button-primary button-wide" disabled={pending}>{pending ? "Setting up your workspace…" : context === "BUSINESS" ? "Create business workspace" : "Complete profile setup"}</button>
    </>}
  </form>;
}
