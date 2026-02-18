/**
 * Safety-first plan validator.
 *
 * Hard rules — cannot be disabled, even in Override ("Send It") mode:
 *   1. Ramp limit (weekly volume increase cap)
 *   2. Hard-day spacing (min days between quality sessions)
 *   3. Injury lock (forced restrictions when injuries are active)
 *   4. Taper protection (no intensity spikes before race)
 *   5. Overreach detection (excessive cumulative load)
 *
 * Soft rules — can be overridden by user preference:
 *   6. Preferred run days
 *   7. Daily time cap
 *   8. Consecutive run day limit
 */

import type { InjuryProtection } from "@/types/training";
import type {
  GeneratedWeeklyPlan,
  GeneratedWorkout,
  ValidationViolation,
  ValidatedPlan,
  PlannerConfig,
  RunnerProfile,
} from "./types";

type ValidatorFn = (
  plan: GeneratedWeeklyPlan,
  profile: RunnerProfile,
  config: PlannerConfig,
  context: ValidatorContext
) => ValidationViolation[];

export type ValidatorContext = {
  activeInjuries: InjuryProtection[];
  isInTaper: boolean;
  overreach28DayVolume?: number;
  overreach28DayThreshold?: number;
};

// ─── Hard Rule 1: Ramp Limit ────────────────────────────────────────────────

function checkRampLimit(
  plan: GeneratedWeeklyPlan,
  profile: RunnerProfile,
  config: PlannerConfig,
): ValidationViolation[] {
  if (plan.previousWeekVolumeKm <= 0) return [];

  const limit = profile.overrideModeEnabled
    ? config.overrideRampLimitPercent
    : config.rampLimitPercent;

  if (plan.rampPercentage > limit) {
    return [{
      ruleId: "RAMP_LIMIT",
      ruleName: "Weekly Volume Ramp Limit",
      severity: "hard",
      message: `Weekly volume increased ${plan.rampPercentage}% (limit: ${limit}%). Previous: ${plan.previousWeekVolumeKm}km, Current: ${plan.totalVolumeKm}km.`,
      affectedDays: plan.workouts.filter((w) => w.distanceKm > 0).map((w) => w.dayOfWeek),
      suggestedAction: `Reduce total volume to ≤${Math.round(plan.previousWeekVolumeKm * (1 + limit / 100) * 10) / 10}km.`,
    }];
  }
  return [];
}

// ─── Hard Rule 2: Hard-Day Spacing ──────────────────────────────────────────

function checkHardDaySpacing(
  plan: GeneratedWeeklyPlan,
  _profile: RunnerProfile,
  config: PlannerConfig,
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const keyDays = plan.workouts
    .filter((w) => w.isKeyWorkout)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  for (let i = 1; i < keyDays.length; i++) {
    const gap = keyDays[i].dayOfWeek - keyDays[i - 1].dayOfWeek;
    if (gap < config.minDaysBetweenHardSessions) {
      violations.push({
        ruleId: "HARD_DAY_SPACING",
        ruleName: "Hard Day Spacing",
        severity: "hard",
        message: `Key workouts on ${dayLabel(keyDays[i - 1].dayOfWeek)} and ${dayLabel(keyDays[i].dayOfWeek)} are only ${gap} day(s) apart (min: ${config.minDaysBetweenHardSessions}).`,
        affectedDays: [keyDays[i - 1].dayOfWeek, keyDays[i].dayOfWeek],
        suggestedAction: "Move one quality session or convert to easy run.",
      });
    }
  }
  return violations;
}

// ─── Hard Rule 3: Injury Lock ───────────────────────────────────────────────

