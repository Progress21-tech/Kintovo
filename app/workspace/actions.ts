"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { canManageProjects } from "@/server/permissions";
import { suggestWorkstreams } from "@/server/scoping";

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
});

function parseAmount(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : NaN;
}

export async function createProjectBrief(_state: { error?: string }, formData: FormData) {
  const user = await requireUser();
  const raw = Object.fromEntries(formData.entries());
  const parsed = briefSchema.safeParse({
    ...raw,
    budgetMin: String(raw.budgetMin ?? "").trim() || undefined,
    budgetMax: String(raw.budgetMax ?? "").trim() || undefined,
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

  const workstreams = suggestWorkstreams(parsed.data.objective);
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
        } },
        workstreams: { create: workstreams.map((stream) => ({ ...stream, capabilities: stream.capabilities })) },
      },
    });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROJECT_BRIEF_DRAFT_CREATED", entityType: "Project", entityId: created.id } });
    return created;
  });
  redirect(`/workspace/projects/${project.id}`);
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

export async function saveWorkstreamEdits(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const projectId = z.string().min(1).safeParse(formData.get("projectId"));
  if (!projectId.success) return { error: "This brief could not be found." };
  const project = await db.project.findUnique({ where: { id: projectId.data }, include: { workstreams: true } });
  if (!project) return { error: "This brief could not be found." };
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: project.organisationId, userId: user.id } } });
  if (!membership || !canManageProjects(membership.role)) return { error: "Your organisation role cannot edit this project plan." };
  if (project.status !== "DRAFT") return { error: "This plan is locked after submission. Request a scope change during review." };
  const submittedIds = formData.getAll("streamId").map(String);
  if (submittedIds.length !== project.workstreams.length || submittedIds.some((id) => !project.workstreams.some((stream) => stream.id === id))) {
    return { error: "The workstream list changed. Refresh the page and try again." };
  }
  const updates = project.workstreams.map((stream) => {
    const name = z.string().trim().min(2).max(120).safeParse(formData.get(`name_${stream.id}`));
    const description = z.string().trim().min(2).max(1000).safeParse(formData.get(`description_${stream.id}`));
    if (!name.success || !description.success) return null;
    return db.workstream.update({ where: { id: stream.id, projectId: project.id }, data: { name: name.data, description: description.data } });
  });
  if (updates.some((update) => update === null)) return { error: "Each workstream needs a name and description." };
  await db.$transaction([
    ...updates.filter((update): update is NonNullable<typeof update> => update !== null),
    db.auditLog.create({ data: { actorId: user.id, action: "PROJECT_PLAN_EDITED", entityType: "Project", entityId: project.id } }),
  ]);
  return { success: "Your workstream edits have been saved." };
}
