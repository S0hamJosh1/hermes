// Database type definitions
// These will be generated from Prisma schema, but defining here for reference

export type User = {
  id: string;
  stravaId: number;
  stravaUsername: string | null;
  email: string | null;
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RunnerProfile = {
  id: string;
  userId: string;
  basePaceSecondsPerKm: number;
  thresholdPaceSecondsPerKm: number;
  weeklyCapacityKm: number;
  durabilityScore: number;
  consistencyScore: number;
  riskLevel: 'low' | 'moderate' | 'high';
  currentState: RunnerState;
  overrideModeEnabled: boolean;
  primaryGoalDistance: '4K' | '10K' | 'Half Marathon' | 'Marathon' | null;
  primaryGoalDate: Date | null;
  goalTimeSeconds: number | null;
  last28DayVolume: number | null;
  last90DayVolume: number | null;
  last28DayConsistency: number | null;
  bootcampCompleted: boolean;
  bootcampStartDate: Date | null;
  bootcampEndDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

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

export type LongTermGoal = {
  id: string;
  userId: string;
  distance: '4K' | '10K' | 'Half Marathon' | 'Marathon';
  targetDate: Date;
  targetTimeSeconds: number | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Roadmap = {
  id: string;
  userId: string;
  goalId: string;
  phaseNumber: number;
  phaseName: string;
  startDate: Date;
  endDate: Date;
  targetVolumeKm: number | null;
  focus: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Milestone = {
  id: string;
  roadmapId: string;
  milestoneName: string;
  targetDate: Date;
  targetMetric: string | null;
  targetValue: number | null;
  achieved: boolean;
  achievedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkoutTemplate = {
  id: string;
  templateName: string;
  workoutType: WorkoutType;
  distanceType: 'fixed_km' | 'time_based' | 'percentage_of_long_run' | null;
  baseDistanceKm: number | null;
  baseDurationMinutes: number | null;
  intensityZone: IntensityZone | null;
  minDistanceKm: number | null;
  maxDistanceKm: number | null;
  minDurationMinutes: number | null;
  maxDurationMinutes: number | null;
  minWeekNumber: number | null;
  maxWeekNumber: number | null;
  requiresBaseBuilding: boolean;
  sourcePlan: string | null;
  sourceWeek: number | null;
  createdAt: Date;
};

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

export type WeeklyPlan = {
  id: string;
  userId: string;
  weekStartDate: Date;
  weekEndDate: Date;
  weekNumber: number;
  stateAtGeneration: RunnerState;
  totalVolumeKm: number;
  totalDurationMinutes: number;
  validationStatus: 'pending' | 'valid' | 'repaired' | 'invalid';
  validationErrors: ValidationError[] | null;
  repairActions: RepairAction[] | null;
  userEdited: boolean;
  userEditReason: string | null;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ValidationError = {
  type: string;
  severity: 'hard' | 'soft';
  message: string;
  affectedWorkouts: string[];
};

export type RepairAction = {
  type: string;
  description: string;
  changes: Record<string, unknown>;
};

export type Workout = {
  id: string;
  weeklyPlanId: string;
  templateId: string | null;
  workoutDate: Date;
  workoutType: WorkoutType;
  plannedDistanceKm: number | null;
  plannedDurationMinutes: number | null;
  plannedPaceSecondsPerKm: number | null;
  intensityZone: IntensityZone | null;
  stravaActivityId: number | null;
  actualDistanceKm: number | null;
  actualDurationSeconds: number | null;
  actualPaceSecondsPerKm: number | null;
  completed: boolean;
  completedAt: Date | null;
  userModified: boolean;
  userModificationReason: string | null;
  dayOfWeek: number;
  orderInWeek: number;
  createdAt: Date;
  updatedAt: Date;
};

export type StravaActivity = {
  id: string;
  userId: string;
  stravaActivityId: number;
  activityType: string;
  name: string | null;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  totalElevationGain: number | null;
  startDate: Date;
  startDateLocal: Date;
  averageSpeedMs: number | null;
  maxSpeedMs: number | null;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  weightedAverageWatts: number | null;
  externalId: string | null;
  uploadId: number | null;
  syncedAt: Date;
  createdAt: Date;
};

export type HealthRecord = {
  id: string;
  userId: string;
  recordDate: Date;
  recordType: 'injury' | 'pain' | 'fatigue' | 'illness' | 'other';
  bodyPart: string | null;
  severity: number | null;
  description: string | null;
  trainingModification: string | null;
  daysOff: number;
  strikeCount: number;
  isChronic: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type HealthStrike = {
  id: string;
  userId: string;
  strikeType: string;
  strikeCount: number;
  bodyPart: string | null;
  issuedAt: Date;
  resolved: boolean;
  resolvedAt: Date | null;
  forcedRecoveryDays: number | null;
  permanentLimitApplied: boolean;
  limitDescription: string | null;
  createdAt: Date;
};

export type ComplianceCheckIn = {
  id: string;
  userId: string;
  checkInDate: Date;
  triggerReason: string;
  responseType: string | null;
  responseDetails: string | null;
  adaptationAction: string | null;
  createdAt: Date;
};

export type WeeklySummary = {
  id: string;
  userId: string;
  weekStartDate: Date;
  weekEndDate: Date;
  plannedVolumeKm: number | null;
  actualVolumeKm: number | null;
  compliancePercentage: number | null;
  easyRunKm: number | null;
  qualitySessionKm: number | null;
  longRunKm: number | null;
  recoveryKm: number | null;
  averagePaceSecondsPerKm: number | null;
  thresholdPaceEstimate: number | null;
  healthIssuesCount: number;
  restDays: number;
  endingState: RunnerState | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdaptationHistory = {
  id: string;
  userId: string;
  transitionDate: Date;
  fromState: RunnerState | null;
  toState: RunnerState;
  triggerReason: string;
  triggerData: Record<string, unknown> | null;
  volumeChangePercentage: number | null;
  intensityChangePercentage: number | null;
  adaptationRationale: string | null;
  window7Day: Record<string, unknown> | null;
  window28Day: Record<string, unknown> | null;
  window90Day: Record<string, unknown> | null;
  createdAt: Date;
};

export type MomentumMeter = {
  id: string;
  userId: string;
  currentStreakDays: number;
  longestStreakDays: number;
  consistencyScore: number;
  lastUpdated: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type KillaMeter = {
  id: string;
  userId: string;
  overreachCount: number;
  breakthroughCount: number;
  totalPoints: number;
  lastUpdated: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
