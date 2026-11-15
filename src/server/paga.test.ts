import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { getPagaConfiguration, pagaBusinessHeaders, pagaCollectHeaders, pagaSha512, verifyPagaCheckoutNotification, verifyPagaSha512 } from "./paga";

test("Paga request hash uses ordered values, empty strings for omitted values, then hash key", () => {
  const values = ["REF-1", 200, "NGN", "08012345678", null] as const;
  const expected = createHash("sha512").update("REF-1200NGN08012345678hash-secret").digest("hex");
  assert.equal(pagaSha512(values, "hash-secret"), expected);
  assert.equal(verifyPagaSha512(values, "hash-secret", expected), true);
  assert.equal(verifyPagaSha512(["REF-2", ...values.slice(1)], "hash-secret", expected), false);
  assert.equal(verifyPagaSha512(values, "hash-secret", "bad"), false);
});

test("Paga Checkout callback signature follows its documented field order", () => {
  const input = { amount: "10.00", timeStamp: "2025-08-26T13:36:04", paymentReference: "Paga_Auto_Ref_1" };
  const hash = pagaSha512([input.amount, input.timeStamp, input.paymentReference], "checkout-hash");
  assert.equal(verifyPagaCheckoutNotification({ ...input, hash }, "checkout-hash"), true);
  assert.equal(verifyPagaCheckoutNotification({ ...input, amount: "10", hash }, "checkout-hash"), false);
});

test("Collect and Business API auth headers use their separate documented schemes", () => {
  const config = { publicKey: "public", secretKey: "secret", hashKey: "hash" };
  const collect = pagaCollectHeaders(config, ["REF"]);
  assert.equal(collect.Authorization, `Basic ${Buffer.from("public:secret").toString("base64")}`);
  assert.equal(collect.hash, pagaSha512(["REF"], "hash"));
  const business = pagaBusinessHeaders(config, ["REF"]);
  assert.equal(business.principal, "public");
  assert.equal(business.credentials, "secret");
  assert.equal(business.hash, pagaSha512(["REF"], "hash"));
  assert.equal("Authorization" in business, false);
});

test("Paga operations stay unavailable without approved sandbox configuration", () => {
  const original = { environment: process.env.PAGA_ENVIRONMENT, enabled: process.env.PAGA_ENABLE_SANDBOX, pub: process.env.PAGA_SANDBOX_PUBLIC_KEY, secret: process.env.PAGA_SANDBOX_SECRET_KEY, hash: process.env.PAGA_SANDBOX_HASH_KEY };
  try {
    process.env.PAGA_ENVIRONMENT = "sandbox";
    process.env.PAGA_ENABLE_SANDBOX = "false";
    assert.throws(() => getPagaConfiguration(), /Sandbox is disabled/);
    process.env.PAGA_ENABLE_SANDBOX = "true";
    assert.throws(() => getPagaConfiguration(), /keys are required/);
    process.env.PAGA_SANDBOX_PUBLIC_KEY = "test-public";
    process.env.PAGA_SANDBOX_SECRET_KEY = "test-secret";
    process.env.PAGA_SANDBOX_HASH_KEY = "test-hash";
    assert.equal(getPagaConfiguration().collectBaseUrl, "https://beta-collect.paga.com");
    assert.throws(() => getPagaConfiguration("live"), /Live operations are disabled/);
  } finally {
    for (const [key, value] of [["PAGA_ENVIRONMENT", original.environment], ["PAGA_ENABLE_SANDBOX", original.enabled], ["PAGA_SANDBOX_PUBLIC_KEY", original.pub], ["PAGA_SANDBOX_SECRET_KEY", original.secret], ["PAGA_SANDBOX_HASH_KEY", original.hash]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
