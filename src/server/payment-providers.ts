import { createHmac, randomUUID } from "node:crypto";
import { getPagaBankTransferStatus, getPagaConfiguration, getPagaOperationStatus } from "@/server/paga";

/**
 * Provider-independent payment boundary.
 *
 * Every adapter reports which operations it supports and whether it is approved for
 * use. Callers must check `status` before treating any result as real. Kintovo does
 * not hold funds: no adapter here represents escrow, custody, or conditional release.
 */
export type ProviderStatus =
  | { kind: "SIMULATED"; label: string }
  | { kind: "SANDBOX"; label: string }
  | { kind: "EVALUATION_ONLY"; label: string }
  | { kind: "DISABLED"; label: string };

export type ProviderOperation = "collection" | "transactionStatus" | "payout" | "payoutStatus" | "refund" | "webhook" | "reconciliation";
export type TransactionState = "PENDING" | "SUCCEEDED" | "FAILED" | "REVERSED" | "UNKNOWN";
export type TransactionResult = { state: TransactionState; providerReference: string | null; simulated: boolean; raw?: unknown };

export class ProviderNotApprovedError extends Error {
  constructor(provider: string, operation: ProviderOperation) {
    super(`${provider} is not approved for ${operation}. Kintovo keeps this adapter for technical evaluation only.`);
    this.name = "ProviderNotApprovedError";
  }
}

export interface PaymentProviderAdapter {
  readonly name: string;
  status(): ProviderStatus;
  supports(operation: ProviderOperation): boolean;
  collect(input: { reference: string; amountMinor: bigint; currency: string; description: string }): Promise<TransactionResult>;
  transactionStatus(reference: string): Promise<TransactionResult>;
  payout(input: { reference: string; amountMinor: bigint; currency: string; destinationId: string }): Promise<TransactionResult>;
  payoutStatus(reference: string): Promise<TransactionResult>;
  refund(input: { reference: string; amountMinor: bigint; currency: string }): Promise<TransactionResult>;
}

/** Local simulation. Never contacts a bank or wallet; every result is marked simulated. */
export class MockPaymentAdapter implements PaymentProviderAdapter {
  readonly name = "MOCK";
  constructor(private readonly outcome: "SUCCEEDED" | "FAILED" = "SUCCEEDED") {}
  status(): ProviderStatus { return { kind: "SIMULATED", label: "Simulated — no money moves" }; }
  supports() { return true; }
  private result(state: TransactionState = this.outcome): TransactionResult { return { state, providerReference: `mock_${randomUUID()}`, simulated: true }; }
  async collect(_input?: unknown) { void _input; return this.result(); }
  async transactionStatus(_reference?: string) { void _reference; return this.result(); }
  async payout(_input?: unknown) { void _input; return this.result(); }
  async payoutStatus(_reference?: string) { void _reference; return this.result(); }
  async refund(_input?: unknown) { void _input; return this.result(this.outcome === "SUCCEEDED" ? "REVERSED" : "FAILED"); }

  /** Builds a correctly signed test webhook body for /api/webhooks/payments. */
  static signedWebhook(secret: string, event: { eventId?: string; type: "payment.succeeded" | "payment.failed" | "payment.refunded"; reference: string; amount: number; currency: string }) {
    const body = JSON.stringify({ eventId: event.eventId ?? `mock_evt_${randomUUID()}`, type: event.type, reference: event.reference, amount: event.amount, currency: event.currency });
    return { body, signature: `sha256=${createHmac("sha256", secret).update(body).digest("hex")}` };
  }
}

function mapPagaStatus(response: Record<string, unknown>): TransactionState {
  const code = String(response.responseCode ?? response.statusCode ?? "");
  if (code === "0") return typeof response.reversalId === "string" && response.reversalId ? "REVERSED" : "SUCCEEDED";
  if (code === "1") return "PENDING";
  if (["-2", "-3", "114", "115", "121"].includes(code)) return "FAILED";
  return "UNKNOWN";
}

/**
 * Paga Sandbox status adapter. Collection and payout initiation stay in the existing
 * audited Paga workflows (funding, compensation transfers, Finance-reviewed payouts);
 * this adapter exposes status retrieval and reconciliation through the common interface.
 */
export class PagaStatusAdapter implements PaymentProviderAdapter {
  readonly name = "PAGA";
  status(): ProviderStatus {
    const configured = process.env.PAGA_ENABLE_SANDBOX === "true" && Boolean(process.env.PAGA_SANDBOX_SECRET_KEY);
    return configured ? { kind: "SANDBOX", label: "Paga Sandbox — test funds only" } : { kind: "DISABLED", label: "Paga Sandbox is not configured" };
  }
  supports(operation: ProviderOperation) { return ["transactionStatus", "payoutStatus", "webhook", "reconciliation"].includes(operation); }
  private ensure() { if (this.status().kind !== "SANDBOX") throw new Error("Paga Sandbox is not configured."); getPagaConfiguration(); }
  async collect(): Promise<TransactionResult> { throw new ProviderNotApprovedError(this.name, "collection"); }
  async payout(): Promise<TransactionResult> { throw new ProviderNotApprovedError(this.name, "payout"); }
  async refund(): Promise<TransactionResult> { throw new ProviderNotApprovedError(this.name, "refund"); }
  async transactionStatus(reference: string) { this.ensure(); const raw = await getPagaOperationStatus(reference) as Record<string, unknown>; return { state: mapPagaStatus(raw), providerReference: reference, simulated: false, raw }; }
  async payoutStatus(reference: string) { this.ensure(); const raw = await getPagaBankTransferStatus(reference) as Record<string, unknown>; return { state: mapPagaStatus(raw), providerReference: reference, simulated: false, raw }; }
}

/**
 * Busha evaluation adapter. Busha (including its Pledges API) is a technical
 * candidate only: Kintovo has no approval for its marketplace, milestone-funding,
 * or third-party settlement model with Busha. Every money-moving operation refuses.
 * Enabling requires a written provider approval, legal review, credentials, and a
 * code change here — not an environment toggle.
 */
export class BushaEvaluationAdapter implements PaymentProviderAdapter {
  readonly name = "BUSHA";
  status(): ProviderStatus { return { kind: "EVALUATION_ONLY", label: "Busha — evaluation only, not approved" }; }
  supports() { return false; }
  async collect(): Promise<TransactionResult> { throw new ProviderNotApprovedError(this.name, "collection"); }
  async transactionStatus(): Promise<TransactionResult> { throw new ProviderNotApprovedError(this.name, "transactionStatus"); }
  async payout(): Promise<TransactionResult> { throw new ProviderNotApprovedError(this.name, "payout"); }
  async payoutStatus(): Promise<TransactionResult> { throw new ProviderNotApprovedError(this.name, "payoutStatus"); }
  async refund(): Promise<TransactionResult> { throw new ProviderNotApprovedError(this.name, "refund"); }
}

export function getPaymentProvider(name: string): PaymentProviderAdapter {
  switch (name.toUpperCase()) {
    case "MOCK": return new MockPaymentAdapter();
    case "PAGA": return new PagaStatusAdapter();
    case "BUSHA": return new BushaEvaluationAdapter();
    default: throw new Error(`Unknown payment provider: ${name}`);
  }
}

export const evaluatedProviders = ["MOCK", "PAGA", "BUSHA"] as const;
