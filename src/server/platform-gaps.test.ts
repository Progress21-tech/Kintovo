import assert from "node:assert/strict";
import test from "node:test";
import { countsAfterRefund, evaluateConversion, summariseCampaign, validateCompensation } from "./attribution";
import { canTransitionDispute } from "./disputes";
import { canAccessFile } from "./file-access";
import { channelEnabled, labelSimulated } from "./notification-rules";
import { BushaEvaluationAdapter, MockPaymentAdapter, ProviderNotApprovedError, getPaymentProvider } from "./payment-providers";
import { verifyPaymentWebhookSignature } from "./payments";
import { validateUpload } from "./storage";
import { canProposeSettlement, canRequestRevision, validateSettlementAmount } from "./workflow";

const day = 86_400_000;
const pdfHead = Buffer.from("%PDF-1.7\n%....", "latin1");
const pngHead = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);

test("uploads: accepts a real PDF and normalises its name", () => {
  const result = validateUpload({ name: "Final  deliverable<script>.pdf", type: "application/pdf", size: 1000, head: pdfHead });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.safeName, "Final  deliverablescript.pdf");
});

test("uploads: rejects spoofed type, wrong extension, oversize, empty, unknown type, and binary text", () => {
  assert.equal(validateUpload({ name: "x.pdf", type: "application/pdf", size: 10, head: pngHead }).ok, false);
  assert.equal(validateUpload({ name: "x.exe", type: "application/pdf", size: 10, head: pdfHead }).ok, false);
  assert.equal(validateUpload({ name: "x.pdf", type: "application/pdf", size: 20 * 1024 * 1024, head: pdfHead }, 15 * 1024 * 1024).ok, false);
  assert.equal(validateUpload({ name: "x.pdf", type: "application/pdf", size: 0, head: pdfHead }).ok, false);
  assert.equal(validateUpload({ name: "x.html", type: "text/html", size: 10, head: Buffer.from("<html>") }).ok, false);
  assert.equal(validateUpload({ name: "x.txt", type: "text/plain", size: 10, head: Buffer.from([0x41, 0x00, 0x42]) }).ok, false);
  assert.equal(validateUpload({ name: "image.png", type: "image/png", size: 10, head: pngHead }).ok, true);
});

test("file access: identity evidence is visible only to its owner and platform Admins", () => {
  const base = { ownerId: "owner", purpose: "IDENTITY_EVIDENCE" as const, projectParticipant: true, publicPortfolio: true };
  assert.equal(canAccessFile({ ...base, viewerId: "owner", platformRole: "USER" }), true);
  assert.equal(canAccessFile({ ...base, viewerId: "admin", platformRole: "ADMIN" }), true);
  assert.equal(canAccessFile({ ...base, viewerId: "ops", platformRole: "OPERATIONS" }), false);
  assert.equal(canAccessFile({ ...base, viewerId: "finance", platformRole: "FINANCE" }), false);
  assert.equal(canAccessFile({ ...base, viewerId: "buyer", platformRole: "USER" }), false);
});

test("file access: project files require participation; portfolio files require a public item", () => {
  const project = { ownerId: "talent", purpose: "MILESTONE_SUBMISSION" as const };
  assert.equal(canAccessFile({ ...project, viewerId: "buyer", platformRole: "USER", projectParticipant: true }), true);
  assert.equal(canAccessFile({ ...project, viewerId: "other-org", platformRole: "USER", projectParticipant: false }), false);
  assert.equal(canAccessFile({ ...project, viewerId: "ops", platformRole: "OPERATIONS" }), true);
  assert.equal(canAccessFile({ ownerId: "talent", purpose: "PORTFOLIO", viewerId: "buyer", platformRole: "USER", publicPortfolio: false }), false);
  assert.equal(canAccessFile({ ownerId: "talent", purpose: "PORTFOLIO", viewerId: "buyer", platformRole: "USER", publicPortfolio: true }), true);
  assert.equal(canAccessFile({ ownerId: "talent", purpose: "TRUST_EVIDENCE", viewerId: "buyer", platformRole: "USER", projectParticipant: true }), false);
  assert.equal(canAccessFile({ ownerId: "creator", purpose: "CAMPAIGN_CONTENT", viewerId: "stranger", platformRole: "USER", campaignParticipant: false }), false);
});

test("notifications: required categories stay in-app, email is opt-in, simulated payments are labelled", () => {
  const prefs = [{ category: "PAYMENT", inApp: false, email: true }, { category: "MESSAGE", inApp: false, email: false }];
  assert.equal(channelEnabled(prefs, "PAYMENT", "inApp"), true);
  assert.equal(channelEnabled(prefs, "PAYMENT", "email"), true);
  assert.equal(channelEnabled(prefs, "MESSAGE", "inApp"), false);
  assert.equal(channelEnabled(prefs, "TASK", "inApp"), true);
  assert.equal(channelEnabled(prefs, "TASK", "email"), false);
  assert.equal(labelSimulated("Compensation recorded", true), "[Simulated] Compensation recorded");
  assert.equal(labelSimulated("Simulated payout", true), "Simulated payout");
  assert.equal(labelSimulated("Compensation recorded", false), "Compensation recorded");
});

