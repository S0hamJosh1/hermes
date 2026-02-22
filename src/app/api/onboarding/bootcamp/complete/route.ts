/**
 * POST /api/onboarding/bootcamp/complete
 *
 * Completes the bootcamp calibration using whatever data exists.
 * Called after 7 days OR when the user has enough runs.
 * Uses the same auto-calibration engine but with relaxed thresholds.
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

    // Check if profile already exists
    const existing = await prisma.runnerProfile.findUnique({
        where: { userId: session.userId },
    });
    if (existing) {
        return NextResponse.json({ error: "Profile already exists." }, { status: 409 });
    }

    // Check eligibility: 7 days elapsed OR sufficient data
    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { createdAt: true },
    });
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const daysElapsed = Math.floor(
        (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    );

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
    });

    if (activities.length === 0 && daysElapsed < 7) {
        return NextResponse.json(
            { error: "No runs logged yet. Complete at least one run before calibrating." },
            { status: 400 }
        );
    }

    const activityData = activities.map((a) => ({
        distanceMeters: a.distanceMeters,
        movingTimeSeconds: a.movingTimeSeconds,
        startDate: a.startDate,
    }));

    // Use calibration engine (works even with minimal data — will use fallbacks)
    const calibrated = activities.length > 0
        ? autoCalibrate(activityData)
        : {
            // Pure defaults for zero-data case
            basePaceSecondsPerKm: 390,   // 6:30/km — conservative default
            thresholdPaceSecondsPerKm: 343,
            weeklyCapacityKm: 20,
            durabilityScore: 0.3,
            consistencyScore: 0.3,
            riskLevel: "moderate" as const,
            dataPoints: 0,
            weeksAnalyzed: 0,
            estimatedFromHistory: true as const,
        };

    const profile = await prisma.runnerProfile.create({
        data: {
            userId: session.userId,
            basePaceSecondsPerKm: calibrated.basePaceSecondsPerKm,
            thresholdPaceSecondsPerKm: calibrated.thresholdPaceSecondsPerKm,
            weeklyCapacityKm: calibrated.weeklyCapacityKm,
            durabilityScore: calibrated.durabilityScore,
            consistencyScore: calibrated.consistencyScore,
            riskLevel: calibrated.riskLevel,
            currentState: "Stable",
            overrideModeEnabled: false,
            bootcampCompleted: true,
            bootcampStartDate: user.createdAt,
            bootcampEndDate: new Date(),
        },
    });

    // Initialize momentum and killa meters
    await prisma.momentumMeter.upsert({
        where: { userId: session.userId },
        update: {},
        create: { userId: session.userId },
    });
    await prisma.killaMeter.upsert({
        where: { userId: session.userId },
        update: {},
        create: { userId: session.userId },
    });

    return NextResponse.json({
        ok: true,
        profileId: profile.id,
        basePaceSecondsPerKm: profile.basePaceSecondsPerKm,
        weeklyCapacityKm: Number(profile.weeklyCapacityKm),
        riskLevel: profile.riskLevel,
        dataPoints: calibrated.dataPoints,
        usedDefaults: activities.length === 0,
    });
}
