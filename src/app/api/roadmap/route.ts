/**
 * GET /api/roadmap
 *
 * Returns the user's active goal, roadmap phases, and milestones.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { computePersonalBests, type PersonalBestMap, type RaceDistance } from "@/lib/strava/performance";

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
    return new Date(Math.round(start.getTime() + (end.getTime() - start.getTime()) * pct));
}

async function ensureRoadmapForGoal(params: {
    userId: string;
    goalId: string;
    distance: string;
    targetDate: Date;
    targetTimeSeconds: number | null;
    basePaceSecondsPerKm: number;
    weeklyCapacityKm: number;
    personalBests: PersonalBestMap;
}): Promise<void> {
    const existing = await prisma.roadmap.count({ where: { goalId: params.goalId } });
    if (existing > 0) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = params.targetDate > now ? params.targetDate : addDays(now, 28);

    const phases = [
        { n: 1, name: "Foundation", a: 0, b: 0.35, v: 0.8, focus: "Base aerobic volume" },
        { n: 2, name: "Build", a: 0.35, b: 0.7, v: 0.95, focus: "Strength + durability" },
        { n: 3, name: "Specificity", a: 0.7, b: 0.9, v: 1.05, focus: "Race-specific workouts" },
        { n: 4, name: "Taper", a: 0.9, b: 1, v: 0.7, focus: "Freshen up for race day" },
    ];

    const created = [];
    for (const p of phases) {
        const row = await prisma.roadmap.create({
            data: {
                userId: params.userId,
                goalId: params.goalId,
                phaseNumber: p.n,
                phaseName: p.name,
                startDate: atProgress(now, end, p.a),
                endDate: atProgress(now, end, p.b),
                targetVolumeKm: Math.round(params.weeklyCapacityKm * p.v * 10) / 10,
                focus: p.focus,
            },
        });
        created.push({ ...p, id: row.id });
    }

    const distanceKm = DISTANCE_KM[params.distance] ?? 10;
    const race = params.distance as RaceDistance;
    const pb = params.personalBests[race];
    const baselineFromStrava = pb?.secondBest?.timeSeconds ?? pb?.best?.timeSeconds ?? null;
    const baseline = baselineFromStrava ?? Math.round(params.basePaceSecondsPerKm * distanceKm * 1.08);
    const finalTarget = params.targetTimeSeconds && params.targetTimeSeconds > 0
        ? params.targetTimeSeconds
        : Math.round(baseline * 0.96);
    const startTarget = Math.max(finalTarget + 60, baseline);
    const checkpoints = [0.25, 0.5, 0.75, 1];

    for (const pct of checkpoints) {
        const phase = created.find((p) => pct <= p.b) ?? created[created.length - 1];
        const targetValue = Math.round(startTarget - (startTarget - finalTarget) * pct);
        await prisma.milestone.create({
            data: {
                roadmapId: phase.id,
                milestoneName: `${Math.round(pct * 100)}% checkpoint · ${params.distance}`,
                targetDate: atProgress(now, end, pct),
                targetMetric: `${params.distance} time_seconds`,
                targetValue,
                achieved: false,
            },
        });
    }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;
    const includeArchived = new URL(req.url).searchParams.get("includeArchived") === "1";

    const [activeGoal, profile, activities] = await Promise.all([
        prisma.longTermGoal.findFirst({
            where: { userId, priority: 1 },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                distance: true,
                targetDate: true,
                targetTimeSeconds: true,
            },
        }),
        prisma.runnerProfile.findUnique({
            where: { userId },
            select: {
                basePaceSecondsPerKm: true,
                weeklyCapacityKm: true,
            },
        }),
        prisma.stravaActivity.findMany({
            where: { userId },
            select: {
                distanceMeters: true,
                movingTimeSeconds: true,
                startDate: true,
            },
            orderBy: { startDate: "desc" },
            take: 2000,
        }),
    ]);

    const personalBests = computePersonalBests(activities);

    if (activeGoal && profile) {
        await ensureRoadmapForGoal({
            userId,
            goalId: activeGoal.id,
            distance: activeGoal.distance,
            targetDate: activeGoal.targetDate,
            targetTimeSeconds: activeGoal.targetTimeSeconds,
            basePaceSecondsPerKm: profile.basePaceSecondsPerKm,
            weeklyCapacityKm: Number(profile.weeklyCapacityKm),
            personalBests,
        });
    }

    // By default, return active goal only to avoid duplicate roadmap rendering.
    const goals = await prisma.longTermGoal.findMany({
        where: includeArchived ? { userId } : { userId, priority: 1 },
        orderBy: { priority: "asc" },
        include: {
            roadmaps: {
                orderBy: { phaseNumber: "asc" },
                include: {
                    milestones: {
                        orderBy: { targetDate: "asc" },
                    },
                },
            },
        },
    });

    const now = new Date();

    const serialized = goals.map((goal) => ({
        id: goal.id,
        distance: goal.distance,
        targetDate: goal.targetDate,
        targetTimeSeconds: goal.targetTimeSeconds,
        priority: goal.priority,
        roadmaps: goal.roadmaps.map((roadmap) => {
            const startMs = new Date(roadmap.startDate).getTime();
            const endMs = new Date(roadmap.endDate).getTime();
            const nowMs = now.getTime();
            const totalDuration = endMs - startMs;
            const elapsed = Math.max(0, nowMs - startMs);
            const progress =
                totalDuration > 0
                    ? Math.min(100, Math.round((elapsed / totalDuration) * 100))
                    : 0;
            const isCurrent = nowMs >= startMs && nowMs <= endMs;
            const isPast = nowMs > endMs;

            return {
                id: roadmap.id,
                phaseNumber: roadmap.phaseNumber,
                phaseName: roadmap.phaseName,
                startDate: roadmap.startDate,
                endDate: roadmap.endDate,
                targetVolumeKm: roadmap.targetVolumeKm
                    ? Number(roadmap.targetVolumeKm)
                    : null,
                focus: roadmap.focus,
                progress,
                isCurrent,
                isPast,
                milestones: roadmap.milestones.map((m) => ({
                    id: m.id,
                    milestoneName: m.milestoneName,
                    targetDate: m.targetDate,
                    targetMetric: m.targetMetric,
                    targetValue: m.targetValue
                        ? Number(m.targetValue)
                        : null,
                    achieved: m.achieved,
                    achievedDate: m.achievedDate,
                })),
            };
        }),
    }));

    return NextResponse.json({ goals: serialized });
}