function checkInjuryLock(
  plan: GeneratedWeeklyPlan,
  _profile: RunnerProfile,
  _config: PlannerConfig,
  context: ValidatorContext,
): ValidationViolation[] {
  if (context.activeInjuries.length === 0) return [];

  const violations: ValidationViolation[] = [];
  for (const injury of context.activeInjuries) {
    if (injury.severity >= 7) {
      const runDays = plan.workouts.filter((w) => w.distanceKm > 0);
      if (runDays.length > 0) {
        violations.push({
          ruleId: "INJURY_LOCK",
          ruleName: "Injury Lock",
          severity: "hard",
          message: `Active severe injury (${injury.bodyPart}, severity ${injury.severity}). All running should be suspended.`,
          affectedDays: runDays.map((w) => w.dayOfWeek),
          suggestedAction: "Replace all runs with rest or cross-training.",
        });
      }
    } else if (injury.reducedVolume) {
      const maxVolume = plan.previousWeekVolumeKm * 0.5;
      if (plan.totalVolumeKm > maxVolume) {
        violations.push({
          ruleId: "INJURY_REDUCED_VOLUME",
          ruleName: "Injury Reduced Volume",
          severity: "hard",
          message: `Injury (${injury.bodyPart}) requires reduced volume. Current: ${plan.totalVolumeKm}km, Max: ${Math.round(maxVolume * 10) / 10}km.`,
          affectedDays: plan.workouts.filter((w) => w.distanceKm > 0).map((w) => w.dayOfWeek),
          suggestedAction: `Reduce volume to ≤${Math.round(maxVolume * 10) / 10}km.`,
        });
      }
    }
    if (injury.reducedIntensity) {
      const qualityWorkouts = plan.workouts.filter(
        (w) => w.type === "tempo" || w.type === "interval" || w.type === "pace_run"
      );
      if (qualityWorkouts.length > 0) {
        violations.push({
          ruleId: "INJURY_REDUCED_INTENSITY",
          ruleName: "Injury Reduced Intensity",
          severity: "hard",
          message: `Injury (${injury.bodyPart}) requires reduced intensity. Quality sessions should be replaced.`,
          affectedDays: qualityWorkouts.map((w) => w.dayOfWeek),
          suggestedAction: "Convert quality sessions to easy runs.",
        });
      }
    }
  }
  return violations;
}

// ─── Hard Rule 4: Taper Protection ──────────────────────────────────────────

function checkTaperProtection(
  plan: GeneratedWeeklyPlan,
  _profile: RunnerProfile,
  _config: PlannerConfig,
  context: ValidatorContext,
): ValidationViolation[] {
  if (!context.isInTaper) return [];
  const violations: ValidationViolation[] = [];

  if (plan.rampPercentage > 0) {
    violations.push({
      ruleId: "TAPER_VOLUME_INCREASE",
      ruleName: "Taper Protection — Volume",
      severity: "hard",
      message: `Volume increase (+${plan.rampPercentage}%) during taper is not allowed.`,
      affectedDays: plan.workouts.filter((w) => w.distanceKm > 0).map((w) => w.dayOfWeek),
      suggestedAction: "Reduce volume to at or below previous week.",
    });
  }

  const highIntensity = plan.workouts.filter(
    (w) => w.type === "interval" || w.type === "tempo"
  );
  if (highIntensity.length > 0) {
    violations.push({
      ruleId: "TAPER_HIGH_INTENSITY",
      ruleName: "Taper Protection — Intensity",
      severity: "hard",
      message: "High-intensity sessions (intervals/tempo) are not allowed during taper.",
      affectedDays: highIntensity.map((w) => w.dayOfWeek),
      suggestedAction: "Convert to easy runs or pace runs.",
    });
  }
  return violations;
}

// ─── Hard Rule 5: Overreach Detection ───────────────────────────────────────

function checkOverreach(
  _plan: GeneratedWeeklyPlan,
  _profile: RunnerProfile,
  _config: PlannerConfig,
  context: ValidatorContext,
): ValidationViolation[] {
  if (
    context.overreach28DayVolume == null ||
    context.overreach28DayThreshold == null
  ) return [];

  if (context.overreach28DayVolume > context.overreach28DayThreshold) {
    return [{
      ruleId: "OVERREACH_DETECTION",
      ruleName: "Overreach Detection",
      severity: "hard",
      message: `28-day cumulative volume (${Math.round(context.overreach28DayVolume)}km) exceeds safe threshold (${Math.round(context.overreach28DayThreshold)}km).`,
      affectedDays: [],
      suggestedAction: "Trigger recovery week: reduce volume 40%.",
    }];
  }
  return [];
}

// ─── Soft Rule 6: Preferred Days ────────────────────────────────────────────

