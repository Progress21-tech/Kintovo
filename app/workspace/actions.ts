"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { canManageProjects } from "@/server/permissions";
import { buildScopePlan } from "@/server/scoping";
import { brainstormScope as getScopeBrainstorm, generateScopePlan, isScopeAiConfigured, scopePlanSchema, SCOPE_PROMPT_VERSION, type ScopeChatMessage, type ScopeInput } from "@/server/scope-service";
import { platformFlag } from "@/server/settings";

const briefSchema = z.object({
  organisationId: z.string().min(1),
  title: z.string().trim().min(4).max(120),
  objective: z.string().trim().min(30).max(5000),
  targetMarket: z.string().trim().min(2).max(100),
  targetAudience: z.string().trim().max(600).optional(),
  currentPresence: z.string().trim().max(1000).optional(),
  currentCapabilities: z.string().trim().max(1000).optional(),
  previousAttempts: z.string().trim().max(1000).optional(),
  budgetMin: z.string().optional(),
  budgetMax: z.string().optional(),
  currency: z.enum(["NGN", "USD", "GBP", "EUR"]),
  deadline: z.string().optional(),
  constraints: z.string().trim().max(1500).optional(),
  expectedOutcomes: z.string().trim().max(1000).optional(),
  existingResources: z.string().trim().max(1000).optional(),
  additionalInformation: z.string().trim().max(1500).optional(),
  path: z.enum(["TEAM", "INDIVIDUAL", "UNDECIDED"]),
  aiConsent: z.boolean().default(false),
  scopeConversation: z.string().max(30000).optional(),
  scopeDraftPlan: z.string().max(30000).optional(),
});

const scopeChatMessagesSchema = z.array(z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
})).max(12);

const brainstormRequestSchema = z.object({
  organisationId: z.string().min(1),
  objective: z.string().trim().min(8).max(5000),
  targetMarket: z.string().trim().min(2).max(100),
  targetAudience: z.string().trim().max(600).optional(),
  budgetMin: z.number().int().nonnegative().nullable(),
  budgetMax: z.number().int().nonnegative().nullable(),
  deadline: z.string().optional(),
  currentPresence: z.string().trim().max(1000).optional(),
  currentCapabilities: z.string().trim().max(1000).optional(),
  previousAttempts: z.string().trim().max(1000).optional(),
  expectedOutcomes: z.string().trim().max(1000).optional(),
  constraints: z.string().trim().max(1500).optional(),
  existingResources: z.string().trim().max(1000).optional(),
  additionalInformation: z.string().trim().max(1500).optional(),
  conversation: scopeChatMessagesSchema,
  currentPlan: scopePlanSchema.nullable(),
  message: z.string().trim().min(2).max(1200),
});

function parseAmount(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : NaN;
}

