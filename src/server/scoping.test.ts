import assert from "node:assert/strict";
import test from "node:test";
import { suggestWorkstreams } from "./scoping";

test("suggests audience research and creative work for a Nigeria launch objective", () => {
  const suggestions = suggestWorkstreams("Launch our productivity app in Nigeria and research the student audience with localised creative.");
  assert.ok(suggestions.some((item) => item.name === "Market research"));
  assert.ok(suggestions.some((item) => item.name === "Localised creative"));
  assert.ok(suggestions.every((item) => item.capabilities.length > 0));
});

test("keeps scope suggestions deterministic and editable in their returned data", () => {
  const objective = "Build a creator campaign to grow digital reach";
  const first = suggestWorkstreams(objective);
  const second = suggestWorkstreams(objective);
  assert.deepEqual(first, second);
  assert.ok(first.some((item) => item.name === "Creator distribution"));
});

test("provides a transparent fallback when an objective has no matched terms", () => {
  const suggestions = suggestWorkstreams("Improve what happens next.");
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].name, "Discovery and planning");
});
