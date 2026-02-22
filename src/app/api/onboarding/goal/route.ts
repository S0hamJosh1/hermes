/**
 * POST /api/onboarding/goal
 *
 * Saves the user's long-term goal.
 *
 * Body: {
 *   distance: "5K" | "10K" | "Half Marathon" | "Marathon",
 *   targetDate: string (ISO date),
 *   targetTimeSeconds?: number,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { computePersonalBests, type PersonalBestMap, type RaceDistance } from "@/lib/strava/performance";

type GoalBody = {
    distance: string;
    targetDate: string;
    targetTimeSeconds?: number;
};

const VALID_DISTANCES = ["5K", "10K", "Half Marathon", "Marathon"];

// Minimum weeks required from today for each distance
const MIN_WEEKS: Record<string, number> = {
    "5K": 4,
    "10K": 6,
    "Half Marathon": 10,
    "Marathon": 16,
};

const DISTANCE_KM: Record<string, number> = {
    "5K": 5,
    "10K": 10,
    "Half Marathon": 21.0975,
    "Marathon": 42.195,
};

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function atProgress(start: Date, end: Date, pct: number): Date {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const ms = Math.round(startMs + (endMs - startMs) * pct);
    return new Date(ms);
}

async function regenerateRoadmapForGoal(params: {
    userId: string;
    goalId: string;
    distance: string;
    targetDate: Date;
    targetTimeSeconds: number | null;
    basePaceSecondsPerKm: number;
    weeklyCapacityKm: number;
    personalBests: PersonalBestMap;
}): Promise<void> {
    const {
        userId,
        goalId,
        distance,
        targetDate,
        targetTimeSeconds,
        basePaceSecondsPerKm,
        weeklyCapacityKm,
    } = params;

    await prisma.roadmap.deleteMany({ where: { goalId } });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const startDate = now;
    const raceDate = new Date(targetDate);
    raceDate.setHours(0, 0, 0, 0);

    const endDate = raceDate > startDate ? raceDate : addDays(startDate, 28);

    const phases = [
        { number: 1, name: "Foundation", startPct: 0, endPct: 0.35, volumeMul: 0.8, focus: "Base aerobic volume" },
        { number: 2, name: "Build", startPct: 0.35, endPct: 0.7, volumeMul: 0.95, focus: "Strength + durability" },
        { number: 3, name: "Specificity", startPct: 0.7, endPct: 0.9, volumeMul: 1.05, focus: "Race-specific workouts" },
        { number: 4, name: "Taper", startPct: 0.9, endPct: 1, volumeMul: 0.7, focus: "Freshen up for race day" },
    ];

    const createdPhases = [];
    for (const p of phases) {
        const roadmap = await prisma.roadmap.create({
            data: {
                userId,
                goalId,
                phaseNumber: p.number,
                phaseName: p.name,
                startDate: atProgress(startDate, endDate, p.startPct),
                endDate: atProgress(startDate, endDate, p.endPct),
                targetVolumeKm: Math.round(weeklyCapacityKm * p.volumeMul * 10) / 10,
                focus: p.focus,
            },
        });
        createdPhases.push({ ...p, id: roadmap.id });
    }

    const distanceKm = DISTANCE_KM[distance] ?? 10;
    const race = distance as RaceDistance;
    const pb = params.personalBests[race];
    const baselineFromStrava = pb?.secondBest?.timeSeconds ?? pb?.best?.timeSeconds ?? null;
    const baselineRaceTimeSeconds = baselineFromStrava ?? Math.round(basePaceSecondsPerKm * distanceKm * 1.08);
    const finalTargetSeconds = targetTimeSeconds && targetTimeSeconds > 0
        ? targetTimeSeconds
        : Math.round(baselineRaceTimeSeconds * 0.96);
    const startTargetSeconds = Math.max(finalTargetSeconds + 60, baselineRaceTimeSeconds);

    const checkpoints = [
        { pct: 0.25, label: "25% checkpoint" },
        { pct: 0.5, label: "50% checkpoint" },
        { pct: 0.75, label: "75% checkpoint" },
        { pct: 1, label: "Race target" },
    ];

    for (const cp of checkpoints) {
        const cpDate = atProgress(startDate, endDate, cp.pct);
        const phase = createdPhases.find((p) => cp.pct <= p.endPct) ?? createdPhases[createdPhases.length - 1];
        const interpolated = Math.round(
            startTargetSeconds - (startTargetSeconds - finalTargetSeconds) * cp.pct
        );

        await prisma.milestone.create({
            data: {
                roadmapId: phase.id,
                milestoneName: `${cp.label} · ${distance}`,
                targetDate: cpDate,
                targetMetric: `${distance} time_seconds`,
                targetValue: interpolated,
                achieved: false,
            },
        });
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: GoalBody;
    try {
        body = (await req.json()) as GoalBody;
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // Validate distance
    if (!VALID_DISTANCES.includes(body.distance)) {
        return NextResponse.json(
            { error: `Invalid distance. Must be one of: ${VALID_DISTANCES.join(", ")}` },
            { status: 400 }
        );
    }

    // Validate date
    const targetDate = new Date(body.targetDate);
    if (isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: "Invalid target date." }, { status: 400 });
    }

    const weeksUntilRace = Math.floor(
        (targetDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)
    );

    const minWeeks = MIN_WEEKS[body.distance] ?? 4;
    const feasible = weeksUntilRace >= minWeeks;

    // Check profile exists
    const profile = await prisma.runnerProfile.findUnique({
        where: { userId: session.userId },
        select: {
            id: true,
            basePaceSecondsPerKm: true,
            weeklyCapacityKm: true,
        },
    });
    if (!profile) {
        return NextResponse.json(
            { error: "Runner profile not found. Complete calibration first." },
            { status: 400 }
        );
    }

    // Deactivate any existing goals (set priority to 0)
    await prisma.longTermGoal.updateMany({
        where: { userId: session.userId },
        data: { priority: 0 },
    });

    // Create the new goal
    const goal = await prisma.longTermGoal.create({
        data: {
            userId: session.userId,
            distance: body.distance,
            targetDate,
            targetTimeSeconds: body.targetTimeSeconds ?? null,
            priority: 1,
        },
    });

    await prisma.runnerProfile.update({
        where: { userId: session.userId },
        data: {
            primaryGoalDistance: body.distance,
            primaryGoalDate: targetDate,
            goalTimeSeconds: body.targetTimeSeconds ?? null,
        },
    });

    const activities = await prisma.stravaActivity.findMany({
        where: { userId: session.userId },
        select: {
            distanceMeters: true,
            movingTimeSeconds: true,
            startDate: true,
        },
        orderBy: { startDate: "desc" },
        take: 2000,
    });
    const personalBests = computePersonalBests(activities);

    await regenerateRoadmapForGoal({
        userId: session.userId,
        goalId: goal.id,
        distance: body.distance,
        targetDate,
        targetTimeSeconds: body.targetTimeSeconds ?? null,
        basePaceSecondsPerKm: profile.basePaceSecondsPerKm,
        weeklyCapacityKm: Number(profile.weeklyCapacityKm),
        personalBests,
    });

    return NextResponse.json({
        ok: true,
        goalId: goal.id,
        distance: goal.distance,
        targetDate: goal.targetDate.toISOString().split("T")[0],
        weeksUntilRace,
        feasible,
        feasibilityNote: feasible
            ? `${weeksUntilRace} weeks — enough time to train.`
            : `Only ${weeksUntilRace} weeks away. We recommend at least ${minWeeks} weeks for a ${body.distance}. We'll make it work, but the plan will be compressed.`,
    });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const goals = await prisma.longTermGoal.findMany({
        where: { userId: session.userId },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        select: {
            id: true,
            distance: true,
            targetDate: true,
            targetTimeSeconds: true,
            priority: true,
            createdAt: true,
        },
    });

    const activeGoal = goals.find((g) => g.priority === 1) ?? null;
    const archivedGoals = goals.filter((g) => g.priority !== 1);

    return NextResponse.json({
        ok: true,
        goal: activeGoal
            ? {
                id: activeGoal.id,
                distance: activeGoal.distance,
                targetDate: activeGoal.targetDate.toISOString().split("T")[0],
                targetTimeSeconds: activeGoal.targetTimeSeconds,
            }
            : null,
        archivedGoals: archivedGoals.map((g) => ({
            id: g.id,
            distance: g.distance,
            targetDate: g.targetDate.toISOString().split("T")[0],
            targetTimeSeconds: g.targetTimeSeconds,
            createdAt: g.createdAt.toISOString(),
        })),
    });
}

type DeleteGoalBody = {
    goalId?: string;
    deleteArchived?: boolean;
};

export async function DELETE(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: DeleteGoalBody = {};
    try {
        body = (await req.json()) as DeleteGoalBody;
    } catch {
        // optional body
    }

    const userId = session.userId;
    let deleted = 0;

    if (body.deleteArchived) {
        const result = await prisma.longTermGoal.deleteMany({
            where: { userId, priority: { not: 1 } },
        });
        deleted += result.count;
    }

    if (body.goalId) {
        const goal = await prisma.longTermGoal.findFirst({
            where: { id: body.goalId, userId },
            select: { id: true, priority: true },
        });
        if (!goal) {
            return NextResponse.json({ error: "Goal not found." }, { status: 404 });
        }
        await prisma.longTermGoal.delete({ where: { id: goal.id } });
        deleted += 1;

        if (goal.priority === 1) {
            const nextGoal = await prisma.longTermGoal.findFirst({
                where: { userId },
                orderBy: { createdAt: "desc" },
            });

            if (nextGoal) {
                await prisma.longTermGoal.update({
                    where: { id: nextGoal.id },
                    data: { priority: 1 },
                });
                await prisma.runnerProfile.updateMany({
                    where: { userId },
                    data: {
                        primaryGoalDistance: nextGoal.distance,
                        primaryGoalDate: nextGoal.targetDate,
                        goalTimeSeconds: nextGoal.targetTimeSeconds ?? null,
                    },
                });
            } else {
                await prisma.runnerProfile.updateMany({
                    where: { userId },
                    data: {
                        primaryGoalDistance: null,
                        primaryGoalDate: null,
                        goalTimeSeconds: null,
                    },
                });
            }
        }
    }

    return NextResponse.json({ ok: true, deleted });
}
