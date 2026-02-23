/**
 * Weekly pipeline — the main entry point for generating a validated plan.
 *
 * Follows the fixed weekly cycle:
 *   1. (Strava import + metric update — handled elsewhere)
 *   2. Evaluate state machine → get current state
 *   3. Select plan template
 *   4. Generate weekly plan
 *   5. Validate
 *   6. Auto-repair if needed
 *   7. Return final plan + metadata
 *
 * This module is pure logic with no database or API dependencies.
 * It takes all inputs as arguments and returns a result.
 */

import type { HalHigdonPlan } from "@/types/hal-higdon";
import type { WindowMetrics, InjuryProtection } from "@/types/training";
import type {
  RunnerProfile,
  RunnerGoal,
  PlannerConfig,
  StateContext,
  StateTransition,
  GeneratedWeeklyPlan,
  RepairedPlan,
} from "./types";
import { selectPlanWithDebug, calculateCurrentWeek } from "./plan-selector";
import { generateWeeklyPlan } from "./planner";
import { validatePlan, type ValidatorContext } from "./validator";
import { repairPlan } from "./repair";
import { evaluateTransition } from "../state-machine/transitions";

// --- Pipeline input ---

export type PipelineInput = {
  profile: RunnerProfile;
  goal: RunnerGoal;
  availablePlans: HalHigdonPlan[];
  weekStartDate: Date;
  previousWeekVolumeKm: number;
  windows: WindowMetrics;
  activeInjuries: InjuryProtection[];
  healthStrikeCount: number;
  compliancePercentage: number;
  weeksSinceStateChange: number;
  config?: Partial<PlannerConfig>;
};

// --- Pipeline output ---

export type PipelineResult = {
  plan: GeneratedWeeklyPlan;
  stateTransition: StateTransition | null;
  selectedPlanId: string;
  weekNumber: number;
  repairs: RepairedPlan["repairs"];
  softViolations: RepairedPlan["remainingViolations"];
  wasRepaired: boolean;
  selectorDebug: {
    idealRank: number;
    effectiveIdealRank: number;
    benchmarkRank: number | null;
    appliedLevelOffset: number;
    selectedPlanLevel: string;
    selectedPlanRank: number;
    candidateCount: number;
  } | null;
};

// --- Pipeline execution ---

export function runWeeklyPipeline(input: PipelineInput): PipelineResult {
  const config: PlannerConfig = {
    rampLimitPercent: 10,
    overrideRampLimitPercent: 15,
    minDaysBetweenHardSessions: 2,
    minDaysBetweenLongRuns: 6,
    taperWeeks: 3,
    ...input.config,
  };

  // Step 1: Evaluate state machine
  const selection = selectPlanWithDebug(input.availablePlans, input.profile, input.goal);
  const selectedPlan = selection.plan;
  if (!selectedPlan) {
    throw new Error(`No plan found for goal: ${input.goal.distance}`);
  }

  const weeksUntilRace = Math.ceil(
    (input.goal.targetDate.getTime() - input.weekStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  const weekNumber = calculateCurrentWeek(weeksUntilRace, selectedPlan.meta.lengthWeeks);
  const taperStartWeek = selectedPlan.meta.lengthWeeks - config.taperWeeks;

  const stateContext: StateContext = {
    profile: input.profile,
    goal: input.goal,
    windows: input.windows,
    activeInjuries: input.activeInjuries,
    healthStrikeCount: input.healthStrikeCount,
    compliancePercentage: input.compliancePercentage,
    weeksSinceStateChange: input.weeksSinceStateChange,
    currentWeekNumber: weekNumber,
    totalPlanWeeks: selectedPlan.meta.lengthWeeks,
    taperStartWeek,
  };

  const stateTransition = evaluateTransition(stateContext);

  // Apply state transition to profile (immutable — create copy)
  const effectiveProfile: RunnerProfile = stateTransition
    ? { ...input.profile, currentState: stateTransition.to }
    : input.profile;

  // Step 2: Generate weekly plan
  const rawPlan = generateWeeklyPlan(
    selectedPlan,
    effectiveProfile,
    input.goal,
    weekNumber,
    input.weekStartDate,
    input.previousWeekVolumeKm,
    config
  );

  // Step 3: Validate
  const isInTaper = weekNumber >= taperStartWeek;
  const w28Avg = input.windows.window28Day.volumeKm;
  const overreachThreshold = (input.windows.window90Day.volumeKm / 13) * 4 * 1.3;

  const validatorContext: ValidatorContext = {
    activeInjuries: input.activeInjuries,
    isInTaper,
    overreach28DayVolume: w28Avg,
    overreach28DayThreshold: overreachThreshold > 0 ? overreachThreshold : undefined,
  };

  const validationResult = validatePlan(rawPlan, effectiveProfile, config, validatorContext);

  // Step 4: Repair if needed
  let finalResult: RepairedPlan;
  if (!validationResult.isValid) {
    finalResult = repairPlan(rawPlan, effectiveProfile, config, validatorContext);
  } else {
    finalResult = {
      plan: rawPlan,
      repairs: [],
      remainingViolations: validationResult.violations.filter((v) => v.severity === "soft"),
    };
  }

  return {
    plan: finalResult.plan,
    stateTransition,
    selectedPlanId: selectedPlan.meta.id,
    weekNumber,
    repairs: finalResult.repairs,
    softViolations: finalResult.remainingViolations,
    wasRepaired: finalResult.repairs.length > 0,
    selectorDebug: selection.debug,
  };
}
