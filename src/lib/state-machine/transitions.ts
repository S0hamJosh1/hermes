/**
 * State transition logic.
 *
 * Transitions are evaluated once per week, after metrics are calculated.
 * Core principle: never make major changes from short-term inconsistency.
 *   - 7-day window: only for overreach and injury signals.
 *   - 28-day window: primary window for performance trends and compliance.
 *   - 90-day window: used for chronic pattern detection and long-term capacity.
 *
 * Grace period: after any state change, wait N weeks before re-evaluating.
 */

import type { RunnerState } from "@/types/training";
import type { StateContext, StateTransition } from "../algorithm/types";
import { STATE_DEFINITIONS } from "./states";

type TransitionRule = {
  from: RunnerState | "*";
  to: RunnerState;
  priority: number;              // lower = higher priority
  evaluate: (ctx: StateContext) => string | null;  // returns reason or null (no transition)
};

const RULES: TransitionRule[] = [
  // ─── Highest priority: injury and overreach (always checked) ─────────
  {
    from: "*",
    to: "Injury Protection",
    priority: 1,
    evaluate: (ctx) => {
      const severe = ctx.activeInjuries.filter((i) => i.severity >= 7);
      if (severe.length > 0) return `Severe injury detected: ${severe[0].bodyPart} (severity ${severe[0].severity}).`;
      return null;
    },
  },
  {
    from: "*",
    to: "Injury Watch",
    priority: 2,
    evaluate: (ctx) => {
      if (ctx.healthStrikeCount >= 2 && ctx.profile.currentState !== "Injury Protection") {
        return `${ctx.healthStrikeCount} health strikes accumulated.`;
      }
      return null;
    },
  },
  {
    from: "*",
    to: "Overreach",
    priority: 3,
    evaluate: (ctx) => {
      const w7 = ctx.windows.window7Day;
      const w28 = ctx.windows.window28Day;
      if (w7.volumeKm > w28.volumeKm * 1.4 / 4) {
        return `7-day volume (${Math.round(w7.volumeKm)}km) exceeds 140% of 28-day weekly avg.`;
      }
      return null;
    },
  },

  // ─── Taper: triggered by proximity to race ───────────────────────────
  {
    from: "*",
    to: "Taper",
    priority: 4,
    evaluate: (ctx) => {
      const weeksLeft = ctx.totalPlanWeeks - ctx.currentWeekNumber;
      if (weeksLeft <= 3 && weeksLeft >= 0 && ctx.currentWeekNumber >= ctx.taperStartWeek) {
        return `${weeksLeft + 1} weeks to race. Entering taper.`;
      }
      return null;
    },
  },

  // ─── Override: user-controlled ───────────────────────────────────────
  {
    from: "Stable",
    to: "Override Active",
    priority: 5,
    evaluate: (ctx) => {
      if (ctx.profile.overrideModeEnabled && ctx.profile.currentState !== "Override Active") {
        return "User enabled Override (Send It) mode.";
      }
      return null;
    },
  },
  {
    from: "Override Active",
    to: "Stable",
    priority: 5,
    evaluate: (ctx) => {
      if (!ctx.profile.overrideModeEnabled) return "User disabled Override mode.";
      return null;
    },
  },

  // ─── Slump detection (28-day window) ─────────────────────────────────
  {
    from: "Stable",
    to: "Slump",
    priority: 10,
    evaluate: (ctx) => {
      const { window28Day, window90Day } = ctx.windows;
      if (window90Day.volumeKm <= 0) return null;
      const weeklyAvg28 = window28Day.volumeKm / 4;
      const weeklyAvg90 = window90Day.volumeKm / 13;
      if (weeklyAvg28 < weeklyAvg90 * 0.7 && window28Day.compliancePercentage < 60) {
        return `28-day weekly avg (${Math.round(weeklyAvg28)}km) dropped below 70% of 90-day avg (${Math.round(weeklyAvg90)}km), compliance ${Math.round(window28Day.compliancePercentage)}%.`;
      }
      return null;
    },
  },

  // ─── Recovery from states ────────────────────────────────────────────
  {
    from: "Slump",
    to: "Probe",
    priority: 20,
    evaluate: (ctx) => {
      if (ctx.weeksSinceStateChange >= 2 && ctx.compliancePercentage >= 70) {
        return "Compliance recovered above 70% after 2+ weeks in Slump. Moving to Probe.";
      }
      return null;
    },
  },
  {
    from: "Overreach",
    to: "Probe",
    priority: 20,
    evaluate: (ctx) => {
      if (ctx.weeksSinceStateChange >= 1) {
        return "Recovery week complete after overreach. Moving to Probe.";
      }
      return null;
    },
  },
  {
    from: "Injury Watch",
    to: "Probe",
    priority: 20,
    evaluate: (ctx) => {
      if (ctx.healthStrikeCount === 0 && ctx.weeksSinceStateChange >= 2) {
        return "No health strikes for 2+ weeks. Moving from Injury Watch to Probe.";
      }
      return null;
    },
  },
  {
    from: "Injury Protection",
    to: "Rebuild",
    priority: 20,
    evaluate: (ctx) => {
      if (ctx.activeInjuries.length === 0 && ctx.weeksSinceStateChange >= 2) {
        return "Injuries resolved. Moving from Injury Protection to Rebuild.";
      }
      return null;
    },
  },
  {
    from: "Rebuild",
    to: "Probe",
    priority: 20,
    evaluate: (ctx) => {
      if (ctx.weeksSinceStateChange >= 3 && ctx.compliancePercentage >= 70) {
        return "3+ weeks of rebuilding with good compliance. Moving to Probe.";
      }
      return null;
    },
  },
  {
    from: "Probe",
    to: "Stable",
    priority: 25,
    evaluate: (ctx) => {
      if (ctx.weeksSinceStateChange >= 2 && ctx.compliancePercentage >= 80) {
        return "2+ weeks of probing with 80%+ compliance. Returning to Stable.";
      }
      return null;
    },
  },
];

/**
 * Evaluate all transition rules and return the highest-priority transition,
 * or null if no transition should occur.
 */
export function evaluateTransition(ctx: StateContext): StateTransition | null {
  const currentState = ctx.profile.currentState;
  const stateDef = STATE_DEFINITIONS[currentState];

  if (ctx.weeksSinceStateChange < stateDef.gracePeriodWeeks) {
    return null;
  }

  const applicable = RULES
    .filter((r) => r.from === "*" || r.from === currentState)
    .filter((r) => r.to !== currentState)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of applicable) {
    const reason = rule.evaluate(ctx);
    if (reason) {
      return {
        from: currentState,
        to: rule.to,
        reason,
        triggeredAt: new Date(),
      };
    }
  }

  return null;
}
