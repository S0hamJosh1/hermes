/**
 * POST /api/recalibrate
 *
 * Recomputes weekly capacity (and other profile metrics) from all synced
 * Strava activities. Use when mileage looks wrong despite correct best efforts
 * — capacity is normally set once at onboarding and never updated.
 *
 * No Strava API call; uses existing activities in DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { autoCalibrate } from "@/lib/calibration/auto-calibrate";

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.runnerProfile.findUnique({
        where: { userId: session.userId },
    });
    if (!profile) {
        return NextResponse.json(
            { error: "No runner profile found. Complete onboarding first." },
            { status: 404 }
        );
    }

    const activities = await prisma.stravaActivity.findMany({
        where: {
            userId: session.userId,
            activityType: { in: ["Run", "TrailRun", "VirtualRun", "Treadmill"] },
        },
        select: {
            distanceMeters: true,
            movingTimeSeconds: true,
            startDate: true,
            startDateLocal: true,
        },
    });

    if (activities.length === 0) {
        return NextResponse.json(
            { error: "No activities to calibrate from. Sync from Strava first." },
            { status: 400 }
        );
    }

    const activityData = activities.map((a) => ({
        distanceMeters: a.distanceMeters,
        movingTimeSeconds: a.movingTimeSeconds,
        startDate: a.startDate,
        startDateLocal: a.startDateLocal,
    }));

    const calibrated = autoCalibrate(activityData);

    await prisma.runnerProfile.update({
        where: { userId: session.userId },
        data: {
            weeklyCapacityKm: calibrated.weeklyCapacityKm,
            basePaceSecondsPerKm: calibrated.basePaceSecondsPerKm,
            thresholdPaceSecondsPerKm: calibrated.thresholdPaceSecondsPerKm,
            durabilityScore: calibrated.durabilityScore,
            consistencyScore: calibrated.consistencyScore,
            riskLevel: calibrated.riskLevel,
        },
    });

    return NextResponse.json({
        ok: true,
        weeklyCapacityKm: calibrated.weeklyCapacityKm,
        dataPoints: calibrated.dataPoints,
        weeksAnalyzed: calibrated.weeksAnalyzed,
    });
}
