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

type PlanStructure = {
  avgRunDays: number;
  avgCrossDays: number;
  avgRestDays: number;
  avgQualityDays: number;
};

const CATEGORY_MAP: Record<string, string> = {
  "4K": "5K",
  "5K": "5K",
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
  const normalized = normalizeLevel(level);
  const idx = LEVEL_ORDER.indexOf(normalized);
  return idx >= 0 ? idx : 5;
}

function normalizeLevel(level: string): string {
  const cleaned = level.replace(/\s+/g, " ").trim();
  if (cleaned.includes("HM3")) return "Half Marathon 3";
  return cleaned;
}

function isQualityType(type: string): boolean {
  return type === "tempo" || type === "interval" || type === "pace" || type === "race" || type === "fast";
}

function planStructure(plan: HalHigdonPlan): PlanStructure {
  const weeks = plan.weeksKm ?? [];
  if (weeks.length === 0) return { avgRunDays: 0, avgCrossDays: 0, avgRestDays: 0, avgQualityDays: 0 };

  let runDays = 0;
  let crossDays = 0;
  let restDays = 0;
  let qualityDays = 0;
  let countedWeeks = 0;

  for (const week of weeks) {
    if (!week.days || week.days.length === 0) continue;
    countedWeeks += 1;
    let wr = 0;
    let wc = 0;
    let ws = 0;
    let wq = 0;
    for (const day of week.days) {
      if (day.type === "cross") wc += 1;
      else if (day.type === "rest") ws += 1;
      if (day.type === "optional_run") {
        const lowerLabel = (day.label ?? "").toLowerCase();
        wr += 0.5;
        if (lowerLabel.includes("cross")) wc += 0.5;
      } else if (day.type !== "rest" && day.type !== "cross") {
        wr += 1;
      }
      if (isQualityType(day.type)) wq += 1;
    }
    runDays += wr;
    crossDays += wc;
    restDays += ws;
    qualityDays += wq;
  }

  const n = countedWeeks || 1;
  return {
    avgRunDays: runDays / n,
    avgCrossDays: crossDays / n,
    avgRestDays: restDays / n,
    avgQualityDays: qualityDays / n,
  };
}

function benchmarkRankForGoal(goal: RunnerGoal): number | null {
  const t = goal.targetTimeSeconds;
  if (!t || t <= 0) return null;

  switch (goal.distance) {
    case "4K":
    case "5K":
      if (t <= 20 * 60) return 8; // advanced
      if (t <= 22 * 60) return 6; // intermediate 2-ish
      if (t <= 25 * 60) return 4; // intermediate 1
      return 1; // novice
    case "10K":
      if (t <= 42 * 60) return 8;
      if (t <= 46 * 60) return 6;
      if (t <= 52 * 60) return 4;
      return 1;
    case "Half Marathon":
      if (t <= 95 * 60) return 8; // ~1:35
      if (t <= 105 * 60) return 6; // ~1:45
      if (t <= 120 * 60) return 4; // ~2:00
      return 1;
    case "Marathon":
      if (t <= 205 * 60) return 9; // ~3:25
      if (t <= 230 * 60) return 7; // ~3:50
      if (t <= 270 * 60) return 5; // ~4:30
      return 1;
    default:
      return null;
  }
}

function desiredRunDays(profile: RunnerProfile, goal: RunnerGoal, benchmarkRank: number | null): number {
  let target = 4;
  if (goal.distance === "Marathon") target = 5;
  else if (goal.distance === "Half Marathon") target = 4.5;
  else if (goal.distance === "10K") target = 4;
  else target = 3.8;

  if (benchmarkRank != null) {
    if (benchmarkRank >= 6) target += 0.7;
    else if (benchmarkRank <= 2) target -= 0.8;
  }

  if (profile.weeklyCapacityKm < 20) target -= 0.8;
  else if (profile.weeklyCapacityKm > 55) target += 0.4;

  if (profile.riskLevel === "high") target -= 0.9;
  else if (profile.riskLevel === "moderate") target -= 0.3;

  return Math.max(3, Math.min(6, target));
}

function desiredCrossDays(targetRunDays: number): number {
  if (targetRunDays <= 3.5) return 2;
  if (targetRunDays <= 4.5) return 1.5;
  return 1;
}

/**
 * Estimate the ideal level rank for a runner based on weekly capacity and consistency.
 * Returns 0..14 matching LEVEL_ORDER indices.
 */
function estimateIdealRank(profile: RunnerProfile, goal: RunnerGoal): number {
  const goalDistance = goal.distance;
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
  let rank = Math.min(capacityRank + experienceBonus, LEVEL_ORDER.length - 1);

  // Benchmarks map user target-time ambition to novice/intermediate/advanced tiers.
  const benchmarkRank = benchmarkRankForGoal(goal);
  if (benchmarkRank != null) rank = Math.max(rank, benchmarkRank);

  return rank;
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

  const idealRank = estimateIdealRank(profile, goal);
  const benchmarkRank = benchmarkRankForGoal(goal);

  // Prefer plans that satisfy benchmark intent:
  // - ambitious goals: enforce a minimum level
  // - conservative goals: avoid high-level plans unless no alternatives exist
  const benchmarkFiltered =
    benchmarkRank == null
      ? candidates
      : benchmarkRank >= 6
        ? candidates.filter((p) => getLevelRank(p.meta.level) >= benchmarkRank)
        : benchmarkRank <= 2
          ? candidates.filter((p) => getLevelRank(p.meta.level) <= 4)
          : candidates;
  const selectionPool = benchmarkFiltered.length > 0 ? benchmarkFiltered : candidates;

  const scored: PlanCandidate[] = selectionPool.map((plan) => {
    const planRank = getLevelRank(plan.meta.level);
    const rankDiff = Math.abs(planRank - idealRank);
    const avgVolume = planAverageVolume(plan);
    const volumeDiff = Math.abs(avgVolume - profile.weeklyCapacityKm);
    const benchmarkDiff = benchmarkRank == null ? 0 : Math.abs(planRank - benchmarkRank);
    const structure = planStructure(plan);
    const targetRunDays = desiredRunDays(profile, goal, benchmarkRank);
    const targetCrossDays = desiredCrossDays(targetRunDays);
    const runDayDiff = Math.abs(structure.avgRunDays - targetRunDays);
    const crossDayDiff = Math.abs(structure.avgCrossDays - targetCrossDays);

    let score = rankDiff * 10 + benchmarkDiff * 6 + volumeDiff * 0.5 + runDayDiff * 4 + crossDayDiff * 2;

    const normalizedLevel = normalizeLevel(plan.meta.level);
    if (normalizedLevel === "Half Marathon 3" || normalizedLevel === "Marathon 3") {
      if (targetRunDays <= 3.6) score -= 6;
      else score += 8;
    }
    if (normalizedLevel === "Senior") {
      if (profile.riskLevel !== "low" || profile.weeklyCapacityKm <= 45) score -= 4;
      else score += 3;
    }
    if (normalizedLevel === "Personal Best") {
      if ((benchmarkRank ?? 0) >= 7 && profile.weeklyCapacityKm >= 45) score -= 5;
      else score += 9;
    }

    return { plan, score };
  });

  scored.sort((a, b) => a.score - b.score);
  const ordered = scored;

  if (profile.riskLevel === "high") {
    const conservative = ordered.find(
      (c) => getLevelRank(c.plan.meta.level) <= idealRank
    );
    if (conservative) return conservative.plan;
  }

  return ordered[0].plan;
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
