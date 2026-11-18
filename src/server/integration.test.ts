import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

/**
 * Database-backed integration tests. They create uniquely named fictional records,
 * exercise real route handlers and services, and delete everything afterwards.
 * Skipped automatically when DATABASE_URL is not configured.
 */
const enabled = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";
const run = `it_${randomUUID().slice(0, 8)}`;
const SECRET = "integration-test-secret-value";

describe("integration (database)", { skip: !enabled && "DATABASE_URL is not set" }, () => {
  let db: typeof import("./db").db;
  let uploadDir = "";
  const ids = { users: [] as string[], orgs: [] as string[] };

  before(async () => {
    uploadDir = await mkdtemp(path.join(os.tmpdir(), "kintovo-it-"));
    process.env.PRIVATE_UPLOAD_DIR = uploadDir;
    process.env.ATTRIBUTION_WEBHOOK_SECRET = SECRET;
    process.env.PAYMENT_MODE = "provider";
    process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
    process.env.PAYMENT_PROVIDER_NAME = `MOCK_${run}`;
    ({ db } = await import("./db"));
  });

  after(async () => {
    if (!db) return;
    await db.paymentWebhookEvent.deleteMany({ where: { OR: [{ eventId: { startsWith: run } }, { provider: `MOCK_${run}` }] } });
    await db.ledgerEntry.deleteMany({ where: { obligation: { reference: { startsWith: run } } } });
    await db.compensationObligation.deleteMany({ where: { reference: { startsWith: run } } });
    await db.campaign.deleteMany({ where: { organisationId: { in: ids.orgs } } });
    await db.project.deleteMany({ where: { organisationId: { in: ids.orgs } } });
    await db.organisation.deleteMany({ where: { id: { in: ids.orgs } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: ids.users } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await db.$disconnect();
    await rm(uploadDir, { recursive: true, force: true });
  });

  async function user(label: string) {
    const created = await db.user.create({ data: { email: `${run}.${label}@example.test`, name: `${label} (integration test)`, passwordHash: "not-a-real-hash" } });
    ids.users.push(created.id);
    return created;
  }
  async function organisation(ownerId: string) {
    const org = await db.organisation.create({ data: { name: `Org ${run} (fictional)`, memberships: { create: { userId: ownerId, role: "OWNER", canApproveSpend: true } } } });
    ids.orgs.push(org.id);
    return org;
  }

  test("organisation isolation: another organisation cannot view a private project", async () => {
    const { getProjectAccess } = await import("./project-access");
    const ownerA = await user("ownerA");
    const ownerB = await user("ownerB");
    const orgA = await organisation(ownerA.id);
    await organisation(ownerB.id);
    const project = await db.project.create({ data: { organisationId: orgA.id, createdById: ownerA.id, title: "Private brief", status: "ACTIVE", brief: { create: { objective: "Integration isolation check" } } } });
    assert.equal((await getProjectAccess(project.id, ownerA.id)).canView, true);
    assert.equal((await getProjectAccess(project.id, ownerB.id)).canView, false);
    assert.equal((await getProjectAccess(project.id, ownerB.id)).canManage, false);
  });

  test("notifications: preferences suppress optional categories but never required ones", async () => {
    const { notify } = await import("./notifications");
    const member = await user("notified");
    await db.notificationPreference.createMany({ data: [
      { userId: member.id, category: "MESSAGE", inApp: false, email: false },
      { userId: member.id, category: "PAYMENT", inApp: false, email: false },
    ] });
    await notify(db, [
      { userId: member.id, category: "MESSAGE", title: "Muted", body: "Should not be stored" },
      { userId: member.id, category: "PAYMENT", title: "Compensation recorded", body: "Required", simulated: true },
      { userId: member.id, category: "TASK", title: "Task assigned", body: "Default on" },
    ]);
    const rows = await db.notification.findMany({ where: { userId: member.id }, orderBy: { title: "asc" } });
    assert.deepEqual(rows.map((row) => row.title), ["Task assigned", "[Simulated] Compensation recorded"].sort());
  });

  test("private storage: stores bytes outside the web root and reads them back", async () => {
    const { storeUpload, privateStorage, isUploadError } = await import("./storage");
    const file = new File([Buffer.from("%PDF-1.7 integration test")], "evidence.pdf", { type: "application/pdf" });
    const stored = await storeUpload(file, "DISPUTE_EVIDENCE");
    assert.ok(stored && !isUploadError(stored));
    if (!stored || isUploadError(stored)) return;
    assert.ok(path.resolve(uploadDir, stored.storageKey).startsWith(uploadDir));
    assert.equal((await privateStorage().get(stored.storageKey)).toString(), "%PDF-1.7 integration test");
    const rejected = await storeUpload(new File([Buffer.from("MZ binary")], "evidence.pdf", { type: "application/pdf" }), "DISPUTE_EVIDENCE");
    assert.ok(rejected && isUploadError(rejected));
  });

  test("attribution webhook: verifies signatures, deduplicates, enforces the window, and reverses refunded bonuses", async () => {
    const { POST } = await import("../../app/api/webhooks/attribution/route");
    const owner = await user("campaignOwner");
    const creatorUser = await user("creator");
    const org = await organisation(owner.id);
    const creator = await db.creatorProfile.create({ data: { userId: creatorUser.id, isPublished: true } });
    const campaign = await db.campaign.create({ data: { organisationId: org.id, createdById: owner.id, title: "IT campaign", brief: "Integration", status: "ACTIVE", compensationModel: "HYBRID", attributionWindowDays: 7, startsAt: new Date(Date.now() - 30 * 86_400_000) } });
    const entry = await db.campaignCreator.create({ data: { campaignId: campaign.id, creatorId: creator.id, status: "ACTIVE", fixedFee: 1000, bonusRate: 1000, referralCode: `${run}-ref` } });
    await db.campaignClick.create({ data: { campaignCreatorId: entry.id, sourceEventId: `${run}-click`, occurredAt: new Date(Date.now() - 2 * 86_400_000) } });
    const send = (payload: object, secret = SECRET) => {
      const body = JSON.stringify(payload);
      const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
      return POST(new Request("http://test/api/webhooks/attribution", { method: "POST", body, headers: { "x-kintovo-signature": signature } }));
    };
    const order = { eventId: `${run}-order-1`, type: "order", referralCode: entry.referralCode, orderReference: `${run}-ORD-1`, amount: 50_000, currency: "NGN", occurredAt: new Date().toISOString(), environment: "test" };
    assert.equal((await send(order, "wrong-secret")).status, 401);
    assert.equal((await send(order)).status, 200);
    const duplicate = await (await send(order)).json();
    assert.equal(duplicate.duplicate, true);
    assert.equal(await db.campaignAttribution.count({ where: { campaignCreatorId: entry.id } }), 1);
    const recorded = await db.campaignAttribution.findFirstOrThrow({ where: { campaignCreatorId: entry.id } });
    assert.equal(recorded.status, "PENDING");
    assert.equal(recorded.simulated, true);

    const stale = { ...order, eventId: `${run}-order-old`, orderReference: `${run}-ORD-OLD`, occurredAt: new Date(Date.now() - 3 * 86_400_000).toISOString() };
    await send(stale);
    const staleRow = await db.campaignAttribution.findFirstOrThrow({ where: { orderReference: `${run}-ORD-OLD` } });
    assert.equal(staleRow.status, "REJECTED", "an order before the only click is not attributable");

    const obligation = await db.compensationObligation.create({ data: { reference: `${run}-BONUS`, attributionId: recorded.id, recipientId: creatorUser.id, amount: 5000, currency: "NGN", provider: "MOCK", simulated: true } });
    await db.campaignAttribution.update({ where: { id: recorded.id }, data: { status: "APPROVED", bonusAmount: 5000 } });
    assert.equal((await send({ ...order, eventId: `${run}-refund-1`, type: "refund" })).status, 200);
    assert.equal((await db.campaignAttribution.findUniqueOrThrow({ where: { id: recorded.id } })).status, "REFUNDED");
    assert.equal((await db.compensationObligation.findUniqueOrThrow({ where: { id: obligation.id } })).status, "REFUNDED");
    const reversal = await db.ledgerEntry.findFirstOrThrow({ where: { obligationId: obligation.id, kind: "BONUS_REVERSED_REFUND" } });
    assert.equal(reversal.amount, -5000);
    assert.equal((await send({ ...order, eventId: `${run}-live`, environment: "live" })).status, 403, "live events stay disabled");
  });

  test("payment webhook: a signed event settles a non-simulated obligation once and records the ledger", async () => {
    const { POST } = await import("../../app/api/webhooks/payments/route");
    const { MockPaymentAdapter } = await import("./payment-providers");
    const obligation = await db.compensationObligation.create({ data: { reference: `${run}-PAY`, amount: 7000, currency: "NGN", provider: "MOCK", simulated: false } });
    const { body, signature } = MockPaymentAdapter.signedWebhook(SECRET, { eventId: `${run}-pay-evt`, type: "payment.succeeded", reference: obligation.reference, amount: 7000, currency: "NGN" });
    const request = () => POST(new Request("http://test/api/webhooks/payments", { method: "POST", body, headers: { "x-kintovo-signature": signature } }));
    assert.equal((await request()).status, 200);
    const second = await (await request()).json();
    assert.equal(second.duplicate, true);
    const settled = await db.compensationObligation.findUniqueOrThrow({ where: { id: obligation.id }, include: { ledgerEntries: true } });
    assert.equal(settled.status, "PROVIDER_CONFIRMED_PAID");
    assert.equal(settled.ledgerEntries.filter((entry) => entry.kind === "PROVIDER_SETTLEMENT").length, 1);
  });
});
