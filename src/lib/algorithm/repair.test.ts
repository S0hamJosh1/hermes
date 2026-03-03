import test from "node:test";
import assert from "node:assert/strict";
import { repairPlan } from "@/lib/algorithm/repair";
import type { GeneratedWeeklyPlan, PlannerConfig, RunnerProfile } from "@/lib/algorithm/types";
import type { ValidatorContext } from "@/lib/algorithm/validator";

function buildPlan(totalVolumeKm: number): GeneratedWeeklyPlan {
  return {
    weekNumber: 4,
    weekStartDate: new Date("2026-03-09T00:00:00.000Z"),
    state: "Stable",
    planId: "5k-advanced",
    totalVolumeKm,
    previousWeekVolumeKm: 12,
    rampPercentage: -8,
    workouts: [
      {
        dayOfWeek: 0,
        type: "easy_run",
        distanceKm: 4.8,
        paceSecondsPerKm: 360,
        intensityZone: "Zone 2",
        templateSource: "test:mon",
        isKeyWorkout: false,
      },
      {
        dayOfWeek: 1,
        type: "interval",
        distanceKm: 1.8,
        paceSecondsPerKm: 300,
        intensityZone: "Zone 4",
        templateSource: "test:tue",
        isKeyWorkout: true,
      },
      {
        dayOfWeek: 3,
        type: "tempo",
        distanceKm: 4.4,
        paceSecondsPerKm: 330,
        intensityZone: "Threshold",
        templateSource: "test:thu",
        isKeyWorkout: true,
      },
    ],
  };
}

const profile: RunnerProfile = {
  userId: "u1",
  basePaceSecondsPerKm: 360,
  thresholdPaceSecondsPerKm: 330,
  weeklyCapacityKm: 35,
  durabilityScore: 0.6,
  consistencyScore: 0.6,
  riskLevel: "moderate",
  currentState: "Stable",
  overrideModeEnabled: false,
  bootcampCompleted: true,
  planLevelMode: "auto",
  planLevelOffset: 0,
};

const config: PlannerConfig = {
  rampLimitPercent: 10,
  overrideRampLimitPercent: 15,
  minDaysBetweenHardSessions: 2,
  minDaysBetweenLongRuns: 6,
  taperWeeks: 3,
};

test("overreach repair applies once to recovery target instead of compounding repeatedly", () => {
  const context: ValidatorContext = {
    activeInjuries: [],
    isInTaper: false,
    overreach28DayVolume: 80,
    overreach28DayThreshold: 60,
  };

  const repaired = repairPlan(buildPlan(11), profile, config, context);
  const expectedRecoveryKm = 7.2; // 60% of previous week (12km)

  assert.ok(repaired.repairs.some((r) => r.ruleId === "OVERREACH_DETECTION"));
  assert.equal(repaired.plan.totalVolumeKm, expectedRecoveryKm);
});
