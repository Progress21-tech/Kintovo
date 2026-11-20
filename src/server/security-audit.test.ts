import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { safeExternalHref } from "@/lib/safe-href";
import { httpUrl, optionalHttpUrl } from "./validation";
import { sessionFingerprint } from "./session-fingerprint";

/** Regression tests for the November 2026 security and reliability audit. */

describe("user-supplied links", () => {
  test("only http(s) links pass validation", () => {
    for (const url of ["https://example.com/work", "http://example.org/a?b=1"]) assert.equal(httpUrl().safeParse(url).success, true, url);
    for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "JaVaScRiPt:alert(1)", "vbscript:msgbox", "ftp://example.com/file", "file:///etc/passwd"]) {
      assert.equal(httpUrl().safeParse(url).success, false, url);
    }
    assert.equal(optionalHttpUrl().safeParse("").success, true);
  });

  test("stored links render only when they are http(s)", () => {
    assert.equal(safeExternalHref("https://example.com/x"), "https://example.com/x");
    assert.equal(safeExternalHref("javascript:alert(1)"), null);
    assert.equal(safeExternalHref("data:text/html,hi"), null);
    assert.equal(safeExternalHref("not a url"), null);
    assert.equal(safeExternalHref(null), null);
  });
});

describe("session fingerprint", () => {
  test("changes when the password hash changes and does not reveal it", () => {
    const before = sessionFingerprint("$2b$12$abcdefghijklmnopqrstuuvwxyz0123456789ABCDEFGHIJKLMNOP");
    const afterReset = sessionFingerprint("$2b$12$ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210zyxwvutsrqponmlk");
    assert.notEqual(before, afterReset);
    assert.equal(before, sessionFingerprint("$2b$12$abcdefghijklmnopqrstuuvwxyz0123456789ABCDEFGHIJKLMNOP"));
    assert.equal(before.length, 32);
    assert.ok(!before.includes("abcdefghij"));
  });
});

const enabled = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";
const run = `sa_${randomUUID().slice(0, 8)}`;

describe("security audit (database)", { skip: !enabled && "DATABASE_URL is not set" }, () => {
  let db: typeof import("./db").db;
  const users: string[] = [];
  const orgs: string[] = [];

  before(async () => {
    process.env.PRIVATE_STORAGE_DRIVER = "database";
    ({ db } = await import("./db"));
  });

  after(async () => {
    if (!db) return;
    await db.storedObject.deleteMany({ where: { key: { startsWith: run } } });
    await db.project.deleteMany({ where: { organisationId: { in: orgs } } });
    await db.organisation.deleteMany({ where: { id: { in: orgs } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  test("database storage driver stores, reads and removes private bytes", async () => {
    const { privateStorage, storageDriver } = await import("./storage");
    assert.equal(storageDriver(), "database");
    const key = `${run}/2026-11/${randomUUID()}`;
    await privateStorage().put(key, Buffer.from("%PDF-1.7 stored in postgres"));
    assert.equal((await privateStorage().get(key)).toString(), "%PDF-1.7 stored in postgres");
    await privateStorage().remove(key);
    await assert.rejects(() => privateStorage().get(key));
  });

  test("declined or invited professionals cannot open an active or completed project", async () => {
    const { getProjectAccess } = await import("./project-access");
    const makeUser = async (label: string) => {
      const user = await db.user.create({ data: { name: label, email: `${run}_${label}@example.test`, passwordHash: "x" } });
      users.push(user.id);
      return user;
    };
    const owner = await makeUser("owner");
    const [delivered, declined, invitedLate] = await Promise.all([makeUser("delivered"), makeUser("declined"), makeUser("invited")]);
    const org = await db.organisation.create({ data: { name: `${run} org`, memberships: { create: { userId: owner.id, role: "OWNER" } } } });
    orgs.push(org.id);
    const project = await db.project.create({ data: { organisationId: org.id, createdById: owner.id, title: `${run} project`, status: "MATCHING" } });
    const profiles = await Promise.all([delivered, declined, invitedLate].map((user) => db.professionalProfile.create({ data: { userId: user.id, categories: [], skills: [], languages: [] } })));
    await db.engagement.createMany({ data: [
      { projectId: project.id, professionalProfileId: profiles[0].id, createdById: owner.id, status: "ACTIVE" },
      { projectId: project.id, professionalProfileId: profiles[1].id, createdById: owner.id, status: "CANCELLED" },
      { projectId: project.id, professionalProfileId: profiles[2].id, createdById: owner.id, status: "INVITED" },
    ] });

    // While matching, an open invitation may view the opportunity; a cancelled one may not.
    assert.equal((await getProjectAccess(project.id, invitedLate.id)).canView, true);
    assert.equal((await getProjectAccess(project.id, declined.id)).canView, false);

    for (const status of ["ACTIVE", "COMPLETED"] as const) {
      await db.project.update({ where: { id: project.id }, data: { status } });
      assert.equal((await getProjectAccess(project.id, owner.id)).canView, true, `owner ${status}`);
      assert.equal((await getProjectAccess(project.id, delivered.id)).canView, true, `delivering professional ${status}`);
      assert.equal((await getProjectAccess(project.id, declined.id)).canView, false, `declined professional ${status}`);
      assert.equal((await getProjectAccess(project.id, invitedLate.id)).canView, false, `invited professional ${status}`);
    }
  });
});
