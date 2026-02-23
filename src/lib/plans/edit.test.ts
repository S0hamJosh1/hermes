import test from "node:test";
import assert from "node:assert/strict";
import { clampOffset, difficultyLabel } from "@/lib/plans/level-preference";

test("clampOffset enforces persistent preference bounds", () => {
  assert.equal(clampOffset(-100), -6);
  assert.equal(clampOffset(100), 6);
  assert.equal(clampOffset(2), 2);
});

test("difficultyLabel maps offsets to readable bands", () => {
  assert.equal(difficultyLabel(-2), "much easier");
  assert.equal(difficultyLabel(-1), "slightly easier");
  assert.equal(difficultyLabel(0), "auto");
  assert.equal(difficultyLabel(1), "slightly harder");
  assert.equal(difficultyLabel(3), "much harder");
});
