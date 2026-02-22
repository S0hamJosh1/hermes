/**
 * GET /api/compliance
 *
 * Calculates compliance by comparing planned workouts to actual Strava activities.
 * Computes and stores a WeeklySummary for the current week and returns
 * compliance stats.
 *
 * POST /api/compliance
 *
 * Recalculates compliance for the current week (force refresh).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

function startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = (day + 6) % 7; // shift to Mon=0
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfWeek(start: Date): Date {
    const d = new Date(start);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
}

async function calculateWeeklyCompliance(
    userId: string,
    weekStart: Date
): Promise<{
    plannedVolumeKm: number;
    actualVolumeKm: number;
    compliancePercentage: number;
    completedWorkouts: number;
    totalWorkouts: number;
}> {
    const weekEnd = endOfWeek(weekStart);

    // Get planned workouts for this week
    const weeklyPlan = await prisma.weeklyPlan.findFirst({
        where: {
            userId,
            weekStartDate: {
                gte: weekStart,
                lte: weekEnd,
            },
        },
        include: {
            workouts: true,
        },
    });

    // Get actual Strava activities for this week
    const activities = await prisma.stravaActivity.findMany({
        where: {
            userId,
            startDate: {
                gte: weekStart,
                lte: weekEnd,
            },
        },
    });

    const actualVolumeKm = activities.reduce(
        (sum, a) => sum + Number(a.distanceMeters) / 1000,
        0
    );

    if (!weeklyPlan) {
        // No plan exists — compliance based on just activity volume
        return {
            plannedVolumeKm: 0,
            actualVolumeKm: Math.round(actualVolumeKm * 10) / 10,
            compliancePercentage: 0,
            completedWorkouts: 0,
            totalWorkouts: 0,
        };
    }

    const plannedVolumeKm = Number(weeklyPlan.totalVolumeKm);
    const compliancePercentage =
        plannedVolumeKm > 0
            ? Math.min(100, Math.round((actualVolumeKm / plannedVolumeKm) * 100))
            : 100;

    // Count completed workouts (non-rest workouts that have been matched)
    const nonRestWorkouts = weeklyPlan.workouts.filter(
        (w) => w.workoutType !== "rest" && w.workoutType !== "cross_training"
    );
    const completedWorkouts = nonRestWorkouts.filter((w) => w.completed).length;

    return {
        plannedVolumeKm: Math.round(plannedVolumeKm * 10) / 10,
        actualVolumeKm: Math.round(actualVolumeKm * 10) / 10,
        compliancePercentage,
        completedWorkouts,
        totalWorkouts: nonRestWorkouts.length,
    };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;
    const now = new Date();
    const thisWeekStart = startOfWeek(now);

    // Calculate current week
    const currentWeek = await calculateWeeklyCompliance(userId, thisWeekStart);

    // Get last 4 weekly summaries
    const summaries = await prisma.weeklySummary.findMany({
        where: { userId },
        orderBy: { weekStartDate: "desc" },
        take: 4,
        select: {
            weekStartDate: true,
            plannedVolumeKm: true,
            actualVolumeKm: true,
            compliancePercentage: true,
        },
    });

    const historicalCompliances = summaries
        .filter((s) => s.compliancePercentage !== null)
        .map((s) => Number(s.compliancePercentage));

    const last4WeekAverage =
        historicalCompliances.length > 0
            ? historicalCompliances.reduce((a, b) => a + b, 0) / historicalCompliances.length
            : null;

    return NextResponse.json({
        currentWeek,
        historical: summaries.map((s) => ({
            weekStartDate: s.weekStartDate,
            plannedVolumeKm: s.plannedVolumeKm ? Number(s.plannedVolumeKm) : null,
            actualVolumeKm: s.actualVolumeKm ? Number(s.actualVolumeKm) : null,
            compliancePercentage: s.compliancePercentage
                ? Number(s.compliancePercentage)
                : null,
        })),
        last4WeekAverage,
    });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;
    const now = new Date();
    const thisWeekStart = startOfWeek(now);
    const thisWeekEnd = endOfWeek(thisWeekStart);

    const compliance = await calculateWeeklyCompliance(userId, thisWeekStart);

    // Upsert weekly summary
    await prisma.weeklySummary.upsert({
        where: {
            userId_weekStartDate: {
                userId,
                weekStartDate: thisWeekStart,
            },
        },
        update: {
            plannedVolumeKm: compliance.plannedVolumeKm,
            actualVolumeKm: compliance.actualVolumeKm,
            compliancePercentage: compliance.compliancePercentage,
        },
        create: {
            userId,
            weekStartDate: thisWeekStart,
            weekEndDate: thisWeekEnd,
            plannedVolumeKm: compliance.plannedVolumeKm,
            actualVolumeKm: compliance.actualVolumeKm,
            compliancePercentage: compliance.compliancePercentage,
        },
    });

    // Also update the runner profile's 28-day consistency
    const last4Summaries = await prisma.weeklySummary.findMany({
        where: { userId },
        orderBy: { weekStartDate: "desc" },
        take: 4,
        select: { compliancePercentage: true },
    });

    if (last4Summaries.length > 0) {
        const avg =
            last4Summaries
                .filter((s) => s.compliancePercentage !== null)
                .reduce((sum, s) => sum + Number(s.compliancePercentage), 0) /
            last4Summaries.length;

        await prisma.runnerProfile.updateMany({
            where: { userId },
            data: {
                last28DayConsistency: Math.round(avg) / 100,
            },
        });
    }

    return NextResponse.json({
        ok: true,
        compliance,
        message: "Weekly compliance recalculated.",
    });
}
