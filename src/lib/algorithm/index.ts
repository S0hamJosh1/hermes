/**
 * Algorithm barrel export.
 * Import from "@/lib/algorithm" to access all algorithm modules.
 */

// Types
export type {
  RunnerProfile,
  RunnerGoal,
  GeneratedWorkout,
  GeneratedWeeklyPlan,
  WorkoutCategory,
  PlannerConfig,
  ValidationViolation,
  ValidatedPlan,
  RepairAction,
  RepairedPlan,
  StateContext,
  StateTransition,
} from "./types";
export { DEFAULT_CONFIG } from "./types";

// Plan selection
export { selectPlan, calculateCurrentWeek } from "./plan-selector";

// Plan generation
export { generateWeeklyPlan } from "./planner";

// Validation
export { validatePlan } from "./validator";
export type { ValidatorContext } from "./validator";

// Repair
export { repairPlan } from "./repair";

// Pipeline
export { runWeeklyPipeline } from "./pipeline";
export type { PipelineInput, PipelineResult } from "./pipeline";
