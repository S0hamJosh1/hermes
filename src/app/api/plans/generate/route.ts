import { NextResponse } from "next/server";
import type { RunnerProfile as AlgoRunnerProfile, RunnerGoal } from "@/lib/algorithm";
import { runWeeklyPipeline } from "@/lib/algorithm";
import { loadParsedPlans } from "@/lib/plans/load-hal-higdon";
import { prisma } from "@/lib/db/client";
import type { RunnerProfile as DbRunnerProfile } from "@prisma/client";

type GeneratePlanRequest = {
  userId?: string;
  goal?: {
    distance?: "4K" | "10K" | "Half Marathon" | "Marathon";
    targetDate?: string;
    targetTimeSeconds?: number;
  };
  weekStartDate?: string;
  profileOverrides?: Partial<AlgoRunnerProfile>;
};

const DEMO_STRAVA_ID = 900000000001n;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toNumber(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getOrCreateRunner(userId?: string) {
  if (userId) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!existing) return null;
    if (!existing.profile) {
      const profile = await prisma.runnerProfile.create({
        data: {
          userId: existing.id,
          basePaceSecondsPerKm: 360,
          thresholdPaceSecondsPerKm: 330,
          weeklyCapacityKm: 35,
          durabilityScore: 0.5,
          consistencyScore: 0.5,
          riskLevel: "moderate",
          currentState: "Stable",
          overrideModeEnabled: false,
          bootcampCompleted: true,
        },
      });
      return { user: existing, profile };
    }
    return { user: existing, profile: existing.profile };
  }

  const existingDemo = await prisma.user.findUnique({
    where: { stravaId: DEMO_STRAVA_ID },
    include: { profile: true },
  });

  if (existingDemo?.profile) {
    return { user: existingDemo, profile: existingDemo.profile };
  }

  const user =
    existingDemo ??
    (await prisma.user.create({
      data: {
        stravaId: DEMO_STRAVA_ID,
        stravaUsername: "demo_runner",
        email: "demo@hermes.local",
        refreshToken: "demo_refresh_token",
      },
    }));

  const profile = await prisma.runnerProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      basePaceSecondsPerKm: 360,
      thresholdPaceSecondsPerKm: 330,
      weeklyCapacityKm: 35,
      durabilityScore: 0.5,
      consistencyScore: 0.5,
      riskLevel: "moderate",
      currentState: "Stable",
      overrideModeEnabled: false,
      bootcampCompleted: true,
    },
  });

  return { user, profile };
}