export async function createProjectBrief(_state: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!await platformFlag("NEW_PROJECTS_ENABLED")) return { error: "New project submissions are temporarily paused. Please try again later." };
  const raw = Object.fromEntries(formData.entries());
  const parsed = briefSchema.safeParse({
    ...raw,
    budgetMin: String(raw.budgetMin ?? "").trim() || undefined,
    budgetMax: String(raw.budgetMax ?? "").trim() || undefined,
    aiConsent: raw.aiConsent === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the brief fields and try again." };
  const min = parseAmount(parsed.data.budgetMin);
  const max = parseAmount(parsed.data.budgetMax);
  if (Number.isNaN(min) || Number.isNaN(max)) return { error: "Enter a valid whole-number budget." };
  if (min !== undefined && max !== undefined && max < min) return { error: "The maximum budget must be at least the minimum budget." };
  const deadline = parsed.data.deadline ? new Date(`${parsed.data.deadline}T12:00:00.000Z`) : undefined;
  if (deadline && Number.isNaN(deadline.getTime())) return { error: "Enter a valid deadline." };

  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: parsed.data.organisationId, userId: user.id } } });
  if (!membership) return { error: "You do not have access to that organisation." };
  if (!canManageProjects(membership.role)) return { error: "Your organisation role cannot create project briefs. Ask an owner, administrator, or project manager." };

  let conversation: ScopeChatMessage[] = [];
  if (parsed.data.scopeConversation) {
    try {
      const parsedConversation = scopeChatMessagesSchema.safeParse(JSON.parse(parsed.data.scopeConversation));
      if (!parsedConversation.success) return { error: "Your brainstorming notes could not be read. Reopen the planner and try again." };
      conversation = parsedConversation.data;
    } catch {
      return { error: "Your brainstorming notes could not be read. Reopen the planner and try again." };
    }
  }
  let currentPlan: z.infer<typeof scopePlanSchema> | undefined;
  if (parsed.data.scopeDraftPlan) {
    try {
      const parsedPlan = scopePlanSchema.safeParse(JSON.parse(parsed.data.scopeDraftPlan));
      if (!parsedPlan.success) return { error: "Your brainstorming plan could not be read. Reopen the planner and try again." };
      currentPlan = parsedPlan.data;
    } catch {
      return { error: "Your brainstorming plan could not be read. Reopen the planner and try again." };
    }
  }
  const scopeInput: ScopeInput = {
    objective: parsed.data.objective, targetMarket: parsed.data.targetMarket, targetAudience: parsed.data.targetAudience, budgetMin: min, budgetMax: max, deadline,
    currentPresence: parsed.data.currentPresence, currentCapabilities: parsed.data.currentCapabilities,
    previousAttempts: parsed.data.previousAttempts, expectedOutcomes: parsed.data.expectedOutcomes,
    constraints: parsed.data.constraints, existingResources: parsed.data.existingResources, additionalInformation: parsed.data.additionalInformation,
  };
  const scopeResult = parsed.data.aiConsent ? await generateScopePlan(scopeInput, conversation, currentPlan) : { plan: buildScopePlan(scopeInput), source: "RULES_V1" as const, promptVersion: SCOPE_PROMPT_VERSION, error: undefined };
  if (!scopeResult.plan) {
    return { error: scopeResult.error === "not_configured"
      ? "AI recommendations are not configured yet, so your brief was not saved. Ask the platform administrator to connect an AI provider, or turn off the AI option to use the clearly labeled rules-based suggestions."
      : "The AI provider could not generate recommendations, so your brief was not saved. Try again later, or turn off the AI option to use rules-based suggestions." };
  }
  const scopePlan = scopeResult.plan;
  const workstreams = scopePlan.workstreams;
  const project = await db.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        organisationId: membership.organisationId,
        createdById: user.id,
        title: parsed.data.title,
        path: parsed.data.path === "UNDECIDED" ? null : parsed.data.path,
        brief: { create: {
          objective: parsed.data.objective,
          targetMarket: parsed.data.targetMarket,
          targetAudience: parsed.data.targetAudience || null,
          currentPresence: parsed.data.currentPresence || null,
          currentCapabilities: parsed.data.currentCapabilities || null,
          previousAttempts: parsed.data.previousAttempts || null,
          budgetMin: min ?? null,
          budgetMax: max ?? null,
          currency: parsed.data.currency,
          deadline: deadline ?? null,
          constraints: parsed.data.constraints || null,
          expectedOutcomes: parsed.data.expectedOutcomes || null,
          existingResources: parsed.data.existingResources || null,
          additionalInformation: parsed.data.additionalInformation || null,
          scopeQuestions: scopePlan.questions,
          scopeAssumptions: scopePlan.assumptions,
          scopeGeneratedBy: scopeResult.source,
          scopePromptVersion: scopeResult.promptVersion,
        } },
        workstreams: { create: workstreams.map((stream) => ({
          name: stream.name,
          description: stream.description,
          capabilities: stream.capabilities,
          recommendedRoles: stream.recommendedRoles,
          deliverables: stream.deliverables,
          dependencies: stream.dependencies,
          assumptions: stream.assumptions,
          rationale: stream.rationale,
          source: scopeResult.source,
        })) },
      },
    });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROJECT_BRIEF_DRAFT_CREATED", entityType: "Project", entityId: created.id } });
    return created;
  });
  redirect(`/workspace/projects/${project.id}`);
}

export async function brainstormScopePlan(rawInput: unknown) {
  if (!await platformFlag("NEW_PROJECTS_ENABLED")) return { error: "New project submissions are temporarily paused." } as const;
  if (!isScopeAiConfigured()) return { error: "AI planning is not connected yet. The platform administrator needs to configure the AI provider." } as const;
  const parsed = brainstormRequestSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the goal details and try again." } as const;
  const user = await requireUser();
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: parsed.data.organisationId, userId: user.id } } });
  if (!membership || !canManageProjects(membership.role)) return { error: "You do not have access to plan projects for that organisation." } as const;
  const deadline = parsed.data.deadline ? new Date(`${parsed.data.deadline}T12:00:00.000Z`) : undefined;
  if (deadline && Number.isNaN(deadline.getTime())) return { error: "Enter a valid deadline before brainstorming." } as const;
  const input: ScopeInput = {
    objective: parsed.data.objective,
    targetMarket: parsed.data.targetMarket,
    targetAudience: parsed.data.targetAudience,
    budgetMin: parsed.data.budgetMin,
    budgetMax: parsed.data.budgetMax,
    deadline,
    currentPresence: parsed.data.currentPresence,
    currentCapabilities: parsed.data.currentCapabilities,
    previousAttempts: parsed.data.previousAttempts,
    expectedOutcomes: parsed.data.expectedOutcomes,
    constraints: parsed.data.constraints,
    existingResources: parsed.data.existingResources,
    additionalInformation: parsed.data.additionalInformation,
  };
  const result = await getScopeBrainstorm(input, parsed.data.conversation, parsed.data.message, parsed.data.currentPlan ?? undefined);
  if ("error" in result) {
    const messages = {
      not_configured: "AI planning is not configured. Ask the platform administrator to check the AI settings.",
      authentication_failed: "The AI provider rejected its API key. Ask the platform administrator to check AI_API_KEY in Vercel.",
      rate_limited: "The AI provider's free-tier quota or rate limit has been reached. Try again later or check its usage limits.",
      invalid_request: "The AI provider rejected the model request. Ask the platform administrator to check the model and API endpoint settings.",
      invalid_response: "The AI provider returned an unreadable plan. Try sending your message again.",
      provider_unavailable: "The AI provider is temporarily unavailable. Try again shortly.",
      timeout: "The AI provider took too long to respond. Try again with a shorter message.",
      provider_failed: "The AI provider could not be reached. Try again shortly.",
    };
    return { error: messages[result.error] } as const;
  }
  return { result } as const;
}

