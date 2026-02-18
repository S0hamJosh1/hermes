/**
 * Algorithm-specific types used across planner, validator, repair, and state machine.
 */

import type { RunnerState, IntensityZone, WindowMetrics, InjuryProtection } from "@/types/training";

// --- Runner Profile (input to planner) ---

export type RunnerProfile = {
  userId: string;
  basePaceSecondsPerKm: number;
  thresholdPaceSecondsPerKm: number;
  weeklyCapacityKm: number;
  durabilityScore: number;       // 0.0–1.0
  consistencyScore: number;      // 0.0–1.0
  riskLevel: "low" | "moderate" | "high";
  currentState: RunnerState;
  overrideModeEnabled: boolean;
  bootcampCompleted: boolean;
};

export type RunnerGoal = {
  distance: "4K" | "10K" | "Half Marathon" | "Marathon";
  targetDate: Date;
  targetTimeSeconds?: number;
};

// --- Planner output ---

export type GeneratedWorkout = {
  dayOfWeek: number;              // 0=Mon … 6=Sun
  type: WorkoutCategory;
  distanceKm: number;
  paceSecondsPerKm: number;
  intensityZone: IntensityZone;
  templateSource: string;         // e.g. "marathon-novice-1:week-4:sat"
  isKeyWorkout: boolean;          // long run or quality session
};

export type WorkoutCategory =
  | "easy_run"
  | "long_run"
  | "tempo"
  | "pace_run"
  | "interval"
  | "recovery"
  | "cross_training"
  | "rest"
  | "race";

export type GeneratedWeeklyPlan = {
  weekNumber: number;
  weekStartDate: Date;
  state: RunnerState;
  planId: string;                 // which Hal Higdon plan was used
  workouts: GeneratedWorkout[];
  totalVolumeKm: number;
  previousWeekVolumeKm: number;
  rampPercentage: number;         // actual % change from previous week
};

// --- Validator ---

export type RuleSeverity = "hard" | "soft";

export type ValidationViolation = {
  ruleId: string;
  ruleName: string;
  severity: RuleSeverity;
  message: string;
  affectedDays: number[];         // dayOfWeek indices
  suggestedAction?: string;
};

export type ValidatedPlan = {
  plan: GeneratedWeeklyPlan;
  violations: ValidationViolation[];
  isValid: boolean;               // true if zero hard violations
};

// --- Repair ---

export type RepairAction = {
  ruleId: string;
  description: string;
  originalValue: string;
  repairedValue: string;
  affectedDays: number[];
};

export type RepairedPlan = {
  plan: GeneratedWeeklyPlan;
  repairs: RepairAction[];
  remainingViolations: ValidationViolation[];  // soft violations left
};

// --- State machine context ---

export type StateContext = {
  profile: RunnerProfile;
  goal: RunnerGoal;
  windows: WindowMetrics;
  activeInjuries: InjuryProtection[];
  healthStrikeCount: number;
  compliancePercentage: number;   // 0–100, rolling 28-day
  weeksSinceStateChange: number;
  currentWeekNumber: number;
  totalPlanWeeks: number;
  taperStartWeek: number;
};

export type StateTransition = {
  from: RunnerState;
  to: RunnerState;
  reason: string;
  triggeredAt: Date;
};

// --- Pipeline ---

export type PlannerConfig = {
  rampLimitPercent: number;           // default 10
  overrideRampLimitPercent: number;   // default 15 (Send It mode)
  minDaysBetweenHardSessions: number; // default 2
  minDaysBetweenLongRuns: number;     // default 6
  taperWeeks: number;                 // default 3
  maxWeeklyTimeCap?: number;          // minutes, soft rule
  preferredRunDays?: number[];        // dayOfWeek indices
};

export const DEFAULT_CONFIG: PlannerConfig = {
  rampLimitPercent: 10,
  overrideRampLimitPercent: 15,
  minDaysBetweenHardSessions: 2,
  minDaysBetweenLongRuns: 6,
  taperWeeks: 3,
};
