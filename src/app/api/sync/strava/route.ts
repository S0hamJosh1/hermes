/**
 * POST /api/sync/strava
 *
 * Syncs recent Strava activities for the authenticated user.
 *
 * Flow:
 * 1. Read session → get userId
 * 2. Load user from DB (needs tokens)
 * 3. Get a valid access token (refresh if expired)
 * 4. Fetch activities from Strava (since last sync)
 * 5. Upsert each run into strava_activities table
 * 6. Return { synced, skipped }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { fetchStravaActivities, getValidAccessToken } from "@/lib/auth/strava";
import { prisma } from "@/lib/db/client";

// Activity types we care about (all running variants)
const RUN_TYPES = new Set([
    "Run",
    "TrailRun",
    "VirtualRun",
    "Treadmill",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
            id: true,
            accessToken: true,
            accessTokenExpiresAt: true,
            refreshToken: true,
            stravaActivities: {
                orderBy: { startDate: "desc" },
                take: 1,
                select: { startDate: true },
            },
        },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get a valid access token, refreshing if needed
    let accessToken: string;
    try {
        accessToken = await getValidAccessToken(user, async (data) => {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    accessToken: data.accessToken,
                    accessTokenExpiresAt: data.accessTokenExpiresAt,
                    refreshToken: data.refreshToken,
                },
            });
        });
    } catch (err) {
        console.error("[sync/strava] Token refresh failed:", err);
        return NextResponse.json({ error: "Token refresh failed. Please reconnect Strava." }, { status: 401 });
    }

    // Determine the "after" timestamp for incremental sync
    const lastActivity = user.stravaActivities[0];
    const after = lastActivity
        ? Math.floor(lastActivity.startDate.getTime() / 1000)
        : undefined;

    // Fetch activities from Strava
    let activities;
    try {
        activities = await fetchStravaActivities(accessToken, after);
    } catch (err) {
        console.error("[sync/strava] Fetch failed:", err);
        return NextResponse.json({ error: "Failed to fetch activities from Strava." }, { status: 502 });
    }

    let synced = 0;
    let skipped = 0;

    for (const activity of activities) {
        // Only sync running activities
        if (!RUN_TYPES.has(activity.type) && !RUN_TYPES.has(activity.sport_type)) {
            skipped++;
            continue;
        }

        try {
            await prisma.stravaActivity.upsert({
                where: { stravaActivityId: BigInt(activity.id) },
                update: {
                    name: activity.name,
                    distanceMeters: activity.distance,
                    movingTimeSeconds: activity.moving_time,
                    elapsedTimeSeconds: activity.elapsed_time,
                    totalElevationGain: activity.total_elevation_gain ?? null,
                    averageSpeedMs: activity.average_speed ?? null,
                    maxSpeedMs: activity.max_speed ?? null,
                    averageHeartrate: activity.average_heartrate ?? null,
                    maxHeartrate: activity.max_heartrate ?? null,
                    weightedAverageWatts: activity.weighted_average_watts ?? null,
                    syncedAt: new Date(),
                },
                create: {
                    userId: user.id,
                    stravaActivityId: BigInt(activity.id),
                    activityType: activity.sport_type ?? activity.type,
                    name: activity.name,
                    distanceMeters: activity.distance,
                    movingTimeSeconds: activity.moving_time,
                    elapsedTimeSeconds: activity.elapsed_time,
                    totalElevationGain: activity.total_elevation_gain ?? null,
                    startDate: new Date(activity.start_date),
                    startDateLocal: new Date(activity.start_date_local),
                    averageSpeedMs: activity.average_speed ?? null,
                    maxSpeedMs: activity.max_speed ?? null,
                    averageHeartrate: activity.average_heartrate ?? null,
                    maxHeartrate: activity.max_heartrate ?? null,
                    weightedAverageWatts: activity.weighted_average_watts ?? null,
                    externalId: activity.external_id ?? null,
                    uploadId: activity.upload_id ? BigInt(activity.upload_id) : null,
                },
            });
            synced++;
        } catch (err) {
            console.error(`[sync/strava] Failed to upsert activity ${activity.id}:`, err);
            skipped++;
        }
    }

    return NextResponse.json({ synced, skipped, total: activities.length });
}
