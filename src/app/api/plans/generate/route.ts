import { NextRequest, NextResponse } from "next/server";
import type { RunnerProfile as AlgoRunnerProfile, RunnerGoal } from "@/lib/algorithm";
import { runWeeklyPipeline } from "@/lib/algorithm";
import { loadParsedPlans } from "@/lib/plans/load-hal-higdon";
import { prisma } from "@/lib/db/client";
import { getSessionFromRequest } from "@/lib/auth/session";
import type { RunnerProfile as DbRunnerProfile } from "@prisma/client";

type GeneratePlanRequest = {
  userId?: string;
  goal?: {
    distance?: "4K" | "5K" | "10K" | "Half Marathon" | "Marathon";
    targetDate?: string;
    targetTimeSeconds?: number;
  };
  weekStartDate?: string;
  profileOverrides?: Partial<AlgoRunnerProfile>;
};

const DEMO_STRAVA_ID = BigInt("900000000001");

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

type ActivitySample = {
  startDate: Date;
  distanceMeters: unknown;
  movingTimeSeconds: number;
};

function summarizeActivities(activities: ActivitySample[], lookbackDays: number) {
  const since = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const inWindow = activities.filter((a) => new Date(a.startDate).getTime() >= since);
  const totalKm = inWindow.reduce((sum, a) => sum + toNumber(a.distanceMeters, 0) / 1000, 0);
  const totalSeconds = inWindow.reduce((sum, a) => sum + a.movingTimeSeconds, 0);
  const avgPaceSecondsPerKm = totalKm > 0 ? totalSeconds / totalKm : 0;
  const runDays = new Set(inWindow.map((a) => new Date(a.startDate).toISOString().slice(0, 10))).size;
  const restDays = Math.max(0, lookbackDays - runDays);
  const longRunsCount = inWindow.filter((a) => toNumber(a.distanceMeters, 0) / 1000 >= 12).length;
  const qualitySessionsCount = inWindow.filter((a) => {
    const km = toNumber(a.distanceMeters, 0) / 1000;
    if (km < 3) return false;
    const pace = km > 0 ? a.movingTimeSeconds / km : 0;
    return pace > 0 && avgPaceSecondsPerKm > 0 && pace <= avgPaceSecondsPerKm * 0.95;
  }).length;

  return {
    volumeKm: Math.round(totalKm * 10) / 10,
    averagePaceSecondsPerKm: avgPaceSecondsPerKm > 0 ? Math.round(avgPaceSecondsPerKm) : 0,
    compliancePercentage: Math.min(100, Math.round((runDays / Math.max(1, lookbackDays / 2)) * 100)),
    healthIssuesCount: 0,
    restDays,
    qualitySessionsCount,
    longRunsCount,
  };
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as GeneratePlanRequest;

    // Support session-based auth: if no userId in body, try session cookie
    let userId = body.userId;
    if (!userId) {
      const session = await getSessionFromRequest(req);
      if (session) userId = session.userId;
    }

    const runner = await getOrCreateRunner(userId);
    if (!runner) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const profile = mapProfileToAlgorithm(
      runner.user.id,
      runner.profile,
      body.profileOverrides
    );

    // Load goal from request body, or fall back to user's DB goal
    let goal: RunnerGoal;
    if (body.goal?.distance) {
      goal = {
        distance: body.goal.distance,
        targetDate: body.goal.targetDate ? new Date(body.goal.targetDate) : addDays(new Date(), 140),
        targetTimeSeconds: body.goal.targetTimeSeconds,
      };
    } else {
      const dbGoal = await prisma.longTermGoal.findFirst({
        where: { userId: runner.user.id },
        orderBy: { priority: "asc" },
      });
      goal = {
        distance: (dbGoal?.distance as RunnerGoal["distance"]) ?? "Marathon",
        targetDate: dbGoal?.targetDate ?? addDays(new Date(), 140),
        targetTimeSeconds: dbGoal?.targetTimeSeconds ?? undefined,
      };
    }


    const weekStartDate = body.weekStartDate
      ? startOfWeek(new Date(body.weekStartDate))
      : startOfWeek(new Date());
    const weekEndDate = addDays(weekStartDate, 6);

    const previousPlan = await prisma.weeklyPlan.findFirst({
      where: { userId: runner.user.id },
      orderBy: { weekStartDate: "desc" },
    });
    const recentActivities = await prisma.stravaActivity.findMany({
      where: {
        userId: runner.user.id,
        startDate: { gte: addDays(new Date(), -90) },
      },
      select: {
        startDate: true,
        distanceMeters: true,
        movingTimeSeconds: true,
      },
      orderBy: { startDate: "desc" },
    });

    const latestSummary = await prisma.weeklySummary.findFirst({
      where: { userId: runner.user.id },
      orderBy: { weekStartDate: "desc" },
    });

    const byActivity = {
      window7Day: summarizeActivities(recentActivities, 7),
      window28Day: summarizeActivities(recentActivities, 28),
      window90Day: summarizeActivities(recentActivities, 90),
    };

    const previousWeekVolumeKm = previousPlan
      ? toNumber(previousPlan.totalVolumeKm, 0)
      : byActivity.window7Day.volumeKm;

    const windows = {
      window7Day: {
        volumeKm: latestSummary ? toNumber(latestSummary.actualVolumeKm, byActivity.window7Day.volumeKm) : byActivity.window7Day.volumeKm,
        averagePaceSecondsPerKm: latestSummary
          ? toNumber(latestSummary.averagePaceSecondsPerKm, byActivity.window7Day.averagePaceSecondsPerKm || profile.basePaceSecondsPerKm)
          : (byActivity.window7Day.averagePaceSecondsPerKm || profile.basePaceSecondsPerKm),
        compliancePercentage: latestSummary ? toNumber(latestSummary.compliancePercentage, byActivity.window7Day.compliancePercentage) : byActivity.window7Day.compliancePercentage,
        healthIssuesCount: latestSummary?.healthIssuesCount ?? 0,
        restDays: latestSummary?.restDays ?? byActivity.window7Day.restDays,
        qualitySessionsCount: byActivity.window7Day.qualitySessionsCount,
        longRunsCount: byActivity.window7Day.longRunsCount,
      },
      window28Day: {
        volumeKm: toNumber(runner.profile.last28DayVolume, byActivity.window28Day.volumeKm || previousWeekVolumeKm * 4),
        averagePaceSecondsPerKm: byActivity.window28Day.averagePaceSecondsPerKm || profile.basePaceSecondsPerKm,
        compliancePercentage: latestSummary ? toNumber(latestSummary.compliancePercentage, byActivity.window28Day.compliancePercentage) : byActivity.window28Day.compliancePercentage,
        healthIssuesCount: latestSummary?.healthIssuesCount ?? 0,
        restDays: byActivity.window28Day.restDays,
        qualitySessionsCount: byActivity.window28Day.qualitySessionsCount,
        longRunsCount: byActivity.window28Day.longRunsCount,
      },
      window90Day: {
        volumeKm: toNumber(runner.profile.last90DayVolume, byActivity.window90Day.volumeKm || previousWeekVolumeKm * 13),
        averagePaceSecondsPerKm: byActivity.window90Day.averagePaceSecondsPerKm || profile.basePaceSecondsPerKm,
        compliancePercentage: latestSummary ? toNumber(latestSummary.compliancePercentage, byActivity.window90Day.compliancePercentage) : byActivity.window90Day.compliancePercentage,
        healthIssuesCount: latestSummary?.healthIssuesCount ?? 0,
        restDays: byActivity.window90Day.restDays,
        qualitySessionsCount: byActivity.window90Day.qualitySessionsCount,
        longRunsCount: byActivity.window90Day.longRunsCount,
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
      result.plan.workouts.reduce((sum: number, w: typeof result.plan.workouts[0]) => {
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
        validationErrors: result.softViolations.length > 0 ? result.softViolations : undefined,
        repairActions: result.repairs.length > 0 ? result.repairs : undefined,
        userEdited: false,
        published: true,
        publishedAt: new Date(),
        workouts: {
          create: result.plan.workouts
            .slice()
            .sort((a: typeof result.plan.workouts[0], b: typeof result.plan.workouts[0]) => a.dayOfWeek - b.dayOfWeek)
            .map((w: typeof result.plan.workouts[0], idx: number) => ({
              workoutDate: addDays(weekStartDate, w.dayOfWeek),
              workoutType: w.type,
              plannedDistanceKm: w.distanceKm,
              plannedDurationMinutes:
                w.distanceKm > 0 && w.paceSecondsPerKm > 0
                  ? Math.round((w.distanceKm * w.paceSecondsPerKm) / 60)
                  : null,
              plannedPaceSecondsPerKm:
                w.distanceKm > 0 && w.paceSecondsPerKm > 0 ? w.paceSecondsPerKm : null,
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
