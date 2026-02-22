/**
 * Weekly plan generator.
 *
 * Takes a runner profile, selected Hal Higdon plan, and week number,
 * then produces a GeneratedWeeklyPlan with concrete distances and paces.
 *
 * Core principles:
 *   - All workouts come from templates, never AI-generated.
 *   - Distances are scaled to the runner's current capacity.
 *   - Paces are assigned from the runner's calibration data.
 *   - State-aware: adjusts volume/intensity based on RunnerState.
 */

import type { HalHigdonPlan, HalHigdonDayType } from "@/types/hal-higdon";
import type { IntensityZone, RunnerState } from "@/types/training";
import type {
  RunnerProfile,
  RunnerGoal,
  GeneratedWeeklyPlan,
  GeneratedWorkout,
  WorkoutCategory,
  PlannerConfig,
} from "./types";

// --- Mapping from Hal Higdon day types to our workout categories ---

function mapDayType(hhType: HalHigdonDayType): WorkoutCategory {
  switch (hhType) {
    case "rest": return "rest";
    case "cross": return "cross_training";
    case "run": return "easy_run";
    case "pace": return "pace_run";
    case "tempo": return "tempo";
    case "interval": return "interval";
    case "fast": return "pace_run";
    case "optional_run": return "easy_run";
    case "long_run": return "long_run";
    case "race": return "race";
    default: return "easy_run";
  }
}

function isKeyWorkout(category: WorkoutCategory): boolean {
  return category === "long_run" || category === "pace_run" || category === "tempo" || category === "interval" || category === "race";
}

// --- Pace assignment ---

function assignPace(
  category: WorkoutCategory,
  profile: RunnerProfile
): number {
  const { basePaceSecondsPerKm, thresholdPaceSecondsPerKm } = profile;
  const easyPace = basePaceSecondsPerKm + 30;  // ~30s slower than base
  const recoveryPace = basePaceSecondsPerKm + 60;

  switch (category) {
    case "easy_run": return easyPace;
    case "recovery": return recoveryPace;
    case "long_run": return easyPace + 15;       // long run slightly slower than easy
    case "pace_run": return basePaceSecondsPerKm; // marathon race pace
    case "tempo": return thresholdPaceSecondsPerKm;
    case "interval": return thresholdPaceSecondsPerKm - 15;
    case "cross_training": return 0;
    case "rest": return 0;
    case "race": return basePaceSecondsPerKm;
    default: return easyPace;
  }
}

function assignZone(category: WorkoutCategory): IntensityZone {
  switch (category) {
    case "recovery": return "Zone 1";
    case "easy_run": return "Zone 2";
    case "long_run": return "Zone 2";
    case "pace_run": return "Zone 3";
    case "tempo": return "Threshold";
    case "interval": return "Zone 4";
    case "race": return "Zone 3";
    case "cross_training": return "Zone 1";
    case "rest": return "Zone 1";
    default: return "Zone 2";
  }
}

function maybeInjectQualityWorkout(
  workouts: GeneratedWorkout[],
  profile: RunnerProfile,
  goal: RunnerGoal
): GeneratedWorkout[] {
  const shortRace = goal.distance === "4K" || goal.distance === "5K" || goal.distance === "10K";
  const blockedState =
    profile.currentState === "Injury Watch" ||
    profile.currentState === "Injury Protection" ||
    profile.currentState === "Overreach";
  if (!shortRace || blockedState) return workouts;

  const hasQuality = workouts.some((w) =>
    w.type === "tempo" || w.type === "interval" || w.type === "pace_run" || w.type === "race"
  );
  if (hasQuality) return workouts;

  // Promote one mid-week easy run to a controlled tempo session.
  const candidate = workouts.find(
    (w) => w.type === "easy_run" && w.dayOfWeek >= 1 && w.dayOfWeek <= 4 && w.distanceKm >= 3
  );
  if (!candidate) return workouts;

  return workouts.map((w) => {
    if (w !== candidate) return w;
    const tempoDistance = Math.max(3, Math.round(w.distanceKm * 0.8 * 10) / 10);
    return {
      ...w,
      type: "tempo",
      distanceKm: tempoDistance,
      paceSecondsPerKm: assignPace("tempo", profile),
      intensityZone: assignZone("tempo"),
      isKeyWorkout: true,
      templateSource: `${w.templateSource}:promoted-tempo`,
    };
  });
}

// --- Volume scaling ---

/**
 * STATE_VOLUME_MULTIPLIERS adjust the template volume based on runner state.
 * < 1.0 reduces volume, > 1.0 increases it.
 */
const STATE_VOLUME_MULTIPLIERS: Record<RunnerState, number> = {
  "Stable": 1.0,
  "Slump": 0.75,
  "Probe": 0.85,
  "Rebuild": 0.65,
  "Overreach": 0.60,
  "Injury Watch": 0.70,
  "Injury Protection": 0.50,
  "Override Active": 1.10,
  "Taper": 0.60,
};

