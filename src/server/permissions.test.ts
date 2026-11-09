import assert from "node:assert/strict";
import test from "node:test";
import { canApproveSpend, canAssignOrganisationRole, canInviteOrganisationMembers, canManageProjects } from "./permissions";
import { canTransitionMilestone, canTransitionTask } from "./workflow";

test("only owners, admins, and project managers can create or submit briefs", () => {
  assert.equal(canManageProjects("OWNER"), true);
  assert.equal(canManageProjects("ADMIN"), true);
  assert.equal(canManageProjects("PROJECT_MANAGER"), true);
  assert.equal(canManageProjects("MEMBER"), false);
});

test("financial approval is separately scoped for project managers and members", () => {
  assert.equal(canApproveSpend("PROJECT_MANAGER", false), false);
  assert.equal(canApproveSpend("PROJECT_MANAGER", true), true);
  assert.equal(canApproveSpend("OWNER", false), true);
});

test("member invitations are restricted to organisation owners and admins", () => {
  assert.equal(canInviteOrganisationMembers("ADMIN"), true);
  assert.equal(canInviteOrganisationMembers("PROJECT_MANAGER"), false);
  assert.equal(canInviteOrganisationMembers("MEMBER"), false);
});

test("only organisation owners can appoint another owner", () => {
  assert.equal(canAssignOrganisationRole("OWNER", "OWNER"), true);
  assert.equal(canAssignOrganisationRole("ADMIN", "OWNER"), false);
  assert.equal(canAssignOrganisationRole("ADMIN", "MEMBER"), true);
  assert.equal(canAssignOrganisationRole("PROJECT_MANAGER", "MEMBER"), false);
});

test("task states only move through the delivery workflow", () => {
  assert.equal(canTransitionTask("TODO", "IN_PROGRESS"), true);
  assert.equal(canTransitionTask("TODO", "APPROVED"), false);
  assert.equal(canTransitionTask("SUBMITTED", "APPROVED"), true);
  assert.equal(canTransitionTask("APPROVED", "IN_PROGRESS"), false);
});

test("milestones allow review, limited revision, and dispute transitions", () => {
  assert.equal(canTransitionMilestone("IN_PROGRESS", "SUBMITTED"), true);
  assert.equal(canTransitionMilestone("SUBMITTED", "IN_REVIEW"), true);
  assert.equal(canTransitionMilestone("IN_REVIEW", "REVISION_REQUESTED"), true);
  assert.equal(canTransitionMilestone("APPROVED", "REVISION_REQUESTED"), false);
  assert.equal(canTransitionMilestone("IN_PROGRESS", "DISPUTED"), true);
});
