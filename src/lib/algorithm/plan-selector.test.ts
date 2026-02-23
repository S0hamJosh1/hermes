import test from "node:test";
import assert from "node:assert/strict";
import { selectPlanWithDebug } from "@/lib/algorithm/plan-selector";
import type { HalHigdonPlan } from "@/types/hal-higdon";
import type { RunnerGoal, RunnerProfile } from "@/lib/algorithm/types";

function makePlan(id: string, level: string): HalHigdonPlan {
  return {
    meta: {
      id,
      name: id,
      category: "5K",
      level,
      lengthWeeks: 8,
      sourceFile: `${id}.md`,
    },
    weeksKm: [
      {
        weekNumber: 1,
        days: [
          { dayOfWeek: 0, type: "run", distanceKm: 5 },
          { dayOfWeek: 1, type: "rest" },
          { dayOfWeek: 2, type: "run", distanceKm: 5 },
          { dayOfWeek: 3, type: "rest" },
          { dayOfWeek: 4, type: "run", distanceKm: 6 },
          { dayOfWeek: 5, type: "rest" },
          { dayOfWeek: 6, type: "long_run", distanceKm: 8 },
        ],
      },
    ],
  };
}

const baseProfile: RunnerProfile = {
  userId: "u1",
  basePaceSecondsPerKm: 360,
  thresholdPaceSecondsPerKm: 330,
  weeklyCapacityKm: 24,
  durabilityScore: 0.4,
  consistencyScore: 0.45,
  riskLevel: "moderate",
  currentState: "Stable",
  overrideModeEnabled: false,
  bootcampCompleted: true,
  planLevelOffset: 0,
  planLevelMode: "auto",
};

const goal: RunnerGoal = {
  distance: "5K",
  targetDate: new Date("2026-05-01"),
};

test("selector applies user override rank offset when enabled", () => {
  const plans = [
    makePlan("5k-novice", "Novice"),
    makePlan("5k-intermediate", "Intermediate"),
    makePlan("5k-advanced", "Advanced"),
  ];

  const autoSelection = selectPlanWithDebug(plans, baseProfile, goal);
  assert.ok(autoSelection.plan);
  assert.equal(autoSelection.debug?.appliedLevelOffset, 0);

  const harderSelection = selectPlanWithDebug(
    plans,
    { ...baseProfile, planLevelMode: "user_override", planLevelOffset: 2 },
    goal
  );
  assert.ok(harderSelection.plan);
  assert.equal(harderSelection.debug?.appliedLevelOffset, 2);
  assert.equal(harderSelection.debug?.effectiveIdealRank, (autoSelection.debug?.idealRank ?? 0) + 2);
});

test("selector clamps extreme user offset within rank boundaries", () => {
  const plans = [
    makePlan("5k-novice", "Novice"),
    makePlan("5k-advanced", "Advanced"),
  ];

  const selection = selectPlanWithDebug(
    plans,
    { ...baseProfile, planLevelMode: "user_override", planLevelOffset: 99 },
    goal
  );
  assert.ok(selection.debug);
  assert.equal(selection.debug?.effectiveIdealRank, 14);
});
