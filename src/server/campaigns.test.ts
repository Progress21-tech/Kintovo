import assert from "node:assert/strict";
import test from "node:test";
import { calculateCreatorBonus, validManualAttributionEventId } from "./campaigns";

test("campaign bonus uses basis points and floors to whole currency units", () => {
  assert.equal(calculateCreatorBonus(100_000, 500, null, 0), 5_000);
  assert.equal(calculateCreatorBonus(101, 100, null, 0), 1);
});

test("campaign bonus respects cumulative caps", () => {
  assert.equal(calculateCreatorBonus(100_000, 1_000, 7_500, 5_000), 2_500);
  assert.equal(calculateCreatorBonus(100_000, 1_000, 7_500, 7_500), 0);
});

test("manual conversion event identifiers are bounded and plain", () => {
  assert.equal(validManualAttributionEventId("order-2026:abc"), true);
  assert.equal(validManualAttributionEventId("<script>"), false);
  assert.equal(validManualAttributionEventId("x"), false);
});
