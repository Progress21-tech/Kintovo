"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export async function reviewBrief(formData: FormData) {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN" && user.platformRole !== "OPERATIONS") redirect("/workspace");
  const parsed = z.object({ projectId: z.string().min(1), decision: z.enum(["MATCH", "RETURN"]), note: z.string().trim().min(4).max(1000) }).safeParse({ projectId: formData.get("projectId"), decision: formData.get("decision"), note: formData.get("note") });
  if (!parsed.success) return;
  const project = await db.project.findUnique({ where: { id: parsed.data.projectId }, select: { id: true, status: true } });
  if (!project || !["SUBMITTED", "IN_REVIEW"].includes(project.status)) return;
  const status = parsed.data.decision === "MATCH" ? "MATCHING" : "DRAFT";
  await db.$transaction([
    db.project.update({ where: { id: project.id }, data: { status } }),
    db.projectReview.create({ data: { projectId: project.id, reviewerId: user.id, decision: parsed.data.decision, note: parsed.data.note } }),
    db.auditLog.create({ data: { actorId: user.id, action: `BRIEF_REVIEW_${parsed.data.decision}`, entityType: "Project", entityId: project.id } }),
  ]);
  revalidatePath("/workspace/operations/briefs");
  revalidatePath(`/workspace/projects/${project.id}`);
  redirect("/workspace/operations/briefs?reviewed=1");
}
