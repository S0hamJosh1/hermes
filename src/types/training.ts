// Training domain types

export type Distance = '4K' | '10K' | 'Half Marathon' | 'Marathon';

export type WorkoutType =
  | 'Easy Run'
  | 'Long Run'
  | 'Tempo'
  | 'Interval'
  | 'Recovery'
  | 'Fartlek'
  | 'Time Trial'
  | 'Rest';

export type IntensityZone = 'Zone 1' | 'Zone 2' | 'Zone 3' | 'Zone 4' | 'Zone 5' | 'Threshold';

export type RunnerState =
  | 'Stable'
  | 'Slump'
  | 'Probe'
  | 'Rebuild'
  | 'Overreach'
  | 'Injury Watch'
  | 'Injury Protection'
  | 'Override Active'
  | 'Taper';

// Workout planning types
export type PlannedWorkout = {
  date: Date;
  type: WorkoutType;
  distanceKm?: number;
  durationMinutes?: number;
  paceSecondsPerKm?: number;
  intensityZone?: IntensityZone;
  notes?: string;
};

export type WeeklyPlanData = {
  weekStartDate: Date;
  weekEndDate: Date;
  weekNumber: number;
  workouts: PlannedWorkout[];
  totalVolumeKm: number;
  totalDurationMinutes: number;
};

// Validation types
export type ValidationRule = {
  name: string;
  type: 'hard' | 'soft';
  check: (plan: WeeklyPlanData, profile: any) => ValidationResult;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export type ValidationError = {
  rule: string;
  severity: 'hard' | 'soft';
  message: string;
  affectedWorkouts: number[];
};

// Ramp limits (percentage increase per week)
export type RampLimits = {
  volume: number; // e.g., 0.10 = 10% max increase
  intensity: number;
  longRun: number;
};

// Hard day spacing (minimum days between quality sessions)
export type HardDaySpacing = {
  minDaysBetweenQuality: number;
  minDaysBetweenLongRuns: number;
};

// Injury protection
export type InjuryProtection = {
  bodyPart: string;
  severity: number;
  daysOff: number;
  reducedVolume: boolean;
  reducedIntensity: boolean;
  lockUntil: Date | null;
};

// Rolling window metrics
export type RollingWindow = {
  volumeKm: number;
  averagePaceSecondsPerKm: number;
  compliancePercentage: number;
  healthIssuesCount: number;
  restDays: number;
  qualitySessionsCount: number;
  longRunsCount: number;
};

export type WindowMetrics = {
  window7Day: RollingWindow;
  window28Day: RollingWindow;
  window90Day: RollingWindow;
};

// Adaptation triggers
export type AdaptationTrigger = {
  type: 'volume_change' | 'intensity_change' | 'state_transition' | 'health_issue' | 'compliance_drop';
  data: Record<string, unknown>;
  timestamp: Date;
};

// Bootcamp calibration
export type BootcampData = {
  activities: {
    date: Date;
    distanceKm: number;
    durationSeconds: number;
    paceSecondsPerKm: number;
  }[];
  estimatedBasePace: number;
  estimatedThresholdPace: number;
  estimatedWeeklyCapacity: number;
};
