import test from "node:test";
import assert from "node:assert/strict";
import { detectIntentFallback } from "@/lib/slm/intent-parser";

test("detectIntentFallback classifies harder-plan requests as plan_level_change", () => {
  const parsed = detectIntentFallback("This novice plan is too easy, make it harder.");
  assert.equal(parsed.type, "plan_level_change");
  assert.equal(parsed.params.direction, "increase");
});

test("detectIntentFallback keeps load-only requests as volume_change", () => {
  const parsed = detectIntentFallback("Please increase my weekly mileage by a little.");
  assert.equal(parsed.type, "volume_change");
  assert.equal(parsed.params.direction, "increase");
});

test("detectIntentFallback infers workout difficulty changeType", () => {
  const parsed = detectIntentFallback("Add more tempo and interval sessions.");
  assert.equal(parsed.type, "plan_level_change");
  assert.equal(parsed.params.changeType, "workout_difficulty");
});

test("detectIntentFallback handles explicit base-plan switch wording", () => {
  const parsed = detectIntentFallback("can you switch the base plan to intermediate");
  assert.equal(parsed.type, "plan_level_change");
  assert.equal(parsed.params.changeType, "workout_difficulty");
  assert.equal(parsed.params.direction, "increase");
});