test("settlement and revisions: partial settlements stay below the agreed amount and follow review states", () => {
  assert.equal(validateSettlementAmount(50_000, 100_000), null);
  assert.notEqual(validateSettlementAmount(100_000, 100_000), null);
  assert.notEqual(validateSettlementAmount(0, 100_000), null);
  assert.notEqual(validateSettlementAmount(1.5, 100_000), null);
  assert.equal(canProposeSettlement("IN_REVIEW"), true);
  assert.equal(canProposeSettlement("DISPUTED"), true);
  assert.equal(canProposeSettlement("APPROVED"), false);
  assert.equal(canProposeSettlement("IN_PROGRESS"), false);
  assert.equal(canRequestRevision(1, 2), true);
  assert.equal(canRequestRevision(2, 2), false);
});

test("disputes: lifecycle prevents reopening closed cases and skipping back from resolution", () => {
  assert.equal(canTransitionDispute("OPEN", "AWAITING_EVIDENCE"), true);
  assert.equal(canTransitionDispute("UNDER_REVIEW", "RESOLVED"), true);
  assert.equal(canTransitionDispute("RESOLVED", "CLOSED"), true);
  assert.equal(canTransitionDispute("RESOLVED", "UNDER_REVIEW"), false);
  assert.equal(canTransitionDispute("CLOSED", "OPEN"), false);
});

test("compensation models: fixed, hybrid, and commission-only are validated", () => {
  assert.equal(validateCompensation("FIXED", 150_000, 0), null);
  assert.notEqual(validateCompensation("FIXED", 150_000, 500), null);
  assert.equal(validateCompensation("HYBRID", 150_000, 1000), null);
  assert.notEqual(validateCompensation("HYBRID", 0, 1000), null);
  assert.equal(validateCompensation("COMMISSION_ONLY", 0, 1500), null);
  assert.notEqual(validateCompensation("COMMISSION_ONLY", 10_000, 1500), null);
  assert.notEqual(validateCompensation("HYBRID", 1, 20_000), null);
});

test("attribution: last click within the window counts; clicks alone, late, or early events do not", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const base = { eventType: "ORDER" as const, occurredAt: now, windowDays: 14, campaignStartsAt: new Date(now.getTime() - 30 * day), campaignEndsAt: new Date(now.getTime() + 10 * day) };
  assert.deepEqual(evaluateConversion({ ...base, lastClickAt: new Date(now.getTime() - 3 * day) }), { eligible: true });
  assert.equal(evaluateConversion({ ...base, lastClickAt: null }).eligible, false);
  assert.equal(evaluateConversion({ ...base, lastClickAt: new Date(now.getTime() - 20 * day) }).eligible, false);
  assert.equal(evaluateConversion({ ...base, lastClickAt: new Date(now.getTime() + day) }).eligible, false);
  assert.equal(evaluateConversion({ ...base, campaignStartsAt: new Date(now.getTime() + day), lastClickAt: now }).eligible, false);
  assert.equal(evaluateConversion({ ...base, campaignEndsAt: new Date(now.getTime() - 20 * day), lastClickAt: new Date(now.getTime() - day) }).eligible, false);
  assert.equal(countsAfterRefund("EXCLUDE_REFUNDED"), false);
  assert.equal(countsAfterRefund("INCLUDE_REFUNDED"), true);
});

test("campaign report: totals come only from recorded events and flag simulated data", () => {
  const summary = summariseCampaign({
    fixedFees: 150_000, clicks: 24, approvedContent: 2, publishedContent: 1,
    attributions: [
      { status: "APPROVED", eventType: "ORDER", amount: 50_000, bonusAmount: 5_000, simulated: true },
      { status: "PENDING", eventType: "ORDER", amount: 30_000, bonusAmount: 0, simulated: false },
      { status: "REFUNDED", eventType: "ORDER", amount: 20_000, bonusAmount: 2_000, simulated: false },
      { status: "APPROVED", eventType: "LEAD", amount: 0, bonusAmount: 0, simulated: false },
    ],
  });
  assert.equal(summary.eligibleConversions, 1);
  assert.equal(summary.pendingConversions, 1);
  assert.equal(summary.refunds, 1);
  assert.equal(summary.leads, 1);
  assert.equal(summary.attributedRevenue, 50_000);
  assert.equal(summary.earnedBonuses, 5_000);
  assert.equal(summary.expenditure, 155_000);
  assert.equal(summary.includesSimulatedData, true);
});

test("payment providers: Busha refuses every operation; mock results are always simulated", async () => {
  const busha = new BushaEvaluationAdapter();
  assert.equal(busha.status().kind, "EVALUATION_ONLY");
  await assert.rejects(busha.collect(), ProviderNotApprovedError);
  await assert.rejects(busha.payout(), ProviderNotApprovedError);
  const mock = getPaymentProvider("mock");
  const result = await mock.collect({ reference: "R1", amountMinor: BigInt(100), currency: "NGN", description: "test" });
  assert.equal(result.simulated, true);
  assert.equal(result.state, "SUCCEEDED");
  assert.equal((await new MockPaymentAdapter("FAILED").payout({ reference: "R2", amountMinor: BigInt(1), currency: "NGN", destinationId: "d" })).state, "FAILED");
  assert.throws(() => getPaymentProvider("unknown"));
});

test("mock adapter builds webhooks that pass signature verification", () => {
  const { body, signature } = MockPaymentAdapter.signedWebhook("test-secret", { type: "payment.succeeded", reference: "MILESTONE-1", amount: 5000, currency: "NGN" });
  assert.equal(verifyPaymentWebhookSignature(body, signature, "test-secret"), true);
  assert.equal(verifyPaymentWebhookSignature(body, signature, "other-secret"), false);
  assert.equal(verifyPaymentWebhookSignature(`${body} `, signature, "test-secret"), false);
});
