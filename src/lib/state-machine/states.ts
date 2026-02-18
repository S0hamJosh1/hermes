/**
 * State machine for adaptive training.
 *
 * The runner is always in exactly one state. State transitions are deterministic
 * based on rolling-window metrics — never from short-term noise.
 *
 * States:
 *   Stable           — Normal training, consistent metrics.
 *   Slump            — Performance decline detected over 28+ days.
 *   Probe            — Testing capacity after recovery or state change.
 *   Rebuild          — Gradual return after extended break or injury.
 *   Overreach        — Excessive load detected, forced recovery.
 *   Injury Watch     — Repeated injury signals, monitoring closely.
 *   Injury Protection — Active injury lockdown, reduced/suspended training.
 *   Override Active  — User enabled "Send It" mode (higher limits, safety still on).
 *   Taper            — Pre-race reduction phase.
 */

import type { RunnerState } from "@/types/training";

export type StateDefinition = {
  name: RunnerState;
  description: string;
  volumeMultiplier: number;       // applied to template volume
  allowQualitySessions: boolean;  // whether tempo/interval/pace are permitted
  allowVolumeIncrease: boolean;   // whether ramp-up is allowed
  maxRampPercent: number;         // max weekly volume increase %
  gracePeriodWeeks: number;       // weeks before re-evaluating transition
};

export const STATE_DEFINITIONS: Record<RunnerState, StateDefinition> = {
  Stable: {
    name: "Stable",
    description: "Normal training, consistent performance.",
    volumeMultiplier: 1.0,
    allowQualitySessions: true,
    allowVolumeIncrease: true,
    maxRampPercent: 10,
    gracePeriodWeeks: 0,
  },
  Slump: {
    name: "Slump",
    description: "Performance declining over 28+ days. Reduced volume, investigating cause.",
    volumeMultiplier: 0.75,
    allowQualitySessions: true,
    allowVolumeIncrease: false,
    maxRampPercent: 0,
    gracePeriodWeeks: 2,
  },
  Probe: {
    name: "Probe",
    description: "Testing capacity — gentle ramp-up after recovery or state change.",
    volumeMultiplier: 0.85,
    allowQualitySessions: true,
    allowVolumeIncrease: true,
    maxRampPercent: 5,
    gracePeriodWeeks: 2,
  },
  Rebuild: {
    name: "Rebuild",
    description: "Gradual return after extended break (2+ weeks off).",
    volumeMultiplier: 0.65,
    allowQualitySessions: false,
    allowVolumeIncrease: true,
    maxRampPercent: 5,
    gracePeriodWeeks: 3,
  },
  Overreach: {
    name: "Overreach",
    description: "Excessive cumulative load. Forced recovery week(s).",
    volumeMultiplier: 0.60,
    allowQualitySessions: false,
    allowVolumeIncrease: false,
    maxRampPercent: 0,
    gracePeriodWeeks: 1,
  },
  "Injury Watch": {
    name: "Injury Watch",
    description: "Repeated injury/pain signals. Close monitoring, reduced volume.",
    volumeMultiplier: 0.70,
    allowQualitySessions: false,
    allowVolumeIncrease: false,
    maxRampPercent: 0,
    gracePeriodWeeks: 2,
  },
  "Injury Protection": {
    name: "Injury Protection",
    description: "Active injury lockdown. Minimal or suspended training.",
    volumeMultiplier: 0.50,
    allowQualitySessions: false,
    allowVolumeIncrease: false,
    maxRampPercent: 0,
    gracePeriodWeeks: 2,
  },
  "Override Active": {
    name: "Override Active",
    description: "User-enabled aggressive mode. Higher ramps, safety still enforced.",
    volumeMultiplier: 1.10,
    allowQualitySessions: true,
    allowVolumeIncrease: true,
    maxRampPercent: 15,
    gracePeriodWeeks: 0,
  },
  Taper: {
    name: "Taper",
    description: "Pre-race taper. Volume decreasing, no intensity spikes.",
    volumeMultiplier: 0.60,
    allowQualitySessions: false,
    allowVolumeIncrease: false,
    maxRampPercent: 0,
    gracePeriodWeeks: 0,
  },
};