export async function submitBriefForReview(formData: FormData) {
  const user = await requireUser();
  const projectId = z.string().min(1).safeParse(formData.get("projectId"));
  if (!projectId.success) return;
  const project = await db.project.findUnique({ where: { id: projectId.data }, select: { id: true, organisationId: true, status: true } });
  if (!project) return;
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: project.organisationId, userId: user.id } } });
  if (!membership || !canManageProjects(membership.role)) return;
  if (project.status !== "DRAFT") return;
  await db.$transaction([
    db.project.update({ where: { id: project.id }, data: { status: "SUBMITTED" } }),
    db.auditLog.create({ data: { actorId: user.id, action: "PROJECT_BRIEF_SUBMITTED", entityType: "Project", entityId: project.id } }),
  ]);
  redirect(`/workspace/projects/${project.id}?submitted=1`);
}

export async function deleteProjectBrief(formData: FormData) {
  const user = await requireUser();
  const projectId = z.string().min(1).safeParse(formData.get("projectId"));
  if (!projectId.success) redirect("/workspace/projects");
  const project = await db.project.findUnique({ where: { id: projectId.data }, select: { id: true, organisationId: true } });
  if (!project) redirect("/workspace/projects");
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: project.organisationId, userId: user.id } } });
  if (!membership || !canManageProjects(membership.role)) redirect("/workspace/projects");
  const deleted = await db.$transaction(async (tx) => {
    const result = await tx.project.deleteMany({ where: { id: project.id, organisationId: project.organisationId, status: "DRAFT" } });
    if (!result.count) return false;
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROJECT_BRIEF_DRAFT_DELETED", entityType: "Project", entityId: project.id } });
    return true;
  });
  if (!deleted) redirect(`/workspace/projects/${project.id}?delete=locked`);
  redirect("/workspace/projects?deleted=1");
}

export async function saveWorkstreamEdits(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const projectId = z.string().min(1).safeParse(formData.get("projectId"));
  if (!projectId.success) return { error: "This brief could not be found." };
  const project = await db.project.findUnique({ where: { id: projectId.data }, include: { workstreams: true } });
  if (!project) return { error: "This brief could not be found." };
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: project.organisationId, userId: user.id } } });
  if (!membership || !canManageProjects(membership.role)) return { error: "Your organisation role cannot edit this project plan." };
  if (project.status !== "DRAFT") return { error: "This plan is locked after submission. Request a scope change during review." };
  const rawPlan = z.string().max(30000).safeParse(formData.get("plan"));
  if (!rawPlan.success) return { error: "The workstream plan is too large or missing." };
  let decodedPlan: unknown;
  try { decodedPlan = JSON.parse(rawPlan.data); } catch { return { error: "The workstream plan could not be read. Refresh the page and try again." }; }
  const input = z.array(z.object({
    id: z.string().optional(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(2).max(1000),
    capabilities: z.array(z.string().trim().min(2).max(100)).max(12),
    recommendedRoles: z.array(z.string().trim().min(2).max(100)).max(8),
    deliverables: z.array(z.string().trim().min(2).max(180)).max(12),
    dependencies: z.array(z.string().trim().min(2).max(180)).max(8),
    assumptions: z.array(z.string().trim().min(2).max(300)).max(8),
    rationale: z.string().trim().max(500).optional(),
  }).strict()).max(12).safeParse(decodedPlan);
  if (!input.success) return { error: "Review the workstream details and try again." };
  const ids = input.data.flatMap((stream) => stream.id ? [stream.id] : []);
  if (new Set(ids).size !== ids.length || ids.some((id) => !project.workstreams.some((stream) => stream.id === id))) return { error: "The workstream list changed. Refresh the page and try again." };
  await db.$transaction(async (tx) => {
    const retainedIds = input.data.flatMap((stream) => stream.id ? [stream.id] : []);
    if (retainedIds.length) await tx.workstream.deleteMany({ where: { projectId: project.id, id: { notIn: retainedIds } } });
    else await tx.workstream.deleteMany({ where: { projectId: project.id } });
    for (const stream of input.data) {
      const data = {
        name: stream.name, description: stream.description, capabilities: stream.capabilities,
        recommendedRoles: stream.recommendedRoles, deliverables: stream.deliverables,
        dependencies: stream.dependencies, assumptions: stream.assumptions, rationale: stream.rationale || null,
      };
      if (stream.id) await tx.workstream.update({ where: { id: stream.id }, data });
      else await tx.workstream.create({ data: { projectId: project.id, ...data, source: "BUYER_ADDED" } });
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROJECT_PLAN_EDITED", entityType: "Project", entityId: project.id } });
  });
  return { success: "Your workstream plan has been saved." };
}
