/**
 * Auto-repair: fix hard-rule violations without user intervention.
 *
 * Strategy for each rule:
 *   RAMP_LIMIT           → proportionally reduce all run distances
 *   HARD_DAY_SPACING     → downgrade the second quality session to easy run
 *   INJURY_LOCK          → replace all runs with rest/cross
 *   INJURY_REDUCED_VOLUME → scale down all runs proportionally
 *   INJURY_REDUCED_INTENSITY → convert quality sessions to easy runs
 *   TAPER_VOLUME_INCREASE → scale down to previous week volume
 *   TAPER_HIGH_INTENSITY → convert intervals/tempo to easy runs
 *   OVERREACH_DETECTION  → apply 40% volume reduction
 *
 * Soft-rule violations are logged but not repaired (user can decide).
 */

import type { IntensityZone } from "@/types/training";
import type {
  GeneratedWeeklyPlan,
  GeneratedWorkout,
  ValidationViolation,
  RepairAction,
  RepairedPlan,
  RunnerProfile,
  PlannerConfig,
} from "./types";
import { validatePlan, ValidatorContext } from "./validator";

export function repairPlan(
  plan: GeneratedWeeklyPlan,
  profile: RunnerProfile,
  config: PlannerConfig,
  context: ValidatorContext
): RepairedPlan {
  let current = deepClonePlan(plan);
  const repairs: RepairAction[] = [];
  const maxPasses = 5;

  for (let pass = 0; pass < maxPasses; pass++) {
    const result = validatePlan(current, profile, config, context);
    const hardViolations = result.violations.filter((v) => v.severity === "hard");
    if (hardViolations.length === 0) {
      return {
        plan: current,
        repairs,
        remainingViolations: result.violations.filter((v) => v.severity === "soft"),
      };
    }

    for (const violation of hardViolations) {
      const applied = applyRepair(current, violation, profile, config);
      if (applied) {
        repairs.push(applied);
      }
    }

    recalcTotals(current);
  }

  const finalResult = validatePlan(current, profile, config, context);
  return {
    plan: current,
    repairs,
    remainingViolations: finalResult.violations,
  };
}

// ─── Repair strategies per rule ─────────────────────────────────────────────

function applyRepair(
  plan: GeneratedWeeklyPlan,
  violation: ValidationViolation,
  profile: RunnerProfile,
  config: PlannerConfig
): RepairAction | null {
  switch (violation.ruleId) {
    case "RAMP_LIMIT":
      return repairRampLimit(plan, profile, config);
    case "HARD_DAY_SPACING":
      return repairHardDaySpacing(plan, violation);
    case "INJURY_LOCK":
      return repairInjuryLock(plan);
    case "INJURY_REDUCED_VOLUME":
      return repairInjuryReducedVolume(plan);
    case "INJURY_REDUCED_INTENSITY":
      return repairInjuryReducedIntensity(plan, profile);
    case "TAPER_VOLUME_INCREASE":
      return repairTaperVolume(plan);
    case "TAPER_HIGH_INTENSITY":
      return repairTaperIntensity(plan, profile);
    case "OVERREACH_DETECTION":
      return repairOverreach(plan);
    default:
      return null;
  }
}

function repairRampLimit(
  plan: GeneratedWeeklyPlan,
  profile: RunnerProfile,
  config: PlannerConfig
): RepairAction {
  const limit = profile.overrideModeEnabled
    ? config.overrideRampLimitPercent
    : config.rampLimitPercent;
  const maxVolume = plan.previousWeekVolumeKm * (1 + limit / 100);
  const scaleFactor = maxVolume / plan.totalVolumeKm;
  const originalVolume = plan.totalVolumeKm;

  for (const w of plan.workouts) {
    if (w.distanceKm > 0) {
      w.distanceKm = Math.round(w.distanceKm * scaleFactor * 10) / 10;
    }
  }

  return {
    ruleId: "RAMP_LIMIT",
    description: `Scaled all run distances by ${Math.round(scaleFactor * 100)}% to meet ramp limit.`,
    originalValue: `${originalVolume}km`,
    repairedValue: `${Math.round(maxVolume * 10) / 10}km`,
    affectedDays: plan.workouts.filter((w) => w.distanceKm > 0).map((w) => w.dayOfWeek),
  };
}

function repairHardDaySpacing(
  plan: GeneratedWeeklyPlan,
  violation: ValidationViolation
): RepairAction {
  const affectedDays = violation.affectedDays;
  if (affectedDays.length < 2) return null!;

  const laterDay = Math.max(...affectedDays);
  const workout = plan.workouts.find((w) => w.dayOfWeek === laterDay);
  if (!workout) return null!;

  const originalType = workout.type;
  workout.type = "easy_run";
  workout.isKeyWorkout = false;
  workout.intensityZone = "Zone 2";

  return {
    ruleId: "HARD_DAY_SPACING",
    description: `Converted ${dayLabel(laterDay)} from ${originalType} to easy_run.`,
    originalValue: originalType,
    repairedValue: "easy_run",
    affectedDays: [laterDay],
  };
}

