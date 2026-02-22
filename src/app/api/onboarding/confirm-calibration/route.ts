/**
 * POST /api/onboarding/confirm-calibration
 *
 * User confirms the auto-calibrated profile (optionally with overrides).
 * Creates the RunnerProfile in DB with bootcampCompleted: true.
 *
 * Body: {
 *   basePaceSecondsPerKm?: number,    // override
 *   weeklyCapacityKm?: number,        // override
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkDataSufficiency } from "@/lib/calibration/sufficiency";
import { autoCalibrate } from "@/lib/calibration/auto-calibrate";

type ConfirmBody = {
    basePaceSecondsPerKm?: number;
    weeklyCapacityKm?: number;
};

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

    // Load activities
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

    const activityData = activities.map((a) => ({
        distanceMeters: a.distanceMeters,
        movingTimeSeconds: a.movingTimeSeconds,
        startDate: a.startDate,
    }));

    // Verify sufficiency again (safety check)
    const sufficiency = checkDataSufficiency(activityData);
    if (!sufficiency.sufficient) {
        return NextResponse.json(
            { error: "Not enough data for auto-calibration.", reason: sufficiency.reason },
            { status: 400 }
        );
    }

    // Run calibration
    const calibrated = autoCalibrate(activityData);

    // Apply any user overrides (clamped to safe ranges)
    let body: ConfirmBody = {};
    try {
        body = (await req.json()) as ConfirmBody;
    } catch {
        // No body is fine
    }

    const basePace = body.basePaceSecondsPerKm
        ? Math.max(240, Math.min(body.basePaceSecondsPerKm, 600))
        : calibrated.basePaceSecondsPerKm;

    const weeklyCapacity = body.weeklyCapacityKm
        ? Math.max(5, Math.min(body.weeklyCapacityKm, 200))
        : calibrated.weeklyCapacityKm;

    const thresholdPace = Math.round(basePace * 0.88);

    // Create the runner profile
    const profile = await prisma.runnerProfile.create({
        data: {
            userId: session.userId,
            basePaceSecondsPerKm: basePace,
            thresholdPaceSecondsPerKm: thresholdPace,
            weeklyCapacityKm: weeklyCapacity,
            durabilityScore: calibrated.durabilityScore,
            consistencyScore: calibrated.consistencyScore,
            riskLevel: calibrated.riskLevel,
            currentState: "Stable",
            overrideModeEnabled: false,
            bootcampCompleted: true,
            bootcampStartDate: calibrated.weeksAnalyzed > 0
                ? new Date(Date.now() - calibrated.weeksAnalyzed * 7 * 24 * 60 * 60 * 1000)
                : new Date(),
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
        calibratedFromHistory: true,
    });
}