function mapProfileToAlgorithm(
  userId: string,
  profile: DbRunnerProfile,
  overrides?: Partial<AlgoRunnerProfile>
): AlgoRunnerProfile {
  return {
    userId,
    basePaceSecondsPerKm: overrides?.basePaceSecondsPerKm ?? profile.basePaceSecondsPerKm,
    thresholdPaceSecondsPerKm:
      overrides?.thresholdPaceSecondsPerKm ?? profile.thresholdPaceSecondsPerKm,
    weeklyCapacityKm: overrides?.weeklyCapacityKm ?? toNumber(profile.weeklyCapacityKm, 35),
    durabilityScore: overrides?.durabilityScore ?? toNumber(profile.durabilityScore, 0.5),
    consistencyScore: overrides?.consistencyScore ?? toNumber(profile.consistencyScore, 0.5),
    riskLevel: overrides?.riskLevel ?? (profile.riskLevel as AlgoRunnerProfile["riskLevel"]),
    currentState: overrides?.currentState ?? (profile.currentState as AlgoRunnerProfile["currentState"]),
    overrideModeEnabled: overrides?.overrideModeEnabled ?? profile.overrideModeEnabled,
    bootcampCompleted: overrides?.bootcampCompleted ?? profile.bootcampCompleted,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as GeneratePlanRequest;
    const runner = await getOrCreateRunner(body.userId);
    if (!runner) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const profile = mapProfileToAlgorithm(
      runner.user.id,
      runner.profile,
      body.profileOverrides
    );

    const goal: RunnerGoal = {
      distance: body.goal?.distance ?? "Marathon",
      targetDate: body.goal?.targetDate ? new Date(body.goal.targetDate) : addDays(new Date(), 140),
      targetTimeSeconds: body.goal?.targetTimeSeconds,
    };

    const weekStartDate = body.weekStartDate
      ? startOfWeek(new Date(body.weekStartDate))
      : startOfWeek(new Date());
    const weekEndDate = addDays(weekStartDate, 6);

    const previousPlan = await prisma.weeklyPlan.findFirst({
      where: { userId: runner.user.id },
      orderBy: { weekStartDate: "desc" },
    });
    const previousWeekVolumeKm = previousPlan ? toNumber(previousPlan.totalVolumeKm, 0) : 0;

    const latestSummary = await prisma.weeklySummary.findFirst({
      where: { userId: runner.user.id },
      orderBy: { weekStartDate: "desc" },
    });

    const windows = {
      window7Day: {
        volumeKm: latestSummary ? toNumber(latestSummary.actualVolumeKm, 0) : 0,
        averagePaceSecondsPerKm: latestSummary ? toNumber(latestSummary.averagePaceSecondsPerKm, profile.basePaceSecondsPerKm) : profile.basePaceSecondsPerKm,
        compliancePercentage: latestSummary ? toNumber(latestSummary.compliancePercentage, 75) : 75,
        healthIssuesCount: latestSummary?.healthIssuesCount ?? 0,
        restDays: latestSummary?.restDays ?? 2,
        qualitySessionsCount: 1,
        longRunsCount: 1,
      },
      window28Day: {
        volumeKm: toNumber(runner.profile.last28DayVolume, previousWeekVolumeKm * 4),
        averagePaceSecondsPerKm: profile.basePaceSecondsPerKm,
        compliancePercentage: latestSummary ? toNumber(latestSummary.compliancePercentage, 75) : 75,
        healthIssuesCount: latestSummary?.healthIssuesCount ?? 0,
        restDays: 8,
        qualitySessionsCount: 4,
        longRunsCount: 4,
      },
      window90Day: {
        volumeKm: toNumber(runner.profile.last90DayVolume, previousWeekVolumeKm * 13),
        averagePaceSecondsPerKm: profile.basePaceSecondsPerKm,
        compliancePercentage: latestSummary ? toNumber(latestSummary.compliancePercentage, 75) : 75,
        healthIssuesCount: latestSummary?.healthIssuesCount ?? 0,
        restDays: 24,
        qualitySessionsCount: 12,
        longRunsCount: 12,
      },
    };

    const activeInjuries = await prisma.healthRecord.findMany({
      where: {
        userId: runner.user.id,
        recordType: { in: ["injury", "pain"] },
        severity: { gte: 4 },
      },
      orderBy: { recordDate: "desc" },
      take: 3,
    });

    const injuryProtection = activeInjuries.map((h) => ({
      bodyPart: h.bodyPart ?? "unknown",
      severity: h.severity ?? 0,
      daysOff: h.daysOff,
      reducedVolume: (h.severity ?? 0) >= 5,
      reducedIntensity: (h.severity ?? 0) >= 4,
      lockUntil: null as Date | null,
    }));

    const latestStrike = await prisma.healthStrike.findFirst({
      where: { userId: runner.user.id, resolved: false },
      orderBy: { issuedAt: "desc" },
    });

    const latestTransition = await prisma.adaptationHistory.findFirst({
      where: { userId: runner.user.id },
      orderBy: { transitionDate: "desc" },
    });
    const weeksSinceStateChange = latestTransition
      ? Math.max(
          0,
          Math.floor(
            (weekStartDate.getTime() - new Date(latestTransition.transitionDate).getTime()) /
              (7 * 24 * 60 * 60 * 1000)
          )
        )
      : 4;

    const plans = loadParsedPlans();
    if (plans.length === 0) {
      return NextResponse.json(
        { error: "No parsed plans found. Ensure data/hal-higdon contains plan sources." },
        { status: 400 }
      );
    }

    const result = runWeeklyPipeline({
      profile,
      goal,
      availablePlans: plans,
      weekStartDate,
      previousWeekVolumeKm,
      windows,
      activeInjuries: injuryProtection,
      healthStrikeCount: latestStrike?.strikeCount ?? 0,
      compliancePercentage: latestSummary ? toNumber(latestSummary.compliancePercentage, 75) : 75,
      weeksSinceStateChange,
    });

    const totalDurationMinutes = Math.round(
      result.plan.workouts.reduce((sum, w) => {
        if (w.distanceKm <= 0 || w.paceSecondsPerKm <= 0) return sum;
        return sum + (w.distanceKm * w.paceSecondsPerKm) / 60;
      }, 0)
    );

    const savedPlan = await prisma.weeklyPlan.create({
      data: {
        userId: runner.user.id,
        weekStartDate,
        weekEndDate,
        weekNumber: result.weekNumber,
        stateAtGeneration: result.plan.state,
        totalVolumeKm: result.plan.totalVolumeKm,
        totalDurationMinutes,
        validationStatus: result.wasRepaired ? "repaired" : "valid",
        validationErrors: result.softViolations.length > 0 ? result.softViolations : null,
        repairActions: result.repairs.length > 0 ? result.repairs : null,
        userEdited: false,
        published: true,
        publishedAt: new Date(),
        workouts: {
          create: result.plan.workouts
            .slice()
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((w, idx) => ({
              workoutDate: addDays(weekStartDate, w.dayOfWeek),
              workoutType: w.type,
              plannedDistanceKm: w.distanceKm,
              plannedDurationMinutes:
                w.distanceKm > 0 && w.paceSecondsPerKm > 0
                  ? Math.round((w.distanceKm * w.paceSecondsPerKm) / 60)
                  : null,
              plannedPaceSecondsPerKm: w.paceSecondsPerKm > 0 ? w.paceSecondsPerKm : null,
              intensityZone: w.intensityZone,
              dayOfWeek: w.dayOfWeek,
              orderInWeek: idx + 1,
            })),
        },
      },
      include: { workouts: true },
    });

    if (result.stateTransition) {
      await prisma.adaptationHistory.create({
        data: {
          userId: runner.user.id,
          transitionDate: weekStartDate,
          fromState: result.stateTransition.from,
          toState: result.stateTransition.to,
          triggerReason: result.stateTransition.reason,
          triggerData: {
            selectedPlanId: result.selectedPlanId,
            weekNumber: result.weekNumber,
          },
          volumeChangePercentage: result.plan.rampPercentage,
          adaptationRationale: "Automatic transition from weekly pipeline generation.",
          window7Day: windows.window7Day,
          window28Day: windows.window28Day,
          window90Day: windows.window90Day,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      userId: runner.user.id,
      weeklyPlanId: savedPlan.id,
      selectedPlanId: result.selectedPlanId,
      weekNumber: result.weekNumber,
      state: result.plan.state,
      totalVolumeKm: result.plan.totalVolumeKm,
      wasRepaired: result.wasRepaired,
      repairsApplied: result.repairs.length,
      softViolations: result.softViolations.length,
      workouts: savedPlan.workouts.length,
    });
  } catch (error) {
    console.error("POST /api/plans/generate failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
