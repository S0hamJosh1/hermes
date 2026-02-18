/**
 * Types for parsed Hal Higdon training plans.
 * Used as the source of truth for workout templates—algorithm uses this data, not raw markdown.
 */

export type HalHigdonDayType =
  | "rest"
  | "cross"
  | "run"
  | "pace"
  | "long_run"
  | "race";

export type ParsedDayEntry = {
  dayOfWeek: number; // 0 = Mon, 6 = Sun
  type: HalHigdonDayType;
  /** Distance in km (preferred for algorithm) */
  distanceKm?: number;
  /** Distance in miles (from source; 1 mi ≈ 1.60934 km) */
  distanceMi?: number;
  /** For races: "Half Marathon" | "Marathon" | etc. */
  label?: string;
};

export type ParsedWeek = {
  weekNumber: number;
  days: ParsedDayEntry[];
};

export type HalHigdonPlanMeta = {
  id: string;
  name: string;
  /** e.g. "Marathon", "Half Marathon", "10K", "5K" */
  category: string;
  /** e.g. "Novice 1", "Intermediate 2" */
  level: string;
  lengthWeeks: number;
  sourceFile: string;
};

export type HalHigdonPlan = {
  meta: HalHigdonPlanMeta;
  /** Schedule in miles (original) */
  weeksMi?: ParsedWeek[];
  /** Schedule in km (preferred for algorithm) */
  weeksKm: ParsedWeek[];
};