function repairInjuryLock(plan: GeneratedWeeklyPlan): RepairAction {
  const affected: number[] = [];
  for (const w of plan.workouts) {
    if (w.distanceKm > 0) {
      affected.push(w.dayOfWeek);
      w.type = "rest";
      w.distanceKm = 0;
      w.paceSecondsPerKm = 0;
      w.isKeyWorkout = false;
      w.intensityZone = "Zone 1";
    }
  }
  return {
    ruleId: "INJURY_LOCK",
    description: "Replaced all runs with rest due to severe injury.",
    originalValue: "running",
    repairedValue: "rest",
    affectedDays: affected,
  };
}

function repairInjuryReducedVolume(plan: GeneratedWeeklyPlan): RepairAction {
  const maxVolume = plan.previousWeekVolumeKm * 0.5;
  const scaleFactor = plan.totalVolumeKm > 0 ? maxVolume / plan.totalVolumeKm : 1;
  const originalVolume = plan.totalVolumeKm;

  for (const w of plan.workouts) {
    if (w.distanceKm > 0) {
      w.distanceKm = Math.round(w.distanceKm * scaleFactor * 10) / 10;
    }
  }

  return {
    ruleId: "INJURY_REDUCED_VOLUME",
    description: `Reduced volume to 50% of previous week due to injury.`,
    originalValue: `${originalVolume}km`,
    repairedValue: `${Math.round(maxVolume * 10) / 10}km`,
    affectedDays: plan.workouts.filter((w) => w.distanceKm > 0).map((w) => w.dayOfWeek),
  };
}

function repairInjuryReducedIntensity(
  plan: GeneratedWeeklyPlan,
  profile: RunnerProfile
): RepairAction {
  const affected: number[] = [];
  for (const w of plan.workouts) {
    if (w.type === "tempo" || w.type === "interval" || w.type === "pace_run") {
      affected.push(w.dayOfWeek);
      w.type = "easy_run";
      w.paceSecondsPerKm = profile.basePaceSecondsPerKm + 30;
      w.intensityZone = "Zone 2";
      w.isKeyWorkout = false;
    }
  }
  return {
    ruleId: "INJURY_REDUCED_INTENSITY",
    description: "Converted quality sessions to easy runs due to injury.",
    originalValue: "quality sessions",
    repairedValue: "easy runs",
    affectedDays: affected,
  };
}

function repairTaperVolume(plan: GeneratedWeeklyPlan): RepairAction {
  const maxVolume = plan.previousWeekVolumeKm;
  const scaleFactor = plan.totalVolumeKm > 0 ? maxVolume / plan.totalVolumeKm : 1;
  const originalVolume = plan.totalVolumeKm;

  for (const w of plan.workouts) {
    if (w.distanceKm > 0) {
      w.distanceKm = Math.round(w.distanceKm * Math.min(scaleFactor, 1) * 10) / 10;
    }
  }

  return {
    ruleId: "TAPER_VOLUME_INCREASE",
    description: "Reduced volume to not exceed previous week during taper.",
    originalValue: `${originalVolume}km`,
    repairedValue: `≤${Math.round(maxVolume * 10) / 10}km`,
    affectedDays: plan.workouts.filter((w) => w.distanceKm > 0).map((w) => w.dayOfWeek),
  };
}

function repairTaperIntensity(
  plan: GeneratedWeeklyPlan,
  profile: RunnerProfile
): RepairAction {
  const affected: number[] = [];
  for (const w of plan.workouts) {
    if (w.type === "interval" || w.type === "tempo") {
      affected.push(w.dayOfWeek);
      w.type = "easy_run";
      w.paceSecondsPerKm = profile.basePaceSecondsPerKm + 30;
      w.intensityZone = "Zone 2";
      w.isKeyWorkout = false;
    }
  }
  return {
    ruleId: "TAPER_HIGH_INTENSITY",
    description: "Converted high-intensity sessions to easy runs during taper.",
    originalValue: "intervals/tempo",
    repairedValue: "easy runs",
    affectedDays: affected,
  };
}

function repairOverreach(plan: GeneratedWeeklyPlan): RepairAction {
  const scaleFactor = 0.6; // 40% reduction
  const originalVolume = plan.totalVolumeKm;

  for (const w of plan.workouts) {
    if (w.distanceKm > 0) {
      w.distanceKm = Math.round(w.distanceKm * scaleFactor * 10) / 10;
    }
  }

  return {
    ruleId: "OVERREACH_DETECTION",
    description: "Applied 40% volume reduction due to overreach.",
    originalValue: `${originalVolume}km`,
    repairedValue: `${Math.round(originalVolume * scaleFactor * 10) / 10}km`,
    affectedDays: plan.workouts.filter((w) => w.distanceKm > 0).map((w) => w.dayOfWeek),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function recalcTotals(plan: GeneratedWeeklyPlan) {
  plan.totalVolumeKm = Math.round(
    plan.workouts.reduce((sum, w) => sum + w.distanceKm, 0) * 10
  ) / 10;
  plan.rampPercentage = plan.previousWeekVolumeKm > 0
    ? Math.round(((plan.totalVolumeKm - plan.previousWeekVolumeKm) / plan.previousWeekVolumeKm) * 100)
    : 0;
}

function deepClonePlan(plan: GeneratedWeeklyPlan): GeneratedWeeklyPlan {
  return {
    ...plan,
    workouts: plan.workouts.map((w) => ({ ...w })),
  };
}

function dayLabel(day: number): string {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day] ?? `Day${day}`;
}
