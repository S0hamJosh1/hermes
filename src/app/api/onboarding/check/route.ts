/**
 * GET /api/onboarding/check
 *
 * Checks whether the user has enough Strava history to skip bootcamp
 * and auto-calibrate their runner profile.
 *
 * Returns:
 *   { sufficient, reason, stats, calibratedProfile? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkDataSufficiency } from "@/lib/calibration/sufficiency";
import { autoCalibrate, formatPace, formatScore } from "@/lib/calibration/auto-calibrate";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load all synced run activities for this user
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

    // Run sufficiency check
    const sufficiency = checkDataSufficiency(
        activities.map((a) => ({
            distanceMeters: a.distanceMeters,
            movingTimeSeconds: a.movingTimeSeconds,
            startDate: a.startDate,
        }))
    );

    if (!sufficiency.sufficient) {
        return NextResponse.json({
            sufficient: false,
            reason: sufficiency.reason,
            stats: sufficiency.stats,
            calibratedProfile: null,
        });
    }

    // Auto-calibrate from the data
    const calibrated = autoCalibrate(
        activities.map((a) => ({
            distanceMeters: a.distanceMeters,
            movingTimeSeconds: a.movingTimeSeconds,
            startDate: a.startDate,
        }))
    );

    return NextResponse.json({
        sufficient: true,
        reason: sufficiency.reason,
        stats: sufficiency.stats,
        calibratedProfile: {
            ...calibrated,
            // Human-readable display values
            basePaceFormatted: formatPace(calibrated.basePaceSecondsPerKm),
            thresholdPaceFormatted: formatPace(calibrated.thresholdPaceSecondsPerKm),
            consistencyFormatted: formatScore(calibrated.consistencyScore),
            durabilityFormatted: formatScore(calibrated.durabilityScore),
        },
    });
}
