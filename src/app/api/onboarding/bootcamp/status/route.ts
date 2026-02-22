/**
 * GET /api/onboarding/bootcamp/status
 *
 * Returns the current bootcamp status for a user who doesn't have
 * enough historical data for auto-calibration.
 *
 * Returns:
 *   { daysElapsed, runsLogged, sufficient, sufficiencyStats, canComplete }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkDataSufficiency } from "@/lib/calibration/sufficiency";

const BOOTCAMP_DAYS = 7;

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if profile already exists (bootcamp already completed)
    const profile = await prisma.runnerProfile.findUnique({
        where: { userId: session.userId },
        select: { bootcampCompleted: true },
    });
    if (profile?.bootcampCompleted) {
        return NextResponse.json({ alreadyCompleted: true });
    }

    // Get user's creation date (bootcamp start = account creation)
    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { createdAt: true },
    });
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const bootcampStartDate = user.createdAt;
    const now = new Date();
    const daysElapsed = Math.floor(
        (now.getTime() - bootcampStartDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Load all synced run activities since bootcamp start
    const activities = await prisma.stravaActivity.findMany({
        where: {
            userId: session.userId,
            activityType: { in: ["Run", "TrailRun", "VirtualRun", "Treadmill"] },
        },
        select: {
            distanceMeters: true,
            movingTimeSeconds: true,
            startDate: true,
        },
        orderBy: { startDate: "asc" },
    });

    const activityData = activities.map((a) => ({
        distanceMeters: a.distanceMeters,
        movingTimeSeconds: a.movingTimeSeconds,
        startDate: a.startDate,
    }));

    const sufficiency = checkDataSufficiency(activityData);

    return NextResponse.json({
        alreadyCompleted: false,
        daysElapsed: Math.min(daysElapsed, BOOTCAMP_DAYS),
        daysTotal: BOOTCAMP_DAYS,
        runsLogged: sufficiency.stats.totalRuns,
        sufficient: sufficiency.sufficient,
        canComplete: sufficiency.sufficient || daysElapsed >= BOOTCAMP_DAYS,
        sufficiencyStats: sufficiency.stats,
        missingReasons: sufficiency.stats.missingReasons,
    });
}
