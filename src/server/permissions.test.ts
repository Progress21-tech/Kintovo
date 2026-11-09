import assert from "node:assert/strict";
import test from "node:test";
import { canApproveSpend, canInviteOrganisationMembers, canManageProjects } from "./permissions";

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