/**
 * Calculate a scaling factor to map template distances to this runner's capacity.
 * We compare the template's average weekly volume against the runner's weekly capacity.
 */
function capacityScaleFactor(
  templateWeekVolumeKm: number,
  runnerCapacityKm: number
): number {
  if (templateWeekVolumeKm <= 0) return 1;
  const raw = runnerCapacityKm / templateWeekVolumeKm;
  return Math.max(0.5, Math.min(raw, 1.5));
}

// --- Core generation ---

export function generateWeeklyPlan(
  plan: HalHigdonPlan,
  profile: RunnerProfile,
  goal: RunnerGoal,
  weekNumber: number,
  weekStartDate: Date,
  previousWeekVolumeKm: number,
  config: PlannerConfig = {
    rampLimitPercent: 10,
    overrideRampLimitPercent: 15,
    minDaysBetweenHardSessions: 2,
    minDaysBetweenLongRuns: 6,
    taperWeeks: 3,
  }
): GeneratedWeeklyPlan {
  const weeks = plan.weeksKm;
  const clampedWeek = Math.min(weekNumber, weeks.length);
  const templateWeek = weeks[clampedWeek - 1];

  if (!templateWeek) {
    return emptyWeek(weekNumber, weekStartDate, profile.currentState, plan.meta.id, previousWeekVolumeKm);
  }

  const templateVolumeKm = templateWeek.days.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0);
  const scaleFactor = capacityScaleFactor(templateVolumeKm, profile.weeklyCapacityKm);
  const stateMultiplier = STATE_VOLUME_MULTIPLIERS[profile.currentState] ?? 1.0;

  const workouts: GeneratedWorkout[] = [];
  let totalVolume = 0;

  for (const day of templateWeek.days) {
    const category = mapDayType(day.type);
    const templateDistKm = day.distanceKm ?? 0;
    let distanceKm = Math.round(templateDistKm * scaleFactor * stateMultiplier * 10) / 10;

    const paceForCategory = assignPace(category, profile);
    if (distanceKm <= 0 && day.durationMinutes && day.durationMinutes > 0 && paceForCategory > 0) {
      distanceKm = Math.round(((day.durationMinutes * 60) / paceForCategory) * 10) / 10;
    }

    if (category === "rest" || category === "cross_training") {
      distanceKm = 0;
    }

    totalVolume += distanceKm;

    workouts.push({
      dayOfWeek: day.dayOfWeek,
      type: category,
      distanceKm,
      paceSecondsPerKm: paceForCategory,
      intensityZone: assignZone(category),
      templateSource: `${plan.meta.id}:week-${clampedWeek}:${dayName(day.dayOfWeek)}`,
      isKeyWorkout: isKeyWorkout(category),
    });
  }

  const rampPercentage = previousWeekVolumeKm > 0
    ? Math.round(((totalVolume - previousWeekVolumeKm) / previousWeekVolumeKm) * 100)
    : 0;

  const adjustedWorkouts = maybeInjectQualityWorkout(workouts, profile, goal);
  const adjustedTotalVolume = adjustedWorkouts.reduce((sum, w) => sum + w.distanceKm, 0);
  const adjustedRampPercentage = previousWeekVolumeKm > 0
    ? Math.round(((adjustedTotalVolume - previousWeekVolumeKm) / previousWeekVolumeKm) * 100)
    : 0;

  return {
    weekNumber: clampedWeek,
    weekStartDate,
    state: profile.currentState,
    planId: plan.meta.id,
    workouts: adjustedWorkouts,
    totalVolumeKm: Math.round(adjustedTotalVolume * 10) / 10,
    previousWeekVolumeKm,
    rampPercentage: adjustedRampPercentage,
  };
}

// --- Helpers ---

function dayName(dayOfWeek: number): string {
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][dayOfWeek] ?? "unknown";
}

function emptyWeek(
  weekNumber: number,
  weekStartDate: Date,
  state: RunnerState,
  planId: string,
  previousWeekVolumeKm: number
): GeneratedWeeklyPlan {
  return {
    weekNumber,
    weekStartDate,
    state,
    planId,
    workouts: Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      type: "rest" as WorkoutCategory,
      distanceKm: 0,
      paceSecondsPerKm: 0,
      intensityZone: "Zone 1" as IntensityZone,
      templateSource: `${planId}:week-${weekNumber}:${dayName(i)}`,
      isKeyWorkout: false,
    })),
    totalVolumeKm: 0,
    previousWeekVolumeKm,
    rampPercentage: previousWeekVolumeKm > 0 ? -100 : 0,
  };
}
