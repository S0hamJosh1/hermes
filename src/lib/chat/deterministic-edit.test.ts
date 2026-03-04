import test from "node:test";
import assert from "node:assert/strict";
import { extractDeterministicEdit } from "@/lib/chat/deterministic-edit";

test("extractDeterministicEdit parses workload increase with explicit percent", () => {
  const parsed = extractDeterministicEdit("Please increase my workload by 15% this week.");
  assert.ok(parsed);
  assert.equal(parsed?.intentType, "volume_change");
  assert.equal(parsed?.action, "volume_change");
  assert.equal(parsed?.params.direction, "increase");
  assert.equal(parsed?.params.amount, 0.15);
});

test("extractDeterministicEdit parses busy-day reschedule request", () => {
  const parsed = extractDeterministicEdit("I'm busy Thursday, move my run to Saturday.");
  assert.ok(parsed);
  assert.equal(parsed?.intentType, "reschedule");
  assert.equal(parsed?.action, "reschedule");
  assert.equal(parsed?.params.fromDate, "thursday");
  assert.equal(parsed?.params.toDate, "saturday");
});

test("extractDeterministicEdit parses skip workout requests", () => {
  const parsed = extractDeterministicEdit("Skip tomorrow's run.");
  assert.ok(parsed);
  assert.equal(parsed?.intentType, "skip_workout");
  assert.equal(parsed?.action, "skip_workout");
  assert.equal(parsed?.params.date, "tomorrow");
});

test("extractDeterministicEdit parses base-plan difficulty requests", () => {
  const parsed = extractDeterministicEdit("Make the base plan harder.");
  assert.ok(parsed);
  assert.equal(parsed?.intentType, "plan_level_change");
  assert.equal(parsed?.action, "base_plan_level_change");
  assert.equal(parsed?.params.direction, "increase");
});

test("extractDeterministicEdit returns null for non-edit chat", () => {
  const parsed = extractDeterministicEdit("How am I doing this week?");
  assert.equal(parsed, null);
});
