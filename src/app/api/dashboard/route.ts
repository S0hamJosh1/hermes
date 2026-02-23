/**
 * GET /api/dashboard
 *
 * Returns aggregated dashboard data for the authenticated user:
 *   - Runner profile (state, paces, capacity, goal)
 *   - Health summary (active injuries, strike count, recent records)
 *   - Compliance data (current week, 4-week average)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { computePersonalBests } from "@/lib/strava/performance";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;

    // Fetch profile, health records, strikes, and weekly summaries in parallel
    const [profile, activeInjuries, strikeCount, recentRecords, weeklySummaries, activities] =
        await Promise.all([
            prisma.runnerProfile.findUnique({
                where: { userId },
                select: {
                    currentState: true,
                    basePaceSecondsPerKm: true,
                    thresholdPaceSecondsPerKm: true,
                    weeklyCapacityKm: true,
                    durabilityScore: true,
                    consistencyScore: true,
                    riskLevel: true,
                    planLevelOffset: true,
                    planLevelMode: true,
                    primaryGoalDistance: true,
                    primaryGoalDate: true,
                    goalTimeSeconds: true,
                },
            }),
            // Active injuries: health records of type 'injury' or 'pain' with severity >= 4, from last 30 days
            prisma.healthRecord.findMany({
                where: {
                    userId,
                    recordType: { in: ["injury", "pain"] },
                    severity: { gte: 4 },
                    recordDate: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
                orderBy: { recordDate: "desc" },
                take: 10,
                select: {
                    id: true,
                    bodyPart: true,
                    severity: true,
                    recordDate: true,
                    description: true,
                },
            }),
            // Active (unresolved) strikes
            prisma.healthStrike.count({
                where: { userId, resolved: false },
            }),
            // Recent health records (last 5)
            prisma.healthRecord.findMany({
                where: { userId },
                orderBy: { recordDate: "desc" },
                take: 5,
                select: {
                    id: true,
                    recordType: true,
                    bodyPart: true,
                    severity: true,
                    recordDate: true,
                },
            }),
            // Last 4 weekly summaries for compliance
            prisma.weeklySummary.findMany({
                where: { userId },
                orderBy: { weekStartDate: "desc" },
                take: 4,
                select: {
                    weekStartDate: true,
                    plannedVolumeKm: true,
                    actualVolumeKm: true,
                    compliancePercentage: true,
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

    // Compute compliance
    let currentWeekCompliance: number | null = null;
    let last4WeekAverage: number | null = null;
    let totalPlannedKm: number | null = null;
    let totalActualKm: number | null = null;
    let trend: "improving" | "declining" | "stable" | "unknown" = "unknown";

    if (weeklySummaries.length > 0) {
        const latest = weeklySummaries[0];
        currentWeekCompliance = latest.compliancePercentage
            ? Number(latest.compliancePercentage)
            : null;
        totalPlannedKm = latest.plannedVolumeKm
            ? Number(latest.plannedVolumeKm)
            : null;
        totalActualKm = latest.actualVolumeKm
            ? Number(latest.actualVolumeKm)
            : null;

        const validCompliances = weeklySummaries
            .filter((s) => s.compliancePercentage !== null)
            .map((s) => Number(s.compliancePercentage));

        if (validCompliances.length > 0) {
            last4WeekAverage =
                validCompliances.reduce((a, b) => a + b, 0) /
                validCompliances.length;
        }

        // Trend: compare first half to second half
        if (validCompliances.length >= 2) {
            const mid = Math.floor(validCompliances.length / 2);
            const recent = validCompliances.slice(0, mid);
            const older = validCompliances.slice(mid);
            const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
            const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
            if (avgRecent > avgOlder + 5) trend = "improving";
            else if (avgRecent < avgOlder - 5) trend = "declining";
            else trend = "stable";
        }
    }

    return NextResponse.json({
        profile: profile
            ? {
                ...profile,
                weeklyCapacityKm: Number(profile.weeklyCapacityKm),
                durabilityScore: Number(profile.durabilityScore),
                consistencyScore: Number(profile.consistencyScore),
            }
            : null,
        health: {
            activeInjuries,
            activeStrikes: strikeCount,
            recentRecords,
        },
        compliance: {
            currentWeekCompliance,
            last4WeekAverage,
            totalPlannedKm,
            totalActualKm,
            trend,
        },
        performance: personalBests,
    });
}
