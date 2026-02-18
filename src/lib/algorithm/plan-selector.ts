/**
 * Plan selector: matches a runner profile + goal to the best Hal Higdon plan.
 *
 * Selection logic:
 *   1. Filter plans by goal distance (category).
 *   2. Score each plan against the runner's capacity and experience.
 *   3. Return the best-fit plan.
 */

import type { HalHigdonPlan, ParsedWeek } from "@/types/hal-higdon";
import type { RunnerProfile, RunnerGoal } from "./types";

type PlanCandidate = {
  plan: HalHigdonPlan;
  score: number;
};

const CATEGORY_MAP: Record<string, string> = {
  "4K": "5K",
  "10K": "10K",
  "Half Marathon": "Half Marathon",
  "Marathon": "Marathon",
};

const LEVEL_ORDER = [
  "Novice 1",
  "Novice",
  "Novice 2",
  "Novice Supreme",
  "Intermediate 1",
  "Intermediate",
  "Intermediate 2",
  "Advanced 1",
  "Advanced",
  "Advanced 2",
  "Personal Best",
  "Boston Bound",
  "Senior",
  "Marathon 3",
  "Half Marathon 3",
];

function getLevelRank(level: string): number {
  const idx = LEVEL_ORDER.indexOf(level);
  return idx >= 0 ? idx : 5;
}

/**
 * Estimate the ideal level rank for a runner based on weekly capacity and consistency.
 * Returns 0..14 matching LEVEL_ORDER indices.
 */
function estimateIdealRank(profile: RunnerProfile, goalDistance: string): number {
  const { weeklyCapacityKm, consistencyScore, durabilityScore } = profile;

  let capacityRank: number;
  if (goalDistance === "Marathon") {
    if (weeklyCapacityKm < 30) capacityRank = 0;
    else if (weeklyCapacityKm < 45) capacityRank = 2;
    else if (weeklyCapacityKm < 55) capacityRank = 4;
    else if (weeklyCapacityKm < 70) capacityRank = 6;
    else capacityRank = 8;
  } else if (goalDistance === "Half Marathon") {
    if (weeklyCapacityKm < 20) capacityRank = 0;
    else if (weeklyCapacityKm < 30) capacityRank = 2;
    else if (weeklyCapacityKm < 40) capacityRank = 4;
    else capacityRank = 6;
  } else {
    if (weeklyCapacityKm < 15) capacityRank = 0;
    else if (weeklyCapacityKm < 25) capacityRank = 2;
    else capacityRank = 4;
  }

  const experienceBonus = Math.round((consistencyScore + durabilityScore) * 2);
  return Math.min(capacityRank + experienceBonus, LEVEL_ORDER.length - 1);
}

/**
 * Calculate average weekly volume (km) of a plan.
 */
function planAverageVolume(plan: HalHigdonPlan): number {
  const weeks = plan.weeksKm;
  if (!weeks || weeks.length === 0) return 0;
  let total = 0;
  for (const week of weeks) {
    for (const day of week.days) {
      total += day.distanceKm ?? 0;
    }
  }
  return total / weeks.length;
}

/**
 * Select the best Hal Higdon plan for this runner and goal.
 */
export function selectPlan(
  plans: HalHigdonPlan[],
  profile: RunnerProfile,
  goal: RunnerGoal
): HalHigdonPlan | null {
  const targetCategory = CATEGORY_MAP[goal.distance] ?? goal.distance;
  const candidates = plans.filter(
    (p) => p.meta.category.toLowerCase() === targetCategory.toLowerCase()
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const idealRank = estimateIdealRank(profile, goal.distance);
  const scored: PlanCandidate[] = candidates.map((plan) => {
    const planRank = getLevelRank(plan.meta.level);
    const rankDiff = Math.abs(planRank - idealRank);
    const avgVolume = planAverageVolume(plan);
    const volumeDiff = Math.abs(avgVolume - profile.weeklyCapacityKm);
    const score = rankDiff * 10 + volumeDiff * 0.5;
    return { plan, score };
  });

  scored.sort((a, b) => a.score - b.score);

  if (profile.riskLevel === "high") {
    const conservative = scored.find(
      (c) => getLevelRank(c.plan.meta.level) <= idealRank
    );
    if (conservative) return conservative.plan;
  }

  return scored[0].plan;
}

/**
 * Given weeks to race day and total plan weeks, figure out which week number
 * the runner should be on. Allows late starts by compressing early base weeks.
 */
export function calculateCurrentWeek(
  weeksUntilRace: number,
  totalPlanWeeks: number
): number {
  if (weeksUntilRace >= totalPlanWeeks) return 1;
  return Math.max(1, totalPlanWeeks - weeksUntilRace + 1);
}
