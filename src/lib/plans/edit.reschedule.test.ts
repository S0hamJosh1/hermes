import test from "node:test";
import assert from "node:assert/strict";
import { resolveWeekday } from "@/lib/plans/edit";

test("weekday parser resolves full and short day names", () => {
  assert.equal(resolveWeekday("friday"), 4);
  assert.equal(resolveWeekday("Fri"), 4);
  assert.equal(resolveWeekday("sat"), 5);
  assert.equal(resolveWeekday("thurs"), 3);
  assert.equal(resolveWeekday("noday"), null);
});
