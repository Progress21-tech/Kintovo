"use client";

import { useState } from "react";
import { Bot, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { brainstormScopePlan } from "@/app/workspace/actions";
import type { ScopeChatMessage } from "@/server/scope-service";
import type { ScopePlan } from "@/server/scoping";

type ScopeFormRef = { current: HTMLFormElement | null };

export function ScopeBrainstorm({ formRef, conversation, onConversationChange, plan, onPlanChange }: {
  formRef: ScopeFormRef;
  conversation: ScopeChatMessage[];
  onConversationChange: (messages: ScopeChatMessage[]) => void;
  plan: ScopePlan | null;
  onPlanChange: (plan: ScopePlan | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function sendMessage() {
    const prompt = message.trim();
    if (!prompt || !formRef.current || pending) return;
    const form = new FormData(formRef.current);
    const numberOrNull = (key: string) => {
      const value = String(form.get(key) ?? "").trim();
      if (!value) return null;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
    };
    setError("");
    setPending(true);
    try {
      const response = await brainstormScopePlan({
        organisationId: String(form.get("organisationId") ?? ""),
        objective: String(form.get("objective") ?? ""),
        targetMarket: String(form.get("targetMarket") ?? ""),
        targetAudience: String(form.get("targetAudience") ?? ""),
        budgetMin: numberOrNull("budgetMin"),
        budgetMax: numberOrNull("budgetMax"),
        deadline: String(form.get("deadline") ?? ""),
        currentPresence: String(form.get("currentPresence") ?? ""),
        currentCapabilities: String(form.get("currentCapabilities") ?? ""),
        previousAttempts: String(form.get("previousAttempts") ?? ""),
        expectedOutcomes: String(form.get("expectedOutcomes") ?? ""),
        constraints: String(form.get("constraints") ?? ""),
        existingResources: String(form.get("existingResources") ?? ""),
        additionalInformation: String(form.get("additionalInformation") ?? ""),
        conversation,
        currentPlan: plan,
        message: prompt,
      });
      if ("error" in response) {
        setError(response.error ?? "The scope assistant could not complete that request.");
        return;
      }
      const reply = response.result.reply;
      const nextConversation = [...conversation, { role: "user" as const, content: prompt }, { role: "assistant" as const, content: reply }].slice(-12);
      onConversationChange(nextConversation);
      onPlanChange(response.result.plan);
      setMessage("");
    } catch {
      setError("The scope assistant is temporarily unavailable. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return <section className="scope-brainstorm" aria-label="AI scope brainstorming">
    <div className="scope-brainstorm-heading">
      <span className="scope-brainstorm-icon"><Bot size={17} aria-hidden="true" /></span>
      <div><strong>Brainstorm the workstreams</strong><small>Talk through the goal and refine a plan with AI.</small></div>
      <button type="button" className="button button-secondary button-small" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <MessageCircle size={14} aria-hidden="true" />{open ? "Close" : conversation.length ? "Continue" : "Start brainstorming"}
      </button>
    </div>
    {open && <div className="scope-brainstorm-body">
      <p className="scope-brainstorm-hint">The assistant reads the goal and details currently entered above. Ask what work is needed, add context, or challenge a suggestion. You can review and edit the saved workstreams before submitting the brief.</p>
      {conversation.length > 0 && <div className="scope-chat-history" aria-live="polite">
        {conversation.map((item, index) => <div className={`scope-chat-message ${item.role}`} key={`${index}-${item.role}`}><strong>{item.role === "assistant" ? "Kintovo scope assistant" : "You"}</strong><p>{item.content}</p></div>)}
      </div>}
      {plan && <div className="scope-chat-plan">
        <div className="scope-chat-plan-title"><strong>Current draft · {plan.workstreams.length} workstream{plan.workstreams.length === 1 ? "" : "s"}</strong><span>Re-drafted from your goal and this conversation when you save.</span></div>
        {plan.workstreams.map((stream, index) => <article key={`${stream.name}-${index}`}><strong>{index + 1}. {stream.name}</strong><p>{stream.description}</p><small>Suggested roles: {stream.recommendedRoles.join(", ") || "To be decided"}</small></article>)}
        {plan.questions.length > 0 && <p className="field-note">To clarify: {plan.questions.join(" · ")}</p>}
      </div>}
      <label className="scope-chat-input-label" htmlFor="scope-brainstorm-input">Your message</label>
      <div className="scope-chat-composer"><textarea id="scope-brainstorm-input" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} maxLength={1200} placeholder="For example: We already have a designer. What other roles would help us reach this audience?" /><button type="button" className="button button-primary" onClick={() => void sendMessage()} disabled={pending || message.trim().length < 2}>{pending ? <LoaderCircle className="scope-spinner" size={16} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}{pending ? "Thinking…" : "Send"}</button></div>
      {error && <p className="form-alert" role="alert">{error}</p>}
      {conversation.length > 0 && <p className="scope-chat-privacy">Your goal and messages are sent to the configured AI provider only because you enabled AI for this brief. Do not share confidential personal or business information.</p>}
    </div>}
  </section>;
}
