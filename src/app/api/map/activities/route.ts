import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { fetchStravaActivitiesPage, getValidAccessToken } from "@/lib/auth/strava";
import { prisma } from "@/lib/db/client";

function toPositiveInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.floor(parsed);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
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
        },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const searchParams = new URL(req.url).searchParams;
    const page = toPositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(toPositiveInt(searchParams.get("limit"), 50), 50);

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
    } catch (error) {
        console.error("[map/activities] Token refresh failed:", error);
        return NextResponse.json({ error: "Token refresh failed. Please reconnect Strava." }, { status: 401 });
    }

    try {
        const activities = await fetchStravaActivitiesPage(accessToken, page, limit);
        const mappedActivities = activities
            .map((activity) => ({
                id: activity.id,
                name: activity.name,
                distance: activity.distance,
                summaryPolyline: activity.map?.summary_polyline ?? null,
            }))
            .filter((activity) => Boolean(activity.summaryPolyline));

        return NextResponse.json({
            activities: mappedActivities,
            pagination: {
                page,
                limit,
                returned: mappedActivities.length,
                hasMore: activities.length === limit,
            },
        });
    } catch (error) {
        console.error("[map/activities] Failed to fetch activities:", error);
        return NextResponse.json(
            { error: "Unable to load map activities from Strava right now." },
            { status: 502 },
        );
    }
}