function checkPreferredDays(
  plan: GeneratedWeeklyPlan,
  _profile: RunnerProfile,
  config: PlannerConfig,
): ValidationViolation[] {
  if (!config.preferredRunDays || config.preferredRunDays.length === 0) return [];

  const nonPreferred = plan.workouts.filter(
    (w) => w.distanceKm > 0 && !config.preferredRunDays!.includes(w.dayOfWeek)
  );

  if (nonPreferred.length > 0) {
    return [{
      ruleId: "PREFERRED_DAYS",
      ruleName: "Preferred Run Days",
      severity: "soft",
      message: `Workouts scheduled on non-preferred days: ${nonPreferred.map((w) => dayLabel(w.dayOfWeek)).join(", ")}.`,
      affectedDays: nonPreferred.map((w) => w.dayOfWeek),
      suggestedAction: "Consider shifting workouts to preferred days.",
    }];
  }
  return [];
}

// ─── Soft Rule 7: Daily Time Cap ────────────────────────────────────────────

function checkDailyTimeCap(
  plan: GeneratedWeeklyPlan,
  profile: RunnerProfile,
  config: PlannerConfig,
): ValidationViolation[] {
  if (!config.maxWeeklyTimeCap) return [];
  const violations: ValidationViolation[] = [];

  for (const w of plan.workouts) {
    if (w.distanceKm <= 0 || w.paceSecondsPerKm <= 0) continue;
    const durationMin = (w.distanceKm * w.paceSecondsPerKm) / 60;
    const dailyCap = config.maxWeeklyTimeCap / 5;
    if (durationMin > dailyCap) {
      violations.push({
        ruleId: "DAILY_TIME_CAP",
        ruleName: "Daily Time Cap",
        severity: "soft",
        message: `${dayLabel(w.dayOfWeek)} workout (${Math.round(durationMin)}min) exceeds daily cap (~${Math.round(dailyCap)}min).`,
        affectedDays: [w.dayOfWeek],
        suggestedAction: "Reduce distance or split workout.",
      });
    }
  }
  return violations;
}

// ─── Soft Rule 8: Consecutive Run Days ──────────────────────────────────────

function checkConsecutiveRunDays(
  plan: GeneratedWeeklyPlan,
): ValidationViolation[] {
  const runDays = plan.workouts
    .filter((w) => w.distanceKm > 0)
    .map((w) => w.dayOfWeek)
    .sort((a, b) => a - b);

  let maxConsecutive = 1;
  let current = 1;
  for (let i = 1; i < runDays.length; i++) {
    if (runDays[i] === runDays[i - 1] + 1) {
      current++;
      maxConsecutive = Math.max(maxConsecutive, current);
    } else {
      current = 1;
    }
  }

  if (maxConsecutive > 4) {
    return [{
      ruleId: "CONSECUTIVE_RUN_DAYS",
      ruleName: "Consecutive Run Days",
      severity: "soft",
      message: `${maxConsecutive} consecutive run days detected. Consider adding a rest day.`,
      affectedDays: runDays,
      suggestedAction: "Insert a rest or cross-training day.",
    }];
  }
  return [];
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Validate a generated weekly plan against all hard and soft rules.
 * Returns the plan annotated with violations.
 */
export function validatePlan(
  plan: GeneratedWeeklyPlan,
  profile: RunnerProfile,
  config: PlannerConfig,
  context: ValidatorContext
): ValidatedPlan {
  const violations: ValidationViolation[] = [];

  // Hard rules (always run)
  violations.push(...checkRampLimit(plan, profile, config));
  violations.push(...checkHardDaySpacing(plan, profile, config));
  violations.push(...checkInjuryLock(plan, profile, config, context));
  violations.push(...checkTaperProtection(plan, profile, config, context));
  violations.push(...checkOverreach(plan, profile, config, context));

  // Soft rules
  violations.push(...checkPreferredDays(plan, profile, config));
  violations.push(...checkDailyTimeCap(plan, profile, config));
  violations.push(...checkConsecutiveRunDays(plan));

  const hasHardViolation = violations.some((v) => v.severity === "hard");

  return {
    plan,
    violations,
    isValid: !hasHardViolation,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function dayLabel(day: number): string {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day] ?? `Day${day}`;
}
